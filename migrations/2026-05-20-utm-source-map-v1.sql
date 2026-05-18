-- ============================================================
-- UTM v1 — utm_source_map + view crm_deal_normalized
-- ============================================================
-- Substitui a migration 2026-05-17-utm-source-map.sql (que nunca chegou a
-- ser usada em código). Implementa o dicionário oficial da
-- Constituição UTM Turbo v1 (vigência: 21/05/2026) e a view de
-- normalização em runtime que suporta legado + novo padrão
-- simultaneamente, sem alterar nenhum dado em Bitrix.crm_deal.
--
-- Pré-requisito: a migration 2026-05-20-utm-v1-columns.sql deve rodar antes
-- (a view consulta a coluna crm_deal.utm_medium).
--
-- Doc completo: docs/plano-implementacao-utm-v1.md
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela utm_source_map (recriada do zero)
-- ------------------------------------------------------------
-- A migration 2026-05-17 nunca foi consumida — drop sem risco.
DROP TABLE IF EXISTS public.utm_source_map;

CREATE TABLE public.utm_source_map (
  raw         text PRIMARY KEY,                 -- valor cru (lowercase) que chega na URL
  canonical   text NOT NULL,                    -- valor canônico segundo a constituição v1
  medium      text NOT NULL,                    -- paid | organic | eventos | referral | crm | outbound | test
  paid        boolean NOT NULL DEFAULT false,   -- atalho para filtros (== medium='paid')
  is_legacy   boolean NOT NULL DEFAULT false,   -- true para valores observados pré-cutover
  entity_from text,                             -- 'self' | 'utm_campaign' | 'utm_content' | NULL
                                                -- Diz de onde reconstruir a identidade do cliente/parceiro
                                                -- quando é dado legado. NULL = não precisa reconstruir
                                                -- (novo padrão já tem campaign correto).
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_utm_source_map_canonical ON public.utm_source_map(canonical);
CREATE INDEX idx_utm_source_map_medium    ON public.utm_source_map(medium);

-- ------------------------------------------------------------
-- 2. Seeds — legado (observado em Bitrix.crm_deal pré-21/05/2026)
-- ------------------------------------------------------------
INSERT INTO public.utm_source_map (raw, canonical, medium, paid, is_legacy, entity_from, notes) VALUES
  ('fb',             'facebook',    'paid',     true,  true,  NULL,            'Variação inconsistente de "facebook" — Meta Ads.'),
  ('meta',           'facebook',    'paid',     true,  true,  NULL,            'Variação de "facebook" — Meta Ads.'),
  ('clients',        'cliente',     'referral', false, true,  'utm_content',   'Footer institucional — slug do cliente está em utm_content.'),
  ('footer',         'cliente',     'referral', false, true,  'utm_campaign',  'Site institucional — slug do cliente está em utm_campaign.'),
  ('guday',          'cliente',     'referral', false, true,  'self',          'Parceria Guday — todos os 4 campos vinham com "guday".'),
  ('rede-construir', 'cliente',     'referral', false, true,  'self',          'Parceria Rede Construir — todos os 4 campos vinham com "rede-construir".'),
  ('shopify',        'marketplace', 'referral', false, true,  'self',          'Programa Shopify — tratado como marketplace na v1.'),
  ('turbo-news',     'email',       'crm',      false, true,  NULL,            'Newsletter Turbo News — colapsa em email genérico (1 deal histórico).'),
  ('teste',          'test',        'test',     false, true,  NULL,            'Lead de teste manual.'),
  ('teste-n8n',      'test',        'test',     false, true,  NULL,            'Teste de fluxo n8n.'),
  ('claude-test',    'test',        'test',     false, true,  NULL,            'Teste de automação via Claude.'),
  ('ssource',        'test',        'test',     false, true,  NULL,            'Typo de "source".'),
  ('source',         'test',        'test',     false, true,  NULL,            'Placeholder mal preenchido.');

-- ------------------------------------------------------------
-- 3. Seeds — Constituição UTM Turbo v1 (vocabulário fechado)
-- ------------------------------------------------------------
INSERT INTO public.utm_source_map (raw, canonical, medium, paid, is_legacy, entity_from, notes) VALUES
  -- paid
  ('facebook',  'facebook',  'paid',    true,  false, NULL, 'Meta Ads (FB + IG unificado).'),
  ('google',    'google',    'paid',    true,  false, NULL, 'Google Ads (search/display/demand gen).'),
  ('youtube',   'youtube',   'paid',    true,  false, NULL, 'YouTube Ads. Pode chegar como organic quando vier de descrição/card — utm_medium real prevalece.'),
  ('linkedin',  'linkedin',  'organic', false, false, NULL, 'Padrão organic. LinkedIn Ads (paid) é distinguido pelo utm_medium real.'),
  ('tiktok',    'tiktok',    'paid',    true,  false, NULL, 'TikTok Ads. Orgânico distinguido pelo utm_medium real.'),
  ('pinterest', 'pinterest', 'paid',    true,  false, NULL, 'Pinterest Ads.'),

  -- organic
  ('instagram', 'instagram', 'organic', false, false, NULL, 'Posts/reels/stories/bio. Inclusive quando passa por Linktree (utm_term=linktree).'),

  -- referral
  ('cliente',      'cliente',      'referral', false, false, NULL, 'Lead vindo via cliente atual da Turbo. Identidade em utm_campaign.'),
  ('funcionario',  'funcionario',  'referral', false, false, NULL, 'Indicação informal de alguém do time.'),
  ('afiliado',     'afiliado',     'referral', false, false, NULL, 'Programa formal de afiliados.'),
  ('influencer',   'influencer',   'referral', false, false, NULL, 'Criador externo postando link.'),
  ('marketplace',  'marketplace',  'referral', false, false, NULL, 'Diretório de parceiros (Shopify Partners, RD Partners, etc).'),

  -- crm
  ('email',    'email',    'crm', false, false, NULL, 'Qualquer disparo de e-mail para base própria.'),
  ('whatsapp', 'whatsapp', 'crm', false, false, NULL, 'Broadcast/disparo via WhatsApp.'),
  ('sms',      'sms',      'crm', false, false, NULL, 'Disparo de SMS.'),

  -- outbound
  ('email-frio',        'email-frio',        'outbound', false, false, NULL, 'Cold email via Apollo/Reply/Lemlist.'),
  ('linkedin-outreach', 'linkedin-outreach', 'outbound', false, false, NULL, 'Conexão + DM via LinkedIn (Sales Navigator etc).'),
  ('whatsapp-frio',     'whatsapp-frio',     'outbound', false, false, NULL, 'Abordagem direta no WhatsApp do prospect.'),
  ('ligacao',           'ligacao',           'outbound', false, false, NULL, 'Follow-up via cold call com link enviado depois.');

-- Nota: eventos ficam fora da tabela — vocabulário aberto (nome-do-evento em slug).
-- Qualquer deal com utm_medium='eventos' é tratado como evento na view.

-- ------------------------------------------------------------
-- 4. View Bitrix.crm_deal_normalized
-- ------------------------------------------------------------
-- Aplica a normalização em runtime. Toda query de classificação
-- por canal deve consultar esta view, não a tabela bruta.
--
-- Decisões refletidas:
--   1) Deals sem UTM ficam NULL (não inventa "direto").
--      NULLIF garante que string vazia também vire NULL.
--   2) utm_medium real (quando preenchido) ganha do medium da map.
--      Necessário porque linkedin/youtube/tiktok podem ser paid OU organic.
--   3) Entidade do cliente é reconstruída via entity_from para dados legados.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW "Bitrix".crm_deal_normalized AS
SELECT
  d.*,
  COALESCE(m.canonical, NULLIF(LOWER(TRIM(d.utm_source)), '')) AS norm_source,
  COALESCE(NULLIF(d.utm_medium, ''), m.medium)                 AS norm_medium,
  CASE
    WHEN m.entity_from = 'self'         THEN LOWER(TRIM(d.utm_source))
    WHEN m.entity_from = 'utm_campaign' THEN d.utm_campaign
    WHEN m.entity_from = 'utm_content'  THEN d.utm_content
    ELSE d.utm_campaign                              -- novo padrão: campaign já tem a entidade
  END                                                          AS norm_campaign,
  d.utm_content                                                AS norm_content,
  d.utm_term                                                   AS norm_term,
  COALESCE(m.is_legacy, false)                                 AS is_legacy_utm,
  COALESCE(m.paid, false)                                      AS is_paid
