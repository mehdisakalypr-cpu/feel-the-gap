/**
 * loadEnv — parse .env.local dans process.cwd() et peuple process.env
 * (sans écraser ce qui y est déjà). Utilisé par les scouts standalone
 * (local-buyers, exporters, investors, entrepreneurs) lancés via tsx.
 * Pattern copié de agents/master-orchestrator.ts pour homogénéité.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

export function loadEnv(file = '.env.local'): void {
  const p = path.join(process.cwd(), file)
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const key = t.slice(0, i).trim()
    if (process.env[key]) continue
    process.env[key] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
