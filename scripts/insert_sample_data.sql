-- Sample Data for Meta Ads Dashboard
-- Generates 30 days of realistic campaign data with CRM conversions

-- 1. Meta Account
INSERT INTO meta_accounts (account_id, account_name, currency, timezone_name, created_time)
VALUES 
('act_123456789', 'Turbo Partners - Meta Ads', 'BRL', 'America/Sao_Paulo', '2024-01-01 10:00:00');

-- 2. Meta Campaigns
INSERT INTO meta_campaigns (campaign_id, account_id, campaign_name, objective, status, created_time)
VALUES 
('camp_001', 'act_123456789', 'Geração de Leads - Performance', 'LEAD_GENERATION', 'ACTIVE', '2024-10-01 09:00:00'),
('camp_002', 'act_123456789', 'Reconhecimento de Marca - Awareness', 'BRAND_AWARENESS', 'ACTIVE', '2024-10-15 14:30:00'),
('camp_003', 'act_123456789', 'Conversões - Vendas Diretas', 'CONVERSIONS', 'ACTIVE', '2024-11-01 11:00:00');

-- 3. Meta AdSets
INSERT INTO meta_adsets (adset_id, campaign_id, account_id, adset_name, optimization_goal, billing_event, daily_budget, status, created_time)
VALUES 
('adset_001', 'camp_001', 'act_123456789', 'Público Quente - SP/RJ', 'LEAD', 'IMPRESSIONS', 300.00, 'ACTIVE', '2024-10-01 09:30:00'),
('adset_002', 'camp_001', 'act_123456789', 'Lookalike - Clientes', 'LEAD', 'IMPRESSIONS', 450.00, 'ACTIVE', '2024-10-02 10:00:00'),
('adset_003', 'camp_002', 'act_123456789', 'Awareness - Brasil', 'REACH', 'IMPRESSIONS', 200.00, 'ACTIVE', '2024-10-15 15:00:00'),
('adset_004', 'camp_002', 'act_123456789', 'Awareness - Teste A/B', 'REACH', 'IMPRESSIONS', 250.00, 'ACTIVE', '2024-10-16 09:00:00'),
('adset_005', 'camp_003', 'act_123456789', 'Conversão - Retargeting', 'CONVERSIONS', 'LINK_CLICKS', 500.00, 'ACTIVE', '2024-11-01 12:00:00'),
('adset_006', 'camp_003', 'act_123456789', 'Conversão - Cold Audience', 'CONVERSIONS', 'LINK_CLICKS', 350.00, 'ACTIVE', '2024-11-02 08:00:00');

-- 4. Meta Creatives
INSERT INTO meta_creatives (creative_id, account_id, creative_name, title, body, image_url, video_url, call_to_action, object_type, created_time)
VALUES 
('creative_001', 'act_123456789', 'Criativo Estático 1', 'Transforme seu negócio com Marketing Digital', 'Descubra como aumentar suas vendas em até 300%', 'https://example.com/img1.jpg', NULL, 'LEARN_MORE', 'IMAGE', '2024-10-01 09:00:00'),
('creative_002', 'act_123456789', 'Criativo Estático 2', 'Leads Qualificados para seu Negócio', 'Sistema comprovado de geração de leads', 'https://example.com/img2.jpg', NULL, 'SIGN_UP', 'IMAGE', '2024-10-01 09:15:00'),
('creative_003', 'act_123456789', 'Vídeo Depoimento', 'Cases de Sucesso', 'Veja como nossos clientes cresceram', NULL, 'https://example.com/video1.mp4', 'WATCH_MORE', 'VIDEO', '2024-10-05 11:00:00'),
('creative_004', 'act_123456789', 'Vídeo Tutorial', 'Aprenda Marketing Digital', 'Tutorial completo em 60 segundos', NULL, 'https://example.com/video2.mp4', 'LEARN_MORE', 'VIDEO', '2024-10-10 14:00:00'),
('creative_005', 'act_123456789', 'Criativo Promo', 'Oferta Especial - 50% OFF', 'Última chance! Vagas limitadas', 'https://example.com/img3.jpg', NULL, 'SHOP_NOW', 'IMAGE', '2024-11-01 10:00:00'),
('creative_006', 'act_123456789', 'Carrossel Produtos', 'Conheça Nossos Serviços', 'Soluções completas de marketing', 'https://example.com/carousel.jpg', NULL, 'LEARN_MORE', 'IMAGE', '2024-11-01 11:00:00');

