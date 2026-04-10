import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// POST /api/funding/activate-role  body: { role: 'financeur' | 'investisseur' | 'influenceur' | 'entrepreneur' }
// Adds the role to the current user's profile.roles array and sets it as active_role.
export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json() as { role: string }
    if (!['financeur', 'investisseur', 'influenceur', 'entrepreneur'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(toSet) {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Read current roles
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    const currentRoles = (profile?.roles ?? ['entrepreneur']) as string[]
    const newRoles = currentRoles.includes(role) ? currentRoles : [...currentRoles, role]

    const { error } = await supabase
      .from('profiles')
      .update({ roles: newRoles, active_role: role })
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, roles: newRoles, active_role: role })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
