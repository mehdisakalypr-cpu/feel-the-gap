'use client'

import { useCallback, useState } from 'react'

export type FillTheGapAction = 'video' | 'clients' | 'store' | 'recap' | 'ai_engine' | 'bp_bulk'

export type DebitResult =
  | { ok: true; balance: number }
  | { ok: false; error: 'insufficient' | 'no_quota' | 'unauthorized' | 'server_error' | 'network'; balance?: number }

/**
 * Hook thin wrapper autour de POST /api/credits/fillthegap/debit.
 * Retourne { debit, loading } ; `debit` fait un Promise<DebitResult>.
 */
export function useFillTheGapDebit() {
  const [loading, setLoading] = useState(false)

  const debit = useCallback(
    async (
      action: FillTheGapAction,
      qty: number = 1,
      ref?: { ref_type?: string; ref_id?: string },
    ): Promise<DebitResult> => {
      setLoading(true)
      try {
        const res = await fetch('/api/credits/fillthegap/debit', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action,
            qty,
            ref_type: ref?.ref_type,
            ref_id:   ref?.ref_id,
          }),
        })

        const json = await res.json().catch(() => ({} as any))

        if (res.ok && json?.ok) {
          return { ok: true, balance: Number(json.balance ?? 0) }
        }

        // Map known HTTP codes
        if (res.status === 402) return { ok: false, error: 'insufficient' }
        if (res.status === 403) return { ok: false, error: 'no_quota' }
        if (res.status === 401) return { ok: false, error: 'unauthorized' }

        return { ok: false, error: 'server_error' }
      } catch {
        return { ok: false, error: 'network' }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { debit, loading }
}
