/**
 * HIBP Pwned Passwords — k-anonymity check.
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * We send only the first 5 chars of SHA-1(password). The server returns all
 * suffixes matching that prefix + their breach counts. We compare locally.
 */

import crypto from 'node:crypto'

export async function isPwnedPassword(password: string, threshold: number = 1): Promise<{ pwned: boolean; count: number }> {
  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true', 'User-Agent': 'auth-brick-v2' },
    // Short timeout — we don't want to hang login flows
    signal: AbortSignal.timeout(3000),
  }).catch(() => null)

  if (!res || !res.ok) return { pwned: false, count: 0 } // fail-open (logged elsewhere)

  const body = await res.text()
  for (const line of body.split('\n')) {
    const [suf, cntStr] = line.trim().split(':')
    if (suf === suffix) {
      const cnt = Number(cntStr) || 0
      return { pwned: cnt >= threshold, count: cnt }
    }
  }
  return { pwned: false, count: 0 }
}
