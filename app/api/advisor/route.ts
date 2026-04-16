import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthUser } from '@/lib/supabase-server'

// Cost tracking: charge ~4× API cost per session
// Gemini 2.0 Flash input: $0.10/1M tokens, output: $0.40/1M tokens
// Average session ~4000 tokens → ~$0.002 cost → charge €0.008 internally → session price €15

const SYSTEM_PROMPT = `Tu es un expert en développement business international spécialisé dans les opportunités d'import/export et d'investissement dans les marchés émergents.

Tu analyses des opportunités de "trade gap" — des marchés où la demande locale dépasse la production ou l'offre locale — et tu aides des entrepreneurs, importateurs et investisseurs à saisir ces opportunités.

Pour chaque conseil, tu dois :
1. Être précis et actionnable (pas de généralités)
2. Donner des chiffres concrets (investissement requis, marges attendues, délais réalistes)
3. Identifier les risques spécifiques au pays et au secteur
4. Proposer des prochaines étapes concrètes

Tu réponds en français sauf si le client écrit dans une autre langue. Sois direct, structuré, professionnel.`

function buildContextMessage(context: {
  country: string
  iso: string
  product: string
  category: string
  strategy: string
  userBudget?: string
  userTimeline?: string
  userSector?: string
}): string {
  const strategyLabels: Record<string, string> = {
    trade:      'Import & Distribution (achat à l\'étranger + revente locale)',
    production: 'Production locale (installation d\'une capacité de fabrication)',
    training:   'Formation & transfert de compétences (modèle services/consulting)',
  }

  return [
    `CONTEXTE DE L'OPPORTUNITÉ :`,
    `- Pays cible : ${context.country} (${context.iso})`,
    `- Produit/secteur : ${context.product} (catégorie : ${context.category})`,
    `- Stratégie choisie : ${strategyLabels[context.strategy] ?? context.strategy}`,
    context.userBudget   ? `- Budget disponible du client : ${context.userBudget}` : '',
    context.userTimeline ? `- Horizon de temps : ${context.userTimeline}` : '',
    context.userSector   ? `- Secteur d'activité actuel : ${context.userSector}` : '',
  ].filter(Boolean).join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()

    if (!messages?.length || !context?.country) {
      return new Response('Bad request', { status: 400 })
    }

    // Auth check — require authenticated user
    const user = await getAuthUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    const mistralKey = process.env.MISTRAL_API_KEY
    if (!geminiKey && !mistralKey) {
      return new Response('AI not configured', { status: 503 })
    }

    const contextMsg = buildContextMessage(context)

    // ── Try Gemini first (free tier), fall back to Mistral on failure ──────
    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction: SYSTEM_PROMPT,
        })

        const chatMessages = messages.map((m: { role: string; content: string }, i: number) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: i === 0 ? contextMsg + '\n\n' + m.content : m.content }],
        }))

        const lastUserMessage = chatMessages[chatMessages.length - 1]
        const history = chatMessages.slice(0, -1)
        const chat = model.startChat({ history })

        // Probe call — if Gemini errors out (API disabled, quota), we'll throw and fall through
        const result = await chat.sendMessageStream(lastUserMessage.parts[0].text)

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder()
            try {
              for await (const chunk of result.stream) {
                const text = chunk.text()
                if (text) {
                  const data = JSON.stringify({ choices: [{ delta: { content: text } }] })
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                }
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            } finally {
              controller.close()
            }
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      } catch (gemErr) {
        console.warn('[/api/advisor] Gemini failed, falling back to Mistral:', (gemErr as Error).message)
      }
    }

    // ── Mistral fallback (OpenAI-compatible streaming) ───────────────────
    if (!mistralKey) {
      return new Response('AI provider unavailable', { status: 503 })
    }

    const mistralMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: { role: string; content: string }, i: number) => ({
        role: m.role,
        content: i === 0 ? contextMsg + '\n\n' + m.content : m.content,
      })),
    ]

    const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: mistralMessages,
        stream: true,
        temperature: 0.7,
      }),
    })

    if (!mistralRes.ok || !mistralRes.body) {
      const errTxt = await mistralRes.text().catch(() => '')
      console.error('[/api/advisor] Mistral error:', mistralRes.status, errTxt)
      return new Response('AI provider error', { status: 502 })
    }

    // Pass through Mistral's SSE directly (same OpenAI format the client expects)
    return new Response(mistralRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[/api/advisor]', err)
    return new Response('Internal error', { status: 500 })
  }
}
