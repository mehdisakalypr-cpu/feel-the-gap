'use client'

/**
 * authFetch — central helper for every client → /api/auth/* call.
 *
 * Purpose: make it IMPOSSIBLE to forget the `x-csrf-token` header on unsafe
 * methods (POST/PUT/PATCH/DELETE). The server assertCsrf guard checks for a
 * double-submit cookie + header pair and returns 403 on mismatch; silently
 * missing it was the root cause of several 403→ghost-failures in the v2 rollout.
 *
 * Every client-side auth fetch should go through this helper.
 *
 * Usage:
 *   import { authFetch, parseAuthError } from '@/lib/auth-v2/client-fetch'
 *   const res = await authFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({...}) })
 *   const json = await res.json().catch(() => null)
 *   if (!res.ok) setError(parseAuthError(res, json))
 */

export function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.split('; ').find(c => c.startsWith('csrf='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : null
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const isUnsafe = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
  const csrf = isUnsafe ? readCsrfCookie() : null

  const headers = new Headers(init.headers)
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json')
  if (csrf && !headers.has('x-csrf-token')) headers.set('x-csrf-token', csrf)

  return fetch(input, {
    credentials: 'include',
    ...init,
    headers,
  })
}

/** Map a failed auth response to a user-facing French string. */
export function parseAuthError(res: Response, body: unknown): string {
  const b = (body ?? {}) as { error?: string; message?: string; reason?: string }
  if (res.status === 429) return 'Trop de tentatives. Réessayez dans quelques minutes.'
  if (res.status === 403) {
    if (b.error === 'csrf_missing' || b.error === 'csrf_mismatch' || b.error === 'csrf_invalid') {
      return 'Session expirée. Rechargez la page et réessayez.'
    }
    return 'Accès refusé.'
  }
  if (res.status === 400) {
    if (b.error === 'Vérification anti-bot échouée') return 'Vérification anti-bot échouée. Rechargez la page.'
    if (b.reason === 'password_in_breach' || b.reason === 'pwned') return 'Ce mot de passe a été compromis dans une fuite. Choisissez-en un autre.'
    if (b.error === 'invalid_input') return 'Informations manquantes ou invalides.'
    return b.error ?? 'Requête invalide.'
  }
  if (res.status === 401) return b.error ?? 'Identifiants invalides'
  if (res.status === 404) return 'Ressource introuvable.'
  if (res.status >= 500) return 'Erreur serveur. Réessayez plus tard.'
  return b.error ?? b.message ?? 'Erreur inconnue.'
}
