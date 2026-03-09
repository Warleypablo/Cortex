# Design: Edição de Metas do BP 2026

## Problema
As metas do BP 2026 estão hardcoded em `server/okr2026/bp2026Targets.ts`. Não há forma de editá-las pela interface.

## Solução
Botão "Editar Metas" na aba BP (dentro de OKR) que abre modal com tabela editável, persistindo no banco de dados.

## Implementação

### 1. Banco de dados
- Tabela `cortex_core.bp_targets`: `id SERIAL`, `metric_key VARCHAR`, `month VARCHAR(7)`, `target_value NUMERIC`, `updated_at TIMESTAMP`, `updated_by VARCHAR`
- Unique constraint: `(metric_key, month)`
- Fallback: se não existir registro no banco, usa valor de `bp2026Targets.ts`

### 2. Backend (server/routes.ts)
- `GET /api/okr2026/bp-targets` — retorna metas do banco + fallback do TS (admin only)
- `PUT /api/okr2026/bp-targets` — upsert batch de `{ metric_key, month, target_value }[]` (admin only)
- Alterar `/api/okr2026/bp-financeiro` para priorizar `bp_targets` sobre o arquivo TS

### 3. Frontend (OKR2026.tsx - BPFinanceiroTab)
- Botão "Editar Metas" no header, visível para admins
- Dialog fullscreen com tabela editável (métricas x meses)
- Inputs numéricos inline
- Salvar → PUT → invalidate query → fecha modal
