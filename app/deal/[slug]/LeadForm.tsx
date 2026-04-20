'use client'

import { useState } from 'react'

export function LeadForm({ slug, productLabel }: { slug: string; productLabel: string }) {
  const [state, setState] = useState<{ busy: boolean; sent: boolean; error: string | null }>({
    busy: false, sent: false, error: null,
  })

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setState({ busy: true, sent: false, error: null })
    const form = new FormData(e.currentTarget)
    const payload = {
      channel: 'form' as const,
      buyer_name: String(form.get('buyer_name') ?? ''),
      buyer_email: String(form.get('buyer_email') ?? ''),
      buyer_phone: String(form.get('buyer_phone') ?? ''),
      buyer_country: String(form.get('buyer_country') ?? ''),
      company: String(form.get('company') ?? ''),
      qty_requested: String(form.get('qty_requested') ?? ''),
      message: String(form.get('message') ?? ''),
    }
    try {
      const res = await fetch(`/api/deal/${encodeURIComponent(slug)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setState({ busy: false, sent: false, error: (j as { error?: string }).error ?? 'submission_failed' })
        return
      }
      setState({ busy: false, sent: true, error: null })
    } catch (err) {
      setState({ busy: false, sent: false, error: err instanceof Error ? err.message : 'network_error' })
    }
  }

  if (state.sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-sm text-emerald-200">
        Merci, votre demande a été envoyée au vendeur. Vous serez contacté sous 24-48h.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-neutral-300">Demande d&apos;information</h3>
      <div className="grid grid-cols-1 gap-3">
        <Field name="buyer_name" label="Votre nom" required />
        <Field name="buyer_email" label="Email" type="email" required />
        <Field name="buyer_phone" label="Téléphone / WhatsApp" type="tel" />
        <Field name="company" label="Société" />
        <Field name="buyer_country" label="Pays (ISO)" maxLength={3} />
        <Field name="qty_requested" label={`Quantité souhaitée (${productLabel})`} />
        <label className="block text-xs text-neutral-400">
          Message
          <textarea
            name="message"
            rows={3}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-[#C9A84C]/50"
          />
        </label>
      </div>
      {state.error && <p className="mt-3 text-xs text-red-300">Erreur : {state.error}</p>}
      <button
        type="submit"
        disabled={state.busy}
        className="mt-4 w-full rounded-xl bg-[#C9A84C] px-4 py-2.5 text-sm font-semibold text-[#07090F] hover:bg-[#d6b658] disabled:opacity-60"
      >
        {state.busy ? 'Envoi…' : 'Envoyer ma demande'}
      </button>
    </form>
  )
}

function Field({ name, label, type = 'text', required, maxLength }: {
  name: string; label: string; type?: string; required?: boolean; maxLength?: number
}) {
  return (
    <label className="block text-xs text-neutral-400">
      {label}{required && <span className="text-red-400"> *</span>}
      <input
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-[#C9A84C]/50"
      />
    </label>
  )
}
