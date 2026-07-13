-- Perfil comportamental DISC (aba G&G).
-- Uma linha por envio do teste (histórico por retake); "atual" = mais recente por user_id.
-- Idempotente. Aplicar em LOCAL e PROD.

CREATE TABLE IF NOT EXISTS "Inhire".rh_disc_resultados (
  id                serial PRIMARY KEY,
  user_id           varchar(100) NOT NULL,       -- cortex_core.auth_users.id
  colaborador_id    integer,                     -- "Inhire".rh_pessoal.id (resolvido no envio)
  respostas         jsonb NOT NULL,              -- array de 40 fatores escolhidos (auditoria)
  score_d           integer NOT NULL,
  score_i           integer NOT NULL,
  score_s           integer NOT NULL,
  score_c           integer NOT NULL,
  perfil_dominante  varchar(1) NOT NULL,
  perfil_secundario varchar(1) NOT NULL,
  criado_em         timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rh_disc_user ON "Inhire".rh_disc_resultados (user_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_rh_disc_colab ON "Inhire".rh_disc_resultados (colaborador_id);
