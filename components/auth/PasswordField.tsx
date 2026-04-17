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
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 pr-20 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-neutral-300 hover:text-neutral-100"
          aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          tabIndex={-1}
          disabled={disabled}
        >
          {shown ? 'Masquer' : 'Afficher'}
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
