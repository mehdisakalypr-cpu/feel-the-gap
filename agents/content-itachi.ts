// @ts-nocheck
/**
 * content-itachi — génère les business plans pour (opp × country × lang).
 * 3 scénarios (garanti / médian / high) + plan trade + plan production.
 *
 * Réutilise buildTradePlanTiered + buildProductionPlanTiered existants.
 */
import { buildTradePlanTiered, buildProductionPlanTiered } from './plan-builder'

export async function generateBusinessPlans(
  opp: any,
  productName: string,
  countryName: string,
  lang: string = 'fr',
): Promise<{ payload: unknown; cost_eur: number }> {
  // Run du 27/04 voyait 1200s timeouts en mode séquentiel. 13 providers
  // rotatifs (Gemini×7 + Groq + Mistral + OpenAI×4 + Claude) absorbent le burst,
  // donc on paralléllise pour wall-time ÷ 2.
  const [tradePlan, productionPlan] = await Promise.all([
    buildTradePlanTiered(opp, productName, countryName, 'standard'),
    buildProductionPlanTiered(opp, productName, countryName, 'standard'),
  ])

  const payload = {
    lang,
    country: countryName,
    product: productName,
    generated_at: new Date().toISOString(),
    scenarios: {
      trade: tradePlan,
      production: productionPlan,
    },
    // Summary scenarios (garanti / médian / high) extraits du production plan si dispo
    summary_scenarios: productionPlan && typeof productionPlan === 'object' && 'financial_models' in productionPlan
      ? [
          { level: 'garanti', source: 'cost_effective', data: (productionPlan as any).financial_models?.cost_effective },
          { level: 'median', source: 'balanced', data: (productionPlan as any).financial_models?.balanced },
          { level: 'high', source: 'high_tech', data: (productionPlan as any).financial_models?.high_tech },
        ]
      : [],
  }

  return { payload, cost_eur: 0.004 }
}
