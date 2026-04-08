'use client'

import { useState } from 'react'
import { useLang } from '@/components/LanguageProvider'
import type { TradeCategory } from '@/types/database'

const CATEGORIES: { id: TradeCategory | 'all'; label: string; label_fr: string; icon: string; color: string }[] = [
  { id: 'all',          label: 'All Markets',  label_fr: 'Tous les marchés',    icon: '🌐', color: '#C9A84C' },
  { id: 'agriculture',  label: 'Agri & Food',  label_fr: 'Agri & Alimentation', icon: '🌾', color: '#22C55E' },
  { id: 'energy',       label: 'Energy',       label_fr: 'Énergie',             icon: '⚡', color: '#F59E0B' },
  { id: 'materials',    label: 'Materials',    label_fr: 'Matériaux',            icon: '🪨', color: '#94A3B8' },
  { id: 'manufactured', label: 'Industrial',   label_fr: 'Industriel',           icon: '🏭', color: '#60A5FA' },
  { id: 'resources',    label: 'Resources',    label_fr: 'Ressources',           icon: '💧', color: '#38BDF8' },
]

interface Variant { id: string; label: string; label_fr?: string; note?: string }
interface SubItem  { id: string; label: string; label_fr?: string; unit?: string; variants?: Variant[] }
interface SubGroup { group: string; group_fr?: string; items: SubItem[] }

function L(item: { label: string; label_fr?: string }, lang: string): string {
  return lang === 'fr' ? (item.label_fr ?? item.label) : item.label
}
function G(group: SubGroup, lang: string): string {
  return lang === 'fr' ? (group.group_fr ?? group.group) : group.group
}


