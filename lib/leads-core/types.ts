export type LvCompanyInsert = {
  siren?: string | null
  crn?: string | null
  eori?: string | null
  vat_number?: string | null
  duns?: string | null
  legal_name: string
  trade_name?: string | null
  domain?: string | null
  country_iso: string
  region?: string | null
  city?: string | null
  postal_code?: string | null
  address?: string | null
  nace_code?: string | null
  sic_code?: string | null
  industry_tags?: string[]
  is_import_export?: boolean
  size_bucket?: 'micro' | 'small' | 'medium' | 'large' | null
  employees_estimate?: number | null
  revenue_estimate_eur?: number | null
  founded_year?: number | null
  status?: 'active' | 'dormant' | 'dissolved'
  primary_source: SourceId
  source_ids?: Record<string, string>
  enrichment_score?: number
}

export type LvPersonInsert = {
  company_id: string
  full_name: string
  first_name?: string | null
  last_name?: string | null
  role?: string | null
  role_seniority?: 'c-level' | 'vp' | 'director' | 'manager' | 'individual' | null
  decision_maker_score?: number
  linkedin_url?: string | null
  primary_source: SourceId
}

export type LvContactInsert = {
  person_id?: string | null
  company_id?: string | null
  contact_type: 'email' | 'phone' | 'linkedin' | 'other'
  contact_value: string
  is_personal?: boolean
  verify_status?: 'unverified' | 'valid' | 'invalid' | 'risky' | 'catch-all'
  verify_provider?: string | null
  verify_score?: number | null
  primary_source: SourceId
}

export type SourceId =
  | 'sirene'
  | 'companies_house'
  | 'handelsregister'
  | 'mercantil_es'
  | 'osm'
  | 'common_crawl'
  | 'gmaps'
  | 'mailscout'
  | 'hunter'
  | 'apollo'
  | 'phantombuster'
  | 'opencorporates'
  | 'eori_eu'
  | 'pagesjaunes'
  | 'europages'
  | 'goldenpages'
  | 'kompass'
  | 'directories_eu'
  | 'numverify'
  | 'inpi'
  | 'brreg'
  | 'prh'
  | 'ares'
  | 'ariregister'
  | 'github'
  | 'wikidata'
  | 'sec_edgar'
  | 'linkedin_serp'
  | 'gleif'

export type SyncResult = {
  rows_processed: number
  rows_inserted: number
  rows_updated: number
  rows_skipped: number
  duration_ms: number
  error?: string
  metadata?: Record<string, unknown>
}

export type ConnectorOptions = {
  limit?: number
  delta?: boolean
  dryRun?: boolean
}
