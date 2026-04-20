// © 2025-2026 Feel The Gap — store admin UI helpers (client-safe)

export function fmtMoney(cents?: number | null, currency = 'EUR'): string {
  if (cents == null) return '\u2014'
  const v = Number(cents) / 100
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(v)
  } catch {
    return `${v.toFixed(2)} \u20ac`
  }
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '\u2014'
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function eurosToCents(value: string | number): number {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
  if (!isFinite(n)) return 0
  return Math.round(n * 100)
}

export function centsToEuros(cents?: number | null): string {
  if (cents == null) return ''
  return (Number(cents) / 100).toString()
}
