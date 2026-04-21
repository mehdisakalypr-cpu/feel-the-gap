# Spec — Deal Room → OFA standalone migration

Shaka 2026-04-21 · phase 2 post-marketplace

## Contexte

Les Deal Rooms vivent sous `feel-the-gap.com/deal/[slug]` (mutualisé SEO, conversion directe).
Un vendeur satisfait voudra parfois passer en **site indépendant** (domaine perso, branding, back admin OFA, SEO propre). Cette migration 1-click crée un site OFA pré-rempli depuis la deal room.

## Objectif

Permettre au seller de cliquer **"Migrer vers OFA standalone"** depuis `/seller/deal-rooms/[id]` et obtenir en < 60s :
- Site OFA draft rempli (hero/products/about/contact) avec contenu deal room
- Status deal_room = `migrated_to_standalone` (la page `/deal/[slug]` affiche une redirection permanente)
- Compte OFA créé/lié, onboarding skipped
- Lien vers `/admin/sites/[siteId]/editor` pour finalisation

## Schema

### Migration `supabase/migrations/20260422000000_deal_room_ofa_link.sql`

```sql
alter table public.deal_rooms
  add column if not exists ofa_site_id uuid references public.ofa_sites(id) on delete set null,
  add column if not exists migrated_at timestamptz;

create index if not exists idx_deal_rooms_ofa_site on public.deal_rooms(ofa_site_id) where ofa_site_id is not null;
```

## Endpoint `POST /api/deal-rooms/[id]/migrate-to-ofa`

### Request
- Auth: seller (RLS: `seller_id = auth.uid()`)
- Body: `{ custom_slug?: string }` — si absent, re-use deal room slug

### Logic
1. Charger deal_room (vérifier ownership + `status in ('published','paused')`)
2. Si déjà migré (`ofa_site_id IS NOT NULL`) → 409 avec lien vers le site existant
3. Créer/lier compte OFA :
   - Si `profiles.ofa_user_id` existe → réutiliser
   - Sinon créer via OFA Admin API (auth bridge)
4. Créer ofa_sites row :
   - slug = custom_slug || `${dealRoom.slug}-ofa`
   - archetype = mapping(deal_room.archetype) — farmer→'artisan-producer', trader→'b2b-distributor', etc.
   - status = 'draft'
   - primary_color = dérivé de hero_image_url (dominant color)
5. Générer sections (1 call LLM par section, conforme à `feedback_ofa_section_quality`) :
   - Hero : title = deal_room.title, subtitle = deal_room.summary, image = hero_image_url
   - Products : 1 produit = product_label × gallery (variantes)
   - About : summary enrichi (archetype template)
   - Contact : cta_whatsapp/email/phone
6. Update deal_rooms SET status='migrated_to_standalone', ofa_site_id=..., migrated_at=NOW()
7. Retour `{ ok: true, site_id, editor_url: '/admin/sites/{id}/editor', public_url: 'https://{slug}.ofaops.xyz' }`

### Side effects
- `/deal/[slug]` affiche banner "Ce deal room a migré → [lien site]" + 301 après 30j
- Email au seller : "Votre site OFA est prêt" avec link editor + public

## UI — `/seller/deal-rooms/[id]/migrate`

Page dédiée (pas bouton inline) pour éviter migration accidentelle :
- Preview avant/après (screenshot deal room → wireframe OFA généré)
- Checkbox "Je comprends que `/deal/[slug]` redirigera vers mon nouveau site"
- Champ slug custom (default = slug actuel + `-ofa`)
- Bouton "Migrer maintenant" → POST endpoint → spinner 45s → redirect editor

## Quality gates (bloquants avant commit)

1. Deal room doit avoir au moins : title, summary, product_label, 1 image (hero), 1 CTA (email|phone|whatsapp) — sinon 422 "deal_room_incomplete"
2. OFA publish gate appliqué sur site généré (100% images HTTP 200, CTAs actionnables) — si échec, site reste en draft avec erreurs listées dans editor
3. Idempotence : re-run endpoint retourne 409 si déjà migré (ne recrée pas un 2e site)

## Non-fonctionnalités (reste phase 3)

- Custom domain OFA (phase 3, Entri ou Domain Connect)
- Transfert historique leads deal_room → OFA analytics (phase 3, join table)
- Plan payant OFA requis ? — phase 3. En phase 2, premier mois offert si deal room had ≥ 1 paying transaction marketplace.

## Tests E2E

Script `scripts/e2e-deal-room-ofa-migration.ts` :
1. Crée deal room publiée avec tous champs requis
2. POST /api/deal-rooms/[id]/migrate-to-ofa
3. Vérifie : ofa_sites row créée, deal_rooms.status='migrated_to_standalone', ofa_site_id lié, 4 sections générées
4. 2e POST → 409 idempotent
5. Cleanup : supprime site OFA + deal room + leads

## Estimation

- Migration SQL : 15 min
- Endpoint /api/deal-rooms/[id]/migrate-to-ofa : 3-4h (inclut génération sections via OFA builder)
- UI /seller/deal-rooms/[id]/migrate : 2h
- Quality gates + tests : 2h
- **Total : ~1 journée dev**

## Dépendances

- OFA Admin API doit exposer `POST /api/admin/sites` (déjà exposée)
- Mapping archetype deal_room ↔ OFA — table `archetype_map` à créer ou constante dans code
- Bridge auth FTG ↔ OFA — déjà en place (site_access table shared)

## Suivi

Quand phase 2 est shippée : update `project_ftg_ofa_fusion.md` avec état + feedback utilisateurs.
