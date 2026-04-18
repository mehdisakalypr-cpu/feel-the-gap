/**
 * Shared AI provider rotation — 5 providers, priorité gratuit
 * Gemini free → Groq free → Mistral → Cerebras → OpenAI (dernier recours, payant)
 */
import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'

export interface Provider { name: string; model: LanguageModel; exhausted: boolean }

export function buildProviders(): Provider[] {
  const p: Provider[] = []
  // Gratuits en priorité — rotation sur 4 clés Gemini pour ×4 throughput (quota 20 rpm/clé)
  const geminiKeys = [
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_2,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_3,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_4,
  ].filter(Boolean) as string[]
  geminiKeys.forEach((k, i) => {
    const g = createGoogleGenerativeAI({ apiKey: k })
    p.push({ name: `Gemini${i === 0 ? '' : '_' + (i + 1)}`, model: g('gemini-2.5-flash'), exhausted: false })
  })
  if (process.env.GROQ_API_KEY) { const g = createGroq({ apiKey: process.env.GROQ_API_KEY }); p.push({ name: 'Groq', model: g('llama-3.3-70b-versatile'), exhausted: false }) }
  if (process.env.MISTRAL_API_KEY) { const m = createMistral({ apiKey: process.env.MISTRAL_API_KEY }); p.push({ name: 'Mistral', model: m('mistral-small-latest'), exhausted: false }) }
  if (process.env.CEREBRAS_API_KEY) { const c = createOpenAI({ apiKey: process.env.CEREBRAS_API_KEY, baseURL: 'https://api.cerebras.ai/v1' }); p.push({ name: 'Cerebras', model: c('llama-3.3-70b'), exhausted: false }) }
  // Payant en dernier recours
  if (process.env.OPENAI_API_KEY) { const o = createOpenAI({ apiKey: process.env.OPENAI_API_KEY }); p.push({ name: 'OpenAI', model: o('gpt-4o-mini'), exhausted: false }) }
  if (!p.length) throw new Error('No AI API keys configured')
  return p
}

let providers: Provider[] = []
let idx = 0

export function initProviders() {
  providers = buildProviders()
  idx = 0
  console.log(`[PROVIDERS] ${providers.map(p => p.name).join(' + ')} (${providers.length} providers)`)
  return providers
}

export async function gen(prompt: string, tokens = 8192): Promise<string> {
  if (!providers.length) initProviders()
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[idx]; tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxOutputTokens: tokens, temperature: 0.7 })
      return text
    } catch (err: any) {
      if (err.message?.toLowerCase().match(/429|quota|rate|billing|disabled|exceeded/)) {
        p.exhausted = true; idx = (idx + 1) % providers.length; continue
      }
      throw err
    }
  }
  throw new Error('All providers exhausted')
}
