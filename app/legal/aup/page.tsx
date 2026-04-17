import Link from 'next/link'

export default function AUPPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <Link href="/legal" className="text-sky-400 text-sm hover:underline no-underline">← Retour</Link>

        <h1>Acceptable Use Policy / Politique d&apos;Utilisation Acceptable</h1>
        <p className="text-gray-400 text-sm">Last updated: 2026-04-17 · v2 · EN/FR bilingual, English prevails</p>

        <p>
          This Acceptable Use Policy (&quot;AUP&quot;) governs use of the Feel The Gap platform (&quot;Service&quot;),
          including the web dashboard, APIs, exports, AI Advisor, and generated business plans.
          Violations may result in immediate suspension, feature throttling, dataset export revocation, and account termination
          with no refund. This AUP is part of our <Link href="/legal/cgu">Terms of Use</Link> and should be read alongside
          our <Link href="/legal/cgv">Terms of Sale</Link>.
        </p>

        <h2>1. Prohibited Content / Contenus interdits</h2>
        <p>You may not submit to, generate through, or distribute from the Service any content that:</p>
        <ul>
          <li>Infringes intellectual property, trademark, trade-secret, or publicity rights of any third party</li>
          <li>Is defamatory, harassing, threatening, or promotes violence or hatred on the basis of race, ethnicity, religion, gender, sexual orientation, or disability</li>
          <li>Is sexually explicit, pornographic, or involves minors in any sexualized context</li>
          <li>Promotes or sells regulated goods without the required licensing: firearms, ammunition, explosives, controlled substances, prescription drugs, tobacco, alcohol to minors</li>
          <li>Facilitates fraud, phishing, identity theft, false advertising, or deceptive business practices</li>
          <li>Distributes malware, spyware, ransomware, or security-circumvention tools</li>
          <li>Violates export controls, OFAC or EU restrictive measures, or UN sanctions</li>
        </ul>

        <h2>2. Dataset Use &amp; Scraping Limits</h2>
        <p>
          The FTG trade dataset (UN Comtrade, OEC mirrors, EUR-Lex, USDA, governmental customs and statistics offices, curated
          national-source extracts) is licensed to Customer under the terms of <Link href="/legal/cgv">§7 and §9 of the Terms of Sale</Link>.
          The following are strictly prohibited:
        </p>
        <ul>
          <li>Automated scraping or crawling of the FTG dashboard, advisor, or undocumented endpoints</li>
          <li>Re-distribution, re-sale, re-licensing, or public mirroring of the raw or substantially raw dataset</li>
          <li>Bulk export of more than 100,000 rows per calendar day without the Premium API add-on (redlines enforced)</li>
          <li>Training third-party AI models on FTG Output or the dataset without a separate written licence</li>
          <li>Creating derivative datasets that materially substitute for a FTG subscription and offering them to third parties</li>
          <li>Reverse-engineering our scoring models, business-plan templates, or opportunity-matching pipeline</li>
        </ul>
        <p className="text-xs text-gray-400">
          Fair use for a single internal analyst team, a single published research paper, or embedded insight in the Customer&apos;s
          own service with proper attribution (&quot;Data source: Feel The Gap / UN Comtrade / OEC&quot;) is permitted.
          When in doubt, email <strong>legal@feelthegap.world</strong> before building.
        </p>

        <h2>3. API Fair-Use Caps</h2>
        <ul>
          <li><strong>Data plan</strong> (29 €/mo): 5 API calls/min, 1,000/day, dashboard-only exports capped at 10,000 rows per file</li>
          <li><strong>Strategy plan</strong> (99 €/mo): 15 API calls/min, 5,000/day, 200 advisor queries/mo</li>
          <li><strong>Premium plan</strong> (149 €/mo): 60 API calls/min burstable, 5,000/day, 2,000 advisor queries/mo then rate-limited at 20/hour</li>
          <li>Cumulative datasets pulled via API across a rolling 30-day window may not exceed 2 million rows on Premium</li>
        </ul>
        <p>
          Exceeding the cap for three consecutive days triggers an automatic upgrade proposal; exceeding it for seven days
          allows us to throttle or suspend the API key until a custom contract is signed (contact <strong>billing@feelthegap.world</strong>).
        </p>

        <h2>4. Prohibited Business Models</h2>
        <p>We do not knowingly serve customers whose core business is:</p>
        <ul>
          <li>Multi-level marketing (MLM) or pyramid schemes</li>
          <li>Unregistered securities offerings, ICO/IDO promotion, or unlicensed financial services</li>
          <li>Sanctioned-country trade facilitation (DPRK, Iran, Cuba, Syria, Russia-annexed regions, plus the current EU/OFAC lists)</li>
          <li>Essay mills, fake review services, or academic fraud</li>
          <li>&quot;Get rich quick&quot; schemes, forex signal groups, or binary options</li>
          <li>Weapons manufacturing or resale outside licensed retail channels</li>
        </ul>

        <h2>5. Prohibited Technical Behavior</h2>
        <ul>
          <li>No distributed scraping, proxy-rotation, or credential-sharing to bypass per-account rate limits</li>
          <li>No attempt to access another Customer&apos;s account, data, watchlists, or generated plans</li>
          <li>No embedding of the authenticated dashboard inside third-party iframes without written permission</li>
          <li>No use of the Service to send unsolicited bulk email (spam) from domains connected via our integrations</li>
          <li>No vulnerability testing without prior written consent (see our responsible disclosure at <strong>security@feelthegap.world</strong>)</li>
        </ul>

        <h2>6. Content You Provide</h2>
        <p>
          You warrant that any text, company description, trademark, product image, or other material you submit to the
          Service is either owned by you, licensed to you for such use, or in the public domain. You grant FTG a
          non-exclusive, worldwide, royalty-free licence to store, reproduce, and process such material solely to operate the
          Service and deliver your business plan or Advisor Output.
        </p>

        <h2>7. AI-Generated Content Responsibility</h2>
        <p>
          Business plans, roadmaps, advisor responses, and opportunity scorings are generated by artificial intelligence.
          Before material use (fundraising, regulatory filings, published marketing), you must review all generated text and
          numbers for accuracy and regulatory fitness. FTG is not liable for factual errors, misattributions, hallucinated
          citations, or outdated tariff/HS-code references that you choose to rely on. See
          <Link href="/legal/cgv"> Terms of Sale §8</Link> for the full AI disclaimer.
        </p>

        <h2>8. Reporting Violations / Signaler un abus</h2>
        <p>
          To report abuse of this AUP, email <strong>abuse@feelthegap.world</strong> with: the account or export identifier,
          a description of the violation, and your contact details. We acknowledge within 48 hours and may suspend the
          account pending investigation. Urgent security issues: <strong>security@feelthegap.world</strong> (PGP key on request).
        </p>

        <h2>9. Enforcement</h2>
        <p>
          Violations may result in: content removal, account suspension, export revocation, API key rotation, chargeback holds,
          pro-rata non-refund of the current billing period, and forwarding to law enforcement where required by law.
          Repeated or willful violations forfeit any refund eligibility under the <Link href="/legal/refund">Refund Policy</Link>.
        </p>

        <h2>10. Changes</h2>
        <p>
          We may update this AUP to reflect new regulations, threat intelligence, or abuse patterns. Material changes are
          notified by email 30 days before taking effect. Continued use of the Service after notification constitutes acceptance.
        </p>
      </div>
    </div>
  )
}
