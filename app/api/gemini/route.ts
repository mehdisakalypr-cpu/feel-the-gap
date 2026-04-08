import { NextRequest } from 'next/server'
import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { getAuthUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const { messages } = await req.json()

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: `You are Gemini, an AI assistant integrated into Feel The Gap — a global trade intelligence platform.
You help users with market research, trade analysis, business strategies, and any general questions.
Be concise, insightful, and direct. When relevant, connect your answers to trade, market opportunities, or international business.`,
    messages,
    maxOutputTokens: 2000,
  })

  return result.toUIMessageStreamResponse()
}
