/**
 * Mandatory wrapper for every LLM call that produces user-visible text.
 *
 * Why this file exists:
 *   Before this wrapper, each agent built its prompt with whatever locale
 *   awareness its author thought of. Result: 11+ agents hardcoded French,
 *   16+ agents ignored locale entirely, and users on /en saw mixed-language
 *   output (French reports next to English CTAs next to Spanish error messages).
 *
 *   The only structural fix is to route EVERY LLM call through this module.
 *   If a caller forgets to pass `locale`, TypeScript yells. If a caller
 *   somehow bypasses the wrapper, the pre-commit guard catches it.
 *
 * See: feedback_locale_consistency_rule.md
 *
 * Usage:
 *   import { genLocalized, localizeSystemPrompt } from '@/lib/ai/localized-gen'
 *
 *   // Raw text generation via the providers cascade
 *   const output = await genLocalized(prompt, { locale: 'en' })
 *
 *   // Or when using AI SDK's generateText / generateObject with a system prompt
 *   const { text } = await generateText({
 *     model: google('gemini-2.5-flash'),
 *     system: localizeSystemPrompt(baseSystemPrompt, 'en'),
 *     prompt: userQuery,
 *   })
 */

import { gen } from '@/agents/providers'
import { LOCALE_NAMES, LOCALE_NATIVE_NAMES, type Locale } from '@/lib/i18n/locale'

/**
 * Builds the locale-enforcement instruction block that gets appended to every
 * prompt. Kept short and unambiguous so the model can't "interpret it away".
 */
export function buildLocaleInstruction(locale: Locale): string {
  const name = LOCALE_NAMES[locale]
  const native = LOCALE_NATIVE_NAMES[locale]
  return [
    `CRITICAL LANGUAGE INSTRUCTION — non-negotiable:`,
    `Respond ENTIRELY in ${name} (${native}).`,
    `Every word, heading, bullet, label, JSON field VALUE, and example must be in ${name}.`,
    `Technical keywords, brand names, product codes, and ISO codes stay in their canonical form.`,
    `If the user input is in another language, translate/summarize INTO ${name} — never echo the source language.`,
    `JSON structure keys stay in English; only the VALUES get translated.`,
  ].join(' ')
}

/**
 * Prepend the locale instruction to an existing system prompt. Use this when
 * calling AI SDK primitives (generateText / generateObject / streamText).
 */
export function localizeSystemPrompt(systemPrompt: string, locale: Locale): string {
  return `${buildLocaleInstruction(locale)}\n\n${systemPrompt}`
}

/**
 * Append the locale instruction to a user prompt. Use this for cascade / gen()
 * style calls where there is no explicit system prompt channel.
 */
export function localizeUserPrompt(userPrompt: string, locale: Locale): string {
  return `${userPrompt}\n\n${buildLocaleInstruction(locale)}`
}

export type LocalizedGenOpts = {
  locale: Locale
  maxTokens?: number
}

/**
 * Drop-in replacement for `gen()` that forces locale compliance.
 * Always prefer this over `gen()` in any agent that produces user-visible text.
 */
export async function genLocalized(prompt: string, opts: LocalizedGenOpts): Promise<string> {
  return gen(localizeUserPrompt(prompt, opts.locale), opts.maxTokens)
}
