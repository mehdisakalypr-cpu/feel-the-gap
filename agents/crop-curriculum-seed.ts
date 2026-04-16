/**
 * crop-curriculum-seed.ts — template-based content (no LLM).
 * Generates 6 steps + 3 quiz per (crop × mode) instantly.
 * Content is pragmatic, realistic, and can be enriched with LLM later.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type Step = { title: string; text_md: string; duration_minutes: number }
type Quiz = { question: string; choices: string[]; correct_idx: number; explanation: string }

function terrainSteps(crop: string, family: string): Step[] {
  return [
    {
      title: `1. Préparer le sol pour ${crop}`,
      text_md: `Retourne la terre sur 25-30 cm avec une charrue ou houe. Élimine les mauvaises herbes et les cailloux. Ajoute 20 à 30 tonnes/hectare de compost bien mûr ou de fumier de bovins. Laisse reposer 2 semaines avant semis. Sol idéal : pH 6,0-7,0, texture limoneuse, bonne rétention d'eau mais drainant. Pour les ${family}, veille à l'absence de maladies résiduelles de la saison précédente (rotation obligatoire). Teste l'humidité en enfonçant la main : la terre doit se rassembler sans goutter.`,
      duration_minutes: 15,
    },
    {
      title: `2. Choisir les semences et les traiter`,
      text_md: `Privilégie des semences certifiées ou issues de récolte propre. Évite les variétés OGM (marché local). Traite en pré-semis avec une solution d'ail + piment ou un biofongicide naturel (Trichoderma). Compte 8-15 kg de semences/hectare selon ${crop}. Pour les variétés locales, demande l'avis des anciens : rendement parfois plus bas mais résistance accrue. Stocke au sec à l'abri de la lumière.`,
      duration_minutes: 10,
    },
    {
      title: `3. Semis et plantation`,
      text_md: `Sème directement au sol après la première pluie utile (≥15 mm). Espacement recommandé pour ${crop} : 20-40 cm entre rangs selon densité cible. Profondeur : 2-5 cm. Couvre légèrement et tasse. Au bout de 5-10 jours, vérifie la levée : si moins de 70% de germination, resème les zones nues. Marche pieds-nus ou en bottes propres dans les rangées pour éviter de transporter des maladies.`,
      duration_minutes: 20,
    },
    {
      title: `4. Irrigation et fertilisation en cycle`,
      text_md: `Irrigation au goutte-à-goutte si possible (économie 40% vs gravitaire). Sinon aspersion matin ou soir. Apport de fumier tous les 30 jours, en couronne autour des plants. En cas de jaunissement : diagnostic rapide (carence azote vs maladie). Surveille l'humidité : le doigt enfoncé de 5 cm doit ressortir légèrement humide. Surveille les précipitations locales via la radio agricole ou l'appli météo.`,
      duration_minutes: 15,
    },
    {
      title: `5. Protection sanitaire naturelle`,
      text_md: `Inspecte les plants 2 fois par semaine. Face aux ravageurs : pulvérisation ail+piment+savon noir (100g/100g/20g dans 10L). Face aux champignons : décoction de prêle ou soufre micronisé. Attire les auxiliaires (coccinelles, syrphes) avec bandes fleuries autour de la parcelle. Éloigne-toi totalement des pesticides de synthèse : tu perdrais la certification bio et la confiance des acheteurs locaux.`,
      duration_minutes: 20,
    },
    {
      title: `6. Récolte, séchage et vente`,
      text_md: `Récolte aux bons indicateurs (couleur, fermeté, jours après semis pour ${crop}). Récolte tôt le matin avant la chaleur. Sépare les produits abîmés des produits premium (tri qualité). Sèche à l'ombre sur claies surélevées 3-7 jours selon produit. Stockage en sacs jute ou caisses ajourées. Vente : contacte tes acheteurs 48h avant récolte pour garantir l'écoulement. Négocie un prix plancher avant la mise en champ.`,
      duration_minutes: 25,
    },
  ]
}

function serreSteps(crop: string, family: string): Step[] {
  return [
    {
      title: `1. Installer et préparer la serre`,
      text_md: `Structure métallique ou bambou + film polyéthylène UV 200 microns. Orientation Nord-Sud pour exposition équilibrée. Ventilation latérale obligatoire (28-35°C max pour ${family}). Sol préparé : tranchées ou substrat hors-sol (coco + perlite). pH ajusté à 6,0-6,5. Système d'irrigation goutte-à-goutte avec minuterie. Thermomètre min-max + hygromètre visibles depuis l'extérieur.`,
      duration_minutes: 60,
    },
    {
      title: `2. Sélection de semences F1 haute performance`,
      text_md: `En serre, investis dans des hybrides F1 à haut rendement (2-3× le rendement plein champ). Variétés recommandées pour ${crop} : adaptées aux serres tropicales, résistance aux nématodes. Coût semences : 3-8× plus cher mais ROI 5× supérieur. Germination préalable en plateaux alvéolés (4-6 semaines avant plantation).`,
      duration_minutes: 10,
    },
    {
      title: `3. Plantation et palissage`,
      text_md: `Transplante les plants après 4-6 vraies feuilles. Espacement serré (40-60 cm) vu le volume d'air contrôlé. Palissage vertical pour gagner en densité (tomates, piments, haricots). Tuteurs bambou ou ficelle fixée au faîtage. Arrose copieusement le jour de la transplantation, puis réduis progressivement.`,
      duration_minutes: 30,
    },
    {
      title: `4. Fertigation et conduite climatique`,
      text_md: `Solution nutritive EC 1,5-2,5 selon stade. Azote en phase végétative, potassium en phase fruiting. Température jour 25-30°C, nuit 18-22°C. Humidité 60-80%. Utilise la ventilation + ombrière 30% en saison chaude. Contrôle quotidien en fin de matinée. Enregistre les valeurs sur un carnet ou une appli pour analyser les tendances.`,
      duration_minutes: 15,
    },
    {
      title: `5. Protection intégrée (IPM)`,
      text_md: `Lutte biologique : lâchers d'auxiliaires (Phytoseiulus contre tétranyques, Encarsia contre aleurodes). Pièges chromatiques jaunes pour détection précoce. Désinfection entre cycles (vapeur ou solarisation 30 jours). Zéro insecticide large spectre : tu casses l'équilibre biologique. Hygiène stricte : lave-mains à l'entrée, combinaison dédiée.`,
      duration_minutes: 20,
    },
    {
      title: `6. Récolte continue et commercialisation premium`,
      text_md: `En serre, récolte 2-3×/semaine (production étalée). Tri qualité stricte : calibre + absence de défauts. Emballage dès la récolte (barquettes ou caisses propres). Commercialise au prix premium auprès des hôtels, supermarchés urbains, ou export. Marge 2-3× le plein champ. Traçabilité essentielle : note date/parcelle sur chaque lot.`,
      duration_minutes: 30,
    },
  ]
}

function defaultQuiz(crop: string): Quiz[] {
  return [
    {
      question: `Quel est le meilleur moment pour semer ${crop} en plein champ ?`,
      choices: [
        'Dès le début de la saison sèche',
        'Après la première pluie utile (≥15 mm)',
        'En plein milieu de journée pour maximum de lumière',
        'À la pleine lune',
      ],
      correct_idx: 1,
      explanation: 'La première pluie utile humidifie le sol en profondeur et déclenche la germination dans les meilleures conditions.',
    },
    {
      question: `Pourquoi pratiquer la rotation des cultures ?`,
      choices: [
        'Pour changer de paysage',
        'Pour casser le cycle des maladies et ravageurs et équilibrer la nutrition du sol',
        'Parce que la loi l\'impose',
        'Pour tromper les acheteurs',
      ],
      correct_idx: 1,
      explanation: 'La rotation est une pratique millénaire qui brise les cycles pathogènes et équilibre l\'extraction/restitution des nutriments.',
    },
    {
      question: `En cas de jaunissement des feuilles, que fais-tu EN PREMIER ?`,
      choices: [
        'Je pulvérise un pesticide',
        'Je récolte tout immédiatement',
        'Je diagnostique : carence en azote vs maladie fongique vs excès d\'eau',
        'Je laisse tomber la parcelle',
      ],
      correct_idx: 2,
      explanation: 'Un diagnostic précis évite un traitement inutile ou contre-productif. Un jaunissement homogène = carence, un jaunissement par taches = maladie.',
    },
  ]
}

const ECO = {
  terrain: { yield_kg_ha: 8000,  cost_eur_ha: 1200, roi_pct: 140, water_need_m3_ha: 4500 },
  serre:   { yield_kg_ha: 45000, cost_eur_ha: 8000, roi_pct: 210, water_need_m3_ha: 2200 },
}

async function main() {
  const { data: modes } = await sb
    .from('crop_tutorial_modes')
    .select('id, mode, tutorial_id, crop_tutorials!inner(slug, crop_name_fr, family)')
  if (!modes?.length) { console.log('No modes'); return }

  let built = 0, skipped = 0
  for (const m of modes as unknown as Array<{ id: string; mode: 'terrain' | 'serre'; crop_tutorials: { slug: string; crop_name_fr: string; family: string } }>) {
    const { count } = await sb.from('crop_tutorial_steps').select('*', { count: 'exact', head: true }).eq('mode_id', m.id)
    if ((count ?? 0) > 0) { skipped++; continue }

    const crop = m.crop_tutorials.crop_name_fr
    const family = m.crop_tutorials.family
    const steps = m.mode === 'terrain' ? terrainSteps(crop, family) : serreSteps(crop, family)
    const quizzes = defaultQuiz(crop)
    const eco = ECO[m.mode]

    await sb.from('crop_tutorial_modes').update({
      yield_kg_ha: eco.yield_kg_ha,
      cost_eur_ha: eco.cost_eur_ha,
      roi_pct: eco.roi_pct,
      water_need_m3_ha: eco.water_need_m3_ha,
      description_md: m.mode === 'terrain'
        ? `Culture en plein champ naturel — non irriguée prioritairement, sol vivant, rotation obligatoire. Adaptée aux climats soudanien/tropical, ${crop} donne ici son meilleur rapport qualité/coût de production.`
        : `Culture sous serre ou tunnel — contrôle climat, densité multipliée, rendements x5 vs plein champ mais investissement initial plus élevé. Idéal pour marchés premium et export.`,
    }).eq('id', m.id)

    await sb.from('crop_tutorial_steps').insert(
      steps.map((s, i) => ({
        mode_id: m.id,
        step_order: i + 1,
        title: s.title,
        text_md: s.text_md,
        duration_minutes: s.duration_minutes,
      })),
    )
    await sb.from('crop_tutorial_quizzes').insert(
      quizzes.map((q, i) => ({
        mode_id: m.id,
        question: q.question,
        choices: q.choices,
        correct_idx: q.correct_idx,
        explanation: q.explanation,
        display_order: i,
      })),
    )
    built++
    console.log(`  ✅ ${crop}/${m.mode} — ${steps.length} steps + ${quizzes.length} quiz`)
  }
  console.log(`\n${built} built, ${skipped} skipped.`)
}

main().catch(e => { console.error(e); process.exit(1) })
