/**
 * GET /api/_authorship
 * Public endpoint that declares the project's authorship.
 * Serves MANIFEST.authorship.json if present, plus runtime-derived fingerprint.
 * Used by monitoring scripts and third-party audits to prove provenance.
 */
import { NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-static'
export const revalidate = 86400

const OWNER_NAME = 'Mehdi Sakaly'
const OWNER_EMAIL = 'mehdi.sakalypr@gmail.com'
const PROJECT = 'feel-the-gap'

function fingerprint(project: string): string {
  return createHash('sha256')
    .update(`${OWNER_EMAIL}|${project}|feel-the-gap|one-for-all|2025-mehdi-sakaly`)
    .digest('hex').slice(0, 32)
}

export function GET() {
  const fp = fingerprint(PROJECT)
  let manifest: unknown = null
  try {
    const manifestPath = join(process.cwd(), 'MANIFEST.authorship.json')
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch { /* manifest optional — only present after inject-watermark --apply */ }

  return NextResponse.json({
    project: PROJECT,
    owner: { name: OWNER_NAME, email: OWNER_EMAIL },
    copyright: `© 2025-${new Date().getFullYear()} ${OWNER_NAME}`,
    license: 'LicenseRef-Proprietary-Sakaly',
    fingerprint: fp,
    manifest_available: manifest !== null,
    manifest: manifest ?? undefined,
    notice: 'Conception, spécifications et direction technique : Mehdi Sakaly. Reproduction non autorisée interdite.',
    verified_at: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Authorship-Fingerprint': fp,
      'X-Authorship-Owner': OWNER_EMAIL,
    },
  })
}
