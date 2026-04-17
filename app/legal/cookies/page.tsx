import Link from 'next/link'

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <Link href="/legal" className="text-sky-400 text-sm hover:underline no-underline">← Retour</Link>

        <h1>Cookie Policy / Politique Cookies</h1>
        <p className="text-gray-400 text-sm">Last updated: 2026-04-17 · v2 · EN/FR bilingual, English prevails</p>

        <p>
          This Cookie Policy explains how Feel The Gap (&quot;FTG&quot;, operated by OFA Holdings LLC) uses cookies and
          similar technologies on the marketing site, the authenticated dashboard, and in emails. It complements
          our <Link href="/legal/privacy">Privacy Policy</Link>.
        </p>

        <h2>1. What is a cookie? / Qu&apos;est-ce qu&apos;un cookie ?</h2>
        <p>
          A cookie is a small text file stored on your device by your browser. Similar technologies include local storage,
          session storage, tracking pixels, and device fingerprints. We refer to all of them as &quot;cookies&quot; below.
        </p>

        <h2>2. Consent (CNIL — Délibération 2020-092)</h2>
        <p>
          On first visit from the European Economic Area, the United Kingdom, or Switzerland we display a consent banner with
          three buttons of equal visual prominence: <strong>Accept all</strong>, <strong>Reject all</strong>, and <strong>Customise</strong>.
          No non-essential cookie fires before you choose. Your choice is stored for six months; we re-prompt at expiry
          or whenever the list of partners changes, whichever comes first.
        </p>

        <h2>3. Categories / Catégories</h2>

        <h3>3.1 Essential cookies (no consent required)</h3>
        <ul>
          <li><code>ftg_session</code> — authentication token, 30 days, HttpOnly, Secure, SameSite=Lax</li>
          <li><code>ftg_csrf</code> — cross-site request forgery token, session-only</li>
          <li><code>ftg_consent</code> — stores your cookie choice, 6 months</li>
          <li><code>ftg_locale</code> — language preference (EN/FR), 12 months</li>
          <li><code>vercel-*</code> — hosting infrastructure cookies (set by Vercel, essential for routing and edge caching)</li>
          <li><code>sb-*</code> — Supabase authentication and realtime channel (essential for dashboard login)</li>
        </ul>

        <h3>3.2 Analytics cookies (consent required)</h3>
        <ul>
          <li>Plausible Analytics (privacy-first, cookie-less by default, IP anonymised) — used on marketing pages</li>
          <li>Server-side event counters for product usage (login, export, advisor queries) — aggregated, no individual tracking</li>
          <li>No Google Analytics, no Meta Pixel, no TikTok Pixel, no advertising SDKs are set without explicit opt-in</li>
        </ul>

        <h3>3.3 Functional cookies (consent required)</h3>
        <ul>
          <li>Embedded video providers on help pages (YouTube no-cookie domain when possible)</li>
          <li>In-app survey widget for feedback collection (Customer.io) — only after consent</li>
        </ul>

        <h2>4. Do Not Track &amp; Global Privacy Control</h2>
        <p>
          We honour browser-level Global Privacy Control (GPC) signals and legacy Do Not Track headers for all non-essential
          cookies. If GPC is detected at first visit, the banner still appears but &quot;Reject all&quot; is pre-selected
          and a one-click confirmation applies your preference. For California residents, GPC is treated as a valid
          CCPA opt-out of sale/share signal.
        </p>

        <h2>5. How to change your choice / Modifier votre choix</h2>
        <p>
          You can revisit your cookie preferences at any time via the <strong>&quot;Manage cookies&quot;</strong> link in the
          website footer. You can also delete cookies from your browser settings; note that disabling essential cookies will
          break login and dashboard access.
        </p>

        <h2>6. Third-party integrations outside FTG</h2>
        <p>
          When you download a business plan as PDF or use Stripe Checkout, you may interact with third parties
          (Stripe, DocuSign, your own mail client). Cookies set by those services are governed by their own policies;
          we provide direct links and a short notice at the point of redirect.
        </p>

        <h2>7. Contact</h2>
        <p>
          Questions about cookies: <strong>privacy@feelthegap.world</strong>.
          For a machine-readable list of cookies (JSON), request it from the same address.
        </p>
      </div>
    </div>
  )
}
