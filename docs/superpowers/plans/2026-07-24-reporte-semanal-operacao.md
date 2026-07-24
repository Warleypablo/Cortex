# Reporte Semanal de Operação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar `/reports/operacao` — uma tela gerencial que compara a última semana fechada com a anterior em MRR, churn (total/abonado/líquido, por motivo), pontual entregue, estoque pontual (total e por produto) e receita por cabeça da operação.

**Architecture:** Estende `server/reportsSemanal/` em vez de criar módulo paralelo — churn e carteira reusam as funções que já alimentam `/reports/semanal`, o que impede as duas telas de divergirem. Toda derivação (líquido, percentuais, Δ, pareamento de produtos e motivos) é pura e testada sem banco; o SQL fica isolado em `queriesOperacao.ts`.

**Tech Stack:** TypeScript, Express, Drizzle (`sql` template), React + wouter + React Query, Tailwind, shadcn/ui, Vitest.

## Global Constraints

- **Idioma da UI:** português do Brasil, com acentuação correta. Identificadores de código em português seguindo a convenção do módulo (`derivarSemana`, `carteiraNoFim`).
- **Dark/light obrigatório:** toda classe de cor precisa da variante `dark:`. Nunca hardcodar cor fora do Tailwind.
- **Sem `try/catch` silencioso nas queries.** Falha vira HTTP 500 com mensagem. Linha zerada plausível é pior que erro visível — decisão herdada de `server/reportsSemanal/queries.ts`.
- **Snapshots:** sempre `MAX(data_snapshot) <= data`, nunca igualdade com o dia exato. `cup_data_hist` tem semanas com 6 de 7 snapshots.
- **Status `'cancelado/inativo'` é UM valor**, não dois. Usar igualdade/lista exata, nunca `ILIKE`.
- **Pool `max: 5`** (`server/db.ts`), compartilhado com o app inteiro. Semanas em série; no máximo 4 queries concorrentes por vez.
- **Query de drill é gêmea da query de série:** repete o mesmo filtro. Se um filtro muda, o par muda junto.
- **Commits:** Conventional Commits, com `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>` na última linha.
- **Baseline de tipos:** `npm run check` já tem erros pré-existentes no repositório. Verificar apenas os arquivos desta feature: `npm run check 2>&1 | grep -E "reportsOperacao|queriesOperacao|derivarOperacao|headcount-operacao|relatorio-operacao"` deve sair vazio.

## File Structure

**Criar:**
- `shared/headcount-operacao.ts` — quem conta como operação (setores + exclusão de Vendas + normalização de squad)
- `shared/headcount-operacao.test.ts`
- `shared/delta.ts` — cálculo de Δ (relativo × pontos percentuais)
- `shared/delta.test.ts`
- `server/reportsSemanal/queriesOperacao.ts` — SQL exclusivo desta tela + gêmeas de drill
- `server/reportsSemanal/derivarOperacao.ts` — derivação pura da semana e do comparativo
- `server/reportsSemanal/derivarOperacao.test.ts`
- `server/routes/reportsOperacao.ts` — os dois endpoints
- `client/src/pages/RelatorioOperacao.tsx` — página
- `client/src/pages/relatorio-operacao/types.ts` — espelho dos tipos do server
- `client/src/pages/relatorio-operacao/useRelatorioOperacao.ts` — hooks de fetch
- `client/src/pages/relatorio-operacao/CelulaDelta.tsx` — célula de Δ (cor por direção), usada pelas três tabelas
- `client/src/pages/relatorio-operacao/TabelaComparativa.tsx` — blocos MRR / Churn / Pontual / Produtividade
- `client/src/pages/relatorio-operacao/TabelaChurnMotivo.tsx`
- `client/src/pages/relatorio-operacao/TabelaEstoqueProduto.tsx`
- `client/src/pages/relatorio-operacao/DrawerDetalhe.tsx`

**Modificar:**
- `server/reportsSemanal/semanas.ts` — adicionar `parSemanas()`
- `server/reportsSemanal/semanas.test.ts` — testes de `parSemanas()`
- `server/reportsSemanal/queries.ts` — `ChurnValores` ganha `abonado`
- `server/routes.ts` — registrar a rota nova
- `client/src/App.tsx` — lazy import + `<Route>`
- `shared/nav-config.ts` — item de menu + `ROUTE_TO_PERMISSION`

---

### Task 1: Régua de headcount de operação

Define, em código testado, quem conta como "operação". A régua não pode virar string solta dentro de um SQL: o campo `squad` de `rh_pessoal` tem o mesmo time grafado de duas formas (`🪖 Selva` e `Selva`), além de sufixos `(OFF)`.

**Files:**
- Create: `shared/headcount-operacao.ts`
- Test: `shared/headcount-operacao.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `normalizarSquad(squad: string | null | undefined): string`, `ehOperacao(setor: string | null | undefined, squad: string | null | undefined): boolean`, `SETORES_OPERACAO: readonly string[]`

- [ ] **Step 1: Write the failing test**

```typescript
// shared/headcount-operacao.test.ts
import { describe, it, expect } from "vitest";
import { normalizarSquad, ehOperacao } from "./headcount-operacao";

describe("normalizarSquad", () => {
  it("remove emoji e variation selector, deixando o nome comparável", () => {
    expect(normalizarSquad("🪖 Selva")).toBe("selva");
    expect(normalizarSquad("Selva")).toBe("selva");
    expect(normalizarSquad("⚓️ Squadra")).toBe("squadra");
  });

  it("preserva & e ponto interno do nome", () => {
    expect(normalizarSquad("📊 CX&CS")).toBe("cx&cs");
    expect(normalizarSquad("Squad I.A")).toBe("squad ia");
  });

  it("nulo e vazio viram string vazia", () => {
    expect(normalizarSquad(null)).toBe("");
    expect(normalizarSquad(undefined)).toBe("");
    expect(normalizarSquad("   ")).toBe("");
  });
});

