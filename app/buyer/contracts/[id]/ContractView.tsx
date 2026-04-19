'use client'

/**
 * Renders a server-generated Incoterms contract HTML inside a sandboxed iframe.
 * Content originates from lib/incoterms/contract.ts (trusted backend-rendered HTML),
 * but we still isolate via iframe srcDoc with sandbox="" (no script, no same-origin).
 */
export default function ContractView({ html }: { html: string }) {
  return (
    <iframe
      sandbox=""
      srcDoc={wrap(html)}
      style={{
        width: '100%',
        minHeight: 520,
        border: '1px solid rgba(96,165,250,.2)',
        borderRadius: 12,
        background: '#FFFFFF',
      }}
      title="Contrat Incoterms"
    />
  )
}

function wrap(inner: string): string {
  const safe = inner.includes('<html') ? inner : `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  body { margin: 0; padding: 28px; font-family: Georgia, 'Times New Roman', serif; color: #0F172A; line-height: 1.6; font-size: 14px; }
  h1, h2, h3 { font-family: system-ui, sans-serif; color: #0F172A; }
  h1 { font-size: 22px; margin-top: 0; }
  h2 { font-size: 17px; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #E2E8F0; padding: 8px 10px; text-align: left; font-size: 13px; }
  th { background: #F1F5F9; }
  ul, ol { padding-left: 22px; }
  code { background: #F1F5F9; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
</style></head><body>${inner}</body></html>`
  return safe
}
