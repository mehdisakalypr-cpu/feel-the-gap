/**
 * agent-targets — read the active business-simulator scenario for a product
 * from Supabase `agent_targets`. Scouts/pitchers call this at boot so CC
 * simulator overrides propagate to agent batch sizes automatically.
 */
import { createClient } from '@supabase/supabase-js'

export type AgentTarget = {
  scenarioId: string
  objectiveType: 'mrr' | 'clients' | 'revenue'
  objectiveValue: number
  horizonDays: number
  results?: {
    leadsNeeded?: number
    paidNeeded?: number
    stageVolumes?: { id: string; volume: number }[]
    capacity?: { name: string; need: number }[]
  }
  maxMode?: boolean
}

export async function loadActiveTarget(product: 'ofa' | 'ftg' | 'estate' | 'shiftdynamics'): Promise<AgentTarget | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const { data } = await sb.from('agent_targets').select('target_json').eq('product', product).single()
  return (data?.target_json as AgentTarget) ?? null
}

export function needForAgent(target: AgentTarget | null, agentName: string): number | null {
  if (!target?.results?.capacity) return target?.results?.leadsNeeded ?? null
  const row = target.results.capacity.find(c => c.name === agentName)
  return row?.need ?? target.results.leadsNeeded ?? null
}
