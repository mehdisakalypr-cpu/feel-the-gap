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
  return createBrowserClient(URL, ANON, {
    cookieOptions: {
      name: 'sb-auth',
      path: '/',
      sameSite: 'lax',
      secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 7, // 7d rolling; middleware refreshes
    },
  })
}
