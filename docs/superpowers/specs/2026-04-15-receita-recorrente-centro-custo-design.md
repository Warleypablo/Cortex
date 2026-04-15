# Design Spec — Página Receita Recorrente por Centro de Custo

**Data:** 2026-04-15
**Autor:** Warley + Claude
**Status:** Aprovado para implementação
**Branch:** `feature/receita-recorrente-mrr`

---

## Contexto e motivação

Cortex hoje tem páginas de MRR baseadas em dados do ClickUp (`cup_contratos.valorr`), mas não tem visibilidade do MRR **realizado** — o que efetivamente entrou pelo Conta Azul, classificado como recorrente vs pontual. Esse gap aparece toda vez que o financeiro precisa fechar o mês e confirmar quanto de receita recorrente de fato passou.

A classificação recorrente/pontual no Conta Azul vem do campo `centro_custo_nome` em `caz_parcelas`. Investigação confirmou:

- Cobertura média nos últimos 6 meses: **97–99% por valor** (TURBO) e **90–95% por valor** (PD).
- O centro de custo é multi-valor separado por `;` (array paralelo a `valor_centro_custo`).
- 9 casos (1,3%) têm bug de rateio do CA quando todos os itens caem no mesmo tipo — solução: usar `valor_bruto` direto nesse caso.
- Gap contra MRR contratado do ClickUp (abril/26): **2,3%**, excelente sanity check.

A página substitui planilhas e queries ad-hoc que hoje o financeiro/BP faz manualmente, e expõe pela primeira vez a comparação "contratado vs realizado" num único lugar.

---

## Escopo

**IN:**
- Página dedicada em `/financeiro/receita-recorrente`.
- Visão consolidada (TURBO + PD) com breakdown por empresa.
- Gráfico histórico mensal + linha de MRR contratado.
- Tabela detalhada mês × empresa com drill-down por cliente.
- Cards de KPI (7 métricas).
- Projeção simples de meses futuros via parcelas já agendadas.
- Filtros de período (6m/12m/YTD/custom) e empresa.

**OUT (não faz parte desta entrega):**
- Forecast estatístico (já existe em `MrrForecastTab`).
- Mutação/edição de dados.
- Export CSV.
- Histórico real de MRR contratado (usa snapshot atual; V2 pode usar `cup_data_hist`).
- Correção na fonte das parcelas legadas de 2025 sem CC preenchido.

---

## Decisões arquiteturais

### 1. Público e caso de uso

Suporta dois casos de uso combinados:
- **Contábil-financeiro** (fechamento mensal) — foco em valores por empresa e gap contra contratado.
- **Health de receita** (visão executiva) — foco em composição, mix recorrente/pontual, trajetória temporal.

### 2. Tratamento das duas empresas

Empresa como **dimensão de breakdown** no gráfico (barras empilhadas por empresa) e como **linha da tabela** (uma linha por mês × empresa). Totais consolidados nos cards. Seletor de empresa no header permite filtrar.

### 3. Drill-down por cliente

Modal abre ao clicar numa célula de R$ da tabela (padrão Dialog shadcn, já usado em `EvolucaoMensal`). Busca client-side dentro do modal.

### 4. Janela temporal

Default: **últimos 6 meses** (cobertura >90%). Seletor permite 12m, YTD, ou customizado. Meses com cobertura <90% ganham badge visual.

### 5. Previsto vs realizado

Gráfico principal mostra **previsto e realizado simultaneamente**. Implementação: uma barra empilhada por tipo (realizado) + marcador horizontal do total previsto. Alternativa fallback: duas barras adjacentes.

### 6. Campo de valor

`valor_bruto` em tudo, por consistência com MRR contratado do ClickUp. `valor_pago` não é usado como campo separado; o "realizado" é contado como a soma de `valor_bruto` de parcelas com `status IN ('PAGO','QUITADO')`.

### 7. Projeção futura

