import crypto from 'node:crypto'

/**
 * Pinned version of the consolidated legal terms (CGU + mentions + privacy).
 *
 * **When to bump** : any edit to `/legal/cgu`, `/legal/mentions`, or `/legal/privacy`
 * must be accompanied by a TERMS_VERSION bump. All existing users will be forced
 * to re-accept at their next login (via /legal/accept gate).
 */
export const TERMS_VERSION = 'ftg-terms-2026-04-19'

/** Deterministic hash of (version + component tags + fingerprint). */
export const TERMS_HASH = crypto
  .createHash('sha256')
  .update(`${TERMS_VERSION}|cgu|mentions|privacy|LicenseRef-Proprietary-Sakaly|66d440006ffee21786ba79e378cd021a`)
  .digest('hex')

export const PRODUCT_TAG = 'ftg'

/**
 * Returns true if the user has a `signed_agreements` row for the current
 * TERMS_VERSION. Safe to call with a service-role client.
 */
export async function hasCurrentTermsAccepted(
  sb: { from: (t: string) => { select: (c: string) => { eq: (k: string, v: unknown) => { eq: (k2: string, v2: unknown) => { eq: (k3: string, v3: unknown) => { eq: (k4: string, v4: unknown) => { limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown }> } } } } } } } },
  userId: string,
): Promise<boolean> {
  try {
    const { data } = await sb
      .from('signed_agreements')
      .select('id')
      .eq('user_id', userId)
      .eq('product', PRODUCT_TAG)
      .eq('plan', 'account_signup')
      .eq('agreement_version', TERMS_VERSION)
      .limit(1)
      .maybeSingle()
    return !!data
  } catch {
    // Fail-open: if the check fails (db error), don't lock the user out.
    return true
  }
}
