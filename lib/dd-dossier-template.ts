/**
 * Due Diligence Dossier Template — FTG entrepreneur → investisseur.
 *
 * Structure exhaustive d'un dossier d'investissement que tout investisseur
 * sérieux demande. Utilisé pour :
 *   1. Instancier un funding_dossiers (type='investissement') vierge quand un
 *      entrepreneur lance le parcours "chercher des investisseurs".
 *   2. Générer des checklists/émail de relance pour les sections incomplètes.
 *   3. Scorer la complétude (completion_pct) et la qualité (quality_score).
 *
 * Chaque section a :
 *   - id, title, weight (pour le completion score)
 *   - questions[] : { key, prompt, required, placeholder, hint, type }
 *     (type: 'text' | 'longtext' | 'number' | 'currency' | 'pct' | 'date' |
 *            'url' | 'file' | 'table' | 'select', options?)
 *
 * Ce template est la base FR pour l'Afrique francophone ; les variantes par
 * stade (pre-seed / seed / series A) peuvent override / réduire certaines
 * sections (cf. DD_TEMPLATE_BY_STAGE).
 */

export type DDQuestion = {
  key: string
  prompt: string
  required: boolean
  placeholder?: string
  hint?: string
  type: 'text' | 'longtext' | 'number' | 'currency' | 'pct' | 'date' | 'url' | 'file' | 'table' | 'select'
  options?: string[]
  columns?: { key: string; label: string; type: string }[]
}

export type DDSection = {
  id: string
  title: string
  weight: number
  description?: string
  questions: DDQuestion[]
}

export type DDTemplate = {
  version: string
  locale: string
  stage: 'generic' | 'pre_seed' | 'seed' | 'series_a' | 'growth'
  sections: DDSection[]
}

