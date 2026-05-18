-- ============================================================
-- UTM v1 — colunas complementares em Bitrix.crm_deal
-- ============================================================
-- Adiciona 6 colunas necessárias pela Constituição UTM Turbo v1
-- (vigência: 21/05/2026):
--
--   utm_medium  — paid/organic/eventos/referral/crm/outbound (já existe no Bitrix CRM nativo,
--                 mas o sync atual não copia pro Cloud SQL).
--   fbclid      — identificador de clique do Meta (auto-injetado em ads).
--   gclid       — identificador de clique do Google (Auto-tagging ativo).
--   referrer    — document.referrer capturado por JS na LP — resolve os ~33% de leads sem UTM.
--   user_agent  — User-Agent do navegador (capturado server-side).
--   ip          — IP do cliente (LGPD: política de privacidade da Turbo já cobre).
--
-- Pré-requisito: o sync Bitrix→Postgres precisa ser atualizado pelo Warley para mapear
-- esses 6 campos. Sem isso, as colunas ficam vazias mesmo com o Bitrix recebendo.
--
-- Doc completo: docs/plano-implementacao-utm-v1.md
-- ============================================================

ALTER TABLE "Bitrix".crm_deal
  ADD COLUMN IF NOT EXISTS utm_medium  varchar(64),
  ADD COLUMN IF NOT EXISTS fbclid      varchar(255),
  ADD COLUMN IF NOT EXISTS gclid       varchar(255),
  ADD COLUMN IF NOT EXISTS referrer    text,
  ADD COLUMN IF NOT EXISTS user_agent  text,
  ADD COLUMN IF NOT EXISTS ip          varchar(45);

-- Sanity check: lista as colunas UTM da tabela após o ALTER
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'Bitrix'
  AND table_name = 'crm_deal'
  AND column_name IN (
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'gclid', 'referrer', 'user_agent', 'ip'
  )
ORDER BY column_name;
