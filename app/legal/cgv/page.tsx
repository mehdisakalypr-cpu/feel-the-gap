import Link from 'next/link'

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <Link href="/legal" className="text-sky-400 text-sm hover:underline no-underline">← Retour</Link>

        <h1>Terms of Sale / Conditions Générales de Vente</h1>
        <p className="text-gray-400 text-sm">Last updated: April 2026 · v2 · EN/FR bilingual, English prevails</p>

        <h2>1. Seller</h2>
        <p>
          <strong>OFA Holdings LLC</strong> d/b/a <strong>Feel The Gap</strong>, a limited liability company organised under the laws of Wyoming, USA.<br />
          Registered office: 30 N Gould St, Ste R, Sheridan, WY 82801, USA.<br />
          EIN: application pending · Wyoming File No.: pending · Billing: <strong>billing@feelthegap.world</strong>.
        </p>

        <h2>2. Plans</h2>
        <table className="text-xs">
          <thead><tr><th>Plan</th><th>Monthly</th><th>Annual (10% off)</th><th>Includes</th></tr></thead>
          <tbody>
            <tr><td>Explorer</td><td>0 €</td><td>0 €</td><td>Limited preview, no commercial use</td></tr>
            <tr><td>Data</td><td>29 €</td><td>312.89 €</td><td>Full trade dataset, dashboards, 10k-row exports, watchlists, alerts</td></tr>
            <tr><td>Strategy</td><td>99 €</td><td>1068.89 €</td><td>Data + AI business plan + AI Advisor 200 queries/mo + roadmap</td></tr>
            <tr><td>Premium</td><td>149 €</td><td>1608.89 €</td><td>Strategy + unlimited advisor (fair-use) + prospection credits + API + monthly call</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-400">
          Prices vary by purchasing power parity (PPP) of the Customer&apos;s country. Examples given are the Premium tier.
          VAT/sales tax added where legally required. B2B EU customers with valid VAT ID qualify for reverse-charge under Art. 196
          of Council Directive 2006/112/EC.
        </p>

        <h2>3. Delivery</h2>
        <p>Access to Data, Strategy, and Premium is granted instantly upon payment confirmation. Dashboard credentials are sent within 5 minutes.</p>

        <h2>4. 14-Day Cooling-Off</h2>
        <p>
          EU/UK/Swiss consumers may withdraw within 14 days of first subscription by emailing <strong>billing@feelthegap.world</strong>
          and receive a full refund, provided no material export (CSV/PDF/DOCX) has been performed. See our full
          <Link href="/legal/refund"> Refund Policy</Link>.
        </p>

        <h2>5. Auto-Renewal &amp; Cancellation</h2>
        <p>
          Monthly plans renew monthly; annual plans renew annually. Customer may cancel at any time from the dashboard
          (3 clicks or fewer, AB-2273 / SB-313 compliant) or by email. EU consumers on annual plans receive a renewal
          reminder 1-3 months before the renewal date as required by Article L215-1 of the French Consumer Code.
        </p>

        <h2>6. Credits &amp; Fair-Use</h2>
        <p>
          Strategy and Premium plans include monthly AI credits. Unused credits do not roll over. Additional credit packs are
          available for one-time purchase (non-refundable, valid 12 months). Premium fair-use cap: 2000 advisor queries/month,
          then rate-limited to 20/hour.
        </p>

        <h2>7. Data Accuracy</h2>
        <p>
          The FTG dataset is sourced from public providers (UN Comtrade, governmental customs, EUR-Lex, USDA, etc.) and may
          contain delays, errors, or gaps inherent to those sources. Customer is responsible for verifying critical data before
          making material business or regulatory decisions.
        </p>

        <h2>8. AI-Generated Output Disclaimer</h2>
        <p className="uppercase text-xs">
          Business plans, roadmaps, and advisor responses are AI-generated and may contain errors, hallucinations, or
          outdated information. Customer must review and validate before material use. FTG does not warrant accuracy or
          fitness for any particular regulatory, tax, legal, or funding-application purpose.
        </p>

        <h2>9. API Terms (Premium)</h2>
        <p>
          API access is scoped per account; Customer is responsible for key rotation and secret handling. Rate-limit: 5000
          requests/day burstable at 60 req/min. Redistribution of the raw dataset is prohibited (see <Link href="/legal/aup">AUP</Link>).
        </p>

        <h2>10. Intellectual Property</h2>
        <p>
          Customer owns AI Output generated specifically for their business, subject to third-party rights in underlying
          models/training data. The FTG dataset, platform, code, and templates remain the exclusive property of OFA Holdings LLC
          and are licensed to Customer under a non-exclusive, non-transferable licence for the term of the subscription.
        </p>

        <h2>11. Liability Cap</h2>
        <p className="uppercase text-xs">
          Aggregate liability is capped at fees paid by Customer in the 12 months preceding the claim. No liability for indirect,
          incidental, special, or consequential damages. Nothing limits liability that cannot be limited under mandatory consumer law.
        </p>

        <h2>12. Force Majeure</h2>
        <p>Neither party is liable for events beyond reasonable control (infrastructure outage, government action, natural disaster, etc.).</p>

        <h2>13. Disputes &amp; Governing Law</h2>
        <p>
          Wyoming law governs. US customers agree to binding individual arbitration under AAA Commercial Rules seated in Cheyenne, WY,
          with class-action waiver and a 30-day opt-out to <strong>arb-optout@feelthegap.world</strong>.
          EU/UK/Swiss consumers retain statutory rights and may use the EU ODR platform at
          <a className="text-sky-400" href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer"> ec.europa.eu/consumers/odr</a>.
        </p>

        <h2>14. Changes</h2>
        <p>Material changes notified by email 30 days before effect. Continued use constitutes acceptance.</p>
      </div>
    </div>
  )
}
