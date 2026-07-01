-- 2026-06-30 — Corrige o DONO das tabelas de anúncios do TikTok e LinkedIn.
--
-- PROBLEMA: a aplicação em produção lê o banco como o role `growth_dev`, que é
-- dono de quase todas as tabelas da app (inclusive Meta e Google, que funcionam).
-- Estas 5 tabelas, porém, foram criadas como `postgres` (via scripts create-*
-- rodados como superuser) e ficaram órfãs: `growth_dev` levava `permission denied`
-- ao ler/escrever, e as telas (Orçado × Realizado, Criativos) zeravam em silêncio
-- — mesmo com o dado presente na tabela (o sync escreve por uma conexão postgres).
--
-- FIX: passar a posse para `growth_dev`, alinhando com as tabelas do Meta/Google.
-- Idempotente: reexecutar quando já é dono é no-op.
--
-- REQUER: rodar como `postgres` (ou superuser). `growth_dev` não consegue se
-- autoconceder (não é dono nem membro do role dono).

ALTER TABLE tiktok.ad_metrics_daily   OWNER TO growth_dev;
ALTER TABLE tiktok.ad_campaigns       OWNER TO growth_dev;
ALTER TABLE linkedin.ad_metrics_daily OWNER TO growth_dev;
ALTER TABLE linkedin.ad_campaigns     OWNER TO growth_dev;
ALTER TABLE linkedin.ad_accounts      OWNER TO growth_dev;

-- Verificação (esperado: todas = growth_dev):
--   SELECT tablename, tableowner FROM pg_tables
--   WHERE schemaname IN ('tiktok','linkedin') AND tablename LIKE 'ad_%';
