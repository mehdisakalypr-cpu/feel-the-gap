'use client'

import { useState } from 'react'

type State = 'idle' | 'open' | 'sending' | 'sent' | 'error'

export default function ContactWidget() {
  const [state, setState] = useState<State>('idle')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function send() {
    setState('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          message,
          source_path: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Erreur')
      setState('sent')
    } catch (e: any) {
      setErrorMsg(e.message || 'Erreur')
      setState('error')
    }
  }

  if (state === 'idle' || state === 'sent' || state === 'error') {
    return (
      <>
        {state === 'sent' && (
          <div
            role="status"
            style={{
              position: 'fixed', bottom: 86, right: 20, zIndex: 1000,
              maxWidth: 280, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(28, 156, 90, .94)', color: '#fff',
              fontSize: 13, boxShadow: '0 6px 24px rgba(0,0,0,.3)',
            }}
          >
            ✅ Message reçu. Réponse sous 1h en semaine.
          </div>
        )}
        <button
          onClick={() => { setState('open'); setEmail(''); setMessage(''); setErrorMsg('') }}
          aria-label="Une question ?"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
            width: 56, height: 56, borderRadius: '50%',
            background: '#C9A84C', color: '#0a0a1e',
            border: 'none', cursor: 'pointer',
            fontSize: 22, fontWeight: 800,
            boxShadow: '0 6px 24px rgba(201,168,76,.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          💬
        </button>
      </>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 1001,
        width: 340, maxWidth: 'calc(100vw - 40px)',
        background: '#0b0e16', color: '#E8EEF7',
        border: '1px solid rgba(201,168,76,.3)', borderRadius: 14,
        boxShadow: '0 16px 48px rgba(0,0,0,.5)',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C' }}>Une question ?</div>
          <div style={{ fontSize: 11, color: '#8a8d99' }}>Réponse sous 1h en semaine</div>
        </div>
        <button
          onClick={() => setState('idle')}
          aria-label="Fermer"
          style={{ background: 'transparent', border: 'none', color: '#8a8d99', cursor: 'pointer', fontSize: 18 }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          placeholder="ton@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: '#07090F', color: '#E8EEF7', fontSize: 13 }}
        />
        <textarea
          placeholder="Ta question, ton besoin, ton objection — on lit tout."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: '#07090F', color: '#E8EEF7', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
        />
        {errorMsg && <div style={{ fontSize: 12, color: '#fca' }}>{errorMsg}</div>}
        <button
          onClick={send}
          disabled={state === 'sending' || !email}
          style={{
            padding: '12px 16px', borderRadius: 8, border: 'none',
            background: '#C9A84C', color: '#0a0a1e', cursor: 'pointer',
            fontWeight: 800, fontSize: 13, letterSpacing: '.04em',
            opacity: state === 'sending' || !email ? 0.5 : 1,
          }}
        >
          {state === 'sending' ? 'Envoi…' : 'Envoyer'}
        </button>
        <div style={{ fontSize: 10, color: '#666', textAlign: 'center' }}>
          Envoyé à l'équipe Feel The Gap. Aucun spam, jamais.
        </div>
      </div>
    </div>
  )
}
