/**
 * Shared AI provider rotation — 6 providers, priorité gratuit
 * Gemini free → Groq free → Mistral → Anthropic Claude → Cerebras → OpenAI (dernier recours)
 */
import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

export interface Provider { name: string; model: LanguageModel; exhausted: boolean }

export function buildProviders(): Provider[] {
  const p: Provider[] = []
  // Gratuits en priorité — rotation Gemini (quota 20 rpm/clé, ×N throughput)
  const geminiKeys = [
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_2,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_3,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_4,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_5,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_6,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_7,
  ].filter(Boolean) as string[]
  geminiKeys.forEach((k, i) => {
    const g = createGoogleGenerativeAI({ apiKey: k })
    p.push({ name: `Gemini${i === 0 ? '' : '_' + (i + 1)}`, model: g('gemini-2.5-flash'), exhausted: false })
  })
  const groqKeys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
  ].filter(Boolean) as string[]
  groqKeys.forEach((k, i) => {
    const g = createGroq({ apiKey: k })
    p.push({ name: `Groq${i === 0 ? '' : '_' + (i + 1)}`, model: g('llama-3.3-70b-versatile'), exhausted: false })
  })
  if (process.env.MISTRAL_API_KEY) { const m = createMistral({ apiKey: process.env.MISTRAL_API_KEY }); p.push({ name: 'Mistral', model: m('mistral-small-latest'), exhausted: false }) }
  if (process.env.ANTHROPIC_API_KEY) {
    const a = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    p.push({ name: 'Claude_Haiku', model: a('claude-haiku-4-5-20251001'), exhausted: false })
  }
  if (process.env.CEREBRAS_API_KEY) {
    const c = createOpenAI({ apiKey: process.env.CEREBRAS_API_KEY, baseURL: 'https://api.cerebras.ai/v1' })
    p.push({ name: 'Cerebras_Qwen', model: c('qwen-3-235b-a22b-instruct-2507'), exhausted: false })
    p.push({ name: 'Cerebras_Llama', model: c('llama3.1-8b'), exhausted: false })
  }
  // Payant en dernier recours — rotation sur toutes les clés OpenAI dispo
  const openaiKeys = [
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_API_KEY_2,
    process.env.OPENAI_API_KEY_3,
    process.env.OPENAI_API_KEY_4,
    process.env.OPENAI_API_KEY_5,
  ].filter(Boolean) as string[]
  openaiKeys.forEach((k, i) => {
    const o = createOpenAI({ apiKey: k })
    p.push({ name: `OpenAI${i === 0 ? '' : '_' + (i + 1)}`, model: o('gpt-4o-mini'), exhausted: false })
  })
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
      const m = err.message?.toLowerCase() || ''
      if (m.match(/429|quota|rate|billing|disabled|exceeded|high demand|overload|unavailable|503|404|not.?found|service.*busy|resource.?exhausted|restricted|organization|forbidden|invalid[_ ]api[_ ]key|authentication|permission|401|403/)) {
        p.exhausted = true; idx = (idx + 1) % providers.length; continue
      }
      throw err
    }
  }
  throw new Error('All providers exhausted')
}
