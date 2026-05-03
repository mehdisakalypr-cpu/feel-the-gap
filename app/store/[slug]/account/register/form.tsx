// © 2025-2026 Feel The Gap — buyer register form (client)
'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { PasswordField } from '@/components/auth/PasswordField'

interface Props {
  slug: string
  storeName: string
  postLoginPath: string
}

export function RegisterForm({ slug, storeName, postLoginPath }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (password.length < 12) { setError('Mot de passe : minimum 12 caractères.'); return }
    if (!accept) { setError('Vous devez accepter les CGV de la boutique.'); return }
    setBusy(true)
    try {
      const sb = createSupabaseBrowser()
      const { data, error: signUpErr } = await sb.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            store_slug: slug,
          },
        },
      })
      if (signUpErr) {
        setError(signUpErr.message)
        setBusy(false)
        return
      }
      // Supabase may auto-sign-in if email confirmations are disabled.
      if (data.session) {
        router.push(postLoginPath)
        router.refresh()
        return
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible')
    } finally {
      setBusy(false)
    }
  }, [email, password, fullName, accept, busy, router, postLoginPath, slug])

  if (done) {
    return (
      <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
        <h2 className="text-lg font-semibold text-white">Vérifiez votre email</h2>
        <p className="mt-2 text-sm text-gray-400">
          Nous vous avons envoyé un lien de confirmation pour activer votre compte sur {storeName}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
      <Field label="Nom complet" id="reg-full-name" type="text" autoComplete="name" required value={fullName} onChange={setFullName} />
      <Field label="Email" id="reg-email" type="email" autoComplete="email" required value={email} onChange={setEmail} />
      <div className="space-y-1">
        <label htmlFor="reg-password" className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Mot de passe
        </label>
        <PasswordField name="password" autoComplete="new-password" required minLength={12} value={password} onChange={setPassword} />
        <div className="text-[10px] text-gray-500">12 caractères minimum</div>
      </div>

      <label htmlFor="reg-accept" className="flex items-start gap-2 text-xs text-gray-400">
        <input
          id="reg-accept"
          type="checkbox"
          checked={accept}
          onChange={e => setAccept(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          J&apos;accepte les CGV et la politique de confidentialité de {storeName}.
        </span>
      </label>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !email || !password || !fullName || !accept}
        className="w-full rounded-xl bg-[#C9A84C] px-4 py-3 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Création…' : 'Créer mon compte'}
      </button>
    </form>
  )
}

function Field(props: {
  label: string
  id: string
  type: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  autoComplete?: string
  minLength?: number
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.id} className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type}
        autoComplete={props.autoComplete}
        required={props.required}
        minLength={props.minLength}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white focus:border-[#C9A84C] focus:outline-none"
      />
      {props.hint && <div className="text-[10px] text-gray-500">{props.hint}</div>}
    </div>
  )
}
