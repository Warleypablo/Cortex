-- Central de Custos de IA — tabelas base (idempotente / aditivo)
CREATE SCHEMA IF NOT EXISTS cortex_core;

CREATE TABLE IF NOT EXISTS cortex_core.custo_assinaturas (
  id                      SERIAL PRIMARY KEY,
  fornecedor              VARCHAR(80)  NOT NULL,
  plano                   VARCHAR(120) NOT NULL,
  valor                   DECIMAL(18,2) NOT NULL DEFAULT 0,
  moeda                   VARCHAR(3)   NOT NULL DEFAULT 'USD',
  ciclo                   VARCHAR(10)  NOT NULL DEFAULT 'mensal', -- 'mensal' | 'anual'
  data_assinatura         DATE         NOT NULL,
  data_cancelamento       DATE,
  status                  VARCHAR(10)  NOT NULL DEFAULT 'ativo',  -- 'ativo' | 'inativo'
  responsavel_pessoa_id   INTEGER,
  projeto                 VARCHAR(20)  NOT NULL DEFAULT 'Geral',  -- 'Synapse' | 'Cortex' | 'Geral'
  observacoes             TEXT,
  created_at              TIMESTAMP    DEFAULT NOW(),
  updated_at              TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.custo_assinatura_usuarios (
  id             SERIAL PRIMARY KEY,
  assinatura_id  INTEGER NOT NULL REFERENCES cortex_core.custo_assinaturas(id) ON DELETE CASCADE,
  pessoa_id      INTEGER NOT NULL,
  CONSTRAINT uq_custo_assinatura_usuario UNIQUE (assinatura_id, pessoa_id)
);
CREATE INDEX IF NOT EXISTS idx_custo_assinatura_usuarios_assinatura ON cortex_core.custo_assinatura_usuarios(assinatura_id);

CREATE TABLE IF NOT EXISTS cortex_core.custo_itens_manuais (
  id                      SERIAL PRIMARY KEY,
  descricao               VARCHAR(160) NOT NULL,
  fornecedor              VARCHAR(80),
  categoria               VARCHAR(40),
  valor                   DECIMAL(18,2) NOT NULL DEFAULT 0,
  moeda                   VARCHAR(3)   NOT NULL DEFAULT 'USD',
  ciclo                   VARCHAR(10)  NOT NULL DEFAULT 'mensal', -- 'mensal' | 'anual' | 'pontual'
  data_inicio             DATE         NOT NULL,
  data_fim                DATE,
  status                  VARCHAR(10)  NOT NULL DEFAULT 'ativo',
  projeto                 VARCHAR(20)  NOT NULL DEFAULT 'Geral',
  responsavel_pessoa_id   INTEGER,
  observacoes             TEXT,
  created_at              TIMESTAMP    DEFAULT NOW(),
  updated_at              TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.custo_gcp_diario (
  id               SERIAL PRIMARY KEY,
  data             DATE NOT NULL,
  gcp_project_id   VARCHAR(120) NOT NULL,
  servico          VARCHAR(120) NOT NULL,
  custo            DECIMAL(18,4) NOT NULL DEFAULT 0,
  moeda            VARCHAR(3) NOT NULL DEFAULT 'USD',
  projeto_interno  VARCHAR(20) NOT NULL DEFAULT 'Geral',
  synced_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_custo_gcp_diario UNIQUE (data, gcp_project_id, servico)
);
CREATE INDEX IF NOT EXISTS idx_custo_gcp_diario_data ON cortex_core.custo_gcp_diario(data);

CREATE TABLE IF NOT EXISTS cortex_core.custo_anthropic_diario (
  id               SERIAL PRIMARY KEY,
  data             DATE NOT NULL,
  workspace        VARCHAR(120) NOT NULL DEFAULT '',
  modelo           VARCHAR(80)  NOT NULL DEFAULT '',
  custo_usd        DECIMAL(18,4) NOT NULL DEFAULT 0,
  tokens_input     BIGINT,
  tokens_output    BIGINT,
  projeto_interno  VARCHAR(20) NOT NULL DEFAULT 'Geral',
  synced_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_custo_anthropic_diario UNIQUE (data, workspace, modelo)
);
CREATE INDEX IF NOT EXISTS idx_custo_anthropic_diario_data ON cortex_core.custo_anthropic_diario(data);

CREATE TABLE IF NOT EXISTS cortex_core.custo_gcp_projeto_map (
  id               SERIAL PRIMARY KEY,
  gcp_project_id   VARCHAR(120) NOT NULL UNIQUE,
  projeto_interno  VARCHAR(20)  NOT NULL DEFAULT 'Geral'
);

CREATE TABLE IF NOT EXISTS cortex_core.custo_cambio_mensal (
  id            SERIAL PRIMARY KEY,
  ano_mes       VARCHAR(7) NOT NULL UNIQUE, -- 'YYYY-MM'
  taxa_usd_brl  DECIMAL(10,4) NOT NULL,
  fonte         VARCHAR(10) NOT NULL DEFAULT 'auto', -- 'auto' | 'manual'
  updated_at    TIMESTAMP DEFAULT NOW()
);
