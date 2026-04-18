/**
 * lib/incoterms/contract — Vague 3 #6 · 2026-04-18
 *
 * Incoterms 2020 · ICC (International Chamber of Commerce) definitions
 * + renderer HTML pour contrat boilerplate.
 *
 * 11 termes · 2 catégories :
 *  - any_mode  (7): EXW · FCA · CPT · CIP · DAP · DPU · DDP
 *  - sea_waterway (4): FAS · FOB · CFR · CIF
 *
 * Aucune dépendance externe — pure data + renderers.
 */

export type IncotermCode =
  | 'EXW' | 'FCA' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP'
  | 'FAS' | 'FOB' | 'CFR' | 'CIF'

export type ModeScope = 'any_mode' | 'sea_waterway'

export interface IncotermDefinition {
  code: IncotermCode
  name: string
  modeScope: ModeScope
  /** Risque passe du vendeur à l'acheteur */
  riskTransfer: string
  /** Répartition des coûts de transport/assurance */
  costTransfer: string
  sellerDuties: string[]
  buyerDuties: string[]
  /** Notes pratiques — piège courant */
  note?: string
}

export const INCOTERMS_2020: Record<IncotermCode, IncotermDefinition> = {
  EXW: {
    code: 'EXW',
    name: 'Ex Works',
    modeScope: 'any_mode',
    riskTransfer: "Chez le vendeur, marchandise mise à disposition (non chargée).",
    costTransfer: "Vendeur : rien. Acheteur : tout dès la mise à disposition.",
    sellerDuties: [
      "Mettre la marchandise à disposition à ses locaux/usine.",
      "Fournir facture commerciale + preuve de disposition.",
    ],
    buyerDuties: [
      "Charger la marchandise au lieu convenu.",
      "Douane export + import + transport + assurance + livraison.",
    ],
    note: "EXW place la quasi-totalité des obligations sur l'acheteur — mal adapté si export hors UE (acheteur étranger ne peut souvent pas dédouaner côté vendeur). Préférer FCA.",
  },
  FCA: {
    code: 'FCA',
    name: 'Free Carrier',
    modeScope: 'any_mode',
    riskTransfer: "À la remise au transporteur nommé par l'acheteur, au lieu convenu.",
    costTransfer: "Vendeur : jusqu'à la remise au transporteur + douane export. Acheteur : à partir de la prise en charge.",
    sellerDuties: [
      "Livrer au transporteur désigné par l'acheteur au lieu convenu.",
      "Dédouaner à l'export.",
    ],
    buyerDuties: [
      "Nommer le transporteur et supporter le fret principal.",
      "Douane import + livraison finale.",
    ],
  },
  CPT: {
    code: 'CPT',
    name: 'Carriage Paid To',
    modeScope: 'any_mode',
    riskTransfer: "À la remise au premier transporteur (même si le vendeur paie le fret jusqu'au lieu de destination convenu).",
    costTransfer: "Vendeur paie le fret jusqu'au lieu de destination convenu. Acheteur supporte le risque dès la remise au premier transporteur.",
    sellerDuties: [
      "Contrat de transport jusqu'au lieu convenu.",
      "Douane export + fret payé.",
    ],
    buyerDuties: [
      "Assurance (si souhaitée) à partir de la remise au premier transporteur.",
      "Douane import + livraison finale.",
    ],
    note: "Attention : le transfert du risque et le transfert des coûts ne sont PAS au même endroit — piège classique.",
  },
  CIP: {
    code: 'CIP',
    name: 'Carriage and Insurance Paid To',
    modeScope: 'any_mode',
    riskTransfer: "À la remise au premier transporteur.",
    costTransfer: "Vendeur paie le fret + une assurance tous risques (ICC A) jusqu'au lieu de destination convenu.",
    sellerDuties: [
      "Contrat de transport + assurance ICC A (niveau maximum depuis Incoterms 2020).",
      "Douane export.",
    ],
    buyerDuties: [
      "Douane import + livraison finale.",
    ],
    note: "Incoterms 2020 : le niveau d'assurance pour CIP a été relevé de ICC C à ICC A (CIF reste ICC C).",
  },
  DAP: {
    code: 'DAP',
    name: 'Delivered at Place',
    modeScope: 'any_mode',
    riskTransfer: "À la livraison au lieu convenu, marchandise mise à disposition (non déchargée).",
    costTransfer: "Vendeur : tout jusqu'au lieu convenu. Acheteur : déchargement + douane import.",
    sellerDuties: [
      "Transport jusqu'au lieu convenu.",
      "Douane export.",
    ],
    buyerDuties: [
      "Décharger la marchandise.",
      "Douane import + taxes.",
    ],
  },
  DPU: {
    code: 'DPU',
    name: 'Delivered at Place Unloaded',
    modeScope: 'any_mode',
    riskTransfer: "À la livraison ET déchargement au lieu convenu.",
    costTransfer: "Vendeur : tout jusqu'au déchargement inclus. Acheteur : douane import.",
    sellerDuties: [
      "Transport + déchargement au lieu convenu.",
      "Douane export.",
    ],
    buyerDuties: [
      "Douane import + taxes.",
    ],
    note: "Seul Incoterm où le vendeur est obligé de décharger. Remplace DAT (Delivered at Terminal) de 2010.",
  },
  DDP: {
    code: 'DDP',
    name: 'Delivered Duty Paid',
    modeScope: 'any_mode',
    riskTransfer: "À la livraison au lieu convenu, dédouanée à l'import (non déchargée).",
    costTransfer: "Vendeur : absolument tout, y compris droits et taxes import.",
    sellerDuties: [
      "Transport + douane export + douane import + taxes.",
      "Livraison au lieu convenu.",
    ],
    buyerDuties: [
      "Décharger la marchandise.",
    ],
    note: "Le plus contraignant pour le vendeur — à n'utiliser que si on a les moyens de dédouaner dans le pays d'import.",
  },
  FAS: {
    code: 'FAS',
    name: 'Free Alongside Ship',
    modeScope: 'sea_waterway',
    riskTransfer: "À la mise le long du navire au port d'embarquement.",
    costTransfer: "Vendeur : jusqu'au quai. Acheteur : chargement + fret maritime + import.",
    sellerDuties: [
      "Livrer la marchandise le long du navire au port convenu.",
      "Douane export.",
    ],
    buyerDuties: [
      "Chargement + fret maritime + douane import.",
    ],
  },
  FOB: {
    code: 'FOB',
    name: 'Free on Board',
    modeScope: 'sea_waterway',
    riskTransfer: "Quand la marchandise est chargée à bord du navire au port d'embarquement.",
    costTransfer: "Vendeur : jusqu'au chargement à bord. Acheteur : fret maritime + import.",
    sellerDuties: [
      "Livrer et charger la marchandise à bord du navire désigné par l'acheteur.",
      "Douane export.",
    ],
    buyerDuties: [
      "Fret maritime + assurance + douane import.",
    ],
  },
  CFR: {
    code: 'CFR',
    name: 'Cost and Freight',
    modeScope: 'sea_waterway',
    riskTransfer: "Quand la marchandise est chargée à bord (même si le vendeur paie jusqu'au port d'arrivée).",
    costTransfer: "Vendeur : fret maritime payé jusqu'au port d'arrivée. Acheteur : assurance + déchargement + import.",
    sellerDuties: [
      "Fret maritime + douane export.",
    ],
    buyerDuties: [
      "Assurance + déchargement + douane import.",
    ],
  },
  CIF: {
    code: 'CIF',
    name: 'Cost, Insurance and Freight',
    modeScope: 'sea_waterway',
    riskTransfer: "Quand la marchandise est chargée à bord.",
    costTransfer: "Vendeur : fret maritime + assurance (niveau minimum ICC C) jusqu'au port d'arrivée.",
    sellerDuties: [
      "Fret + assurance ICC C + douane export.",
    ],
    buyerDuties: [
      "Déchargement + douane import.",
    ],
    note: "Niveau d'assurance minimum ICC C pour CIF (2020) — si plus de couverture souhaitée, utiliser CIP ou demander upgrade explicite.",
  },
}

