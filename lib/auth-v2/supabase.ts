/**
 * Supabase clients — browser-only wrappers.
 * NEVER import this file from server code — use supabase-server.ts there.
 */

'use client'

import { createBrowserClient } from '@supabase/ssr'

// We rely on NEXT_PUBLIC_ vars for the browser client.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createSupabaseBrowser() {
  if (!URL || !ANON) throw new Error('[auth-v2] missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  // IMPORTANT: do NOT override cookieOptions.name — @supabase/ssr derives the
  // session cookie name from the project ref (sb-<ref>-auth-token) and both
  // browser + server must agree. A custom name on the browser silently breaks
  // proxy.getUser() → causes a login→reload loop.
  return createBrowserClient(URL, ANON)
}
