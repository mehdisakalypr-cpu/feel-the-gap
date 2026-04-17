import Link from 'next/link'

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <Link href="/legal" className="text-sky-400 text-sm hover:underline no-underline">← Retour</Link>

        <h1>Data Processing Agreement (GDPR Art. 28)</h1>
        <p className="text-gray-400 text-sm">
          Last updated: 2026-04-17 · v2 · Auto-concluded upon Customer acceptance of <Link href="/legal/cgu">Terms of Use</Link>
        </p>

        <p>
          This Data Processing Agreement (&quot;DPA&quot;) forms part of the Agreement between the Customer (&quot;Controller&quot;)
          and Feel The Gap, operated by OFA Holdings LLC, a Wyoming limited liability company (&quot;Processor&quot;).
          It reflects the parties&apos; obligations under Regulation (EU) 2016/679 (GDPR) Article 28, and, where applicable,
          the UK GDPR, the Swiss Federal Act on Data Protection (FADP), the Brazilian LGPD, and other equivalent regimes.
          By using the Service as a business entity or placing data of EU/UK/CH individuals through it, Controller
          is deemed to have entered into this DPA.
        </p>

        <h2>1. Subject Matter &amp; Duration</h2>
        <p>
          Processor processes Personal Data to deliver the Services: trade dataset access, dashboards, exports, AI-generated
          business plans, AI advisor, watchlists, alerts, prospection briefs, transactional emails, and platform analytics.
          Duration: the term of the Agreement plus up to 90 days for deletion, subject to statutory retention (tax, AML).
        </p>

        <h2>2. Categories of Data &amp; Data Subjects</h2>
        <ul>
          <li><strong>Data subjects:</strong> Controller&apos;s authorised users (employees, contractors), Controller&apos;s customers or leads when uploaded to FTG for prospection purposes</li>
          <li><strong>Categories of Personal Data:</strong> identification (name, business email, business phone), company data (legal name, address, sector), usage telemetry (IP, user-agent, session duration, feature usage), content submitted to AI features (prompts, files, queries)</li>
          <li><strong>Special categories (GDPR Art. 9):</strong> none processed by default; Controller must not submit sensitive data via uploads or prompts</li>
          <li><strong>Children&apos;s data:</strong> none; the Service is not directed at individuals under 18</li>
        </ul>

        <h2>3. Processor Obligations</h2>
        <ol>
          <li>Process Personal Data only on documented instructions from Controller — the Agreement, this DPA, and Controller&apos;s configuration in the dashboard constitute such instructions</li>
          <li>Ensure that personnel authorised to process Personal Data have committed to confidentiality or are under an appropriate statutory obligation</li>
          <li>Implement the technical and organisational measures set out in Annex II below (Article 32 GDPR)</li>
          <li>Only engage sub-processors listed at <Link href="/legal/subprocessors">/legal/subprocessors</Link> and give Controller 30 days&apos; prior notice of additions or replacements, with a right to object on reasonable data-protection grounds</li>
          <li>Assist Controller, taking into account the nature of processing, in responding to data subject rights requests within 7 business days</li>
          <li>Notify Controller of a Personal Data breach without undue delay and in any case within 72 hours of becoming aware, with the content required by Article 33(3) GDPR</li>
          <li>At Controller&apos;s choice, delete or return all Personal Data at the end of the Services within 90 days, subject to statutory retention</li>
          <li>Make available all information necessary to demonstrate compliance with Article 28 and allow audits (document review or on-site with 30 days&apos; notice, once per year unless a breach triggers more)</li>
          <li>Assist Controller with data protection impact assessments (Article 35) and prior consultations (Article 36) where reasonably required</li>
        </ol>

        <h2>4. Controller Obligations</h2>
        <ul>
          <li>Ensure a lawful basis for all Personal Data submitted to the Service</li>
          <li>Comply with Controller&apos;s own transparency obligations toward its users and leads</li>
          <li>Keep authentication credentials, API keys, and 2FA factors confidential</li>
          <li>Not submit special-category data, payment card numbers outside Stripe Checkout, or data of individuals under 18</li>
        </ul>

        <h2>5. International Transfers</h2>
        <p>
          Where Processor or a Sub-processor transfers Personal Data outside the EEA, the transfer is governed by the EU
          Standard Contractual Clauses (Commission Implementing Decision 2021/914, Module 2 Controller-to-Processor or
          Module 3 Processor-to-Processor), which are incorporated into this DPA by reference. For UK transfers, the UK
          International Data Transfer Addendum (IDTA) applies. For Swiss transfers, the FDPIC-approved SCC addendum applies.
          Supplementary measures (encryption in transit and at rest, pseudonymisation of identifiers where possible,
          contractual zero-training clauses with AI providers) are documented in our Transfer Impact Assessment available on
          request at <strong>privacy@feelthegap.world</strong>.
        </p>

        <h2>6. Liability</h2>
        <p>
          Liability under this DPA is governed by the Agreement and its limitation of liability clauses
          (<Link href="/legal/cgv">Terms of Sale §11</Link>), except where mandatory law provides otherwise. Nothing in this
          DPA limits statutory rights of data subjects or the regulatory powers of supervisory authorities.
        </p>

        <h2>Annex I — Processing Details</h2>
        <p>
          <strong>Nature and purpose:</strong> hosting and processing of Controller&apos;s account, business data, dataset queries,
          AI-generated content, and prospection material in order to deliver the Services described in §1.<br />
          <strong>Duration:</strong> term of the Agreement plus 90 days deletion window.<br />
          <strong>Frequency:</strong> continuous.<br />
          <strong>Location of Controller:</strong> as declared in Customer billing profile.<br />
          <strong>Location of Processor establishment:</strong> Wyoming, USA.<br />
          <strong>Location of primary data storage:</strong> Supabase EU (Frankfurt) region.
        </p>

        <h2>Annex II — Technical &amp; Organisational Measures</h2>
        <ul>
          <li>TLS 1.2+ in transit; AES-256 at rest on Supabase Postgres and on Vercel cached responses</li>
          <li>SSO with hardware-backed MFA mandatory for all Processor staff with production access</li>
          <li>Least-privilege IAM with quarterly access review and automated de-provisioning on employee offboarding</li>
          <li>Security logging with 12-month retention and real-time alerting on privileged actions</li>
          <li>Annual penetration test by an external vendor; monthly dependency-vulnerability scans</li>
          <li>Daily encrypted backups with 30-day point-in-time recovery on the primary database</li>
          <li>Secure SDLC: mandatory code review, CodeQL / Semgrep scanning, secret scanning on every pull request</li>
          <li>Business continuity &amp; disaster recovery plan with documented RTO 4h / RPO 24h, tested annually</li>
          <li>Contractual zero-training clauses with every AI subprocessor that supports them (OpenAI, Anthropic, Groq, HuggingFace)</li>
        </ul>

        <h2>Annex III — List of Sub-processors</h2>
        <p>
          The current list of Sub-processors is maintained at <Link href="/legal/subprocessors">/legal/subprocessors</Link> and
          is updated with 30 days&apos; prior notice of additions or replacements.
        </p>

        <h2>Signature</h2>
        <p>
          This DPA is automatically concluded when Controller accepts the Terms of Use or first uses the Service with
          Personal Data. For a countersigned copy on your letterhead, email <strong>privacy@feelthegap.world</strong> with
          your entity name, registered address, representative, and the effective date.
        </p>
      </div>
    </div>
  )
}
