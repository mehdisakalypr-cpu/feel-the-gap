'use client'

import { useState } from 'react'
import type { TradeCategory } from '@/types/database'

const CATEGORIES: { id: TradeCategory | 'all'; label: string; icon: string; color: string }[] = [
  { id: 'all',          label: 'All Markets',  icon: '🌐', color: '#C9A84C' },
  { id: 'agriculture',  label: 'Agri & Food',  icon: '🌾', color: '#22C55E' },
  { id: 'energy',       label: 'Energy',       icon: '⚡', color: '#F59E0B' },
  { id: 'materials',    label: 'Materials',    icon: '🪨', color: '#94A3B8' },
  { id: 'manufactured', label: 'Industrial',   icon: '🏭', color: '#60A5FA' },
  { id: 'resources',    label: 'Resources',    icon: '💧', color: '#38BDF8' },
]

interface Variant { id: string; label: string; note?: string }
interface SubItem  { id: string; label: string; unit?: string; variants?: Variant[] }
interface SubGroup { group: string; items: SubItem[] }


const SUBCATEGORIES: Record<string, SubGroup[]> = {

  // ── AGRICULTURE & FOOD ─────────────────────────────────────────────────
  agriculture: [
    {
      group: 'Cereals & Grains',
      items: [
        { id: 'wheat', label: 'Wheat', unit: '$/t', variants: [
          { id: 'wheat_hrw',   label: 'Hard Red Winter (HRW)',  note: 'Bread wheat — Kansas/Okla.' },
          { id: 'wheat_hrs',   label: 'Hard Red Spring (HRS)',  note: 'High protein — Dakotas' },
          { id: 'wheat_srw',   label: 'Soft Red Winter (SRW)',  note: 'Cake/pastry — Midwest' },
          { id: 'wheat_durum', label: 'Durum Wheat',            note: 'Pasta & semolina' },
          { id: 'wheat_white', label: 'White Wheat',            note: 'Noodles & flatbreads' },
          { id: 'wheat_feed',  label: 'Feed Wheat',             note: 'Animal feed grade' },
        ]},
        { id: 'corn', label: 'Corn / Maize', unit: '$/bu', variants: [
          { id: 'corn_yellow', label: 'Yellow Corn No. 2', note: 'CBOT benchmark' },
          { id: 'corn_white',  label: 'White Corn',        note: 'Human consumption' },
          { id: 'corn_waxy',   label: 'Waxy Maize',        note: 'High amylopectin starch' },
          { id: 'corn_feed',   label: 'Feed Grade Corn',   note: 'Livestock' },
        ]},
        { id: 'rice', label: 'Rice', unit: '$/t', variants: [
          { id: 'rice_white',     label: 'White Rice (25% broken)', note: 'Thai reference price' },
          { id: 'rice_parboiled', label: 'Parboiled Rice',          note: 'West Africa staple' },
          { id: 'rice_jasmine',   label: 'Jasmine / Fragrant',      note: 'Premium — Thailand' },
          { id: 'rice_basmati',   label: 'Basmati Rice',            note: 'Premium — India/Pak' },
          { id: 'rice_broken',    label: 'Broken Rice (100%)',      note: 'Feed / ethanol' },
          { id: 'rice_brown',     label: 'Brown Rice',              note: 'Whole grain, hull removed' },
        ]},
        { id: 'barley', label: 'Barley', unit: '$/t', variants: [
          { id: 'barley_malting', label: 'Malting Barley', note: 'Beer & whisky' },
          { id: 'barley_feed',    label: 'Feed Barley',    note: 'Livestock' },
        ]},
        { id: 'sorghum', label: 'Sorghum', unit: '$/t' },
        { id: 'oats',    label: 'Oats',    unit: '$/bu' },
        { id: 'millet',  label: 'Millet',  unit: '$/t' },
      ],
    },
    {
      group: 'Flours & Starches',
      items: [
        { id: 'wheat_flour', label: 'Wheat Flour', unit: '$/t', variants: [
          { id: 'flour_t45',     label: 'T45 (Pastry / Extra fine)', note: 'Croissants, viennoiseries' },
          { id: 'flour_t55',     label: 'T55 (All-purpose)',         note: 'Most common — baguettes' },
          { id: 'flour_t65',     label: 'T65 (Bread flour)',         note: 'Traditional breads' },
          { id: 'flour_t80',     label: 'T80 (Semi-wholemeal)',      note: 'Country loaves' },
          { id: 'flour_t150',    label: 'T150 (Whole wheat)',        note: 'Stone ground' },
          { id: 'flour_hl',      label: 'High-Gluten (>13% protein)',note: 'Pizza, bagels' },
          { id: 'flour_semolina',label: 'Durum Semolina',            note: 'Pasta & couscous' },
        ]},
        { id: 'corn_flour', label: 'Corn / Maize Flour', unit: '$/t', variants: [
          { id: 'cornflour_fine',  label: 'Fine Cornflour / Maizena', note: 'Thickener / starch' },
          { id: 'cornmeal_coarse', label: 'Coarse Cornmeal',          note: 'Polenta / ugali' },
          { id: 'masa_harina',     label: 'Masa Harina',              note: 'Nixtamalized — tortillas' },
          { id: 'cornstarch',      label: 'Corn Starch',              note: 'Industrial / food grade' },
        ]},
        { id: 'rice_flour', label: 'Rice Flour', unit: '$/t', variants: [
          { id: 'rice_flour_white', label: 'White Rice Flour',  note: 'Gluten-free baking' },
          { id: 'rice_starch',      label: 'Rice Starch',       note: 'Baby food / cosmetics' },
        ]},
        { id: 'cassava_flour', label: 'Cassava / Tapioca', unit: '$/t', variants: [
          { id: 'cassava_native',  label: 'Cassava Flour (native)', note: 'West/Central Africa staple' },
          { id: 'tapioca_starch',  label: 'Tapioca Starch',        note: 'Thailand export leader' },
          { id: 'tapioca_pearls',  label: 'Tapioca Pearls',        note: 'Bubble tea / puddings' },
        ]},
        { id: 'specialty_flour', label: 'Specialty Flours', unit: '$/kg', variants: [
          { id: 'flour_chickpea', label: 'Chickpea Flour / Besan', note: 'South Asia & ME' },
          { id: 'flour_sorghum',  label: 'Sorghum Flour',          note: 'W. Africa / gluten-free' },
          { id: 'flour_teff',     label: 'Teff Flour',             note: 'Ethiopia — injera bread' },
          { id: 'flour_almond',   label: 'Almond Flour',           note: 'Premium / keto' },
          { id: 'flour_coconut',  label: 'Coconut Flour',          note: 'SE Asia / gluten-free' },
          { id: 'flour_oat',      label: 'Oat Flour',              note: 'Breakfast / health food' },
          { id: 'flour_potato',   label: 'Potato Starch',          note: 'Thickener / industry' },
        ]},
      ],
    },
    {
      group: 'Dairy & Milk Products',
      items: [
        { id: 'milk_liquid', label: 'Liquid Milk', unit: '$/L', variants: [
          { id: 'milk_uht_whole',   label: 'UHT Whole Milk (3.5%)',      note: 'Long-life — 6 months shelf' },
          { id: 'milk_uht_semi',    label: 'UHT Semi-Skimmed (1.5%)',    note: 'EU export standard' },
          { id: 'milk_uht_skim',    label: 'UHT Skimmed (0.1%)',         note: 'Diet / fortified' },
          { id: 'milk_pasteurized', label: 'Pasteurized Fresh Milk',     note: 'Short shelf-life chilled' },
          { id: 'milk_evaporated',  label: 'Evaporated Milk (canned)',   note: 'W. Africa / Asia staple' },
          { id: 'milk_condensed',   label: 'Sweetened Condensed Milk',   note: 'Southeast Asia favourite' },
          { id: 'milk_flavoured',   label: 'Flavoured Milk (choc/straw)',note: 'Children / emerging markets' },
        ]},
        { id: 'milk_powder', label: 'Milk Powders', unit: '$/t', variants: [
          { id: 'smp',           label: 'Skim Milk Powder (SMP)',         note: 'GDT benchmark 25kg bags' },
          { id: 'wmp',           label: 'Whole Milk Powder (WMP)',        note: 'GDT benchmark' },
          { id: 'infant_stage1', label: 'Infant Formula Stage 1 (0-6M)', note: 'High-value, strict spec' },
          { id: 'infant_stage2', label: 'Follow-On Formula (6-12M)',      note: 'Stage 2' },
          { id: 'infant_stage3', label: 'Growing-Up Milk (1-3 yrs)',      note: 'Stage 3' },
          { id: 'amf',           label: 'Anhydrous Milk Fat (AMF)',       note: '99.8% fat' },
        ]},
        { id: 'butter_cream', label: 'Butter & Cream', unit: '$/t', variants: [
          { id: 'butter_82',    label: 'Unsalted Butter (82% fat)', note: 'LIFFE / NZX benchmark' },
          { id: 'butter_84',    label: 'High-Fat Butter (84%)',     note: 'Professional baking' },
          { id: 'butter_salted',label: 'Salted Butter',             note: 'Consumer pack' },
          { id: 'cream_heavy',  label: 'Heavy Cream (35%+)',        note: 'UHT / chilled' },
        ]},
        { id: 'cheese', label: 'Cheese', unit: '$/t', variants: [
          { id: 'cheddar',      label: 'Cheddar',          note: 'NZX / CME reference' },
          { id: 'gouda',        label: 'Gouda / Edam',     note: 'Netherlands export' },
          { id: 'mozzarella',   label: 'Mozzarella',       note: 'Pizza grade — block / shred' },
          { id: 'parmesan',     label: 'Parmesan / Grana', note: 'Italy — DOP premium' },
          { id: 'feta',         label: 'Feta',             note: 'Greece — PDO brine' },
          { id: 'processed_ch', label: 'Processed Cheese', note: 'Slices / spread — EM favourite' },
        ]},
        { id: 'whey_proteins', label: 'Whey & Proteins', unit: '$/t', variants: [
          { id: 'whey_sweet', label: 'Sweet Whey Powder',            note: 'Animal feed / food ingredient' },
          { id: 'wpc_35',     label: 'Whey Protein Conc. 35%',      note: 'Bakery / dairy drinks' },
          { id: 'wpc_80',     label: 'Whey Protein Conc. 80%',      note: 'Sports nutrition' },
          { id: 'wpi',        label: 'Whey Protein Isolate (90%+)', note: 'Premium sports / medical' },
          { id: 'casein',     label: 'Casein (micellar / acid)',     note: 'Cheese analogue / protein' },
          { id: 'lactose',    label: 'Lactose',                      note: 'Pharma / infant formula' },
        ]},
        { id: 'yogurt_ice', label: 'Yogurt & Ice Cream', unit: '$/kg', variants: [
          { id: 'yogurt_plain', label: 'Plain Yogurt (full / low-fat)', note: 'Set or stirred' },
          { id: 'yogurt_greek', label: 'Greek Yogurt (strained)',        note: '10%+ protein' },
          { id: 'kefir',        label: 'Kefir',                          note: 'Probiotic fermented milk' },
          { id: 'ice_cream',    label: 'Ice Cream',                      note: '>=10% milk fat' },
        ]},
      ],
    },
    {
      group: 'Meat by Type & Cut',
      items: [
        { id: 'beef', label: 'Beef', unit: 'c/lb', variants: [
          { id: 'beef_live',       label: 'Live Cattle (CME)',        note: '1,000-1,200 lb feeder' },
          { id: 'beef_90cl',       label: 'Boneless Beef 90CL',       note: 'Export trim — FOB' },
          { id: 'beef_chuck',      label: 'Chuck (shoulder)',         note: 'Ground beef / stew' },
          { id: 'beef_loin',       label: 'Loin / Sirloin',          note: 'Grilling / premium' },
          { id: 'beef_tenderloin', label: 'Tenderloin / Fillet',     note: 'Top value cut' },
          { id: 'beef_ribs',       label: 'Short Ribs / Back Ribs',  note: 'BBQ / foodservice' },
          { id: 'beef_brisket',    label: 'Brisket',                 note: 'BBQ — smoked' },
          { id: 'beef_offal',      label: 'Beef Offal (liver/tripe)', note: 'High demand in Africa/Asia' },
          { id: 'beef_halal',      label: 'Halal Beef',              note: 'ME / SE Asia premium' },
        ]},
        { id: 'poultry', label: 'Poultry', unit: '$/kg', variants: [
          { id: 'chicken_whole',   label: 'Whole Chicken',            note: 'Ready-to-cook' },
          { id: 'chicken_legs',    label: 'Leg Quarters',             note: 'Export — frozen FOB' },
          { id: 'chicken_breast',  label: 'Breast Meat (boneless)',   note: 'Premium cut' },
          { id: 'chicken_wings',   label: 'Chicken Wings',            note: 'High demand Asia / US' },
          { id: 'chicken_halal',   label: 'Halal Chicken',            note: 'Brazil / Malaysia export' },
          { id: 'turkey',          label: 'Turkey',                   note: 'Whole / breast / cold cuts' },
          { id: 'duck',            label: 'Duck',                     note: 'Whole / breast — Asia premium' },
          { id: 'chicken_nuggets', label: 'Processed Poultry',        note: 'Breaded / value-added' },
        ]},
        { id: 'pork', label: 'Pork', unit: 'c/lb', variants: [
          { id: 'pork_lean_hogs', label: 'Lean Hogs (CME)',    note: 'Futures benchmark' },
          { id: 'pork_loin',      label: 'Pork Loin',          note: 'Chops / roast' },
          { id: 'pork_belly',     label: 'Pork Belly',         note: 'Bacon / Asian cuisine' },
          { id: 'pork_shoulder',  label: 'Pork Shoulder',      note: 'Pulled pork / stew' },
          { id: 'pork_ham',       label: 'Ham (fresh / cured)',note: 'Retail / deli' },
          { id: 'pork_offal',     label: 'Pork Offal & Trotters', note: 'Asia & W. Africa demand' },
          { id: 'bacon',          label: 'Bacon (streaky / back)', note: 'Processed meat' },
        ]},
        { id: 'lamb', label: 'Lamb & Mutton', unit: '$/kg', variants: [
          { id: 'lamb_whole',   label: 'Whole Lamb / Carcass', note: 'Halal — NZ/Australia FOB' },
          { id: 'lamb_leg',     label: 'Leg of Lamb',          note: 'Premium retail cut' },
          { id: 'lamb_rack',    label: 'Rack of Lamb',         note: 'Restaurant premium' },
          { id: 'lamb_chops',   label: 'Loin Chops',           note: 'Grilling' },
          { id: 'mutton',       label: 'Mutton (>2 yrs)',      note: 'ME / S. Asia demand' },
          { id: 'lamb_halal',   label: 'Halal Lamb',           note: 'ME / North Africa' },
        ]},
        { id: 'goat', label: 'Goat Meat', unit: '$/kg' },
        { id: 'processed_meat', label: 'Processed Meats', unit: '$/kg', variants: [
          { id: 'sausages',    label: 'Sausages (pork / chicken)',   note: 'Fresh & smoked' },
          { id: 'hot_dogs',    label: 'Hot Dogs / Frankfurters',     note: 'Emulsified' },
          { id: 'deli_meats',  label: 'Deli / Cold Cuts',            note: 'Ham, mortadella, salami' },
          { id: 'corned_beef', label: 'Corned Beef (canned)',        note: 'Africa / Pacific staple' },
        ]},
      ],
    },
    {
      group: 'Fish & Seafood by Species',
      items: [
        { id: 'tuna', label: 'Tuna', unit: '$/kg', variants: [
          { id: 'tuna_skipjack',  label: 'Skipjack Tuna',              note: 'Canned — Pacific benchmark' },
          { id: 'tuna_yellowfin', label: 'Yellowfin (Ahi)',            note: 'Fresh / frozen sashimi grade' },
          { id: 'tuna_bigeye',    label: 'Bigeye Tuna',               note: 'High-grade sashimi — Tokyo' },
          { id: 'tuna_bluefin',   label: 'Bluefin (Atl. / Pacific)',  note: 'Ultra-premium — Tsukiji ref.' },
          { id: 'tuna_albacore',  label: 'Albacore (White Tuna)',     note: 'Canned white tuna' },
          { id: 'canned_tuna',    label: 'Canned Tuna (in brine)',    note: 'FOB Thailand / Ecuador' },
        ]},
        { id: 'salmon', label: 'Salmon', unit: '$/kg', variants: [
          { id: 'salmon_atl_farmed', label: 'Atlantic Salmon (farmed)',note: 'Norway/Chile — Nasdaq Salmon' },
          { id: 'salmon_pac_wild',   label: 'Pacific Salmon (wild)',  note: 'Sockeye, Pink, Coho — Alaska' },
          { id: 'salmon_smoked',     label: 'Smoked Salmon',          note: 'Cold / hot smoked — premium' },
          { id: 'salmon_trout',      label: 'Rainbow Trout',          note: 'Farmed — freshwater' },
        ]},
        { id: 'whitefish', label: 'White Fish (Demersal)', unit: '$/kg', variants: [
          { id: 'cod',       label: 'Atlantic Cod',       note: 'Norway / Iceland — filets / blocks' },
          { id: 'haddock',   label: 'Haddock',            note: 'UK favourite — smoked / fresh' },
          { id: 'pollock',   label: 'Alaska Pollock',     note: 'Surimi / fast food filet' },
          { id: 'hake',      label: 'Hake (Merluccius)', note: 'Spain / S.Africa — fresh / frozen' },
          { id: 'pangasius', label: 'Pangasius / Basa',  note: 'Vietnam farmed — budget white fish' },
          { id: 'tilapia',   label: 'Tilapia',           note: 'Africa / China farmed' },
          { id: 'sole',      label: 'Sole / Plaice',     note: 'Premium flatfish' },
          { id: 'halibut',   label: 'Halibut',           note: 'Premium North Atlantic / Pacific' },
        ]},
        { id: 'small_pelagics', label: 'Small Pelagic Fish', unit: '$/t', variants: [
          { id: 'sardine',  label: 'Sardine / Pilchard', note: 'Morocco / EU — canned & fresh' },
          { id: 'anchovy',  label: 'Anchovy (Engraulis)',note: 'Peru fishmeal feedstock' },
          { id: 'mackerel', label: 'Atlantic Mackerel',  note: 'Norway — frozen export' },
          { id: 'herring',  label: 'Herring',            note: 'North Sea — fresh / cured / smoked' },
        ]},
        { id: 'shrimp_prawn', label: 'Shrimp & Prawns', unit: '$/kg', variants: [
          { id: 'vannamei',        label: 'L. Vannamei (Pacific White)',   note: 'Farmed — Ecuador / Asia dominant' },
          { id: 'black_tiger',     label: 'Black Tiger Prawn (P.monodon)',note: 'SE Asia farmed — premium' },
          { id: 'cold_water_shrimp',label: 'Cold Water Shrimp',           note: 'Greenland / Canada — Pandalus' },
          { id: 'cooked_shrimp',   label: 'Cooked Peeled Shrimp (IQF)',  note: 'Retail — 31/40 count' },
        ]},
        { id: 'cephalopods', label: 'Cephalopods', unit: '$/kg', variants: [
          { id: 'squid',      label: 'Squid / Calamari', note: 'Illex (Arg.) / Loligo (EU)' },
          { id: 'octopus',    label: 'Octopus',          note: 'Morocco / Japan — boiled / frozen' },
          { id: 'cuttlefish', label: 'Cuttlefish',       note: 'SE Asia — dried / frozen' },
        ]},
        { id: 'shellfish', label: 'Shellfish & Molluscs', unit: '$/kg', variants: [
          { id: 'oysters',  label: 'Oysters',    note: 'Pacific / Atlantic — live / half shell' },
          { id: 'mussels',  label: 'Mussels',    note: 'Farmed — Chile / NZ / EU' },
          { id: 'scallops', label: 'Scallops',   note: 'Bay / sea — IQF frozen meat' },
          { id: 'crab',     label: 'Crab',       note: 'King / Snow / Blue — live / frozen' },
          { id: 'lobster',  label: 'Lobster',    note: 'Maine / Spiny — live export' },
        ]},
        { id: 'processed_fish', label: 'Processed Fish Products', unit: '$/t', variants: [
          { id: 'fish_fillet_frozen', label: 'Frozen Fish Fillets (IQF)', note: 'Pollock / hake / tilapia blocks' },
          { id: 'surimi',             label: 'Surimi',                    note: 'Crab sticks — Japan / Russia' },
          { id: 'fish_meal',          label: 'Fish Meal (65% protein)',   note: 'Peru anchovy — feed' },
          { id: 'fish_oil',           label: 'Fish Oil (crude)',          note: 'Omega-3 / aquafeed' },
          { id: 'dried_salted_fish',  label: 'Dried / Salted Fish',      note: 'Stockfish / codfish — W.Africa' },
          { id: 'canned_sardines',    label: 'Canned Sardines',          note: 'Morocco dominant exporter' },
        ]},
      ],
    },
    {
      group: 'Soft Commodities',
      items: [
        { id: 'cacao', label: 'Cacao / Cocoa', unit: '$/t', variants: [
          { id: 'cocoa_ivorian',    label: "Ivoirien (Cote d Ivoire)",  note: 'Bulk — 40% world supply' },
          { id: 'cocoa_ghanaian',   label: 'Ghanaian Grade 1',          note: 'Premium — Ashanti' },
          { id: 'cocoa_ecuador',    label: 'Ecuador Arriba (Fino)',      note: 'Fine flavour — floral notes' },
          { id: 'cocoa_madagascar', label: 'Madagascar Criollo',        note: 'Ultra-premium, fruity' },
          { id: 'cocoa_butter',     label: 'Cocoa Butter',              note: 'Processed — cosmetics / choc' },
          { id: 'cocoa_powder',     label: 'Cocoa Powder',              note: 'Natural (pH 5) / Dutched (pH 7)' },
          { id: 'cocoa_liquor',     label: 'Cocoa Liquor / Mass',       note: 'Chocolate production' },
        ]},
        { id: 'coffee', label: 'Coffee', unit: '$/lb', variants: [
          { id: 'coffee_arabica_c',  label: 'Arabica C (ICE NY)',           note: 'World benchmark' },
          { id: 'coffee_colombian',  label: 'Colombian Mild Arabica',       note: 'Huila / Nariño / Antioquia' },
          { id: 'coffee_ethiopian',  label: 'Ethiopian Arabica',            note: 'Yirgacheffe / Sidamo / Harrar' },
          { id: 'coffee_kenyan',     label: 'Kenyan AA / AB',              note: 'Bright acidity — auction' },
          { id: 'coffee_brazilian',  label: 'Brazilian Natural (Santos)',   note: 'NY2/3 — most traded' },
          { id: 'coffee_robusta',    label: 'Robusta (ICE London)',         note: 'Instant / espresso blends' },
          { id: 'coffee_viet',       label: 'Vietnamese Robusta',           note: 'Grade 2 — world 2nd exporter' },
          { id: 'coffee_instant',    label: 'Instant Coffee (spray-dried)', note: 'Emerging market dominant' },
        ]},
        { id: 'tea', label: 'Tea', unit: '$/kg', variants: [
          { id: 'tea_ctc',     label: 'CTC Black Tea',       note: 'Kenya / Assam — Mombasa auction' },
          { id: 'tea_orthodox',label: 'Orthodox Black Tea',  note: 'Darjeeling / Ceylon FBOP' },
          { id: 'tea_green',   label: 'Green Tea',           note: 'Sencha / Gunpowder — China / Japan' },
          { id: 'tea_white',   label: 'White Tea',           note: 'Silver Needle — premium' },
          { id: 'tea_bag',     label: 'Tea Bags (finished)', note: 'Branded / private label' },
        ]},
        { id: 'vanilla',  label: 'Vanilla',      unit: '$/kg' },
        { id: 'pepper',   label: 'Black Pepper', unit: '$/kg', variants: [
          { id: 'pepper_black', label: 'Black Pepper', note: 'Vietnam dominant exporter' },
          { id: 'pepper_white', label: 'White Pepper', note: 'Indonesia / Malaysia' },
        ]},
        { id: 'cashews', label: 'Cashews (RCN)', unit: '$/t', variants: [
          { id: 'rcn',           label: 'Raw Cashew Nuts (RCN)',       note: 'W. Africa FOB' },
          { id: 'cashew_kernel', label: 'Cashew Kernels (W240/W320)', note: 'Vietnam processed' },
        ]},
      ],
    },
    {
      group: 'Oilseeds & Oils',
      items: [
        { id: 'soybeans', label: 'Soybeans', unit: '$/bu', variants: [
          { id: 'soy_beans', label: 'Soybeans (CBOT)',  note: 'US No. 2 Yellow' },
          { id: 'soy_meal',  label: 'Soybean Meal 48%',note: 'Animal protein feed' },
          { id: 'soy_oil',   label: 'Soybean Oil',      note: 'Refined / crude' },
        ]},
        { id: 'palm_oil', label: 'Palm Oil', unit: '$/t', variants: [
          { id: 'palm_cpo',    label: 'Crude Palm Oil (CPO)',  note: 'Bursa Malaysia ref.' },
          { id: 'palm_rbd',    label: 'RBD Palm Olein',        note: 'Refined — edible cooking oil' },
          { id: 'palm_kernel', label: 'Palm Kernel Oil (PKO)', note: 'Lauric oil — soaps / food' },
          { id: 'palm_stearin',label: 'Palm Stearin',          note: 'Hard fraction — margarine / soap' },
        ]},
        { id: 'sunflower', label: 'Sunflower Oil', unit: '$/t', variants: [
          { id: 'sunfl_crude',     label: 'Crude Sunflower Oil',    note: 'Ukraine / Russia dominant' },
          { id: 'sunfl_refined',   label: 'Refined Sunflower Oil',  note: 'Bottled / foodservice' },
          { id: 'sunfl_higholeic', label: 'High-Oleic Sunflower',   note: 'Extended fry life' },
        ]},
        { id: 'olive_oil', label: 'Olive Oil', unit: '$/t', variants: [
          { id: 'evoo',         label: 'Extra Virgin (EVOO)',  note: '<=0.8% acidity' },
          { id: 'virgin_olive', label: 'Virgin Olive Oil',    note: '<=2% acidity' },
          { id: 'refined_olive',label: 'Refined Olive Oil',   note: 'Industrial / blending' },
        ]},
        { id: 'canola', label: 'Canola / Rapeseed', unit: '$/t' },
      ],
    },
    {
      group: 'Sugar & Sweeteners',
      items: [
        { id: 'sugar', label: 'Sugar', unit: 'c/lb', variants: [
          { id: 'sugar_11',   label: 'Raw Cane Sugar #11', note: 'ICE benchmark FOB' },
          { id: 'sugar_5',    label: 'White Sugar #5',     note: 'London / EU refined' },
          { id: 'sugar_beet', label: 'Beet Sugar',         note: 'EU / Ukraine origin' },
        ]},
        { id: 'molasses', label: 'Molasses', unit: '$/t' },
        { id: 'honey',    label: 'Honey',    unit: '$/kg' },
      ],
    },
    {
      group: 'Fiber & Industrial Crops',
      items: [
        { id: 'cotton', label: 'Cotton', unit: 'c/lb', variants: [
          { id: 'cotton_els',label: 'Extra-Long Staple (ELS)', note: 'Pima / Giza >=36mm — luxury' },
          { id: 'cotton_ms', label: 'Medium Staple',           note: 'ICE Cotton #2 >=28mm' },
          { id: 'cotton_ss', label: 'Short Staple',            note: '<26mm — industrial / recycled' },
        ]},
        { id: 'jute',    label: 'Jute',    unit: '$/t' },
        { id: 'tobacco', label: 'Tobacco', unit: '$/kg', variants: [
          { id: 'tobacco_flue',    label: 'Flue-Cured Virginia', note: 'Cigarettes — Zimbabwe / Brazil' },
          { id: 'tobacco_burley',  label: 'Burley Tobacco',      note: 'Blending — Malawi / USA' },
          { id: 'tobacco_oriental',label: 'Oriental / Turkish',  note: 'Aromatic — Greece / Turkey' },
        ]},
      ],
    },
  ],

  // ── ENERGY ───────────────────────────────────────────────────────────────
  energy: [
    {
      group: 'Crude Oil',
      items: [
        { id: 'crude_oil', label: 'Crude Oil', unit: '$/bbl', variants: [
          { id: 'brent',      label: 'Brent Crude',           note: 'ICE — 38.3 deg API, 0.37% S' },
          { id: 'wti',        label: 'WTI (Light Sweet)',     note: 'NYMEX — 39.6 deg API, 0.24% S' },
          { id: 'dubai',      label: 'Dubai / Oman',          note: 'Asia benchmark — 31 deg API' },
          { id: 'opec',       label: 'OPEC Reference Basket', note: 'Avg. 13 OPEC crudes' },
          { id: 'urals',      label: 'Urals (Russia)',        note: 'Medium sour 31 deg API, 1.5% S' },
          { id: 'heavy_sour', label: 'Heavy Sour (<20 API)', note: 'Venezuela / Canada tar sands' },
          { id: 'bonny',      label: 'Bonny Light (Nigeria)', note: 'W. Africa sweet 33 deg API' },
        ]},
      ],
    },
    {
      group: 'Petroleum Products',
      items: [
        { id: 'diesel', label: 'Diesel / Gasoil', unit: '$/t', variants: [
          { id: 'ulsd',   label: 'ULSD 10ppm (EU / US spec)', note: 'Premium — clean air standards' },
          { id: 'ls50',   label: 'Low Sulphur 50ppm',         note: 'Emerging market standard' },
          { id: 'ice_go', label: 'ICE Gasoil 0.1%',           note: 'Heating — ICE London ref.' },
        ]},
        { id: 'gasoline', label: 'Gasoline', unit: '$/t', variants: [
          { id: 'ron95', label: 'RON 95 Gasoline', note: 'European standard' },
          { id: 'ron92', label: 'RON 92 Gasoline', note: 'Emerging markets' },
          { id: 'rbob',  label: 'RBOB (US)',        note: 'NY Harbor NYMEX' },
        ]},
        { id: 'jet_fuel', label: 'Jet Fuel (Jet-A1)', unit: '$/t' },
        { id: 'fuel_oil', label: 'Fuel Oil (Bunker)', unit: '$/t', variants: [
          { id: 'hsfo',  label: 'HSFO 380 CST', note: '3.5% S — pre-IMO 2020' },
          { id: 'vlsfo', label: 'VLSFO 0.5%',   note: 'IMO 2020 compliant' },
          { id: 'lsfo',  label: 'LSFO 0.1%',    note: 'Low sulfur marine' },
        ]},
        { id: 'lpg', label: 'LPG / Bottled Gas', unit: '$/t', variants: [
          { id: 'propane', label: 'Propane (CP)',   note: 'Saudi Aramco ref.' },
          { id: 'butane',  label: 'Butane (CP)',    note: 'Cooking cylinders — Africa / Asia' },
          { id: 'lpg_mix', label: 'LPG Mix 50/50', note: 'Domestic cylinders' },
        ]},
        { id: 'naphtha', label: 'Naphtha',  unit: '$/t' },
        { id: 'bitumen', label: 'Bitumen',  unit: '$/t' },
      ],
    },
    {
      group: 'Natural Gas',
      items: [
        { id: 'lng', label: 'LNG / Natural Gas', unit: '$/MMBtu', variants: [
          { id: 'jkm',       label: 'LNG Spot JKM',   note: 'Japan / Korea Marker' },
          { id: 'ttf',       label: 'TTF (Europe)',    note: 'Dutch hub benchmark' },
          { id: 'henry_hub', label: 'Henry Hub (US)',  note: 'NYMEX benchmark' },
        ]},
      ],
    },
    {
      group: 'Coal',
      items: [
        { id: 'coal', label: 'Coal', unit: '$/t', variants: [
          { id: 'thermal_api2', label: 'Thermal Coal (API2)',    note: 'ARA — 6,000 kcal/kg' },
          { id: 'thermal_newc', label: 'NEWC Thermal',           note: 'Newcastle Australia' },
          { id: 'met_hcc',      label: 'Coking Coal (PLV HCC)', note: 'Metallurgical 64 CSR' },
          { id: 'anthracite',   label: 'Anthracite',             note: '>90% carbon' },
        ]},
      ],
    },
    {
      group: 'Power & Clean Energy',
      items: [
        { id: 'electricity', label: 'Electricity',  unit: '$/MWh' },
        { id: 'uranium',     label: 'Uranium U3O8', unit: '$/lb' },
        { id: 'solar',       label: 'Solar Panels',  unit: '$/W', variants: [
          { id: 'solar_mono', label: 'Monocrystalline', note: '22-24% eff.' },
          { id: 'solar_poly', label: 'Polycrystalline', note: '17-20% eff.' },
        ]},
        { id: 'wind', label: 'Wind Turbines', unit: '$/kW', variants: [
          { id: 'wind_onshore',  label: 'Onshore',  note: '2-6 MW' },
          { id: 'wind_offshore', label: 'Offshore', note: '8-15 MW' },
        ]},
      ],
    },
  ],

  // ── MATERIALS ────────────────────────────────────────────────────────────
  materials: [
    {
      group: 'Precious Metals',
      items: [
        { id: 'gold', label: 'Gold', unit: '$/troy oz', variants: [
          { id: 'gold_9999', label: '999.9 Fine / 24K',    note: 'Good Delivery bar (400 oz)' },
          { id: 'gold_995',  label: '995 Fine (24K)',       note: 'Std bars 1g - 12.5kg' },
          { id: 'gold_22k',  label: '916 / 22K',           note: 'Coins & jewelry blanks' },
          { id: 'gold_18k',  label: '750 / 18K',           note: 'Fine jewelry' },
          { id: 'gold_14k',  label: '585 / 14K',           note: 'Fashion jewelry' },
          { id: 'gold_dore', label: 'Dore Bars (mining)',  note: 'Unrefined 60-90% Au' },
        ]},
        { id: 'silver', label: 'Silver', unit: '$/troy oz', variants: [
          { id: 'silver_999', label: '999 Fine (spot)',    note: 'LBMA benchmark' },
          { id: 'silver_925', label: '925 Sterling',       note: 'Jewelry / silverware' },
          { id: 'silver_ind', label: 'Industrial Silver',  note: 'Electronics / solar pastes' },
        ]},
        { id: 'platinum', label: 'Platinum', unit: '$/troy oz' },
        { id: 'palladium',label: 'Palladium', unit: '$/troy oz' },
        { id: 'rhodium',  label: 'Rhodium',   unit: '$/troy oz' },
      ],
    },
    {
      group: 'Base Metals (LME)',
      items: [
        { id: 'copper', label: 'Copper', unit: '$/t', variants: [
          { id: 'cu_cathode',  label: 'Cathodes Grade A',     note: 'LME 99.99%' },
          { id: 'cu_conc',     label: 'Concentrate (30% Cu)', note: 'Mine output CIF' },
          { id: 'cu_wire_rod', label: 'Wire Rod 8mm',         note: 'Electro-refinery' },
          { id: 'cu_scrap',    label: 'Scrap (Birch/Cliff)',  note: 'No.1 / No.2' },
        ]},
        { id: 'aluminium', label: 'Aluminium', unit: '$/t', variants: [
          { id: 'al_primary', label: 'Primary Ingots',   note: 'LME 99.7%' },
          { id: 'al_alloy',   label: 'Secondary Alloy',  note: 'Automotive recycled' },
          { id: 'al_oxide',   label: 'Alumina (Al2O3)',  note: 'Refinery feedstock' },
        ]},
        { id: 'nickel', label: 'Nickel', unit: '$/t', variants: [
          { id: 'ni_class1',   label: 'Class I (99.8%+)',      note: 'LME electrolytic' },
          { id: 'ni_npi',      label: 'Nickel Pig Iron (NPI)', note: '8-12% Ni — Indonesia / China' },
          { id: 'ni_feni',     label: 'Ferronickel (FeNi)',    note: '20-40% Ni — stainless' },
          { id: 'ni_sulfate',  label: 'Nickel Sulfate',        note: 'Battery grade precursor' },
          { id: 'ni_laterite', label: 'Laterite Ore',          note: 'Low-grade oxide ore' },
          { id: 'ni_sulfide',  label: 'Sulfide Concentrate',   note: 'High-grade mine output' },
        ]},
        { id: 'zinc',   label: 'Zinc',   unit: '$/t' },
        { id: 'lead',   label: 'Lead',   unit: '$/t' },
        { id: 'tin',    label: 'Tin',    unit: '$/t' },
        { id: 'cobalt', label: 'Cobalt', unit: '$/t', variants: [
          { id: 'co_metal',  label: 'Cobalt Metal 99.8%', note: 'MB standard grade' },
          { id: 'co_sulfate',label: 'Cobalt Sulfate',     note: 'Battery precursor' },
          { id: 'co_mhp',    label: 'Mixed Hydroxide (MHP)', note: 'DRC mine output' },
        ]},
      ],
    },
    {
      group: 'Battery & Tech Metals',
      items: [
        { id: 'lithium', label: 'Lithium', unit: '$/t', variants: [
          { id: 'li_carb', label: 'Li2CO3 Battery Grade 99.5%', note: 'Fastmarkets ref.' },
          { id: 'li_oh',   label: 'LiOH Monohydrate',           note: 'NMC / NCA batteries' },
          { id: 'li_spod', label: 'Spodumene 6% Li2O',          note: 'Australia CIF China' },
        ]},
        { id: 'rare_earths', label: 'Rare Earths', unit: '$/kg', variants: [
          { id: 'ndpr', label: 'NdPr Oxide',       note: 'EV motors — China 99%' },
          { id: 'dy',   label: 'Dysprosium Dy2O3', note: 'High-temp magnets' },
          { id: 'ce',   label: 'Cerium CeO2',      note: 'Polishing / catalysts' },
        ]},
        { id: 'graphite',  label: 'Graphite', unit: '$/t', variants: [
          { id: 'gr_flake', label: 'Flake +80 mesh',     note: 'Natural — Mozambique' },
          { id: 'gr_sph',   label: 'Spherical Graphite', note: 'Battery anode' },
          { id: 'gr_synth', label: 'Synthetic Graphite', note: 'High purity EV' },
        ]},
        { id: 'manganese', label: 'Manganese', unit: '$/t' },
        { id: 'vanadium',  label: 'Vanadium',  unit: '$/kg' },
      ],
    },
    {
      group: 'Iron & Steel',
      items: [
        { id: 'iron_ore', label: 'Iron Ore', unit: '$/t', variants: [
          { id: 'fe62',   label: 'Fines 62% Fe', note: 'SGX / DCE benchmark' },
          { id: 'fe65',   label: 'Fines 65% Fe', note: 'High-grade premium' },
          { id: 'pellet', label: 'Pellets 65%',  note: 'DRI / BF grade' },
          { id: 'lump',   label: 'Lump 64%',     note: 'Direct charge' },
        ]},
        { id: 'flat_steel', label: 'Flat Steel', unit: '$/t', variants: [
          { id: 'hrc', label: 'Hot-Rolled Coil (HRC)', note: 'China export FOB' },
          { id: 'crc', label: 'Cold-Rolled (CRC)',      note: 'Auto / appliances' },
          { id: 'hdg', label: 'Hot-Dip Galvanized',     note: 'Construction' },
        ]},
        { id: 'long_steel', label: 'Long Steel', unit: '$/t', variants: [
          { id: 'rebar',    label: 'Rebar',         note: 'Construction 10-32mm' },
          { id: 'wire_rod', label: 'Wire Rod',      note: '5.5-12mm drawing' },
          { id: 'billets',  label: 'Steel Billets', note: '130mm2 continuous cast' },
        ]},
        { id: 'stainless', label: 'Stainless Steel', unit: '$/t', variants: [
          { id: 'ss304', label: 'SS 304 (18/8)',     note: 'Food / medical' },
          { id: 'ss316', label: 'SS 316 (Mo grade)', note: 'Marine / chemical' },
          { id: 'ss430', label: 'SS 430 (ferritic)', note: 'Automotive / appliances' },
        ]},
        { id: 'scrap_steel', label: 'Steel Scrap', unit: '$/t', variants: [
          { id: 'hms',      label: 'HMS 1&2 (80/20)', note: 'International ref.' },
          { id: 'shredded', label: 'Shredded Scrap',  note: 'High bulk density' },
        ]},
      ],
    },
    {
      group: 'Timber & Forest Products',
      items: [
        { id: 'tropical_hw', label: 'Tropical Hardwood', unit: '$/m3', variants: [
          { id: 'teak',    label: 'Teak',       note: 'Myanmar / India — premium' },
          { id: 'iroko',   label: 'Iroko',      note: 'W. Africa — mahogany-like' },
          { id: 'sapele',  label: 'Sapele',     note: 'W. Africa — furniture' },
          { id: 'meranti', label: 'Meranti',    note: 'SE Asia — plywood' },
          { id: 'merbau',  label: 'Merbau',     note: 'SE Asia — flooring' },
          { id: 'wenge',   label: 'Wenge',      note: 'Congo — luxury flooring' },
          { id: 'ebony',   label: 'Ebony',      note: 'Very rare — instruments' },
        ]},
        { id: 'temperate_hw', label: 'Temperate Hardwood', unit: '$/m3', variants: [
          { id: 'oak',    label: 'Oak (Euro / American)', note: 'Furniture / flooring' },
          { id: 'beech',  label: 'Beech',                note: 'Plywood / furniture' },
          { id: 'ash',    label: 'Ash',                  note: 'Tools / sports' },
          { id: 'walnut', label: 'Walnut',               note: 'Premium furniture' },
          { id: 'maple',  label: 'Hard Maple',           note: 'Flooring / sports' },
        ]},
        { id: 'softwood', label: 'Softwood / Conifer', unit: '$/m3', variants: [
          { id: 'pine_radiata', label: 'Radiata Pine',       note: 'Chile / NZ / Australia' },
          { id: 'spf',          label: 'SPF (Spruce-Pine-Fir)', note: 'Canada construction' },
          { id: 'cedar',        label: 'Western Red Cedar',  note: 'Cladding / decking' },
          { id: 'douglas_fir',  label: 'Douglas Fir',        note: 'US West — structural' },
        ]},
        { id: 'wood_pulp', label: 'Wood Pulp', unit: '$/t', variants: [
          { id: 'bhkp', label: 'BHKP (Hardwood Kraft)', note: 'Brazil / Chile — tissue' },
          { id: 'nbsk', label: 'NBSK (Softwood Kraft)', note: 'Canada — packaging' },
        ]},
        { id: 'bamboo',   label: 'Bamboo',   unit: '$/t' },
        { id: 'charcoal', label: 'Charcoal', unit: '$/t' },
      ],
    },
    {
      group: 'Industrial Chemicals',
      items: [
        { id: 'acids', label: 'Industrial Acids', unit: '$/t', variants: [
          { id: 'h2so4',  label: 'Sulfuric Acid (H2SO4)',  note: 'Most used industrial chemical' },
          { id: 'hcl',    label: 'Hydrochloric Acid (HCl)',note: '30-33% solution' },
          { id: 'hno3',   label: 'Nitric Acid (HNO3)',     note: 'Fertilizers / explosives' },
          { id: 'h3po4',  label: 'Phosphoric Acid',        note: '54% P2O5 — fertilizer grade' },
          { id: 'acetic', label: 'Acetic Acid (99%)',       note: 'Glacial — PET / PTA feedstock' },
        ]},
        { id: 'alkalis', label: 'Alkalis & Salts', unit: '$/t', variants: [
          { id: 'naoh',   label: 'Caustic Soda (NaOH)',  note: 'Membrane grade 99%' },
          { id: 'na2co3', label: 'Soda Ash (Na2CO3)',    note: 'Dense / light — glass / detergent' },
          { id: 'nahco3', label: 'Sodium Bicarbonate',   note: 'Food / pharma / fire ext.' },
        ]},
        { id: 'solvents', label: 'Solvents', unit: '$/t', variants: [
          { id: 'methanol', label: 'Methanol',          note: 'MTBE / biodiesel / formaldehyde' },
          { id: 'ethanol',  label: 'Ethanol (industrial)',note: 'Anhydrous 99.5%' },
          { id: 'acetone',  label: 'Acetone',           note: 'Coatings / pharma' },
          { id: 'ipa',      label: 'IPA (Isopropanol)', note: 'Pharma / sanitizers' },
          { id: 'toluene',  label: 'Toluene',           note: 'Paints / adhesives' },
        ]},
        { id: 'aromatics', label: 'Aromatics / Petrochemicals', unit: '$/t', variants: [
          { id: 'benzene',   label: 'Benzene',        note: 'Styrene / nylon feedstock' },
          { id: 'px',        label: 'Paraxylene (PX)',note: 'PTA — PET bottles' },
          { id: 'styrene',   label: 'Styrene (SM)',   note: 'Polystyrene / ABS' },
          { id: 'ethylene',  label: 'Ethylene',       note: 'PE / PVC / PET' },
          { id: 'propylene', label: 'Propylene',      note: 'PP / acrylics' },
        ]},
        { id: 'ammonia', label: 'Ammonia (NH3)', unit: '$/t' },
        { id: 'chlorine',label: 'Chlorine',      unit: '$/t' },
      ],
    },
    {
      group: 'Specialty Chemicals',
      items: [
        { id: 'dyes_pigments', label: 'Dyes & Pigments', unit: '$/kg', variants: [
          { id: 'reactive_dyes', label: 'Reactive Dyes',         note: 'Cotton dyeing — China dominant' },
          { id: 'disperse_dyes', label: 'Disperse Dyes',         note: 'Polyester — high temp' },
          { id: 'tio2',          label: 'Titanium Dioxide (TiO2)',note: 'White pigment — paints / plastics' },
          { id: 'carbon_black',  label: 'Carbon Black (N330)',   note: 'Tire rubber reinforcement' },
        ]},
        { id: 'surfactants', label: 'Surfactants / Detergents', unit: '$/t', variants: [
          { id: 'las',      label: 'LAS (Linear Alkylbenzene Sulfonate)', note: 'Anionic — household detergent' },
          { id: 'sles',     label: 'SLES 70%',                           note: 'Shampoo / shower gel' },
          { id: 'fatty_alc',label: 'Fatty Alcohols (C12-C18)',           note: 'Emulsifier / personal care' },
        ]},
        { id: 'paints_coatings', label: 'Paints & Coatings', unit: '$/t', variants: [
          { id: 'architectural', label: 'Architectural Paint (emulsion)', note: 'Water-based — consumer' },
          { id: 'industrial_coat',label: 'Industrial Coatings (epoxy)',  note: 'Anti-corrosion' },
          { id: 'marine_paint',  label: 'Marine Coatings',               note: 'Anti-fouling' },
        ]},
        { id: 'adhesives',label: 'Adhesives & Sealants',                unit: '$/t' },
        { id: 'silicones',label: 'Silicones (PDMS)',                    unit: '$/kg' },
      ],
    },
    {
      group: 'Fertilizers',
      items: [
        { id: 'urea',   label: 'Urea (46% N)',  unit: '$/t' },
        { id: 'dap',    label: 'DAP (18-46-0)', unit: '$/t' },
        { id: 'potash', label: 'Potash MOP',    unit: '$/t' },
        { id: 'npk',    label: 'NPK Complex',   unit: '$/t' },
        { id: 'sulphur',label: 'Sulphur',        unit: '$/t' },
      ],
    },
    {
      group: 'Rubber & Polymers',
      items: [
        { id: 'natural_rubber', label: 'Natural Rubber', unit: '$/kg', variants: [
          { id: 'tsr20', label: 'TSR 20',              note: 'SICOM benchmark' },
          { id: 'rss3',  label: 'RSS3 (smoked sheet)', note: 'Thailand' },
          { id: 'latex', label: 'Latex (60% conc)',    note: 'Gloves / medical' },
        ]},
        { id: 'pe',  label: 'Polyethylene', unit: '$/t', variants: [
          { id: 'hdpe',  label: 'HDPE', note: 'Rigid packaging / pipes' },
          { id: 'ldpe',  label: 'LDPE', note: 'Flexible films / bags' },
          { id: 'lldpe', label: 'LLDPE',note: 'Stretch wrap / food film' },
        ]},
        { id: 'pp',  label: 'Polypropylene (PP)', unit: '$/t' },
        { id: 'pvc', label: 'PVC',                unit: '$/t' },
        { id: 'pet', label: 'PET Resin',          unit: '$/t' },
        { id: 'abs', label: 'ABS Resin',          unit: '$/t' },
        { id: 'pc',  label: 'Polycarbonate (PC)', unit: '$/t' },
      ],
    },
  ],

  // ── MANUFACTURED / INDUSTRIAL ────────────────────────────────────────────
  manufactured: [
    {
      group: 'Textiles — Raw Fibers',
      items: [
        { id: 'cotton_fiber', label: 'Cotton Fiber', unit: 'c/lb', variants: [
          { id: 'cotton_els',    label: 'ELS Cotton (Pima / Giza)', note: '>=36mm — luxury' },
          { id: 'cotton_upland', label: 'Upland / Middling',        note: 'ICE #2 benchmark' },
        ]},
        { id: 'wool', label: 'Wool', unit: 'c/kg', variants: [
          { id: 'wool_merino_fine', label: 'Merino Fine (<18 micron)',  note: 'Australia — luxury knitwear' },
          { id: 'wool_merino_med',  label: 'Merino Medium (18-23 mic)',note: 'Apparel worsted' },
          { id: 'wool_crossbred',   label: 'Crossbred (24-32 mic)',    note: 'Knitting / carpets' },
          { id: 'wool_carpet',      label: 'Carpet Wool (>32 mic)',    note: 'NZ strong wool' },
        ]},
        { id: 'silk', label: 'Silk', unit: '$/kg', variants: [
          { id: 'silk_raw',  label: 'Raw Silk (Greige)',    note: 'China / India — 3A-6A grade' },
          { id: 'silk_spun', label: 'Spun Silk / Noil',    note: 'Lower grade reeled waste' },
        ]},
        { id: 'cashmere', label: 'Cashmere', unit: '$/kg', variants: [
          { id: 'cashmere_raw',      label: 'Raw Cashmere',      note: 'Mongolia / China <16 mic' },
          { id: 'cashmere_dehaired', label: 'Dehaired Cashmere', note: 'Processed 15-16.5 mic' },
        ]},
        { id: 'manmade_fibers', label: 'Man-Made Fibers', unit: '$/t', variants: [
          { id: 'polyester_poy',  label: 'Polyester POY',          note: 'Pre-oriented yarn feedstock' },
          { id: 'polyester_dty',  label: 'Polyester DTY (textured)',note: 'Woven / knit apparel' },
          { id: 'polyester_fdy',  label: 'Polyester FDY',          note: 'Fully drawn — linings' },
          { id: 'viscose',        label: 'Viscose / Rayon',         note: 'Lyocell alternative — drape' },
          { id: 'nylon6',         label: 'Nylon 6 Filament',       note: 'Hosiery / sportswear' },
          { id: 'acrylic',        label: 'Acrylic Staple Fiber',   note: 'Wool substitute — knitwear' },
          { id: 'spandex',        label: 'Spandex / Lycra',        note: 'Activewear / intimate' },
          { id: 'tencel',         label: 'Tencel / Lyocell',       note: 'Sustainable — biodegradable' },
          { id: 'recycled_pet',   label: 'rPET Fiber (recycled)',  note: 'Eco — bottles to fleece' },
        ]},
      ],
    },
    {
      group: 'Textiles — Fabrics',
      items: [
        { id: 'woven_fabrics', label: 'Woven Fabrics', unit: '$/m', variants: [
          { id: 'denim',        label: 'Denim (3x1 twill)',    note: '7-14 oz/yd2 — cotton / stretch' },
          { id: 'canvas',       label: 'Canvas (plain weave)', note: 'Bags / shoes / outdoor' },
          { id: 'poplin',       label: 'Poplin / Broadcloth',  note: 'Shirting — 40s or 60s' },
          { id: 'twill',        label: 'Twill (diagonal weave)',note: 'Chinos / uniforms' },
          { id: 'satin',        label: 'Satin / Sateen',       note: 'Lingerie / lining' },
          { id: 'jacquard',     label: 'Jacquard',             note: 'Upholstery / ties / brocade' },
        ]},
        { id: 'knitted_fabrics', label: 'Knitted Fabrics', unit: '$/kg', variants: [
          { id: 'jersey',   label: 'Single Jersey',      note: 'T-shirts — 140-200 gsm' },
          { id: 'interlock',label: 'Interlock',          note: 'Baby wear / polo shirts' },
          { id: 'fleece',   label: 'Polar Fleece',       note: 'Sportswear / outerwear' },
          { id: 'terry',    label: 'Terry / Towelling',  note: 'Towels / bathrobes' },
          { id: 'rib_knit', label: 'Rib Knit (1x1, 2x2)',note: 'Collars / cuffs / bands' },
          { id: 'mesh',     label: 'Mesh / Sports Net',  note: 'Activewear / liners' },
        ]},
        { id: 'technical_textiles', label: 'Technical Textiles', unit: '$/m2', variants: [
          { id: 'nonwoven',   label: 'Non-Woven (PP / PE)',   note: 'Medical / hygiene / geotextile' },
          { id: 'geotextile', label: 'Geotextile',            note: 'Road / civil engineering' },
          { id: 'med_textile',label: 'Medical Textile',       note: 'Wound care / surgical drapes' },
          { id: 'ballistic',  label: 'Ballistic / Protective',note: 'Aramid (Kevlar) / UHMWPE' },
        ]},
      ],
    },
    {
      group: 'Textiles — Apparel & Home',
      items: [
        { id: 'garments_knit', label: 'Knit Apparel', unit: '$/unit', variants: [
          { id: 'tshirts',    label: 'T-Shirts (CMT / FOB)',   note: 'Bangladesh / Vietnam dominant' },
          { id: 'polos',      label: 'Polo Shirts',            note: 'Bangladesh CMT price' },
          { id: 'knitwear',   label: 'Sweaters / Knitwear',   note: 'China / Bangladesh' },
          { id: 'sportswear', label: 'Activewear / Athleisure',note: 'Cambodia / Vietnam' },
          { id: 'innerwear',  label: 'Underwear / Socks',      note: 'High volume — China / India' },
        ]},
        { id: 'garments_woven', label: 'Woven Apparel', unit: '$/unit', variants: [
          { id: 'denim_jeans',label: 'Denim Jeans',            note: 'Bangladesh dominant' },
          { id: 'shirts',     label: 'Dress / Casual Shirts',  note: 'Bangladesh / India' },
          { id: 'workwear',   label: 'Workwear / Uniforms',    note: 'PPE + industrial' },
          { id: 'outwear',    label: 'Outerwear / Jackets',    note: 'Down / polyester fill' },
        ]},
        { id: 'footwear', label: 'Footwear', unit: '$/pair', variants: [
          { id: 'leather_shoes', label: 'Leather Shoes',        note: 'Dress / casual' },
          { id: 'sneakers',      label: 'Sneakers / Athletic',  note: 'Vietnam / Indonesia dominant' },
          { id: 'sandals',       label: 'Sandals / Flip-flops', note: 'High volume — China / India' },
          { id: 'boots',         label: 'Boots (ankle / knee)', note: 'Leather / synthetic' },
        ]},
        { id: 'home_textiles', label: 'Home Textiles', unit: '$/unit', variants: [
          { id: 'towels',     label: 'Towels (450-700 gsm)',  note: 'India / Pakistan — terry' },
          { id: 'bed_sheets', label: 'Bed Sheets / Duvet',   note: 'TC 200-600 — India dominant' },
          { id: 'blankets',   label: 'Blankets / Throws',    note: 'China / India — polyester' },
          { id: 'curtains',   label: 'Curtains / Drapes',    note: 'China — printed / blackout' },
          { id: 'carpet',     label: 'Carpet / Rugs',        note: 'Turkey / India / China' },
        ]},
      ],
    },
    {
      group: 'Electronics & Tech',
      items: [
        { id: 'semiconductors', label: 'Semiconductors', unit: '$/unit', variants: [
          { id: 'logic',  label: 'Logic (CPU / GPU / SoC)', note: 'TSMC 2-5nm nodes' },
          { id: 'memory', label: 'DRAM / NAND Flash',       note: 'Samsung / SK Hynix / Micron' },
          { id: 'analog', label: 'Analog / Mixed-Signal',   note: 'TI, STM, ADI' },
          { id: 'power',  label: 'Power (IGBT / MOSFET)',   note: 'EV / industrial drives' },
        ]},
        { id: 'smartphones',  label: 'Smartphones',          unit: '$/unit' },
        { id: 'solar_cells',  label: 'Solar Cells & Modules', unit: '$/W' },
        { id: 'ev_batteries', label: 'Li-ion Battery Cells',  unit: '$/kWh' },
      ],
    },
    {
      group: 'Machinery & Equipment',
      items: [
        { id: 'agri_machinery',  label: 'Agricultural Machinery', unit: '$/unit' },
        { id: 'construction_eq', label: 'Construction Equipment', unit: '$/unit' },
        { id: 'mining_eq',       label: 'Mining Equipment',       unit: '$/unit' },
        { id: 'food_processing', label: 'Food Processing Equipment', unit: '$/unit' },
        { id: 'packaging_eq',    label: 'Packaging Machinery',    unit: '$/unit' },
      ],
    },
    {
      group: 'Vehicles & Transport',
      items: [
        { id: 'cars', label: 'Passenger Cars', unit: '$/unit', variants: [
          { id: 'car_ice',    label: 'ICE (petrol / diesel)', note: '' },
          { id: 'car_ev',     label: 'Battery EV (BEV)',      note: 'China dominant export' },
          { id: 'car_hybrid', label: 'Hybrid (HEV / PHEV)',   note: '' },
        ]},
        { id: 'trucks',      label: 'Trucks & Buses', unit: '$/unit' },
        { id: 'motorcycles', label: 'Motorcycles',    unit: '$/unit' },
        { id: 'auto_parts',  label: 'Auto Parts',     unit: '$/kg' },
      ],
    },
    {
      group: 'Packaging Materials',
      items: [
        { id: 'plastic_pkg', label: 'Plastic Packaging', unit: '$/t', variants: [
          { id: 'pet_bottles',    label: 'PET Bottles (preforms)',     note: 'Beverage — 500ml / 1.5L' },
          { id: 'hdpe_bottles',   label: 'HDPE Bottles / Canisters',  note: 'Detergent / dairy' },
          { id: 'flex_pouch',     label: 'Flexible Pouches (BOPP/PE)',note: 'Snacks / coffee / sauce' },
          { id: 'plastic_bags',   label: 'Plastic Bags (LDPE)',       note: 'Retail / supermarket' },
        ]},
        { id: 'metal_pkg', label: 'Metal Packaging', unit: '$/unit', variants: [
          { id: 'tin_cans',   label: 'Tin Cans (3-piece)',    note: 'Food canning' },
          { id: 'alu_cans',   label: 'Aluminium Cans (DWI)', note: 'Beverage — 330ml / 500ml' },
          { id: 'aerosol',    label: 'Aerosol Cans',          note: 'Personal care / industrial' },
        ]},
        { id: 'glass_pkg', label: 'Glass Packaging', unit: '$/unit', variants: [
          { id: 'glass_bottles', label: 'Glass Bottles', note: 'Wine / spirits / beer / sauce' },
          { id: 'glass_jars',    label: 'Glass Jars',    note: 'Food / cosmetics' },
        ]},
        { id: 'paper_pkg', label: 'Paper & Carton', unit: '$/t', variants: [
          { id: 'corrugated',     label: 'Corrugated Board / Boxes', note: 'E-commerce / logistics' },
          { id: 'folding_carton', label: 'Folding Cartons',          note: 'Retail packaging' },
          { id: 'kraft_paper',    label: 'Kraft Paper (sacks)',      note: 'Cement / flour / sugar' },
          { id: 'tissue',         label: 'Tissue Paper',             note: 'Toilet / facial / towel' },
        ]},
      ],
    },
    {
      group: 'Consumer & Household Goods',
      items: [
        { id: 'appliances', label: 'Home Appliances', unit: '$/unit', variants: [
          { id: 'washing_machine', label: 'Washing Machines',       note: 'Top / front load' },
          { id: 'refrigerator',    label: 'Refrigerators',          note: 'Double door / single' },
          { id: 'air_conditioner', label: 'Air Conditioners',       note: 'Split / window' },
          { id: 'microwave',       label: 'Microwaves',             note: 'Countertop / built-in' },
          { id: 'tv',              label: 'Televisions (LED/OLED)', note: 'China / South Korea export' },
          { id: 'small_appliances',label: 'Small Appliances',       note: 'Blenders / irons / fans' },
        ]},
        { id: 'furniture', label: 'Furniture', unit: '$/unit', variants: [
          { id: 'wood_furniture',  label: 'Solid Wood Furniture',       note: 'Vietnam / Malaysia dominant' },
          { id: 'flat_pack',       label: 'Flat-Pack (RTA)',            note: 'Self-assembly — China / Poland' },
          { id: 'upholstered',     label: 'Upholstered Seating',        note: 'Sofa / chairs — China dominant' },
          { id: 'metal_furniture', label: 'Metal / Office Furniture',   note: 'China / Turkey' },
          { id: 'outdoor_furn',    label: 'Outdoor / Garden Furniture', note: 'Rattan / aluminium / teak' },
          { id: 'mattress',        label: 'Mattresses',                 note: 'Foam / spring / latex' },
        ]},
        { id: 'ceramics', label: 'Ceramics & Houseware', unit: '$/unit', variants: [
          { id: 'ceramic_tiles', label: 'Ceramic / Porcelain Tiles', note: 'China / Spain / Italy export' },
          { id: 'tableware',     label: 'Tableware (plates / bowls)', note: 'China / India' },
          { id: 'cookware',      label: 'Cookware (pots / pans)',     note: 'Aluminum / stainless / cast iron' },
        ]},
        { id: 'lighting', label: 'Lighting', unit: '$/unit', variants: [
          { id: 'led_bulbs',       label: 'LED Bulbs (A60 / GU10)',  note: 'China — 8-15W retrofit' },
          { id: 'led_streetlight', label: 'LED Street Lighting',    note: 'Municipal infrastructure' },
          { id: 'solar_lantern',   label: 'Solar Lanterns / PAYG',  note: 'Off-grid Africa — high growth' },
        ]},
        { id: 'building_mat', label: 'Building Materials', unit: '$/t', variants: [
          { id: 'cement',    label: 'Portland Cement (OPC)',      note: 'Local manufacturing preferred' },
          { id: 'pvc_pipes', label: 'PVC Pipes & Fittings',       note: 'Plumbing / irrigation' },
          { id: 'roofing',   label: 'Roofing Sheets',             note: 'Corrugated iron / colorsteel' },
          { id: 'paint_deco',label: 'Decorative Paint',           note: 'Emulsion / gloss' },
          { id: 'sanitary',  label: 'Sanitary Ware',              note: 'WC / basin / shower' },
        ]},
      ],
    },
    {
      group: 'Pharma & Healthcare',
      items: [
        { id: 'generics',        label: 'Generic Medicines',         unit: '$/unit' },
        { id: 'apis',            label: 'Active Pharma Ingredients', unit: '$/kg' },
        { id: 'medical_devices', label: 'Medical Devices',           unit: '$/unit' },
        { id: 'vaccines',        label: 'Vaccines & Biologics',      unit: '$/dose' },
        { id: 'diagnostics',     label: 'Diagnostics / Rapid Tests', unit: '$/unit' },
      ],
    },
    {
      group: 'Processed Food & Beverage',
      items: [
        { id: 'edible_oils_pkg', label: 'Packaged Edible Oils', unit: '$/L', variants: [
          { id: 'sunfl_bottle',  label: 'Sunflower Oil (1-5L)',    note: 'Retail — EM favourite' },
          { id: 'palm_cooking',  label: 'Palm / Cooking Oil (5L)', note: 'W. Africa / SE Asia' },
          { id: 'olive_retail',  label: 'Olive Oil (750ml)',       note: 'Mediterranean retail export' },
        ]},
        { id: 'pasta_noodles', label: 'Pasta & Noodles', unit: '$/t', variants: [
          { id: 'dry_pasta',      label: 'Dry Pasta (Italy / Turkey)', note: 'Spaghetti / penne / fusilli' },
          { id: 'instant_noodle',label: 'Instant Noodles',             note: 'Asia / Africa — high volume' },
          { id: 'rice_noodle',   label: 'Rice Noodles / Vermicelli',  note: 'SE Asia export' },
        ]},
        { id: 'canned_food', label: 'Canned / Preserved Food', unit: '$/t', variants: [
          { id: 'canned_tomato', label: 'Canned Tomatoes',       note: 'Italy / Spain — passata / diced' },
          { id: 'corned_beef2',  label: 'Corned Beef (340g can)',note: 'Pacific / Africa staple' },
          { id: 'canned_fruit',  label: 'Canned Fruit',          note: 'South Africa / China' },
        ]},
        { id: 'beverages_pkg', label: 'Beverages (packaged)', unit: '$/L', variants: [
          { id: 'water_bottled', label: 'Bottled Water',           note: '500ml - 5L PET' },
          { id: 'carbonated',    label: 'Carbonated Soft Drinks',  note: 'Cans / PET — cola / orange' },
          { id: 'juice',         label: 'Fruit Juice (NFC / FC)',  note: 'Ambient / chilled — Tetra Pak' },
          { id: 'energy_drink',  label: 'Energy Drinks',           note: '250ml can — high growth EM' },
          { id: 'beer',          label: 'Beer (lager / ale)',       note: 'Cans / bottles' },
          { id: 'spirits',       label: 'Spirits & Wines',         note: 'Imported / locally bottled' },
        ]},
        { id: 'confectionery', label: 'Confectionery & Snacks', unit: '$/t', variants: [
          { id: 'chocolate',    label: 'Chocolate Bars / Couverture', note: 'Belgium / Switzerland / China' },
          { id: 'biscuits',     label: 'Biscuits / Crackers',         note: 'Indonesia / China / France export' },
          { id: 'chips_snacks', label: 'Potato Chips / Snacks',       note: 'High growth EM' },
        ]},
        { id: 'condiments', label: 'Condiments & Sauces', unit: '$/t', variants: [
          { id: 'ketchup',       label: 'Ketchup / Tomato Sauce',    note: 'China / Europe export' },
          { id: 'soy_sauce',     label: 'Soy Sauce',                 note: 'China / Japan' },
          { id: 'chili_sauce',   label: 'Chili / Hot Sauce',         note: 'SE Asia / Mexico dominant' },
        ]},
      ],
    },
  ],

  // ── RESOURCES ────────────────────────────────────────────────────────────
  resources: [
    {
      group: 'Water & Sanitation',
      items: [
        { id: 'water_treatment', label: 'Water Treatment Systems', unit: '$/m3' },
        { id: 'desalination',    label: 'Desalination Equipment',  unit: '$/m3/day' },
        { id: 'water_pipes',     label: 'Water Infrastructure',    unit: '$/km' },
      ],
    },
    {
      group: 'Agricultural Inputs',
      items: [
        { id: 'pesticides',      label: 'Pesticides / Insecticides', unit: '$/L' },
        { id: 'herbicides',      label: 'Herbicides',                unit: '$/L' },
        { id: 'fungicides',      label: 'Fungicides',                unit: '$/L' },
        { id: 'seeds_hybrid',    label: 'Hybrid Seeds',              unit: '$/kg' },
        { id: 'seeds_certified', label: 'Certified Seeds (OP / GM)', unit: '$/kg' },
        { id: 'bio_inputs',      label: 'Bio-inputs / Inoculants',   unit: '$/kg' },
        { id: 'drip_irrigation', label: 'Drip Irrigation Equipment', unit: '$/ha' },
        { id: 'greenhouses',     label: 'Greenhouse Structures',     unit: '$/m2' },
      ],
    },
    {
      group: 'Waste & Recycling',
      items: [
        { id: 'scrap_metals',    label: 'Scrap Metals',              unit: '$/t' },
        { id: 'plastic_pellets', label: 'Recycled Plastic Pellets',  unit: '$/t' },
        { id: 'recycled_paper',  label: 'Recovered Paper / Cardboard', unit: '$/t' },
        { id: 'e_waste',         label: 'E-Waste Processing',        unit: '$/t' },
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
          top: 72,
          left: collapsed ? 0 : 224,
          width: 36,
          height: 36,
          background: '#0D1117',
          border: '1px solid rgba(201,168,76,.25)',
          borderLeft: 'none',
        }}
        title={collapsed ? "Ouvrir les filtres" : "Fermer les filtres"}
      >
        {collapsed ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
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
            {totalFilters} filter{totalFilters > 1 ? 's' : ''}
          </span>
          <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-white transition-colors">
            × Clear
          </button>
        </div>
      )}

      {/* Top-level categories */}
      <div className="p-3 border-b border-[rgba(201,168,76,.1)]">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</p>
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
                    {cat.label}
                  </span>
                </button>
                {/* Navigate to sub-items */}
                {cat.id !== 'all' && SUBCATEGORIES[cat.id] && (
                  <button
                    onClick={() => navigateCat(cat.id as TradeCategory)}
                    className="px-2 py-2 text-gray-600 hover:text-gray-300 hover:bg-white/5 rounded-r-lg transition-colors"
                    title="Browse commodities"
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
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Commodities</p>
            <button onClick={() => setNavCat('all')} className="text-[9px] text-gray-600 hover:text-gray-300">← Back</button>
          </div>
          <div className="space-y-0.5">
            {subGroups.map(group => (
              <div key={group.group}>
                <button
                  onClick={() => toggleGroup(group.group)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                >
                  <span className="font-semibold uppercase tracking-wide">{group.group}</span>
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
                              <span className="truncate">{item.label}</span>
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
                                      <div className="text-[11px] truncate" style={isVChecked ? { color: navColor } : { color: '#6B7280' }}>{v.label}</div>
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
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Trade Balance</p>
        <div className="space-y-1 text-xs text-gray-400">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#22C55E]"/><span>Surplus</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#EF4444]"/><span>Deficit</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#6B7280]"/><span>No data</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#C9A84C]"/><span>Opportunity</span></div>
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
