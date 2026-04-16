/**
 * HIBP k-anonymity password check (https://haveibeenpwned.com/API/v3#PwnedPasswords).
 * SHA-1 of the password is computed locally, only the first 5 hex chars ("prefix")
 * are sent to api.pwnedpasswords.com. Response lists all suffixes + their breach
 * counts — we check if the remaining 35 chars appear. The plaintext password
 * never leaves the client/server.
 *
 * Works in both browser and Node (uses Web Crypto API / globalThis.crypto.subtle).
 */

export interface HibpResult {
  pwned: boolean
  count: number
  /** true if the HIBP API could not be reached (network error, rate limit). */
  skipped?: boolean
}

async function sha1Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const buf = await globalThis.crypto.subtle.digest('SHA-1', enc)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export async function checkPassword(password: string): Promise<HibpResult> {
  if (!password || password.length < 1) return { pwned: false, count: 0 }
  let hash: string
  try {
    hash = await sha1Hex(password)
  } catch {
    return { pwned: false, count: 0, skipped: true }
  }
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
    })
    if (!res.ok) return { pwned: false, count: 0, skipped: true }
    const text = await res.text()
    for (const line of text.split('\n')) {
      const [suff, countStr] = line.trim().split(':')
      if (suff === suffix) {
        const count = parseInt(countStr ?? '0', 10)
        return { pwned: count > 0, count }
      }
    }
    return { pwned: false, count: 0 }
  } catch {
    return { pwned: false, count: 0, skipped: true }
  }
}
