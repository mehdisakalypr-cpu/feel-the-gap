/**
 * 👸 HANCOCK — persona contextualized per lead.
 *
 * Given a lead row (title + company + country + gap-matched opps + segment),
 * generates a rich psychological profile AND a ready-to-send message for
 * each sequence step. Cached on the enrollment so subsequent touches stay
 * coherent (same "voice" across email + LinkedIn + WhatsApp).
 *
 * V1 was LLM-only generic. V2 uses our real FTG data: the lead's
 * country × product top opportunities become the hook.
 */
import { runCascadeJson } from '@/lib/ai/cascade'

export interface HancockPersona {
  voice: {
    tone: 'formal' | 'semi_casual' | 'casual'
    pace: 'direct' | 'narrative' | 'data_first'
    hooks: string[]        // what this person responds to (ego, data, curiosity, FOMO)
    avoid: string[]        // what turns them off
  }
  pain_points_inferred: string[]
  relevant_ftg_angle: string   // which FTG angle resonates most
  greeting_style: string        // 'Bonjour {firstName}' | 'Hi {firstName},' | 'Dear Mr. {lastName}'
  signature_style: string
  language: 'fr' | 'en' | 'es' | 'de'
  top_gap_hook: {
    product: string
    country: string
    gap_value_m_usd: number
    fmt_hook: string            // pre-formatted one-liner ready to paste in messages
  } | null
}

const PROMPT = (lead: any, topOpps: any[]) => `Tu es 👸 **BOA HANCOCK**, experte en psychologie de prospects B2B. On doit outreacher ce lead avec une sequence multi-touch.

**Lead** :
\`\`\`json
${JSON.stringify({
  title: lead.title,
  company: lead.company_name,
  country: lead.company_country_iso,
  segment: lead.segment,
  first_name: lead.first_name,
  bio: lead.source_payload?.headline ?? lead.source_payload?.bio ?? null,
  company_size: lead.company_size_range,
}, null, 2)}
\`\`\`

**Top 3 FTG opportunities dans son pays** (gap data qui va lui parler) :
\`\`\`json
${JSON.stringify(topOpps, null, 2)}
\`\`\`

**Ta mission** : profile-le psychologiquement et génère sa "voice signature" pour toute la sequence. On doit parler comme quelqu'un qui le comprend, pas un vendeur générique.

Retourne UNIQUEMENT du JSON valide :

{
  "voice": {
    "tone": "formal|semi_casual|casual",
    "pace": "direct|narrative|data_first",
    "hooks": ["string — ce qui l'active"],
    "avoid": ["string — ce qui le bloque"]
  },
  "pain_points_inferred": ["string — 2-3 douleurs probables vu son profil"],
  "relevant_ftg_angle": "string — angle FTG qui résonne le plus (ex: 'gap import €45M sur semi USA = opportunité immédiate')",
  "greeting_style": "string — 'Bonjour {firstName},' ou 'Hi {firstName},' ou 'Dear Mr. {lastName},'",
  "signature_style": "string — 'Mehdi' ou 'Mehdi Sakaly — FTG' ou 'Mehdi • Founder Feel The Gap'",
  "language": "fr|en|es|de",
  "top_gap_hook": {
    "product": "string",
    "country": "string",
    "gap_value_m_usd": number,
    "fmt_hook": "string — une ligne percutante avec le gap chiffré prête à coller"
  }
}`

export async function generateHancockPersona(
  lead: any,
  topOpps: any[] = [],
): Promise<HancockPersona | null> {
  try {
    const result = await runCascadeJson({
      tier: 'standard',
      task: 'hancock-persona',
      basePrompt: PROMPT(lead, topOpps),
    })
    return result as HancockPersona
  } catch (e) {
    console.warn('[hancock] persona gen failed:', (e as Error).message.slice(0, 100))
    return null
  }
}

/**
 * Render a message template with persona variables + lead variables.
 * Templates use {{var}} handlebars-style; we do a simple replace.
 */
export function renderTouchMessage(
  template: string,
  lead: any,
  persona: HancockPersona | null,
  overrides: Record<string, string> = {},
): string {
  const vars: Record<string, string> = {
    firstName: lead.first_name ?? 'there',
    lastName: lead.last_name ?? '',
    fullName: lead.full_name ?? [lead.first_name, lead.last_name].filter(Boolean).join(' '),
    companyName: lead.company_name ?? 'your company',
    country: lead.company_country_iso ?? '',
    title: lead.title ?? '',
    greeting: persona?.greeting_style ?? 'Bonjour {firstName},',
    signature: persona?.signature_style ?? 'Mehdi',
    topProduct: persona?.top_gap_hook?.product ?? (lead.gap_match_opps?.[0]?.product_name ?? 'key commodities'),
    topCountry: persona?.top_gap_hook?.country ?? lead.company_country_iso ?? '',
    topGapMillion: String(persona?.top_gap_hook?.gap_value_m_usd ?? Math.round((lead.gap_match_opps?.[0]?.gap_value_usd ?? 0) / 1_000_000)),
    topGapHook: persona?.top_gap_hook?.fmt_hook ?? '',
    ftgAngle: persona?.relevant_ftg_angle ?? '',
    myFirstName: 'Mehdi',
    ...overrides,
  }
  // Resolve nested placeholders (e.g., greeting itself contains {firstName})
  let out = template
  for (let pass = 0; pass < 3; pass++) {
    out = out.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
  }
  return out
}
