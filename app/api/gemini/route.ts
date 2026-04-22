import { NextRequest } from 'next/server'
import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { getAuthUser } from '@/lib/supabase-server'
import { getServerLocale } from '@/lib/i18n/locale'
import { localizeSystemPrompt } from '@/lib/ai/localized-gen'

export const runtime = 'nodejs'

const BASE_SYSTEM = `You are Gemini, an AI assistant integrated into Feel The Gap — a global trade intelligence platform.
You help users with market research, trade analysis, business strategies, and any general questions.
Be concise, insightful, and direct. When relevant, connect your answers to trade, market opportunities, or international business.`

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const { messages } = await req.json()
  const locale = getServerLocale({ request: req })

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: localizeSystemPrompt(BASE_SYSTEM, locale),
    messages,
    maxOutputTokens: 2000,
  })

  return result.toUIMessageStreamResponse()
}
