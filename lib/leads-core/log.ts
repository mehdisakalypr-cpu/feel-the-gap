import { vaultClient } from './client'
import type { SourceId, SyncResult } from './types'

export async function logSync(opts: {
  source_id: SourceId
  project?: string | null
  operation: 'ingest' | 'sync' | 'verify' | 'delta'
  result: SyncResult
}): Promise<void> {
  const sb = vaultClient()
  await (sb.from as any)('lv_sync_log').insert({
    source_id: opts.source_id,
    project: opts.project ?? null,
    operation: opts.operation,
    rows_processed: opts.result.rows_processed,
    rows_inserted: opts.result.rows_inserted,
    rows_updated: opts.result.rows_updated,
    rows_skipped: opts.result.rows_skipped,
    duration_ms: opts.result.duration_ms,
    error: opts.result.error ?? null,
    metadata: opts.result.metadata ?? {},
    finished_at: new Date().toISOString(),
  })
}

export async function bumpSourceStock(opts: {
  source_id: SourceId
  delta_count: number
  is_full_pull?: boolean
}): Promise<void> {
  const sb = vaultClient()
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    last_delta_pull_at: now,
  }
  if (opts.is_full_pull) patch.last_full_pull_at = now
  await (sb.from as any)('lv_sources').update(patch).eq('id', opts.source_id)
  // increment total_records using RPC-less approach
  const { data: row } = await (sb.from as any)('lv_sources').select('total_records').eq('id', opts.source_id).single()
  const current = (row?.total_records as number | undefined) ?? 0
  await (sb.from as any)('lv_sources').update({ total_records: current + opts.delta_count }).eq('id', opts.source_id)
}
