-- Migration: add contrato_templates table
-- Schema: staging
-- Date: 2026-03-20
-- Description: Stores contract template definitions with JSONB items for services/plans/prices

CREATE TABLE IF NOT EXISTS staging.contrato_templates (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  itens_template JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