-- 5. Meta Ads
INSERT INTO meta_ads (ad_id, adset_id, campaign_id, account_id, ad_name, creative_id, status, created_time)
VALUES 
('ad_001', 'adset_001', 'camp_001', 'act_123456789', 'Lead Gen - Imagem 1', 'creative_001', 'ACTIVE', '2024-10-01 10:00:00'),
('ad_002', 'adset_001', 'camp_001', 'act_123456789', 'Lead Gen - Imagem 2', 'creative_002', 'ACTIVE', '2024-10-01 10:30:00'),
('ad_003', 'adset_002', 'camp_001', 'act_123456789', 'Lookalike - Video', 'creative_003', 'ACTIVE', '2024-10-02 11:00:00'),
('ad_004', 'adset_002', 'camp_001', 'act_123456789', 'Lookalike - Imagem', 'creative_001', 'ACTIVE', '2024-10-02 11:30:00'),
('ad_005', 'adset_003', 'camp_002', 'act_123456789', 'Awareness - Tutorial', 'creative_004', 'ACTIVE', '2024-10-15 16:00:00'),
('ad_006', 'adset_003', 'camp_002', 'act_123456789', 'Awareness - Depoimento', 'creative_003', 'ACTIVE', '2024-10-15 16:30:00'),
('ad_007', 'adset_004', 'camp_002', 'act_123456789', 'Awareness - Teste A', 'creative_001', 'ACTIVE', '2024-10-16 09:30:00'),
('ad_008', 'adset_004', 'camp_002', 'act_123456789', 'Awareness - Teste B', 'creative_002', 'ACTIVE', '2024-10-16 10:00:00'),
('ad_009', 'adset_005', 'camp_003', 'act_123456789', 'Retarget - Promo', 'creative_005', 'ACTIVE', '2024-11-01 13:00:00'),
('ad_010', 'adset_005', 'camp_003', 'act_123456789', 'Retarget - Carrossel', 'creative_006', 'ACTIVE', '2024-11-01 13:30:00'),
('ad_011', 'adset_006', 'camp_003', 'act_123456789', 'Cold - Video', 'creative_003', 'ACTIVE', '2024-11-02 09:00:00'),
('ad_012', 'adset_006', 'camp_003', 'act_123456789', 'Cold - Imagem', 'creative_002', 'ACTIVE', '2024-11-02 09:30:00');

-- 6. Meta Insights Daily (Last 30 days)
-- Generating data from 2024-10-22 to 2024-11-20 (30 days)
INSERT INTO meta_insights_daily (
    date_start, account_id, campaign_id, adset_id, ad_id, creative_id,
    impressions, clicks, spend, reach, frequency,
    cpm, cpc, ctr,
    video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched,
    actions_lead
)
SELECT 
    date_series::date as date_start,
    'act_123456789',
    campaign_id,
    adset_id,
    ad_id,
    creative_id,
    -- Realistic metrics with variation
    (random() * 5000 + 1000)::integer as impressions,
    (random() * 250 + 50)::integer as clicks,
    (random() * 300 + 100)::numeric(12,2) as spend,
    (random() * 3000 + 500)::integer as reach,
    (random() * 2 + 1)::numeric(10,4) as frequency,
    (random() * 50 + 10)::numeric(10,4) as cpm,
    (random() * 5 + 1)::numeric(10,4) as cpc,
    (random() * 10 + 2)::numeric(10,4) as ctr,
    -- Video metrics (only for video creatives)
    CASE WHEN creative_id IN ('creative_003', 'creative_004') THEN (random() * 100 + 20)::integer ELSE 0 END as video_p25_watched,
    CASE WHEN creative_id IN ('creative_003', 'creative_004') THEN (random() * 80 + 15)::integer ELSE 0 END as video_p50_watched,
    CASE WHEN creative_id IN ('creative_003', 'creative_004') THEN (random() * 50 + 10)::integer ELSE 0 END as video_p75_watched,
    CASE WHEN creative_id IN ('creative_003', 'creative_004') THEN (random() * 30 + 5)::integer ELSE 0 END as video_p100_watched,
    -- Lead conversions
    (random() * 15 + 5)::integer as actions_lead
FROM 
    generate_series('2024-10-22'::date, '2024-11-20'::date, '1 day'::interval) as date_series,
    (VALUES 
        ('camp_001', 'adset_001', 'ad_001', 'creative_001'),
        ('camp_001', 'adset_001', 'ad_002', 'creative_002'),
        ('camp_001', 'adset_002', 'ad_003', 'creative_003'),
        ('camp_001', 'adset_002', 'ad_004', 'creative_001'),
        ('camp_002', 'adset_003', 'ad_005', 'creative_004'),
        ('camp_002', 'adset_003', 'ad_006', 'creative_003'),
        ('camp_002', 'adset_004', 'ad_007', 'creative_001'),
        ('camp_002', 'adset_004', 'ad_008', 'creative_002'),
        ('camp_003', 'adset_005', 'ad_009', 'creative_005'),
        ('camp_003', 'adset_005', 'ad_010', 'creative_006'),
        ('camp_003', 'adset_006', 'ad_011', 'creative_003'),
        ('camp_003', 'adset_006', 'ad_012', 'creative_002')
    ) as ads(campaign_id, adset_id, ad_id, creative_id);

