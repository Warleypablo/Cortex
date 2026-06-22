# Design: Ajustes no Módulo Patrimônio

## 1. Desatribuição automática ao dispensar colaborador

**Banco:** Sem alteração de schema.

**Backend:**
- Na rota que atualiza status do colaborador (`PATCH /api/colaboradores/:id`), ao detectar mudança para "Dispensado" ou "Inativo":
  - `UPDATE rh_patrimonio SET responsavel_atual = NULL, responsavel_id = NULL WHERE responsavel_id = :colaboradorId`
  - Criar registro no histórico: "Responsável removido automaticamente (colaborador dispensado)"
- **Script one-time:** limpar patrimônios atualmente atribuídos a colaboradores já inativos/dispensados
- **Dropdown:** filtrar para retornar apenas colaboradores com status "Ativo" (ou null)

## 2. Status "Em Conserto" com tracking de datas

**Banco:** Adicionar 3 colunas em `rh_patrimonio`:
- `status_patrimonio VARCHAR(50)` — valores: "Disponível", "Em Uso", "Em Conserto", "Aposentado"
- `data_inicio_conserto TIMESTAMP` — quando entrou em conserto
- `data_fim_conserto TIMESTAMP` — quando saiu do conserto

**Backend:**
- Ao mudar status para "Em Conserto" → setar `data_inicio_conserto = NOW()`
- Ao mudar de "Em Conserto" para outro status → setar `data_fim_conserto = NOW()`

**Frontend:**
- Badge de status no card/detalhe do patrimônio
- Log no histórico com as datas

## 3. Campo Notas

**Banco:** Adicionar coluna em `rh_patrimonio`:
- `notas TEXT` — campo livre para observações

**Frontend:**
- Textarea na página de detalhe do patrimônio
- Salvamento inline
