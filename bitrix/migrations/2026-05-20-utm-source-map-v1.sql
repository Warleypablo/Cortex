-- Migration: UTM v1 — tabela de normalização + view crm_deal_normalized
-- Pré-requisito: migration 2026-05-20-utm-v1-columns.sql já executada
-- O DROP TABLE abaixo é seguro: utm_source_map da migration 2026-05-17
-- nunca foi referenciada em código (confirmado por busca no repositório)

DROP TABLE IF EXISTS public.utm_source_map;

CREATE TABLE public.utm_source_map (
    raw_source  TEXT PRIMARY KEY,
    normalized  TEXT NOT NULL
);

INSERT INTO public.utm_source_map (raw_source, normalized) VALUES
    -- 13 entradas legado
    ('facebook',            'meta'),
    ('fb',                  'meta'),
    ('instagram',           'meta'),
    ('ig',                  'meta'),
    ('meta',                'meta'),
    ('google',              'google'),
    ('google_ads',          'google'),
    ('googleads',           'google'),
    ('adwords',             'google'),
    ('youtube',             'youtube'),
    ('yt',                  'youtube'),
    ('organic',             'organic'),
    ('direct',              'direct'),
    -- 19 entradas Constituição v1
    ('meta_ads',            'meta'),
    ('meta-ads',            'meta'),
    ('google_search',       'google'),
    ('google-search',       'google'),
    ('google_display',      'google'),
    ('google-display',      'google'),
    ('google_shopping',     'google'),
    ('google-shopping',     'google'),
    ('tiktok',              'tiktok'),
    ('tiktok_ads',          'tiktok'),
    ('tiktok-ads',          'tiktok'),
    ('linkedin',            'linkedin'),
    ('linkedin_ads',        'linkedin'),
    ('linkedin-ads',        'linkedin'),
    ('whatsapp',            'whatsapp'),
    ('email',               'email'),
    ('sms',                 'sms'),
    ('referral',            'referral'),
    ('affiliate',           'affiliate');

-- View: Cortex passa a consultar essa view em vez de crm_deal diretamente
CREATE OR REPLACE VIEW "Bitrix".crm_deal_normalized AS
SELECT
    d.*,
    COALESCE(m.normalized, LOWER(d.utm_source)) AS utm_source_normalized
FROM "Bitrix".crm_deal d
LEFT JOIN public.utm_source_map m ON LOWER(d.utm_source) = m.raw_source;

-- Sanity check
SELECT
    (SELECT COUNT(*) FROM public.utm_source_map)                          AS total_mapeamentos,
    (SELECT COUNT(*) FROM "Bitrix".crm_deal_normalized WHERE utm_source_normalized IS NOT NULL) AS deals_com_source_normalizado;
