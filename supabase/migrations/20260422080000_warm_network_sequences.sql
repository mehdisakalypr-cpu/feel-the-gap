-- FTG — Seed 3 outreach sequences for warm network personas (alex/maria/thomas).
--
-- These sequences are consumed by `agents/warm-network-dispatcher.ts` which
-- enrolls personal LinkedIn contacts (from `personal_network_contacts`) into
-- the persona-specific sequence. The actual touch dispatching is then
-- handled by the existing `agents/sequence-dispatcher.ts` cron.
--
-- Steps are LinkedIn-only at first (mailboxes alex@/maria@/thomas@gapup.io
-- are pending Google Workspace activation). Add email steps later by
-- updating the `steps` jsonb array.

-- Common helper: 3-touch LinkedIn warm sequence template.
-- step 1: connect note (day 0)
-- step 2: follow-up DM after acceptance (day 3)
-- step 3: gentle bump (day 7)

insert into public.ftg_sequences (id, name, description, segment, steps, max_days, respiration_strategy, stop_on_positive_reply, status)
values
  (
    gen_random_uuid(),
    'Warm Network — Alex (data/trader voice)',
    'Direct, data-first messaging for traders, investors, analysts in user''s personal LinkedIn network.',
    'warm_network_alex',
    '[
      {"channel":"linkedin_connect","provider":"phantombuster","delay_days":0,"body_template":"Hi {{first_name}} — saw your work at {{company_name}}. We just shipped Feel The Gap, which surfaces import/export gaps as scored opps. Curious what you think — short note attached."},
      {"channel":"linkedin_dm","provider":"phantombuster","delay_days":3,"body_template":"{{first_name}}, quick follow-up. We map every country''s trade balance and rank gaps by score. If {{company_name}} is sourcing internationally, this might cut weeks off your discovery. Want a 5-min look?"},
      {"channel":"linkedin_dm","provider":"phantombuster","delay_days":7,"body_template":"{{first_name}} — last bump. If timing is wrong just say so, no offense. Otherwise here''s a 30-sec demo: https://feel-the-gap.com/reports"}
    ]'::jsonb,
    14, 'stop_on_reply', true, 'active'
  ),
  (
    gen_random_uuid(),
    'Warm Network — Maria (founder/empathic voice)',
    'Narrative, empathic messaging for founders, CEOs, entrepreneurs in user''s personal LinkedIn network.',
    'warm_network_maria',
    '[
      {"channel":"linkedin_connect","provider":"phantombuster","delay_days":0,"body_template":"Hi {{first_name}} — your journey at {{company_name}} is impressive. I built Feel The Gap because I kept hitting the same wall: knowing WHERE the world has trade gaps. Would love to compare notes."},
      {"channel":"linkedin_dm","provider":"phantombuster","delay_days":3,"body_template":"{{first_name}}, thanks for connecting. As a founder you probably get the pain — finding the right market, the right country, the right product. We turned that into 211 country reports + AI business plans. Worth a 5-min look?"},
      {"channel":"linkedin_dm","provider":"phantombuster","delay_days":7,"body_template":"{{first_name}} — won''t pile on. If FTG could help {{company_name}} or someone in your network, we have a free tier with full reports: https://feel-the-gap.com"}
    ]'::jsonb,
    14, 'stop_on_reply', true, 'active'
  ),
  (
    gen_random_uuid(),
    'Warm Network — Thomas (corporate/strategic voice)',
    'Formal, strategic messaging for procurement, directors, heads-of in user''s personal LinkedIn network.',
    'warm_network_thomas',
    '[
      {"channel":"linkedin_connect","provider":"phantombuster","delay_days":0,"body_template":"{{first_name}}, with your role at {{company_name}} you may find Feel The Gap relevant — it benchmarks every country''s import/export profile and scores entry opportunities. Connecting to share."},
      {"channel":"linkedin_dm","provider":"phantombuster","delay_days":3,"body_template":"{{first_name}}, thanks for connecting. Quick context: FTG combines World Bank + Comtrade + AI to surface scored opportunities by country. For procurement / strategy teams, the Strategy tier (€99/mo) replaces weeks of analyst work. Worth a quick walkthrough?"},
      {"channel":"linkedin_dm","provider":"phantombuster","delay_days":7,"body_template":"{{first_name}} — final note. If FTG fits {{company_name}}''s sourcing or expansion roadmap, we offer enterprise demos with full data export. Otherwise no follow-up. Best."}
    ]'::jsonb,
    14, 'stop_on_reply', true, 'active'
  )
on conflict do nothing;
