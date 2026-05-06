// @ts-nocheck
/**
 * Pg-direct pool — bypass PostgREST pour les hot paths du content-orchestrator.
 * Fallback gracieux : si DATABASE_URL absent ou erreur de connexion, le caller
 * doit retomber sur supabase-js (PostgREST).
 *
 * Pourquoi : PostgREST a planté 28/04 (schema cache cassé pendant ~30min).
 * Le claim_next_content_job RPC + writes orchestrator passaient par lui →
 * tout le pipeline content-gen bloqué. En passant par pg + PgBouncer 6543, on
 * survit à toute panne de PostgREST/Auth/Storage tant que Postgres tient.
 */
import { Pool, PoolClient } from 'pg'

let pool: Pool | null = null

export function getPgPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // PgBouncer transaction mode : pas de prepared statements
      statement_timeout: 30_000,
    })
    pool.on('error', err => console.error('[pg-pool] idle client error:', err.message))
  }
  return pool
}

/**
 * Claim le prochain job pending — équivalent du RPC claim_next_content_job.
 * Retourne null si la queue est vide.
 */
export async function pgClaimNextContentJob(): Promise<any | null> {
  const p = getPgPool()
  if (!p) throw new Error('DATABASE_URL not set')
  const { rows } = await p.query(`
    UPDATE ftg_content_jobs
       SET status     = 'running',
           started_at = now(),
           attempts   = attempts + 1
     WHERE id = (
       SELECT id FROM ftg_content_jobs
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING *
  `)
  return rows[0] || null
}

/**
 * Update partiel d'un job — accepte les colonnes status, finished_at,
 * last_error, cost_eur, started_at.
 */
export async function pgUpdateJob(
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const p = getPgPool()
  if (!p) throw new Error('DATABASE_URL not set')
  const allowed = ['status', 'finished_at', 'last_error', 'cost_eur', 'started_at']
  const keys = Object.keys(updates).filter(k => allowed.includes(k))
  if (!keys.length) return
  const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ')
  const values = keys.map(k => updates[k])
  await p.query(`UPDATE ftg_content_jobs SET ${setClause} WHERE id = $1`, [id, ...values])
}

/**
 * Health check rapide — utilisé par l'orchestrator au boot pour décider
 * pg-direct vs PostgREST. Retourne true si la pool est utilisable.
 */
export async function pgHealthy(): Promise<boolean> {
  const p = getPgPool()
  if (!p) return false
  try {
    const r = await Promise.race([
      p.query('SELECT 1 as ok'),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('pg health timeout')), 4000)),
    ])
    return !!r
  } catch (e: any) {
    console.warn('[pg-pool] unhealthy:', e?.message)
    return false
  }
}

export async function pgClose(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
