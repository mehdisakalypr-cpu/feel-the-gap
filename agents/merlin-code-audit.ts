// @ts-nocheck
/**
 * 🧙 MERLIN — Code Optimizer (Sage Infinity).
 *
 * Scans the 30 longest files in a project, asks LLM to propose simplifications
 * that preserve meaning, function, and philosophy. Does NOT auto-apply —
 * stores proposals in code_optimizations; Shisui reviews before apply.
 *
 * Categories:
 *   - dedup         : identical blocks extracted into helper
 *   - unused_code   : dead branches, unreferenced functions
 *   - verbose       : long switch/if chains → lookup tables
 *   - typing        : duplicate type defs, missing inference
 *   - hooks         : extract logic into reusable hooks
 *   - refactor      : general tightening
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { runCascadeJson } from '@/lib/ai/cascade'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

loadEnv()

type Args = { project: string; rootDir: string; maxFiles: number; minLines: number }
function parseArgs(): Args {
  const out: Args = { project: 'ftg', rootDir: '/var/www/feel-the-gap', maxFiles: 10, minLines: 300 }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'project' && v) out.project = v
    if (k === 'root' && v) out.rootDir = v
    if (k === 'max-files' && v) out.maxFiles = Number(v)
    if (k === 'min-lines' && v) out.minLines = Number(v)
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx'])
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', '.git', 'public', 'out', 'graphify-out', '.vercel', '.supabase'])

function walkForLongFiles(root: string, minLines: number): Array<{ path: string; lines: number }> {
  const out: Array<{ path: string; lines: number }> = []
  function recurse(dir: string) {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const name of entries) {
      if (IGNORE_DIRS.has(name)) continue
      const p = join(dir, name)
      let st
      try { st = statSync(p) } catch { continue }
      if (st.isDirectory()) recurse(p)
      else if (st.isFile() && CODE_EXT.has(extname(name))) {
        try {
          const content = readFileSync(p, 'utf-8')
          const lines = content.split('\n').length
          if (lines >= minLines) out.push({ path: p, lines })
        } catch {}
      }
    }
  }
  recurse(root)
  return out.sort((a, b) => b.lines - a.lines)
}

const PROMPT = (filePath: string, content: string, lines: number) => `Tu es 🧙 **MERLIN** (Seven Deadly Sins), sage infini obsessé par l'élégance minimaliste.

**Ta philosophie** : raccourcir le code SANS altérer sens, fonctionnement, ni lisibilité. Préserver la philosophie. Jamais amputer.

**Fichier** : \`${filePath}\` (${lines} lignes)

\`\`\`
${content.length > 8000 ? content.slice(0, 8000) + '\n\n... [truncated]' : content}
\`\`\`

**Identifie 1-3 optimisations concrètes**. Pour chacune :
1. Catégorie : \`dedup\` | \`unused_code\` | \`verbose\` | \`typing\` | \`hooks\` | \`refactor\`
2. Snippet AVANT (exact, copiable)
3. Snippet APRÈS (préserve l'intent)
4. Rationale : pourquoi c'est safe (quelles invariants restent)
5. Gain en lignes estimé

Règles sacrées :
- JAMAIS supprimer un commentaire explicatif du "pourquoi" (WHY-comment)
- JAMAIS changer un nom public exporté sans prévenir
- JAMAIS fusionner 2 concepts orthogonaux "pour gagner 2 lignes"
- Si le fichier est déjà tight, retourne \`{"optimizations": []}\` honnêtement

Retourne UNIQUEMENT du JSON valide :

{
  "file_analysis": "string - vue d'ensemble du fichier en 2 phrases",
  "optimizations": [
    {
      "category": "dedup|unused_code|verbose|typing|hooks|refactor",
      "rationale": "string - pourquoi safe",
      "before_snippet": "string - code tel quel",
      "after_snippet": "string - code simplifié",
      "savings_lines": number,
      "preserves_philosophy": true
    }
  ]
}`

async function main() {
  const args = parseArgs()
  const sb = db()
  console.log(`🧙 Merlin code audit — project=${args.project} root=${args.rootDir}`)

  const files = walkForLongFiles(args.rootDir, args.minLines).slice(0, args.maxFiles)
  if (!files.length) { console.log('no files above minLines'); return }
  console.log(`scanning ${files.length} long files (${files[0].lines} → ${files[files.length - 1].lines} lines)`)

  let totalOpts = 0
  for (const f of files) {
    const content = readFileSync(f.path, 'utf-8')
    try {
      const result = await runCascadeJson({
        tier: 'premium',
        task: 'merlin-code-audit',
        basePrompt: PROMPT(f.path, content, f.lines),
      })
      const opts = (result as any)?.optimizations ?? []
      if (!opts.length) { console.log(`  ✓ ${f.path.split('/').pop()} already tight`); continue }

      for (const o of opts) {
        const afterLines = (o.after_snippet ?? '').split('\n').length
        const beforeLines = (o.before_snippet ?? '').split('\n').length
        const savingsPct = beforeLines > 0 ? ((beforeLines - afterLines) / beforeLines) * 100 : 0
        await sb.from('code_optimizations').insert({
          file_path: f.path.replace(args.rootDir + '/', ''),
          project: args.project,
          before_lines: beforeLines,
          after_lines: afterLines,
          savings_pct: Math.round(savingsPct * 100) / 100,
          category: o.category,
          rationale: o.rationale,
          before_snippet: o.before_snippet,
          after_snippet: o.after_snippet,
          status: 'proposed',
        })
        totalOpts++
      }
      console.log(`  ✓ ${f.path.split('/').pop()} — ${opts.length} opt proposed`)
    } catch (e) {
      console.warn(`  ✗ ${f.path.split('/').pop()}: ${(e as Error).message.slice(0, 100)}`)
    }
  }

  console.log(`\n→ ${totalOpts} optimizations proposed across ${files.length} files`)
}

main().catch((e) => { console.error(e); process.exit(1) })
