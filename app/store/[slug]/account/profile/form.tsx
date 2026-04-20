// © 2025-2026 Feel The Gap — profile form (display name + email + password change)
'use client'

import { useState, useCallback, useEffect, type FormEvent } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'

interface Props {
  slug: string
  email: string
}

export function ProfileForm({ slug, email }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [newEmail, setNewEmail] = useState(email)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  // Password change
  const [currentPwd, setCurrentPwd] = useState('')
  const [nextPwd, setNextPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch(`/api/store/${encodeURIComponent(slug)}/account/profile`)
      .then(r => r.ok ? r.json() : null)
      .then((j: { display_name?: string | null } | null) => {
        if (j?.display_name) setDisplayName(j.display_name)
      })
      .catch(() => { /* noop */ })
  }, [slug])

  const submitProfile = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (savingProfile) return
    setProfileMsg(null)
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/store/${encodeURIComponent(slug)}/account/profile`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          email: newEmail.trim().toLowerCase() !== email.trim().toLowerCase() ? newEmail.trim().toLowerCase() : undefined,
        }),
      })
      const json = await res.json().catch(() => null) as { ok?: boolean; error?: string; email_change_pending?: boolean } | null
      if (!res.ok || !json?.ok) {
        setProfileMsg({ ok: false, msg: json?.error ?? 'Mise à jour impossible' })
      } else if (json.email_change_pending) {
        setProfileMsg({ ok: true, msg: 'Email mis à jour : confirmez le changement via le lien envoyé à votre nouvelle adresse.' })
      } else {
        setProfileMsg({ ok: true, msg: 'Profil mis à jour.' })
      }
    } catch (err) {
      setProfileMsg({ ok: false, msg: err instanceof Error ? err.message : 'Erreur réseau' })
    } finally {
      setSavingProfile(false)
    }
  }, [displayName, newEmail, email, slug, savingProfile])

  const submitPwd = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (savingPwd) return
    setPwdMsg(null)
    if (nextPwd.length < 12) { setPwdMsg({ ok: false, msg: 'Minimum 12 caractères.' }); return }
    if (nextPwd !== confirmPwd) { setPwdMsg({ ok: false, msg: 'Les mots de passe ne correspondent pas.' }); return }
    if (nextPwd === currentPwd) { setPwdMsg({ ok: false, msg: 'Le nouveau doit être différent.' }); return }
    setSavingPwd(true)
    try {
      const sb = createSupabaseBrowser()
      // Re-authenticate with current pwd to confirm identity (anti-cookie-theft).
      const { error: reauthErr } = await sb.auth.signInWithPassword({ email, password: currentPwd })
      if (reauthErr) { setPwdMsg({ ok: false, msg: 'Mot de passe actuel incorrect.' }); setSavingPwd(false); return }
      const { error: updErr } = await sb.auth.updateUser({ password: nextPwd })
      if (updErr) { setPwdMsg({ ok: false, msg: updErr.message }); setSavingPwd(false); return }
      setPwdMsg({ ok: true, msg: '✓ Mot de passe mis à jour.' })
      setCurrentPwd(''); setNextPwd(''); setConfirmPwd('')
    } catch (err) {
      setPwdMsg({ ok: false, msg: err instanceof Error ? err.message : 'Erreur' })
    } finally {
      setSavingPwd(false)
    }
  }, [currentPwd, nextPwd, confirmPwd, email, savingPwd])

  return (
    <div className="space-y-6">
      <form onSubmit={submitProfile} className="space-y-4 rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">Identité</h2>
        <Field label="Nom complet" id="prof-name" type="text" autoComplete="name" value={displayName} onChange={setDisplayName} />
        <Field label="Email" id="prof-email" type="email" autoComplete="email" required value={newEmail} onChange={setNewEmail} hint="Un email de confirmation sera envoyé en cas de changement." />
        {profileMsg && (
          <div role="alert" className={`rounded-xl border px-3 py-2 text-sm ${profileMsg.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
            {profileMsg.msg}
          </div>
        )}
        <button
          type="submit"
          disabled={savingProfile}
          className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-60"
        >
          {savingProfile ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      <form onSubmit={submitPwd} className="space-y-4 rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">Mot de passe</h2>
        <Field label="Mot de passe actuel" id="pwd-current" type="password" autoComplete="current-password" required value={currentPwd} onChange={setCurrentPwd} />
        <Field label="Nouveau mot de passe" id="pwd-next" type="password" autoComplete="new-password" required value={nextPwd} onChange={setNextPwd} hint="12 caractères minimum" />
        <Field label="Confirmer" id="pwd-confirm" type="password" autoComplete="new-password" required value={confirmPwd} onChange={setConfirmPwd} />
        {pwdMsg && (
          <div role="alert" className={`rounded-xl border px-3 py-2 text-sm ${pwdMsg.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
            {pwdMsg.msg}
          </div>
        )}
        <button
          type="submit"
          disabled={savingPwd}
          className="rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-60"
        >
          {savingPwd ? 'Mise à jour…' : 'Changer le mot de passe'}
        </button>
      </form>
    </div>
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
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.id} className="text-xs font-semibold uppercase tracking-wide text-gray-400">{props.label}</label>
      <input
        id={props.id}
        type={props.type}
        autoComplete={props.autoComplete}
        required={props.required}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white focus:border-[#C9A84C] focus:outline-none"
      />
      {props.hint && <div className="text-[10px] text-gray-500">{props.hint}</div>}
    </div>
  )
}