Parcelas com `data_competencia > mês corrente` que já estão lançadas no Conta Azul aparecem no gráfico/tabela com destaque visual (`opacity`/hachurado + ícone de relógio). Não entram nos cards de MRR atual.

### 8. Localização no menu

`/financeiro/receita-recorrente`, agrupada com outros itens de Financeiro.

---

## Arquitetura

### Estrutura de arquivos

**Novos:**

```
client/src/pages/financeiro/
  ReceitaRecorrente.tsx                   # página principal (~350 linhas)
  receita-recorrente/
    KpiCards.tsx                          # 7 cards em grid 4+3
    ChartReceitaMensal.tsx                # ComposedChart: barras empilhadas + linha contratado
    TabelaReceitaMensal.tsx               # tabela com células clicáveis
    DrilldownClientesModal.tsx            # modal de parcelas por cliente
    types.ts                              # tipos locais (se precisar)

server/routes/
  receitaRecorrente.ts                    # router com 2 endpoints

shared/
  receitaRecorrenteTypes.ts               # tipos espelhados backend/frontend
```

**Modificados:**

- `client/src/App.tsx` — registrar rota `/financeiro/receita-recorrente`.
- `client/src/components/layout/Sidebar.tsx` (ou equivalente) — adicionar item no grupo Financeiro.
- `server/routes.ts` — montar router: `app.use("/api/financeiro/receita-recorrente", receitaRecorrenteRouter)`.

### Princípios

- Página principal abaixo de 500 linhas (extrai subcomponentes).
- SQL fica em `server/routes/receitaRecorrente.ts` (não em storage genérico).
- Tipos compartilhados em `shared/` para não duplicar definição de payload.
- Sem mutações — página read-only.
- Sem cache servidor v1. React Query no frontend com `staleTime: 5 min`.

---

## Backend — endpoints

### `GET /api/financeiro/receita-recorrente/resumo`

**Query params:**
- `data_ini` (ISO date, default: início do mês de 5 meses atrás)
- `data_fim` (ISO date, default: fim do mês de 2 meses à frente)
- `empresa` (opcional: `TURBO PARTNERS` | `PEIXOTO DEBBANE` | vazio = ambas)

**Resposta:**

```ts
{
  meses: MesReceita[],
  cards: CardsReceita,
  range: { data_ini: string, data_fim: string },
  empresa_filtro: Empresa | null
}
```

### `GET /api/financeiro/receita-recorrente/drilldown`

**Query params:**
- `mes` (ISO date, obrigatório — ex: `2026-03-01`)
- `tipo` (`RECORRENTE` | `PONTUAL` | `NAO_CLASSIFICADO`, obrigatório)
- `empresa` (opcional)

**Resposta:**

```ts
DrilldownParcela[]
```

Ordenado por `valor_bruto DESC`. Sem paginação v1.

### Autenticação

Ambos endpoints ficam atrás do `isAuthenticated` já aplicado globalmente a `/api/*` em `server/routes.ts`.

---

## Query SQL principal

Construída em 3 CTEs que tratam o campo multi-valor `centro_custo_nome` / `valor_centro_custo`:

