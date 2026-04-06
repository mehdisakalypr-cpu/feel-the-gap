export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type TradeCategory = 'agriculture' | 'energy' | 'materials' | 'manufactured' | 'resources'
export type OpportunityType = 'direct_trade' | 'local_production'
export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise'

export interface Database {
  public: {
    Tables: {
      countries: {
        Row: Country
        Insert: Omit<Country, 'id' | 'created_at'>
        Update: Partial<Omit<Country, 'id'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at'>
        Update: Partial<Omit<Product, 'id'>>
      }
      trade_flows: {
        Row: TradeFlow
        Insert: Omit<TradeFlow, 'id' | 'created_at'>
        Update: Partial<Omit<TradeFlow, 'id'>>
      }
      opportunities: {
        Row: Opportunity
        Insert: Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Opportunity, 'id'>>
      }
      reports: {
        Row: Report
        Insert: Omit<Report, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Report, 'id'>>
      }
      business_plans: {
        Row: BusinessPlan
        Insert: Omit<BusinessPlan, 'id' | 'created_at'>
        Update: Partial<Omit<BusinessPlan, 'id'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      agent_runs: {
        Row: AgentRun
        Insert: Omit<AgentRun, 'id' | 'created_at'>
        Update: Partial<Omit<AgentRun, 'id'>>
      }
    }
  }
}

export interface Country {
  id: string             // ISO 3166-1 alpha-3 (e.g. "MAR")
  iso2: string           // alpha-2 (e.g. "MA")
  name: string
  name_fr: string
  flag: string
  region: string
  sub_region: string
  lat: number
  lng: number
  population: number | null
  gdp_usd: number | null
  gdp_per_capita: number | null
  land_area_km2: number | null
  arable_land_pct: number | null
  // Aggregates (updated by agents)
  total_imports_usd: number | null
  total_exports_usd: number | null
  trade_balance_usd: number | null
  top_import_category: TradeCategory | null
  data_year: number | null
  created_at: string
}

export interface Product {
  id: string             // HS6 code string e.g. "070310"
  hs2: string            // 2-digit chapter
  hs4: string            // 4-digit heading
  name: string
  name_fr: string
  category: TradeCategory
  subcategory: string    // e.g. "vegetables", "crude_oil"
  unit: string           // tonnes, barrels, units...
  created_at: string
}

export interface TradeFlow {
  id: string
  reporter_iso: string   // FK → countries.id
  partner_iso: string    // FK → countries.id (or "WLD" for world aggregate)
  product_id: string     // FK → products.id
  year: number
  flow: 'import' | 'export'
  value_usd: number
  quantity: number | null
  source: string         // "UN_COMTRADE" | "WORLD_BANK" | "FAO" | "SCRAPED"
  created_at: string
}

export interface Opportunity {
  id: string
  country_iso: string
  product_id: string
  type: OpportunityType
  gap_tonnes_year: number | null
  gap_value_usd: number | null
  opportunity_score: number  // 0-100
  // Context
  avg_import_price_usd_tonne: number | null
  local_production_cost_usd_tonne: number | null
  potential_margin_pct: number | null
  land_availability: 'high' | 'medium' | 'low' | null
  labor_cost_index: number | null  // 1-100
  infrastructure_score: number | null  // 1-10
  // Analysis summary (free tier shows this)
  summary: string
  // Detailed content (paid)
  analysis_json: Json | null
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  country_iso: string
  product_id: string | null  // null = country overview
  title: string
  tier_required: SubscriptionTier
  summary: string            // always visible
  content_html: string | null  // paid
  data_year: number
  created_at: string
  updated_at: string
}

export interface BusinessPlan {
  id: string
  opportunity_id: string
  type: OpportunityType
  title: string
  tier_required: SubscriptionTier
  // Direct trade plan
  trade_suppliers: Json | null
  trade_logistics: Json | null
  trade_margins: Json | null
  // Local production plan
  prod_capex_usd: number | null
  prod_opex_usd_year: number | null
  prod_roi_pct: number | null
  prod_payback_years: number | null
  prod_machinery_options: Json | null  // Chinese suppliers, specs, prices
  prod_automation_level: 'low' | 'medium' | 'high' | null
  prod_land_ha: number | null
  prod_employees: number | null
  // Full document
  full_plan_html: string | null
  created_at: string
}

export interface Profile {
  id: string  // matches Supabase auth user id
  email: string
  full_name: string | null
  company: string | null
  tier: SubscriptionTier
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_ends_at: string | null
  reports_accessed: string[]  // report IDs
  created_at: string
}

export interface AgentRun {
  id: string
  agent: string   // "agri_collector" | "gap_analyzer" | "plan_builder" etc.
  status: 'running' | 'completed' | 'failed'
  countries_processed: number
  records_inserted: number
  errors: Json | null
  started_at: string
  ended_at: string | null
  created_at: string
}

// ── API response shapes ──────────────────────────────
export interface CountryMapData {
  iso: string
  name_fr: string
  lat: number
  lng: number
  flag: string
  region: string
  trade_balance_usd: number | null
  total_imports_usd: number | null
  total_exports_usd: number | null
  top_import_category: TradeCategory | null
  opportunity_count: number
  top_opportunity_score: number | null
  data_year: number | null
}
