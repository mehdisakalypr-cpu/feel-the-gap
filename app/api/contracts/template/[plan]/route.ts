/**
 * GET /api/contracts/template/[plan]?embed=1
 * Returns the rendered HTML for the FTG agreement of the given plan.
 *
 * Used by <ContractGate /> which embeds the template in an iframe and
 * posts {type:'scrolled-to-bottom'} back to the parent when the user
 * reaches the bottom.
 *
 * Source of truth: /root/llc-setup/subscriptions/ftg/*.md (markdown files
 * shipped in the FTG app bundle at build time for security — we do not
 * allow runtime path traversal).
 */
import { NextRequest, NextResponse } from 'next/server'
import { ftgAgreementFor, type FtgPlanKey } from '@/lib/contracts-ftg'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Minimal markdown-to-HTML renderer (no external dep). Handles headings,
// bold, lists, tables, paragraphs. Good enough for a 60-line contract.
function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inList = false
  let inTable = false
  let tableHeader = false

  const flushList = () => { if (inList) { out.push('</ul>'); inList = false } }
  const flushTable = () => { if (inTable) { out.push('</tbody></table>'); inTable = false; tableHeader = false } }

  const inline = (s: string) =>
    s
      .replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^# /.test(line))      { flushList(); flushTable(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue }
    if (/^## /.test(line))     { flushList(); flushTable(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue }
    if (/^### /.test(line))    { flushList(); flushTable(); out.push(`<h3>${inline(line.slice(4))}</h3>`); continue }
    if (/^-\s+/.test(line))    { flushTable(); if (!inList) { out.push('<ul>'); inList = true } out.push(`<li>${inline(line.replace(/^-\s+/, ''))}</li>`); continue }
    if (/^\|/.test(line)) {
      flushList()
      if (!inTable) { out.push('<table><thead>'); inTable = true; tableHeader = true }
      if (/^\|[-| :]+\|\s*$/.test(line)) { out.push('</thead><tbody>'); tableHeader = false; continue }
      const cells = line.split('|').slice(1, -1).map(c => inline(c.trim()))
      const tag = tableHeader ? 'th' : 'td'
      out.push(`<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`)
      continue
    }
    if (/^---+$/.test(line))   { flushList(); flushTable(); out.push('<hr/>'); continue }
    if (line === '')           { flushList(); flushTable(); continue }
    flushList(); flushTable()
    out.push(`<p>${inline(line)}</p>`)
  }
  flushList(); flushTable()
  return out.join('\n')
}

const ACCOUNT_SIGNUP_TEMPLATE = `# Feel The Gap — Account Terms Summary

**Version 2026-04-17.v1**

---

## 1. Free account scope

A free Feel The Gap account gives read-only access to the global map, country fact sheets, and demo business-plan previews. No paid features are unlocked without an active subscription.

## 2. Your data

- We process your email, username, and session data per the [Privacy Policy](https://feelthegap.world/legal/privacy).
- We never sell or share your personal data.
- You can export or delete your account at any time from the dashboard.

## 3. Acceptable use

- No scraping, reverse engineering, or bulk export of the dataset.
- One account per person.
- No impersonation.

## 4. Termination

Either party may terminate the free account at any time. Deletion is effective within 30 days.

## 5. Governing law

Wyoming (USA) law. EU/UK/Swiss consumers retain statutory rights.

---

By signing below you acknowledge you have read and accept the [Terms of Use](https://feelthegap.world/legal/cgu), [Privacy Policy](https://feelthegap.world/legal/privacy) and [AUP](https://feelthegap.world/legal/aup).
`

async function loadTemplate(sourceFile: string): Promise<string> {
  if (sourceFile === 'account-signup.md') return ACCOUNT_SIGNUP_TEMPLATE
  // Resolve relative to project root (FTG app lives at /var/www/feel-the-gap).
  // In production (Vercel) we fall back to the inline shipped copy if FS access fails.
  const root = process.cwd()
  const candidates = [
    path.join(root, 'content', 'subscriptions', sourceFile),
    path.join(root, '..', '..', 'llc-setup', 'subscriptions', 'ftg', sourceFile),
    path.join('/root', 'llc-setup', 'subscriptions', 'ftg', sourceFile),
  ]
  for (const p of candidates) {
    try { return await readFile(p, 'utf8') } catch { /* try next */ }
  }
  // Fallback stub so the gate never fully breaks.
  return `# ${sourceFile}\n\nDocument temporairement indisponible. Contactez legal@feelthegap.world.`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ plan: string }> },
) {
  const { plan } = await params
  const agreement = ftgAgreementFor(plan)
  const md = await loadTemplate(agreement.sourceFile)
  const htmlBody = mdToHtml(md)
  const embed = req.nextUrl.searchParams.get('embed') === '1'

  if (embed) {
    const page = `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${agreement.titleFr}</title>
<style>
  :root { color-scheme: dark; }
  html,body { margin:0; padding:0; background:#07090F; color:#E5E7EB; font-family:system-ui,-apple-system,sans-serif; }
  body { padding:20px 24px 48px; line-height:1.55; font-size:14px; }
  h1 { font-size:18px; margin:0 0 8px; color:#C9A84C; }
  h2 { font-size:15px; margin:20px 0 6px; color:#E5E7EB; }
  h3 { font-size:13px; margin:14px 0 4px; color:#C9A84C; }
  p { margin:6px 0; color:#CBD5E1; }
  ul { padding-left:20px; margin:6px 0; }
  li { margin:2px 0; color:#CBD5E1; }
  table { border-collapse:collapse; margin:10px 0; width:100%; font-size:12px; }
  th,td { border:1px solid rgba(201,168,76,0.25); padding:6px 10px; text-align:left; }
  th { background:rgba(201,168,76,0.08); color:#E5E7EB; }
  hr { border:none; border-top:1px solid rgba(201,168,76,0.15); margin:14px 0; }
  a { color:#C9A84C; }
  code { background:#111827; padding:1px 4px; border-radius:3px; font-size:12px; }
  strong { color:#fff; }
</style></head>
<body data-plan="${agreement.plan}" data-version="${agreement.version}">
${htmlBody}
<div id="_cg_sentinel" style="height:1px"></div>
<script>
  (function(){
    var sentinel = document.getElementById('_cg_sentinel');
    var sent = false;
    function check(){
      if (sent) return;
      var rect = sentinel.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 20) {
        sent = true;
        try { parent.postMessage({ type:'scrolled-to-bottom', plan: '${agreement.plan}' }, '*'); } catch(e){}
      }
    }
    window.addEventListener('scroll', check, { passive:true });
    window.addEventListener('resize', check);
    setTimeout(check, 200);
  })();
</script>
</body></html>`
    return new NextResponse(page, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json({
    plan: agreement.plan,
    version: agreement.version,
    titleFr: agreement.titleFr,
    titleEn: agreement.titleEn,
    html: htmlBody,
    markdown: md,
  })
}