describe("ehOperacao", () => {
  it("aceita entrega em Commerce, com e sem emoji na squad", () => {
    expect(ehOperacao("Commerce", "🪖 Selva")).toBe(true);
    expect(ehOperacao("Commerce", "Selva")).toBe(true);
    expect(ehOperacao("Commerce", "Black Sheep")).toBe(true);
    expect(ehOperacao("Commerce", "📊 CX&CS")).toBe(true);
  });

  it("aceita Tech Sites", () => {
    expect(ehOperacao("Tech Sites", "🖥️ Tech")).toBe(true);
  });

  it("exclui Vendas mesmo dentro de Commerce, com e sem emoji", () => {
    expect(ehOperacao("Commerce", "💰 Vendas")).toBe(false);
    expect(ehOperacao("Commerce", "Vendas")).toBe(false);
  });

  it("exclui setores que não são de entrega", () => {
    expect(ehOperacao("Growth Interno", "🚀 Turbo Interno")).toBe(false);
    expect(ehOperacao("Backoffice", "Turbo Interno")).toBe(false);
    expect(ehOperacao("Sócios", "Turbo Interno")).toBe(false);
    expect(ehOperacao("Ventures", null)).toBe(false);
  });

  it("setor nulo ou desconhecido fica de fora", () => {
    expect(ehOperacao(null, "Selva")).toBe(false);
    expect(ehOperacao("", "Selva")).toBe(false);
    expect(ehOperacao("Comunicação", "Conteúdo")).toBe(false);
  });

  it("tolera espaço em volta do setor", () => {
    expect(ehOperacao("  Commerce  ", "Selva")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/headcount-operacao.test.ts`
Expected: FAIL — `Failed to resolve import "./headcount-operacao"`

- [ ] **Step 3: Write minimal implementation**

```typescript
// shared/headcount-operacao.ts
// Quem conta como "operação" no denominador das métricas por cabeça da tela
// /reports/operacao: quem entrega para o cliente.
//
// Por que isto é código e não um filtro no SQL: o campo `squad` de
// "Inhire".rh_pessoal grafa o mesmo time de duas formas ('🪖 Selva' e 'Selva')
// e ainda carrega sufixos '(OFF)'. Uma régua dessas precisa de teste, e teste
// de string em SQL é caro. A query traz as pessoas ativas na data (~110 linhas)
// e o filtro acontece aqui.

/** Setores cujo trabalho é entrega para o cliente. */
export const SETORES_OPERACAO = ["Commerce", "Tech Sites"] as const;

/**
 * Squads que ficam de fora mesmo dentro de um setor de operação. Comparação
 * por `includes` sobre o nome normalizado — pega 'Vendas' e '💰 Vendas'.
 */
const SQUADS_FORA_DA_OPERACAO = ["vendas"];

/**
 * Nome de squad comparável: sem emoji, sem variation selector, minúsculo.
 * Mantém letras, números, espaço e '&' (o time 'CX&CS' depende disso).
 */
export function normalizarSquad(squad: string | null | undefined): string {
  return (squad ?? "")
    .replace(/[^\p{L}\p{N} &]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** true quando a pessoa entra no headcount de operação. */
export function ehOperacao(
  setor: string | null | undefined,
  squad: string | null | undefined,
): boolean {
  const s = (setor ?? "").trim();
  if (!(SETORES_OPERACAO as readonly string[]).includes(s)) return false;
  const sq = normalizarSquad(squad);
  return !SQUADS_FORA_DA_OPERACAO.some((fora) => sq.includes(fora));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/headcount-operacao.test.ts`
Expected: PASS — 10 testes

- [ ] **Step 5: Commit**

```bash
git add shared/headcount-operacao.ts shared/headcount-operacao.test.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): régua testada de headcount de operação

O campo squad de rh_pessoal grafa o mesmo time com e sem emoji, então a
normalização precisa de teste — e teste de string em SQL é caro. A query
traz as ~110 pessoas ativas e o filtro acontece aqui.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Cálculo de Δ compartilhado

O Δ é conta, não apresentação — precisa de teste. Fica em `shared/` porque o front é quem renderiza.

**Files:**
- Create: `shared/delta.ts`
- Test: `shared/delta.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `calcularDelta(atual: number | null, anterior: number | null, percentual?: boolean): number | null`

- [ ] **Step 1: Write the failing test**

```typescript
// shared/delta.test.ts
import { describe, it, expect } from "vitest";
import { calcularDelta } from "./delta";

describe("calcularDelta", () => {
  it("moeda: variação relativa em %", () => {
    expect(calcularDelta(150, 100)).toBe(50);
    expect(calcularDelta(50, 100)).toBe(-50);
  });

  it("percentual: diferença em pontos percentuais, sem divisão", () => {
    // churn de 2% para 3% é '+1 p.p.', não '+50%' — que se lê como o churn
    // tendo subido pela metade.
    expect(calcularDelta(3, 2, true)).toBe(1);
    expect(calcularDelta(2, 3, true)).toBe(-1);
  });

  it("percentual com anterior zero continua definido", () => {
    expect(calcularDelta(3, 0, true)).toBe(3);
  });

  it("moeda com anterior zero é indefinido, não Infinity", () => {
    expect(calcularDelta(100, 0)).toBeNull();
  });

  it("anterior negativo usa módulo na base, preservando o sinal da variação", () => {
    // de -100 para -50 é melhora de 50%, não piora
    expect(calcularDelta(-50, -100)).toBe(50);
  });

  it("null em qualquer ponta é null", () => {
    expect(calcularDelta(null, 100)).toBeNull();
    expect(calcularDelta(100, null)).toBeNull();
    expect(calcularDelta(null, null)).toBeNull();
  });

  it("sem variação é zero, não null", () => {
    expect(calcularDelta(100, 100)).toBe(0);
    expect(calcularDelta(0, 0, true)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/delta.test.ts`
Expected: FAIL — `Failed to resolve import "./delta"`

- [ ] **Step 3: Write minimal implementation**

```typescript
// shared/delta.ts

/**
 * Variação entre duas semanas.
 *
 * Linhas de moeda usam variação RELATIVA (%). Linhas que já são percentuais
 * (`percentual = true`) usam diferença em PONTOS PERCENTUAIS: churn indo de 2%
 * para 3% é '+1,0 p.p.', não '+50%'. Como não há divisão, o caso
 * `anterior = 0` continua definido para elas — o guard de zero existe só para
 * as linhas de moeda.
 *
 * `null` em qualquer ponta (métrica indisponível, ex.: headcount zero)
 * propaga como `null`: a tela mostra '—' em vez de inventar uma variação.
 */
export function calcularDelta(
  atual: number | null,
  anterior: number | null,
  percentual = false,
): number | null {
  if (atual === null || anterior === null) return null;
  if (percentual) return atual - anterior;
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/delta.test.ts`
Expected: PASS — 7 testes

- [ ] **Step 5: Commit**

```bash
git add shared/delta.ts shared/delta.test.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): Δ compartilhado, relativo × pontos percentuais

Δ é conta, não apresentação — e a distinção entre variação relativa e p.p.
é justamente a que engana leitor quando implementada de cabeça.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Par de semanas (fechada + anterior)

**Files:**
- Modify: `server/reportsSemanal/semanas.ts`
- Test: `server/reportsSemanal/semanas.test.ts`

**Interfaces:**
- Consumes: `gerarSemanas(hoje: string, quantidade: number): Semana[]`, `Semana` (já existem)
- Produces: `parSemanas(hoje: string, ate?: string): { atual: Semana; anterior: Semana }`

- [ ] **Step 1: Write the failing test**

Anexar ao final de `server/reportsSemanal/semanas.test.ts` (manter os testes existentes intactos) e acrescentar `parSemanas` ao import do topo do arquivo:

```typescript
describe("parSemanas", () => {
  it("sem 'ate', devolve a última semana FECHADA e a anterior", () => {
    // 2026-07-24 é sexta. A semana corrente (20–26/07) está em curso e não entra.
    const { atual, anterior } = parSemanas("2026-07-24");
    expect(atual).toMatchObject({ inicio: "2026-07-13", fim: "2026-07-19" });
    expect(anterior).toMatchObject({ inicio: "2026-07-06", fim: "2026-07-12" });
  });

  it("no domingo, a semana que termina hoje ainda NÃO é a fechada", () => {
    // o dia ainda não acabou: a foto do snapshot de domingo pode não existir
    const { atual } = parSemanas("2026-07-19");
    expect(atual).toMatchObject({ inicio: "2026-07-06", fim: "2026-07-12" });
  });

  it("na segunda, a semana recém-encerrada já é a fechada", () => {
    const { atual } = parSemanas("2026-07-20");
    expect(atual).toMatchObject({ inicio: "2026-07-13", fim: "2026-07-19" });
  });

  it("'ate' é um 'hoje simulado': a semana que o contém é descartada como em curso", () => {
    // 2026-06-24 é quarta, dentro de 22–28/06. Essa semana sai (é a "corrente"
    // do ponto de vista da âncora) e o par é o das duas fechadas antes dela.
    // MESMA regra do teste CONTRATO DE ÂNCORA abaixo — há uma semântica só.
    const { atual, anterior } = parSemanas("2026-07-24", "2026-06-24");
    expect(atual).toMatchObject({ inicio: "2026-06-15", fim: "2026-06-21" });
    expect(anterior).toMatchObject({ inicio: "2026-06-08", fim: "2026-06-14" });
  });

  it("nenhuma das duas semanas do par vem marcada como parcial", () => {
    const { atual, anterior } = parSemanas("2026-07-24");
    expect(atual.parcial).toBe(false);
    expect(anterior.parcial).toBe(false);
  });

  it("'ate' na semana corrente cai para a última fechada, nunca devolve semana em curso", () => {
    const { atual } = parSemanas("2026-07-24", "2026-07-22");
    expect(atual).toMatchObject({ inicio: "2026-07-13", fim: "2026-07-19" });
  });

  it("'ate' futuro é ignorado: não dá para navegar para o futuro", () => {
    const { atual } = parSemanas("2026-07-24", "2026-12-01");
    expect(atual).toMatchObject({ inicio: "2026-07-13", fim: "2026-07-19" });
  });

  it("CONTRATO DE ÂNCORA: 'ate' em um dia da semana X devolve a semana ANTERIOR a X", () => {
    // É o que o botão 'Semana anterior' do front depende. Passar o domingo da
    // semana que se quer ver NÃO funciona: aquela semana vira a 'corrente' e é
    // descartada. Para ver 06–12/07, a âncora tem que cair em 13–19/07.
    const { atual } = parSemanas("2026-07-24", "2026-07-13");
    expect(atual).toMatchObject({ inicio: "2026-07-06", fim: "2026-07-12" });
  });

  it("a regra da âncora não depende de quão antiga a data é", () => {
    // Trava a semântica ÚNICA: 'a semana de ate sai' vale igual para uma data
    // da semana passada e para uma de dois meses atrás. Uma implementação com
    // regra condicional ('se for recente recua, se for antiga ancora ali')
    // passa nos outros casos e falha aqui.
    const recente = parSemanas("2026-07-24", "2026-07-13").atual;
    const antiga = parSemanas("2026-07-24", "2026-05-13").atual;
    expect(recente).toMatchObject({ inicio: "2026-07-06" }); // semana de ate menos uma
    expect(antiga).toMatchObject({ inicio: "2026-05-04" }); // idem: 11–17/05 sai, sobra 04–10/05
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/reportsSemanal/semanas.test.ts`
Expected: FAIL — `parSemanas is not a function` / erro de import

- [ ] **Step 3: Write minimal implementation**

Anexar ao final de `server/reportsSemanal/semanas.ts`:

```typescript
/**
 * O par que a tela /reports/operacao compara: a última semana FECHADA e a
 * imediatamente anterior, ambas com `parcial: false`.
 *
 * A semana em curso nunca entra — nem no domingo, porque o dia ainda não
 * terminou e o snapshot de fechamento pode não existir. Comparar meia semana
 * com uma inteira produz queda fantasma toda segunda.
 *
 * `ate` (opcional, 'YYYY-MM-DD') é um "hoje simulado", para navegar o
 * histórico: a semana que CONTÉM `ate` é descartada como em curso, exatamente
 * como acontece com `hoje`, e o par são as duas fechadas anteriores a ela.
 *
 * Uma semântica só, sem casos especiais — vale igual para uma data da semana
 * passada e para uma de dois meses atrás. É dela que depende o botão "semana
 * anterior" do front, que passa um dia da semana SEGUINTE à que quer exibir.
 * Data futura é ignorada: não se navega para frente do presente.
 */
export function parSemanas(hoje: string, ate?: string): { atual: Semana; anterior: Semana } {
  const ancora = ate && ate < hoje ? ate : hoje;
  // +2 semanas: gerarSemanas devolve a corrente na última posição, e ela sai.
  const semanas = gerarSemanas(ancora, 3);
  const fechadas = semanas.filter((s) => !s.parcial);
  const atual = fechadas[fechadas.length - 1];
  const anterior = fechadas[fechadas.length - 2];
  return { atual, anterior };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/reportsSemanal/semanas.test.ts`
Expected: PASS — os testes existentes mais os 6 novos

- [ ] **Step 5: Commit**

```bash
git add server/reportsSemanal/semanas.ts server/reportsSemanal/semanas.test.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): parSemanas devolve o par fechado a comparar

A semana em curso nunca entra, nem no domingo: o dia não acabou e o
snapshot de fechamento pode não existir.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Churn abonado nas queries de série

Mudança **aditiva** em `queries.ts`: `ChurnValores` ganha `abonado`. `/reports/semanal` não usa o campo novo e continua funcionando sem alteração.

**Files:**
- Modify: `server/reportsSemanal/queries.ts:34-37` (interface `ChurnValores`), `:128-158` (as duas funções de churn)

**Interfaces:**
- Consumes: `churnMrrNaSemana(db, inicio, fim)`, `churnPontualNaSemana(db, inicio, fim)`
- Produces: `ChurnValores = { total: number; ajustado: number; abonado: number }`

- [ ] **Step 1: Estender a interface**

Substituir a interface em `server/reportsSemanal/queries.ts`:

```typescript
export interface ChurnValores {
  total: number;
  ajustado: number;
  /**
   * Parcela relevada pela operação (`abonar_churn = 'Sim'`). NÃO é o mesmo
   * conjunto que `total - ajustado`: ajustado exclui três motivos operacionais,
   * abonado depende da marcação caso a caso. Nos 120 dias até 24/07/2026, dos
   * 78 casos de 'Erro na Venda' só 49 estavam abonados. A tela /reports/operacao
   * usa `abonado`; o BP 2026 e /reports/semanal usam `ajustado`.
   */
  abonado: number;
}
```

- [ ] **Step 2: Adicionar o campo nas duas queries**

Em `churnMrrNaSemana`, acrescentar ao SELECT (depois do campo `ajustado`):

```sql
      COALESCE(SUM(valor_r) FILTER (WHERE COALESCE(abonar_churn, '') = 'Sim'), 0) AS abonado
```

e ao retorno: `abonado: num(row?.abonado),`

Em `churnPontualNaSemana`, acrescentar ao SELECT:

```sql
      COALESCE(SUM(ct.valorp) FILTER (WHERE COALESCE(ch.abonar_churn, '') = 'Sim'), 0) AS abonado
```

e ao retorno: `abonado: num(row?.abonado),`

- [ ] **Step 3: Verificar que a tela existente não quebrou**

Run: `npx vitest run server/reportsSemanal/`
Expected: PASS — os testes de `derivar` e `semanas` seguem verdes (o campo é aditivo)

Run: `npm run check 2>&1 | grep -E "reportsSemanal|reportsOperacao"`
Expected: sem saída

- [ ] **Step 4: Validar o SQL contra produção**

```bash
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT
  COALESCE(SUM(valor_r), 0) AS total,
  COALESCE(SUM(valor_r) FILTER (WHERE COALESCE(abonar_churn,'') = 'Sim'), 0) AS abonado
FROM \"Clickup\".cup_churn
WHERE data_solicitacao_encerramento >= '2026-07-13' AND data_solicitacao_encerramento <= '2026-07-19';"
```

Expected: duas colunas numéricas, com `abonado <= total`. Anotar os valores — a Task 12 confere a tela contra eles.

- [ ] **Step 5: Commit**

```bash
git add server/reportsSemanal/queries.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): churn abonado nas queries de série

Campo aditivo: /reports/semanal ignora e segue igual. Abonado não é o
mesmo conjunto que total menos ajustado — o comentário na interface
registra a diferença medida em produção.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Queries de estoque pontual e churn por motivo

**Files:**
- Create: `server/reportsSemanal/queriesOperacao.ts`

**Interfaces:**
- Consumes: `db` (Drizzle), `sql` de `drizzle-orm`
- Produces:
  - `estoquePontualNoFim(db: any, fim: string): Promise<number>`
  - `estoquePontualPorProduto(db: any, fim: string): Promise<LinhaProduto[]>`
  - `churnPorMotivoNaSemana(db: any, inicio: string, fim: string): Promise<LinhaMotivo[]>`
  - `LinhaProduto = { produto: string; valor: number; qtd: number }`
  - `LinhaMotivo = { motivo: string; mrr: number; pontual: number }`

- [ ] **Step 1: Validar as duas premissas do SQL contra produção**

Antes de escrever a query, confirmar que `id_subtask` é único em `cup_contratos` — o `LEFT JOIN` do churn por motivo duplicaria valores se não fosse:

```bash
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT COUNT(*) AS id_subtask_duplicados FROM (
  SELECT id_subtask FROM \"Clickup\".cup_contratos GROUP BY 1 HAVING COUNT(*) > 1
) x;"
```

Expected: `0`. Se vier diferente de zero, PARE e reporte — a query de churn por motivo precisará de `DISTINCT ON` e o plano muda.

- [ ] **Step 2: Escrever o módulo**

```typescript
// server/reportsSemanal/queriesOperacao.ts
// Queries exclusivas da tela /reports/operacao. O que já existia para
// /reports/semanal (carteira, base de abertura, churn, entrega pontual) é
// importado de ./queries — não reimplementar aqui, sob pena de as duas telas
// divergirem em silêncio.
//
// Mesma decisão de ./queries.ts: nenhum try/catch. Falha derruba o endpoint
// com 500 em vez de devolver zero plausível numa tela cujo valor é número
// auditável.
import { sql } from "drizzle-orm";

export interface LinhaProduto {
  produto: string;
  valor: number;
  qtd: number;
}

export interface LinhaMotivo {
  motivo: string;
  mrr: number;
  pontual: number;
}

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Régua canônica de estoque pontual (a mesma de /estoque-pontual), aplicada ao
 * snapshot de fechamento da semana. 'cancelado/inativo' é UM valor de status.
 */
const FILTRO_ESTOQUE = sql`h.valorp > 0 AND h.status NOT IN ('entregue', 'cancelado/inativo', 'não usar')`;

/** Estoque pontual em aberto na foto do fim da semana. */
export async function estoquePontualNoFim(db: any, fim: string): Promise<number> {
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    )
    SELECT COALESCE(SUM(h.valorp::numeric), 0) AS total
    FROM "Clickup".cup_data_hist h, snap
    WHERE h.data_snapshot = snap.d AND ${FILTRO_ESTOQUE}
  `);
  return num((r.rows ?? [])[0]?.total);
}

/**
 * Mesmo estoque, quebrado por produto. `produto` está preenchido em 93–98% das
 * linhas do snapshot; o resto vai para 'Sem produto' em vez de sumir da soma —
 * a soma das linhas TEM que reproduzir estoquePontualNoFim.
 */
export async function estoquePontualPorProduto(db: any, fim: string): Promise<LinhaProduto[]> {
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    )
    SELECT
      COALESCE(NULLIF(TRIM(h.produto), ''), 'Sem produto') AS produto,
      COALESCE(SUM(h.valorp::numeric), 0) AS valor,
      COUNT(*) AS qtd
    FROM "Clickup".cup_data_hist h, snap
    WHERE h.data_snapshot = snap.d AND ${FILTRO_ESTOQUE}
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    produto: String(x.produto),
    valor: num(x.valor),
    qtd: num(x.qtd),
  }));
}

/**
 * Churn da semana quebrado por motivo, BRUTO (abonados incluídos): os motivos
 * operacionais são justamente o que a reunião quer enxergar, e assim o total da
 * tabela fecha com a linha Churn Total.
 *
 * LEFT JOIN, não INNER: um churn sem contrato pontual precisa aparecer com
 * pontual = 0, senão o MRR daquele motivo some da tabela. Depende de
 * `id_subtask` ser único em cup_contratos — validado no Step 1.
 */
export async function churnPorMotivoNaSemana(
  db: any,
  inicio: string,
  fim: string,
): Promise<LinhaMotivo[]> {
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(ch.motivo_cancelamento), ''), '(sem motivo)') AS motivo,
      COALESCE(SUM(ch.valor_r), 0) AS mrr,
      COALESCE(SUM(ct.valorp), 0) AS pontual
    FROM "Clickup".cup_churn ch
    LEFT JOIN "Clickup".cup_contratos ct
      ON ct.id_subtask = ch.task_id AND ct.valorp > 0
    WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
      AND ch.data_solicitacao_encerramento <= ${fim}::date
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    motivo: String(x.motivo),
    mrr: num(x.mrr),
    pontual: num(x.pontual),
  }));
}
```

- [ ] **Step 3: Conferir que as somas fecham, contra produção**

O teste real destas queries é de reconciliação — a soma das quebras tem que reproduzir os totais:

```bash
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
WITH snap AS (
  SELECT MAX(data_snapshot) AS d FROM \"Clickup\".cup_data_hist WHERE data_snapshot <= '2026-07-19'::date
),
base AS (
  SELECT h.valorp::numeric AS v, COALESCE(NULLIF(TRIM(h.produto),''),'Sem produto') AS p
  FROM \"Clickup\".cup_data_hist h, snap
  WHERE h.data_snapshot = snap.d AND h.valorp > 0
    AND h.status NOT IN ('entregue','cancelado/inativo','não usar')
)
SELECT ROUND(SUM(v)) AS total_geral, ROUND(SUM(v) FILTER (WHERE p = 'Sem produto')) AS sem_produto,
       COUNT(DISTINCT p) AS produtos FROM base;" -c "
