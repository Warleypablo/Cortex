-- Tabela de metas mensais de investimento por campanha (Meta Ads e Google Ads).
-- Alimenta a coluna "Investimento Mensal (Meta)" da tela /growth/orcamento-campanhas.

CREATE TABLE IF NOT EXISTS cortex_core.campaign_monthly_budget (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
    campaign_id TEXT NOT NULL,
    month DATE NOT NULL,
    monthly_budget_target NUMERIC(12, 2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT,
    UNIQUE (platform, campaign_id, month)
);

CREATE INDEX IF NOT EXISTS idx_campaign_monthly_budget_month
    ON cortex_core.campaign_monthly_budget (month);

COMMENT ON TABLE cortex_core.campaign_monthly_budget IS
    'Metas mensais de investimento por campanha (manual). platform: meta|google, campaign_id: meta_campaigns.campaign_id ou google_ads.campaigns.campaign_id (bigint como TEXT), month: primeiro dia do mês.';
