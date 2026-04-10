/**
 * Feel The Gap — Bulk Opportunity Generator v3
 * Multi-provider, auto-creates products, validates all constraints
 */

const { google } = require('@ai-sdk/google');
const { generateText } = require('ai');
const { createClient } = require('@supabase/supabase-js');
const { createGroq } = require('@ai-sdk/groq');
const { createOpenAI } = require('@ai-sdk/openai');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const idx = t.indexOf('=');
  if (idx < 0) continue;
  const k = t.slice(0, idx).trim();
  const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  if (!process.env[k]) process.env[k] = v;
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const MAX_OPPS = 4;
const VALID_TYPES = ['direct_trade', 'local_production'];
const VALID_LAND = ['high', 'medium', 'low'];

// ── Multi-provider ──────────────────────────────────────────

const providers = [];
if (process.env.OPENAI_API_KEY) {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  providers.push({ name: 'OpenAI', model: openai('gpt-4o-mini'), exhausted: false });
}
if (process.env.GROQ_API_KEY) {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  providers.push({ name: 'Groq', model: groq('llama-3.3-70b-versatile'), exhausted: false });
}
if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  providers.push({ name: 'Gemini', model: google('gemini-2.5-flash'), exhausted: false });
}

let pidx = 0;
function getModel() {
  const start = pidx;
  do {
    const p = providers[pidx];
    if (!p.exhausted) return { model: p.model, name: p.name };
    pidx = (pidx + 1) % providers.length;
  } while (pidx !== start);
  // Reset all
  providers.forEach(p => p.exhausted = false);
  console.log('  [All providers reset]');
  return { model: providers[0].model, name: providers[0].name };
}

function markExhausted(name) {
  const p = providers.find(p => p.name === name);
  if (p) { p.exhausted = true; pidx = (pidx + 1) % providers.length; console.log(`  ⚠ ${name} exhausted`); }
}

async function withRetry(fn, label) {
  const tried = new Set();
  while (tried.size < providers.length) {
    const { model, name } = getModel();
    tried.add(name);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { return await fn(model); }
      catch (err) {
        const msg = (err.message || '').toLowerCase();
        const isRate = msg.includes('quota') || msg.includes('rate') || msg.includes('429') || msg.includes('resource_exhausted');
        if (isRate && attempt < 3) {
          const wait = attempt * 15;
          console.log(`  [${name} rate limit, wait ${wait}s]`);
          await new Promise(r => setTimeout(r, wait * 1000));
        } else if (isRate) {
          markExhausted(name);
          break;
        } else throw err;
      }
    }
  }
  throw new Error(`All providers failed: ${label}`);
}

// ── Helpers ─────────────────────────────────────────────────

function toProductId(name, category) {
  const n = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/, '').slice(0, 50);
  const prefix = category === 'agriculture' ? '0010' : category === 'energy' ? '0027' : category === 'materials' ? '0072' : category === 'manufactured' ? '0084' : '0099';
  return `${prefix}_${n}`;
}

async function ensureProduct(productId, productName, category) {
  const { data } = await sb.from('products').select('id').eq('id', productId).maybeSingle();
  if (!data) {
    const validCats = ['agriculture', 'energy', 'materials', 'manufactured', 'services'];
    const cat = validCats.includes(category) ? category : 'manufactured';
    // Extract hs2 from the prefix (e.g., "0010_wheat" → hs2="10", hs4="0010")
    const hs4 = productId.split('_')[0] || '0099';
    const hs2 = hs4.replace(/^0+/, '') || '99';
    const { error } = await sb.from('products').upsert({
      id: productId,
      name: productName,
      name_fr: productName,
      category: cat,
      subcategory: cat,
      hs2,
      hs4,
      unit: 'USD',
    }, { onConflict: 'id' });
    if (error) {
      console.log(`  [product upsert FAIL: ${error.message}]`);
      return false;
    }
    return true;
  }
}

function normalizeType(t) {
  if (!t) return 'direct_trade';
  const lower = t.toLowerCase().replace(/[^a-z_]/g, '');
  if (VALID_TYPES.includes(lower)) return lower;
  if (lower.includes('local') || lower.includes('produc')) return 'local_production';
  return 'direct_trade';
}

