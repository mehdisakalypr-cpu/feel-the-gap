// Fetch transcript excerpts via the VPS-installed yt-transcript CLI
// (python-based, falls back silently if unavailable). Only runs server-side
// in background runners — never on Vercel request path.
//
// Uses execFile with argv array (no shell interpolation) so the videoId is
// always passed safely — execFile does NOT spawn a shell.
import { execFile } from 'node:child_process'

const CLI_PATH = process.env.YT_TRANSCRIPT_CLI || '/usr/local/bin/yt-transcript'
const EXCERPT_CHARS = 600
const TIMEOUT_MS = 20_000

function runCli(videoId: string, langPref: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`
    execFile(
      CLI_PATH,
      ['--json', '--no-meta', '--lang', langPref, url],
      { timeout: TIMEOUT_MS, maxBuffer: 2_000_000 },
      (err, stdout) => {
        if (err) return reject(err)
        resolve(stdout)
      },
    )
  })
}

export interface TranscriptResult {
  videoId: string
  excerpt: string | null
  lang: string | null
  fullLength: number
}

export async function fetchTranscriptExcerpt(videoId: string, langPref = 'fr,en'): Promise<TranscriptResult> {
  try {
    const stdout = await runCli(videoId, langPref)
    const parsed = JSON.parse(stdout)
    const full = String(parsed?.transcript ?? parsed?.text ?? '').trim()
    if (!full) return { videoId, excerpt: null, lang: parsed?.lang ?? null, fullLength: 0 }
    return {
      videoId,
      excerpt: full.slice(0, EXCERPT_CHARS),
      lang: parsed?.lang ?? null,
      fullLength: full.length,
    }
  } catch {
    // CLI missing, rate-limit, no transcript, invalid JSON — stay silent
    return { videoId, excerpt: null, lang: null, fullLength: 0 }
  }
}

export async function enrichWithTranscripts<T extends { videoId: string }>(
  videos: T[],
  opts: { langPref?: string; concurrency?: number } = {},
): Promise<(T & { transcript_excerpt: string | null; transcript_lang: string | null })[]> {
  const langPref = opts.langPref ?? 'fr,en'
  const concurrency = opts.concurrency ?? 3

  const results: (T & { transcript_excerpt: string | null; transcript_lang: string | null })[] = []
  let cursor = 0

  async function worker() {
    while (cursor < videos.length) {
      const idx = cursor++
      const v = videos[idx]
      const tr = await fetchTranscriptExcerpt(v.videoId, langPref)
      results[idx] = { ...v, transcript_excerpt: tr.excerpt, transcript_lang: tr.lang }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, videos.length) }, worker))
  return results
}
