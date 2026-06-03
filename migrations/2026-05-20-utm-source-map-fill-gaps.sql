-- ============================================================
-- UTM Source Map — Preenchimento de gaps + alinhamento à v1.1
-- ============================================================
-- Adiciona 16 entries faltantes na public.utm_source_map e atualiza 5
-- entries existentes pra alinhar com a Constituição UTM Turbo v1.1.
--
-- Cobertura:
--   • 176 deals históricos com sources legado (clients, footer, guday,
--     rede-construir, shopify) que hoje caem em "outros"
--   • 6 sources novos da v1.1 que vão chegar a partir de 21/05
--     (cliente, colaborador, afiliado, influencer, marketplace, pinterest)
--   • 4 sources de teste isolados (claude-test, teste-n8n, smoke, ssource)
--   • Alinhamento: facebook/fb/meta/meta_ads/meta-ads → 'facebook' (era 'meta')
--   • Alinhamento: instagram/ig → 'instagram' (era 'meta')
--
-- Idempotente — ON CONFLICT DO UPDATE em todos os INSERTs.
--
-- Doc: docs/utm-source-map-fill-gaps.md
-- ============================================================

-- ------------------------------------------------------------
-- 1. INSERTs — sources legado (176 deals históricos)
-- ------------------------------------------------------------
INSERT INTO public.utm_source_map (raw_source, normalized) VALUES
  ('clients',         'cliente'),       -- 146 deals: footer institucional
  ('footer',          'cliente'),       -- 16 deals:  site institucional
  ('guday',           'cliente'),       -- 11 deals:  parceria Guday
  ('rede-construir',  'cliente'),       -- 2 deals:   parceria
  ('shopify',         'marketplace'),   -- 1 deal:    programa Shopify
  ('funcionario',     'colaborador')    -- v1.0 → v1.1 rename
ON CONFLICT (raw_source) DO UPDATE SET normalized = EXCLUDED.normalized;

-- ------------------------------------------------------------
-- 2. INSERTs — sources novos da Constituição v1.1 (cutover 21/05)
-- ------------------------------------------------------------
INSERT INTO public.utm_source_map (raw_source, normalized) VALUES
  ('cliente',      'cliente'),          -- novo source v1.1 (referral)
  ('colaborador',  'colaborador'),      -- novo source v1.1 (referral)
  ('afiliado',     'afiliado'),         -- novo source v1.1 (referral)
  ('influencer',   'influencer'),       -- novo source v1.1 (referral)
  ('marketplace',  'marketplace'),      -- novo source v1.1 (referral)
  ('pinterest',    'pinterest')         -- novo source v1.1 (paid + organic)
ON CONFLICT (raw_source) DO UPDATE SET normalized = EXCLUDED.normalized;

-- ------------------------------------------------------------
-- 3. INSERTs — sources de teste (4 deals)
-- ------------------------------------------------------------
INSERT INTO public.utm_source_map (raw_source, normalized) VALUES
  ('claude-test',  'test'),
  ('teste-n8n',    'test'),
  ('smoke',        'test'),
  ('ssource',      'test')
ON CONFLICT (raw_source) DO UPDATE SET normalized = EXCLUDED.normalized;

-- ------------------------------------------------------------
-- 4. UPDATEs — alinhar variantes Meta a 'facebook' (canônico v1.1)
-- ------------------------------------------------------------
UPDATE public.utm_source_map SET normalized = 'facebook'  WHERE raw_source = 'facebook';
UPDATE public.utm_source_map SET normalized = 'facebook'  WHERE raw_source = 'fb';
UPDATE public.utm_source_map SET normalized = 'facebook'  WHERE raw_source = 'meta';
UPDATE public.utm_source_map SET normalized = 'facebook'  WHERE raw_source = 'meta_ads';
UPDATE public.utm_source_map SET normalized = 'facebook'  WHERE raw_source = 'meta-ads';

-- ------------------------------------------------------------
-- 5. UPDATEs — separar instagram/ig de Meta paid
-- ------------------------------------------------------------
UPDATE public.utm_source_map SET normalized = 'instagram' WHERE raw_source = 'instagram';
UPDATE public.utm_source_map SET normalized = 'instagram' WHERE raw_source = 'ig';

-- ------------------------------------------------------------
-- 6. Sanity check
-- ------------------------------------------------------------
SELECT normalized, COUNT(*) AS variantes, STRING_AGG(raw_source, ', ' ORDER BY raw_source) AS raws
FROM public.utm_source_map
GROUP BY normalized
ORDER BY normalized;
