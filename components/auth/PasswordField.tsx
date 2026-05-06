'use client'

/**
 * Password input with a show/hide toggle + ultra-light strength hint.
 *
 * Deliberately NO zxcvbn on the client:
 *   - keeps bundle tiny (~200 KB saved)
 *   - authoritative validation happens server-side via HIBP k-anonymity
 *   - client hint is purely a UX nudge (length-based)
 */

import { useId, useState } from 'react'

export interface PasswordFieldProps {
  name: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password webauthn' | 'current-password' | 'new-password'
  placeholder?: string
  label?: string
  required?: boolean
  showStrength?: boolean
  disabled?: boolean
  minLength?: number
  autoFocus?: boolean
}

function strengthLabel(v: string): { label: string; tone: 'weak' | 'ok' | 'strong' | 'none' } {
  if (!v) return { label: '', tone: 'none' }
  if (v.length < 12) return { label: 'Trop court', tone: 'weak' }
  if (v.length < 15) return { label: 'Acceptable', tone: 'ok' }
  return { label: 'Bon', tone: 'strong' }
}

export function PasswordField({
  name,
  value,
  onChange,
  autoComplete,
  placeholder = '••••••••••••',
  label,
  required,
  showStrength = false,
  disabled,
  minLength,
  autoFocus,
}: PasswordFieldProps) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const strength = showStrength ? strengthLabel(value) : { label: '', tone: 'none' as const }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm text-neutral-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          minLength={minLength}
          autoFocus={autoFocus}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 pr-12 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-white text-black shadow hover:bg-amber-100 aria-pressed:bg-amber-300 disabled:opacity-50"
          aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={shown}
          tabIndex={-1}
          disabled={disabled}
        >
          {shown ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" x2="22" y1="2" y2="22" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {showStrength && strength.tone !== 'none' && (
        <div className="flex items-center gap-2 text-xs">
          <span
            className={
              strength.tone === 'weak'
                ? 'text-red-400'
                : strength.tone === 'ok'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
            }
          >
            {strength.label}
          </span>
          <span className="text-neutral-500">15+ caractères recommandés</span>
        </div>
      )}
    </div>
  )
}

export default PasswordField
