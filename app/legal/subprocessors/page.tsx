import Link from 'next/link'

export default function SubprocessorsPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <Link href="/legal" className="text-sky-400 text-sm hover:underline no-underline">← Retour</Link>

        <h1>Subprocessors / Sous-traitants</h1>
        <p className="text-gray-400 text-sm">Last updated: 2026-04-17 · v2 · EN/FR bilingual, English prevails</p>

        <p>
          The following sub-processors process personal or Customer-provided data on behalf of Feel The Gap (OFA Holdings LLC)
          to deliver the Service. New sub-processors are announced on this page at least 30 days before they begin processing;
          B2B Customers with an active <Link href="/legal/dpa">Data Processing Agreement</Link> may object in writing within
          that window to <strong>privacy@feelthegap.world</strong>.
        </p>

        <h2>Infrastructure &amp; Platform</h2>
        <table className="text-xs">
          <thead>
            <tr>
              <th>Subprocessor</th>
              <th>Purpose</th>
              <th>Data categories</th>
              <th>Location</th>
              <th>Transfer safeguards</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Supabase</td><td>Primary database, authentication, file storage</td><td>account, content, logs</td><td>EU (Frankfurt)</td><td>intra-EEA</td></tr>
            <tr><td>Vercel</td><td>Frontend hosting, edge network, serverless functions</td><td>request logs, cached responses</td><td>Global (US-primary)</td><td>SCCs 2021/914 Module 3</td></tr>
            <tr><td>Cloudflare</td><td>DNS, WAF, rate-limiting, R2 cold storage</td><td>traffic metadata, cached assets</td><td>Global</td><td>SCCs 2021/914</td></tr>
            <tr><td>Stripe</td><td>Payment processing, invoicing, tax</td><td>billing data, card tokens (no PANs)</td><td>US / IE</td><td>SCCs + Stripe DPA</td></tr>
            <tr><td>Resend</td><td>Transactional email delivery</td><td>recipient email, subject, body</td><td>US / EU</td><td>SCCs 2021/914</td></tr>
          </tbody>
        </table>

        <h2>AI Providers</h2>
        <table className="text-xs">
          <thead>
            <tr>
              <th>Subprocessor</th>
              <th>Purpose</th>
              <th>Data categories</th>
              <th>Location</th>
              <th>Transfer safeguards</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>OpenAI</td><td>AI text generation (advisor, plans)</td><td>business prompts (no personal data required)</td><td>US</td><td>SCCs + zero-retention &amp; zero-training API flags</td></tr>
            <tr><td>Anthropic</td><td>AI text generation (advisor fallback, reasoning)</td><td>business prompts</td><td>US</td><td>SCCs + zero-training</td></tr>
            <tr><td>Groq</td><td>Low-latency inference for advisor</td><td>business prompts</td><td>US</td><td>SCCs + zero-retention</td></tr>
            <tr><td>Mistral</td><td>EU-hosted inference fallback</td><td>business prompts</td><td>EU (Paris)</td><td>intra-EEA</td></tr>
            <tr><td>Google AI (Gemini)</td><td>Advisor cascade fallback</td><td>business prompts</td><td>US / EU</td><td>SCCs + Google Cloud DPA</td></tr>
            <tr><td>HuggingFace</td><td>Embeddings for opportunity matching</td><td>business prompts, document chunks</td><td>US / FR</td><td>intra-EEA for FR endpoints; SCCs for US</td></tr>
          </tbody>
        </table>

        <h2>Data Sources (Public-Data Sub-providers)</h2>
        <p>
          The following entities supply the public trade datasets surfaced in Feel The Gap. We do not transmit Controller
          Personal Data to them, but we list them here for full transparency of the data supply chain.
        </p>
        <table className="text-xs">
          <thead>
            <tr>
              <th>Source</th>
              <th>Data</th>
              <th>Licence / basis</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>UN Comtrade</td><td>Bilateral trade flows (HS codes, values, volumes)</td><td>UN open-data terms, attributed</td><td>Global</td></tr>
            <tr><td>OEC (Observatory of Economic Complexity)</td><td>Curated exports/imports, complexity indices</td><td>CC BY-SA, attributed</td><td>US / MIT</td></tr>
            <tr><td>EUR-Lex</td><td>EU regulations, tariffs, customs notices</td><td>EU PSI open-data directive</td><td>EU (Luxembourg)</td></tr>
            <tr><td>USDA FAS</td><td>Agricultural trade data (GATS, PSD)</td><td>US federal open data</td><td>US</td></tr>
            <tr><td>ITC Trade Map</td><td>Additional bilateral flows (open endpoints)</td><td>ITC terms, attributed</td><td>CH (Geneva)</td></tr>
            <tr><td>National customs / stat. offices</td><td>Country-specific overlays (INSEE, BEA, ABS, etc.)</td><td>Respective open-data licences</td><td>Varies</td></tr>
          </tbody>
        </table>

        <h2>Analytics</h2>
        <table className="text-xs">
          <thead>
            <tr><th>Subprocessor</th><th>Purpose</th><th>Data categories</th><th>Location</th><th>Transfer safeguards</th></tr>
          </thead>
          <tbody>
            <tr><td>Plausible</td><td>Privacy-first marketing-site analytics</td><td>aggregated, IP anonymised</td><td>EU (Germany)</td><td>intra-EEA</td></tr>
            <tr><td>PostHog (self-hosted EU)</td><td>Product analytics for dashboard (opt-in)</td><td>pseudonymous user IDs, events</td><td>EU (Frankfurt)</td><td>intra-EEA</td></tr>
          </tbody>
        </table>

        <h2>Transfer Impact Assessment (TIA)</h2>
        <p>
          For every US-located sub-processor we have performed a transfer impact assessment documenting supplementary measures:
          transport encryption, at-rest encryption, pseudonymisation of identifiers, contractual zero-training clauses with AI
          providers, zero-retention API flags where available, and the right to bring Feel The Gap into any data subject
          complaint. Full assessments are available on request for B2B Customers at <strong>privacy@feelthegap.world</strong>.
        </p>

        <h2>No Training on Customer Data</h2>
        <p>
          We have contractually disabled training-on-inputs with every AI provider that supports it (OpenAI API default,
          Anthropic default, Groq default, Mistral default, Google Cloud Vertex AI default, HuggingFace Inference API default).
          Customer prompts, submitted documents, and generated Output are not used to retrain public models.
        </p>

        <h2>Changes &amp; Objection Mechanism</h2>
        <p>
          This list is maintained continuously. To receive email notifications of additions, subscribe at
          <strong> privacy@feelthegap.world</strong> with subject &quot;subscribe subprocessors&quot;. Active-DPA Customers
          may object to a new sub-processor on reasonable data-protection grounds within 30 days of notice; if no alternative
          can be agreed, the Customer may terminate the affected Services and receive a pro-rata refund.
        </p>
      </div>
    </div>
  )
}