```sql
WITH classified AS (
  SELECT
    p.id,
    p.empresa,
    DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento))::date AS mes,
    p.valor_bruto,
    p.status,
    p.centro_custo_nome,
    p.valor_centro_custo,
    CASE
      WHEN p.centro_custo_nome ILIKE '%recorrente%' 
       AND p.centro_custo_nome ILIKE '%pontual%'    THEN 'MISTO'
      WHEN p.centro_custo_nome ILIKE '%recorrente%' THEN 'RECORRENTE'
      WHEN p.centro_custo_nome ILIKE '%pontual%'    THEN 'PONTUAL'
      ELSE 'NAO_CLASSIFICADO'
    END AS classe
  FROM "Conta Azul".caz_parcelas p
  WHERE p.tipo_evento = 'RECEITA'
    AND COALESCE(p.data_competencia, p.data_vencimento) >= $1
    AND COALESCE(p.data_competencia, p.data_vencimento) <  $2
    AND COALESCE(p.status, '') <> 'CANCELADO'
    AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%'
    AND ($3::text IS NULL OR p.empresa = $3)
),
simples AS (
  -- Caso 1 (CC único) e caso 2 (múltiplos CCs do mesmo tipo):
  -- usa valor_bruto direto, sem split
  SELECT 
    empresa, mes, classe AS tipo,
    SUM(valor_bruto) AS previsto,
    SUM(valor_bruto) FILTER (WHERE status IN ('PAGO','QUITADO')) AS realizado
  FROM classified
  WHERE classe <> 'MISTO'
  GROUP BY 1, 2, 3
),
mistos AS (
  -- Caso 3 (CC misto Recorrente + Pontual):
  -- split posicional via unnest do array paralelo
  SELECT 
    c.empresa, c.mes,
    CASE
      WHEN nome_i ILIKE '%recorrente%' THEN 'RECORRENTE'
      WHEN nome_i ILIKE '%pontual%'    THEN 'PONTUAL'
      ELSE 'NAO_CLASSIFICADO'
    END AS tipo,
    SUM(COALESCE(NULLIF(valor_i, '')::numeric, 0)) AS previsto,
    SUM(
      CASE WHEN c.status IN ('PAGO','QUITADO') 
           THEN COALESCE(NULLIF(valor_i, '')::numeric, 0) 
           ELSE 0 END
    ) AS realizado
  FROM classified c,
       unnest(
         string_to_array(c.centro_custo_nome, ';'),
         string_to_array(c.valor_centro_custo, ';')
       ) WITH ORDINALITY AS t(nome_i, valor_i, pos)
  WHERE c.classe = 'MISTO'
  GROUP BY 1, 2, 3
)
SELECT empresa, mes, tipo, 
       SUM(previsto) AS previsto,
       SUM(realizado) AS realizado
FROM (SELECT * FROM simples UNION ALL SELECT * FROM mistos) u
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
```

Validação feita na conversa: diff R$ 0,00 contra soma bruta de `caz_parcelas` em todos os meses do range validado.

### Métricas derivadas

**Cobertura CC %** (por mês × empresa):
```sql
SUM(valor_bruto) FILTER (WHERE centro_custo_nome IS NOT NULL AND centro_custo_nome <> '')
  / NULLIF(SUM(valor_bruto), 0)
```

**MRR contratado** (snapshot único, mesmo valor para todos os meses v1):
```sql
SELECT SUM(valorr) 
FROM "Clickup".cup_contratos 
WHERE status IN ('ativo','entregue','em cancelamento','pausado') AND valorr > 0
```

**Ticket médio recorrente do mês corrente:**
```sql
recorrente_realizado / COUNT(DISTINCT id_cliente) FILTER (
  WHERE classe = 'RECORRENTE' AND mes = <mês corrente>
)
```

**Novos/churned recorrente (mês atual vs mês anterior):**
- Set de `id_cliente` com parcela recorrente no mês N.
- Set de `id_cliente` com parcela recorrente no mês N-1.
- `novos = |N \ N-1|`, `churned = |N-1 \ N|`.

---

## Frontend — componentes

### Layout geral

```
┌─────────────────────────────────────────────────────────────┐
│ Header: título + breadcrumb + Select range + Select empresa│
├─────────────────────────────────────────────────────────────┤
│ KpiCards — grid 4 + 3                                       │
├─────────────────────────────────────────────────────────────┤
│ ChartReceitaMensal — altura 400px                           │
├─────────────────────────────────────────────────────────────┤
│ TabelaReceitaMensal — 1 linha por mês × empresa             │
└─────────────────────────────────────────────────────────────┘
```

### KpiCards — 7 métricas

