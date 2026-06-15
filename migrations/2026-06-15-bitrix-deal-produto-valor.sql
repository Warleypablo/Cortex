-- Tabela de valor por serviço dos deals do Bitrix, derivada das product rows
-- (linhas de produto com preço). Populada por scripts/sync-bitrix-product-rows.py.
-- Usada pela cascata da sub-aba "Vendas por Produto" como 1ª fonte de mix (exata),
-- antes do mix do ClickUp e do rateio por AOV médio.
CREATE TABLE IF NOT EXISTS cortex_core.bitrix_deal_produto_valor (
  deal_id       bigint    NOT NULL,
  segmento      text      NOT NULL,
  valor         numeric   NOT NULL,
  atualizado_em timestamp DEFAULT NOW(),
  PRIMARY KEY (deal_id, segmento)
);
