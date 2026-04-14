import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <Link href="/legal" className="text-sky-400 text-sm hover:underline no-underline">← Retour</Link>

        <h1>Privacy Policy / Politique de Confidentialité</h1>
        <p className="text-gray-400 text-sm">Last updated: April 2026 · v2</p>

        <h2>1. Data Controller</h2>
        <p>
          <strong>OFA Holdings LLC</strong> d/b/a <strong>Feel The Gap</strong>, 30 N Gould St, Ste R, Sheridan, WY 82801, USA.
          Data protection contact: <strong>privacy@feelthegap.world</strong>.
          EU Representative (Art. 27 GDPR): to be appointed prior to first EU marketing campaign.
        </p>

        <h2>2. Data Collected</h2>
        <ul>
          <li><strong>Account</strong>: email, name, business name, country, password hash</li>
          <li><strong>Payment</strong>: tokenised by Stripe (no full card numbers stored)</li>
          <li><strong>Usage</strong>: watchlists, saved searches, advisor queries, exports, login timestamps</li>
          <li><strong>Generated Content</strong>: business plans, roadmaps, prospection briefs</li>
        </ul>

        <h2>3. Legal Bases (GDPR Art. 6)</h2>
        <ul>
          <li>Contract performance (subscription delivery)</li>
          <li>Legitimate interest (security, abuse prevention)</li>
          <li>Consent (analytics cookies, marketing emails)</li>
          <li>Legal obligation (tax, AML, accounting)</li>
        </ul>

        <h2>4. AI Providers &mdash; No Training on Your Data</h2>
        <p>
          Prompts submitted to AI features are processed by providers listed at <Link href="/legal/subprocessors">/legal/subprocessors</Link>.
          We contractually disable training-on-inputs with every provider that supports it (OpenAI, Groq, Anthropic, HuggingFace).
          Customer prompts and Output are not used to retrain public models.
        </p>

        <h2>5. Subprocessors</h2>
        <p>
          See <Link href="/legal/subprocessors">subprocessor list</Link>. New subprocessors announced 30 days in advance for B2B DPA customers.
        </p>

        <h2>6. International Transfers</h2>
        <p>
          Transfers outside the EEA use EU Standard Contractual Clauses (2021/914) + supplementary measures
          (TLS 1.2+ in transit, AES-256 at rest, pseudonymisation). UK IDTA for UK data, FDPIC-approved addendum for Swiss data.
        </p>

        <h2>7. Retention</h2>
        <table className="text-xs">
          <thead><tr><th>Data</th><th>Retention</th></tr></thead>
          <tbody>
            <tr><td>Active account</td><td>Term of service</td></tr>
            <tr><td>Deleted account</td><td>90 days</td></tr>
            <tr><td>Billing records</td><td>10 years (FR Code de commerce L123-22)</td></tr>
            <tr><td>Security logs</td><td>12 months</td></tr>
            <tr><td>AI output logs (for abuse detection)</td><td>6 months, then anonymised</td></tr>
          </tbody>
        </table>

        <h2>8. Your Rights</h2>
        <p>
          Access, rectification, deletion, portability, objection, restriction (GDPR/UK GDPR/FADP),
          right to know / delete / correct / opt out of sale-or-share (CCPA/CPRA — we do not sell or share),
          equivalent rights under LGPD, POPIA, NDPR, DPDP, PIPEDA, Australia Privacy Act. 30-day SLA.
          Contact <strong>privacy@feelthegap.world</strong> or the in-app &quot;Export / delete my data&quot; button.
        </p>

        <h2>9. Cookies</h2>
        <p>See <Link href="/legal/cookies">Cookie Policy</Link>. CNIL-compliant consent with Accept/Reject/Customise of equal prominence.</p>

        <h2>10. Security</h2>
        <p>
          TLS 1.2+, AES-256 at rest, SSO + MFA for production access, quarterly access review, annual third-party pentest,
          daily encrypted backups, RTO 4h / RPO 24h.
        </p>

        <h2>11. Breach Notification</h2>
        <p>
          Competent supervisory authority notified within 72 hours (GDPR Art. 33). B2B DPA customers notified within 48 hours of discovery.
        </p>

        <h2>12. EU AI Act Transparency</h2>
        <p>
          Per Regulation 2024/1689 Art. 50, AI-generated outputs disclose their AI origin in visible footer + metadata.
        </p>

        <h2>13. Children</h2>
        <p>Service not directed to users under 16. We do not knowingly collect data from children.</p>

        <h2>14. Changes</h2>
        <p>Material changes notified 30 days in advance by email.</p>

        <h2>15. Contact</h2>
        <p>privacy@feelthegap.world · dmca@feelthegap.world · legal@feelthegap.world</p>
      </div>
    </div>
  )
}