Usa `HeroMetric` de `client/src/components/HeroMetric.tsx`.

1. **MRR Recorrente (mês corrente)** — valor + delta % vs mês anterior.
2. **Receita Pontual (mês corrente)** — valor + delta %.
3. **Mix Recorrente %** — % da receita total que é recorrente.
4. **Realizado %** — % do previsto pago no mês corrente.
5. **Gap vs Contratado** — diferença absoluta e % entre recorrente realizado e `cup_contratos.valorr`.
6. **Ticket Médio Recorrente** — total recorrente / clientes únicos do mês.
7. **Novos + Churned** — delta de clientes recorrentes mês vs mês anterior.

Cores:
- Recorrente: `emerald-500`
- Pontual: `amber-500`
- Mix/Realizado: `blue-500`
- Gap: verde <3%, amarelo 3–10%, vermelho >10%

### ChartReceitaMensal

`<ComposedChart>` do Recharts. Estrutura:

```tsx
<ComposedChart data={chartData}>
  <Bar dataKey="recorrente_realizado" stackId="real" fill="#10b981" />
  <Bar dataKey="pontual_realizado"    stackId="real" fill="#f59e0b" />
  <Bar dataKey="nao_classif_realizado" stackId="real" fill="#64748b" />
  <ReferenceLine dataKey="total_previsto" ... />
  <Line dataKey="mrr_contratado" stroke="#3b82f6" strokeWidth={2} />
</ComposedChart>
```

Meses futuros (`is_futuro: true`) ficam com `fillOpacity: 0.4` + hachura via `pattern` SVG. Tooltip customizado mostra todos os campos.

Implementação primária: **barra empilhada de realizado + marcador horizontal de previsto**. Fallback se o marcador ficar ruim: duas barras adjacentes (previsto transparente + realizado sólido).

### TabelaReceitaMensal

Colunas: `Mês | Empresa | Recorrente | Pontual | Não Classif | Previsto | Realizado | % Real | Cobertura CC | Contratado | Gap`

- Células de R$ clicáveis (`<button>` com handler) — células de R$ 0 ficam `disabled`.
- Linha de total no rodapé (geral, todas as empresas do range).
- Badge amarelo em `Cobertura CC` se <90%, vermelho se <70%.
- Meses futuros: `opacity-60` + ícone de relógio.

Usa componente `<Table>` shadcn (verificar se `EvolucaoMensal` usa; senão, usar `<table>` com Tailwind).

### DrilldownClientesModal

`<Dialog>` shadcn. Props: `{ open, mes, tipo, empresa, onClose }`. Dispara `useQuery` condicional (`enabled: open`).

Conteúdo:
- Título: "Parcelas de {mes} — {tipo} — {empresa}".
- Subtítulo: "R$ {total} em {count} parcelas".
- Input de busca (filtro client-side por nome de cliente).
- Tabela: Cliente | Descrição | Categoria | Valor | Status | Vencimento.

Ordenação: `valor_bruto DESC`.

### Dark/light mode

Todas as cores passam pelo padrão `dark:` do Tailwind. Cores do Recharts usam hex de paletas seguras em ambos os modos (emerald/amber/slate/blue).

---

## Tipos compartilhados

Em `shared/receitaRecorrenteTypes.ts`:

```ts
export type Empresa = "TURBO PARTNERS" | "PEIXOTO DEBBANE";
export type TipoReceita = "RECORRENTE" | "PONTUAL" | "NAO_CLASSIFICADO";

export interface MesReceita {
  mes: string;
  empresa: Empresa;
  recorrente_previsto: number;
  recorrente_realizado: number;
  pontual_previsto: number;
  pontual_realizado: number;
  nao_classif_previsto: number;
  nao_classif_realizado: number;
  total_previsto: number;
  total_realizado: number;
  cobertura_cc_pct: number;
  mrr_contratado: number;
  is_futuro: boolean;
}

export interface CardsReceita {
  mrr_recorrente_atual: number;
  mrr_recorrente_delta_pct: number;
  pontual_atual: number;
  pontual_delta_pct: number;
  mix_recorrente_pct: number;
  realizado_pct: number;
  gap_contratado: { valor: number; pct: number };
  ticket_medio_recorrente: number;
  novos_recorrente: number;
  churned_recorrente: number;
}

export interface ResumoReceitaResponse {
  meses: MesReceita[];
  cards: CardsReceita;
  range: { data_ini: string; data_fim: string };
  empresa_filtro: Empresa | null;
}

export interface DrilldownParcela {
  id_parcela: string;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  descricao: string;
  categoria_nome: string;
  valor_bruto: number;
  status: string;
  data_competencia: string;
  data_vencimento: string;
  venda_id: string | null;
  empresa: Empresa;
}

export type DrilldownResponse = DrilldownParcela[];
```

---

## Data flow

1. Usuário abre `/financeiro/receita-recorrente`.
2. `ReceitaRecorrente.tsx` monta com defaults: range = 6m, empresa = ambas, modal fechado.
3. `useQuery(resumo)` dispara `GET /resumo?data_ini=...&data_fim=...&empresa=...`.
4. Backend executa CTE principal + métricas derivadas → retorna `{ meses, cards }`.
5. `KpiCards` recebe `cards`, `ChartReceitaMensal` e `TabelaReceitaMensal` recebem `meses`.
6. Usuário clica numa célula da tabela → `setModal({ open: true, mes, tipo, empresa })`.
7. `useQuery(drilldown)` dispara `GET /drilldown?mes=...&tipo=...&empresa=...` (condicional).
8. `DrilldownClientesModal` renderiza lista ordenada por valor.

Trocar qualquer filtro do header invalida a queryKey e refetcha.

---

## Error handling e edge cases

### Loading

- Primeira carga: `<Skeleton>` shadcn em cada bloco (cards, chart, tabela).
- Refetch: `opacity-60` no conteúdo + spinner canto superior direito.
- Modal: skeleton de 5 linhas enquanto carrega.

### Error

- Endpoint resumo falha: card vermelho com "[Tentar novamente]" chamando `refetch()`.
- Endpoint drilldown falha: mensagem inline no modal (modal permanece aberto).
- Auth 401: já tratado globalmente.

### Empty

- Range sem dados: cards em R$ 0, chart vazio com mensagem, tabela com "Nenhum registro".
- Célula de R$ 0 não é clicável (botão `disabled`).

### Edge cases específicos

1. **Mês corrente parcial** — tratado como os passados. Label "parcial" opcional na tabela.
2. **Meses futuros com parcelas agendadas** — `fillOpacity` reduzido no chart, `opacity-60` + ícone relógio na tabela. Não entram nos cards de MRR atual.
3. **Venda com CC misto** — 3-case split na query (caso 3).
4. **Categorias `04.*`** — filtradas (aportes, rendimentos, transferências, estornos).
5. **Cobertura baixa** — badge amarelo (<90%) ou vermelho (<70%) na célula.
6. **Cliente sem `nome` na parcela** — JOIN com `caz_clientes` via `id_cliente` para buscar `caz_clientes.nome`.
7. **`valor_centro_custo` vazio/malformado** — `NULLIF(x, '')::numeric + COALESCE` para não quebrar.
8. **MRR contratado zerado** — card "Gap" mostra "—" em vez de % inválido.
9. **`data_competencia NULL`** — usa `data_vencimento` como fallback.

---

## Testing

### Backend — vitest (ou node:test)

Testa a lógica de 3 casos do split de CC — único ponto com bug-risco alto. Casos:

