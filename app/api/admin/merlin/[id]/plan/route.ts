import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/supabase-server'
import { runCascadeJson } from '@/lib/ai/cascade'

export const maxDuration = 120

const PLAN_PROMPT = (idea: any) => `Tu es 🧙 MERLIN. L'utilisateur a shortlisté cette idée business :

\`\`\`json
${JSON.stringify(idea, null, 2)}
\`\`\`

Génère un **plan d'action activable** : chaque étape doit être concrète, chiffrée (temps + coût), et priorisable par timing ou budget.

Retourne UNIQUEMENT du JSON valide :

{
  "total_duration_days": number,
  "total_budget_eur": number,
  "critical_path": "string - la séquence minimum pour first revenue",
  "steps": [
    {
      "title": "string court",
      "description": "string 1-2 phrases",
      "owner": "mehdi|agents|external",
      "agents_involved": ["minato","kushina","..."],
      "duration_days": number,
      "cost_eur": number,
      "prerequisites": ["step idx or 'none'"],
      "deliverable": "string - ce qui est produit",
      "priority": 1-5,
      "can_skip_if": "string - condition pour sauter cette étape (cost cutting)",
      "can_delay_if": "string - condition pour différer"
    }
  ],
  "milestones": [
    {"day": number, "label": "string", "revenue_expected_eur": number}
  ],
  "agents_allocation": {"agent": "hours_per_week"},
  "quickstart_variant": {
    "description": "plan express minimum viable en 7 jours max, 500€ max",
    "steps_subset_idx": [0, 2, 4]
  }
}`

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: idea } = await db.from('business_ideas').select('*').eq('id', id).maybeSingle()
  if (!idea) return NextResponse.json({ error: 'idea not found' }, { status: 404 })

  try {
    const plan = await runCascadeJson({
      tier: 'premium',
      task: 'merlin-action-plan',
      basePrompt: PLAN_PROMPT(idea),
    })
    await db.from('business_ideas').update({
      action_plan: plan,
      action_plan_generated_at: new Date().toISOString(),
      status: 'planning',
    }).eq('id', id)
    return NextResponse.json({ ok: true, plan })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
