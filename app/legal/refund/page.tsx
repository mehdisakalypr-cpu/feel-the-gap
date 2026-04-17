import Link from 'next/link'

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <Link href="/legal" className="text-sky-400 text-sm hover:underline no-underline">← Retour</Link>

        <h1>Refund &amp; Cancellation Policy / Politique de remboursement</h1>
        <p className="text-gray-400 text-sm">Last updated: 2026-04-17 · v2 · EN/FR bilingual, English prevails</p>

        <p>
          This policy explains how to cancel your Feel The Gap subscription and what you can get refunded. It complements
          <Link href="/legal/cgv"> Terms of Sale §4 (Cooling-Off) and §5 (Auto-Renewal)</Link>.
        </p>

        <h2>1. 14-Day Cooling-Off (EU / UK / CH / worldwide goodwill)</h2>
        <p>
          Under Article L221-18 of the French Consumer Code and equivalent provisions in EU, UK, and Swiss law,
          consumers who subscribe to Data (29 €/mo), Strategy (99 €/mo), or Premium (149 €/mo) may withdraw within
          14 calendar days of the first subscription and receive a full refund, no questions asked.
        </p>
        <p>
          We extend the same goodwill 14-day refund to B2B and non-EU customers on the first subscription cycle only.
        </p>
        <p>
          To exercise your right: email <strong>billing@feelthegap.world</strong> with your order ID, or click
          <em> Cancel &amp; Refund</em> from the billing section of your dashboard. Refunds are issued to the original
          payment method within 14 days of confirmation.
        </p>
        <p className="text-xs text-gray-400">
          Exception (Article L221-28 8° French Consumer Code): if you have performed a material export during the cooling-off
          period — defined as downloading more than 10,000 rows of trade data, generating a finalised business plan as PDF/DOCX,
          or consuming more than 50 advisor queries — the service is deemed substantially performed and withdrawal no longer
          applies. The first 10,000 rows, one draft plan preview, and 50 advisor queries remain consumable without forfeiting
          the right of withdrawal. You are clearly warned at the point of each action before the threshold is crossed.
        </p>

        <h2>2. Monthly Plan Cancellation / Résiliation mensuelle</h2>
        <p>
          Monthly plans can be cancelled at any time from the dashboard (3 clicks or fewer, AB-2273 / SB-313 compliant)
          or by emailing <strong>billing@feelthegap.world</strong>. Cancellation takes effect at the end of the current
          billing period; no pro-rata refund is issued for the unused portion, but you keep full access until period end.
        </p>

        <h2>3. Annual Plan Cancellation / Résiliation annuelle</h2>
        <p>
          Annual plans (billed upfront with a 10 % discount) can be cancelled at any time but are <strong>non-refundable
          after the 14-day cooling-off period</strong>, except where mandatory consumer law provides otherwise.
          You keep full access until the end of the pre-paid term. EU consumers on annual plans receive a renewal
          reminder 1–3 months before the next renewal date as required by Article L215-1 of the French Consumer Code.
        </p>

        <h2>4. Credits &amp; Pay-As-You-Go</h2>
        <p>
          Strategy and Premium monthly credits (advisor queries, prospection exports, additional seats) do not roll over.
          One-time credit packs purchased separately are valid for 12 months from purchase and are
          <strong> non-refundable once any credit has been consumed</strong>; unused packs are refundable pro-rata within
          the 14-day cooling-off window. Credits already applied to a generated plan or export cannot be reversed.
        </p>

        <h2>5. Service Interruptions / Interruptions de service</h2>
        <p>
          If we experience a cumulative downtime of more than 8 consecutive hours during your billing period due to our
          infrastructure (excluding scheduled maintenance announced 72 hours in advance, force majeure, or third-party
          upstream issues), you may request a pro-rata credit on your next invoice. Beyond 48 hours of cumulative downtime,
          you may elect a cash refund instead, capped at the current billing period&apos;s fees.
        </p>

        <h2>6. Data Accuracy Claims</h2>
        <p>
          The FTG dataset is sourced from public providers and may contain delays, errors, or gaps inherent to those sources
          (see <Link href="/legal/cgv">Terms of Sale §7</Link>). Data inaccuracies are not a basis for refund unless the
          errors stem from a documented processing defect on our side and you have notified us at <strong>data@feelthegap.world</strong>
          within 30 days of the export.
        </p>

        <h2>7. Chargebacks / Rétrofacturations</h2>
        <p>
          Please contact us before initiating a chargeback — we resolve most billing issues within 48 hours.
          Unjustified chargebacks (where proof of delivery exists) may result in account suspension, re-invoicing of bank
          fees, and a €35 administrative fee. We reserve the right to dispute with documented evidence of delivery.
        </p>

        <h2>8. Free Tier / Explorer Plan</h2>
        <p>
          The Explorer plan is permanently free for non-commercial use and has no refund logic attached.
          You may delete your account at any time from the dashboard; all personal data is erased within 30 days per our
          <Link href="/legal/privacy"> Privacy Policy</Link>.
        </p>

        <h2>9. Contact</h2>
        <p>
          Billing questions: <strong>billing@feelthegap.world</strong>. We respond within 48 hours on business days.
        </p>
      </div>
    </div>
  )
}