export const DD_TEMPLATE_V1: DDTemplate = {
  version: '1.0',
  locale: 'fr',
  stage: 'generic',
  sections: [
    // 1 — EXECUTIVE SUMMARY
    {
      id: 'executive_summary', title: 'Synthèse exécutive', weight: 8,
      description: 'En 1 page, de quoi parle ton projet et pourquoi ça vaut la peine d\'investir.',
      questions: [
        { key: 'company_name', prompt: 'Nom légal de l\'entreprise', required: true, type: 'text' },
        { key: 'pitch_oneliner', prompt: 'Pitch en 1 phrase (max 20 mots)', required: true, type: 'text', placeholder: 'Nous aidons X à faire Y en Z.' },
        { key: 'problem', prompt: 'Problème résolu (2-3 phrases)', required: true, type: 'longtext' },
        { key: 'solution', prompt: 'Solution (2-3 phrases)', required: true, type: 'longtext' },
        { key: 'traction_headline', prompt: 'Une métrique marquante (revenus, users, contrats, MT produites…)', required: true, type: 'text' },
        { key: 'ask_amount_eur', prompt: 'Montant recherché (€)', required: true, type: 'currency' },
        { key: 'ask_use', prompt: 'Utilisation des fonds (4 postes max)', required: true, type: 'longtext', placeholder: 'Équipement 40%, stock 30%, marketing 20%, trésorerie 10%' },
      ],
    },

    // 2 — MARCHÉ & OPPORTUNITÉ
    {
      id: 'market', title: 'Marché & opportunité', weight: 10,
      questions: [
        { key: 'tam_eur', prompt: 'TAM (Total Addressable Market, €/an)', required: true, type: 'currency', hint: 'Marché total théorique de ta catégorie de produit/service' },
        { key: 'sam_eur', prompt: 'SAM (Serviceable Addressable Market, €/an)', required: true, type: 'currency', hint: 'Part du TAM réellement adressable par ton business model' },
        { key: 'som_eur', prompt: 'SOM (Serviceable Obtainable Market, €/an à 3 ans)', required: true, type: 'currency', hint: 'Part du SAM que tu peux réalistement capter' },
        { key: 'market_growth_pct', prompt: 'Croissance annuelle du marché (%)', required: false, type: 'pct' },
        { key: 'geography', prompt: 'Zones géographiques ciblées', required: true, type: 'longtext' },
        { key: 'segments', prompt: 'Segments clients (3-5)', required: true, type: 'longtext' },
        { key: 'competitive_landscape', prompt: 'Concurrents directs + positionnement', required: true, type: 'longtext' },
        { key: 'moat', prompt: 'Avantage compétitif durable (moat)', required: true, type: 'longtext', hint: 'IP, réseau, coût, marque, data…' },
        { key: 'market_docs', prompt: 'Études, sources chiffrées (URLs ou PDF)', required: false, type: 'file' },
      ],
    },

    // 3 — PRODUIT / SERVICE
    {
      id: 'product', title: 'Produit / service', weight: 8,
      questions: [
        { key: 'product_description', prompt: 'Description détaillée du produit/service', required: true, type: 'longtext' },
        { key: 'value_proposition', prompt: 'Proposition de valeur unique', required: true, type: 'longtext' },
        { key: 'stage', prompt: 'Stade actuel', required: true, type: 'select', options: ['idée', 'MVP', 'beta', 'en vente', 'scaling'] },
        { key: 'roadmap_12m', prompt: 'Roadmap 12 mois (5 jalons)', required: true, type: 'longtext' },
        { key: 'ip_status', prompt: 'Brevets / marques / certifications', required: false, type: 'longtext' },
        { key: 'tech_stack', prompt: 'Stack technologique (si applicable)', required: false, type: 'text' },
        { key: 'product_photos', prompt: 'Photos/vidéos produit (URLs ou fichiers)', required: true, type: 'file' },
      ],
    },

    // 4 — ÉQUIPE
    {
      id: 'team', title: 'Équipe', weight: 10,
      description: 'Les investisseurs parient d\'abord sur l\'équipe. Sois précis.',
      questions: [
        { key: 'founders', prompt: 'Fondateurs', required: true, type: 'table', columns: [
          { key: 'name', label: 'Nom', type: 'text' },
          { key: 'role', label: 'Rôle', type: 'text' },
          { key: 'equity_pct', label: 'Parts %', type: 'pct' },
          { key: 'linkedin', label: 'LinkedIn', type: 'url' },
          { key: 'background', label: 'Parcours (2 lignes)', type: 'longtext' },
        ] },
        { key: 'key_hires', prompt: 'Embauches clés (3-5)', required: false, type: 'table', columns: [
          { key: 'name', label: 'Nom', type: 'text' },
          { key: 'role', label: 'Rôle', type: 'text' },
          { key: 'background', label: 'Parcours', type: 'longtext' },
        ] },
        { key: 'advisors', prompt: 'Advisors / mentors', required: false, type: 'longtext' },
        { key: 'team_gap', prompt: 'Postes à recruter avec les fonds', required: true, type: 'longtext' },
        { key: 'founder_commitment', prompt: 'Temps plein sur le projet ?', required: true, type: 'select', options: ['Oui (tous)', 'Partiel (1+ founder)', 'Non encore'] },
      ],
    },

    // 5 — BUSINESS MODEL
    {
      id: 'business_model', title: 'Business model', weight: 9,
      questions: [
        { key: 'revenue_streams', prompt: 'Flux de revenus (liste + % du CA)', required: true, type: 'longtext' },
        { key: 'pricing', prompt: 'Tarification (prix moyen, ranges)', required: true, type: 'longtext' },
        { key: 'cac_eur', prompt: 'CAC (coût d\'acquisition client, €)', required: false, type: 'currency' },
        { key: 'ltv_eur', prompt: 'LTV (lifetime value, €)', required: false, type: 'currency' },
        { key: 'gross_margin_pct', prompt: 'Marge brute actuelle (%)', required: true, type: 'pct' },
        { key: 'target_gross_margin_pct', prompt: 'Marge brute cible année 3 (%)', required: true, type: 'pct' },
        { key: 'unit_economics', prompt: 'Unit economics détaillés', required: true, type: 'longtext', hint: 'Par unité vendue / transaction / mois : coût, revenu, marge' },
      ],
    },

    // 6 — TRACTION
    {
      id: 'traction', title: 'Traction & KPIs', weight: 12,
      description: 'Ce qui convainc vraiment un investisseur. Sois factuel.',
      questions: [
        { key: 'revenue_mrr_eur', prompt: 'Revenus récurrents mensuels actuels (€)', required: false, type: 'currency' },
        { key: 'revenue_arr_eur', prompt: 'Revenus annualisés (€)', required: false, type: 'currency' },
        { key: 'revenue_last_6m', prompt: 'Revenus mois-par-mois (6 derniers mois)', required: true, type: 'table', columns: [
          { key: 'month', label: 'Mois', type: 'date' },
          { key: 'revenue_eur', label: 'Revenus €', type: 'currency' },
        ] },
        { key: 'clients_count', prompt: 'Nombre de clients actifs', required: true, type: 'number' },
        { key: 'top_clients', prompt: 'Top 5 clients (nom + % du CA)', required: false, type: 'longtext' },
        { key: 'pipeline_eur', prompt: 'Pipeline commercial identifié (€)', required: false, type: 'currency' },
        { key: 'letters_of_intent', prompt: 'Lettres d\'intention / pré-commandes (fichiers)', required: false, type: 'file' },
        { key: 'testimonials', prompt: 'Témoignages clients (3)', required: false, type: 'longtext' },
        { key: 'kpi_growth_pct', prompt: 'Croissance mois-à-mois moyenne (%)', required: false, type: 'pct' },
      ],
    },

    // 7 — FINANCIER
    {
      id: 'financials', title: 'Financier', weight: 12,
      questions: [
        { key: 'pnl_3y', prompt: 'Compte de résultat prévisionnel 3 ans', required: true, type: 'file', hint: 'Fichier Excel/PDF — CA, COGS, OPEX, EBITDA, résultat net' },
        { key: 'cashflow_3y', prompt: 'Cash-flow prévisionnel 3 ans', required: true, type: 'file' },
        { key: 'historical_pnl', prompt: 'Comptes historiques 2 derniers exercices (si applicable)', required: false, type: 'file' },
        { key: 'burn_rate_eur', prompt: 'Burn rate mensuel actuel (€)', required: true, type: 'currency' },
        { key: 'runway_months', prompt: 'Runway actuel (mois)', required: true, type: 'number' },
        { key: 'breakeven_date', prompt: 'Date atteinte équilibre', required: true, type: 'date' },
        { key: 'key_assumptions', prompt: 'Hypothèses clés du prévisionnel', required: true, type: 'longtext' },
      ],
    },

    // 8 — DEAL STRUCTURE
    {
      id: 'deal', title: 'Structure du deal', weight: 8,
      questions: [
        { key: 'previous_rounds', prompt: 'Tours précédents (montant, valo, investisseurs)', required: false, type: 'longtext' },
        { key: 'cap_table', prompt: 'Cap table actuelle', required: true, type: 'table', columns: [
          { key: 'shareholder', label: 'Actionnaire', type: 'text' },
          { key: 'shares_pct', label: '% parts', type: 'pct' },
          { key: 'type', label: 'Type (founder/investor/employee)', type: 'text' },
        ] },
        { key: 'raise_amount_eur', prompt: 'Montant recherché (€)', required: true, type: 'currency' },
        { key: 'pre_money_valuation_eur', prompt: 'Valorisation pre-money souhaitée (€)', required: true, type: 'currency' },
        { key: 'instrument', prompt: 'Instrument', required: true, type: 'select', options: ['equity', 'convertible note', 'SAFE', 'dette', 'grant', 'mixte'] },
        { key: 'use_of_funds_detail', prompt: 'Utilisation détaillée des fonds (table)', required: true, type: 'table', columns: [
          { key: 'category', label: 'Catégorie', type: 'text' },
          { key: 'amount_eur', label: 'Montant €', type: 'currency' },
          { key: 'pct', label: '% du total', type: 'pct' },
        ] },
        { key: 'milestones_post_round', prompt: 'Jalons atteints avec ces fonds (3-5)', required: true, type: 'longtext' },
        { key: 'timeline', prompt: 'Calendrier du tour (signing + closing)', required: true, type: 'text' },
      ],
    },

    // 9 — RISQUES & MITIGATION
    {
      id: 'risks', title: 'Risques & mitigation', weight: 6,
      questions: [
        { key: 'market_risks', prompt: 'Risques marché + mitigation', required: true, type: 'longtext' },
        { key: 'operational_risks', prompt: 'Risques opérationnels + mitigation', required: true, type: 'longtext' },
        { key: 'financial_risks', prompt: 'Risques financiers + mitigation', required: true, type: 'longtext' },
        { key: 'regulatory_risks', prompt: 'Risques réglementaires/licences', required: false, type: 'longtext' },
        { key: 'exit_scenarios', prompt: 'Scénarios de sortie / exit (3-5 ans)', required: true, type: 'longtext' },
      ],
    },

    // 10 — JURIDIQUE & COMPLIANCE
    {
      id: 'legal', title: 'Juridique & compliance', weight: 6,
      questions: [
        { key: 'legal_structure', prompt: 'Structure légale (SAS, SARL, SA…)', required: true, type: 'text' },
        { key: 'registration_doc', prompt: 'Kbis / RCCM / équivalent', required: true, type: 'file' },
        { key: 'shareholders_agreement', prompt: 'Pacte d\'actionnaires', required: false, type: 'file' },
        { key: 'contracts_clients_key', prompt: 'Contrats clients clés (top 3)', required: false, type: 'file' },
        { key: 'contracts_suppliers_key', prompt: 'Contrats fournisseurs clés', required: false, type: 'file' },
        { key: 'litigations', prompt: 'Litiges en cours', required: true, type: 'longtext', placeholder: 'Aucun' },
        { key: 'ip_filings', prompt: 'Brevets / marques déposés', required: false, type: 'file' },
        { key: 'tax_compliance', prompt: 'Attestations fiscales / sociales à jour', required: true, type: 'file' },
      ],
    },

    // 11 — IMPACT (optional mais recommandé Afrique)
    {
      id: 'impact', title: 'Impact & ESG', weight: 4,
      questions: [
        { key: 'jobs_created', prompt: 'Emplois créés directs + indirects', required: false, type: 'number' },
        { key: 'sdg_alignment', prompt: 'ODD alignés (numéros)', required: false, type: 'text', placeholder: '1, 2, 8, 12' },
        { key: 'impact_metrics', prompt: 'KPIs d\'impact mesurés', required: false, type: 'longtext' },
        { key: 'local_sourcing_pct', prompt: '% sourcing local', required: false, type: 'pct' },
        { key: 'gender_balance', prompt: 'Parité équipe', required: false, type: 'longtext' },
      ],
    },

    // 12 — ANNEXES
    {
      id: 'appendix', title: 'Annexes', weight: 3,
      questions: [
        { key: 'pitch_deck', prompt: 'Pitch deck (PDF)', required: true, type: 'file' },
        { key: 'product_video', prompt: 'Vidéo produit (lien ou fichier)', required: false, type: 'file' },
        { key: 'press_mentions', prompt: 'Mentions presse (URLs)', required: false, type: 'longtext' },
        { key: 'awards', prompt: 'Prix & distinctions', required: false, type: 'longtext' },
      ],
    },
  ],
}

