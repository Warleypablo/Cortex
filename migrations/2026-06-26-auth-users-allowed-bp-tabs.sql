-- migrations/2026-06-26-auth-users-allowed-bp-tabs.sql
-- Coluna de whitelist de abas do BP 2026 por usuário (vazio = nenhuma aba).
ALTER TABLE cortex_core.auth_users
  ADD COLUMN IF NOT EXISTS allowed_bp_tabs text[] NOT NULL DEFAULT '{}';
