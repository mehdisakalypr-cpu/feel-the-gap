// YouTube Data API v3 client
// Quota: 10 000 units/day (free tier)
// Cost per call: search.list=100, videos.list=1, channels.list=1
// Docs: https://developers.google.com/youtube/v3/docs

const API_BASE = 'https://www.googleapis.com/youtube/v3';
// Lazy getter so loadEnv() can populate process.env before first call
function getApiKey(): string | undefined {
  return process.env.YOUTUBE_API_KEY
}

export interface YouTubeSearchResult {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface YouTubeVideoDetails {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
  thumbnailUrl: string;
}

export interface SearchOptions {
  query: string;
  maxResults?: number;          // 1-50, default 10
  order?: 'relevance' | 'date' | 'viewCount' | 'rating';
  publishedAfter?: string;      // ISO 8601 (priorise fraicheur)
  publishedBefore?: string;
  relevanceLanguage?: string;   // ISO 639-1 (fr, en, es...)
  regionCode?: string;          // ISO 3166-1 alpha-2
  videoDuration?: 'short' | 'medium' | 'long';  // <4min, 4-20min, >20min
  videoCaption?: 'any' | 'closedCaption' | 'none';
}

// ─── Quota tracking (in-memory, best-effort) ────────────────────────────────
let quotaUsed = 0;
const QUOTA_DAILY_LIMIT = 10_000;

export function getQuotaUsed(): number {
  return quotaUsed;
}

export function resetQuotaCounter(): void {
  quotaUsed = 0;
}

function trackQuota(units: number): void {
  quotaUsed += units;
  if (quotaUsed > QUOTA_DAILY_LIMIT * 0.9) {
    console.warn(`[youtube-api] Quota ${quotaUsed}/${QUOTA_DAILY_LIMIT} — approaching limit`);
  }
}

// ─── Low-level fetch wrapper ────────────────────────────────────────────────
async function ytFetch<T>(endpoint: string, params: Record<string, string>, quotaCost: number): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not configured');
  }
  if (quotaUsed + quotaCost > QUOTA_DAILY_LIMIT) {
    throw new Error(`[youtube-api] Quota exceeded: ${quotaUsed}/${QUOTA_DAILY_LIMIT}`);
  }

  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[youtube-api] ${endpoint} ${res.status}: ${body.slice(0, 200)}`);
  }
  trackQuota(quotaCost);
  return res.json() as Promise<T>;
}

// ─── Search videos (100 units per call) ─────────────────────────────────────
export async function searchVideos(opts: SearchOptions): Promise<YouTubeSearchResult[]> {
  const params: Record<string, string> = {
    part: 'snippet',
    type: 'video',
    q: opts.query,
    maxResults: String(opts.maxResults ?? 10),
    order: opts.order ?? 'relevance',
  };
  if (opts.publishedAfter) params.publishedAfter = opts.publishedAfter;
  if (opts.publishedBefore) params.publishedBefore = opts.publishedBefore;
  if (opts.relevanceLanguage) params.relevanceLanguage = opts.relevanceLanguage;
  if (opts.regionCode) params.regionCode = opts.regionCode;
  if (opts.videoDuration) params.videoDuration = opts.videoDuration;
  if (opts.videoCaption) params.videoCaption = opts.videoCaption;

  interface SearchResponse {
    items: Array<{
      id: { videoId: string };
      snippet: {
        channelId: string;
        channelTitle: string;
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
      };
    }>;
  }

  const data = await ytFetch<SearchResponse>('search', params, 100);
  return data.items.map((item) => ({
    videoId: item.id.videoId,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl:
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.default?.url ??
      '',
  }));
}

// ─── Get video details (1 unit per call, up to 50 videos) ──────────────────
export async function getVideoDetails(videoIds: string[]): Promise<YouTubeVideoDetails[]> {
  if (videoIds.length === 0) return [];
  // Batch up to 50
  const batches: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    batches.push(videoIds.slice(i, i + 50));
  }

  const results: YouTubeVideoDetails[] = [];
  for (const batch of batches) {
    interface VideosResponse {
      items: Array<{
        id: string;
        snippet: {
          channelId: string;
          channelTitle: string;
          title: string;
          description: string;
          publishedAt: string;
          tags?: string[];
          defaultLanguage?: string;
          defaultAudioLanguage?: string;
          thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
        };
        contentDetails: { duration: string };
        statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
      }>;
    }

    const data = await ytFetch<VideosResponse>(
      'videos',
      {
        part: 'snippet,contentDetails,statistics',
        id: batch.join(','),
      },
      1,
    );

    for (const item of data.items) {
      results.push({
        videoId: item.id,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        durationSeconds: parseISO8601Duration(item.contentDetails.duration),
        viewCount: Number(item.statistics.viewCount ?? 0),
        likeCount: Number(item.statistics.likeCount ?? 0),
        commentCount: Number(item.statistics.commentCount ?? 0),
        tags: item.snippet.tags ?? [],
        defaultLanguage: item.snippet.defaultLanguage,
        defaultAudioLanguage: item.snippet.defaultAudioLanguage,
        thumbnailUrl:
          item.snippet.thumbnails.high?.url ??
          item.snippet.thumbnails.medium?.url ??
          item.snippet.thumbnails.default?.url ??
          '',
      });
    }
  }
  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function parseISO8601Duration(iso: string): number {
  // PT#H#M#S → seconds
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = Number(match[1] ?? 0);
  const m = Number(match[2] ?? 0);
  const s = Number(match[3] ?? 0);
  return h * 3600 + m * 60 + s;
}

// Combine search + details in one call for convenience
export async function searchAndEnrich(opts: SearchOptions): Promise<YouTubeVideoDetails[]> {
  const searchResults = await searchVideos(opts);
  if (searchResults.length === 0) return [];
  return getVideoDetails(searchResults.map((r) => r.videoId));
}