FROM "Bitrix".crm_deal d
LEFT JOIN public.utm_source_map m
       ON m.raw = LOWER(TRIM(d.utm_source));

COMMENT ON VIEW "Bitrix".crm_deal_normalized IS
  'Normalização das UTMs (legado + Constituição v1) aplicada em runtime via utm_source_map. Toda query do Cortex que classifica por canal deve usar esta view. Doc: docs/plano-implementacao-utm-v1.md';

-- ------------------------------------------------------------
-- 5. Sanity checks
-- ------------------------------------------------------------

-- 5a. Resumo da tabela
SELECT
  medium,
  COUNT(*) FILTER (WHERE is_legacy)     AS variantes_legado,
  COUNT(*) FILTER (WHERE NOT is_legacy) AS variantes_v1,
  STRING_AGG(raw, ', ' ORDER BY raw)    AS raws
FROM public.utm_source_map
GROUP BY medium
ORDER BY 1;

-- 5b. Distribuição real do banco passando pela view
SELECT
  norm_source,
  norm_medium,
  is_legacy_utm,
  COUNT(*) AS deals
FROM "Bitrix".crm_deal_normalized
WHERE date_create >= NOW() - INTERVAL '90 days'
GROUP BY 1, 2, 3
ORDER BY 4 DESC
LIMIT 30;