function normalizeLand(l) {
  if (!l) return 'medium';
  const lower = l.toLowerCase().replace(/[^a-z_]/g, '');
  if (VALID_LAND.includes(lower)) return lower;
  if (lower.includes('high')) return 'high';
  if (lower.includes('low')) return 'low';
  return 'medium';
}

function buildPrompt(c) {
  const gdp = c.gdp_usd ? `$${(c.gdp_usd / 1e9).toFixed(1)}B` : 'unknown';
  const imports = c.total_imports_usd ? `$${(c.total_imports_usd / 1e9).toFixed(1)}B/yr` : 'unknown';
  return `You are a trade economist. Generate ${MAX_OPPS} trade/investment opportunities for ${c.name} (${c.id}).
Region: ${c.region}/${c.sub_region}. GDP: ${gdp}. Imports: ${imports}.
Top imports: ${c.top_import_text || 'infer from your knowledge'}
Renewable energy: ${c.renewable_pct != null ? c.renewable_pct + '%' : 'unknown'}

Rules:
- type MUST be exactly "direct_trade" or "local_production" (no other value)
- land_availability MUST be exactly "high", "medium", or "low"
- product_category MUST be "agriculture", "energy", "materials", "manufactured", or "services"
- Mix: 2 direct_trade + 2 local_production
- Be specific with real trade data, partners, prices

Return ONLY a valid JSON array, nothing else:
[{"product_name":"Refined petroleum","product_category":"energy","type":"direct_trade","gap_value_usd":500000000,"opportunity_score":78,"labor_cost_index":25,"infrastructure_score":6,"land_availability":"medium","summary":"3-4 detailed sentences with facts and figures"}]`;
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const { data: allCountries } = await sb.from('countries')
    .select('id,name,region,sub_region,gdp_usd,total_imports_usd,top_import_text,renewable_pct,energy_cost_index')
    .order('total_imports_usd', { ascending: false });

  const { data: existingOpps } = await sb.from('opportunities').select('country_iso');
  const done = new Set((existingOpps || []).map(o => o.country_iso));
  const targets = allCountries.filter(c => !done.has(c.id));

  console.log(`=== OPP GENERATOR v3: ${targets.length} countries ===`);
  console.log(`Providers: ${providers.map(p => p.name).join(', ')}`);

  let success = 0, errors = 0;

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] ${c.name} (${c.id})... `);

    try {
      const result = await withRetry(m => generateText({ model: m, prompt: buildPrompt(c), maxTokens: 2500 }), c.id);
      let text = result.text;

      // Clean markdown fences
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      // Extract JSON array
      const arrMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrMatch) text = arrMatch[0];

      const opps = JSON.parse(text);
      if (!Array.isArray(opps) || !opps.length) throw new Error('Empty response');

      const rows = [];
      for (const o of opps.slice(0, MAX_OPPS)) {
        const validCats = ['agriculture', 'energy', 'materials', 'manufactured', 'services'];
        const cat = validCats.includes(o.product_category) ? o.product_category : 'manufactured';
        const pid = toProductId(o.product_name || 'product', cat);
        const type = normalizeType(o.type);
        const land = normalizeLand(o.land_availability);

        // Ensure product exists in DB
        const ok = await ensureProduct(pid, o.product_name || 'Product', cat);
        if (ok === false) continue; // skip this opp if product can't be created

        rows.push({
          country_iso: c.id,
          product_id: pid,
          type,
          gap_value_usd: Math.max(0, Math.round(o.gap_value_usd || 0)),
          opportunity_score: Math.min(100, Math.max(0, Math.round(o.opportunity_score || 50))),
          labor_cost_index: Math.min(100, Math.max(0, Math.round(o.labor_cost_index || 40))),
          infrastructure_score: Math.min(10, Math.max(1, Math.round(o.infrastructure_score || 5))),
          land_availability: land,
          summary: (o.summary || '').slice(0, 1000),
        });
      }

      const { error: insErr } = await sb.from('opportunities').insert(rows);
      if (insErr) {
        console.log(`DB err: ${insErr.message}`);
        errors++;
      } else {
        console.log(`OK ${rows.length} opps`);
        success++;
      }
    } catch (e) {
      console.log(`ERR: ${(e.message || String(e)).slice(0, 200)}`);
      errors++;
    }

    if (i < targets.length - 1) await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`\n=== DONE: ${success} success, ${errors} errors ===`);
}

main().catch(e => console.error('FATAL:', e));
