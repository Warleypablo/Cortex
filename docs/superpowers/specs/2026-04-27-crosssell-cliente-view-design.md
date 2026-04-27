# Design Spec — CrossSell Pipeline por Cliente

**Data:** 2026-04-27
**Status:** Aprovado
**Tipo:** Refatoração de apresentação (sem mudança de schema)
**Predecessores:**
- `docs/superpowers/specs/2026-04-17-crosssell-management-design.md` (sistema base)
- `docs/superpowers/specs/2026-04-18-crosssell-opportunity-scoring-design.md` (motor de scoring)

---

## 1. Problema

Hoje a página `CrossSellPipeline.tsx` exibe **um card por oportunidade** (par cliente + produto). Um mesmo cliente aparece em múltiplos cards quando tem mais de uma oportunidade — o sistema gera até 3 sugestões automáticas por cliente, e ainda pode haver oportunidades manuais. Isso fragmenta a visão do CX, que precisa entender o cliente como um todo antes de decidir como abordar.

## 2. Mudança proposta

A página passa a exibir **um card por cliente**. Dentro do card, ficam visíveis:

1. Os **serviços que o cliente já tem** (contratos ativos)
2. As **oportunidades mapeadas** para ele (até 3, com etapa/valor/ações próprias)

A unidade operacional continua sendo a oportunidade — etapa, comentários, ganho são por oportunidade individual. Muda apenas a apresentação: as oportunidades de um mesmo cliente passam a ser listadas dentro de um único card.

## 3. Decisões de design (registradas no brainstorming)

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Etapa por card | Cada oportunidade mantém sua etapa própria | Oportunidades evoluem em ritmos diferentes |
| Serviços ativos | Chips compactos (só nomes) | Encaixa 6+ produtos sem ocupar espaço |
| Oportunidades dentro do card | Lista vertical com mini-controles por linha | Operação rápida sem cliques extras |
| Header do card | Nome, CX, Cluster, Status, Lifetime, Valor R, Valor P | Conjunto mínimo para decisão de cross-sell |
| Limite de oportunidades por cliente | Manter 3 (limite atual do scoring) | Lista enxuta, foca nas melhores apostas |
| Filtros | Reduzir de 6 para 4 (Cluster, CX, Etapa, Produto) | Card-cliente já carrega contexto que tornava filtros redundantes |
| Comportamento dos filtros | Filtra cards (clientes); dentro do card aparecem todas as oportunidades | Filtros nunca escondem informação do cliente já visível |
| Ordenação | Dropdown com 4 opções; default = maior potencial | Score máximo das oportunidades do cliente |
| Cliente totalmente fechado | Some da página | Consistente com pipeline ativo atual |
| Dashboard | Manter KPIs por oportunidade + adicionar 2 KPIs de cobertura | Funil é por oportunidade; cobertura é por cliente |

## 4. Modelo de dados

**Não há mudança de schema.** As tabelas envolvidas continuam exatamente como estão:

- `cortex_core.crosssell_oportunidades` — uma linha por (cliente + produto)
- `cortex_core.crosssell_comentarios` — referencia `oportunidade_id`
- `cortex_core.crosssell_etapa_log` — referencia `oportunidade_id`
- `cortex_core.crosssell_negocios_ganhos` — referencia `oportunidade_id`
- `"Clickup".cup_clientes` — fonte de cliente
- `"Clickup".cup_contratos` — fonte de serviços ativos

## 5. Estrutura visual do card

```
┌──────────────────────────────────────────────────────────────┐
│ NOME DO CLIENTE                                              │
│ 👤 CX João  ·  🏷️ Imperdíveis  ·  ✅ Ativo  ·  ⏱ 2a 3m       │
│ 💰 R$ 18.500/mês  ·  💵 R$ 42.000 pontual                    │
├──────────────────────────────────────────────────────────────┤
│ Serviços ativos:                                             │
│ [Performance] [Social Media] [BI] [CRM] [Inbound]            │
├──────────────────────────────────────────────────────────────┤
│ Oportunidades mapeadas:                                      │
│                                                              │
│ 🟢 SEO         [Fazer Contato ▾]  R$ 4k  💬2  🏆            │
│ 🟡 Outbound    [Proposta ▾]       R$ 6k  💬0  🏆            │
│ 🟣 Automação   [Sugerido]         —      ✓ aceitar  ✗ descartar │
│      └ "62% dos clientes com BI também contratam Automação" │
└──────────────────────────────────────────────────────────────┘
```