-- 7. CRM Deals with UTM tracking (conversions from Meta Ads)
INSERT INTO crm_deal (
    deal_id, deal_name, stage_name, pipeline_name,
    valor_pontual, valor_recorrente,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    contact_name, company_name, contact_email, contact_phone,
    created_date, close_date, owner_name, lead_source
)
VALUES 
-- Won deals from camp_001
('deal_001', 'Projeto Marketing Digital - Empresa A', 'Negócio Ganho (WON)', 'Vendas', 0, 8500.00, 'facebook', 'paid', 'camp_001', 'adset_001', 'ad_001', 'João Silva', 'Empresa A Ltda', 'joao@empresaa.com.br', '11988887777', '2024-10-25 14:30:00', '2024-11-05 16:00:00', 'Vendedor 1', 'Meta Ads'),
('deal_002', 'Consultoria Performance - Empresa B', 'Negócio Ganho (WON)', 'Vendas', 3500.00, 0, 'facebook', 'paid', 'camp_001', 'adset_002', 'ad_003', 'Maria Santos', 'Empresa B S.A.', 'maria@empresab.com.br', '11977776666', '2024-10-28 10:15:00', '2024-11-08 11:00:00', 'Vendedor 1', 'Meta Ads'),
('deal_003', 'Pacote Completo - Empresa C', 'Negócio Ganho (WON)', 'Vendas', 0, 12000.00, 'facebook', 'paid', 'camp_001', 'adset_001', 'ad_002', 'Pedro Costa', 'Empresa C ME', 'pedro@empresac.com.br', '11966665555', '2024-11-02 09:00:00', '2024-11-12 15:30:00', 'Vendedor 2', 'Meta Ads'),

-- Won deals from camp_003
('deal_004', 'Serviço Premium - Empresa D', 'Negócio Ganho (WON)', 'Vendas', 5000.00, 6500.00, 'facebook', 'paid', 'camp_003', 'adset_005', 'ad_009', 'Ana Lima', 'Empresa D Corp', 'ana@empresad.com.br', '11955554444', '2024-11-05 13:20:00', '2024-11-15 10:00:00', 'Vendedor 3', 'Meta Ads'),
('deal_005', 'Projeto Estratégico - Empresa E', 'Negócio Ganho (WON)', 'Vendas', 0, 15000.00, 'facebook', 'paid', 'camp_003', 'adset_006', 'ad_012', 'Carlos Souza', 'Empresa E Ltda', 'carlos@empresae.com.br', '11944443333', '2024-11-10 11:45:00', '2024-11-18 14:00:00', 'Vendedor 2', 'Meta Ads'),

-- Open deals (pipeline)
('deal_006', 'Lead Qualificado - Empresa F', 'Qualificação', 'Vendas', 0, 0, 'facebook', 'paid', 'camp_001', 'adset_002', 'ad_004', 'Fernanda Dias', 'Empresa F', 'fernanda@empresaf.com.br', '11933332222', '2024-11-15 15:00:00', NULL, 'Vendedor 1', 'Meta Ads'),
('deal_007', 'Proposta Enviada - Empresa G', 'Proposta', 'Vendas', 0, 0, 'facebook', 'paid', 'camp_003', 'adset_005', 'ad_010', 'Ricardo Alves', 'Empresa G S.A.', 'ricardo@empresag.com.br', '11922221111', '2024-11-16 08:30:00', NULL, 'Vendedor 3', 'Meta Ads'),
('deal_008', 'Negociação - Empresa H', 'Negociação', 'Vendas', 0, 0, 'facebook', 'paid', 'camp_001', 'adset_001', 'ad_001', 'Juliana Martins', 'Empresa H ME', 'juliana@empresah.com.br', '11911110000', '2024-11-17 10:00:00', NULL, 'Vendedor 2', 'Meta Ads'),

-- Lost deals
('deal_009', 'Perdido - Preço - Empresa I', 'Negócio Perdido', 'Vendas', 0, 0, 'facebook', 'paid', 'camp_002', 'adset_003', 'ad_005', 'Roberto Ferreira', 'Empresa I', 'roberto@empresai.com.br', '11900009999', '2024-10-30 16:00:00', '2024-11-07 09:00:00', 'Vendedor 1', 'Meta Ads'),
('deal_010', 'Perdido - Timing - Empresa J', 'Negócio Perdido', 'Vendas', 0, 0, 'facebook', 'paid', 'camp_003', 'adset_006', 'ad_011', 'Beatriz Rocha', 'Empresa J Ltda', 'beatriz@empresaj.com.br', '11988889999', '2024-11-08 14:30:00', '2024-11-14 11:00:00', 'Vendedor 3', 'Meta Ads');

-- Verify data
SELECT 'Meta Accounts' as table_name, COUNT(*) as total FROM meta_accounts
UNION ALL
SELECT 'Meta Campaigns', COUNT(*) FROM meta_campaigns
UNION ALL
SELECT 'Meta AdSets', COUNT(*) FROM meta_adsets
UNION ALL
SELECT 'Meta Ads', COUNT(*) FROM meta_ads
UNION ALL
SELECT 'Meta Creatives', COUNT(*) FROM meta_creatives
UNION ALL
SELECT 'Meta Insights Daily', COUNT(*) FROM meta_insights_daily
UNION ALL
SELECT 'CRM Deals', COUNT(*) FROM crm_deal
UNION ALL
SELECT 'CRM Won Deals', COUNT(*) FROM crm_deal WHERE stage_name = 'Negócio Ganho (WON)';
