/**
 * CallMeBot WhatsApp helper — fail-silent.
 * API : https://api.callmebot.com/whatsapp.php?phone=X&text=Y&apikey=Z
 * Limitations : le destinataire doit avoir préalablement activé le bot en
 * envoyant « I allow callmebot to send me messages » depuis son numéro vers
 * +34 644 21 82 61. En cold outreach, c'est donc un canal opt-in-like et ne
 * remplace pas un vrai compte WhatsApp Business.
 *
 * CALLMEBOT_API_KEY optionnelle : clé globale partagée (destinataire doit avoir
 * activé CE compte). En env pré-prod, absent → helper log + return false.
 */

export type WhatsAppSendResult = { ok: boolean; status: number; detail?: string }

function normalizePhone(phone: string): string {
  // Strip spaces/dashes/parens. Garde le + initial.
  return phone.replace(/[\s\-().]/g, '')
}

export async function sendWhatsAppCallMeBot(args: {
  phone: string
  text: string
  apiKey?: string
}): Promise<WhatsAppSendResult> {
  const apiKey = args.apiKey ?? process.env.CALLMEBOT_API_KEY
  if (!apiKey) {
    console.log('[whatsapp/callmebot] CALLMEBOT_API_KEY absent — skip')
    return { ok: false, status: 0, detail: 'missing_api_key' }
  }
  const phone = normalizePhone(args.phone)
  if (!phone || phone.length < 6) {
    return { ok: false, status: 0, detail: 'invalid_phone' }
  }
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(args.text)}&apikey=${encodeURIComponent(apiKey)}`
  try {
    const res = await fetch(url, { method: 'GET' })
    const txt = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, detail: txt.slice(0, 200) }
  } catch (err) {
    return { ok: false, status: 0, detail: err instanceof Error ? err.message : 'fetch_error' }
  }
}