### 5.1 Header (3 linhas)

| Linha | Conteúdo | Origem |
|-------|----------|--------|
| 1 | Nome do cliente | `cup_clientes.nome` |
| 2 | CX · Cluster · Status · Lifetime | `cup_clientes.responsavel`, `.cluster`, `.status`; lifetime = meses desde menor `cup_contratos.data_inicio` ativo |
| 3 | Valor R atual · Valor P atual | `SUM(cup_contratos.valorr)` e `SUM(cup_contratos.valorp)` onde status ativo |

### 5.2 Bloco "Serviços ativos"

Chips com nomes dos produtos dos contratos ativos do cliente (sem valores). Lista distinta de `cup_contratos.produto` onde status IN ('ativo', 'Ativo', 'ATIVO').

### 5.3 Bloco "Oportunidades mapeadas"

Lista vertical com **todas** as oportunidades ativas do cliente. Na prática a lista quase sempre cabe em até 3 linhas porque o motor de scoring limita a 3 sugestões automáticas por cliente; oportunidades manuais são incomuns e somam à lista sem truncate.

**Cada linha contém:**
- Bolinha colorida (verde/amarelo/cinza por prioridade quando origem = sistema, ou neutra quando manual)
- Nome do produto
- Dropdown de etapa (clicável, troca etapa direto via PATCH existente)
- Valor R em negociação (formatação compacta: "R$ 4k", sem decimais)
- Botão comentários (com contador se >0) — abre o `CommentsSheet` existente
- Botão "Ganho" 🏆 — abre o `GanhoDialog` existente
- Para linhas em `sugerido_sistema`:
  - 2 ações rápidas: ✓ Aceitar (move para `fazer_contato`) e ✗ Descartar (move para `descartado`)
  - Frase de motivo aparece logo abaixo da linha em texto pequeno e cinza

## 6. Backend

### 6.1 Endpoint refatorado: `GET /api/comercial/crosssell`

**Antes:** retorna lista plana de oportunidades.

**Depois:** retorna lista de clientes com oportunidades aninhadas.

```typescript
type ClienteCrossSell = {
  cnpj: string;
  clienteId: string;
  nome: string;
  cluster: string | null;
  status: string | null;
  cxConta: string | null;
  valorRAtual: number;
  valorPAtual: number;
  contratoInicio: string | null;          // para cálculo de lifetime no front
  servicosAtivos: string[];               // produtos distintos dos contratos ativos
  scoreMaximo: number;                    // maior score_detalhes->>'total' entre oportunidades
  oportunidades: Array<{
    id: number;
    produto: string;
    etapa: string;
    valorRNegociacao: number | null;
    valorPNegociacao: number | null;
    cxResponsavel: string;
    ultimoContato: string | null;
    origem: 'manual' | 'sistema';
    prioridade: 'alta' | 'media' | 'baixa' | null;
    motivo: string | null;
    totalComentarios: number;
    atualizadoEm: string;
  }>;
};
```

**Critério de aparição:** cliente só aparece se tiver ≥1 oportunidade com etapa ≠ `ganho` E ≠ `descartado` (após aplicar filtros).

**Estrutura da query (esboço):**

