-- UTM Builder v1.1 — vocabulário fechado de campaign/term + auditoria de links gerados
-- Plano: /Users/ichino/.claude/plans/quero-a-sua-ajuda-declarative-minsky.md
-- Constituição: docs/utm-constituicao.md

-- =============================================================================
-- 1. Vocabulário fechado de campaign e term (mediums + sources são fixos no TS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_core.utm_vocabulary (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  field       VARCHAR(20) NOT NULL CHECK (field IN ('campaign', 'term')),
  medium      VARCHAR(20) NOT NULL,
  source      VARCHAR(40),                              -- NULL = vale pra qualquer source do medium
  value       VARCHAR(120) NOT NULL,                    -- já sanitizado (lowercase, hífen, sem acento)
  label_pt    TEXT NOT NULL,                            -- exibido no dropdown
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  VARCHAR,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índice único tratando NULL em source como string vazia (eventos não têm source canônico)
CREATE UNIQUE INDEX IF NOT EXISTS uq_utm_vocabulary_combo
  ON cortex_core.utm_vocabulary (field, medium, COALESCE(source, ''), value);

CREATE INDEX IF NOT EXISTS idx_utm_vocabulary_lookup
  ON cortex_core.utm_vocabulary (field, medium, source)
  WHERE is_active;

-- =============================================================================
-- 2. Auditoria de links gerados
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_core.generated_utm_links (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      VARCHAR NOT NULL,
  base_url     TEXT NOT NULL,
  utm_source   VARCHAR(40) NOT NULL,
  utm_medium   VARCHAR(20) NOT NULL,
  utm_campaign VARCHAR(120),
  utm_term     VARCHAR(120),
  utm_content  VARCHAR(200),
  full_url     TEXT NOT NULL,
  is_adhoc     BOOLEAN NOT NULL DEFAULT FALSE,          -- true se campaign ou term foram "Outro"
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_utm_links_created
  ON cortex_core.generated_utm_links (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_utm_links_user
  ON cortex_core.generated_utm_links (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_utm_links_adhoc
  ON cortex_core.generated_utm_links (is_adhoc)
  WHERE is_adhoc;

-- =============================================================================
-- 3. Seed v1.1 — vocabulário padronizado conforme Constituição UTM Turbo v1.1
-- =============================================================================

INSERT INTO cortex_core.utm_vocabulary (field, medium, source, value, label_pt) VALUES

  -- =================== ORGANIC — CAMPAIGNS ===================
  ('campaign', 'organic', NULL,        'always-on',     'Always-on (presença contínua)'),
  ('campaign', 'organic', NULL,        'automacoes',    'Automações (ManyChat/bot)'),
  ('campaign', 'organic', NULL,        'social-selling','Social Selling (SDR via DM)'),

  -- =================== ORGANIC — TERMS ===================
  -- Instagram
  ('term',     'organic', 'instagram', 'bio',           'Bio'),
  ('term',     'organic', 'instagram', 'destaques',     'Destaques'),
  ('term',     'organic', 'instagram', 'linktree',      'Linktree'),
  ('term',     'organic', 'instagram', 'feed',          'Feed'),
  ('term',     'organic', 'instagram', 'stories',       'Stories'),
  ('term',     'organic', 'instagram', 'reels',         'Reels'),
  ('term',     'organic', 'instagram', 'dm',            'DM'),
  -- LinkedIn
  ('term',     'organic', 'linkedin',  'feed',          'Feed'),
  ('term',     'organic', 'linkedin',  'dm',            'DM'),
  -- YouTube
  ('term',     'organic', 'youtube',   'descricao-video','Descrição do vídeo'),
  ('term',     'organic', 'youtube',   'card',          'Card'),
  -- TikTok
  ('term',     'organic', 'tiktok',    'bio',           'Bio'),
  ('term',     'organic', 'tiktok',    'descricao-video','Descrição do vídeo'),
  ('term',     'organic', 'tiktok',    'dm',            'DM'),

  -- =================== CRM — CAMPAIGNS ===================
  ('campaign', 'crm', NULL, 'nutricao-creators',  'Nutrição Creators'),
  ('campaign', 'crm', NULL, 'nutricao-ecommerce', 'Nutrição E-Commerce'),
  ('campaign', 'crm', NULL, 'newsletter',         'Newsletter'),
  ('campaign', 'crm', NULL, 'broadcast',          'Broadcast'),

  -- =================== CRM — TERMS ===================
  ('term', 'crm', NULL, 'cliente',     'Clientes ativos'),
  ('term', 'crm', NULL, 'ex-clientes', 'Ex-clientes'),
  ('term', 'crm', NULL, 'leads',       'Leads (não-clientes)'),

  -- =================== REFERRAL — CAMPAIGNS ===================
  -- Clientes ativos
  ('campaign', 'referral', 'cliente',      'bready',            'Bready'),
  ('campaign', 'referral', 'cliente',      'guday',             'Guday'),
  -- Marketplaces
  ('campaign', 'referral', 'marketplace',  'shopify-partners',  'Shopify Partners'),

  -- =================== REFERRAL — TERMS ===================
  ('term', 'referral', 'cliente',     'footer',       'Footer institucional'),
  ('term', 'referral', 'cliente',     'indicacao',    'Indicação direta'),
  ('term', 'referral', 'colaborador', 'indicacao',    'Indicação informal'),
  ('term', 'referral', 'colaborador', 'apresentacao', 'Apresentação pessoal'),
  ('term', 'referral', 'marketplace', 'diretorio',    'Diretório'),

  -- =================== EVENTOS — TERMS ===================
  -- (campaign de eventos é aberto: tipo + ano. Source é o nome do evento.)
  ('term', 'eventos', NULL, 'palestra',          'Palestra'),
  ('term', 'eventos', NULL, 'estande',           'Estande'),
  ('term', 'eventos', NULL, 'material-impresso', 'Material impresso'),
  ('term', 'eventos', NULL, 'qrcode',            'QR Code')

ON CONFLICT (field, medium, (COALESCE(source, '')), value) DO NOTHING;