SELECT
  ROUND(SUM(valor_r)) AS churn_total_mrr,
  ROUND((SELECT SUM(ct.valorp) FROM \"Clickup\".cup_churn c2
         JOIN \"Clickup\".cup_contratos ct ON ct.id_subtask = c2.task_id AND ct.valorp > 0
         WHERE c2.data_solicitacao_encerramento BETWEEN '2026-07-13' AND '2026-07-19')) AS churn_total_pontual
FROM \"Clickup\".cup_churn
WHERE data_solicitacao_encerramento BETWEEN '2026-07-13' AND '2026-07-19';"
```

Expected: anotar `total_geral` e `churn_total_mrr`/`churn_total_pontual`. Na Task 12, a soma da coluna da tabela por produto tem que dar exatamente `total_geral`, e a soma da tabela por motivo tem que dar exatamente os dois de churn.

- [ ] **Step 4: Commit**

```bash
git add server/reportsSemanal/queriesOperacao.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): queries de estoque pontual e churn por motivo

Estoque por produto joga o produto vazio em 'Sem produto' em vez de
descartar — a soma das linhas tem que reproduzir o total. Churn por motivo
usa LEFT JOIN para não sumir com o MRR de quem não tem contrato pontual.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Headcount de operação e faturável do mês

**Files:**
- Modify: `server/reportsSemanal/queriesOperacao.ts` (acrescentar ao final)

**Interfaces:**
- Consumes: `ehOperacao` de `shared/headcount-operacao`, `computarBpReceitas` de `server/routes/bp2026`
- Produces:
  - `headcountOperacao(db: any, data: string): Promise<number>`
  - `faturavelDoMes(db: any, fimDaSemana: string): Promise<number | null>`

- [ ] **Step 1: Escrever as duas funções**

Acrescentar ao final de `server/reportsSemanal/queriesOperacao.ts`, e adicionar os imports no topo do arquivo:

```typescript
import { ehOperacao } from "../../shared/headcount-operacao";
import { computarBpReceitas } from "../routes/bp2026";
```

```typescript
/**
 * Pessoas de operação ativas na data. A query traz todo mundo que estava na
 * casa (~110 linhas) e o recorte de setor/squad acontece em TypeScript, com
 * `ehOperacao` — a régua tem teste, e teste de normalização de string em SQL
 * seria caro. Volume não justifica filtrar no banco.
 *
 * A janela histórica é governada por `admissao`/`demissao`. A exclusão de
 * `status = 'Dispensado'` é condicionada a `demissao IS NULL` e trata um erro
 * de cadastro real: 3 pessoas em Commerce foram dispensadas sem receber data de
 * saída e, sem isto, contariam como operação em TODA data (~4% de inflação no
 * denominador da receita por cabeça). Quem tem data de saída continua governado
 * por ela, então a série histórica fica intacta.
 *
 * Não filtrar por `status = 'Ativo'` puro: `status` é foto do agora, e quem saiu
 * em junho sumiria também das semanas de abril — a série chega a inverter.
 *
 * Validado em produção: 72 em 2026-07-19, 73 em 2026-07-12, 71 em 2026-07-24.
 */
export async function headcountOperacao(db: any, data: string): Promise<number> {
  const r: any = await db.execute(sql`
    SELECT setor, squad
    FROM "Inhire".rh_pessoal
    WHERE admissao IS NOT NULL
      AND admissao <= ${data}::date
      AND (demissao IS NULL OR demissao > ${data}::date)
      AND NOT (demissao IS NULL AND TRIM(COALESCE(status, '')) = 'Dispensado')
  `);
  return ((r.rows ?? []) as any[]).filter((p) => ehOperacao(p.setor, p.squad)).length;
}

/**
 * Receita Total Faturável do mês em que a semana FECHA (o domingo manda: uma
 * semana que cruza a virada de mês conta no mês do domingo).
 *
 * Reusa `computarBpReceitas` em vez de uma query nova para não criar a terceira
 * régua de faturamento do repositório — ela já tem cache de 10 minutos
 * compartilhado com /bp-2026. `receita_total_faturavel` = MRR Ativo + Venda
 * Pontual + Outras Receitas.
 *
 * Devolve `null` quando o mês não é de 2026 (o BP é um modelo anual de 2026) ou
 * quando o mês ainda não tem realizado. A tela mostra '—'; nunca zero, que se
 * leria como 'faturou nada'.
 */
export async function faturavelDoMes(db: any, fimDaSemana: string): Promise<number | null> {
  const [ano, mes] = fimDaSemana.split("-").map(Number);
  const payload: any = await computarBpReceitas(db);
  if (ano !== payload?.ano) return null;
  const linha = (payload?.linhas ?? []).find((l: any) => l.metrica === "receita_total_faturavel");
  const doMes = (linha?.meses ?? []).find((m: any) => m.mes === mes);
  const realizado = doMes?.realizado;
  return typeof realizado === "number" ? realizado : null;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run check 2>&1 | grep -E "queriesOperacao|headcount-operacao"`
Expected: sem saída

- [ ] **Step 3: Conferir o headcount contra produção**

```bash
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT COUNT(*) FROM \"Inhire\".rh_pessoal
WHERE admissao IS NOT NULL AND admissao <= '2026-07-19'::date
  AND (demissao IS NULL OR demissao > '2026-07-19'::date)
  AND NOT (demissao IS NULL AND TRIM(COALESCE(status,'')) = 'Dispensado')
  AND TRIM(setor) IN ('Commerce','Tech Sites')
  AND LOWER(TRIM(REGEXP_REPLACE(COALESCE(squad,''), '[^[:alnum:] &]', '', 'g'))) NOT LIKE '%vendas%';"
```

Expected: `72`. Se divergir, a régua em `ehOperacao` e a do SQL de conferência não estão dizendo a mesma coisa — investigar antes de seguir.

Conferir também que a exclusão do dispensado-sem-data está mordendo exatamente 3 pessoas, e não mais:

```bash
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT nome, setor, squad, status FROM \"Inhire\".rh_pessoal
WHERE demissao IS NULL AND TRIM(COALESCE(status,'')) = 'Dispensado';"
```

Expected: 4 linhas no total, das quais 3 em Commerce (as que a régua exclui). Se aparecerem muitas mais, o RH mudou a forma de cadastrar e a régua precisa ser reavaliada antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add server/reportsSemanal/queriesOperacao.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): headcount de operação e faturável do mês

Headcount filtra em TS com a régua testada, não em SQL: são ~110 linhas e
a normalização de squad precisa de teste. Faturável reusa computarBpReceitas
para não criar a terceira régua de faturamento do repo.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Queries gêmeas de drill

Cada uma repete o filtro da query de série correspondente. Se um filtro mudar, o par muda junto — senão o drawer deixa de somar a célula.

**Files:**
- Modify: `server/reportsSemanal/queriesOperacao.ts` (acrescentar ao final)

**Interfaces:**
- Consumes: `LinhaDetalhe` de `./queries`
- Produces:
  - `detalheChurnPorAbono(db: any, inicio: string, fim: string, opcoes: { pontual: boolean; abonados: boolean }): Promise<LinhaDetalhe[]>`
  - `detalheChurnDoMotivo(db: any, inicio: string, fim: string, motivo: string): Promise<LinhaDetalhe[]>`
  - `detalheEstoquePontual(db: any, fim: string, produto: string | null): Promise<LinhaDetalhe[]>`

- [ ] **Step 1: Escrever as três gêmeas**

Acrescentar ao topo do arquivo o import de tipo: `import type { LinhaDetalhe } from "./queries";`