const SUBCATEGORIES: Record<string, SubGroup[]> = {

  // ── AGRICULTURE & FOOD ─────────────────────────────────────────────────
  agriculture: [
    {
      group: 'Cereals & Grains', group_fr: 'Céréales & Grains',
      items: [
        { id: 'wheat', label: 'Wheat', label_fr: 'Blé', unit: '$/t', variants: [
          { id: 'wheat_hrw',   label: 'Hard Red Winter (HRW)',  label_fr: 'Hard Red Winter (HRW)',  note: 'Bread wheat — Kansas/Okla.' },
          { id: 'wheat_hrs',   label: 'Hard Red Spring (HRS)',  label_fr: 'Hard Red Spring (HRS)',  note: 'High protein — Dakotas' },
          { id: 'wheat_srw',   label: 'Soft Red Winter (SRW)',  label_fr: 'Soft Red Winter (SRW)',  note: 'Cake/pastry — Midwest' },
          { id: 'wheat_durum', label: 'Durum Wheat',            label_fr: 'Blé dur',                note: 'Pasta & semolina' },
          { id: 'wheat_white', label: 'White Wheat',            label_fr: 'Blé blanc',              note: 'Noodles & flatbreads' },
          { id: 'wheat_feed',  label: 'Feed Wheat',             label_fr: 'Blé fourrager',          note: 'Animal feed grade' },
        ]},
        { id: 'corn', label: 'Corn / Maize', label_fr: 'Maïs', unit: '$/bu', variants: [
          { id: 'corn_yellow', label: 'Yellow Corn No. 2', label_fr: 'Maïs jaune No. 2', note: 'CBOT benchmark' },
          { id: 'corn_white',  label: 'White Corn',        label_fr: 'Maïs blanc',        note: 'Human consumption' },
          { id: 'corn_waxy',   label: 'Waxy Maize',        label_fr: 'Maïs cireux',       note: 'High amylopectin starch' },
          { id: 'corn_feed',   label: 'Feed Grade Corn',   label_fr: 'Maïs fourrager',    note: 'Livestock' },
        ]},
        { id: 'rice', label: 'Rice', label_fr: 'Riz', unit: '$/t', variants: [
          { id: 'rice_white',     label: 'White Rice (25% broken)', label_fr: 'Riz blanc (25% brisures)', note: 'Thai reference price' },
          { id: 'rice_parboiled', label: 'Parboiled Rice',          label_fr: 'Riz étuvé',                 note: 'West Africa staple' },
          { id: 'rice_jasmine',   label: 'Jasmine / Fragrant',      label_fr: 'Jasmin / Parfumé',          note: 'Premium — Thailand' },
          { id: 'rice_basmati',   label: 'Basmati Rice',            label_fr: 'Riz basmati',               note: 'Premium — India/Pak' },
          { id: 'rice_broken',    label: 'Broken Rice (100%)',      label_fr: 'Brisures de riz (100%)',    note: 'Feed / ethanol' },
          { id: 'rice_brown',     label: 'Brown Rice',              label_fr: 'Riz complet',               note: 'Whole grain, hull removed' },
        ]},
        { id: 'barley', label: 'Barley', label_fr: 'Orge', unit: '$/t', variants: [
          { id: 'barley_malting', label: 'Malting Barley', label_fr: 'Orge de brasserie', note: 'Beer & whisky' },
          { id: 'barley_feed',    label: 'Feed Barley',    label_fr: 'Orge fourragère',   note: 'Livestock' },
        ]},
        { id: 'sorghum', label: 'Sorghum', label_fr: 'Sorgho',  unit: '$/t' },
        { id: 'oats',    label: 'Oats',    label_fr: 'Avoine',  unit: '$/bu' },
        { id: 'millet',  label: 'Millet',  label_fr: 'Millet',  unit: '$/t' },
      ],
    },
    {
      group: 'Flours & Starches', group_fr: 'Farines & Amidons',
      items: [
        { id: 'wheat_flour', label: 'Wheat Flour', label_fr: 'Farine de blé', unit: '$/t', variants: [
          { id: 'flour_t45',     label: 'T45 (Pastry / Extra fine)', label_fr: 'T45 (Pâtisserie / Extra fine)', note: 'Croissants, viennoiseries' },
          { id: 'flour_t55',     label: 'T55 (All-purpose)',         label_fr: 'T55 (Tous usages)',              note: 'Most common — baguettes' },
          { id: 'flour_t65',     label: 'T65 (Bread flour)',         label_fr: 'T65 (Farine à pain)',            note: 'Traditional breads' },
          { id: 'flour_t80',     label: 'T80 (Semi-wholemeal)',      label_fr: 'T80 (Semi-complète)',            note: 'Country loaves' },
          { id: 'flour_t150',    label: 'T150 (Whole wheat)',        label_fr: 'T150 (Complète)',                note: 'Stone ground' },
          { id: 'flour_hl',      label: 'High-Gluten (>13% protein)',label_fr: 'Haut gluten (>13% protéine)',    note: 'Pizza, bagels' },
          { id: 'flour_semolina',label: 'Durum Semolina',            label_fr: 'Semoule de blé dur',             note: 'Pasta & couscous' },
        ]},
        { id: 'corn_flour', label: 'Corn / Maize Flour', label_fr: 'Farine de maïs', unit: '$/t', variants: [
          { id: 'cornflour_fine',  label: 'Fine Cornflour / Maizena', label_fr: 'Farine de maïs fine / Maïzena', note: 'Thickener / starch' },
          { id: 'cornmeal_coarse', label: 'Coarse Cornmeal',          label_fr: 'Semoule de maïs grossière',     note: 'Polenta / ugali' },
          { id: 'masa_harina',     label: 'Masa Harina',              label_fr: 'Masa Harina',                    note: 'Nixtamalized — tortillas' },
          { id: 'cornstarch',      label: 'Corn Starch',              label_fr: 'Amidon de maïs',                 note: 'Industrial / food grade' },
        ]},
        { id: 'rice_flour', label: 'Rice Flour', label_fr: 'Farine de riz', unit: '$/t', variants: [
          { id: 'rice_flour_white', label: 'White Rice Flour',  label_fr: 'Farine de riz blanc', note: 'Gluten-free baking' },
          { id: 'rice_starch',      label: 'Rice Starch',       label_fr: 'Amidon de riz',       note: 'Baby food / cosmetics' },
        ]},
        { id: 'cassava_flour', label: 'Cassava / Tapioca', label_fr: 'Manioc / Tapioca', unit: '$/t', variants: [
          { id: 'cassava_native',  label: 'Cassava Flour (native)', label_fr: 'Farine de manioc (native)', note: 'West/Central Africa staple' },
          { id: 'tapioca_starch',  label: 'Tapioca Starch',        label_fr: 'Amidon de tapioca',          note: 'Thailand export leader' },
          { id: 'tapioca_pearls',  label: 'Tapioca Pearls',        label_fr: 'Perles de tapioca',          note: 'Bubble tea / puddings' },
        ]},
        { id: 'specialty_flour', label: 'Specialty Flours', label_fr: 'Farines spéciales', unit: '$/kg', variants: [
          { id: 'flour_chickpea', label: 'Chickpea Flour / Besan', label_fr: 'Farine de pois chiche / Besan', note: 'South Asia & ME' },
          { id: 'flour_sorghum',  label: 'Sorghum Flour',          label_fr: 'Farine de sorgho',              note: 'W. Africa / gluten-free' },
          { id: 'flour_teff',     label: 'Teff Flour',             label_fr: 'Farine de teff',                note: 'Ethiopia — injera bread' },
          { id: 'flour_almond',   label: 'Almond Flour',           label_fr: 'Farine d\'amande',              note: 'Premium / keto' },
          { id: 'flour_coconut',  label: 'Coconut Flour',          label_fr: 'Farine de coco',                note: 'SE Asia / gluten-free' },
          { id: 'flour_oat',      label: 'Oat Flour',              label_fr: 'Farine d\'avoine',              note: 'Breakfast / health food' },
          { id: 'flour_potato',   label: 'Potato Starch',          label_fr: 'Fécule de pomme de terre',      note: 'Thickener / industry' },
        ]},
      ],
    },
    {
      group: 'Dairy & Milk Products', group_fr: 'Produits laitiers & Œufs',
      items: [
        { id: 'milk_liquid', label: 'Liquid Milk', label_fr: 'Lait liquide', unit: '$/L', variants: [
          { id: 'milk_uht_whole',   label: 'UHT Whole Milk (3.5%)',      label_fr: 'Lait UHT entier (3,5%)',       note: 'Long-life — 6 months shelf' },
          { id: 'milk_uht_semi',    label: 'UHT Semi-Skimmed (1.5%)',    label_fr: 'Lait UHT demi-écrémé (1,5%)', note: 'EU export standard' },
          { id: 'milk_uht_skim',    label: 'UHT Skimmed (0.1%)',         label_fr: 'Lait UHT écrémé (0,1%)',      note: 'Diet / fortified' },
          { id: 'milk_pasteurized', label: 'Pasteurized Fresh Milk',     label_fr: 'Lait frais pasteurisé',        note: 'Short shelf-life chilled' },
          { id: 'milk_evaporated',  label: 'Evaporated Milk (canned)',   label_fr: 'Lait évaporé (en boîte)',      note: 'W. Africa / Asia staple' },
          { id: 'milk_condensed',   label: 'Sweetened Condensed Milk',   label_fr: 'Lait concentré sucré',         note: 'Southeast Asia favourite' },
          { id: 'milk_flavoured',   label: 'Flavoured Milk (choc/straw)',label_fr: 'Lait aromatisé (choc/fraise)', note: 'Children / emerging markets' },
        ]},
        { id: 'milk_powder', label: 'Milk Powders', label_fr: 'Lait en poudre', unit: '$/t', variants: [
          { id: 'smp',           label: 'Skim Milk Powder (SMP)',         label_fr: 'Lait écrémé en poudre (SMP)',     note: 'GDT benchmark 25kg bags' },
          { id: 'wmp',           label: 'Whole Milk Powder (WMP)',        label_fr: 'Lait entier en poudre (WMP)',     note: 'GDT benchmark' },
          { id: 'infant_stage1', label: 'Infant Formula Stage 1 (0-6M)', label_fr: 'Lait infantile 1er âge (0-6M)',   note: 'High-value, strict spec' },
          { id: 'infant_stage2', label: 'Follow-On Formula (6-12M)',      label_fr: 'Lait de suite (6-12M)',           note: 'Stage 2' },
          { id: 'infant_stage3', label: 'Growing-Up Milk (1-3 yrs)',      label_fr: 'Lait de croissance (1-3 ans)',    note: 'Stage 3' },
          { id: 'amf',           label: 'Anhydrous Milk Fat (AMF)',       label_fr: 'Matière grasse laitière anhydre', note: '99.8% fat' },
        ]},
        { id: 'butter_cream', label: 'Butter & Cream', label_fr: 'Beurre & Crème', unit: '$/t', variants: [
          { id: 'butter_82',    label: 'Unsalted Butter (82% fat)', label_fr: 'Beurre doux (82% MG)',        note: 'LIFFE / NZX benchmark' },
          { id: 'butter_84',    label: 'High-Fat Butter (84%)',     label_fr: 'Beurre concentré (84%)',      note: 'Professional baking' },
          { id: 'butter_salted',label: 'Salted Butter',             label_fr: 'Beurre salé',                 note: 'Consumer pack' },
          { id: 'cream_heavy',  label: 'Heavy Cream (35%+)',        label_fr: 'Crème épaisse (35%+)',        note: 'UHT / chilled' },
        ]},
        { id: 'cheese', label: 'Cheese', label_fr: 'Fromage', unit: '$/t', variants: [
          { id: 'cheddar',      label: 'Cheddar',          label_fr: 'Cheddar',            note: 'NZX / CME reference' },
          { id: 'gouda',        label: 'Gouda / Edam',     label_fr: 'Gouda / Edam',       note: 'Netherlands export' },
          { id: 'mozzarella',   label: 'Mozzarella',       label_fr: 'Mozzarella',         note: 'Pizza grade — block / shred' },
          { id: 'parmesan',     label: 'Parmesan / Grana', label_fr: 'Parmesan / Grana',   note: 'Italy — DOP premium' },
          { id: 'feta',         label: 'Feta',             label_fr: 'Feta',               note: 'Greece — PDO brine' },
          { id: 'processed_ch', label: 'Processed Cheese', label_fr: 'Fromage fondu',      note: 'Slices / spread — EM favourite' },
        ]},
        { id: 'whey_proteins', label: 'Whey & Proteins', label_fr: 'Lactosérum & Protéines', unit: '$/t', variants: [
          { id: 'whey_sweet', label: 'Sweet Whey Powder',            label_fr: 'Poudre de lactosérum doux',       note: 'Animal feed / food ingredient' },
          { id: 'wpc_35',     label: 'Whey Protein Conc. 35%',      label_fr: 'Conc. protéines lactosérum 35%', note: 'Bakery / dairy drinks' },
          { id: 'wpc_80',     label: 'Whey Protein Conc. 80%',      label_fr: 'Conc. protéines lactosérum 80%', note: 'Sports nutrition' },
          { id: 'wpi',        label: 'Whey Protein Isolate (90%+)', label_fr: 'Isolat protéines (90%+)',        note: 'Premium sports / medical' },
          { id: 'casein',     label: 'Casein (micellar / acid)',     label_fr: 'Caséine (micellaire / acide)',   note: 'Cheese analogue / protein' },
          { id: 'lactose',    label: 'Lactose',                      label_fr: 'Lactose',                        note: 'Pharma / infant formula' },
        ]},
        { id: 'yogurt_ice', label: 'Yogurt & Ice Cream', label_fr: 'Yaourt & Glaces', unit: '$/kg', variants: [
          { id: 'yogurt_plain', label: 'Plain Yogurt (full / low-fat)', label_fr: 'Yaourt nature (entier / allégé)', note: 'Set or stirred' },
          { id: 'yogurt_greek', label: 'Greek Yogurt (strained)',        label_fr: 'Yaourt grec (égoutté)',           note: '10%+ protein' },
          { id: 'kefir',        label: 'Kefir',                          label_fr: 'Kéfir',                           note: 'Probiotic fermented milk' },
          { id: 'ice_cream',    label: 'Ice Cream',                      label_fr: 'Crème glacée',                    note: '>=10% milk fat' },
        ]},
      ],
    },
    {
      group: 'Meat by Type & Cut', group_fr: 'Viandes & Produits de la mer',
      items: [
        { id: 'beef', label: 'Beef', label_fr: 'Bœuf', unit: 'c/lb', variants: [
          { id: 'beef_live',       label: 'Live Cattle (CME)',        label_fr: 'Bétail vif (CME)',             note: '1,000-1,200 lb feeder' },
          { id: 'beef_90cl',       label: 'Boneless Beef 90CL',       label_fr: 'Bœuf désossé 90CL',           note: 'Export trim — FOB' },
          { id: 'beef_chuck',      label: 'Chuck (shoulder)',         label_fr: 'Paleron (épaule)',             note: 'Ground beef / stew' },
          { id: 'beef_loin',       label: 'Loin / Sirloin',          label_fr: 'Faux-filet / Aloyau',         note: 'Grilling / premium' },
          { id: 'beef_tenderloin', label: 'Tenderloin / Fillet',     label_fr: 'Filet mignon',                note: 'Top value cut' },
          { id: 'beef_ribs',       label: 'Short Ribs / Back Ribs',  label_fr: 'Côtes courtes / Plat de côtes', note: 'BBQ / foodservice' },
          { id: 'beef_brisket',    label: 'Brisket',                 label_fr: 'Poitrine de bœuf',            note: 'BBQ — smoked' },
          { id: 'beef_offal',      label: 'Beef Offal (liver/tripe)', label_fr: 'Abats de bœuf (foie/tripes)', note: 'High demand in Africa/Asia' },
          { id: 'beef_halal',      label: 'Halal Beef',              label_fr: 'Bœuf halal',                  note: 'ME / SE Asia premium' },
        ]},
        { id: 'poultry', label: 'Poultry', label_fr: 'Poulet / Volaille', unit: '$/kg', variants: [
          { id: 'chicken_whole',   label: 'Whole Chicken',            label_fr: 'Poulet entier',               note: 'Ready-to-cook' },
          { id: 'chicken_legs',    label: 'Leg Quarters',             label_fr: 'Cuisses de poulet',           note: 'Export — frozen FOB' },
          { id: 'chicken_breast',  label: 'Breast Meat (boneless)',   label_fr: 'Filet de poulet (désossé)',   note: 'Premium cut' },
          { id: 'chicken_wings',   label: 'Chicken Wings',            label_fr: 'Ailes de poulet',             note: 'High demand Asia / US' },
          { id: 'chicken_halal',   label: 'Halal Chicken',            label_fr: 'Poulet halal',                note: 'Brazil / Malaysia export' },
          { id: 'turkey',          label: 'Turkey',                   label_fr: 'Dinde',                       note: 'Whole / breast / cold cuts' },
          { id: 'duck',            label: 'Duck',                     label_fr: 'Canard',                      note: 'Whole / breast — Asia premium' },
          { id: 'chicken_nuggets', label: 'Processed Poultry',        label_fr: 'Volaille transformée',        note: 'Breaded / value-added' },
        ]},
        { id: 'pork', label: 'Pork', label_fr: 'Porc', unit: 'c/lb', variants: [
          { id: 'pork_lean_hogs', label: 'Lean Hogs (CME)',    label_fr: 'Porcs maigres (CME)',     note: 'Futures benchmark' },
          { id: 'pork_loin',      label: 'Pork Loin',          label_fr: 'Longe de porc',           note: 'Chops / roast' },
          { id: 'pork_belly',     label: 'Pork Belly',         label_fr: 'Poitrine de porc',        note: 'Bacon / Asian cuisine' },
          { id: 'pork_shoulder',  label: 'Pork Shoulder',      label_fr: 'Épaule de porc',          note: 'Pulled pork / stew' },
          { id: 'pork_ham',       label: 'Ham (fresh / cured)',label_fr: 'Jambon (frais / fumé)',    note: 'Retail / deli' },
          { id: 'pork_offal',     label: 'Pork Offal & Trotters', label_fr: 'Abats & pieds de porc', note: 'Asia & W. Africa demand' },
          { id: 'bacon',          label: 'Bacon (streaky / back)', label_fr: 'Lard / Bacon',          note: 'Processed meat' },
        ]},
        { id: 'lamb', label: 'Lamb & Mutton', label_fr: 'Agneau & Mouton', unit: '$/kg', variants: [
          { id: 'lamb_whole',   label: 'Whole Lamb / Carcass', label_fr: 'Agneau entier / Carcasse', note: 'Halal — NZ/Australia FOB' },
          { id: 'lamb_leg',     label: 'Leg of Lamb',          label_fr: 'Gigot d\'agneau',          note: 'Premium retail cut' },
          { id: 'lamb_rack',    label: 'Rack of Lamb',         label_fr: 'Carré d\'agneau',          note: 'Restaurant premium' },
          { id: 'lamb_chops',   label: 'Loin Chops',           label_fr: 'Côtelettes',               note: 'Grilling' },
          { id: 'mutton',       label: 'Mutton (>2 yrs)',      label_fr: 'Mouton (>2 ans)',          note: 'ME / S. Asia demand' },
          { id: 'lamb_halal',   label: 'Halal Lamb',           label_fr: 'Agneau halal',             note: 'ME / North Africa' },
        ]},
        { id: 'goat', label: 'Goat Meat', label_fr: 'Viande de chèvre', unit: '$/kg' },
        { id: 'processed_meat', label: 'Processed Meats', label_fr: 'Viandes transformées', unit: '$/kg', variants: [
          { id: 'sausages',    label: 'Sausages (pork / chicken)',   label_fr: 'Saucisses (porc / poulet)',  note: 'Fresh & smoked' },
          { id: 'hot_dogs',    label: 'Hot Dogs / Frankfurters',     label_fr: 'Hot dogs / Saucisses',       note: 'Emulsified' },
          { id: 'deli_meats',  label: 'Deli / Cold Cuts',            label_fr: 'Charcuterie',                note: 'Ham, mortadella, salami' },
          { id: 'corned_beef', label: 'Corned Beef (canned)',        label_fr: 'Corned beef (en boîte)',     note: 'Africa / Pacific staple' },
        ]},
      ],
    },
    {
      group: 'Fish & Seafood by Species', group_fr: 'Poissons & Fruits de mer',
      items: [
        { id: 'tuna', label: 'Tuna', label_fr: 'Thon', unit: '$/kg', variants: [
          { id: 'tuna_skipjack',  label: 'Skipjack Tuna',              label_fr: 'Thon listao',                note: 'Canned — Pacific benchmark' },
          { id: 'tuna_yellowfin', label: 'Yellowfin (Ahi)',            label_fr: 'Thon albacore (Ahi)',        note: 'Fresh / frozen sashimi grade' },
          { id: 'tuna_bigeye',    label: 'Bigeye Tuna',               label_fr: 'Thon obèse',                 note: 'High-grade sashimi — Tokyo' },
          { id: 'tuna_bluefin',   label: 'Bluefin (Atl. / Pacific)',  label_fr: 'Thon rouge (Atl. / Pac.)',   note: 'Ultra-premium — Tsukiji ref.' },
          { id: 'tuna_albacore',  label: 'Albacore (White Tuna)',     label_fr: 'Germon (Thon blanc)',         note: 'Canned white tuna' },
          { id: 'canned_tuna',    label: 'Canned Tuna (in brine)',    label_fr: 'Thon en conserve (au naturel)', note: 'FOB Thailand / Ecuador' },
        ]},
        { id: 'salmon', label: 'Salmon', label_fr: 'Saumon', unit: '$/kg', variants: [
          { id: 'salmon_atl_farmed', label: 'Atlantic Salmon (farmed)',label_fr: 'Saumon atlantique (élevage)', note: 'Norway/Chile — Nasdaq Salmon' },
          { id: 'salmon_pac_wild',   label: 'Pacific Salmon (wild)',  label_fr: 'Saumon du Pacifique (sauvage)', note: 'Sockeye, Pink, Coho — Alaska' },
          { id: 'salmon_smoked',     label: 'Smoked Salmon',          label_fr: 'Saumon fumé',                  note: 'Cold / hot smoked — premium' },
          { id: 'salmon_trout',      label: 'Rainbow Trout',          label_fr: 'Truite arc-en-ciel',           note: 'Farmed — freshwater' },
        ]},
        { id: 'whitefish', label: 'White Fish (Demersal)', label_fr: 'Poisson blanc (Démersal)', unit: '$/kg', variants: [
          { id: 'cod',       label: 'Atlantic Cod',       label_fr: 'Morue / Cabillaud',   note: 'Norway / Iceland — filets / blocks' },
          { id: 'haddock',   label: 'Haddock',            label_fr: 'Églefin',             note: 'UK favourite — smoked / fresh' },
          { id: 'pollock',   label: 'Alaska Pollock',     label_fr: 'Lieu d\'Alaska',      note: 'Surimi / fast food filet' },
          { id: 'hake',      label: 'Hake (Merluccius)', label_fr: 'Merlu (Merluccius)',   note: 'Spain / S.Africa — fresh / frozen' },
          { id: 'pangasius', label: 'Pangasius / Basa',  label_fr: 'Pangasius / Basa',     note: 'Vietnam farmed — budget white fish' },
          { id: 'tilapia',   label: 'Tilapia',           label_fr: 'Tilapia',              note: 'Africa / China farmed' },
          { id: 'sole',      label: 'Sole / Plaice',     label_fr: 'Sole / Plie',          note: 'Premium flatfish' },
          { id: 'halibut',   label: 'Halibut',           label_fr: 'Flétan',               note: 'Premium North Atlantic / Pacific' },
        ]},
        { id: 'small_pelagics', label: 'Small Pelagic Fish', label_fr: 'Petits pélagiques', unit: '$/t', variants: [
          { id: 'sardine',  label: 'Sardine / Pilchard', label_fr: 'Sardine / Pilchard',  note: 'Morocco / EU — canned & fresh' },
          { id: 'anchovy',  label: 'Anchovy (Engraulis)',label_fr: 'Anchois (Engraulis)',  note: 'Peru fishmeal feedstock' },
          { id: 'mackerel', label: 'Atlantic Mackerel',  label_fr: 'Maquereau atlantique', note: 'Norway — frozen export' },
          { id: 'herring',  label: 'Herring',            label_fr: 'Hareng',               note: 'North Sea — fresh / cured / smoked' },
        ]},
        { id: 'shrimp_prawn', label: 'Shrimp & Prawns', label_fr: 'Crevettes', unit: '$/kg', variants: [
          { id: 'vannamei',        label: 'L. Vannamei (Pacific White)',   label_fr: 'L. Vannamei (Blanche du Pacifique)', note: 'Farmed — Ecuador / Asia dominant' },
          { id: 'black_tiger',     label: 'Black Tiger Prawn (P.monodon)',label_fr: 'Crevette tigrée noire (P.monodon)',   note: 'SE Asia farmed — premium' },
          { id: 'cold_water_shrimp',label: 'Cold Water Shrimp',           label_fr: 'Crevette d\'eau froide',             note: 'Greenland / Canada — Pandalus' },
          { id: 'cooked_shrimp',   label: 'Cooked Peeled Shrimp (IQF)',  label_fr: 'Crevettes cuites décortiquées (IQF)', note: 'Retail — 31/40 count' },
        ]},
        { id: 'cephalopods', label: 'Cephalopods', label_fr: 'Céphalopodes', unit: '$/kg', variants: [
          { id: 'squid',      label: 'Squid / Calamari', label_fr: 'Calamar / Encornet', note: 'Illex (Arg.) / Loligo (EU)' },
          { id: 'octopus',    label: 'Octopus',          label_fr: 'Poulpe',             note: 'Morocco / Japan — boiled / frozen' },
          { id: 'cuttlefish', label: 'Cuttlefish',       label_fr: 'Seiche',             note: 'SE Asia — dried / frozen' },
        ]},
        { id: 'shellfish', label: 'Shellfish & Molluscs', label_fr: 'Coquillages & Mollusques', unit: '$/kg', variants: [
          { id: 'oysters',  label: 'Oysters',    label_fr: 'Huîtres',       note: 'Pacific / Atlantic — live / half shell' },
          { id: 'mussels',  label: 'Mussels',    label_fr: 'Moules',        note: 'Farmed — Chile / NZ / EU' },
          { id: 'scallops', label: 'Scallops',   label_fr: 'Coquilles St-Jacques', note: 'Bay / sea — IQF frozen meat' },
          { id: 'crab',     label: 'Crab',       label_fr: 'Crabe',         note: 'King / Snow / Blue — live / frozen' },
          { id: 'lobster',  label: 'Lobster',    label_fr: 'Homard',        note: 'Maine / Spiny — live export' },
        ]},
        { id: 'processed_fish', label: 'Processed Fish Products', label_fr: 'Produits de la mer transformés', unit: '$/t', variants: [
          { id: 'fish_fillet_frozen', label: 'Frozen Fish Fillets (IQF)', label_fr: 'Filets de poisson surgelés (IQF)', note: 'Pollock / hake / tilapia blocks' },
          { id: 'surimi',             label: 'Surimi',                    label_fr: 'Surimi',                            note: 'Crab sticks — Japan / Russia' },
          { id: 'fish_meal',          label: 'Fish Meal (65% protein)',   label_fr: 'Farine de poisson (65% prot.)',    note: 'Peru anchovy — feed' },
          { id: 'fish_oil',           label: 'Fish Oil (crude)',          label_fr: 'Huile de poisson (brute)',          note: 'Omega-3 / aquafeed' },
          { id: 'dried_salted_fish',  label: 'Dried / Salted Fish',      label_fr: 'Poisson séché / salé',              note: 'Stockfish / codfish — W.Africa' },
          { id: 'canned_sardines',    label: 'Canned Sardines',          label_fr: 'Sardines en conserve',               note: 'Morocco dominant exporter' },
        ]},
      ],
    },
    {
      group: 'Soft Commodities', group_fr: 'Boissons & Stimulants',
      items: [
        { id: 'cacao', label: 'Cacao / Cocoa', label_fr: 'Cacao', unit: '$/t', variants: [
          { id: 'cocoa_ivorian',    label: "Ivoirien (Cote d Ivoire)",  label_fr: "Ivoirien (Côte d'Ivoire)",   note: 'Bulk — 40% world supply' },
          { id: 'cocoa_ghanaian',   label: 'Ghanaian Grade 1',          label_fr: 'Ghanéen Grade 1',            note: 'Premium — Ashanti' },
          { id: 'cocoa_ecuador',    label: 'Ecuador Arriba (Fino)',      label_fr: 'Équateur Arriba (Fino)',     note: 'Fine flavour — floral notes' },
          { id: 'cocoa_madagascar', label: 'Madagascar Criollo',        label_fr: 'Madagascar Criollo',          note: 'Ultra-premium, fruity' },
          { id: 'cocoa_butter',     label: 'Cocoa Butter',              label_fr: 'Beurre de cacao',             note: 'Processed — cosmetics / choc' },
          { id: 'cocoa_powder',     label: 'Cocoa Powder',              label_fr: 'Poudre de cacao',             note: 'Natural (pH 5) / Dutched (pH 7)' },
          { id: 'cocoa_liquor',     label: 'Cocoa Liquor / Mass',       label_fr: 'Liqueur / Masse de cacao',   note: 'Chocolate production' },
        ]},
        { id: 'coffee', label: 'Coffee', label_fr: 'Café', unit: '$/lb', variants: [
          { id: 'coffee_arabica_c',  label: 'Arabica C (ICE NY)',           label_fr: 'Arabica C (ICE NY)',            note: 'World benchmark' },
          { id: 'coffee_colombian',  label: 'Colombian Mild Arabica',       label_fr: 'Arabica doux colombien',        note: 'Huila / Nariño / Antioquia' },
          { id: 'coffee_ethiopian',  label: 'Ethiopian Arabica',            label_fr: 'Arabica éthiopien',             note: 'Yirgacheffe / Sidamo / Harrar' },
          { id: 'coffee_kenyan',     label: 'Kenyan AA / AB',              label_fr: 'Kenyan AA / AB',                note: 'Bright acidity — auction' },
          { id: 'coffee_brazilian',  label: 'Brazilian Natural (Santos)',   label_fr: 'Brésilien naturel (Santos)',    note: 'NY2/3 — most traded' },
          { id: 'coffee_robusta',    label: 'Robusta (ICE London)',         label_fr: 'Robusta (ICE Londres)',          note: 'Instant / espresso blends' },
          { id: 'coffee_viet',       label: 'Vietnamese Robusta',           label_fr: 'Robusta vietnamien',             note: 'Grade 2 — world 2nd exporter' },
          { id: 'coffee_instant',    label: 'Instant Coffee (spray-dried)', label_fr: 'Café soluble (atomisé)',        note: 'Emerging market dominant' },
        ]},
        { id: 'tea', label: 'Tea', label_fr: 'Thé', unit: '$/kg', variants: [
          { id: 'tea_ctc',     label: 'CTC Black Tea',       label_fr: 'Thé noir CTC',          note: 'Kenya / Assam — Mombasa auction' },
          { id: 'tea_orthodox',label: 'Orthodox Black Tea',  label_fr: 'Thé noir orthodoxe',     note: 'Darjeeling / Ceylon FBOP' },
          { id: 'tea_green',   label: 'Green Tea',           label_fr: 'Thé vert',               note: 'Sencha / Gunpowder — China / Japan' },
          { id: 'tea_white',   label: 'White Tea',           label_fr: 'Thé blanc',              note: 'Silver Needle — premium' },
          { id: 'tea_bag',     label: 'Tea Bags (finished)', label_fr: 'Sachets de thé (finis)', note: 'Branded / private label' },
        ]},
        { id: 'vanilla',  label: 'Vanilla',      label_fr: 'Vanille',       unit: '$/kg' },
        { id: 'pepper',   label: 'Black Pepper', label_fr: 'Poivre noir',   unit: '$/kg', variants: [
          { id: 'pepper_black', label: 'Black Pepper', label_fr: 'Poivre noir', note: 'Vietnam dominant exporter' },
          { id: 'pepper_white', label: 'White Pepper', label_fr: 'Poivre blanc', note: 'Indonesia / Malaysia' },
        ]},
        { id: 'cashews', label: 'Cashews (RCN)', label_fr: 'Noix de cajou (RCN)', unit: '$/t', variants: [
          { id: 'rcn',           label: 'Raw Cashew Nuts (RCN)',       label_fr: 'Noix de cajou brutes (RCN)',    note: 'W. Africa FOB' },
          { id: 'cashew_kernel', label: 'Cashew Kernels (W240/W320)', label_fr: 'Amandes de cajou (W240/W320)', note: 'Vietnam processed' },
        ]},
      ],
    },
    {
      group: 'Oilseeds & Oils', group_fr: 'Huiles & Graisses',
      items: [
        { id: 'soybeans', label: 'Soybeans', label_fr: 'Soja', unit: '$/bu', variants: [
          { id: 'soy_beans', label: 'Soybeans (CBOT)',  label_fr: 'Soja (CBOT)',           note: 'US No. 2 Yellow' },
          { id: 'soy_meal',  label: 'Soybean Meal 48%',label_fr: 'Tourteau de soja 48%',  note: 'Animal protein feed' },
          { id: 'soy_oil',   label: 'Soybean Oil',      label_fr: 'Huile de soja',         note: 'Refined / crude' },
        ]},
        { id: 'palm_oil', label: 'Palm Oil', label_fr: 'Huile de palme', unit: '$/t', variants: [
          { id: 'palm_cpo',    label: 'Crude Palm Oil (CPO)',  label_fr: 'Huile de palme brute (CPO)',    note: 'Bursa Malaysia ref.' },
          { id: 'palm_rbd',    label: 'RBD Palm Olein',        label_fr: 'Oléine de palme RBD',           note: 'Refined — edible cooking oil' },
          { id: 'palm_kernel', label: 'Palm Kernel Oil (PKO)', label_fr: 'Huile de palmiste (PKO)',       note: 'Lauric oil — soaps / food' },
          { id: 'palm_stearin',label: 'Palm Stearin',          label_fr: 'Stéarine de palme',             note: 'Hard fraction — margarine / soap' },
        ]},
        { id: 'sunflower', label: 'Sunflower Oil', label_fr: 'Huile de tournesol', unit: '$/t', variants: [
          { id: 'sunfl_crude',     label: 'Crude Sunflower Oil',    label_fr: 'Huile de tournesol brute',       note: 'Ukraine / Russia dominant' },
          { id: 'sunfl_refined',   label: 'Refined Sunflower Oil',  label_fr: 'Huile de tournesol raffinée',    note: 'Bottled / foodservice' },
          { id: 'sunfl_higholeic', label: 'High-Oleic Sunflower',   label_fr: 'Tournesol haut oléique',         note: 'Extended fry life' },
        ]},
        { id: 'olive_oil', label: 'Olive Oil', label_fr: 'Huile d\'olive', unit: '$/t', variants: [
          { id: 'evoo',         label: 'Extra Virgin (EVOO)',  label_fr: 'Extra vierge (EVOO)',        note: '<=0.8% acidity' },
          { id: 'virgin_olive', label: 'Virgin Olive Oil',    label_fr: 'Huile d\'olive vierge',     note: '<=2% acidity' },
          { id: 'refined_olive',label: 'Refined Olive Oil',   label_fr: 'Huile d\'olive raffinée',   note: 'Industrial / blending' },
        ]},
        { id: 'canola', label: 'Canola / Rapeseed', label_fr: 'Colza / Canola', unit: '$/t' },
      ],
    },
    {
      group: 'Sugar & Sweeteners', group_fr: 'Sucre & Édulcorants',
      items: [
        { id: 'sugar', label: 'Sugar', label_fr: 'Sucre', unit: 'c/lb', variants: [
          { id: 'sugar_11',   label: 'Raw Cane Sugar #11', label_fr: 'Sucre brut de canne #11', note: 'ICE benchmark FOB' },
          { id: 'sugar_5',    label: 'White Sugar #5',     label_fr: 'Sucre raffiné #5',        note: 'London / EU refined' },
          { id: 'sugar_beet', label: 'Beet Sugar',         label_fr: 'Sucre de betterave',      note: 'EU / Ukraine origin' },
        ]},
        { id: 'molasses', label: 'Molasses', label_fr: 'Mélasse',  unit: '$/t' },
        { id: 'honey',    label: 'Honey',    label_fr: 'Miel',     unit: '$/kg' },
      ],
    },
    {
      group: 'Fiber & Industrial Crops', group_fr: 'Fibres & Cultures industrielles',
      items: [
        { id: 'cotton', label: 'Cotton', label_fr: 'Coton', unit: 'c/lb', variants: [
          { id: 'cotton_els',label: 'Extra-Long Staple (ELS)', label_fr: 'Extra-long (ELS)',     note: 'Pima / Giza >=36mm — luxury' },
          { id: 'cotton_ms', label: 'Medium Staple',           label_fr: 'Fibre moyenne',         note: 'ICE Cotton #2 >=28mm' },
          { id: 'cotton_ss', label: 'Short Staple',            label_fr: 'Fibre courte',           note: '<26mm — industrial / recycled' },
        ]},
        { id: 'jute',    label: 'Jute',    label_fr: 'Jute',   unit: '$/t' },
        { id: 'tobacco', label: 'Tobacco', label_fr: 'Tabac',  unit: '$/kg', variants: [
          { id: 'tobacco_flue',    label: 'Flue-Cured Virginia', label_fr: 'Virginie flue-cured',  note: 'Cigarettes — Zimbabwe / Brazil' },
          { id: 'tobacco_burley',  label: 'Burley Tobacco',      label_fr: 'Tabac Burley',          note: 'Blending — Malawi / USA' },
          { id: 'tobacco_oriental',label: 'Oriental / Turkish',  label_fr: 'Oriental / Turc',       note: 'Aromatic — Greece / Turkey' },
        ]},
      ],
    },
  ],

  // ── ENERGY ───────────────────────────────────────────────────────────────
  energy: [
    {
      group: 'Crude Oil', group_fr: 'Pétrole brut',
      items: [
        { id: 'crude_oil', label: 'Crude Oil', label_fr: 'Pétrole brut', unit: '$/bbl', variants: [
          { id: 'brent',      label: 'Brent Crude',           label_fr: 'Brent',                    note: 'ICE — 38.3 deg API, 0.37% S' },
          { id: 'wti',        label: 'WTI (Light Sweet)',     label_fr: 'WTI (Léger doux)',         note: 'NYMEX — 39.6 deg API, 0.24% S' },
          { id: 'dubai',      label: 'Dubai / Oman',          label_fr: 'Dubaï / Oman',             note: 'Asia benchmark — 31 deg API' },
          { id: 'opec',       label: 'OPEC Reference Basket', label_fr: 'Panier de référence OPEP', note: 'Avg. 13 OPEC crudes' },
          { id: 'urals',      label: 'Urals (Russia)',        label_fr: 'Oural (Russie)',           note: 'Medium sour 31 deg API, 1.5% S' },
          { id: 'heavy_sour', label: 'Heavy Sour (<20 API)', label_fr: 'Lourd acide (<20 API)',     note: 'Venezuela / Canada tar sands' },
          { id: 'bonny',      label: 'Bonny Light (Nigeria)', label_fr: 'Bonny Light (Nigeria)',    note: 'W. Africa sweet 33 deg API' },
        ]},
      ],
    },
    {
      group: 'Petroleum Products', group_fr: 'Raffinés & Transformés',
      items: [
        { id: 'diesel', label: 'Diesel / Gasoil', label_fr: 'Diesel / Gazole', unit: '$/t', variants: [
          { id: 'ulsd',   label: 'ULSD 10ppm (EU / US spec)', label_fr: 'ULSD 10ppm (norme EU / US)', note: 'Premium — clean air standards' },
          { id: 'ls50',   label: 'Low Sulphur 50ppm',         label_fr: 'Bas soufre 50ppm',            note: 'Emerging market standard' },
          { id: 'ice_go', label: 'ICE Gasoil 0.1%',           label_fr: 'ICE Gazole 0,1%',             note: 'Heating — ICE London ref.' },
        ]},
        { id: 'gasoline', label: 'Gasoline', label_fr: 'Essence', unit: '$/t', variants: [
          { id: 'ron95', label: 'RON 95 Gasoline', label_fr: 'Essence RON 95',  note: 'European standard' },
          { id: 'ron92', label: 'RON 92 Gasoline', label_fr: 'Essence RON 92',  note: 'Emerging markets' },
          { id: 'rbob',  label: 'RBOB (US)',        label_fr: 'RBOB (US)',       note: 'NY Harbor NYMEX' },
        ]},
        { id: 'jet_fuel', label: 'Jet Fuel (Jet-A1)', label_fr: 'Kérosène (Jet-A1)', unit: '$/t' },
        { id: 'fuel_oil', label: 'Fuel Oil (Bunker)', label_fr: 'Fioul (Soute)', unit: '$/t', variants: [
          { id: 'hsfo',  label: 'HSFO 380 CST', label_fr: 'HSFO 380 CST',  note: '3.5% S — pre-IMO 2020' },
          { id: 'vlsfo', label: 'VLSFO 0.5%',   label_fr: 'VLSFO 0,5%',   note: 'IMO 2020 compliant' },
          { id: 'lsfo',  label: 'LSFO 0.1%',    label_fr: 'LSFO 0,1%',    note: 'Low sulfur marine' },
        ]},
        { id: 'lpg', label: 'LPG / Bottled Gas', label_fr: 'GPL / Gaz en bouteille', unit: '$/t', variants: [
          { id: 'propane', label: 'Propane (CP)',   label_fr: 'Propane (CP)',    note: 'Saudi Aramco ref.' },
          { id: 'butane',  label: 'Butane (CP)',    label_fr: 'Butane (CP)',     note: 'Cooking cylinders — Africa / Asia' },
          { id: 'lpg_mix', label: 'LPG Mix 50/50', label_fr: 'GPL Mix 50/50',  note: 'Domestic cylinders' },
        ]},
        { id: 'naphtha', label: 'Naphtha',  label_fr: 'Naphta',   unit: '$/t' },
        { id: 'bitumen', label: 'Bitumen',  label_fr: 'Bitume',   unit: '$/t' },
      ],
    },
    {
      group: 'Natural Gas', group_fr: 'Gaz naturel',
      items: [
        { id: 'lng', label: 'LNG / Natural Gas', label_fr: 'GNL / Gaz naturel', unit: '$/MMBtu', variants: [
          { id: 'jkm',       label: 'LNG Spot JKM',   label_fr: 'GNL Spot JKM',    note: 'Japan / Korea Marker' },
          { id: 'ttf',       label: 'TTF (Europe)',    label_fr: 'TTF (Europe)',     note: 'Dutch hub benchmark' },
          { id: 'henry_hub', label: 'Henry Hub (US)',  label_fr: 'Henry Hub (US)',   note: 'NYMEX benchmark' },
        ]},
      ],
    },
    {
      group: 'Coal', group_fr: 'Charbon',
      items: [
        { id: 'coal', label: 'Coal', label_fr: 'Charbon', unit: '$/t', variants: [
          { id: 'thermal_api2', label: 'Thermal Coal (API2)',    label_fr: 'Charbon thermique (API2)',    note: 'ARA — 6,000 kcal/kg' },
          { id: 'thermal_newc', label: 'NEWC Thermal',           label_fr: 'Thermique NEWC',              note: 'Newcastle Australia' },
          { id: 'met_hcc',      label: 'Coking Coal (PLV HCC)', label_fr: 'Charbon à coke (PLV HCC)',   note: 'Metallurgical 64 CSR' },
          { id: 'anthracite',   label: 'Anthracite',             label_fr: 'Anthracite',                  note: '>90% carbon' },
        ]},
      ],
    },
    {
      group: 'Power & Clean Energy', group_fr: 'Renouvelable & Nucléaire',
      items: [
        { id: 'electricity', label: 'Electricity',  label_fr: 'Électricité',        unit: '$/MWh' },
        { id: 'uranium',     label: 'Uranium U3O8', label_fr: 'Uranium U3O8',       unit: '$/lb' },
        { id: 'solar',       label: 'Solar Panels',  label_fr: 'Panneaux solaires', unit: '$/W', variants: [
          { id: 'solar_mono', label: 'Monocrystalline', label_fr: 'Monocristallin', note: '22-24% eff.' },
          { id: 'solar_poly', label: 'Polycrystalline', label_fr: 'Polycristallin', note: '17-20% eff.' },
        ]},
        { id: 'wind', label: 'Wind Turbines', label_fr: 'Éoliennes', unit: '$/kW', variants: [
          { id: 'wind_onshore',  label: 'Onshore',  label_fr: 'Terrestre',  note: '2-6 MW' },
          { id: 'wind_offshore', label: 'Offshore', label_fr: 'En mer',     note: '8-15 MW' },
        ]},
      ],
    },
  ],

  // ── MATERIALS ────────────────────────────────────────────────────────────
  materials: [
    {
      group: 'Precious Metals', group_fr: 'Métaux précieux',
      items: [
        { id: 'gold', label: 'Gold', label_fr: 'Or', unit: '$/troy oz', variants: [
          { id: 'gold_9999', label: '999.9 Fine / 24K',    label_fr: '999,9 Fin / 24K',      note: 'Good Delivery bar (400 oz)' },
          { id: 'gold_995',  label: '995 Fine (24K)',       label_fr: '995 Fin (24K)',         note: 'Std bars 1g - 12.5kg' },
          { id: 'gold_22k',  label: '916 / 22K',           label_fr: '916 / 22K',             note: 'Coins & jewelry blanks' },
          { id: 'gold_18k',  label: '750 / 18K',           label_fr: '750 / 18K',             note: 'Fine jewelry' },
          { id: 'gold_14k',  label: '585 / 14K',           label_fr: '585 / 14K',             note: 'Fashion jewelry' },
          { id: 'gold_dore', label: 'Dore Bars (mining)',  label_fr: 'Barres doré (minier)',   note: 'Unrefined 60-90% Au' },
        ]},
        { id: 'silver', label: 'Silver', label_fr: 'Argent', unit: '$/troy oz', variants: [
          { id: 'silver_999', label: '999 Fine (spot)',    label_fr: '999 Fin (spot)',        note: 'LBMA benchmark' },
          { id: 'silver_925', label: '925 Sterling',       label_fr: '925 Sterling',          note: 'Jewelry / silverware' },
          { id: 'silver_ind', label: 'Industrial Silver',  label_fr: 'Argent industriel',     note: 'Electronics / solar pastes' },
        ]},
        { id: 'platinum', label: 'Platinum', label_fr: 'Platine',    unit: '$/troy oz' },
        { id: 'palladium',label: 'Palladium', label_fr: 'Palladium', unit: '$/troy oz' },
        { id: 'rhodium',  label: 'Rhodium',   label_fr: 'Rhodium',   unit: '$/troy oz' },
      ],
    },
    {
      group: 'Base Metals (LME)', group_fr: 'Métaux non-ferreux',
      items: [
        { id: 'copper', label: 'Copper', label_fr: 'Cuivre', unit: '$/t', variants: [
          { id: 'cu_cathode',  label: 'Cathodes Grade A',     label_fr: 'Cathodes Grade A',       note: 'LME 99.99%' },
          { id: 'cu_conc',     label: 'Concentrate (30% Cu)', label_fr: 'Concentré (30% Cu)',      note: 'Mine output CIF' },
          { id: 'cu_wire_rod', label: 'Wire Rod 8mm',         label_fr: 'Fil machine 8mm',         note: 'Electro-refinery' },
          { id: 'cu_scrap',    label: 'Scrap (Birch/Cliff)',  label_fr: 'Ferraille (Birch/Cliff)', note: 'No.1 / No.2' },
        ]},
        { id: 'aluminium', label: 'Aluminium', label_fr: 'Aluminium', unit: '$/t', variants: [
          { id: 'al_primary', label: 'Primary Ingots',   label_fr: 'Lingots primaires',      note: 'LME 99.7%' },
          { id: 'al_alloy',   label: 'Secondary Alloy',  label_fr: 'Alliage secondaire',     note: 'Automotive recycled' },
          { id: 'al_oxide',   label: 'Alumina (Al2O3)',  label_fr: 'Alumine (Al2O3)',         note: 'Refinery feedstock' },
        ]},
        { id: 'nickel', label: 'Nickel', label_fr: 'Nickel', unit: '$/t', variants: [
          { id: 'ni_class1',   label: 'Class I (99.8%+)',      label_fr: 'Classe I (99,8%+)',         note: 'LME electrolytic' },
          { id: 'ni_npi',      label: 'Nickel Pig Iron (NPI)', label_fr: 'Fonte de nickel (NPI)',     note: '8-12% Ni — Indonesia / China' },
          { id: 'ni_feni',     label: 'Ferronickel (FeNi)',    label_fr: 'Ferronickel (FeNi)',        note: '20-40% Ni — stainless' },
          { id: 'ni_sulfate',  label: 'Nickel Sulfate',        label_fr: 'Sulfate de nickel',         note: 'Battery grade precursor' },
          { id: 'ni_laterite', label: 'Laterite Ore',          label_fr: 'Minerai latéritique',       note: 'Low-grade oxide ore' },
          { id: 'ni_sulfide',  label: 'Sulfide Concentrate',   label_fr: 'Concentré sulfuré',         note: 'High-grade mine output' },
        ]},
        { id: 'zinc',   label: 'Zinc',   label_fr: 'Zinc',    unit: '$/t' },
        { id: 'lead',   label: 'Lead',   label_fr: 'Plomb',   unit: '$/t' },
        { id: 'tin',    label: 'Tin',    label_fr: 'Étain',   unit: '$/t' },
        { id: 'cobalt', label: 'Cobalt', label_fr: 'Cobalt',  unit: '$/t', variants: [
          { id: 'co_metal',  label: 'Cobalt Metal 99.8%', label_fr: 'Cobalt métal 99,8%',       note: 'MB standard grade' },
          { id: 'co_sulfate',label: 'Cobalt Sulfate',     label_fr: 'Sulfate de cobalt',         note: 'Battery precursor' },
          { id: 'co_mhp',    label: 'Mixed Hydroxide (MHP)', label_fr: 'Hydroxyde mixte (MHP)', note: 'DRC mine output' },
        ]},
      ],
    },
    {
      group: 'Battery & Tech Metals', group_fr: 'Terres rares & Critiques',
      items: [
        { id: 'lithium', label: 'Lithium', label_fr: 'Lithium', unit: '$/t', variants: [
          { id: 'li_carb', label: 'Li2CO3 Battery Grade 99.5%', label_fr: 'Li2CO3 qualité batterie 99,5%', note: 'Fastmarkets ref.' },
          { id: 'li_oh',   label: 'LiOH Monohydrate',           label_fr: 'LiOH Monohydrate',              note: 'NMC / NCA batteries' },
          { id: 'li_spod', label: 'Spodumene 6% Li2O',          label_fr: 'Spodumène 6% Li2O',             note: 'Australia CIF China' },
        ]},
        { id: 'rare_earths', label: 'Rare Earths', label_fr: 'Oxydes de terres rares', unit: '$/kg', variants: [
          { id: 'ndpr', label: 'NdPr Oxide',       label_fr: 'Oxyde NdPr',          note: 'EV motors — China 99%' },
          { id: 'dy',   label: 'Dysprosium Dy2O3', label_fr: 'Dysprosium Dy2O3',   note: 'High-temp magnets' },
          { id: 'ce',   label: 'Cerium CeO2',      label_fr: 'Cérium CeO2',        note: 'Polishing / catalysts' },
        ]},
        { id: 'graphite',  label: 'Graphite', label_fr: 'Graphite', unit: '$/t', variants: [
          { id: 'gr_flake', label: 'Flake +80 mesh',     label_fr: 'Paillettes +80 mesh',    note: 'Natural — Mozambique' },
          { id: 'gr_sph',   label: 'Spherical Graphite', label_fr: 'Graphite sphérique',     note: 'Battery anode' },
          { id: 'gr_synth', label: 'Synthetic Graphite', label_fr: 'Graphite synthétique',   note: 'High purity EV' },
        ]},
        { id: 'manganese', label: 'Manganese', label_fr: 'Manganèse',  unit: '$/t' },
        { id: 'vanadium',  label: 'Vanadium',  label_fr: 'Vanadium',   unit: '$/kg' },
      ],
    },
    {
      group: 'Iron & Steel', group_fr: 'Métaux ferreux',
      items: [
        { id: 'iron_ore', label: 'Iron Ore', label_fr: 'Minerai de fer', unit: '$/t', variants: [
          { id: 'fe62',   label: 'Fines 62% Fe', label_fr: 'Fines 62% Fe',   note: 'SGX / DCE benchmark' },
          { id: 'fe65',   label: 'Fines 65% Fe', label_fr: 'Fines 65% Fe',   note: 'High-grade premium' },
          { id: 'pellet', label: 'Pellets 65%',  label_fr: 'Boulettes 65%',  note: 'DRI / BF grade' },
          { id: 'lump',   label: 'Lump 64%',     label_fr: 'Calibré 64%',    note: 'Direct charge' },
        ]},
        { id: 'flat_steel', label: 'Flat Steel', label_fr: 'Acier plat', unit: '$/t', variants: [
          { id: 'hrc', label: 'Hot-Rolled Coil (HRC)', label_fr: 'Bobine laminée à chaud (HRC)', note: 'China export FOB' },
          { id: 'crc', label: 'Cold-Rolled (CRC)',      label_fr: 'Laminé à froid (CRC)',         note: 'Auto / appliances' },
          { id: 'hdg', label: 'Hot-Dip Galvanized',     label_fr: 'Galvanisé à chaud',            note: 'Construction' },
        ]},
        { id: 'long_steel', label: 'Long Steel', label_fr: 'Acier long', unit: '$/t', variants: [
          { id: 'rebar',    label: 'Rebar',         label_fr: 'Armature',         note: 'Construction 10-32mm' },
          { id: 'wire_rod', label: 'Wire Rod',      label_fr: 'Fil machine',      note: '5.5-12mm drawing' },
          { id: 'billets',  label: 'Steel Billets', label_fr: 'Billettes acier',  note: '130mm2 continuous cast' },
        ]},
        { id: 'stainless', label: 'Stainless Steel', label_fr: 'Acier inoxydable', unit: '$/t', variants: [
          { id: 'ss304', label: 'SS 304 (18/8)',     label_fr: 'Inox 304 (18/8)',     note: 'Food / medical' },
          { id: 'ss316', label: 'SS 316 (Mo grade)', label_fr: 'Inox 316 (Mo)',       note: 'Marine / chemical' },
          { id: 'ss430', label: 'SS 430 (ferritic)', label_fr: 'Inox 430 (ferritique)', note: 'Automotive / appliances' },
        ]},
        { id: 'scrap_steel', label: 'Steel Scrap', label_fr: 'Ferraille', unit: '$/t', variants: [
          { id: 'hms',      label: 'HMS 1&2 (80/20)', label_fr: 'HMS 1&2 (80/20)',    note: 'International ref.' },
          { id: 'shredded', label: 'Shredded Scrap',  label_fr: 'Ferraille broyée',   note: 'High bulk density' },
        ]},
      ],
    },
    {
      group: 'Timber & Forest Products', group_fr: 'Bois & Produits forestiers',
      items: [
        { id: 'tropical_hw', label: 'Tropical Hardwood', label_fr: 'Bois dur tropical', unit: '$/m3', variants: [
          { id: 'teak',    label: 'Teak',       label_fr: 'Teck',      note: 'Myanmar / India — premium' },
          { id: 'iroko',   label: 'Iroko',      label_fr: 'Iroko',     note: 'W. Africa — mahogany-like' },
          { id: 'sapele',  label: 'Sapele',     label_fr: 'Sapelli',   note: 'W. Africa — furniture' },
          { id: 'meranti', label: 'Meranti',    label_fr: 'Méranti',   note: 'SE Asia — plywood' },
          { id: 'merbau',  label: 'Merbau',     label_fr: 'Merbau',    note: 'SE Asia — flooring' },
          { id: 'wenge',   label: 'Wenge',      label_fr: 'Wengé',     note: 'Congo — luxury flooring' },
          { id: 'ebony',   label: 'Ebony',      label_fr: 'Ébène',     note: 'Very rare — instruments' },
        ]},
        { id: 'temperate_hw', label: 'Temperate Hardwood', label_fr: 'Bois dur tempéré', unit: '$/m3', variants: [
          { id: 'oak',    label: 'Oak (Euro / American)', label_fr: 'Chêne (Euro / Américain)', note: 'Furniture / flooring' },
          { id: 'beech',  label: 'Beech',                label_fr: 'Hêtre',                     note: 'Plywood / furniture' },
          { id: 'ash',    label: 'Ash',                  label_fr: 'Frêne',                     note: 'Tools / sports' },
          { id: 'walnut', label: 'Walnut',               label_fr: 'Noyer',                     note: 'Premium furniture' },
          { id: 'maple',  label: 'Hard Maple',           label_fr: 'Érable dur',                note: 'Flooring / sports' },
        ]},
        { id: 'softwood', label: 'Softwood / Conifer', label_fr: 'Résineux / Conifère', unit: '$/m3', variants: [
          { id: 'pine_radiata', label: 'Radiata Pine',       label_fr: 'Pin radiata',                note: 'Chile / NZ / Australia' },
          { id: 'spf',          label: 'SPF (Spruce-Pine-Fir)', label_fr: 'SPF (Épicéa-Pin-Sapin)', note: 'Canada construction' },
          { id: 'cedar',        label: 'Western Red Cedar',  label_fr: 'Cèdre rouge de l\'Ouest',  note: 'Cladding / decking' },
          { id: 'douglas_fir',  label: 'Douglas Fir',        label_fr: 'Douglas',                    note: 'US West — structural' },
        ]},
        { id: 'wood_pulp', label: 'Wood Pulp', label_fr: 'Pâte à papier', unit: '$/t', variants: [
          { id: 'bhkp', label: 'BHKP (Hardwood Kraft)', label_fr: 'BHKP (Kraft feuillus)',   note: 'Brazil / Chile — tissue' },
          { id: 'nbsk', label: 'NBSK (Softwood Kraft)', label_fr: 'NBSK (Kraft résineux)',   note: 'Canada — packaging' },
        ]},
        { id: 'bamboo',   label: 'Bamboo',   label_fr: 'Bambou',          unit: '$/t' },
        { id: 'charcoal', label: 'Charcoal', label_fr: 'Charbon de bois', unit: '$/t' },
      ],
    },
    {
      group: 'Industrial Chemicals', group_fr: 'Chimie & Polymères',
      items: [
        { id: 'acids', label: 'Industrial Acids', label_fr: 'Acides industriels', unit: '$/t', variants: [
          { id: 'h2so4',  label: 'Sulfuric Acid (H2SO4)',  label_fr: 'Acide sulfurique (H2SO4)',     note: 'Most used industrial chemical' },
          { id: 'hcl',    label: 'Hydrochloric Acid (HCl)',label_fr: 'Acide chlorhydrique (HCl)',    note: '30-33% solution' },
          { id: 'hno3',   label: 'Nitric Acid (HNO3)',     label_fr: 'Acide nitrique (HNO3)',        note: 'Fertilizers / explosives' },
          { id: 'h3po4',  label: 'Phosphoric Acid',        label_fr: 'Acide phosphorique',           note: '54% P2O5 — fertilizer grade' },
          { id: 'acetic', label: 'Acetic Acid (99%)',       label_fr: 'Acide acétique (99%)',         note: 'Glacial — PET / PTA feedstock' },
        ]},
        { id: 'alkalis', label: 'Alkalis & Salts', label_fr: 'Alcalis & Sels', unit: '$/t', variants: [
          { id: 'naoh',   label: 'Caustic Soda (NaOH)',  label_fr: 'Soude caustique (NaOH)',  note: 'Membrane grade 99%' },
          { id: 'na2co3', label: 'Soda Ash (Na2CO3)',    label_fr: 'Carbonate de soude',       note: 'Dense / light — glass / detergent' },
          { id: 'nahco3', label: 'Sodium Bicarbonate',   label_fr: 'Bicarbonate de sodium',    note: 'Food / pharma / fire ext.' },
        ]},
        { id: 'solvents', label: 'Solvents', label_fr: 'Solvants', unit: '$/t', variants: [
          { id: 'methanol', label: 'Methanol',          label_fr: 'Méthanol',              note: 'MTBE / biodiesel / formaldehyde' },
          { id: 'ethanol',  label: 'Ethanol (industrial)',label_fr: 'Éthanol (industriel)', note: 'Anhydrous 99.5%' },
          { id: 'acetone',  label: 'Acetone',           label_fr: 'Acétone',               note: 'Coatings / pharma' },
          { id: 'ipa',      label: 'IPA (Isopropanol)', label_fr: 'IPA (Isopropanol)',     note: 'Pharma / sanitizers' },
          { id: 'toluene',  label: 'Toluene',           label_fr: 'Toluène',               note: 'Paints / adhesives' },
        ]},
        { id: 'aromatics', label: 'Aromatics / Petrochemicals', label_fr: 'Aromatiques / Pétrochimie', unit: '$/t', variants: [
          { id: 'benzene',   label: 'Benzene',        label_fr: 'Benzène',         note: 'Styrene / nylon feedstock' },
          { id: 'px',        label: 'Paraxylene (PX)',label_fr: 'Paraxylène (PX)', note: 'PTA — PET bottles' },
          { id: 'styrene',   label: 'Styrene (SM)',   label_fr: 'Styrène (SM)',    note: 'Polystyrene / ABS' },
          { id: 'ethylene',  label: 'Ethylene',       label_fr: 'Éthylène',        note: 'PE / PVC / PET' },
          { id: 'propylene', label: 'Propylene',      label_fr: 'Propylène',       note: 'PP / acrylics' },
        ]},
        { id: 'ammonia', label: 'Ammonia (NH3)', label_fr: 'Ammoniac (NH3)', unit: '$/t' },
        { id: 'chlorine',label: 'Chlorine',      label_fr: 'Chlore',          unit: '$/t' },
      ],
    },
    {
      group: 'Specialty Chemicals', group_fr: 'Chimie de spécialité',
      items: [
        { id: 'dyes_pigments', label: 'Dyes & Pigments', label_fr: 'Colorants & Pigments', unit: '$/kg', variants: [
          { id: 'reactive_dyes', label: 'Reactive Dyes',         label_fr: 'Colorants réactifs',          note: 'Cotton dyeing — China dominant' },
          { id: 'disperse_dyes', label: 'Disperse Dyes',         label_fr: 'Colorants dispersés',         note: 'Polyester — high temp' },
          { id: 'tio2',          label: 'Titanium Dioxide (TiO2)',label_fr: 'Dioxyde de titane (TiO2)',   note: 'White pigment — paints / plastics' },
          { id: 'carbon_black',  label: 'Carbon Black (N330)',   label_fr: 'Noir de carbone (N330)',      note: 'Tire rubber reinforcement' },
        ]},
        { id: 'surfactants', label: 'Surfactants / Detergents', label_fr: 'Tensioactifs / Détergents', unit: '$/t', variants: [
          { id: 'las',      label: 'LAS (Linear Alkylbenzene Sulfonate)', label_fr: 'LAS (Sulfonate d\'alkylbenzène)', note: 'Anionic — household detergent' },
          { id: 'sles',     label: 'SLES 70%',                           label_fr: 'SLES 70%',                         note: 'Shampoo / shower gel' },
          { id: 'fatty_alc',label: 'Fatty Alcohols (C12-C18)',           label_fr: 'Alcools gras (C12-C18)',           note: 'Emulsifier / personal care' },
        ]},
        { id: 'paints_coatings', label: 'Paints & Coatings', label_fr: 'Peintures & Revêtements', unit: '$/t', variants: [
          { id: 'architectural', label: 'Architectural Paint (emulsion)', label_fr: 'Peinture bâtiment (émulsion)', note: 'Water-based — consumer' },
          { id: 'industrial_coat',label: 'Industrial Coatings (epoxy)',  label_fr: 'Revêtements industriels (époxy)', note: 'Anti-corrosion' },
          { id: 'marine_paint',  label: 'Marine Coatings',               label_fr: 'Peintures marines',              note: 'Anti-fouling' },
        ]},
        { id: 'adhesives',label: 'Adhesives & Sealants', label_fr: 'Adhésifs & Mastics',  unit: '$/t' },
        { id: 'silicones',label: 'Silicones (PDMS)',     label_fr: 'Silicones (PDMS)',     unit: '$/kg' },
      ],
    },
    {
      group: 'Fertilizers', group_fr: 'Engrais & Intrants agricoles',
      items: [
        { id: 'urea',   label: 'Urea (46% N)',  label_fr: 'Urée (46% N)',       unit: '$/t' },
        { id: 'dap',    label: 'DAP (18-46-0)', label_fr: 'DAP (18-46-0)',      unit: '$/t' },
        { id: 'potash', label: 'Potash MOP',    label_fr: 'Potasse MOP',        unit: '$/t' },
        { id: 'npk',    label: 'NPK Complex',   label_fr: 'Mélanges NPK',       unit: '$/t' },
        { id: 'sulphur',label: 'Sulphur',        label_fr: 'Soufre',             unit: '$/t' },
      ],
    },
    {
      group: 'Rubber & Polymers', group_fr: 'Caoutchouc & Polymères',
      items: [
        { id: 'natural_rubber', label: 'Natural Rubber', label_fr: 'Caoutchouc naturel', unit: '$/kg', variants: [
          { id: 'tsr20', label: 'TSR 20',              label_fr: 'TSR 20',                  note: 'SICOM benchmark' },
          { id: 'rss3',  label: 'RSS3 (smoked sheet)', label_fr: 'RSS3 (feuille fumée)',    note: 'Thailand' },
          { id: 'latex', label: 'Latex (60% conc)',    label_fr: 'Latex (60% conc.)',        note: 'Gloves / medical' },
        ]},
        { id: 'pe',  label: 'Polyethylene', label_fr: 'Polyéthylène', unit: '$/t', variants: [
          { id: 'hdpe',  label: 'HDPE', label_fr: 'PEHD',  note: 'Rigid packaging / pipes' },
          { id: 'ldpe',  label: 'LDPE', label_fr: 'PEBD',  note: 'Flexible films / bags' },
          { id: 'lldpe', label: 'LLDPE',label_fr: 'PEBDL', note: 'Stretch wrap / food film' },
        ]},
        { id: 'pp',  label: 'Polypropylene (PP)', label_fr: 'Polypropylène (PP)',   unit: '$/t' },
        { id: 'pvc', label: 'PVC',                label_fr: 'PVC',                  unit: '$/t' },
        { id: 'pet', label: 'PET Resin',          label_fr: 'Résine PET',           unit: '$/t' },
        { id: 'abs', label: 'ABS Resin',          label_fr: 'Résine ABS',           unit: '$/t' },
        { id: 'pc',  label: 'Polycarbonate (PC)', label_fr: 'Polycarbonate (PC)',   unit: '$/t' },
      ],
    },
  ],

  // ── MANUFACTURED / INDUSTRIAL ────────────────────────────────────────────
  manufactured: [
    {
      group: 'Textiles — Raw Fibers', group_fr: 'Textile — Fibres brutes',
      items: [
        { id: 'cotton_fiber', label: 'Cotton Fiber', label_fr: 'Fibre de coton', unit: 'c/lb', variants: [
          { id: 'cotton_els',    label: 'ELS Cotton (Pima / Giza)', label_fr: 'Coton ELS (Pima / Giza)',   note: '>=36mm — luxury' },
          { id: 'cotton_upland', label: 'Upland / Middling',        label_fr: 'Upland / Middling',          note: 'ICE #2 benchmark' },
        ]},
        { id: 'wool', label: 'Wool', label_fr: 'Laine', unit: 'c/kg', variants: [
          { id: 'wool_merino_fine', label: 'Merino Fine (<18 micron)',  label_fr: 'Mérinos fin (<18 micron)',     note: 'Australia — luxury knitwear' },
          { id: 'wool_merino_med',  label: 'Merino Medium (18-23 mic)',label_fr: 'Mérinos moyen (18-23 mic)',    note: 'Apparel worsted' },
          { id: 'wool_crossbred',   label: 'Crossbred (24-32 mic)',    label_fr: 'Croisé (24-32 mic)',           note: 'Knitting / carpets' },
          { id: 'wool_carpet',      label: 'Carpet Wool (>32 mic)',    label_fr: 'Laine à tapis (>32 mic)',      note: 'NZ strong wool' },
        ]},
        { id: 'silk', label: 'Silk', label_fr: 'Soie', unit: '$/kg', variants: [
          { id: 'silk_raw',  label: 'Raw Silk (Greige)',    label_fr: 'Soie grège',             note: 'China / India — 3A-6A grade' },
          { id: 'silk_spun', label: 'Spun Silk / Noil',    label_fr: 'Soie filée / Bourrette', note: 'Lower grade reeled waste' },
        ]},
        { id: 'cashmere', label: 'Cashmere', label_fr: 'Cachemire', unit: '$/kg', variants: [
          { id: 'cashmere_raw',      label: 'Raw Cashmere',      label_fr: 'Cachemire brut',      note: 'Mongolia / China <16 mic' },
          { id: 'cashmere_dehaired', label: 'Dehaired Cashmere', label_fr: 'Cachemire déjardé',   note: 'Processed 15-16.5 mic' },
        ]},
        { id: 'manmade_fibers', label: 'Man-Made Fibers', label_fr: 'Fibres synthétiques', unit: '$/t', variants: [
          { id: 'polyester_poy',  label: 'Polyester POY',          label_fr: 'Polyester POY',           note: 'Pre-oriented yarn feedstock' },
          { id: 'polyester_dty',  label: 'Polyester DTY (textured)',label_fr: 'Polyester DTY (texturé)', note: 'Woven / knit apparel' },
          { id: 'polyester_fdy',  label: 'Polyester FDY',          label_fr: 'Polyester FDY',           note: 'Fully drawn — linings' },
          { id: 'viscose',        label: 'Viscose / Rayon',         label_fr: 'Viscose / Rayonne',       note: 'Lyocell alternative — drape' },
          { id: 'nylon6',         label: 'Nylon 6 Filament',       label_fr: 'Nylon 6 Filament',        note: 'Hosiery / sportswear' },
          { id: 'acrylic',        label: 'Acrylic Staple Fiber',   label_fr: 'Fibre acrylique',          note: 'Wool substitute — knitwear' },
          { id: 'spandex',        label: 'Spandex / Lycra',        label_fr: 'Élasthanne / Lycra',      note: 'Activewear / intimate' },
          { id: 'tencel',         label: 'Tencel / Lyocell',       label_fr: 'Tencel / Lyocell',        note: 'Sustainable — biodegradable' },
          { id: 'recycled_pet',   label: 'rPET Fiber (recycled)',  label_fr: 'Fibre rPET (recyclée)',   note: 'Eco — bottles to fleece' },
        ]},
      ],
    },
    {
      group: 'Textiles — Fabrics', group_fr: 'Textile — Tissus',
      items: [
        { id: 'woven_fabrics', label: 'Woven Fabrics', label_fr: 'Tissus', unit: '$/m', variants: [
          { id: 'denim',        label: 'Denim (3x1 twill)',    label_fr: 'Denim (sergé 3x1)',        note: '7-14 oz/yd2 — cotton / stretch' },
          { id: 'canvas',       label: 'Canvas (plain weave)', label_fr: 'Toile (armure toile)',      note: 'Bags / shoes / outdoor' },
          { id: 'poplin',       label: 'Poplin / Broadcloth',  label_fr: 'Popeline',                  note: 'Shirting — 40s or 60s' },
          { id: 'twill',        label: 'Twill (diagonal weave)',label_fr: 'Sergé (armure diagonale)', note: 'Chinos / uniforms' },
          { id: 'satin',        label: 'Satin / Sateen',       label_fr: 'Satin / Satinette',         note: 'Lingerie / lining' },
          { id: 'jacquard',     label: 'Jacquard',             label_fr: 'Jacquard',                  note: 'Upholstery / ties / brocade' },
        ]},
        { id: 'knitted_fabrics', label: 'Knitted Fabrics', label_fr: 'Tricots', unit: '$/kg', variants: [
          { id: 'jersey',   label: 'Single Jersey',      label_fr: 'Jersey simple',        note: 'T-shirts — 140-200 gsm' },
          { id: 'interlock',label: 'Interlock',          label_fr: 'Interlock',             note: 'Baby wear / polo shirts' },
          { id: 'fleece',   label: 'Polar Fleece',       label_fr: 'Polaire',               note: 'Sportswear / outerwear' },
          { id: 'terry',    label: 'Terry / Towelling',  label_fr: 'Éponge / Bouclette',   note: 'Towels / bathrobes' },
          { id: 'rib_knit', label: 'Rib Knit (1x1, 2x2)',label_fr: 'Côtes (1x1, 2x2)',    note: 'Collars / cuffs / bands' },
          { id: 'mesh',     label: 'Mesh / Sports Net',  label_fr: 'Mesh / Filet sport',   note: 'Activewear / liners' },
        ]},
        { id: 'technical_textiles', label: 'Technical Textiles', label_fr: 'Textiles techniques', unit: '$/m2', variants: [
          { id: 'nonwoven',   label: 'Non-Woven (PP / PE)',   label_fr: 'Non-tissé (PP / PE)',      note: 'Medical / hygiene / geotextile' },
          { id: 'geotextile', label: 'Geotextile',            label_fr: 'Géotextile',                note: 'Road / civil engineering' },
          { id: 'med_textile',label: 'Medical Textile',       label_fr: 'Textile médical',           note: 'Wound care / surgical drapes' },
          { id: 'ballistic',  label: 'Ballistic / Protective',label_fr: 'Balistique / Protection',  note: 'Aramid (Kevlar) / UHMWPE' },
        ]},
      ],
    },
    {
      group: 'Textiles — Apparel & Home', group_fr: 'Textile & Habillement',
      items: [
        { id: 'garments_knit', label: 'Knit Apparel', label_fr: 'Vêtements maille', unit: '$/unit', variants: [
          { id: 'tshirts',    label: 'T-Shirts (CMT / FOB)',   label_fr: 'T-Shirts (CMT / FOB)',        note: 'Bangladesh / Vietnam dominant' },
          { id: 'polos',      label: 'Polo Shirts',            label_fr: 'Polos',                        note: 'Bangladesh CMT price' },
          { id: 'knitwear',   label: 'Sweaters / Knitwear',   label_fr: 'Pulls / Maille',               note: 'China / Bangladesh' },
          { id: 'sportswear', label: 'Activewear / Athleisure',label_fr: 'Sportswear / Athleisure',     note: 'Cambodia / Vietnam' },
          { id: 'innerwear',  label: 'Underwear / Socks',      label_fr: 'Sous-vêtements / Chaussettes', note: 'High volume — China / India' },
        ]},
        { id: 'garments_woven', label: 'Woven Apparel', label_fr: 'Vêtements tissés', unit: '$/unit', variants: [
          { id: 'denim_jeans',label: 'Denim Jeans',            label_fr: 'Jeans denim',                 note: 'Bangladesh dominant' },
          { id: 'shirts',     label: 'Dress / Casual Shirts',  label_fr: 'Chemises habillées / casual', note: 'Bangladesh / India' },
          { id: 'workwear',   label: 'Workwear / Uniforms',    label_fr: 'Vêtements de travail',        note: 'PPE + industrial' },
          { id: 'outwear',    label: 'Outerwear / Jackets',    label_fr: 'Vestes / Manteaux',           note: 'Down / polyester fill' },
        ]},
        { id: 'footwear', label: 'Footwear', label_fr: 'Chaussures', unit: '$/pair', variants: [
          { id: 'leather_shoes', label: 'Leather Shoes',        label_fr: 'Chaussures cuir',      note: 'Dress / casual' },
          { id: 'sneakers',      label: 'Sneakers / Athletic',  label_fr: 'Baskets / Sport',      note: 'Vietnam / Indonesia dominant' },
          { id: 'sandals',       label: 'Sandals / Flip-flops', label_fr: 'Sandales / Tongs',     note: 'High volume — China / India' },
          { id: 'boots',         label: 'Boots (ankle / knee)', label_fr: 'Bottes (cheville / montantes)', note: 'Leather / synthetic' },
        ]},
        { id: 'home_textiles', label: 'Home Textiles', label_fr: 'Linge de maison', unit: '$/unit', variants: [
          { id: 'towels',     label: 'Towels (450-700 gsm)',  label_fr: 'Serviettes (450-700 gsm)',   note: 'India / Pakistan — terry' },
          { id: 'bed_sheets', label: 'Bed Sheets / Duvet',   label_fr: 'Draps / Couettes',            note: 'TC 200-600 — India dominant' },
          { id: 'blankets',   label: 'Blankets / Throws',    label_fr: 'Couvertures / Plaids',        note: 'China / India — polyester' },
          { id: 'curtains',   label: 'Curtains / Drapes',    label_fr: 'Rideaux / Voilages',          note: 'China — printed / blackout' },
          { id: 'carpet',     label: 'Carpet / Rugs',        label_fr: 'Tapis / Moquette',            note: 'Turkey / India / China' },
        ]},
      ],
    },
    {
      group: 'Electronics & Tech', group_fr: 'Électronique & Électrique',
      items: [
        { id: 'semiconductors', label: 'Semiconductors', label_fr: 'Semi-conducteurs', unit: '$/unit', variants: [
          { id: 'logic',  label: 'Logic (CPU / GPU / SoC)', label_fr: 'Logique (CPU / GPU / SoC)',  note: 'TSMC 2-5nm nodes' },
          { id: 'memory', label: 'DRAM / NAND Flash',       label_fr: 'DRAM / NAND Flash',          note: 'Samsung / SK Hynix / Micron' },
          { id: 'analog', label: 'Analog / Mixed-Signal',   label_fr: 'Analogique / Signal mixte',  note: 'TI, STM, ADI' },
          { id: 'power',  label: 'Power (IGBT / MOSFET)',   label_fr: 'Puissance (IGBT / MOSFET)',  note: 'EV / industrial drives' },
        ]},
        { id: 'smartphones',  label: 'Smartphones',          label_fr: 'Smartphones',              unit: '$/unit' },
        { id: 'solar_cells',  label: 'Solar Cells & Modules', label_fr: 'Cellules & Modules solaires', unit: '$/W' },
        { id: 'ev_batteries', label: 'Li-ion Battery Cells',  label_fr: 'Batteries Li-ion',          unit: '$/kWh' },
      ],
    },
    {
      group: 'Machinery & Equipment', group_fr: 'Machines & Équipements',
      items: [
        { id: 'agri_machinery',  label: 'Agricultural Machinery', label_fr: 'Machines agricoles',               unit: '$/unit' },
        { id: 'construction_eq', label: 'Construction Equipment', label_fr: 'Engins BTP',                       unit: '$/unit' },
        { id: 'mining_eq',       label: 'Mining Equipment',       label_fr: 'Équipements miniers',              unit: '$/unit' },
        { id: 'food_processing', label: 'Food Processing Equipment', label_fr: 'Équipements agroalimentaires', unit: '$/unit' },
        { id: 'packaging_eq',    label: 'Packaging Machinery',    label_fr: 'Machines d\'emballage',            unit: '$/unit' },
      ],
    },
    {
      group: 'Vehicles & Transport', group_fr: 'Véhicules & Machines',
      items: [
        { id: 'cars', label: 'Passenger Cars', label_fr: 'Voitures particulières', unit: '$/unit', variants: [
          { id: 'car_ice',    label: 'ICE (petrol / diesel)', label_fr: 'Thermique (essence / diesel)', note: '' },
          { id: 'car_ev',     label: 'Battery EV (BEV)',      label_fr: 'Électrique (BEV)',             note: 'China dominant export' },
          { id: 'car_hybrid', label: 'Hybrid (HEV / PHEV)',   label_fr: 'Hybride (HEV / PHEV)',        note: '' },
        ]},
        { id: 'trucks',      label: 'Trucks & Buses', label_fr: 'Camions & Bus',     unit: '$/unit' },
        { id: 'motorcycles', label: 'Motorcycles',    label_fr: 'Motos',              unit: '$/unit' },
        { id: 'auto_parts',  label: 'Auto Parts',     label_fr: 'Pièces auto',        unit: '$/kg' },
      ],
    },
    {
      group: 'Packaging Materials', group_fr: 'Papier & Emballage',
      items: [
        { id: 'plastic_pkg', label: 'Plastic Packaging', label_fr: 'Emballage plastique', unit: '$/t', variants: [
          { id: 'pet_bottles',    label: 'PET Bottles (preforms)',     label_fr: 'Bouteilles PET (préformes)',    note: 'Beverage — 500ml / 1.5L' },
          { id: 'hdpe_bottles',   label: 'HDPE Bottles / Canisters',  label_fr: 'Bouteilles PEHD / Bidons',     note: 'Detergent / dairy' },
          { id: 'flex_pouch',     label: 'Flexible Pouches (BOPP/PE)',label_fr: 'Sachets souples (BOPP/PE)',     note: 'Snacks / coffee / sauce' },
          { id: 'plastic_bags',   label: 'Plastic Bags (LDPE)',       label_fr: 'Sacs plastique (PEBD)',         note: 'Retail / supermarket' },
        ]},
        { id: 'metal_pkg', label: 'Metal Packaging', label_fr: 'Emballage métallique', unit: '$/unit', variants: [
          { id: 'tin_cans',   label: 'Tin Cans (3-piece)',    label_fr: 'Boîtes de conserve (3 pièces)', note: 'Food canning' },
          { id: 'alu_cans',   label: 'Aluminium Cans (DWI)', label_fr: 'Canettes aluminium (DWI)',      note: 'Beverage — 330ml / 500ml' },
          { id: 'aerosol',    label: 'Aerosol Cans',          label_fr: 'Bombes aérosol',                note: 'Personal care / industrial' },
        ]},
        { id: 'glass_pkg', label: 'Glass Packaging', label_fr: 'Emballage verre', unit: '$/unit', variants: [
          { id: 'glass_bottles', label: 'Glass Bottles', label_fr: 'Bouteilles en verre', note: 'Wine / spirits / beer / sauce' },
          { id: 'glass_jars',    label: 'Glass Jars',    label_fr: 'Bocaux en verre',     note: 'Food / cosmetics' },
        ]},
        { id: 'paper_pkg', label: 'Paper & Carton', label_fr: 'Papier & Carton', unit: '$/t', variants: [
          { id: 'corrugated',     label: 'Corrugated Board / Boxes', label_fr: 'Carton ondulé / Caisses',  note: 'E-commerce / logistics' },
          { id: 'folding_carton', label: 'Folding Cartons',          label_fr: 'Étuis pliants',             note: 'Retail packaging' },
          { id: 'kraft_paper',    label: 'Kraft Paper (sacks)',      label_fr: 'Papier kraft (sacs)',       note: 'Cement / flour / sugar' },
          { id: 'tissue',         label: 'Tissue Paper',             label_fr: 'Papier hygiénique',         note: 'Toilet / facial / towel' },
        ]},
      ],
    },
    {
      group: 'Consumer & Household Goods', group_fr: 'Biens de consommation & Ménage',
      items: [
        { id: 'appliances', label: 'Home Appliances', label_fr: 'Électroménager', unit: '$/unit', variants: [
          { id: 'washing_machine', label: 'Washing Machines',       label_fr: 'Lave-linge',                note: 'Top / front load' },
          { id: 'refrigerator',    label: 'Refrigerators',          label_fr: 'Réfrigérateurs',            note: 'Double door / single' },
          { id: 'air_conditioner', label: 'Air Conditioners',       label_fr: 'Climatiseurs',              note: 'Split / window' },
          { id: 'microwave',       label: 'Microwaves',             label_fr: 'Micro-ondes',               note: 'Countertop / built-in' },
          { id: 'tv',              label: 'Televisions (LED/OLED)', label_fr: 'Téléviseurs (LED/OLED)',    note: 'China / South Korea export' },
          { id: 'small_appliances',label: 'Small Appliances',       label_fr: 'Petit électroménager',      note: 'Blenders / irons / fans' },
        ]},
        { id: 'furniture', label: 'Furniture', label_fr: 'Mobilier', unit: '$/unit', variants: [
          { id: 'wood_furniture',  label: 'Solid Wood Furniture',       label_fr: 'Meubles bois massif',          note: 'Vietnam / Malaysia dominant' },
          { id: 'flat_pack',       label: 'Flat-Pack (RTA)',            label_fr: 'Kit à monter (RTA)',            note: 'Self-assembly — China / Poland' },
          { id: 'upholstered',     label: 'Upholstered Seating',        label_fr: 'Sièges rembourrés',            note: 'Sofa / chairs — China dominant' },
          { id: 'metal_furniture', label: 'Metal / Office Furniture',   label_fr: 'Mobilier métal / Bureau',      note: 'China / Turkey' },
          { id: 'outdoor_furn',    label: 'Outdoor / Garden Furniture', label_fr: 'Mobilier extérieur / Jardin',  note: 'Rattan / aluminium / teak' },
          { id: 'mattress',        label: 'Mattresses',                 label_fr: 'Matelas',                       note: 'Foam / spring / latex' },
        ]},
        { id: 'ceramics', label: 'Ceramics & Houseware', label_fr: 'Céramique & Arts de la table', unit: '$/unit', variants: [
          { id: 'ceramic_tiles', label: 'Ceramic / Porcelain Tiles', label_fr: 'Carrelage céramique / porcelaine', note: 'China / Spain / Italy export' },
          { id: 'tableware',     label: 'Tableware (plates / bowls)', label_fr: 'Vaisselle (assiettes / bols)',    note: 'China / India' },
          { id: 'cookware',      label: 'Cookware (pots / pans)',     label_fr: 'Ustensiles (casseroles / poêles)', note: 'Aluminum / stainless / cast iron' },
        ]},
        { id: 'lighting', label: 'Lighting', label_fr: 'Éclairage', unit: '$/unit', variants: [
          { id: 'led_bulbs',       label: 'LED Bulbs (A60 / GU10)',  label_fr: 'Ampoules LED (A60 / GU10)',  note: 'China — 8-15W retrofit' },
          { id: 'led_streetlight', label: 'LED Street Lighting',    label_fr: 'Éclairage LED public',         note: 'Municipal infrastructure' },
          { id: 'solar_lantern',   label: 'Solar Lanterns / PAYG',  label_fr: 'Lanternes solaires / PAYG',   note: 'Off-grid Africa — high growth' },
        ]},
        { id: 'building_mat', label: 'Building Materials', label_fr: 'Matériaux de construction', unit: '$/t', variants: [
          { id: 'cement',    label: 'Portland Cement (OPC)',      label_fr: 'Ciment Portland (OPC)',      note: 'Local manufacturing preferred' },
          { id: 'pvc_pipes', label: 'PVC Pipes & Fittings',       label_fr: 'Tubes PVC & Raccords',      note: 'Plumbing / irrigation' },
          { id: 'roofing',   label: 'Roofing Sheets',             label_fr: 'Tôles de toiture',          note: 'Corrugated iron / colorsteel' },
          { id: 'paint_deco',label: 'Decorative Paint',           label_fr: 'Peinture décorative',       note: 'Emulsion / gloss' },
          { id: 'sanitary',  label: 'Sanitary Ware',              label_fr: 'Sanitaire',                  note: 'WC / basin / shower' },
        ]},
      ],
    },
    {
      group: 'Pharma & Healthcare', group_fr: 'Pharmacie & Médical',
      items: [
        { id: 'generics',        label: 'Generic Medicines',         label_fr: 'Médicaments génériques',       unit: '$/unit' },
        { id: 'apis',            label: 'Active Pharma Ingredients', label_fr: 'Principes actifs (API)',        unit: '$/kg' },
        { id: 'medical_devices', label: 'Medical Devices',           label_fr: 'Dispositifs médicaux',          unit: '$/unit' },
        { id: 'vaccines',        label: 'Vaccines & Biologics',      label_fr: 'Vaccins & Biologiques',        unit: '$/dose' },
        { id: 'diagnostics',     label: 'Diagnostics / Rapid Tests', label_fr: 'Diagnostics / Tests rapides',  unit: '$/unit' },
      ],
    },
    {
      group: 'Processed Food & Beverage', group_fr: 'Alimentation & Boissons transformées',
      items: [
        { id: 'edible_oils_pkg', label: 'Packaged Edible Oils', label_fr: 'Huiles alimentaires emballées', unit: '$/L', variants: [
          { id: 'sunfl_bottle',  label: 'Sunflower Oil (1-5L)',    label_fr: 'Huile de tournesol (1-5L)',   note: 'Retail — EM favourite' },
          { id: 'palm_cooking',  label: 'Palm / Cooking Oil (5L)', label_fr: 'Huile de palme / cuisson (5L)', note: 'W. Africa / SE Asia' },
          { id: 'olive_retail',  label: 'Olive Oil (750ml)',       label_fr: 'Huile d\'olive (750ml)',       note: 'Mediterranean retail export' },
        ]},
        { id: 'pasta_noodles', label: 'Pasta & Noodles', label_fr: 'Pâtes & Nouilles', unit: '$/t', variants: [
          { id: 'dry_pasta',      label: 'Dry Pasta (Italy / Turkey)', label_fr: 'Pâtes sèches (Italie / Turquie)', note: 'Spaghetti / penne / fusilli' },
          { id: 'instant_noodle',label: 'Instant Noodles',             label_fr: 'Nouilles instantanées',            note: 'Asia / Africa — high volume' },
          { id: 'rice_noodle',   label: 'Rice Noodles / Vermicelli',  label_fr: 'Nouilles de riz / Vermicelles',   note: 'SE Asia export' },
        ]},
        { id: 'canned_food', label: 'Canned / Preserved Food', label_fr: 'Conserves / Aliments préservés', unit: '$/t', variants: [
          { id: 'canned_tomato', label: 'Canned Tomatoes',       label_fr: 'Tomates en conserve',          note: 'Italy / Spain — passata / diced' },
          { id: 'corned_beef2',  label: 'Corned Beef (340g can)',label_fr: 'Corned beef (boîte 340g)',     note: 'Pacific / Africa staple' },
          { id: 'canned_fruit',  label: 'Canned Fruit',          label_fr: 'Fruits en conserve',           note: 'South Africa / China' },
        ]},
        { id: 'beverages_pkg', label: 'Beverages (packaged)', label_fr: 'Boissons (emballées)', unit: '$/L', variants: [
          { id: 'water_bottled', label: 'Bottled Water',           label_fr: 'Eau en bouteille',            note: '500ml - 5L PET' },
          { id: 'carbonated',    label: 'Carbonated Soft Drinks',  label_fr: 'Boissons gazeuses',           note: 'Cans / PET — cola / orange' },
          { id: 'juice',         label: 'Fruit Juice (NFC / FC)',  label_fr: 'Jus de fruits (NFC / FC)',   note: 'Ambient / chilled — Tetra Pak' },
          { id: 'energy_drink',  label: 'Energy Drinks',           label_fr: 'Boissons énergisantes',       note: '250ml can — high growth EM' },
          { id: 'beer',          label: 'Beer (lager / ale)',       label_fr: 'Bière (lager / ale)',         note: 'Cans / bottles' },
          { id: 'spirits',       label: 'Spirits & Wines',         label_fr: 'Spiritueux & Vins',           note: 'Imported / locally bottled' },
        ]},
        { id: 'confectionery', label: 'Confectionery & Snacks', label_fr: 'Confiserie & Snacks', unit: '$/t', variants: [
          { id: 'chocolate',    label: 'Chocolate Bars / Couverture', label_fr: 'Tablettes / Couverture chocolat', note: 'Belgium / Switzerland / China' },
          { id: 'biscuits',     label: 'Biscuits / Crackers',         label_fr: 'Biscuits / Crackers',              note: 'Indonesia / China / France export' },
          { id: 'chips_snacks', label: 'Potato Chips / Snacks',       label_fr: 'Chips / Snacks',                   note: 'High growth EM' },
        ]},
        { id: 'condiments', label: 'Condiments & Sauces', label_fr: 'Condiments & Sauces', unit: '$/t', variants: [
          { id: 'ketchup',       label: 'Ketchup / Tomato Sauce',    label_fr: 'Ketchup / Sauce tomate',    note: 'China / Europe export' },
          { id: 'soy_sauce',     label: 'Soy Sauce',                 label_fr: 'Sauce soja',                 note: 'China / Japan' },
          { id: 'chili_sauce',   label: 'Chili / Hot Sauce',         label_fr: 'Sauce piment / piquante',   note: 'SE Asia / Mexico dominant' },
        ]},
      ],
    },
  ],

  // ── RESOURCES ────────────────────────────────────────────────────────────
  resources: [
    {
      group: 'Water & Sanitation', group_fr: 'Eau & Assainissement',
      items: [
        { id: 'water_treatment', label: 'Water Treatment Systems', label_fr: 'Systèmes de traitement de l\'eau', unit: '$/m3' },
        { id: 'desalination',    label: 'Desalination Equipment',  label_fr: 'Équipements de dessalement',       unit: '$/m3/day' },
        { id: 'water_pipes',     label: 'Water Infrastructure',    label_fr: 'Infrastructure hydraulique',        unit: '$/km' },
      ],
    },
    {
      group: 'Agricultural Inputs', group_fr: 'Intrants agricoles',
      items: [
        { id: 'pesticides',      label: 'Pesticides / Insecticides', label_fr: 'Pesticides / Insecticides',     unit: '$/L' },
        { id: 'herbicides',      label: 'Herbicides',                label_fr: 'Herbicides',                     unit: '$/L' },
        { id: 'fungicides',      label: 'Fungicides',                label_fr: 'Fongicides',                     unit: '$/L' },
        { id: 'seeds_hybrid',    label: 'Hybrid Seeds',              label_fr: 'Semences hybrides',              unit: '$/kg' },
        { id: 'seeds_certified', label: 'Certified Seeds (OP / GM)', label_fr: 'Semences certifiées (OP / OGM)', unit: '$/kg' },
        { id: 'bio_inputs',      label: 'Bio-inputs / Inoculants',   label_fr: 'Bio-intrants / Inoculants',     unit: '$/kg' },
        { id: 'drip_irrigation', label: 'Drip Irrigation Equipment', label_fr: 'Irrigation goutte-à-goutte',    unit: '$/ha' },
        { id: 'greenhouses',     label: 'Greenhouse Structures',     label_fr: 'Structures de serres',           unit: '$/m2' },
      ],
    },
    {
      group: 'Waste & Recycling', group_fr: 'Déchets & Recyclage',
      items: [
        { id: 'scrap_metals',    label: 'Scrap Metals',              label_fr: 'Métaux de récupération',       unit: '$/t' },
        { id: 'plastic_pellets', label: 'Recycled Plastic Pellets',  label_fr: 'Granulés plastique recyclé',   unit: '$/t' },
        { id: 'recycled_paper',  label: 'Recovered Paper / Cardboard', label_fr: 'Papier / Carton récupéré',  unit: '$/t' },
        { id: 'e_waste',         label: 'E-Waste Processing',        label_fr: 'Traitement déchets électroniques', unit: '$/t' },
      ],
    },
  ],
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface FilterSelection {
  categories: string[]   // selected top-level category IDs (empty = all)
  subs: string[]         // selected sub-item / variant IDs (empty = all within category)
}

interface Props {
  onSelectionChange?: (sel: FilterSelection) => void
}

function Checkbox({ checked, color }: { checked: boolean; color: string }) {
  return (
    <span
      className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all"
      style={{
        borderColor: checked ? color : '#374151',
        background: checked ? color + '30' : 'transparent',
      }}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  )
}

export default function CategoryFilter({ onSelectionChange }: Props) {
  // Collapse state — starts collapsed on mobile
  const [collapsed, setCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  const { lang } = useLang()
  // Navigation state (which sub-panel is visible)
  const [navCat, setNavCat] = useState<TradeCategory | 'all'>('all')
  // Multi-select state
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set())
  // Expand/collapse
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  function emit(cats: Set<string>, subs: Set<string>) {
    onSelectionChange?.({ categories: [...cats], subs: [...subs] })
  }

  function toggleCat(catId: string) {
    if (catId === 'all') {
      // Reset all
      setSelectedCats(new Set())
      setSelectedSubs(new Set())
      setNavCat('all')
      emit(new Set(), new Set())
      return
    }
    const next = new Set(selectedCats)
    if (next.has(catId)) {
      next.delete(catId)
      // Remove sub-items belonging to this category
      const nextSubs = new Set(selectedSubs)
      const groups = SUBCATEGORIES[catId as TradeCategory] ?? []
      groups.forEach(g => g.items.forEach(item => {
        nextSubs.delete(item.id)
        item.variants?.forEach(v => nextSubs.delete(v.id))
      }))
      setSelectedCats(next)
      setSelectedSubs(nextSubs)
      emit(next, nextSubs)
    } else {
      next.add(catId)
      setSelectedCats(next)
      setNavCat(catId as TradeCategory)
      emit(next, selectedSubs)
    }
  }

  function navigateCat(catId: TradeCategory | 'all') {
    setNavCat(catId)
    setExpandedGroup(null)
    setExpandedItem(null)
  }

  function toggleSub(id: string, catId: string) {
    const nextSubs = new Set(selectedSubs)
    if (nextSubs.has(id)) {
      nextSubs.delete(id)
    } else {
      nextSubs.add(id)
      // Auto-select parent category if not already
      if (!selectedCats.has(catId)) {
        const nextCats = new Set(selectedCats)
        nextCats.add(catId)
        setSelectedCats(nextCats)
        emit(nextCats, nextSubs)
        setSelectedSubs(nextSubs)
        return
      }
    }
    setSelectedSubs(nextSubs)
    emit(selectedCats, nextSubs)
  }

  function clearAll() {
    setSelectedCats(new Set())
    setSelectedSubs(new Set())
    emit(new Set(), new Set())
  }

  function toggleGroup(group: string) {
    setExpandedGroup(g => g === group ? null : group)
    setExpandedItem(null)
  }

  const totalFilters = selectedCats.size + selectedSubs.size
  const subGroups = navCat !== 'all' ? SUBCATEGORIES[navCat] ?? [] : []
  const navColor = CATEGORIES.find(c => c.id === navCat)?.color ?? '#C9A84C'

  return (
    <>
      {/* Floating toggle button — ALWAYS visible on top of the map */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="fixed z-[1000] flex items-center justify-center rounded-r-lg shadow-lg transition-all duration-200"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          left: collapsed ? 0 : 224,
          width: 36,
          height: 44,
          background: '#0D1117',
          border: '1px solid rgba(201,168,76,.25)',
          borderLeft: 'none',
        }}
        title={collapsed ? "Ouvrir les filtres" : "Fermer les filtres"}
      >
        {collapsed ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round"><path d="M3 2l4 3-4 3"/></svg>
          </span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        )}
      </button>
    <aside
      className="flex flex-col border-r border-[rgba(201,168,76,.1)] bg-[#0D1117] shrink-0 overflow-y-auto transition-all duration-200"
      style={{ width: collapsed ? 0 : 224, minWidth: collapsed ? 0 : 224, overflow: collapsed ? 'hidden' : undefined }}
    >

      {/* Active filters badge */}
      {totalFilters > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(201,168,76,.2)] bg-[#C9A84C]/5">
          <span className="text-[10px] text-[#C9A84C] font-semibold">
            {totalFilters} {lang === 'fr' ? 'filtre(s) actif(s)' : `filter${totalFilters > 1 ? 's' : ''}`}
          </span>
          <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-white transition-colors">
            {lang === 'fr' ? '× Effacer' : '× Clear'}
          </button>
        </div>
      )}

      {/* Top-level categories */}
      <div className="p-3 border-b border-[rgba(201,168,76,.1)]">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{lang === 'fr' ? 'Catégorie' : 'Category'}</p>
        <div className="space-y-0.5">
          {CATEGORIES.map(cat => {
            const isNav = navCat === cat.id
            const isChecked = cat.id === 'all' ? selectedCats.size === 0 : selectedCats.has(cat.id)
            return (
              <div
                key={cat.id}
                className={`w-full flex items-center gap-0 rounded-lg transition-all`}
                style={isNav ? { outline: `1px solid ${cat.color}40` } : {}}
              >
                {/* Checkbox area */}
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="flex items-center gap-2 px-2 py-2 flex-1 text-left rounded-l-lg transition-colors hover:bg-white/5"
                  style={isNav ? { background: cat.color + '10' } : {}}
                >
                  <Checkbox checked={isChecked} color={cat.color} />
                  <span className="text-base leading-none">{cat.icon}</span>
                  <span className={`text-sm ${isNav ? 'font-medium' : 'text-gray-400'}`} style={isNav ? { color: cat.color } : {}}>
                    {L(cat, lang)}
                  </span>
                </button>
                {/* Navigate to sub-items */}
                {cat.id !== 'all' && SUBCATEGORIES[cat.id] && (
                  <button
                    onClick={() => navigateCat(cat.id as TradeCategory)}
                    className="px-2 py-2 text-gray-600 hover:text-gray-300 hover:bg-white/5 rounded-r-lg transition-colors"
                    title={lang === 'fr' ? 'Voir les matières' : 'Browse commodities'}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Sub-items panel */}
      {subGroups.length > 0 && (
        <div className="p-3 flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{lang === 'fr' ? 'Matières' : 'Commodities'}</p>
            <button onClick={() => setNavCat('all')} className="text-[9px] text-gray-600 hover:text-gray-300">{lang === 'fr' ? '← Retour' : '← Back'}</button>
          </div>
          <div className="space-y-0.5">
            {subGroups.map(group => (
              <div key={group.group}>
                <button
                  onClick={() => toggleGroup(group.group)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                >
                  <span className="font-semibold uppercase tracking-wide">{G(group, lang)}</span>
                  <span>{expandedGroup === group.group ? '▲' : '▼'}</span>
                </button>

                {expandedGroup === group.group && (
                  <div className="ml-1 mb-1">
                    {group.items.map(item => {
                      const hasVariants = !!(item.variants?.length)
                      const isItemChecked = selectedSubs.has(item.id)
                      const isItemExpanded = hasVariants && expandedItem === item.id

                      return (
                        <div key={item.id}>
                          <div className="flex items-center gap-0">
                            {/* Checkbox */}
                            {!hasVariants && (
                              <button
                                onClick={() => toggleSub(item.id, navCat)}
                                className="flex items-center pl-2 pr-1 py-1.5"
                              >
                                <Checkbox checked={isItemChecked} color={navColor} />
                              </button>
                            )}
                            <button
                              onClick={() => hasVariants
                                ? setExpandedItem(e => e === item.id ? null : item.id)
                                : toggleSub(item.id, navCat)
                              }
                              className={`flex-1 flex items-center justify-between gap-1.5 ${hasVariants ? 'pl-2' : 'pl-1'} pr-2.5 py-1.5 rounded-md text-xs transition-all text-left hover:bg-white/5`}
                              style={isItemChecked ? { color: navColor } : { color: '#9CA3AF' }}
                            >
                              <span className="truncate">{L(item, lang)}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {item.unit && <span className="text-[9px] text-gray-600">{item.unit}</span>}
                                {hasVariants && (
                                  <span className="text-[9px] text-gray-600">{isItemExpanded ? '▲' : '▶'}</span>
                                )}
                              </div>
                            </button>
                          </div>

                          {isItemExpanded && item.variants && (
                            <div className="ml-3 border-l border-white/5 pl-2 mb-1">
                              {item.variants.map(v => {
                                const isVChecked = selectedSubs.has(v.id)
                                return (
                                  <button
                                    key={v.id}
                                    onClick={() => toggleSub(v.id, navCat)}
                                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left transition-all hover:bg-white/5"
                                  >
                                    <Checkbox checked={isVChecked} color={navColor} />
                                    <div className="min-w-0">
                                      <div className="text-[11px] truncate" style={isVChecked ? { color: navColor } : { color: '#6B7280' }}>{L(v, lang)}</div>
                                      {v.note && (
                                        <div className="text-[9px] text-gray-600 truncate">{v.note}</div>
                                      )}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="p-3 border-t border-[rgba(201,168,76,.1)]">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{lang === 'fr' ? 'Balance commerciale' : 'Trade Balance'}</p>
        <div className="space-y-1 text-xs text-gray-400">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#22C55E]"/><span>{lang === 'fr' ? 'Excédent' : 'Surplus'}</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#EF4444]"/><span>{lang === 'fr' ? 'Déficit' : 'Deficit'}</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#6B7280]"/><span>{lang === 'fr' ? 'Pas de données' : 'No data'}</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#C9A84C]"/><span>{lang === 'fr' ? 'Opportunité' : 'Opportunity'}</span></div>
        </div>
      </div>

      {/* Gemini Pro shortcut */}
      <div className="p-3 border-t border-[rgba(201,168,76,.1)]">
        <a
          href="/gemini"
          className="flex items-center gap-2.5 w-full px-3 py-3 rounded-xl transition-all group"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.15) 100%)',
            border: '1px solid rgba(99,102,241,0.3)',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)')}
        >
          {/* Gemini G logo */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#4285F4,#34A853,#FBBC05,#EA4335)', padding: '2px' }}>
            <div className="w-full h-full rounded-md bg-[#0D1117] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">Gemini</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ background: 'linear-gradient(135deg,#4285F4,#A855F7)', color: 'white' }}>PRO</span>
            </div>
            <div className="text-[10px] text-gray-500">Chat IA · Connexion Google</div>
          </div>
          <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-400 shrink-0 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </a>
      </div>
    </aside>
    </>
  )
}
