import Link from 'next/link'

export const metadata = {
  title: 'Webhooks — Docs API Feel The Gap',
  description: "Vérifier la signature HMAC-SHA256 des webhooks Feel The Gap (Node.js, Python, PHP, Go).",
}

const C = {
  bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)',
  accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8',
}

type Snippet = { lang: string; title: string; code: string }

const SNIPPETS: Snippet[] = [
  {
    lang: 'node',
    title: 'Node.js (Express)',
    code: `import express from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'

const app = express()
app.use(express.json({
  verify: (req, _res, buf) => { (req as any).rawBody = buf.toString('utf8') },
}))

function verifySignature(body: string, secret: string, ts: string, sig: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret)
    .update(\`\${ts}.\${body}\`)
    .digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(sig)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

app.post('/webhooks/ftg', (req, res) => {
  const secret = process.env.FTG_WEBHOOK_SECRET!
  const ts = req.header('X-Ftg-Timestamp') ?? ''
  const sig = req.header('X-Ftg-Signature') ?? ''
  const raw = (req as any).rawBody

  if (!verifySignature(raw, secret, ts, sig)) {
    return res.status(401).send('invalid signature')
  }
  // Replay protection : timestamp ≤ 5 min
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    return res.status(401).send('timestamp too old')
  }

  const { event, data } = req.body
  console.log(\`[ftg-webhook] \${event}\`, data)
  res.status(200).send('ok')
})

app.listen(3000)`,
  },
  {
    lang: 'python',
    title: 'Python (Flask)',
    code: `import hmac, hashlib, os, time
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["FTG_WEBHOOK_SECRET"]

def verify_signature(body: bytes, ts: str, sig: str) -> bool:
    expected = "sha256=" + hmac.new(
        SECRET.encode(),
        f"{ts}.{body.decode()}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, sig)

@app.post("/webhooks/ftg")
def ftg_webhook():
    ts = request.headers.get("X-Ftg-Timestamp", "")
    sig = request.headers.get("X-Ftg-Signature", "")
    raw = request.get_data()

    if not verify_signature(raw, ts, sig):
        abort(401, "invalid signature")
    if abs(time.time() - float(ts)) > 300:
        abort(401, "timestamp too old")

    payload = request.get_json()
    print(f"[ftg-webhook] {payload['event']}", payload["data"])
    return "ok", 200

if __name__ == "__main__":
    app.run(port=3000)`,
  },
  {
    lang: 'php',
    title: 'PHP',
    code: `<?php
// /webhooks/ftg.php
$secret = getenv('FTG_WEBHOOK_SECRET');
$raw = file_get_contents('php://input');
$ts = $_SERVER['HTTP_X_FTG_TIMESTAMP'] ?? '';
$sig = $_SERVER['HTTP_X_FTG_SIGNATURE'] ?? '';

$expected = 'sha256=' . hash_hmac('sha256', "$ts.$raw", $secret);
if (!hash_equals($expected, $sig)) {
  http_response_code(401);
  exit('invalid signature');
}
if (abs(time() - (int)$ts) > 300) {
  http_response_code(401);
  exit('timestamp too old');
}

$payload = json_decode($raw, true);
error_log("[ftg-webhook] {$payload['event']}");
http_response_code(200);
echo 'ok';`,
  },
  {
    lang: 'go',
    title: 'Go (net/http)',
    code: `package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "io"
    "net/http"
    "os"
    "strconv"
    "time"
)

var secret = []byte(os.Getenv("FTG_WEBHOOK_SECRET"))

func verifySignature(body []byte, ts, sig string) bool {
    mac := hmac.New(sha256.New, secret)
    mac.Write([]byte(ts + "." + string(body)))
    expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(sig))
}

func handler(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    ts := r.Header.Get("X-Ftg-Timestamp")
    sig := r.Header.Get("X-Ftg-Signature")

    if !verifySignature(body, ts, sig) {
        http.Error(w, "invalid signature", 401)
        return
    }
    tsNum, _ := strconv.ParseInt(ts, 10, 64)
    if abs(time.Now().Unix()-tsNum) > 300 {
        http.Error(w, "timestamp too old", 401)
        return
    }
    w.WriteHeader(200)
    w.Write([]byte("ok"))
}

func abs(n int64) int64 { if n < 0 { return -n }; return n }

func main() {
    http.HandleFunc("/webhooks/ftg", handler)
    http.ListenAndServe(":3000", nil)
}`,
  },
]

export default function WebhooksDocsPage() {
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.2em', textTransform: 'uppercase' }}>Docs API · Webhooks</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 0' }}>Vérifier la signature</h1>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
            <Link href="/docs/api" style={{ color: C.accent, textDecoration: 'none' }}>← Docs API</Link>
            <Link href="/account/api-webhooks" style={{ color: C.accent, textDecoration: 'none' }}>Mes webhooks →</Link>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>Format du payload</h2>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>
            Chaque livraison est un POST JSON. 3 headers à vérifier :
          </p>
          <ul style={{ fontSize: 14, lineHeight: 1.9, color: C.text }}>
            <li><code>X-Ftg-Event</code> : <code>opportunity.created</code>, <code>opportunity.updated</code>, <code>country.stats_refreshed</code></li>
            <li><code>X-Ftg-Timestamp</code> : unix seconds — rejette si &gt; 5 min de dérive (replay protection)</li>
            <li><code>X-Ftg-Signature</code> : <code>sha256=&lt;hex&gt;</code> où <code>hex = hmac_sha256(secret, timestamp + "." + body)</code></li>
          </ul>
          <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, fontSize: 12, overflow: 'auto' }}>{`{
  "event": "opportunity.created",
  "data": {
    "id": "f47f58ff-...",
    "country_iso": "CIV",
    "product_id": "0802_cacao",
    "opportunity_score": 85,
    "gap_value_usd": 1200000000
  },
  "delivered_at": "2026-04-18T21:30:00.123Z"
}`}</pre>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          {SNIPPETS.map(s => (
            <div key={s.lang} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>{s.title}</div>
              <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, fontSize: 12, overflow: 'auto', margin: 0, fontFamily: 'Menlo, monospace', lineHeight: 1.6 }}>
                {s.code}
              </pre>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Retry & failover</h2>
          <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
            Nous réessayons une fois immédiatement en cas d'échec (statut non-2xx ou timeout 10s). Après 10 échecs consécutifs, le webhook est désactivé automatiquement — tu peux le réactiver dans <Link href="/account/api-webhooks" style={{ color: C.accent }}>tes webhooks</Link>.
          </p>
          <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
            Le cron de dispatch tourne quotidiennement (Vercel Hobby). Pour un dispatch temps réel (&lt; 60s), contacte <a href="mailto:api@feel-the-gap.com" style={{ color: C.accent }}>api@feel-the-gap.com</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
