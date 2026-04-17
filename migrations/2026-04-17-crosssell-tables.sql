-- CrossSell Management System tables
-- Schema: cortex_core

CREATE TABLE IF NOT EXISTS cortex_core.crosssell_oportunidades (
  id SERIAL PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  produto_mapeado TEXT NOT NULL,
  etapa TEXT NOT NULL DEFAULT 'fazer_contato',
  valor_r_negociacao NUMERIC(12,2) DEFAULT 0,
  valor_p_negociacao NUMERIC(12,2) DEFAULT 0,
  cx_responsavel TEXT NOT NULL,
  ultimo_contato DATE,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.crosssell_comentarios (
  id SERIAL PRIMARY KEY,
  oportunidade_id INTEGER NOT NULL REFERENCES cortex_core.crosssell_oportunidades(id) ON DELETE CASCADE,
  autor TEXT NOT NULL,
  texto TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.crosssell_negocios_ganhos (
  id SERIAL PRIMARY KEY,
  oportunidade_id INTEGER NOT NULL REFERENCES cortex_core.crosssell_oportunidades(id),
  cliente_nome TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  valor_r NUMERIC(12,2) NOT NULL,
  valor_p NUMERIC(12,2) NOT NULL,
  cx_responsavel TEXT NOT NULL,
  operacao TEXT[] NOT NULL,
  produto TEXT NOT NULL,
  mes_ganho DATE NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.crosssell_etapa_log (
  id SERIAL PRIMARY KEY,
  oportunidade_id INTEGER NOT NULL REFERENCES cortex_core.crosssell_oportunidades(id) ON DELETE CASCADE,
  etapa_anterior TEXT NOT NULL,
  etapa_nova TEXT NOT NULL,
  alterado_por TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_etapa ON cortex_core.crosssell_oportunidades(etapa);
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_cx ON cortex_core.crosssell_oportunidades(cx_responsavel);
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_cnpj ON cortex_core.crosssell_oportunidades(cnpj);
CREATE INDEX IF NOT EXISTS idx_crosssell_comentarios_oport ON cortex_core.crosssell_comentarios(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_crosssell_ganhos_oport ON cortex_core.crosssell_negocios_ganhos(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_crosssell_etapa_log_oport ON cortex_core.crosssell_etapa_log(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_crosssell_etapa_log_etapa_nova ON cortex_core.crosssell_etapa_log(etapa_nova);
