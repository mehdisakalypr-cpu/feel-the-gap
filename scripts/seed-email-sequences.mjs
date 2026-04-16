#!/usr/bin/env node
/**
 * Seed FTG email sequences: onboarding (4 steps) + nurture (3 steps).
 * Idempotent: upserts sequences by code, steps by (sequence_id, step_order).
 *
 * Usage: node scripts/seed-email-sequences.mjs
 */
import fs from 'node:fs'

const token = fs.readFileSync('/root/.supabase/access-token', 'utf8').trim()
const ref = process.env.SUPABASE_PROJECT_REF || 'jebuagyeapkltyjitosm'

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const txt = await res.text()
  if (!res.ok) {
    console.error('HTTP', res.status, txt)
    throw new Error('SQL failed')
  }
  try { return JSON.parse(txt) } catch { return txt }
}

function esc(s) { return String(s).replace(/'/g, "''") }

const APP = 'https://feel-the-gap.vercel.app'

function block(title, body, cta, ctaUrl) {
  return `<h2 style="color:#C9A84C;font-size:22px;margin:0 0 16px;font-weight:800">${title}</h2>
<div style="color:#e2e8f0;font-size:15px;line-height:1.65">${body}</div>
${cta ? `<div style="margin:24px 0"><a href="${ctaUrl}" style="display:inline-block;background:#C9A84C;color:#07090F;padding:12px 22px;border-radius:8px;font-weight:700;text-decoration:none">${cta}</a></div>` : ''}`
}

const SEQUENCES = [
  {
    code: 'onboarding',
    name: 'Onboarding Feel The Gap',
    description: 'Parcours d\'accueil 7 jours — premier rapport, top opportunités, business plan, exploration.',
    steps: [
      {
        order: 1,
        delay_hours: 0,
        subject: 'Bienvenue sur Feel The Gap — ton premier rapport pays',
        body_html: block(
          'Bienvenue sur Feel The Gap',
          `<p>Content de t'avoir avec nous. Tu as maintenant accès à notre moteur <strong>data import-export mondial</strong> et à la <strong>génération de business plans assistée par IA</strong>.</p>
<p>Pour commencer : choisis un pays et lance ton premier rapport en 30 secondes. Tu verras immédiatement les flux commerciaux entrants/sortants, les niches sous-exploitées, et les opportunités chiffrées.</p>`,
          'Lancer mon premier rapport',
          `${APP}/map`,
        ),
        body_text: 'Bienvenue sur Feel The Gap. Lance ton premier rapport pays sur ' + APP + '/map',
      },
      {
        order: 2,
        delay_hours: 24,
        subject: 'Top 5 opportunités import-export de cette semaine',
        body_html: block(
          'Les 5 niches qui bougent cette semaine',
          `<p>Nos agents ont scanné 180+ pays et les flux douaniers récents. Voici 5 corridors qui sortent du lot :</p>
<ul style="padding-left:20px">
<li>Produits agro transformés <strong>Afrique de l'Ouest → UE</strong></li>
<li>Cosmétiques naturels <strong>France → Corée du Sud</strong></li>
<li>Textile éthique <strong>Maroc → Canada</strong></li>
<li>Composants électroniques <strong>Vietnam → Mexique</strong></li>
<li>Matériel médical reconditionné <strong>Allemagne → Afrique de l'Est</strong></li>
</ul>
<p>Chaque corridor s'ouvre sur un rapport complet : volumes, prix moyens, concurrents, marges estimées.</p>`,
          'Voir les 5 rapports',
          `${APP}/map`,
        ),
        body_text: 'Top 5 opportunités import-export cette semaine : ' + APP + '/map',
      },
      {
        order: 3,
        delay_hours: 48,
        subject: 'Comment préparer ton premier business plan IA',
        body_html: block(
          'Ton business plan IA, étape par étape',
          `<p>Un business plan Feel The Gap s'écrit en 4 étapes :</p>
<ol style="padding-left:20px;line-height:1.8">
<li><strong>Choisir un corridor</strong> (pays source × pays cible)</li>
<li><strong>Sélectionner un produit</strong> dans les niches recommandées</li>
<li><strong>Lancer la génération IA</strong> — on bâtit pour toi le dossier : marché, P&L, logistique, réglementaire</li>
<li><strong>Personnaliser</strong> — ajoute ta touche, exporte en PDF, envoie aux investisseurs</li>
</ol>
<p>La première génération est offerte aux comptes Explorer.</p>`,
          'Générer mon business plan',
          `${APP}/generate-studies`,
        ),
        body_text: 'Ton business plan IA en 4 étapes : ' + APP + '/generate-studies',
      },
      {
        order: 4,
        delay_hours: 96,
        subject: 'Ta mission : choisis 3 pays à explorer',
        body_html: block(
          'Choisis 3 pays, on fait le reste',
          `<p>Quatre jours que tu explores FTG. L'étape suivante : <strong>short-lister 3 pays</strong> qui te parlent — un pays source, deux pays cibles.</p>
<p>Dès que ta short-list est prête, notre agent Kurama te livre automatiquement :</p>
<ul style="padding-left:20px">
<li>Le rapport comparatif des 3 corridors</li>
<li>Les 10 produits les plus porteurs sur chacun</li>
<li>Un score d'opportunité chiffré 0 → 100</li>
</ul>
<p>Tu auras tout pour décider en moins d'une semaine.</p>`,
          'Choisir mes 3 pays',
          `${APP}/map`,
        ),
        body_text: 'Choisis 3 pays à explorer : ' + APP + '/map',
      },
    ],
  },
  {
    code: 'nurture',
    name: 'Nurture post-onboarding',
    description: 'Séquence de rétention 2 mois — succès clients, offre spéciale, vision 2026.',
    steps: [
      {
        order: 1,
        delay_hours: 336, // 14j
        subject: 'Les 3 entrepreneurs qui ont cartonné avec FTG',
        body_html: block(
          'Ils ont transformé la data en chiffre d\'affaires',
          `<p>Trois histoires vraies de la communauté Feel The Gap :</p>
<ul style="padding-left:20px;line-height:1.8">
<li><strong>Sami, 32 ans</strong> — a détecté un corridor <em>cacao bio Côte d'Ivoire → Japon</em> et signé son premier container en 6 semaines.</li>
<li><strong>Aïcha, 28 ans</strong> — a utilisé le business plan IA pour lever 80k€ sur une niche cosmétiques Maroc-Canada.</li>
<li><strong>David, 41 ans</strong> — reconversion export matériel médical, 3 clients récurrents en 4 mois.</li>
</ul>
<p>Point commun : ils ont commencé par la data, pas par l'intuition.</p>`,
          'Explorer les corridors',
          `${APP}/map`,
        ),
        body_text: 'Trois entrepreneurs FTG ont cartonné. Lis leur histoire : ' + APP,
      },
      {
        order: 2,
        delay_hours: 720, // 30j
        subject: 'Offre spéciale : -20% ton premier mois Premium',
        body_html: block(
          '-20% sur ton premier mois Premium',
          `<p>Tu nous suis depuis un mois. Il est temps de passer à la vitesse supérieure.</p>
<p>L'abonnement <strong>Premium</strong> débloque :</p>
<ul style="padding-left:20px">
<li>Business plans IA illimités</li>
<li>Rapports pays premium (chiffres douaniers temps réel)</li>
<li>Support prioritaire + 1 coaching mensuel</li>
</ul>
<p>Code promo valable 7 jours : <strong style="color:#C9A84C">FTG20</strong> — -20 % sur ton premier mois.</p>`,
          'Activer Premium -20 %',
          `${APP}/pricing?promo=FTG20`,
        ),
        body_text: 'Code FTG20 : -20% sur Premium premier mois. ' + APP + '/pricing',
      },
      {
        order: 3,
        delay_hours: 1440, // 60j
        subject: 'Pourquoi les Data importent plus que jamais en 2026',
        body_html: block(
          'La décennie de la data-driven global trade',
          `<p>En 2026, les flux commerciaux mondiaux se reconfigurent en temps réel : tensions géopolitiques, décarbonation, nearshoring. Les entrepreneurs qui gagnent ne sont pas les plus rapides — ce sont les mieux informés.</p>
<p>Feel The Gap existe pour ça : te donner l'avantage informationnel que seuls les grands groupes avaient jusqu'ici.</p>
<p>Continue d'explorer, continue de décider avec la data. On est là pour t'appuyer.</p>`,
          'Ouvrir la map mondiale',
          `${APP}/map`,
        ),
        body_text: 'La data importe plus que jamais en 2026. ' + APP,
      },
    ],
  },
]

async function main() {
  for (const seq of SEQUENCES) {
    await q(`insert into email_sequences (code, name, description, active)
      values ('${esc(seq.code)}', '${esc(seq.name)}', '${esc(seq.description)}', true)
      on conflict (code) do update set name = excluded.name, description = excluded.description, active = true`)
    const res = await q(`select id from email_sequences where code = '${esc(seq.code)}' limit 1`)
    const seqId = res?.[0]?.id
    if (!seqId) throw new Error('seq id missing for ' + seq.code)
    console.log(`[seq] ${seq.code} => ${seqId}`)

    for (const s of seq.steps) {
      await q(`insert into email_sequence_steps (sequence_id, step_order, delay_hours, subject, body_html, body_text, active)
        values ('${seqId}', ${s.order}, ${s.delay_hours}, '${esc(s.subject)}', '${esc(s.body_html)}', '${esc(s.body_text)}', true)
        on conflict (sequence_id, step_order) do update set
          delay_hours = excluded.delay_hours,
          subject = excluded.subject,
          body_html = excluded.body_html,
          body_text = excluded.body_text,
          active = true`)
      console.log(`  step ${s.order} · +${s.delay_hours}h · ${s.subject}`)
    }
  }
  console.log('\nDone.')
}

main().catch((e) => { console.error(e); process.exit(1) })
