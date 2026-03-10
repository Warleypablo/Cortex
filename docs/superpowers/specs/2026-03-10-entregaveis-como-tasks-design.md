# Entregaveis como Tasks - Design Spec

**Data:** 2026-03-10
**Status:** Aprovado

## Resumo

Ao ativar um contrato (status → "ativo"), o sistema usa IA para analisar o escopo de cada servico contratado e gerar automaticamente uma arvore hierarquica de entregaveis (tasks). As tasks sao armazenadas em `staging.entregaveis` com hierarquia recursiva (N niveis via parent_id).

## Tabela: staging.entregaveis

```sql
CREATE TABLE staging.entregaveis (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES staging.contratos(id) ON DELETE CASCADE,
  contrato_item_id INTEGER REFERENCES staging.contratos_itens(id),
  parent_id INTEGER REFERENCES staging.entregaveis(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  status VARCHAR(30) DEFAULT 'pendente',  -- pendente, em_andamento, concluido, atrasado
  responsavel VARCHAR(255),
  prazo DATE,
  data_conclusao DATE,
  prioridade VARCHAR(20) DEFAULT 'media', -- baixa, media, alta
  ordem INTEGER DEFAULT 0,
  nivel INTEGER DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

Index: `CREATE INDEX idx_entregaveis_contrato ON staging.entregaveis(contrato_id)`
Index: `CREATE INDEX idx_entregaveis_parent ON staging.entregaveis(parent_id)`

## Trigger

- **Mesmo trigger do card-cliente-automatico**: quando contrato status muda para "ativo"
- Adicionar chamada ao service de geracao de entregaveis no `provisionClienteFromContrato` ou no hook do PUT
- Fire-and-forget: nao bloqueia resposta

## Geracao via IA

### Fonte dos dados
- Para cada `contratos_itens` do contrato ativado
- Buscar `escopo` e `diretrizes` de `staging.planos_servicos` via `plano_servico_id`
- Se nao tem `plano_servico_id`, pular

### Prompt OpenAI
```
Dado o escopo e diretrizes abaixo de um servico contratado, gere uma lista JSON
hierarquica de entregaveis necessarios para cumprir o escopo.

Estrutura: cada item pode ter sub-items recursivamente.
Formato JSON:
[
  {
    "titulo": "Nome da fase/entrega",
    "descricao": "O que fazer",
    "prioridade": "alta|media|baixa",
    "subtasks": [
      { "titulo": "...", "descricao": "...", "prioridade": "...", "subtasks": [] }
    ]
  }
]

Escopo: {escopo}
Diretrizes: {diretrizes}
```

### Insercao
- Percorrer JSON recursivamente
- INSERT pai primeiro, usar RETURNING id para setar parent_id nos filhos
- Setar `nivel` baseado na profundidade
- Setar `ordem` baseado na posicao no array

### Client OpenAI
- Reutilizar o `getOpenAIClient()` ja existente em `server/routes/contratos.ts`
- Usar modelo `gpt-4o-mini` para custo baixo
- response_format: { type: "json_object" }

## API Endpoints

### GET /api/contratos/:contratoId/entregaveis
Retorna arvore completa usando CTE recursivo:
```sql
WITH RECURSIVE tree AS (
  SELECT *, 0 as depth FROM staging.entregaveis
  WHERE contrato_id = :id AND parent_id IS NULL
  UNION ALL
  SELECT e.*, t.depth + 1
  FROM staging.entregaveis e
  JOIN tree t ON e.parent_id = t.id
)
SELECT * FROM tree ORDER BY depth, ordem
```
Frontend monta a arvore a partir da lista flat.

### POST /api/contratos/:contratoId/entregaveis
Criar entregavel manual. Body: `{ titulo, descricao, parent_id?, prioridade?, prazo? }`

### PATCH /api/contratos/entregaveis/:id
Atualizar entregavel. Body parcial: `{ status?, titulo?, descricao?, responsavel?, prazo?, data_conclusao?, ordem? }`
Ao marcar `status = 'concluido'`, setar `data_conclusao = NOW()`.

### DELETE /api/contratos/entregaveis/:id
Deleta entregavel e todos os filhos (CASCADE).

### POST /api/contratos/:contratoId/gerar-entregaveis
Regenerar entregaveis via IA (manual). Deleta existentes e gera novos.

## Frontend

### Checklist na tela de contrato
- Lista aninhada com collapse/expand por nivel
- Checkbox para marcar concluido
- Barra de progresso (% folhas concluidas / total folhas)
- Botao "Gerar Entregaveis" para regenerar via IA
- Inline edit para titulo, responsavel, prazo

### Dashboard de progresso
- Cards por contrato: nome do cliente, % concluido, entregaveis atrasados
- Filtros: por status, por responsavel, por cliente
- Ordenacao: mais atrasados primeiro

### Alertas de atraso
- Badge/indicador em contratos com entregaveis atrasados
- Query: `WHERE prazo < NOW() AND status NOT IN ('concluido') AND prazo IS NOT NULL`
- Visivel no dashboard e na tela de detalhe do contrato

## Calculo de Progresso

```sql
-- % concluido = folhas concluidas / total folhas
SELECT
  contrato_id,
  COUNT(*) FILTER (WHERE status = 'concluido' AND id NOT IN (SELECT DISTINCT parent_id FROM staging.entregaveis WHERE parent_id IS NOT NULL)) as concluidas,
  COUNT(*) FILTER (WHERE id NOT IN (SELECT DISTINCT parent_id FROM staging.entregaveis WHERE parent_id IS NOT NULL)) as total
FROM staging.entregaveis
GROUP BY contrato_id
```

So conta folhas (nodes sem filhos) para evitar dupla contagem.

## Arquivos Impactados

### Backend
1. `server/routes/contratos.ts` - CREATE TABLE, CRUD endpoints
2. `server/services/entregaveisGenerator.ts` (novo) - Service de geracao IA
3. `server/services/clienteProvisioning.ts` - Adicionar chamada ao gerador

### Frontend
4. `client/src/components/EntregaveisChecklist.tsx` (novo) - Checklist aninhado
5. `client/src/pages/ContratosModule.tsx` - Integrar checklist na tela de detalhe
6. `client/src/components/EntregaveisDashboard.tsx` (novo) - Dashboard de progresso

## Decisoes

- **Hierarquia recursiva via parent_id** - N niveis, flexivel
- **IA para geracao** - OpenAI gpt-4o-mini, custo baixo, JSON mode
- **Mesmo trigger** do card-cliente-automatico (status → ativo)
- **Calculo de progresso por folhas** - evita dupla contagem em arvore
- **CASCADE delete** - deletar pai deleta filhos automaticamente
- **Regeneracao manual** - botao permite refazer via IA
