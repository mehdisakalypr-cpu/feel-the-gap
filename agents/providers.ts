/**
 * Shared AI provider rotation — Gemini free + Groq free + Mistral
 * Import this in any agent to get 3-provider fallback chain.
 */
import { generateText } from 'ai'
import type { LanguageModelV1 } from 'ai'
import { google } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'

export interface Provider { name: string; model: LanguageModelV1; exhausted: boolean }

export function buildProviders(): Provider[] {
  const p: Provider[] = []
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) p.push({ name: 'Gemini', model: google('gemini-2.5-flash'), exhausted: false })
  if (process.env.GROQ_API_KEY) { const g = createGroq({ apiKey: process.env.GROQ_API_KEY }); p.push({ name: 'Groq', model: g('llama-3.3-70b-versatile'), exhausted: false }) }
  if (process.env.MISTRAL_API_KEY) { const m = createMistral({ apiKey: process.env.MISTRAL_API_KEY }); p.push({ name: 'Mistral', model: m('mistral-small-latest'), exhausted: false }) }
  if (!p.length) throw new Error('No AI API keys configured')
  return p
}

let providers: Provider[] = []
let idx = 0

export function initProviders() {
  providers = buildProviders()
  idx = 0
  console.log(`[PROVIDERS] ${providers.map(p => p.name).join(' + ')}`)
  return providers
}

export async function gen(prompt: string, tokens = 8192): Promise<string> {
  if (!providers.length) initProviders()
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[idx]; tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: tokens, temperature: 0.7 })
      return text
    } catch (err: any) {
      if (err.message?.toLowerCase().match(/429|quota|rate|billing|disabled/)) {
        p.exhausted = true; idx = (idx + 1) % providers.length; continue
      }
      throw err
    }
  }
  throw new Error('All providers exhausted')
}
