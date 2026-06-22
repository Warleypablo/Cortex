-- Calendário de Férias / Indisponibilidade
-- Schema: geg | Tabela: calendario_ferias

CREATE SCHEMA IF NOT EXISTS geg;

CREATE TABLE IF NOT EXISTS geg.calendario_ferias (
  id                    SERIAL PRIMARY KEY,
  colaborador_id        INTEGER NOT NULL,
  colaborador_nome      TEXT NOT NULL,
  colaborador_email     TEXT,
  data_inicio           DATE NOT NULL,
  data_fim              DATE NOT NULL,
  motivo                TEXT,

  -- Status principal (derivado dos dois abaixo)
  -- 'aprovado' somente quando status_rh = 'aprovado' E status_lider = 'aprovado'
  -- 'reprovado' quando status_rh = 'reprovado' OU status_lider = 'reprovado'
  status                TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente', 'aprovado', 'reprovado')),

  -- Aprovação dupla e independente
  status_rh             TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status_rh IN ('pendente', 'aprovado', 'reprovado')),
  status_lider          TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status_lider IN ('pendente', 'aprovado', 'reprovado')),

  aprovador_rh_email    TEXT,
  aprovador_rh_nome     TEXT,
  data_aprovacao_rh     TIMESTAMPTZ,
  observacao_rh         TEXT,

  aprovador_lider_email TEXT,
  aprovador_lider_nome  TEXT,
  data_aprovacao_lider  TIMESTAMPTZ,
  observacao_lider      TEXT,

  -- Legado: aprovação única (manter para compatibilidade)
  aprovador_email       TEXT,
  aprovador_nome        TEXT,
  data_aprovacao        TIMESTAMPTZ,
  observacao_aprovador  TEXT,

  -- Dados adicionais do colaborador
  data_admissao         DATE,
  squad_nome            TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para as queries mais comuns
CREATE INDEX IF NOT EXISTS idx_geg_calendario_ferias_status
  ON geg.calendario_ferias (status);

CREATE INDEX IF NOT EXISTS idx_geg_calendario_ferias_status_rh_lider
  ON geg.calendario_ferias (status_rh, status_lider);

CREATE INDEX IF NOT EXISTS idx_geg_calendario_ferias_colaborador
  ON geg.calendario_ferias (colaborador_id);

CREATE INDEX IF NOT EXISTS idx_geg_calendario_ferias_periodo
  ON geg.calendario_ferias (data_inicio, data_fim);

CREATE INDEX IF NOT EXISTS idx_geg_calendario_ferias_squad
  ON geg.calendario_ferias (squad_nome);

-- Trigger para manter updated_at automático
CREATE OR REPLACE FUNCTION geg.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendario_ferias_updated_at ON geg.calendario_ferias;
CREATE TRIGGER trg_calendario_ferias_updated_at
  BEFORE UPDATE ON geg.calendario_ferias
  FOR EACH ROW EXECUTE FUNCTION geg.set_updated_at();

-- Comentários
COMMENT ON TABLE geg.calendario_ferias IS 'Calendário de férias e indisponibilidade dos colaboradores, com fluxo de alinhamento duplo (RH + Líder).';
COMMENT ON COLUMN geg.calendario_ferias.status IS 'Derivado: aprovado apenas quando status_rh=aprovado E status_lider=aprovado';
COMMENT ON COLUMN geg.calendario_ferias.status_rh IS 'Alinhamento independente do RH';
COMMENT ON COLUMN geg.calendario_ferias.status_lider IS 'Alinhamento independente do Líder';
