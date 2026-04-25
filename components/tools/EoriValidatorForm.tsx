'use client'

import { useState } from 'react'

type Result =
  | { ok: true; valid: boolean; country_iso: string; country_name: string; format_hint: string; gated_email_sent: boolean }
  | { ok: false; error: string }

export default function EoriValidatorForm() {
  const [eori, setEori] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!eori.trim() || !email.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch('/api/tools/eori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eori: eori.trim().toUpperCase(), email: email.trim().toLowerCase() }),
      })
      const j = (await r.json()) as Result
      setResult(j)
    } catch {
      setResult({ ok: false, error: 'Network error — please retry' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 md:p-8">
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-wider text-white/60">EORI number</span>
          <input
            value={eori}
            onChange={(e) => setEori(e.target.value)}
            placeholder="e.g. GB123456789000 or FR12345678901234"
            autoComplete="off"
            className="rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-base font-mono tracking-wider focus:border-[#C9A84C] focus:outline-none"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-wider text-white/60">Your work email (we send the report there)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            className="rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-base focus:border-[#C9A84C] focus:outline-none"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading || !eori.trim() || !email.trim()}
          className="mt-2 rounded-lg bg-[#C9A84C] px-5 py-3 text-sm font-semibold text-black hover:bg-[#d8b864] disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Checking…' : 'Validate EORI format'}
        </button>

        <p className="text-xs text-white/40">
          By submitting you agree to receive the validation report and occasional updates from Feel The Gap.
          Unsubscribe in one click.
        </p>
      </form>

      {result && (
        <div className="mt-6 rounded-lg border border-white/10 bg-black/30 p-5">
          {result.ok ? (
            result.valid ? (
              <div>
                <div className="flex items-center gap-2 text-green-400 font-semibold mb-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                  Valid format · {result.country_name} ({result.country_iso})
                </div>
                <p className="text-sm text-white/70 mb-2">
                  This EORI matches the expected format for {result.country_name}.
                </p>
                <p className="text-xs text-white/50">
                  Format rule: <code className="text-[#C9A84C]">{result.format_hint}</code>
                </p>
                {result.gated_email_sent && (
                  <p className="mt-3 text-xs text-white/50">📧 Full report sent to your inbox.</p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                  Invalid format · {result.country_name || 'unknown country'}
                </div>
                <p className="text-sm text-white/70 mb-2">
                  Your input does not match the expected EORI format
                  {result.country_name ? ` for ${result.country_name}.` : '.'}
                </p>
                <p className="text-xs text-white/50">
                  Expected: <code className="text-[#C9A84C]">{result.format_hint}</code>
                </p>
              </div>
            )
          ) : (
            <div className="text-red-400 text-sm">⚠ {result.error}</div>
          )}
        </div>
      )}
    </div>
  )
}
