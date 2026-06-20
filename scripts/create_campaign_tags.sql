-- Tabela de tag/grupo por campanha (Meta Ads e Google Ads).
-- Alimenta as abas de filtro (Todas / Inbound / Evento / Sem tag) da tela
-- /growth/orcamento-campanhas.
--
-- Diferente de campaign_monthly_budget, NÃO tem coluna `month`: a tag é uma
-- propriedade estável da campanha (você classifica uma vez e ela persiste em
-- todos os meses). Tag única por campanha (PK em platform + campaign_id).
-- Os valores válidos de `tag` são validados na camada da aplicação (constante
-- CAMPAIGN_TAGS), por isso não há CHECK rígido aqui — adicionar uma tag nova é
-- só mudar o código, sem migração.

CREATE TABLE IF NOT EXISTS cortex_core.campaign_tags (
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
    campaign_id TEXT NOT NULL,
    tag TEXT,
    stage TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT,
    PRIMARY KEY (platform, campaign_id)
);

-- Migração para bancos onde a tabela já existia (tag NOT NULL, sem stage):
ALTER TABLE cortex_core.campaign_tags ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE cortex_core.campaign_tags ALTER COLUMN tag DROP NOT NULL;

COMMENT ON TABLE cortex_core.campaign_tags IS
    'Classificação por campanha (manual). platform: meta|google, campaign_id: meta_campaigns.campaign_id ou google.campaigns.campaign_id (como TEXT), tag: pool ex inbound|evento, stage: etapa ex descoberta|relacionamento|conversao|remarketing|institucional (validados no app). Estável entre meses.';
