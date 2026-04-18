import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/openapi.json — spec OpenAPI 3.1 publique pour API Platform.
 * Non authentifiée (les clients lisent la spec avant d'avoir un token).
 */
export async function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Feel The Gap API',
      version: '1.0.0',
      description:
        "API institutionnelle Feel The Gap — accès aux 938 000+ opportunités import/export, 211 pays, 323 produits. 4 tiers : Starter (€12K/an) · Pro (€40K) · Enterprise (€120K) · Sovereign (€300K+).",
      contact: { email: 'api@feel-the-gap.com', url: 'https://feel-the-gap.com/api-platform' },
      license: { name: 'Commercial', url: 'https://feel-the-gap.com/terms' },
    },
    servers: [
      { url: 'https://feel-the-gap.com', description: 'Production' },
      { url: 'https://feel-the-gap.vercel.app', description: 'Staging' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'ftg_live_*',
          description: 'Token API généré dans /account/api-tokens. Prefix visible = 12 chars.',
        },
      },
      schemas: {
        RateLimitError: {
          type: 'object',
          properties: { error: { type: 'string' } },
          example: { error: 'rate_limit_per_minute_exceeded' },
        },
        Country: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ISO-3 code', example: 'FRA' },
            iso2: { type: 'string', example: 'FR' },
            name: { type: 'string', example: 'France' },
            name_fr: { type: 'string', example: 'France' },
            flag: { type: 'string', nullable: true },
            region: { type: 'string', example: 'Europe' },
            sub_region: { type: 'string', example: 'Western Europe' },
            lat: { type: 'number', nullable: true },
            lng: { type: 'number', nullable: true },
            population: { type: 'integer', nullable: true },
            gdp_usd: { type: 'number', nullable: true },
            gdp_per_capita: { type: 'number', nullable: true },
            total_imports_usd: { type: 'number', nullable: true },
            total_exports_usd: { type: 'number', nullable: true },
            trade_balance_usd: { type: 'number', nullable: true },
            top_import_category: { type: 'string', nullable: true },
            data_year: { type: 'integer', nullable: true },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            hs2: { type: 'string', example: '09' },
            hs4: { type: 'string', example: '0901' },
            name: { type: 'string', example: 'Coffee' },
            name_fr: { type: 'string', example: 'Café' },
            category: { type: 'string', example: 'agri' },
            subcategory: { type: 'string', nullable: true },
            unit: { type: 'string', example: 'tonne' },
          },
        },
        Opportunity: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            country_iso: { type: 'string' },
            sector: { type: 'string' },
            product_slug: { type: 'string' },
            score: { type: 'number' },
            margin_eur: { type: 'number', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        PaginatedList: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            count: { type: 'integer', description: 'Total count matching filters' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            items: { type: 'array' },
          },
        },
      },
      parameters: {
        LimitParam: { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50, maximum: 500 } },
        OffsetParam: { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } },
      },
      responses: {
        TooManyRequests: {
          description: 'Rate limit dépassé (par minute ou par jour selon tier)',
          headers: {
            'Retry-After': { schema: { type: 'integer' }, description: 'Secondes avant retry possible' },
          },
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RateLimitError' } } },
        },
        Unauthorized: {
          description: 'Token manquant, invalide, révoqué ou expiré',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RateLimitError' } } },
        },
        Forbidden: {
          description: 'Token valide mais sans le scope requis',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RateLimitError' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/v1/opportunities': {
        get: {
          summary: 'Liste paginée des opportunités import/export',
          description: 'Retourne jusqu\'à 500 opportunités triées par score décroissant. Scope requis : `opportunities:read`.',
          parameters: [
            { name: 'country', in: 'query', required: false, schema: { type: 'string' }, example: 'FRA' },
            { name: 'sector', in: 'query', required: false, schema: { type: 'string' }, example: 'coffee' },
            { name: 'product', in: 'query', required: false, schema: { type: 'string' } },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/OffsetParam' },
          ],
          responses: {
            '200': {
              description: 'Liste paginée',
              headers: {
                'X-RateLimit-Tier': { schema: { type: 'string' } },
                'X-RateLimit-Limit-Minute': { schema: { type: 'integer' } },
                'X-RateLimit-Limit-Day': { schema: { type: 'integer' } },
              },
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/PaginatedList' },
                      {
                        type: 'object',
                        properties: {
                          items: { type: 'array', items: { $ref: '#/components/schemas/Opportunity' } },
                        },
                      },
                    ],
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '429': { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      '/api/v1/countries': {
        get: {
          summary: 'Liste des 211 pays + data trade macro',
          description: 'Scope requis : `countries:read`.',
          parameters: [
            { name: 'iso', in: 'query', required: false, schema: { type: 'string' }, example: 'FRA' },
            { name: 'region', in: 'query', required: false, schema: { type: 'string' }, example: 'Africa' },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/OffsetParam' },
          ],
          responses: {
            '200': {
              description: 'Liste paginée',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/PaginatedList' },
                      {
                        type: 'object',
                        properties: {
                          items: { type: 'array', items: { $ref: '#/components/schemas/Country' } },
                        },
                      },
                    ],
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '429': { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      '/api/v1/products': {
        get: {
          summary: 'Catalogue 323 produits + codes HS',
          description: 'Scope requis : `products:read`.',
          parameters: [
            { name: 'category', in: 'query', required: false, schema: { type: 'string' }, example: 'agri' },
            { name: 'hs2', in: 'query', required: false, schema: { type: 'string' }, example: '09' },
            { name: 'hs4', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/OffsetParam' },
          ],
          responses: {
            '200': {
              description: 'Liste paginée',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/PaginatedList' },
                      {
                        type: 'object',
                        properties: {
                          items: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                        },
                      },
                    ],
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '429': { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
    },
  }

  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