```typescript
// ============================================
// Queries GÊMEAS do drill.
// Cada uma repete o filtro da query de série correspondente. ⚠️ Se um filtro
// mudar, o par TEM que mudar junto, senão o drawer deixa de somar a célula.
// ============================================

/**
 * Gêmea das células de Churn Abonado (`abonados: true`) e Churn Líquido
 * (`abonados: false`), em MRR (`pontual: false`) ou pontual (`pontual: true`).
 *
 * O par de filtros é uma PARTIÇÃO EXAUSTIVA do churn da semana: o que sai de
 * `abonados: true` mais o que sai de `abonados: false` reproduz Churn Total,
 * sem sobra e sem repetição. O `COALESCE` é o que garante isso — escrever
 * `abonar_churn <> 'Sim'` sem ele avaliaria NULL para as linhas não marcadas
 * (que são a maioria) e elas desapareceriam das DUAS pernas em silêncio.
 */
export async function detalheChurnPorAbono(
  db: any,
  inicio: string,
  fim: string,
  opcoes: { pontual: boolean; abonados: boolean },
): Promise<LinhaDetalhe[]> {
  const { pontual, abonados } = opcoes;
  const filtroAbono = abonados
    ? sql`COALESCE(ch.abonar_churn, '') = 'Sim'`
    : sql`COALESCE(ch.abonar_churn, '') <> 'Sim'`;
  const r: any = pontual
    ? await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(ch.nome), ''), 'Sem nome') AS cliente,
          COALESCE(ct.valorp, 0) AS valor,
          NULLIF(TRIM(COALESCE(ch.motivo_cancelamento, '')), '') AS motivo
        FROM "Clickup".cup_churn ch
        JOIN "Clickup".cup_contratos ct ON ct.id_subtask = ch.task_id AND ct.valorp > 0
        WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
          AND ch.data_solicitacao_encerramento <= ${fim}::date
          AND ${filtroAbono}
        ORDER BY ct.valorp DESC NULLS LAST
      `)
    : await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(ch.nome), ''), 'Sem nome') AS cliente,
          COALESCE(ch.valor_r, 0) AS valor,
          NULLIF(TRIM(COALESCE(ch.motivo_cancelamento, '')), '') AS motivo
        FROM "Clickup".cup_churn ch
        WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
          AND ch.data_solicitacao_encerramento <= ${fim}::date
          AND ${filtroAbono}
        ORDER BY ch.valor_r DESC NULLS LAST
      `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: abonados,
  }));
}

/**
 * Gêmea de uma LINHA de churnPorMotivoNaSemana. Traz MRR e pontual do mesmo
 * cliente na mesma linha — o drawer soma o campo que a célula clicada mostra.
 * '(sem motivo)' casa com motivo nulo ou vazio, espelhando o COALESCE da série.
 */
export async function detalheChurnDoMotivo(
  db: any,
  inicio: string,
  fim: string,
  motivo: string,
): Promise<LinhaDetalhe[]> {
  const filtroMotivo =
    motivo === "(sem motivo)"
      ? sql`COALESCE(NULLIF(TRIM(ch.motivo_cancelamento), ''), '') = ''`
      : sql`TRIM(ch.motivo_cancelamento) = ${motivo}`;
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(ch.nome), ''), 'Sem nome') AS cliente,
      COALESCE(ch.valor_r, 0) + COALESCE(ct.valorp, 0) AS valor,
      NULLIF(TRIM(COALESCE(ch.motivo_cancelamento, '')), '') AS motivo,
      (COALESCE(ch.abonar_churn, '') = 'Sim') AS abonado
    FROM "Clickup".cup_churn ch
    LEFT JOIN "Clickup".cup_contratos ct
      ON ct.id_subtask = ch.task_id AND ct.valorp > 0
    WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
      AND ch.data_solicitacao_encerramento <= ${fim}::date
      AND ${filtroMotivo}
    ORDER BY 2 DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: x.abonado === true,
  }));
}

/**
 * Gêmea de estoquePontualNoFim (produto = null) e de uma linha de
 * estoquePontualPorProduto (produto preenchido). 'Sem produto' casa com produto
 * nulo ou vazio, espelhando o COALESCE da série.
 */
export async function detalheEstoquePontual(
  db: any,
  fim: string,
  produto: string | null,
): Promise<LinhaDetalhe[]> {
  const filtroProduto =
    produto === null
      ? sql`TRUE`
      : produto === "Sem produto"
      ? sql`COALESCE(NULLIF(TRIM(h.produto), ''), '') = ''`
      : sql`TRIM(h.produto) = ${produto}`;
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    )
    SELECT
      COALESCE(NULLIF(TRIM(cl.nome), ''), 'Sem nome') AS cliente,
      COALESCE(h.valorp, 0) AS valor,
      COALESCE(NULLIF(TRIM(h.produto), ''), 'Sem produto') AS motivo
    -- CROSS JOIN explícito, não vírgula: 'FROM a, b LEFT JOIN c ON c.x = a.y'
    -- é erro no Postgres ("invalid reference to FROM-clause entry"), porque o
    -- LEFT JOIN se liga ao item imediatamente anterior e 'a' fica fora do
    -- escopo do ON. As queries de série acima podem usar vírgula porque não
    -- têm JOIN nenhum.
    FROM "Clickup".cup_data_hist h
    CROSS JOIN snap
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
    WHERE h.data_snapshot = snap.d AND ${FILTRO_ESTOQUE} AND ${filtroProduto}
    ORDER BY h.valorp DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: false,
  }));
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run check 2>&1 | grep queriesOperacao`
Expected: sem saída

- [ ] **Step 3: Commit**

```bash
git add server/reportsSemanal/queriesOperacao.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): gêmeas de drill para abono, motivo e estoque

Abonado e líquido são as duas pernas de uma partição exaustiva; o COALESCE
no filtro é o que impede as linhas sem marcação de sumirem das duas. Cada
gêmea repete o filtro da série, incluindo o COALESCE que cria '(sem motivo)'
e 'Sem produto' — sem isso o drawer dessas linhas viria vazio.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Derivação pura da semana e do comparativo

O coração da tela. Sem I/O, para que líquido, percentuais, por-cabeça e o pareamento de produtos/motivos sejam testáveis sem banco.

**Files:**
- Create: `server/reportsSemanal/derivarOperacao.ts`
- Test: `server/reportsSemanal/derivarOperacao.test.ts`

**Interfaces:**
- Consumes: `Semana` de `./semanas`, `Carteira`/`Base`/`ChurnValores` de `./queries`, `LinhaProduto`/`LinhaMotivo` de `./queriesOperacao`
- Produces: `derivarOperacao(e: EntradaOperacao): SemanaOperacao`, `parearLinhas<T>`, `compararOperacao(atual, anterior): Comparativo`, e os tipos `EntradaOperacao`, `SemanaOperacao`, `ProdutoComparado`, `MotivoComparado`, `Comparativo`

- [ ] **Step 1: Write the failing test**

```typescript
// server/reportsSemanal/derivarOperacao.test.ts
import { describe, it, expect } from "vitest";
import { derivarOperacao, compararOperacao, type EntradaOperacao } from "./derivarOperacao";

// Ordem de grandeza real de uma semana de julho/2026 em produção.
const ENTRADA: EntradaOperacao = {
  semana: { inicio: "2026-07-13", fim: "2026-07-19", label: "13/07", parcial: false },
  carteira: { triagemOnboarding: 120000, ativo: 1023674, emCancelamento: 106874 },
  base: { mrr: 1150000, pontual: 1950000 },
  entregaPontual: 142800,
  // A soma de estoquePorProduto TEM que dar estoquePontual — a fixture respeita
  // a invariante que o último teste deste bloco verifica.
  estoquePontual: 1903200,
  estoquePorProduto: [
    { produto: "Creators", valor: 1024543, qtd: 140 },
    { produto: "Ecommerce", valor: 340500, qtd: 19 },
    { produto: "Performance", valor: 321928, qtd: 38 },
    { produto: "Sem produto", valor: 216229, qtd: 19 },
  ],
  churnMrr: { total: 38400, ajustado: 30000, abonado: 6900 },
  churnPontual: { total: 13700, ajustado: 11000, abonado: 2000 },
  churnPorMotivo: [
    { motivo: "Erro na Venda", mrr: 12400, pontual: 8000 },
    { motivo: "Inadimplente", mrr: 9800, pontual: 0 },
  ],
  headcountOperacao: 75,
  faturavelMes: 1380000,
};

describe("derivarOperacao", () => {
  it("repassa a identidade da semana", () => {
    expect(derivarOperacao(ENTRADA)).toMatchObject({
      inicio: "2026-07-13",
      fim: "2026-07-19",
      label: "13/07",
    });
  });

  it("MRR Ativo = triagem/onboarding + ativo; Operando soma em cancelamento", () => {
    const r = derivarOperacao(ENTRADA);
    expect(r.mrrAtivo).toBe(1143674);
    expect(r.mrrOperando).toBe(1250548);
  });

  it("Churn Líquido = Total − Abonado, em MRR e em pontual", () => {
    const r = derivarOperacao(ENTRADA);
    expect(r.churnMrrLiquido).toBe(31500);
    expect(r.churnPontualLiquido).toBe(11700);
  });

  it("tudo abonado zera o líquido, sem virar negativo", () => {
    const r = derivarOperacao({
      ...ENTRADA,
      churnMrr: { total: 38400, ajustado: 0, abonado: 38400 },
    });
    expect(r.churnMrrLiquido).toBe(0);
  });

  it("percentuais de churn usam a base de ABERTURA, não a carteira do fim", () => {
    const r = derivarOperacao(ENTRADA);
    // 31500 / 1150000 = 2,7391%  (e não sobre mrrAtivo = 1143674)
    expect(r.churnMrrLiquidoPct).toBeCloseTo(2.7391, 3);
    // 11700 / 1950000 = 0,6%
    expect(r.churnPontualLiquidoPct).toBeCloseTo(0.6, 3);
  });

  it("base zero não vira divisão por zero", () => {
    const r = derivarOperacao({ ...ENTRADA, base: { mrr: 0, pontual: 0 } });
    expect(r.churnMrrLiquidoPct).toBe(0);
    expect(r.churnPontualLiquidoPct).toBe(0);
  });

  it("MRR por cabeça divide o MRR Ativo pelo headcount de operação", () => {
    // 1143674 / 75
    expect(derivarOperacao(ENTRADA).mrrPorCabeca).toBeCloseTo(15248.99, 2);
  });

  it("Faturamento por cabeça usa o faturável do mês", () => {
    // 1380000 / 75
    expect(derivarOperacao(ENTRADA).faturamentoPorCabeca).toBe(18400);
  });

  it("headcount zero vira null, nunca Infinity", () => {
    const r = derivarOperacao({ ...ENTRADA, headcountOperacao: 0 });
    expect(r.mrrPorCabeca).toBeNull();
    expect(r.faturamentoPorCabeca).toBeNull();
  });

  it("faturável indisponível vira null, não zero", () => {
    // zero se leria como 'faturou nada no mês'
    const r = derivarOperacao({ ...ENTRADA, faturavelMes: null });
    expect(r.faturamentoPorCabeca).toBeNull();
    expect(r.mrrPorCabeca).not.toBeNull();
  });

  it("a soma do estoque por produto reproduz o estoque total", () => {
    const r = derivarOperacao(ENTRADA);
    const soma = r.estoquePorProduto.reduce((s, p) => s + p.valor, 0);
    expect(soma).toBe(r.estoquePontual);
  });
});