1. CC único `"Recorrente"` → 100% em RECORRENTE.
2. CC único `"Pontual"` → 100% em PONTUAL.
3. CC único `"Turbo Commerce"` → 100% em NAO_CLASSIFICADO.
4. CC múltiplo do mesmo tipo (`"Recorrente;Recorrente"`, valor_centro_custo inflado) → **usa valor_bruto**.
5. CC misto `"Pontual;Recorrente"` com split → soma bate.
6. CC misto com zeros → split correto.
7. Status `CANCELADO` → excluído.
8. Categoria `04.*` → excluído.
9. `data_competencia NULL` → fallback `data_vencimento`.
10. Fora do range → não aparece.
11. Filtro de empresa → funciona.

Fixtures em DB local (`cortex_dev`) ou mock de resultado de query.

### Frontend

Sem testes de componente v1. Um único teste unitário **se** houver lógica não-trivial de transformação (ex: `chartData` transformer).

### Manual (checklist pré-PR)

- [ ] `/financeiro/receita-recorrente` abre sem erros no console.
- [ ] 7 cards com valores coerentes.
- [ ] Chart renderiza 7 meses default, cores corretas.
- [ ] Meses futuros com destaque visual.
- [ ] Trocar range para 12m refetcha.
- [ ] Trocar empresa para TURBO some PD.
- [ ] Click em célula abre modal com clientes.
- [ ] Busca dentro do modal filtra.
- [ ] Fechar + abrir outro modal mostra dados certos (não cache stale).
- [ ] Dark mode OK.
- [ ] Light mode OK.
- [ ] Badge amarelo de cobertura em meses <90%.
- [ ] Tooltip do chart mostra todos os campos.
- [ ] Estado de erro (backend offline): botão "tentar novamente" funciona.

### Sanity check numérico

Rodar endpoint com range `2025-10-01` até `2026-05-01` e conferir:

```
Mar/26: Recorrente total R$ 997.398 (TURBO 901.112 + PD 96.286)
Abr/26: Recorrente total R$ 1.084.218 (TURBO 997.123 + PD 87.095)
```

Se divergir em mais de R$ 1, investigar antes de merge.

---

## Decisões explícitas e tradeoffs

| Decisão | Alternativa | Por que esta |
|---|---|---|
| Endpoint monolítico de resumo | 4 endpoints granulares | Dados internamente coesos, evita 4 requests paralelos |
| `valor_bruto` em tudo | `valor_liquido` | Bate com MRR contratado do ClickUp |
| MRR contratado snapshot atual | Histórico via `cup_data_hist` | V1 simples, gap de 2,3% é aceitável |
| 3-case split inline | Função stored procedure | Manter SQL visível no código |
| Drill-down on-demand | Baixar tudo upfront | ~5.500 parcelas/mês é muito pra load inicial |
| Seletor de range 6m default | 12m default | Cobertura <90% em meses 2025 pode confundir |

---

## Riscos conhecidos

1. **MRR contratado snapshot** — se algum contrato sair ou entrar amanhã, o gap muda retroativamente. V2: usar snapshot histórico de `cup_data_hist` por data.
2. **Cliente sem `id_cliente` na parcela** — JOIN com `caz_clientes` não encontra. Fallback: mostrar campo `nome` da parcela ou `descricao`.
3. **Recharts ReferenceLine por barra** — pode não renderizar como quero. Fallback: duas barras adjacentes (previsto transparente + realizado sólido).
4. **Novos/churned recorrente** — se cliente pagou em março mas ainda não tem parcela de abril no sistema, vai aparecer como "churned" falso. Mitigação: contar só meses fechados.
5. **Performance** — ~30k parcelas no range máximo (24m). Query deve aguentar, mas se ficar >2s, considerar índice em `(empresa, tipo_evento, data_competencia)` (já existe parcialmente).

---

## Próximos passos

1. Spec aprovada.
2. Invocar `superpowers:writing-plans` para criar plano de implementação step-by-step.
3. Executar o plano em tasks separadas (backend primeiro, frontend depois, integração por último).
4. PR para staging com sanity check numérico.