```sql
WITH oportunidades_filtradas AS (
  SELECT o.*, c.nome AS cliente_nome, c.cluster, c.status AS cliente_status,
         c.responsavel AS cx_conta,
         (SELECT COUNT(*)::int FROM cortex_core.crosssell_comentarios cm
          WHERE cm.oportunidade_id = o.id) AS total_comentarios
  FROM cortex_core.crosssell_oportunidades o
  LEFT JOIN "Clickup".cup_clientes c ON c.cnpj = o.cnpj
  WHERE o.etapa NOT IN ('ganho', 'descartado')
    -- WHERE adicionais conforme filtros (cluster, cx, etapa, produto)
),
contratos_cliente AS (
  SELECT cl.cnpj,
         SUM(ct.valorr)::float AS valor_r_atual,
         SUM(ct.valorp)::float AS valor_p_atual,
         MIN(ct.data_inicio) AS contrato_inicio,
         array_agg(DISTINCT ct.produto) FILTER (WHERE ct.produto IS NOT NULL) AS servicos_ativos
  FROM "Clickup".cup_contratos ct
  JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
  WHERE ct.status IN ('ativo', 'Ativo', 'ATIVO')
  GROUP BY cl.cnpj
)
SELECT
  of.cnpj,
  of.cliente_id,
  of.cliente_nome,
  of.cluster,
  of.cliente_status,
  of.cx_conta,
  COALESCE(cc.valor_r_atual, 0) AS valor_r_atual,
  COALESCE(cc.valor_p_atual, 0) AS valor_p_atual,
  cc.contrato_inicio,
  COALESCE(cc.servicos_ativos, ARRAY[]::text[]) AS servicos_ativos,
  COALESCE(MAX((of.score_detalhes->>'total')::float), 0) AS score_maximo,
  json_agg(json_build_object(
    'id', of.id,
    'produto', of.produto_mapeado,
    'etapa', of.etapa,
    'valorRNegociacao', of.valor_r_negociacao,
    'valorPNegociacao', of.valor_p_negociacao,
    'cxResponsavel', of.cx_responsavel,
    'ultimoContato', of.ultimo_contato,
    'origem', of.origem,
    'prioridade', of.prioridade,
    'motivo', of.motivo,
    'totalComentarios', of.total_comentarios,
    'atualizadoEm', of.atualizado_em
  ) ORDER BY of.atualizado_em DESC) AS oportunidades
FROM oportunidades_filtradas of
LEFT JOIN contratos_cliente cc ON cc.cnpj = of.cnpj
GROUP BY of.cnpj, of.cliente_id, of.cliente_nome, of.cluster, of.cliente_status,
         of.cx_conta, cc.valor_r_atual, cc.valor_p_atual, cc.contrato_inicio, cc.servicos_ativos
ORDER BY score_maximo DESC NULLS LAST
```

A ordenação `ORDER BY` da query reflete o default (`scoreMaximo DESC`); demais ordenações são feitas no frontend (lista pequena, custo desprezível).

### 6.2 Endpoints sem mudança

Continuam exatamente como hoje:
- `POST /api/comercial/crosssell` — criar oportunidade
- `PATCH /api/comercial/crosssell/:id` — atualizar etapa/valores
- `POST /api/comercial/crosssell/mapear` — mapear automaticamente
- `GET /api/comercial/crosssell/:id/comentarios` / `POST` — comentários
- `POST /api/comercial/crosssell/:id/ganho` — registrar ganho
- `GET /api/comercial/crosssell/clientes` — autocomplete

### 6.3 Endpoint dashboard: 2 KPIs novos

`GET /api/comercial/crosssell/dashboard` adiciona ao bloco `kpis`:

```typescript
clientesEmNegociacao: number;        // COUNT DISTINCT cnpj de oportunidades em etapas ativas (≠ ganho, descartado, sugerido_sistema)
coberturaBase: number;               // (clientes com ≥1 oportunidade ativa / total clientes ativos da base) × 100
```

Queries adicionais:

```sql
-- clientes_em_negociacao
SELECT COUNT(DISTINCT cnpj)::int
FROM cortex_core.crosssell_oportunidades
WHERE etapa NOT IN ('ganho', 'descartado', 'sugerido_sistema')

-- cobertura_base (numerador)
SELECT COUNT(DISTINCT cnpj)::int
FROM cortex_core.crosssell_oportunidades
WHERE etapa NOT IN ('ganho', 'descartado')

-- cobertura_base (denominador)
SELECT COUNT(*)::int
FROM "Clickup".cup_clientes
WHERE status IN ('ativo', 'Ativo', 'ATIVO')
```

## 7. Frontend

### 7.1 Página `CrossSellPipeline.tsx`

**Refatoração da apresentação:**