/** Compute completion percentage for a dossier given its answers. */
export function computeCompletion(template: DDTemplate, answers: Record<string, any>): number {
  let requiredTotal = 0
  let requiredDone = 0
  let optionalTotal = 0
  let optionalDone = 0
  for (const sec of template.sections) {
    for (const q of sec.questions) {
      const v = answers?.[sec.id]?.[q.key]
      const hasValue = v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
      if (q.required) { requiredTotal++; if (hasValue) requiredDone++ }
      else { optionalTotal++; if (hasValue) optionalDone++ }
    }
  }
  // Required counts 80%, optional 20%
  const reqPct = requiredTotal ? requiredDone / requiredTotal : 1
  const optPct = optionalTotal ? optionalDone / optionalTotal : 1
  return Math.round((reqPct * 0.8 + optPct * 0.2) * 100)
}

/**
 * Adapter: convert DD_TEMPLATE_V1 to the existing DossierStructure shape so
 * the current /funding/dossier/[id] UI renders it without changes.
 * Maps: prompt→label, longtext→textarea, currency→currency_eur, pct→percent,
 *       url→text, table→textarea (degraded — filled as structured text),
 *       options (string[])→ [{value,label}].
 */
export function toDossierStructure(tpl: DDTemplate, context?: Record<string, unknown>) {
  const mapType = (t: DDQuestion['type']): string => {
    switch (t) {
      case 'longtext': return 'textarea'
      case 'currency': return 'currency_eur'
      case 'pct':      return 'percent'
      case 'url':      return 'text'
      case 'table':    return 'textarea'
      default:         return t
    }
  }
  return {
    version: 1 as const,
    type: 'investissement' as const,
    generated_at: new Date().toISOString(),
    context: context ?? {},
    template_source: `dd_v${tpl.version}`,
    sections: tpl.sections.map(s => ({
      key: s.id,
      title: s.title,
      description: s.description ?? '',
      questions: s.questions.map(q => ({
        key: q.key,
        label: q.prompt,
        type: mapType(q.type),
        required: q.required,
        help: q.hint,
        placeholder: q.placeholder,
        options: q.options?.map(o => ({ value: o, label: o })),
        // Hint for table-type questions so users structure their free text
        ...(q.type === 'table' && q.columns
          ? { help: (q.hint ?? '') + ' — Colonnes attendues : ' + q.columns.map(c => c.label).join(' | ') }
          : {}),
      })),
    })),
  }
}

/** Return the next 5 missing required items (for nudges/emails). */
export function nextMissingRequired(template: DDTemplate, answers: Record<string, any>, max = 5) {
  const out: { section: string; key: string; prompt: string }[] = []
  for (const sec of template.sections) {
    for (const q of sec.questions) {
      if (!q.required) continue
      const v = answers?.[sec.id]?.[q.key]
      const hasValue = v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
      if (!hasValue) out.push({ section: sec.title, key: q.key, prompt: q.prompt })
      if (out.length >= max) return out
    }
  }
  return out
}