describe("compararOperacao", () => {
  const anterior = derivarOperacao({
    ...ENTRADA,
    semana: { inicio: "2026-07-06", fim: "2026-07-12", label: "06/07", parcial: false },
    estoquePontual: 1060750,
    estoquePorProduto: [
      { produto: "Creators", valor: 1000000, qtd: 138 },
      { produto: "Landing Page", valor: 60750, qtd: 11 },
    ],
    churnPorMotivo: [
      { motivo: "Inadimplente", mrr: 11400, pontual: 0 },
      { motivo: "Troca de Agência", mrr: 4500, pontual: 1200 },
    ],
  });
  const atual = derivarOperacao(ENTRADA);

  it("produto que existe só na semana atual aparece com anterior zerado", () => {
    const c = compararOperacao(atual, anterior);
    const eco = c.produtos.find((p) => p.chave === "Ecommerce");
    expect(eco).toMatchObject({ atual: 340500, anterior: 0 });
  });

  it("produto que existe só na semana anterior NÃO some da tabela", () => {
    // sumir esconderia justamente o estoque que foi zerado na semana
    const c = compararOperacao(atual, anterior);
    const lp = c.produtos.find((p) => p.chave === "Landing Page");
    expect(lp).toMatchObject({ atual: 0, anterior: 60750 });
  });

  it("produtos saem ordenados pelo valor atual, desc; os que só existem no anterior vão para o fim", () => {
    const c = compararOperacao(atual, anterior);
    expect(c.produtos.map((p) => p.chave)).toEqual([
      "Creators",
      "Ecommerce",
      "Performance",
      "Sem produto",
      "Landing Page",
    ]);
  });

  it("motivos pareiam MRR e pontual das duas semanas", () => {
    const c = compararOperacao(atual, anterior);
    expect(c.motivos.find((m) => m.chave === "Erro na Venda")).toMatchObject({
      atual: 12400,
      anterior: 0,
      pontualAtual: 8000,
      pontualAnterior: 0,
    });
    expect(c.motivos.find((m) => m.chave === "Inadimplente")).toMatchObject({
      atual: 9800,
      anterior: 11400,
    });
  });

  it("a soma dos motivos reproduz o churn total das duas semanas", () => {
    const c = compararOperacao(atual, anterior);
    const somaAtual = c.motivos.reduce((s, m) => s + m.atual, 0);
    const somaAnterior = c.motivos.reduce((s, m) => s + m.anterior, 0);
    expect(somaAtual).toBe(22200); // 12400 + 9800
    expect(somaAnterior).toBe(15900); // 11400 + 4500
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/reportsSemanal/derivarOperacao.test.ts`
Expected: FAIL — `Failed to resolve import "./derivarOperacao"`

- [ ] **Step 3: Write minimal implementation**

```typescript
// server/reportsSemanal/derivarOperacao.ts
// Derivação pura da tela /reports/operacao a partir das entradas cruas das
// queries. Sem I/O, para que as fórmulas — churn líquido, percentuais sobre a
// base de abertura, métricas por cabeça, pareamento de produtos e motivos —
// sejam testáveis sem banco. Mesmo desenho de ./derivar.ts.
import type { Semana } from "./semanas";
import type { Carteira, Base, ChurnValores } from "./queries";
import type { LinhaProduto, LinhaMotivo } from "./queriesOperacao";

export interface EntradaOperacao {
  semana: Semana;
  /** foto do último snapshot <= domingo */
  carteira: Carteira;
  /** último snapshot ANTES da segunda: a carteira que a semana recebeu */
  base: Base;
  entregaPontual: number;
  /** estoque em aberto na foto do FIM da semana */
  estoquePontual: number;
  estoquePorProduto: LinhaProduto[];
  churnMrr: ChurnValores;
  churnPontual: ChurnValores;
  churnPorMotivo: LinhaMotivo[];
  headcountOperacao: number;
  /** Receita Total Faturável do mês; null quando indisponível */
  faturavelMes: number | null;
}

export interface SemanaOperacao {
  inicio: string;
  fim: string;
  label: string;

  mrrAtivo: number;
  mrrOperando: number;

  baseMrr: number;
  basePontual: number;

  churnMrrTotal: number;
  churnMrrAbonado: number;
  churnMrrLiquido: number;
  churnMrrLiquidoPct: number;
  churnPontualTotal: number;
  churnPontualAbonado: number;
  churnPontualLiquido: number;
  churnPontualLiquidoPct: number;

  entregaPontual: number;
  estoquePontual: number;

  headcountOperacao: number;
  /** null quando não há headcount: '—' na tela, nunca Infinity */
  mrrPorCabeca: number | null;
  /** null quando o faturável do mês está indisponível: zero se leria como 'faturou nada' */
  faturamentoPorCabeca: number | null;

  estoquePorProduto: LinhaProduto[];
  churnPorMotivo: LinhaMotivo[];
}

export interface ProdutoComparado {
  chave: string;
  atual: number;
  anterior: number;
  qtdAtual: number;
  qtdAnterior: number;
}

export interface MotivoComparado {
  chave: string;
  atual: number;
  anterior: number;
  pontualAtual: number;
  pontualAnterior: number;
}

export interface Comparativo {
  atual: SemanaOperacao;
  anterior: SemanaOperacao;
  produtos: ProdutoComparado[];
  motivos: MotivoComparado[];
}

function pct(valor: number, base: number): number {
  return base > 0 ? (valor / base) * 100 : 0;
}

function porCabeca(valor: number | null, headcount: number): number | null {
  if (valor === null || headcount <= 0) return null;
  return valor / headcount;
}

export function derivarOperacao(e: EntradaOperacao): SemanaOperacao {
  const mrrAtivo = e.carteira.triagemOnboarding + e.carteira.ativo;
  const mrrOperando = mrrAtivo + e.carteira.emCancelamento;

  // Líquido desconta o ABONADO (abonar_churn), não os três motivos operacionais
  // do 'ajustado' do BP 2026. As duas réguas andam coladas mas não são o mesmo
  // conjunto — a escolha aqui é a que faz Total − Abonado = Líquido fechar na
  // tela. Ver a spec para os números que medem a divergência.
  const churnMrrLiquido = e.churnMrr.total - e.churnMrr.abonado;
  const churnPontualLiquido = e.churnPontual.total - e.churnPontual.abonado;

  return {
    inicio: e.semana.inicio,
    fim: e.semana.fim,
    label: e.semana.label,

    mrrAtivo,
    mrrOperando,

    baseMrr: e.base.mrr,
    basePontual: e.base.pontual,

    churnMrrTotal: e.churnMrr.total,
    churnMrrAbonado: e.churnMrr.abonado,
    churnMrrLiquido,
    churnMrrLiquidoPct: pct(churnMrrLiquido, e.base.mrr),
    churnPontualTotal: e.churnPontual.total,
    churnPontualAbonado: e.churnPontual.abonado,
    churnPontualLiquido,
    churnPontualLiquidoPct: pct(churnPontualLiquido, e.base.pontual),

    entregaPontual: e.entregaPontual,
    estoquePontual: e.estoquePontual,

    headcountOperacao: e.headcountOperacao,
    mrrPorCabeca: porCabeca(mrrAtivo, e.headcountOperacao),
    faturamentoPorCabeca: porCabeca(e.faturavelMes, e.headcountOperacao),

    estoquePorProduto: e.estoquePorProduto,
    churnPorMotivo: e.churnPorMotivo,
  };
}

/**
 * União das chaves das duas semanas, ordenada pelo valor atual desc.
 *
 * A união importa: uma chave que existe só na semana anterior precisa aparecer
 * com atual = 0. Sumir da tabela esconderia exatamente o caso interessante —
 * o produto que zerou o estoque, o motivo de churn que parou de acontecer.
 */
export function parearLinhas<T>(
  atuais: T[],
  anteriores: T[],
  chaveDe: (x: T) => string,
  valorDe: (x: T) => number,
): { chave: string; atual: T | undefined; anterior: T | undefined }[] {
  const mapaAtual = new Map(atuais.map((x) => [chaveDe(x), x]));
  const mapaAnterior = new Map(anteriores.map((x) => [chaveDe(x), x]));
  const chaves = Array.from(new Set([...mapaAtual.keys(), ...mapaAnterior.keys()]));
  return chaves
    .map((chave) => ({ chave, atual: mapaAtual.get(chave), anterior: mapaAnterior.get(chave) }))
    .sort((a, b) => {
      const va = a.atual ? valorDe(a.atual) : 0;
      const vb = b.atual ? valorDe(b.atual) : 0;
      if (vb !== va) return vb - va;
      const pa = a.anterior ? valorDe(a.anterior) : 0;
      const pb = b.anterior ? valorDe(b.anterior) : 0;
      return pb - pa;
    });
}

export function compararOperacao(atual: SemanaOperacao, anterior: SemanaOperacao): Comparativo {
  const produtos: ProdutoComparado[] = parearLinhas(
    atual.estoquePorProduto,
    anterior.estoquePorProduto,
    (p) => p.produto,
    (p) => p.valor,
  ).map((l) => ({
    chave: l.chave,
    atual: l.atual?.valor ?? 0,
    anterior: l.anterior?.valor ?? 0,
    qtdAtual: l.atual?.qtd ?? 0,
    qtdAnterior: l.anterior?.qtd ?? 0,
  }));

  const motivos: MotivoComparado[] = parearLinhas(
    atual.churnPorMotivo,
    anterior.churnPorMotivo,
    (m) => m.motivo,
    (m) => m.mrr,
  ).map((l) => ({
    chave: l.chave,
    atual: l.atual?.mrr ?? 0,
    anterior: l.anterior?.mrr ?? 0,
    pontualAtual: l.atual?.pontual ?? 0,
    pontualAnterior: l.anterior?.pontual ?? 0,
  }));

  return { atual, anterior, produtos, motivos };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/reportsSemanal/derivarOperacao.test.ts`
Expected: PASS — 17 testes

- [ ] **Step 5: Commit**

```bash
git add server/reportsSemanal/derivarOperacao.ts server/reportsSemanal/derivarOperacao.test.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): derivação pura da semana e do comparativo

Líquido = Total − Abonado, percentuais sobre a base de ABERTURA (não sobre
a carteira do fim, que já perdeu o churn), por-cabeça vira null em vez de
Infinity, e o pareamento mantém na tabela a chave que só existe na semana
anterior — é justamente o produto que zerou.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Endpoints

**Files:**
- Create: `server/routes/reportsOperacao.ts`
- Modify: `server/routes.ts:65` (import), `server/routes.ts:8719` (registro)

**Interfaces:**
- Consumes: `parSemanas`, `derivarOperacao`, `compararOperacao`, todas as queries das Tasks 5–7, e de `./reportsSemanal/queries`: `carteiraNoFim`, `baseNaAbertura`, `entregaPontualNaSemana`, `churnMrrNaSemana`, `churnPontualNaSemana`, `detalheChurnMrr`, `detalheChurnPontual`, `detalheEntregaPontual`
- Produces: `registerReportsOperacaoRoutes(app: Express): void`; `GET /api/reports/operacao?ate=` → `Comparativo`; `GET /api/reports/operacao/detalhe?metrica=&inicio=&fim=&chave=` → `{ tipo: "churn", linhas: LinhaDetalhe[] }`

- [ ] **Step 1: Escrever a rota**

```typescript
// server/routes/reportsOperacao.ts
// Tela /reports/operacao — leitura gerencial da semana de operação.
// Spec: docs/superpowers/specs/2026-07-24-reporte-semanal-operacao-design.md
//
// Compara a última semana FECHADA com a anterior. A semana em curso não entra:
// comparar meia semana com uma inteira produz queda fantasma toda segunda.
import type { Express } from "express";
import { db } from "../db";
import { parSemanas, hojeSP, type Semana } from "../reportsSemanal/semanas";
import {
  derivarOperacao,
  compararOperacao,
  type SemanaOperacao,
} from "../reportsSemanal/derivarOperacao";
import {
  carteiraNoFim,
  baseNaAbertura,
  entregaPontualNaSemana,
  churnMrrNaSemana,
  churnPontualNaSemana,
  detalheChurnMrr,
  detalheChurnPontual,
  detalheEntregaPontual,
} from "../reportsSemanal/queries";
import {
  estoquePontualNoFim,
  estoquePontualPorProduto,
  churnPorMotivoNaSemana,
  headcountOperacao,
  faturavelDoMes,
  detalheChurnPorAbono,
  detalheChurnDoMotivo,
  detalheEstoquePontual,
} from "../reportsSemanal/queriesOperacao";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * As queries de UMA semana. Em dois lotes de no máximo 4: o pool é max: 5
 * (server/db.ts) e é compartilhado com o app inteiro — disparar as 8 de uma vez
 * deixaria o resto do app esperando conexão enquanto esta tela carrega.
 */
async function apurarSemana(semana: Semana): Promise<SemanaOperacao> {
  const [carteira, base, entregaPontual, churnMrr] = await Promise.all([
    carteiraNoFim(db, semana.fim),
    baseNaAbertura(db, semana.inicio),
    entregaPontualNaSemana(db, semana.inicio, semana.fim),
    churnMrrNaSemana(db, semana.inicio, semana.fim),
  ]);
  const [churnPontual, estoque, porProduto, porMotivo] = await Promise.all([
    churnPontualNaSemana(db, semana.inicio, semana.fim),
    estoquePontualNoFim(db, semana.fim),
    estoquePontualPorProduto(db, semana.fim),
    churnPorMotivoNaSemana(db, semana.inicio, semana.fim),
  ]);
  const [headcount, faturavelMes] = await Promise.all([
    headcountOperacao(db, semana.fim),
    faturavelDoMes(db, semana.fim),
  ]);

  return derivarOperacao({
    semana,
    carteira,
    base,
    entregaPontual,
    estoquePontual: estoque,
    estoquePorProduto: porProduto,
    churnMrr,
    churnPontual,
    churnPorMotivo: porMotivo,
    headcountOperacao: headcount,
    faturavelMes,
  });
}

export function registerReportsOperacaoRoutes(app: Express) {
  app.get("/api/reports/operacao", async (req, res) => {
    try {
      const ate = req.query.ate ? String(req.query.ate) : undefined;
      if (ate && !DATA_ISO.test(ate)) {
        return res.status(400).json({ error: "Parâmetro 'ate' deve ser uma data YYYY-MM-DD" });
      }

      const { atual, anterior } = parSemanas(hojeSP(), ate);
      // Semanas em SÉRIE: ver o comentário de pool em apurarSemana.
      const metricasAtual = await apurarSemana(atual);
      const metricasAnterior = await apurarSemana(anterior);

      res.json(compararOperacao(metricasAtual, metricasAnterior));
    } catch (e: any) {
      console.error("[reports/operacao] erro geral:", e);
      res.status(500).json({ error: "Falha ao montar o reporte de operação", details: e?.message });
    }
  });

  // Drill de uma célula: as linhas por trás do número. `chave` carrega o
  // produto ou o motivo quando a métrica é de uma tabela quebrada.
  app.get("/api/reports/operacao/detalhe", async (req, res) => {
    try {
      const metrica = String(req.query.metrica || "");
      const inicio = String(req.query.inicio || "");
      const fim = String(req.query.fim || "");
      const chave = req.query.chave ? String(req.query.chave) : null;

      if (!DATA_ISO.test(inicio) || !DATA_ISO.test(fim)) {
        return res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' devem ser datas YYYY-MM-DD" });
      }

      switch (metrica) {
        case "churnMrrTotal":
          return res.json({ tipo: "churn", linhas: await detalheChurnMrr(db, inicio, fim, false) });
        case "churnMrrAbonado":
          return res.json({
            tipo: "churn",
            linhas: await detalheChurnPorAbono(db, inicio, fim, { pontual: false, abonados: true }),
          });
        case "churnMrrLiquido":
          return res.json({
            tipo: "churn",
            linhas: await detalheChurnPorAbono(db, inicio, fim, { pontual: false, abonados: false }),
          });
        case "churnPontualTotal":
          return res.json({ tipo: "churn", linhas: await detalheChurnPontual(db, inicio, fim, false) });
        case "churnPontualAbonado":
          return res.json({
            tipo: "churn",
            linhas: await detalheChurnPorAbono(db, inicio, fim, { pontual: true, abonados: true }),
          });
        case "churnPontualLiquido":
          return res.json({
            tipo: "churn",
            linhas: await detalheChurnPorAbono(db, inicio, fim, { pontual: true, abonados: false }),
          });
        case "entregaPontual":
          return res.json({ tipo: "churn", linhas: await detalheEntregaPontual(db, inicio, fim) });
        case "estoquePontual":
          return res.json({ tipo: "churn", linhas: await detalheEstoquePontual(db, fim, chave) });
        case "churnMotivo": {
          if (!chave) {
            return res.status(400).json({ error: "Métrica 'churnMotivo' exige o parâmetro 'chave'" });
          }
          return res.json({ tipo: "churn", linhas: await detalheChurnDoMotivo(db, inicio, fim, chave) });
        }
        default:
          return res.status(400).json({ error: `Métrica '${metrica}' não tem drill` });
      }
    } catch (e: any) {
      console.error("[reports/operacao/detalhe] erro:", e);
      res.status(500).json({ error: "Falha ao carregar o detalhe", details: e?.message });
    }
  });
}
```

**Nota sobre reconciliação do drill:** para uma mesma semana e um mesmo lado (MRR ou pontual), o drawer de Abonado e o de Líquido são disjuntos e, somados, reproduzem o drawer de Total. A Task 13 confere isso célula a célula — é o teste real de que o `COALESCE` no filtro de abono está fazendo seu trabalho.

- [ ] **Step 2: Registrar a rota**

Em `server/routes.ts`, ao lado do import da linha 65:

```typescript
import { registerReportsOperacaoRoutes } from "./routes/reportsOperacao";
```

e ao lado da chamada da linha 8719:

```typescript
  registerReportsOperacaoRoutes(app);
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run check 2>&1 | grep -E "reportsOperacao|queriesOperacao|derivarOperacao"`
Expected: sem saída

- [ ] **Step 4: Subir o server e bater no endpoint**

Como as memórias do projeto registram, a porta 3000 costuma estar ocupada por outra sessão. Usar 3005:

```bash
PORT=3005 npm run dev
```

Em outro terminal (o endpoint exige sessão autenticada; usar o cookie do navegador já logado, ou testar pela tela na Task 12):

```bash
curl -s "http://localhost:3005/api/reports/operacao" | head -c 400
```

Expected: JSON com as chaves `atual`, `anterior`, `produtos`, `motivos`. Se vier 401, seguir para a Task 12 e validar pela tela logada.

- [ ] **Step 5: Commit**

```bash
git add server/routes/reportsOperacao.ts server/routes.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): endpoints de série e de drill

Queries em lotes de 4 e semanas em série: o pool é max 5 e é do app
inteiro. Líquido não tem drill de propósito — é subtração, não conjunto.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Tipos e hooks do front

**Files:**
- Create: `client/src/pages/relatorio-operacao/types.ts`, `client/src/pages/relatorio-operacao/useRelatorioOperacao.ts`

**Interfaces:**
- Consumes: `GET /api/reports/operacao`, `GET /api/reports/operacao/detalhe`
- Produces: tipos `SemanaOperacao`, `ProdutoComparado`, `MotivoComparado`, `Comparativo`, `MetricaChave`, `CelulaSelecionada`, `LinhaDrill`, `DetalheResp`; hooks `useReporteOperacao(ate?: string)`, `useDetalheOperacao(celula: CelulaSelecionada | null)`

- [ ] **Step 1: Escrever os tipos**

```typescript
// client/src/pages/relatorio-operacao/types.ts
// Espelho de SemanaOperacao/Comparativo em server/reportsSemanal/derivarOperacao.ts.
// Mudou lá? Mude aqui.
export interface SemanaOperacao {
  inicio: string;
  fim: string;
  label: string;

  mrrAtivo: number;
  mrrOperando: number;

  baseMrr: number;
  basePontual: number;

  churnMrrTotal: number;
  churnMrrAbonado: number;
  churnMrrLiquido: number;
  churnMrrLiquidoPct: number;
  churnPontualTotal: number;
  churnPontualAbonado: number;
  churnPontualLiquido: number;
  churnPontualLiquidoPct: number;

  entregaPontual: number;
  estoquePontual: number;

  headcountOperacao: number;
  mrrPorCabeca: number | null;
  faturamentoPorCabeca: number | null;

  estoquePorProduto: { produto: string; valor: number; qtd: number }[];
  churnPorMotivo: { motivo: string; mrr: number; pontual: number }[];
}

export interface ProdutoComparado {
  chave: string;
  atual: number;
  anterior: number;
  qtdAtual: number;
  qtdAnterior: number;
}

export interface MotivoComparado {
  chave: string;
  atual: number;
  anterior: number;
  pontualAtual: number;
  pontualAnterior: number;
}

export interface Comparativo {
  atual: SemanaOperacao;
  anterior: SemanaOperacao;
  produtos: ProdutoComparado[];
  motivos: MotivoComparado[];
}

/** Chaves numéricas de SemanaOperacao — as que a tabela sabe renderizar. */
export type MetricaChave = Extract<
  keyof SemanaOperacao,
  | "mrrAtivo" | "mrrOperando"
  | "churnMrrTotal" | "churnMrrAbonado" | "churnMrrLiquido" | "churnMrrLiquidoPct"
  | "churnPontualTotal" | "churnPontualAbonado" | "churnPontualLiquido" | "churnPontualLiquidoPct"
  | "entregaPontual" | "estoquePontual"
  | "headcountOperacao" | "mrrPorCabeca" | "faturamentoPorCabeca"
>;

/** Métricas que o endpoint de drill aceita. */
export type MetricaDrill =
  | "churnMrrTotal"
  | "churnMrrAbonado"
  | "churnMrrLiquido"
  | "churnPontualTotal"
  | "churnPontualAbonado"
  | "churnPontualLiquido"
  | "entregaPontual"
  | "estoquePontual"
  | "churnMotivo";

export interface CelulaSelecionada {
  metrica: MetricaDrill;
  rotulo: string;
  inicio: string;
  fim: string;
  /** produto ou motivo, quando a célula vem de uma tabela quebrada */
  chave?: string;
}

export interface LinhaDrill {
  cliente: string;
  valor: number;
  motivo: string | null;
  abonado: boolean;
}

export interface DetalheResp {
  tipo: "churn";
  linhas: LinhaDrill[];
}
```

- [ ] **Step 2: Escrever os hooks**

```typescript
// client/src/pages/relatorio-operacao/useRelatorioOperacao.ts
import { useQuery } from "@tanstack/react-query";
import type { Comparativo, DetalheResp, CelulaSelecionada } from "./types";

async function buscar<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.details || body.error || `Erro ${res.status}`);
  }
  return res.json();
}

export function useReporteOperacao(ate?: string) {
  return useQuery<Comparativo>({
    queryKey: ["/api/reports/operacao", ate ?? "atual"],
    queryFn: () => buscar(`/api/reports/operacao${ate ? `?ate=${ate}` : ""}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDetalheOperacao(celula: CelulaSelecionada | null) {
  return useQuery<DetalheResp>({
    queryKey: [
      "/api/reports/operacao/detalhe",
      celula?.metrica,
      celula?.inicio,
      celula?.fim,
      celula?.chave ?? null,
    ],
    queryFn: () => {
      const p = new URLSearchParams({
        metrica: celula!.metrica,
        inicio: celula!.inicio,
        fim: celula!.fim,
      });
      if (celula!.chave) p.set("chave", celula!.chave);
      return buscar(`/api/reports/operacao/detalhe?${p.toString()}`);
    },
    enabled: celula !== null,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run check 2>&1 | grep relatorio-operacao`
Expected: sem saída

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/relatorio-operacao/types.ts client/src/pages/relatorio-operacao/useRelatorioOperacao.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): tipos e hooks do front

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Tabela comparativa e tabelas quebradas

**Files:**
- Create: `client/src/pages/relatorio-operacao/CelulaDelta.tsx`, `client/src/pages/relatorio-operacao/TabelaComparativa.tsx`, `client/src/pages/relatorio-operacao/TabelaChurnMotivo.tsx`, `client/src/pages/relatorio-operacao/TabelaEstoqueProduto.tsx`

**Interfaces:**
- Consumes: `Comparativo`, `MetricaChave`, `MetricaDrill`, `CelulaSelecionada` de `./types`; `calcularDelta` de `@shared/delta`
- Produces: `<CelulaDelta delta melhor percentual? />`, `classesDelta`, `textoDelta`, `Direcao`; `<TabelaComparativa dados onCelula? />`, `<TabelaChurnMotivo dados onCelula? />`, `<TabelaEstoqueProduto dados onCelula? />`

- [ ] **Step 1: Confirmar o alias de import de `shared/`**

Run: `grep -n '"@shared' tsconfig.json vite.config.ts`
Expected: um alias `@shared/*` → `shared/*`. Se não existir, usar caminho relativo nos imports abaixo em vez de `@shared/delta`.

- [ ] **Step 2: Escrever a célula de Δ compartilhada**

As três tabelas mostram Δ com a mesma regra de cor. Um arquivo só, porque "qual direção conta como melhora" é lógica: repetida em três componentes, ela fica livre para divergir — e Δ com cor invertida numa tabela e não na outra é o tipo de erro que ninguém percebe olhando a tela.

```tsx
// client/src/pages/relatorio-operacao/CelulaDelta.tsx

/** Direção que conta como melhora. Churn e estoque melhoram caindo. */
export type Direcao = "up" | "down";

export function classesDelta(delta: number | null, melhor: Direcao | undefined): string {
  if (delta == null || delta === 0 || !melhor) return "text-gray-400 dark:text-zinc-500";
  const bom = melhor === "up" ? delta > 0 : delta < 0;
  return bom ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

export function textoDelta(delta: number | null, percentual = false): string {
  if (delta == null) return "—";
  const sinal = delta > 0 ? "+" : "";
  const n = delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return percentual ? `${sinal}${n} p.p.` : `${sinal}${n}%`;
}

export function CelulaDelta({
  delta,
  melhor,
  percentual = false,
}: {
  delta: number | null;
  melhor: Direcao | undefined;
  /** true quando a linha já é um percentual: o Δ vira p.p. */
  percentual?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium ${classesDelta(
        delta,
        melhor,
      )}`}
    >
      {textoDelta(delta, percentual)}
    </td>
  );
}
```

- [ ] **Step 3: Escrever a tabela comparativa**

```tsx
// client/src/pages/relatorio-operacao/TabelaComparativa.tsx
import { Fragment } from "react";
import { calcularDelta } from "@shared/delta";
import { CelulaDelta, type Direcao } from "./CelulaDelta";
import type { Comparativo, MetricaChave, MetricaDrill, CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const fmtNum = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

interface Linha {
  chave: MetricaChave;
  rotulo: string;
  formato?: "moeda" | "percentual" | "inteiro";
  /** recuo, para a linha de % logo abaixo do valor que ela qualifica */
  indentada?: boolean;
  /** métrica do drill; sem ela a célula não é clicável */
  drill?: MetricaDrill;
  /** direção que conta como melhora, para a cor do Δ */
  melhor?: Direcao;
}

interface Secao {
  titulo: string;
  linhas: Linha[];
}

export const SECOES: Secao[] = [
  {
    titulo: "MRR (foto do fim da semana)",
    linhas: [
      { chave: "mrrAtivo", rotulo: "MRR Ativo", melhor: "up" },
      { chave: "mrrOperando", rotulo: "MRR Operando", melhor: "up" },
    ],
  },
  {
    titulo: "Churn de MRR",
    linhas: [
      { chave: "churnMrrTotal", rotulo: "Churn Total", drill: "churnMrrTotal", melhor: "down" },
      { chave: "churnMrrAbonado", rotulo: "Churn Abonado", drill: "churnMrrAbonado", melhor: "up" },
      { chave: "churnMrrLiquido", rotulo: "Churn Líquido", drill: "churnMrrLiquido", melhor: "down" },
      { chave: "churnMrrLiquidoPct", rotulo: "% da base", formato: "percentual", indentada: true, melhor: "down" },
    ],
  },
  {
    titulo: "Churn de Pontual",
    linhas: [
      { chave: "churnPontualTotal", rotulo: "Churn Total", drill: "churnPontualTotal", melhor: "down" },
      { chave: "churnPontualAbonado", rotulo: "Churn Abonado", drill: "churnPontualAbonado", melhor: "up" },
      { chave: "churnPontualLiquido", rotulo: "Churn Líquido", drill: "churnPontualLiquido", melhor: "down" },
      { chave: "churnPontualLiquidoPct", rotulo: "% do estoque", formato: "percentual", indentada: true, melhor: "down" },
    ],
  },
  {
    titulo: "Pontual",
    linhas: [
      { chave: "entregaPontual", rotulo: "Pontual Entregue", drill: "entregaPontual", melhor: "up" },
      { chave: "estoquePontual", rotulo: "Estoque Pontual", drill: "estoquePontual", melhor: "down" },
    ],
  },
  {
    titulo: "Produtividade",
    linhas: [
      { chave: "headcountOperacao", rotulo: "Headcount Operação", formato: "inteiro" },
      { chave: "mrrPorCabeca", rotulo: "MRR por cabeça", melhor: "up" },
      { chave: "faturamentoPorCabeca", rotulo: "Faturamento por cabeça", melhor: "up" },
    ],
  },
];

function formatar(valor: number | null, formato: Linha["formato"]): string {
  if (valor === null) return "—";
  if (formato === "percentual") return fmtPct(valor);
  if (formato === "inteiro") return fmtNum(valor);
  return fmtBRL(valor);
}

export function TabelaComparativa({
  dados,
  onCelula,
}: {
  dados: Comparativo;
  /** Sem handler, as células não são clicáveis — a tabela funciona sem o drill. */
  onCelula?: (c: CelulaSelecionada) => void;
}) {
  const periodo = (s: { inicio: string; fim: string }) =>
    `${s.inicio.slice(8, 10)}/${s.inicio.slice(5, 7)} – ${s.fim.slice(8, 10)}/${s.fim.slice(5, 7)}`;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-zinc-200 min-w-[220px]">
              Métrica
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200 whitespace-nowrap">
              {periodo(dados.atual)}
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400 whitespace-nowrap">
              {periodo(dados.anterior)}
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Δ</th>
          </tr>
        </thead>
        <tbody>
          {SECOES.map((secao) => (
            <Fragment key={secao.titulo}>
              <tr className="bg-gray-100/70 dark:bg-zinc-800/50">
                <td
                  colSpan={4}
                  className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400"
                >
                  {secao.titulo}
                </td>
              </tr>
              {secao.linhas.map((linha) => {
                const atual = dados.atual[linha.chave] as number | null;
                const anterior = dados.anterior[linha.chave] as number | null;
                const percentual = linha.formato === "percentual";
                const delta = calcularDelta(atual, anterior, percentual);
                const clicavel = linha.drill !== undefined && onCelula !== undefined;
                return (
                  <tr
                    key={linha.chave}
                    className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                  >
                    <td
                      className={`px-4 py-2 text-gray-700 dark:text-zinc-300 ${
                        linha.indentada ? "pl-8 text-xs text-gray-500 dark:text-zinc-500" : ""
                      }`}
                    >
                      {linha.rotulo}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums whitespace-nowrap text-gray-900 dark:text-zinc-100 ${
                        linha.indentada ? "text-xs" : ""
                      } ${clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""}`}
                      onClick={
                        clicavel
                          ? () =>
                              onCelula!({
                                metrica: linha.drill!,
                                rotulo: `${linha.rotulo} · ${secao.titulo}`,
                                inicio: dados.atual.inicio,
                                fim: dados.atual.fim,
                              })
                          : undefined
                      }
                    >
                      {formatar(atual, linha.formato)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums whitespace-nowrap text-gray-500 dark:text-zinc-400 ${
                        linha.indentada ? "text-xs" : ""
                      } ${clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""}`}
                      onClick={
                        clicavel
                          ? () =>
                              onCelula!({
                                metrica: linha.drill!,
                                rotulo: `${linha.rotulo} · ${secao.titulo}`,
                                inicio: dados.anterior.inicio,
                                fim: dados.anterior.fim,
                              })
                          : undefined
                      }
                    >
                      {formatar(anterior, linha.formato)}
                    </td>
                    <CelulaDelta delta={delta} melhor={linha.melhor} percentual={percentual} />
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Nota sobre `Churn Abonado` com `melhor: "up"`:** abonar mais churn é a operação reconhecendo que aquela perda não era churn real, então o Δ verde para cima está correto — mas é a única linha de churn com essa direção. Não "corrigir" para `down` por simetria visual.

- [ ] **Step 3: Escrever a tabela de churn por motivo**

```tsx
// client/src/pages/relatorio-operacao/TabelaChurnMotivo.tsx
import { calcularDelta } from "@shared/delta";
import { CelulaDelta } from "./CelulaDelta";
import type { Comparativo, CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function TabelaChurnMotivo({
  dados,
  onCelula,
}: {
  dados: Comparativo;
  onCelula?: (c: CelulaSelecionada) => void;
}) {
  const totalMrrAtual = dados.motivos.reduce((s, m) => s + m.atual, 0);
  const totalMrrAnterior = dados.motivos.reduce((s, m) => s + m.anterior, 0);
  const totalPontualAtual = dados.motivos.reduce((s, m) => s + m.pontualAtual, 0);
  const totalPontualAnterior = dados.motivos.reduce((s, m) => s + m.pontualAnterior, 0);

  if (dados.motivos.length === 0) {
    return (
      <p className="rounded-xl border border-gray-200 dark:border-zinc-800 px-4 py-8 text-center text-sm text-gray-500 dark:text-zinc-500">
        Nenhum churn registrado nas duas semanas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-zinc-200 min-w-[200px]">
              Motivo
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">MRR atual</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400">MRR anterior</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Δ MRR</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Pontual atual</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400">Pontual anterior</th>
          </tr>
        </thead>
        <tbody>
          {dados.motivos.map((m) => {
            const delta = calcularDelta(m.atual, m.anterior);
            const clicavel = onCelula !== undefined;
            return (
              <tr
                key={m.chave}
                className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
              >
                <td
                  className={`px-4 py-2 text-gray-700 dark:text-zinc-300 ${
                    clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""
                  }`}
                  onClick={
                    clicavel
                      ? () =>
                          onCelula!({
                            metrica: "churnMotivo",
                            rotulo: `Churn · ${m.chave}`,
                            inicio: dados.atual.inicio,
                            fim: dados.atual.fim,
                            chave: m.chave,
                          })
                      : undefined
                  }
                >
                  {m.chave}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
                  {fmtBRL(m.atual)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                  {fmtBRL(m.anterior)}
                </td>
                {/* churn melhora caindo */}
                <CelulaDelta delta={delta} melhor="down" />
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
                  {fmtBRL(m.pontualAtual)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                  {fmtBRL(m.pontualAnterior)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 font-semibold">
            <td className="px-4 py-2 text-gray-700 dark:text-zinc-200">Total</td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
              {fmtBRL(totalMrrAtual)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
              {fmtBRL(totalMrrAnterior)}
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
              {fmtBRL(totalPontualAtual)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
              {fmtBRL(totalPontualAnterior)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Escrever a tabela de estoque por produto**

```tsx
// client/src/pages/relatorio-operacao/TabelaEstoqueProduto.tsx
import { calcularDelta } from "@shared/delta";
import { CelulaDelta } from "./CelulaDelta";
import type { Comparativo, CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function TabelaEstoqueProduto({
  dados,
  onCelula,
}: {
  dados: Comparativo;
  onCelula?: (c: CelulaSelecionada) => void;
}) {
  const totalAtual = dados.produtos.reduce((s, p) => s + p.atual, 0);
  const totalAnterior = dados.produtos.reduce((s, p) => s + p.anterior, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-zinc-200 min-w-[200px]">
              Produto
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Estoque atual</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400">Itens</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400">Estoque anterior</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Δ</th>
          </tr>
        </thead>
        <tbody>
          {dados.produtos.map((p) => {
            const delta = calcularDelta(p.atual, p.anterior);
            const clicavel = onCelula !== undefined;
            return (
              <tr
                key={p.chave}
                className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
              >
                <td
                  className={`px-4 py-2 text-gray-700 dark:text-zinc-300 ${
                    clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""
                  }`}
                  onClick={
                    clicavel
                      ? () =>
                          onCelula!({
                            metrica: "estoquePontual",
                            rotulo: `Estoque Pontual · ${p.chave}`,
                            inicio: dados.atual.inicio,
                            fim: dados.atual.fim,
                            chave: p.chave,
                          })
                      : undefined
                  }
                >
                  {p.chave}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
                  {fmtBRL(p.atual)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                  {p.qtdAtual}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                  {fmtBRL(p.anterior)}
                </td>
                {/* estoque parado melhora caindo: entregar reduz o estoque */}
                <CelulaDelta delta={delta} melhor="down" />
              </tr>
            );
          })}
          <tr className="border-t-2 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 font-semibold">
            <td className="px-4 py-2 text-gray-700 dark:text-zinc-200">Total</td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
              {fmtBRL(totalAtual)}
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
              {fmtBRL(totalAnterior)}
            </td>
            <td className="px-3 py-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos e commitar**

Run: `npm run check 2>&1 | grep relatorio-operacao`
Expected: sem saída

```bash
git add client/src/pages/relatorio-operacao/
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): tabelas comparativa, de motivos e de produtos

Churn Abonado é a única linha de churn com melhor='up': abonar mais é a
operação reconhecendo perda que não era churn real. Linha de Total nas
tabelas quebradas para conferir contra o bloco de cima.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Página, drawer, rota e menu

**Files:**
- Create: `client/src/pages/relatorio-operacao/DrawerDetalhe.tsx`, `client/src/pages/RelatorioOperacao.tsx`
- Modify: `client/src/App.tsx:144` (import), `client/src/App.tsx:454` (rota), `shared/nav-config.ts:335` (permissão), `shared/nav-config.ts:609` (menu)

**Interfaces:**
- Consumes: `useReporteOperacao`, `useDetalheOperacao`, `TabelaComparativa`, `TabelaChurnMotivo`, `TabelaEstoqueProduto`
- Produces: rota `/reports/operacao`

- [ ] **Step 1: Escrever o drawer**

```tsx
// client/src/pages/relatorio-operacao/DrawerDetalhe.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDetalheOperacao } from "./useRelatorioOperacao";
import type { CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function DrawerDetalhe({
  celula,
  onClose,
}: {
  celula: CelulaSelecionada | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useDetalheOperacao(celula);
  const linhas = data?.linhas ?? [];
  const total = linhas.reduce((s, l) => s + l.valor, 0);

  // Estoque é foto de uma data, não fluxo de um período — descrever como
  // 'semana de X a Y' induziria a ler como entradas da semana.
  const ehFoto = celula?.metrica === "estoquePontual";
  const periodo = ehFoto
    ? `Foto de ${celula?.fim.split("-").reverse().join("/")}`
    : `Semana de ${celula?.inicio.split("-").reverse().join("/")} a ${celula?.fim
        .split("-")
        .reverse()
        .join("/")}`;

  return (
    <Sheet open={celula !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{celula?.rotulo}</SheetTitle>
          <SheetDescription>
            {periodo} · {linhas.length} {linhas.length === 1 ? "registro" : "registros"} ·{" "}
            {fmtBRL(total)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Falha ao carregar: {(error as Error)?.message}
            </p>
          ) : linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-500">
              Nenhum registro.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {linhas.map((l, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {l.cliente}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {l.motivo && (
                        <span className="text-xs text-gray-500 dark:text-zinc-500">{l.motivo}</span>
                      )}
                      {l.abonado && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          abonado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-gray-900 dark:text-zinc-100">
                    {fmtBRL(l.valor)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Escrever a página**

```tsx
// client/src/pages/RelatorioOperacao.tsx
import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useReporteOperacao } from "./relatorio-operacao/useRelatorioOperacao";
import { TabelaComparativa } from "./relatorio-operacao/TabelaComparativa";
import { TabelaChurnMotivo } from "./relatorio-operacao/TabelaChurnMotivo";
import { TabelaEstoqueProduto } from "./relatorio-operacao/TabelaEstoqueProduto";
import { DrawerDetalhe } from "./relatorio-operacao/DrawerDetalhe";
import type { CelulaSelecionada } from "./relatorio-operacao/types";

/** Desloca uma data 'YYYY-MM-DD' em dias, em UTC (imune a fuso e horário de verão). */
function deslocarDias(data: string, dias: number): string {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + dias * 86400000).toISOString().slice(0, 10);
}

/**
 * Âncora do parâmetro `ate` que faz o servidor devolver como semana atual a
 * semana que TERMINA em `fim`.
 *
 * O servidor trata `ate` como um "hoje simulado" e descarta a semana que contém
 * essa data (é a semana em curso). Então passar o próprio domingo da semana
 * desejada devolveria a semana ERRADA — a anterior a ela. A âncora certa é o
 * dia seguinte, que cai na semana seguinte. Ver o teste 'CONTRATO DE ÂNCORA' em
 * server/reportsSemanal/semanas.test.ts.
 */
function ancoraPara(fim: string): string {
  return deslocarDias(fim, 1);
}

export default function RelatorioOperacao() {
  usePageTitle("Reporte Semanal de Operação");
  const [ate, setAte] = useState<string | undefined>(undefined);
  const [celula, setCelula] = useState<CelulaSelecionada | null>(null);
  const { data, isLoading, isError, error } = useReporteOperacao(ate);

  // Navegação sempre a partir do que a tela está mostrando, nunca de "hoje":
  // assim os cliques encadeiam corretamente. Avançar além do presente é inócuo
  // — o servidor ignora `ate` no futuro e volta para a última semana fechada.
  const voltar = () => data && setAte(ancoraPara(deslocarDias(data.atual.fim, -7)));
  const avancar = () => data && setAte(ancoraPara(deslocarDias(data.atual.fim, 7)));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-500">
            <CalendarRange className="h-3.5 w-3.5" /> Reportes
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Reporte Semanal de Operação
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            A última semana fechada (segunda a domingo) comparada com a anterior.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={voltar} disabled={isLoading}>
            <ChevronLeft className="h-4 w-4" /> Semana anterior
          </Button>
          <Button variant="outline" size="sm" onClick={avancar} disabled={isLoading || !ate}>
            Semana seguinte <ChevronRight className="h-4 w-4" />
          </Button>
          {ate && (
            <Button variant="ghost" size="sm" onClick={() => setAte(undefined)}>
              Hoje
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Falha ao carregar o reporte: {(error as Error)?.message}
        </p>
      ) : data ? (
        <div className="space-y-8">
          <TabelaComparativa dados={data} onCelula={setCelula} />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Churn por motivo</h2>
            <TabelaChurnMotivo dados={data} onCelula={setCelula} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Estoque pontual por produto
            </h2>
            <TabelaEstoqueProduto dados={data} onCelula={setCelula} />
          </section>
        </div>
      ) : null}

      <div className="space-y-1 text-xs text-gray-500 dark:text-zinc-500">
        <p>
          <strong>Churn Líquido = Churn Total − Churn Abonado</strong> (marcação{" "}
          <em>abonar churn</em> no ClickUp). Régua diferente do <strong>Churn Ajustado</strong> do BP
          2026 e do Reporte Semanal, que em vez do abono exclui os motivos Erro na Venda, Não começou
          e Inadimplente 1º Mês. Os dois números não batem, e nenhum dos dois está errado.
        </p>
        <p>
          Percentuais usam a carteira de <strong>abertura</strong> da semana — a mesma foto que
          aparece na coluna da semana anterior.
        </p>
        <p>
          Churn por motivo é <strong>bruto</strong> (abonados incluídos), então a coluna de MRR
          soma exatamente o Churn Total.
        </p>
        <p>
          <strong>Por cabeça</strong> usa o headcount de <strong>operação</strong> (Commerce e Tech
          Sites, sem as squads de Vendas) — não bate com a receita por cabeça do BP 2026, que divide
          pela empresa inteira. Faturamento por cabeça tem numerador mensal: dentro do mês só se
          move pelo headcount.
        </p>
      </div>

      <DrawerDetalhe celula={celula} onClose={() => setCelula(null)} />
    </div>
  );
}
```

- [ ] **Step 3: Registrar rota e menu**

Em `client/src/App.tsx`, ao lado da linha 144:

```typescript
const RelatorioOperacao = lazyWithRetry(() => import("@/pages/RelatorioOperacao"));
```

e ao lado da linha 454:

```tsx
      <Route path="/reports/operacao">{() => <ProtectedRoute path="/reports/operacao" component={RelatorioOperacao} />}</Route>
```

Em `shared/nav-config.ts`, dentro de `ROUTE_TO_PERMISSION`, junto da linha 335:

```typescript
  '/reports/operacao': PERMISSION_KEYS.REPORTS.MENSAL,
```

e no array de itens do grupo Reports, junto da linha 609:

```typescript
        { title: 'Reporte de Operação', url: '/reports/operacao', icon: 'CalendarRange', permissionKey: PERMISSION_KEYS.REPORTS.MENSAL },
```

Usar a mesma permission key de `/reports/semanal` é o que libera a tela, no mesmo deploy, para todo mundo que já vê os reportes — sem SQL nem alteração em `auth_users`.

- [ ] **Step 4: Rodar a suíte e os tipos**

Run: `npx vitest run shared/ server/reportsSemanal/`
Expected: PASS em todos

Run: `npm run check 2>&1 | grep -E "reportsOperacao|queriesOperacao|derivarOperacao|headcount-operacao|relatorio-operacao|RelatorioOperacao"`
Expected: sem saída

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/RelatorioOperacao.tsx client/src/pages/relatorio-operacao/DrawerDetalhe.tsx client/src/App.tsx shared/nav-config.ts
git commit -m "$(cat <<'EOF'
feat(reporte-operacao): página, drawer, rota e menu

Rodapé declara a régua: líquido desconta abonado, não os motivos do
ajustado do BP — sem isso alguém cruza os dois números e reporta bug.
Permission key igual à do /reports/semanal libera a tela sem SQL.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Validação visual e reconciliação contra produção

Nenhuma tela deste repositório foi considerada pronta antes de os números baterem com a fonte. Esta task é o gate.

**Files:** nenhum arquivo novo; correções entram nos arquivos das tasks anteriores.

- [ ] **Step 1: Subir o servidor e abrir a tela**

```bash
PORT=3005 npm run dev
```

Abrir `http://localhost:3005/reports/operacao` logado.

Se a tela vier em branco após restarts, limpar o cache do Vite: `rm -rf node_modules/.vite` e reiniciar.

- [ ] **Step 2: Conferir dark e light**

Alternar o tema pelo seletor do app. Verificar nas três tabelas: cabeçalho, linha de seção, linha de total, cor de Δ (verde/vermelho) e o drawer aberto. Nenhum texto pode ficar ilegível — o caso clássico é a linha de total, que tem fundo próprio.

- [ ] **Step 3: Reconciliar cada número contra produção**

O banco local é espelho parcial; os números da tela local só valem se as tabelas estiverem sincronizadas. Rodar a conferência com as datas que a tela está mostrando:

```bash
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
WITH ini AS (SELECT MAX(data_snapshot) d FROM \"Clickup\".cup_data_hist WHERE data_snapshot < '2026-07-13'::date),
     fim AS (SELECT MAX(data_snapshot) d FROM \"Clickup\".cup_data_hist WHERE data_snapshot <= '2026-07-19'::date)
SELECT
  (SELECT ROUND(SUM(valorr::numeric)) FROM \"Clickup\".cup_data_hist h, fim
     WHERE h.data_snapshot = fim.d AND h.status IN ('triagem','onboarding','ativo')) AS mrr_ativo_fim,
  (SELECT ROUND(SUM(valorr::numeric)) FROM \"Clickup\".cup_data_hist h, ini
     WHERE h.data_snapshot = ini.d AND h.status IN ('triagem','onboarding','ativo')) AS base_mrr,
  (SELECT ROUND(SUM(valorp::numeric)) FROM \"Clickup\".cup_data_hist h, fim
     WHERE h.data_snapshot = fim.d AND h.valorp > 0
       AND h.status NOT IN ('entregue','cancelado/inativo','não usar')) AS estoque_fim,
  (SELECT ROUND(SUM(valor_r)) FROM \"Clickup\".cup_churn
     WHERE data_solicitacao_encerramento BETWEEN '2026-07-13' AND '2026-07-19') AS churn_total,
  (SELECT ROUND(SUM(valor_r)) FROM \"Clickup\".cup_churn
     WHERE data_solicitacao_encerramento BETWEEN '2026-07-13' AND '2026-07-19'
       AND COALESCE(abonar_churn,'') = 'Sim') AS churn_abonado;"
```

Conferir na tela, para a coluna da semana atual:
- `MRR Ativo` = `mrr_ativo_fim`
- `Churn Total` (MRR) = `churn_total`
- `Churn Abonado` (MRR) = `churn_abonado`
- `Churn Líquido` = `churn_total − churn_abonado`
- `% da base` = líquido ÷ `base_mrr` × 100
- `Estoque Pontual` = `estoque_fim`

Se o local divergir do prod, **suspeitar primeiro dos dados locais**, não do código: o espelho local costuma estar dias atrás. Ressincronizar `cup_contratos`, `cup_clientes`, `cup_churn`, `cup_data_hist` e `rh_pessoal` antes de investigar o cálculo.

- [ ] **Step 4: Reconciliar as tabelas quebradas contra os totais**

Na própria tela, sem SQL:
- Somar a coluna "Estoque atual" da tabela por produto → tem que dar exatamente o `Estoque Pontual` do bloco Pontual. A linha de Total já faz essa soma; comparar os dois números.
- Somar a coluna "MRR atual" da tabela por motivo → tem que dar exatamente o `Churn Total` de MRR.
- Somar a coluna "Pontual atual" da tabela por motivo → tem que dar exatamente o `Churn Total` de Pontual.

Qualquer diferença aqui é bug de query, não de arredondamento: as três somas são das mesmas linhas.

- [ ] **Step 5: Conferir o drill célula a célula**

Abrir o drawer em cada uma das 9 células com drill e verificar que o total do cabeçalho do drawer bate com a célula clicada:
`Churn Total`, `Churn Abonado` e `Churn Líquido` de MRR; os mesmos três de Pontual; `Pontual Entregue`; `Estoque Pontual`; e uma linha qualquer da tabela de motivos.

Duas conferências extras que só este conjunto permite:
- **Partição do abono:** contagem de registros de `Churn Abonado` + de `Churn Líquido` = a de `Churn Total`, no mesmo lado (MRR ou pontual). Se faltar registro, o `COALESCE` do filtro de abono não está fazendo seu trabalho e as linhas sem marcação estão sumindo das duas pernas.
- **Drawer de motivo:** soma MRR + pontual do mesmo cliente, então bate com a soma das duas colunas daquela linha da tabela — não só com a coluna de MRR.

- [ ] **Step 6: Testar a navegação de semanas**

Anotar as datas das duas colunas no estado inicial. Clicar "Semana anterior" **uma** vez: a coluna da esquerda tem que passar a mostrar exatamente o que antes estava na coluna da direita — pular duas semanas de uma vez é a falha clássica aqui (o servidor descarta a semana que contém a data-âncora). Clicar mais duas vezes e conferir que retrocede de 7 em 7 dias.

Depois clicar "Semana seguinte" até voltar, e "Hoje". Em nenhum momento a tela pode mostrar a semana em curso: a data final da coluna da esquerda nunca é maior que o último domingo passado.

- [ ] **Step 7: Commit de eventuais correções e push**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(reporte-operacao): correções da validação visual e de reconciliação

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git push -u origin feature/reporte-semanal-operacao
```

Se nada precisou de correção, pular o commit e só fazer o push.

---

## Checklist de conclusão

- [ ] `npx vitest run shared/ server/reportsSemanal/` passa
- [ ] `npm run check 2>&1 | grep -E "reportsOperacao|queriesOperacao|derivarOperacao|headcount-operacao|relatorio-operacao|RelatorioOperacao"` sai vazio
- [ ] Números reconciliados contra produção (Task 13, steps 3–5)
- [ ] Dark e light conferidos com olho humano
- [ ] Rodapé da tela declara as três réguas que divergem de outras telas
