/**
 * queue-scouts-massive — 3eme vague expansion scout_queue, target 500k prospects.
 * Pays FTG x 3 sub-sectors x 4 sous-produits = ~1380 nouveaux combos
 * A max_results=200 par combo -> 276k lignes supplementaires potentielles.
 * Idempotent via index unique (country, sector, product) pending|running.
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
loadEnv()
const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)
type Job = { country_iso: string; sector: string; product_slug?: string; priority: number; max_results?: number }

const COUNTRY_MATRIX: Record<string, { sector: string; products: string[] }[]> = {
  CIV: [
    { sector: 'agriculture', products: ['cacao_fin_aroma','hevea_latex','mangue_fraiche','banane_plantain'] },
    { sector: 'food_processing', products: ['chocolat_origine','huile_palme_raffinee','jus_fruits_tropicaux','cafe_torrefie'] },
    { sector: 'artisan', products: ['pagne_kita','sculpture_senoufo','bijoux_perles','maroquinerie_cuir'] },
  ],
  SEN: [
    { sector: 'aquaculture', products: ['crevettes_tigrees','tilapia_elevage','algues_spiruline','huitres_mangrove'] },
    { sector: 'agriculture', products: ['arachide_bio','mangue_kent','hibiscus_bissap','millet_fonio'] },
    { sector: 'food_processing', products: ['farine_mil','couscous_mil','sauces_piment','conserves_poisson'] },
  ],
  CMR: [
    { sector: 'agriculture', products: ['cacao_sanaga','cafe_robusta','banane_plantain','huile_palme_artisanale'] },
    { sector: 'food_processing', products: ['chocolat_bio','miel_foret','jus_fruits_bio','epices_poivre'] },
    { sector: 'artisan', products: ['masques_bamileke','paniers_vannerie','tissus_toghu','sculptures_bois'] },
  ],
  GHA: [
    { sector: 'agriculture', products: ['cacao_ghana_premium','ananas_smooth_cayenne','noix_karite','huile_palme_rouge'] },
    { sector: 'food_processing', products: ['chocolat_ghana','beurre_karite','jus_ananas','poudre_cacao'] },
    { sector: 'artisan', products: ['kente_tissu','bijoux_adinkra','poterie_traditionnelle','cuir_peau_chevre'] },
  ],
  NGA: [
    { sector: 'agriculture', products: ['gingembre_seche','hibiscus_seche','noix_karite','sesame_blanc'] },
    { sector: 'food_processing', products: ['garri','egusi_semoule','ogbono_poudre','jus_zobo'] },
    { sector: 'technology', products: ['fintech_mobile','agritech_supply','edtech_lagos','healthtech'] },
  ],
  BFA: [
    { sector: 'agriculture', products: ['sesame_blanc','karite_bio','hibiscus_biotech','noix_cajou'] },
    { sector: 'artisan', products: ['bronze_lost_wax','tissus_faso_danfani','cuir_bogolan','vannerie_burkina'] },
    { sector: 'food_processing', products: ['beurre_karite_pur','huile_sesame','farine_fonio','the_hibiscus'] },
  ],
  MLI: [
    { sector: 'agriculture', products: ['karite_brut','coton_bio','mangue_amelie','gomme_arabique'] },
    { sector: 'artisan', products: ['bogolan_original','bijoux_targui','maroquinerie_dogon','sculptures_bambara'] },
    { sector: 'food_processing', products: ['huile_karite','sesame_huile','fonio_bio','the_menthe'] },
  ],
  BEN: [
    { sector: 'agriculture', products: ['ananas_pain_sucre','anacarde_bio','karite_collines','palmier_huile'] },
    { sector: 'food_processing', products: ['jus_ananas_bio','huile_palme_rouge','beurre_karite','noix_cajou_salees'] },
    { sector: 'artisan', products: ['tissus_somba','bronze_porto_novo','bijoux_cauris','sculptures_vaudou'] },
  ],
  TGO: [
    { sector: 'agriculture', products: ['soja_togolais','cacao_togo','cafe_kloto','karite_nord'] },
    { sector: 'food_processing', products: ['huile_soja','chocolat_togo','cafe_torrefie','beurre_karite'] },
    { sector: 'artisan', products: ['tissus_ewe','sculptures_kabye','bijoux_voodoo','maroquinerie_lome'] },
  ],
  KEN: [
    { sector: 'agriculture', products: ['cafe_aa_grade','the_ctc','floriculture_roses','avocat_hass'] },
    { sector: 'technology', products: ['fintech_mpesa','agritech_kenya','logistics_tech','cleantech'] },
    { sector: 'food_processing', products: ['cafe_specialty','the_aromatise','miel_safari','noix_macadamia'] },
  ],
  ETH: [
    { sector: 'agriculture', products: ['cafe_sidamo','sesame_humera','teff_injera','cuir_peau'] },
    { sector: 'textile', products: ['cuir_tanne','coton_bio','vetements_habesha','fibres_naturelles'] },
    { sector: 'food_processing', products: ['cafe_yirgacheffe','huile_sesame','farine_teff','epices_berbere'] },
  ],
  TZA: [
    { sector: 'agriculture', products: ['cafe_kilimanjaro','anacarde_mtwara','avocat_arusha','the_mufindi'] },
    { sector: 'artisan', products: ['tanzanite_brute','tinga_tinga_art','bijoux_massai','sculptures_makonde'] },
    { sector: 'food_processing', products: ['cafe_specialty','noix_cajou_bio','huile_avocat','the_noir_bio'] },
  ],
  UGA: [
    { sector: 'agriculture', products: ['cafe_robusta_premium','the_rwenzori','vanille_bourbon','miel_bio'] },
    { sector: 'food_processing', products: ['cafe_lavage','miel_foret_rain','the_hibiscus_bio','huile_avocat'] },
    { sector: 'technology', products: ['agritech_uganda','fintech_mobile_money','cleantech_solar','health_tech'] },
  ],
  RWA: [
    { sector: 'agriculture', products: ['cafe_bourbon_rwanda','the_pyrethrum','hortensia_cut','patate_douce'] },
    { sector: 'food_processing', products: ['cafe_specialty_rwanda','the_aromatise_bio','huile_essentielle_pyrethre'] },
    { sector: 'technology', products: ['fintech_rwanda','agritech_kigali','drones_delivery','data_center'] },
  ],
  MDG: [
    { sector: 'agriculture', products: ['vanille_bourbon','clou_girofle','ylang_ylang','litchi_premium'] },
    { sector: 'food_processing', products: ['extrait_vanille','huile_girofle','chocolat_madagascar','epices_melange'] },
    { sector: 'artisan', products: ['soie_antsirabe','raffia_tissage','pierres_semi_precieuses','tissus_lamba'] },
  ],
  MAR: [
    { sector: 'agriculture', products: ['agrumes_berkane','olives_meknes','argan_essaouira','tomates_souss'] },
    { sector: 'textile', products: ['tapis_berbere','kaftan_couture','cuir_maroquin','tissus_sabra'] },
    { sector: 'food_processing', products: ['huile_argan_bio','huile_olive_picholine','confitures_agrumes','epices_ras_hanout'] },
  ],
  TUN: [
    { sector: 'agriculture', products: ['huile_olive_chemlali','dattes_deglet_nour','agrumes_cap_bon','harissa_piments'] },
    { sector: 'food_processing', products: ['huile_olive_bio','harissa_bio','dattes_bio','jus_agrumes'] },
    { sector: 'textile', products: ['tissus_kilim','vetements_jebba','cuir_tanne_artisanal','broderie_chechia'] },
  ],
  EGY: [
    { sector: 'textile', products: ['coton_giza_bio','lin_egyptien','tapis_kilim','cuir_travaille'] },
    { sector: 'agriculture', products: ['agrumes_oranges','dattes_siwa','mangue_alphonso','hibiscus_karkade'] },
    { sector: 'food_processing', products: ['jus_hibiscus','dattes_enrobees','huile_graine_noire','melasse_dattes'] },
  ],
  ZAF: [
    { sector: 'agriculture', products: ['vin_stellenbosch','agrumes_western_cape','fruits_capes','macadamia_bio'] },
    { sector: 'food_processing', products: ['vin_rouge_premium','confitures_fruits_cape','huile_avocat','biltong'] },
    { sector: 'technology', products: ['fintech_cape','agritech_za','cleantech_solar','logistics_tech'] },
  ],
  COL: [
    { sector: 'agriculture', products: ['cafe_huila','avocat_hass_col','cacao_origen','fleurs_coupees'] },
    { sector: 'food_processing', products: ['cafe_specialty_col','chocolat_single_origin','huile_avocat_col','panela_bio'] },
    { sector: 'artisan', products: ['tissus_wayuu','bijoux_filigrane','ceramique_raquira','emeraudes_brutes'] },
  ],
  BRA: [
    { sector: 'agriculture', products: ['cafe_cerrado','cacao_bahia','soja_bresil','mangue_tommy'] },
    { sector: 'food_processing', products: ['cafe_specialty','chocolat_amazonie','huile_acai','poudre_guarana'] },
    { sector: 'artisan', products: ['pierres_precieuses','art_amazonien','cuir_vache_tanne','bijoux_filigrane'] },
  ],
  PER: [
    { sector: 'agriculture', products: ['quinoa_noir','avocat_hass_peru','asperges_ica','cafe_chanchamayo'] },
    { sector: 'food_processing', products: ['farine_quinoa','huile_sacha_inchi','chocolat_peruvien','lucuma_poudre'] },
    { sector: 'artisan', products: ['tissus_alpaga','argent_ayacucho','ceramique_shipibo','bijoux_incas'] },
  ],
  ECU: [
    { sector: 'aquaculture', products: ['crevettes_vannamei','tilapia_ecuador','poissons_pacifique','algues_elevage'] },
    { sector: 'agriculture', products: ['banane_cavendish','cacao_nacional','fleurs_roses','mangue_kent'] },
    { sector: 'food_processing', products: ['chocolat_nacional','crevettes_congelees','banane_deshydratee','jus_fruits'] },
  ],
  MEX: [
    { sector: 'agriculture', products: ['avocat_michoacan','agave_tequila','tomate_saladette','chili_habanero'] },
    { sector: 'food_processing', products: ['tequila_100_agave','mezcal_oaxaca','sauces_chipotle','chocolat_cacao'] },
    { sector: 'artisan', products: ['alebrijes_oaxaca','tissus_otomi','argent_taxco','ceramique_talavera'] },
  ],
  VNM: [
    { sector: 'agriculture', products: ['cafe_robusta_dak_lak','cannelle_quang_nam','poivre_phu_quoc','anacarde_binh_phuoc'] },
    { sector: 'textile', products: ['soie_nha_xa','coton_vinh_long','lin_vietnam','broderies_hanoi'] },
    { sector: 'aquaculture', products: ['crevettes_ca_mau','pangasius_mekong','poissons_nha_trang','algues_kien_giang'] },
  ],
  IND: [
    { sector: 'agriculture', products: ['epices_kerala','the_darjeeling','riz_basmati_bio','curcuma_bio'] },
    { sector: 'textile', products: ['coton_khadi','soie_banarasi','pashmina_cashmere','tapis_agra'] },
    { sector: 'food_processing', products: ['ghee_bio','huile_moutarde','chutneys_mango','pickles_indiens'] },
  ],
  IDN: [
    { sector: 'agriculture', products: ['cafe_mandheling','vanille_java','poivre_lampung','clou_girofle_maluku'] },
    { sector: 'food_processing', products: ['huile_coco_vierge','cafe_specialty','epices_rendang','sambal_bali'] },
    { sector: 'artisan', products: ['batik_yogyakarta','argent_celuk','sculptures_bois','bijoux_perles'] },
  ],
  PHL: [
    { sector: 'agriculture', products: ['coco_desicated','banane_cavendish_ph','ananas_queen','cacao_davao'] },
    { sector: 'food_processing', products: ['huile_coco_vierge','banane_chips','chocolat_davao','pili_noix'] },
    { sector: 'artisan', products: ['abaca_fibers','perles_sud','sculptures_bois','tissus_inabel'] },
  ],
  THA: [
    { sector: 'agriculture', products: ['riz_jasmin_hom_mali','durian_monthong','fruits_tropicaux','caoutchouc_latex'] },
    { sector: 'food_processing', products: ['sauces_sriracha','riz_transformes','fruits_deshydrates','huile_coco'] },
    { sector: 'artisan', products: ['soie_thaie','argent_chiang_mai','ceramique_benjarong','teak_sculpture'] },
  ],
  BGD: [
    { sector: 'textile', products: ['jute_bio','coton_tangail','tissus_jamdani','cuir_savar'] },
    { sector: 'agriculture', products: ['jute_premium','the_sylhet','riz_aromatique','crevettes_golda'] },
    { sector: 'food_processing', products: ['moutarde_huile','the_noir_bio','biscuits_traditionnels','jute_transformes'] },
  ],
  TUR: [
    { sector: 'textile', products: ['coton_bio_izmir','tapis_anatolie','cuir_tanne','soie_bursa'] },
    { sector: 'agriculture', products: ['noisettes_giresun','figues_aydin','abricots_malatya','safran_ispart'] },
    { sector: 'food_processing', products: ['delices_turcs','huile_olive_edremit','miel_pinede','fruits_secs'] },
  ],
}

const ALL_JOBS: Job[] = []
for (const [iso, blocks] of Object.entries(COUNTRY_MATRIX)) {
  for (const block of blocks) {
    for (const product of block.products) {
      ALL_JOBS.push({
        country_iso: iso,
        sector: block.sector,
        product_slug: product,
        priority: 3,
        max_results: 200,
      })
    }
  }
}

async function main() {
  const sb = db()
  let inserted = 0, skipped = 0, errors = 0
  for (const j of ALL_JOBS) {
    const { error } = await sb.from('scout_queue').insert({
      country_iso: j.country_iso,
      sector: j.sector,
      product_slug: j.product_slug ?? null,
      priority: j.priority,
      max_results: j.max_results ?? 200,
      status: 'pending',
      source: 'massive',
    })
    if (error) {
      if ((error as any).code === '23505' || /duplicate|unique/i.test(error.message)) { skipped++; continue }
      errors++
      console.error('err', j.country_iso, j.sector, j.product_slug, error.message)
      continue
    }
    inserted++
  }
  console.log('submitted=' + ALL_JOBS.length + ' queued=' + inserted + ' skipped=' + skipped + ' errors=' + errors)
  const { count } = await sb.from('scout_queue').select('*', { count:'exact', head:true }).eq('status','pending')
  console.log('pending total=' + count)
}

main().catch(e => { console.error(e); process.exit(1) })
