-- Concessão de acesso a abas de Growth — 2026-06-30
--
-- Contexto: o acesso a páginas no Cortex é POR USUÁRIO (coluna allowed_routes
-- em cortex_core.auth_users). Os perfis (Base/Time/Líder) só se aplicam na
-- CRIAÇÃO da conta, não retroativamente — então páginas novas de Growth
-- (Creator Summit, Orgânico) ficaram invisíveis pra quem já existia.
--
-- Este script registra (idempotente) as concessões aplicadas em produção nesta
-- data. Já foi rodado no banco; serve como trilha de auditoria / re-execução.
-- Reaplicar é seguro: array_agg(DISTINCT ...) não duplica rotas existentes.
--
-- Cache: o app cacheia usuário por ~5min (USER_CACHE_TTL_MS); muda na hora no
-- banco mas reflete na tela após o cache expirar ou relogin.

-- 1) Time de Growth (os 4) — libera Creator Summit + Orgânico
UPDATE cortex_core.auth_users u
SET allowed_routes = (
  SELECT array_agg(DISTINCT r)
  FROM unnest(u.allowed_routes || ARRAY[
    '/growth/creator-summit',
    '/growth/organico'
  ]::text[]) r
)
WHERE lower(u.email) IN (
  'caio.malini@turbopartners.com.br',
  'esther.fiorio@turbopartners.com.br',
  'lucas.pereira@turbopartners.com.br',
  'vinicius.ichino@turbopartners.com.br'
);

-- 2) Vinicius Ichino — completa as abas de Growth que ainda faltavam
UPDATE cortex_core.auth_users u
SET allowed_routes = (
  SELECT array_agg(DISTINCT r)
  FROM unnest(u.allowed_routes || ARRAY[
    '/growth/criativos/biblioteca',
    '/growth/ai'
  ]::text[]) r
)
WHERE lower(u.email) = 'vinicius.ichino@turbopartners.com.br';

-- 3) Gabriel Taufner — TODAS as abas de Growth EXCETO DFC de CAC (/growth/dfc-cac)
UPDATE cortex_core.auth_users u
SET allowed_routes = (
  SELECT array_agg(DISTINCT r)
  FROM unnest(u.allowed_routes || ARRAY[
    '/growth/performance-plataformas',
    '/growth/criativos',
    '/growth/criativos/biblioteca',
    '/growth/orcado-realizado',
    '/growth/evolucao-temporal',
    '/growth/orcamento-campanhas',
    '/growth/creator-summit',
    '/growth/planejamento-metas',
    '/growth/ai',
    '/growth/instagram',
    '/growth/organico',
    '/crm-instagram',
    '/utm-builder',
    '/ghl-marketing'
  ]::text[]) r
)
WHERE lower(u.email) = 'gabriel.taufner@turbopartners.com.br';