- Remove o componente `OpCard` atual
- Cria componente `ClienteCard` que recebe um `ClienteCrossSell` e renderiza header + chips + lista de oportunidades
- Cria sub-componente `OportunidadeRow` (uma linha de oportunidade dentro do card)
- Reduz filtros de 6 para 4 (`Cluster`, `CX Responsável`, `Etapa`, `Produto`)
- Adiciona dropdown de ordenação com 4 opções:
  - `score_maximo` (default — maior potencial)
  - `valor_r_atual` (maior MRR)
  - `recente` (mais recentemente movimentado)
  - `nome` (alfabético)
- Resumo no rodapé da barra: "X clientes · Y oportunidades · R$ Z em negociação"

**Lógica de modais preservada:** `NewOpDialog`, `GanhoDialog`, `CommentsSheet` continuam exatamente como estão. Apenas a maneira de **abrir** muda — ao clicar no botão dentro de uma `OportunidadeRow`, passamos a oportunidade correspondente.

**Mutations preservadas:** `changeEtapa`, `mapear`, criação, ganho, comentários — todas operam por `oportunidade_id` e seguem inalteradas.

**Comportamento de filtro:** filtro de Etapa, Produto, CX é aplicado no servidor (na CTE `oportunidades_filtradas`). Cluster também (atributo de cliente).

### 7.2 Página `CrossSellDashboard.tsx`

Adicionar 2 cards de KPI na linha existente (passa de 5 para 7 cards). Demais gráficos e rankings inalterados.

## 8. Arquivos impactados

### Modificar

| Arquivo | Mudança |
|---------|---------|
| `server/routes/crosssell.ts` | Refatorar `GET /api/comercial/crosssell` (resposta agrupada por cliente). Adicionar 2 KPIs no `/dashboard`. |
| `client/src/pages/CrossSellPipeline.tsx` | Substituir `OpCard` por `ClienteCard` + `OportunidadeRow`. Filtros enxutos + dropdown de ordenação. Modais e mutations preservados. |
| `client/src/pages/CrossSellDashboard.tsx` | Adicionar 2 cards de KPI (Clientes em Negociação Ativa, Cobertura da Base). |

### Não tocar

- Schema do banco (migrations, schema Drizzle)
- `server/services/crosssell-scoring.ts` (motor de scoring)
- Outros endpoints da rota (criar, comentários, ganho, mapear, PATCH)
- `shared/nav-config.ts`, permissões, rotas no `App.tsx`

## 9. Stack técnica

Idêntica ao restante do projeto:

- **Frontend:** React + TypeScript + Tailwind CSS (com `dark:` variants obrigatórios)
- **Data fetching:** React Query (`useQuery`, `useMutation`)
- **UI:** componentes de `@/components/ui/` (Card, Dialog, Sheet, Select, Button, Input, Badge)
- **Formatação:** `formatCurrency` para valores monetários (compacto na lista de oportunidades, completo no header)
- **Backend:** Express + Drizzle ORM (raw SQL via `db.execute(sql.raw(...))` com sanitização de parâmetros)

## 10. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Query agregada (CTE + json_agg) com performance ruim em base grande | Usar índices existentes em `crosssell_oportunidades.cnpj` e `cup_clientes.cnpj`. Volume esperado é baixo (< 1.000 oportunidades ativas, < 500 clientes). Validar tempo em ambiente local com dados reais antes do PR. |
| Mudança no shape da resposta quebra integrações externas | O endpoint é interno (consumido apenas pela página `CrossSellPipeline.tsx`). Sem integrações externas. |
| Ordenação por `scoreMaximo` pode ser confusa quando todas oportunidades são manuais (sem score) | Usar `COALESCE(MAX(score), 0)` — clientes sem score ficam no fim da ordenação default. Documentar no tooltip do dropdown. |
| Cliente com muitas oportunidades manuais (> 3) faz card crescer demais | O motor de scoring já limita a 3 sugestões automáticas; manuais são incomuns e a lista vertical com 4–5 linhas ainda é gerenciável. Não criar truncate por enquanto; revisitar se aparecer cliente com >5 oportunidades simultâneas. |
