const REPO = process.env.CONTENT_ENGINE_REPO ?? 'mehdisakalypr-cpu/feel-the-gap'
const GH_PAT = process.env.CONTENT_ENGINE_GH_PAT ?? process.env.GITHUB_PAT ?? ''
const WORKFLOW_FILE = process.env.CONTENT_ENGINE_WORKFLOW ?? 'content-${WORKFLOW_FILE}'

export type JobStatus = 'queued' | 'running' | 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out'

export interface WorkflowInputs {
  mode?: string
  prompt?: string
  asset_url?: string
  persona?: string
  target_saas?: string
  variants?: number
}

export interface TriggerResult {
  runId: string
  runUrl: string
}

export interface Artifact {
  id: number
  name: string
  size_in_bytes: number
  archive_download_url: string
  created_at: string
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${GH_PAT}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

export async function triggerWorkflow(inputs: WorkflowInputs): Promise<TriggerResult> {
  const dispatchRes = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: ghHeaders(),
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          mode: inputs.mode ?? 'regenerate',
          prompt: inputs.prompt ?? '',
          asset_url: inputs.asset_url ?? '',
          persona: inputs.persona ?? '',
          target_saas: inputs.target_saas ?? '',
          variants: String(inputs.variants ?? 1),
        },
      }),
    },
  )

  if (!dispatchRes.ok && dispatchRes.status !== 204) {
    const txt = await dispatchRes.text().catch(() => '')
    throw new Error(`GitHub dispatch failed: ${dispatchRes.status} ${txt}`)
  }

  // Wait briefly then fetch the latest run
  await new Promise(r => setTimeout(r, 3000))

  const runsRes = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1&event=workflow_dispatch`,
    { headers: ghHeaders() },
  )

  if (!runsRes.ok) {
    throw new Error(`Failed to fetch runs: ${runsRes.status}`)
  }

  const runsJson = await runsRes.json()
  const latestRun = runsJson.workflow_runs?.[0]
  if (!latestRun) {
    throw new Error('No run found after dispatch')
  }

  return {
    runId: String(latestRun.id),
    runUrl: latestRun.html_url,
  }
}

export async function pollJob(runId: string): Promise<{ status: JobStatus; conclusion: string | null; html_url: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/runs/${runId}`,
    { headers: ghHeaders() },
  )

  if (!res.ok) {
    throw new Error(`Failed to poll run ${runId}: ${res.status}`)
  }

  const data = await res.json()
  const ghStatus: string = data.status
  const conclusion: string | null = data.conclusion

  let status: JobStatus
  if (ghStatus === 'queued' || ghStatus === 'waiting' || ghStatus === 'requested' || ghStatus === 'pending') {
    status = 'queued'
  } else if (ghStatus === 'in_progress') {
    status = 'running'
  } else {
    status = (conclusion as JobStatus) ?? 'failure'
  }

  return { status, conclusion, html_url: data.html_url }
}

export async function listArtifacts(runId: string): Promise<Artifact[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/runs/${runId}/artifacts`,
    { headers: ghHeaders() },
  )

  if (!res.ok) return []
  const data = await res.json()
  return data.artifacts ?? []
}

export function getRawAssetUrl({ runId, path }: { runId: string; path: string }): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && path.startsWith('supabase://')) {
    const storagePath = path.replace('supabase://', '')
    return `${supabaseUrl}/storage/v1/object/public/${storagePath}`
  }
  return `https://raw.githubusercontent.com/${REPO}/main/dist/manual/${runId}/${path}`
}