export type ContractParties = {
  seller: { name: string; company?: string; address?: string; country: string; email: string }
  buyer: { name: string; company?: string; address?: string; country: string; email: string }
}

export type ContractTerms = {
  productTitle: string
  productDescription?: string
  hsCode?: string
  quantity: number
  unit: string
  unitPriceEur: number
  totalEur: number
  currency?: string
  originPort: string
  destinationPort: string
  incoterm: IncotermCode
  paymentTerms?: string
  deliveryDeadline?: string // ISO date
}

/**
 * Rend un contrat HTML prêt à être signé (DocuSign, DocSeal, ou print).
 * Zero deps — juste du template literal.
 */
export function renderContractHtml(args: {
  parties: ContractParties
  terms: ContractTerms
  contractNumber?: string
}): string {
  const { parties, terms } = args
  const def = INCOTERMS_2020[terms.incoterm]
  const currency = terms.currency ?? 'EUR'
  const num = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const contractNumber = args.contractNumber ?? `FTG-${Date.now().toString(36).toUpperCase()}`
  const today = new Date().toISOString().split('T')[0]

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Contrat ${contractNumber}</title></head>
<body style="font-family:Georgia,serif;max-width:780px;margin:0 auto;padding:40px;color:#111;line-height:1.55">
  <div style="text-align:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px">
    <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#666">Feel The Gap · Marketplace B2B</div>
    <h1 style="margin:8px 0 0;font-size:24px">Contrat de vente à l'international</h1>
    <div style="font-size:13px;color:#666;margin-top:4px">N° ${contractNumber} · ${today}</div>
  </div>

  <h2 style="font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px">1. Parties au contrat</h2>
  <table style="width:100%;font-size:13px;margin-bottom:16px">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:12px">
        <strong>VENDEUR</strong><br>
        ${parties.seller.name}${parties.seller.company ? `<br>${parties.seller.company}` : ''}<br>
        ${parties.seller.address ? `${parties.seller.address}<br>` : ''}
        ${parties.seller.country}<br>
        ${parties.seller.email}
      </td>
      <td style="width:50%;vertical-align:top">
        <strong>ACHETEUR</strong><br>
        ${parties.buyer.name}${parties.buyer.company ? `<br>${parties.buyer.company}` : ''}<br>
        ${parties.buyer.address ? `${parties.buyer.address}<br>` : ''}
        ${parties.buyer.country}<br>
        ${parties.buyer.email}
      </td>
    </tr>
  </table>

  <h2 style="font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px">2. Objet</h2>
  <p style="font-size:13px">Vente de <strong>${terms.quantity} ${terms.unit}</strong> de <strong>${terms.productTitle}</strong>${terms.hsCode ? ` (code HS ${terms.hsCode})` : ''}${terms.productDescription ? `.<br><em>${terms.productDescription}</em>` : '.'}</p>

  <h2 style="font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px">3. Prix et conditions financières</h2>
  <table style="width:100%;font-size:13px;border-collapse:collapse">
    <tr><td style="padding:4px 0">Prix unitaire</td><td style="text-align:right">${num(terms.unitPriceEur)} ${currency} / ${terms.unit}</td></tr>
    <tr><td style="padding:4px 0">Quantité</td><td style="text-align:right">${terms.quantity} ${terms.unit}</td></tr>
    <tr style="border-top:1px solid #111;font-weight:700"><td style="padding:6px 0">Total</td><td style="text-align:right">${num(terms.totalEur)} ${currency}</td></tr>
  </table>
  ${terms.paymentTerms ? `<p style="font-size:13px;margin-top:8px"><strong>Modalités de paiement :</strong> ${terms.paymentTerms}</p>` : ''}

  <h2 style="font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px">4. Incoterm ${terms.incoterm} (ICC 2020)</h2>
  <p style="font-size:13px;margin:4px 0"><strong>${def.name}</strong> · ${def.modeScope === 'sea_waterway' ? 'Transport maritime/fluvial uniquement' : 'Tout mode de transport'}</p>
  <p style="font-size:13px;margin:4px 0">Port/lieu d'expédition : <strong>${terms.originPort}</strong><br>Port/lieu de destination : <strong>${terms.destinationPort}</strong></p>
  <p style="font-size:13px;margin:8px 0"><strong>Transfert du risque :</strong> ${def.riskTransfer}</p>
  <p style="font-size:13px;margin:8px 0"><strong>Transfert des coûts :</strong> ${def.costTransfer}</p>
  <div style="font-size:13px;margin:8px 0">
    <strong>Obligations du vendeur :</strong>
    <ul style="margin:4px 0;padding-left:20px">${def.sellerDuties.map(d => `<li>${d}</li>`).join('')}</ul>
  </div>
  <div style="font-size:13px;margin:8px 0">
    <strong>Obligations de l'acheteur :</strong>
    <ul style="margin:4px 0;padding-left:20px">${def.buyerDuties.map(d => `<li>${d}</li>`).join('')}</ul>
  </div>
  ${def.note ? `<p style="font-size:12px;color:#666;font-style:italic;margin-top:8px"><strong>Note :</strong> ${def.note}</p>` : ''}

  ${terms.deliveryDeadline ? `<h2 style="font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px">5. Délai de livraison</h2><p style="font-size:13px">Au plus tard le <strong>${terms.deliveryDeadline}</strong>.</p>` : ''}

  <h2 style="font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px">${terms.deliveryDeadline ? '6' : '5'}. Droit applicable et litiges</h2>
  <p style="font-size:13px">Le présent contrat est régi par la Convention de Vienne sur la vente internationale de marchandises (CISG, 1980). Tout litige non résolu à l'amiable sera soumis à l'arbitrage selon le règlement de la Chambre de Commerce Internationale (ICC).</p>

  <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:24px;font-size:13px">
    <div style="border-top:1px solid #111;padding-top:8px">
      <strong>Vendeur</strong><br>${parties.seller.name}<br>Date : ____________<br>Signature :
    </div>
    <div style="border-top:1px solid #111;padding-top:8px">
      <strong>Acheteur</strong><br>${parties.buyer.name}<br>Date : ____________<br>Signature :
    </div>
  </div>

  <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999">
    Contrat généré par Feel The Gap (feel-the-gap.com) · Incoterms 2020 (ICC) · CISG
  </div>
</body></html>`
}

/** Export simplifié pour seed ou insertion en DB */
export function seedIncotermsTemplates(): Array<{
  code: IncotermCode
  mode_scope: ModeScope
  seller_duties: string[]
  buyer_duties: string[]
  risk_transfer: string
  cost_transfer: string
  template_text: string
  version: string
}> {
  return Object.values(INCOTERMS_2020).map(def => ({
    code: def.code,
    mode_scope: def.modeScope,
    seller_duties: def.sellerDuties,
    buyer_duties: def.buyerDuties,
    risk_transfer: def.riskTransfer,
    cost_transfer: def.costTransfer,
    template_text: def.note ?? '',
    version: '2020',
  }))
}
