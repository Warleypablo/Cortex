-- Loop de Inteligência de Criativos (Fase 1) — aditivo e idempotente.
-- Conecta roteiro → Biblioteca → ad do Meta → performance, e semeia o vocabulário controlado.

-- ============== creative_batches (cabeçalho do lote, escrito pela skill) ==============
CREATE TABLE IF NOT EXISTS cortex_core.creative_batches (
  id              SERIAL PRIMARY KEY,
  drive_folder_id VARCHAR(64) NOT NULL UNIQUE,
  nome_ad         TEXT,
  produto         VARCHAR(64),
  roteiro_url     TEXT,
  clickup_task_id VARCHAR(64),
  modules         JSONB,
  created_by      VARCHAR(255),
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creative_batches_drive_folder_id
  ON cortex_core.creative_batches (drive_folder_id);

-- ============== creative_ad_links (ponte tpId ↔ ad_id) ==============
CREATE TABLE IF NOT EXISTS cortex_core.creative_ad_links (
  id          SERIAL PRIMARY KEY,
  creative_id INTEGER NOT NULL,
  tp_id       VARCHAR(16) NOT NULL,
  ad_id       VARCHAR(64) NOT NULL,
  source      VARCHAR(16) NOT NULL DEFAULT 'name_match',
  linked_at   TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creative_ad_links_creative_ad
  ON cortex_core.creative_ad_links (creative_id, ad_id);
CREATE INDEX IF NOT EXISTS idx_creative_ad_links_ad_id ON cortex_core.creative_ad_links (ad_id);
CREATE INDEX IF NOT EXISTS idx_creative_ad_links_tp_id ON cortex_core.creative_ad_links (tp_id);

-- ============== creative_vocab (listas controladas editáveis) ==============
CREATE TABLE IF NOT EXISTS cortex_core.creative_vocab (
  id         SERIAL PRIMARY KEY,
  kind       VARCHAR(32) NOT NULL,
  value      VARCHAR(64) NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creative_vocab_kind_value
  ON cortex_core.creative_vocab (kind, value);
CREATE INDEX IF NOT EXISTS idx_creative_vocab_kind ON cortex_core.creative_vocab (kind);

-- ============== colunas novas em creatives_library ==============
ALTER TABLE cortex_core.creatives_library ADD COLUMN IF NOT EXISTS body_tipo       VARCHAR(32);
ALTER TABLE cortex_core.creatives_library ADD COLUMN IF NOT EXISTS cta_tipo        VARCHAR(32);
ALTER TABLE cortex_core.creatives_library ADD COLUMN IF NOT EXISTS roteiro_url     TEXT;
ALTER TABLE cortex_core.creatives_library ADD COLUMN IF NOT EXISTS clickup_task_id VARCHAR(64);
ALTER TABLE cortex_core.creatives_library ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(64);

-- ============== seed do vocabulário (starter, editável depois pela UI) ==============
INSERT INTO cortex_core.creative_vocab (kind, value, label, sort_order) VALUES
  ('tipo', 'video', 'Vídeo', 1),
  ('tipo', 'estatico', 'Estático', 2),
  ('tipo', 'carrossel', 'Carrossel', 3),
  ('proporcao', '9x16', '9:16 (vertical)', 1),
  ('proporcao', '4x5', '4:5', 2),
  ('proporcao', '1x1', '1:1 (quadrado)', 3),
  ('proporcao', '16x9', '16:9 (horizontal)', 4),
  ('produto', 'creators', 'Creators', 1),
  ('produto', 'ecommerce', 'E-Commerce', 2),
  ('produto', 'estruturacao', 'Estruturação Comercial', 3),
  ('produto', 'ugc', 'UGC', 4),
  ('produto', 'shopify', 'Shopify', 5),
  ('angulo', 'prova-social', 'Prova social', 1),
  ('angulo', 'dor', 'Dor / problema', 2),
  ('angulo', 'autoridade', 'Autoridade', 3),
  ('angulo', 'oferta', 'Oferta / preço', 4),
  ('angulo', 'curiosidade', 'Curiosidade', 5),
  ('angulo', 'icp', 'Identificação / ICP', 6),
  ('angulo', 'transformacao', 'Transformação / resultado', 7),
  ('angulo', 'contraste', 'Contraste / inimigo comum', 8),
  ('angulo', 'urgencia', 'Urgência / escassez', 9),
  ('angulo', 'mecanismo', 'Mecanismo / novidade', 10),
  ('bodyTipo', 'oferta-led', 'Oferta-led', 1),
  ('bodyTipo', 'story', 'Story', 2),
  ('bodyTipo', 'mecanismo', 'Mecanismo', 3),
  ('bodyTipo', 'comparacao', 'Comparação', 4),
  ('bodyTipo', 'objecao', 'Quebra de objeção', 5),
  ('ctaTipo', 'direto', 'Direto', 1),
  ('ctaTipo', 'suave', 'Suave', 2),
  ('ctaTipo', 'urgencia', 'Urgência', 3),
  ('ctaTipo', 'prova', 'Prova', 4)
ON CONFLICT (kind, value) DO NOTHING;
