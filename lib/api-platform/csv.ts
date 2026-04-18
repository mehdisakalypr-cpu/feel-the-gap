/**
 * lib/api-platform/csv — export CSV pour les /v1 endpoints.
 * Escape RFC 4180 (double quotes + wrap si , " \n).
 */

function escapeField(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s: string
  if (typeof v === 'object') s = JSON.stringify(v)
  else s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (!rows || rows.length === 0) {
    return columns ? columns.join(',') + '\n' : ''
  }
  const cols = columns ?? Object.keys(rows[0])
  const header = cols.join(',')
  const lines = rows.map(r => cols.map(c => escapeField(r[c])).join(','))
  return [header, ...lines].join('\n') + '\n'
}

export function csvResponse(csv: string, filename: string, extra?: Record<string, string>): Response {
  const headers: Record<string, string> = {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
    ...(extra ?? {}),
  }
  return new Response(csv, { status: 200, headers })
}
