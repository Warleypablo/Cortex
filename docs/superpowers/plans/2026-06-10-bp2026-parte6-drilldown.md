# BP 2026 Parte 6 (Drill-down por célula) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicar numa célula (linha × mês) da matriz `/bp-2026` abre um drawer com os itens que compõem o realizado, agrupados com subtotais.

**Architecture:** Predicados de categoria extraídos para `bp2026.predicados.ts` (única fonte para agregação E detalhe); endpoint novo `GET /api/bp2026/detalhe` em `bp2026.detalhe.ts` com switch por métrica; helper puro de agrupamento testado; frontend ganha `BPCellDetail` (Sheet) e células clicáveis. Derivadas são resolvidas client-side com o payload existente.

**Tech Stack:** igual às partes anteriores.

**Spec:** `docs/superpowers/specs/2026-06-10-bp2026-parte6-drilldown-design.md`

**Contexto:** worktree `/Users/mac0267/Cortex/.claude/worktrees/bp2026-orcado-realizado`, branch `feature/bp2026-orcado-realizado` (PR #247). `server/routes/bp2026.ts` (~515 linhas) tem `somaDespesaCaixaPorMes`, `buildLinhas`, `DefLinha`, defs `LINHAS*`, notas, queries 2–4l e montagem 6–6j. Join de contraparte validado: `LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text` (99,96%). Campos: Bitrix `title`/`closer`; ClickUp cliente via `cup_clientes.task_id = h.id_task`. Default queryFn do client converte `["url", {params}]` em query string.

---

### Task 1: Extrair predicados compartilhados (refactor sem mudança de comportamento)

**Files:**
- Create: `server/routes/bp2026.predicados.ts`
- Modify: `server/routes/bp2026.ts`

- [ ] **Step 1: Capturar payload de referência.** Criar `bp2026-smoke.ts` na raiz (NÃO commitar; manter até o fim da Task 3):

```typescript
import "dotenv/config";
import express from "express";
import { registerBp2026Routes } from "./server/routes/bp2026";
import { db } from "./server/db";
import { writeFileSync } from "fs";
const app = express();
registerBp2026Routes(app, db);
const server = app.listen(3992, async () => {
  const res = await fetch("http://localhost:3992/api/bp2026/receitas");
  const json: any = await res.json();
  delete json.atualizadoEm;
  writeFileSync(process.argv[2] ?? "/tmp/bp2026-payload.json", JSON.stringify(json, null, 1));
  console.log("payload salvo, linhas:", json.linhas.length);
  server.close(); process.exit(0);
});
```

Run: `npx tsx ./bp2026-smoke.ts /tmp/bp2026-p6-antes.json` → 19 linhas.

- [ ] **Step 2: Criar `server/routes/bp2026.predicados.ts`** com TODOS os predicados de categoria hoje inline em `bp2026.ts` (copie-os EXATAMENTE do arquivo atual — leia antes; a lista abaixo reflete o estado pós-Parte 5b):

```typescript
// server/routes/bp2026.predicados.ts
// Única fonte de verdade dos predicados de categoria por métrica.
// Usados pela agregação (bp2026.ts) e pelo detalhe (bp2026.detalhe.ts) —
// célula e detalhamento não podem divergir.
import { sql, type SQL } from "drizzle-orm";

// Despesas em regime caixa (somaDespesaCaixaPorMes / detalhe por quitação)
export const PREDICADOS_DESPESA: Record<string, SQL> = {
  impostos_receita: sql`categoria_nome LIKE '05.05%' OR categoria_nome ILIKE 'Impostos retidos%'`,
  csv_salarios: sql`(categoria_nome LIKE '05.01%' AND categoria_nome NOT LIKE '05.01.10%') OR categoria_nome LIKE '05.02%'`,
  beneficio_total: sql`categoria_nome LIKE '06.10.04%'`,
  csv_stack: sql`categoria_nome LIKE '05.03%' OR categoria_nome LIKE '05.04.01%' OR categoria_nome LIKE '06.05.03%' OR categoria_nome LIKE '06.10.01%'`,
  cac: sql`categoria_nome LIKE '05.04.02%' OR categoria_nome LIKE '06.04%'
      OR categoria_nome LIKE '06.05.04%' OR categoria_nome LIKE '06.05.05%'
      OR categoria_nome LIKE '06.06%' OR categoria_nome LIKE '06.07%'`,
  sga_bucket: sql`categoria_nome LIKE '06.01%' OR categoria_nome LIKE '06.02%' OR categoria_nome LIKE '06.03%'
      OR categoria_nome LIKE '06.08%' OR categoria_nome LIKE '06.09%'
      OR categoria_nome LIKE '06.10.02%' OR categoria_nome LIKE '06.10.03%'
      OR categoria_nome LIKE '06.10.06%' OR categoria_nome LIKE '06.10.07%'
      OR categoria_nome LIKE '06.10.08%'`,
  bonus: sql`categoria_nome LIKE '05.01.10%'`,
  impostos_diretos: sql`categoria_nome LIKE '06.12%' OR categoria_nome LIKE '06.13%' OR categoria_nome LIKE '08.01%'`,
  capex: sql`categoria_nome LIKE '06.11%'`,
  estornos: sql`categoria_nome LIKE '05.06%'`,
};

// Receitas "outras" (por competência)
export const PREDICADO_OUTRAS_RECEITAS: SQL = sql`categoria_nome LIKE '03.02%' OR categoria_nome LIKE '03.03%'
      OR categoria_nome LIKE '04.01%' OR categoria_nome LIKE '04.03%'`;
```

ATENÇÃO: confira no `bp2026.ts` atual o predicado exato de cada bucket (ex.: o SG&A ganhou `06.01%` na Parte 5b) — o arquivo é a verdade, não esta lista.

- [ ] **Step 3: `bp2026.ts` importa e usa.** Substituir cada `sql\`...\`` inline das chamadas `somaDespesaCaixaPorMes` e da query de outras receitas pelos consts: `PREDICADOS_DESPESA.impostos_receita`, `.csv_salarios`, `.beneficio_total`, `.csv_stack`, `.cac`, `.sga_bucket`, `.bonus`, `.impostos_diretos`, `.capex`, `.estornos` e `PREDICADO_OUTRAS_RECEITAS` (a query de outras é inline com `db.execute` — interpolar `AND (${PREDICADO_OUTRAS_RECEITAS})`). Exportar também as defs para o detalhe usar: adicionar `export` em `DefLinha`, `LINHAS`, `LINHAS_DEDUCOES`, `LINHAS_CSV`, `LINHAS_OPEX`, `LINHAS_POS_EBITDA` (e em `Direcao`, que já é export).

- [ ] **Step 4: Verificar zero mudança**

```bash
npx tsc --noEmit -p . 2>&1 | grep -i bp2026   # vazio
npx tsx ./bp2026-smoke.ts /tmp/bp2026-p6-depois.json
diff /tmp/bp2026-p6-antes.json /tmp/bp2026-p6-depois.json && echo "IDÊNTICO"
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.predicados.ts server/routes/bp2026.ts
git commit -m "refactor(bp2026): predicados de categoria extraídos para módulo compartilhado"
```

---

### Task 2: Helper de agrupamento (TDD)

**Files:**
- Modify: `server/routes/bp2026.helpers.ts`
- Test: `server/routes/bp2026.helpers.test.ts`

- [ ] **Step 1: Testes (falhando)** — acrescentar ao test file (import `agruparItens` e tipos):

```typescript
describe("agruparItens", () => {
  const itens = [
    { grupo: "B", nome: "b1", detalhe: "", data: "2026-05-01", valor: 10 },
    { grupo: "A", nome: "a1", detalhe: "", data: "2026-05-02", valor: 100 },
    { grupo: "A", nome: "a2", detalhe: "", data: "2026-05-03", valor: 50 },
    { grupo: "A", nome: "a3", detalhe: "", data: "2026-05-04", valor: 1 },
  ];

  it("agrupa por grupo, ordena grupos por total desc e itens por valor desc", () => {
    const g = agruparItens(itens, 50);
    expect(g.map((x) => x.titulo)).toEqual(["A", "B"]);
    expect(g[0].total).toBe(151);
    expect(g[0].itens.map((i) => i.nome)).toEqual(["a1", "a2", "a3"]);
    expect(g[0].itensOmitidos).toBeUndefined();
  });

  it("corta no limite e agrega o excedente em itensOmitidos", () => {
    const g = agruparItens(itens, 2);
    expect(g[0].itens).toHaveLength(2);
    expect(g[0].itensOmitidos).toEqual({ qtd: 1, valor: 1 });
    expect(g[0].total).toBe(151); // total inclui omitidos
  });

  it("lista vazia retorna []", () => {
    expect(agruparItens([], 50)).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npx vitest run server/routes/bp2026.helpers.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — ao final de `bp2026.helpers.ts`:

```typescript
export interface ItemDetalhe {
  grupo: string;
  nome: string;
  detalhe: string;
  data: string | null;
  valor: number;
}

export interface GrupoDetalhe {
  titulo: string;
  total: number;
  itens: Array<Omit<ItemDetalhe, "grupo">>;
  itensOmitidos?: { qtd: number; valor: number };
}

// Agrupa itens por `grupo`, ordena grupos por total desc e itens por valor desc;
// corta cada grupo em `limite` itens, agregando o excedente em itensOmitidos.
export function agruparItens(itens: ItemDetalhe[], limite: number): GrupoDetalhe[] {
  const porGrupo = new Map<string, ItemDetalhe[]>();
  for (const item of itens) {
    const lista = porGrupo.get(item.grupo) ?? [];
    lista.push(item);
    porGrupo.set(item.grupo, lista);
  }
  const grupos: GrupoDetalhe[] = [];
  for (const [titulo, lista] of porGrupo) {
    lista.sort((a, b) => b.valor - a.valor);
    const total = lista.reduce((s, i) => s + i.valor, 0);
    const visiveis = lista.slice(0, limite);
    const omitidos = lista.slice(limite);
    grupos.push({
      titulo,
      total,
      itens: visiveis.map(({ grupo: _g, ...resto }) => resto),
      ...(omitidos.length
        ? { itensOmitidos: { qtd: omitidos.length, valor: omitidos.reduce((s, i) => s + i.valor, 0) } }
        : {}),
    });
  }
  grupos.sort((a, b) => b.total - a.total);
  return grupos;
}
```

- [ ] **Step 4:** vitest → PASS (14 testes: 11 + 3).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.helpers.ts server/routes/bp2026.helpers.test.ts
git commit -m "feat(bp2026): helper agruparItens com corte e itensOmitidos"
```

---

### Task 3: Endpoint GET /api/bp2026/detalhe

**Files:**
- Create: `server/routes/bp2026.detalhe.ts`
- Modify: `server/routes.ts` (registro junto do existente)

- [ ] **Step 1: Implementar a rota.** Código completo:

```typescript
// server/routes/bp2026.detalhe.ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { agruparItens, ratear, type ItemDetalhe } from "./bp2026.helpers";
import { PREDICADOS_DESPESA, PREDICADO_OUTRAS_RECEITAS } from "./bp2026.predicados";
import {
  LINHAS, LINHAS_DEDUCOES, LINHAS_CSV, LINHAS_OPEX, LINHAS_POS_EBITDA,
  type DefLinha,
} from "./bp2026";

const ANO = 2026;
const LIMITE_ITENS = 50;
const LIMITE_ITENS_DFC = 10;

// métricas de despesa cujo detalhe é o bucket puro (parcelas por quitação, grupos por categoria)
const METRICAS_BUCKET: Record<string, keyof typeof PREDICADOS_DESPESA> = {
  impostos_receita: "impostos_receita",
  csv_salarios: "csv_salarios",
  csv_stack: "csv_stack",
  cac: "cac",
  bonus: "bonus",
  impostos_diretos: "impostos_diretos",
  capex: "capex",
};

const TODAS_DEFS: DefLinha[] = [
  ...LINHAS, ...LINHAS_DEDUCOES, ...LINHAS_CSV, ...LINHAS_OPEX, ...LINHAS_POS_EBITDA,
  { metrica: "dfc_real", titulo: "(=) Fluxo de Caixa (DFC)", tipoAgregacao: "fluxo", direcao: "maior_melhor" },
];

function normalizaCategoria(c: string | null): string {
  return (c ?? "(sem categoria)").trim().replace(/\s+/g, " ");
}

async function itensDespesaBucket(
  db: any, predicado: ReturnType<typeof sql>, mes: number
): Promise<ItemDetalhe[]> {
  const result = await db.execute(sql`
    SELECT p.categoria_nome, COALESCE(NULLIF(TRIM(c.nome), ''), p.descricao, '(sem identificação)') AS nome,
           COALESCE(p.descricao, '') AS descricao,
           p.data_quitacao::text AS data,
           COALESCE(p.valor_pago::numeric, 0) AS valor
    FROM "Conta Azul".caz_parcelas p
    LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
    WHERE p.tipo_evento = 'DESPESA' AND p.status = 'QUITADO'
      AND EXTRACT(YEAR FROM p.data_quitacao) = ${ANO}
      AND EXTRACT(MONTH FROM p.data_quitacao) = ${mes}
      AND (${predicado})
    ORDER BY valor DESC
  `);
  return (result.rows as any[]).map((r) => ({
    grupo: normalizaCategoria(r.categoria_nome),
    nome: r.nome,
    detalhe: r.descricao,
    data: r.data,
    valor: parseFloat(r.valor),
  }));
}

export function registerBp2026DetalheRoutes(app: Express, db: any) {
  app.get("/api/bp2026/detalhe", async (req, res) => {
    try {
      const metrica = String(req.query.metrica ?? "");
      const mes = Number(req.query.mes);
      const def = TODAS_DEFS.find((d) => d.metrica === metrica);
      const DERIVADAS = ["receita_total_faturavel", "receita_liquida", "margem_bruta", "ebitda", "geracao_caixa"];
      if (!def || DERIVADAS.includes(metrica) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ error: "metrica/mes inválidos" });
      }

      // orçado do mês (derivadas não chegam aqui; dfc_real usa o orçado da geração, que não é persistido — fica null)
      let orcado: number | null = null;
      const orcRes = await db.execute(sql`
        SELECT valor::numeric AS valor FROM cortex_core.bp2026_orcado
        WHERE metrica = ${metrica} AND mes = ${mes}
      `);
      if (orcRes.rows.length) orcado = parseFloat((orcRes.rows[0] as any).valor);

      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const mesCorrente = anoAtual > ANO ? 12 : anoAtual < ANO ? 0 : agora.getMonth() + 1;
      if (mes > mesCorrente) {
        return res.json({ metrica, mes, titulo: def.titulo, orcado, realizado: null, grupos: [], nota: def.nota });
      }

      let grupos = [] as ReturnType<typeof agruparItens>;
      let realizado = 0;
      let rateio: { fracao: number; totalBruto: number; totalRateado: number } | undefined;

      if (metrica in METRICAS_BUCKET) {
        const itens = await itensDespesaBucket(db, PREDICADOS_DESPESA[METRICAS_BUCKET[metrica]], mes);
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "mrr_ativo") {
        const result = await db.execute(sql`
          WITH alvo AS (
            SELECT MAX(data_snapshot::date) AS d FROM "Clickup".cup_data_hist
            WHERE data_snapshot::date >= make_date(${ANO}, ${mes}, 1)
              AND data_snapshot::date < (make_date(${ANO}, ${mes}, 1) + INTERVAL '1 month')
          )
          SELECT COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
                 COALESCE(h.servico, '') AS servico,
                 COALESCE(NULLIF(TRIM(h.squad), ''), '(sem squad)') AS squad,
                 COALESCE(h.valorr::numeric, 0) AS valor
          FROM "Clickup".cup_data_hist h
          JOIN alvo a ON h.data_snapshot::date = a.d
          LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
          ORDER BY valor DESC
        `);
        const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
          grupo: r.squad, nome: r.cliente, detalhe: r.servico, data: null, valor: parseFloat(r.valor),
        }));
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "receita_pontual") {
        const result = await db.execute(sql`
          SELECT COALESCE(title, '(sem título)') AS nome, COALESCE(closer::text, '') AS closer,
                 data_fechamento::date::text AS data, valor_pontual::numeric AS valor
          FROM "Bitrix".crm_deal
          WHERE stage_name = 'Negócio Ganho' AND valor_pontual > 0
            AND EXTRACT(YEAR FROM data_fechamento) = ${ANO}
            AND EXTRACT(MONTH FROM data_fechamento) = ${mes}
          ORDER BY valor DESC
        `);
        const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
          grupo: "Vendas pontuais (Bitrix)", nome: r.nome, detalhe: r.closer ? `closer ${r.closer}` : "",
          data: r.data, valor: parseFloat(r.valor),
        }));
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "outras_receitas") {
        const result = await db.execute(sql`
          SELECT p.categoria_nome, COALESCE(NULLIF(TRIM(c.nome), ''), p.descricao, '(sem identificação)') AS nome,
                 COALESCE(p.descricao, '') AS descricao, p.data_competencia::text AS data,
                 COALESCE(p.valor_liquido::numeric, 0) AS valor
          FROM "Conta Azul".caz_parcelas p
          LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
          WHERE p.tipo_evento = 'RECEITA'
            AND EXTRACT(YEAR FROM p.data_competencia) = ${ANO}
            AND EXTRACT(MONTH FROM p.data_competencia) = ${mes}
            AND (${PREDICADO_OUTRAS_RECEITAS})
          ORDER BY valor DESC
        `);
        const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
          grupo: normalizaCategoria(r.categoria_nome), nome: r.nome, detalhe: r.descricao, data: r.data, valor: parseFloat(r.valor),
        }));
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "inadimplencia") {
        const vencidas = await db.execute(sql`
          SELECT COALESCE(NULLIF(TRIM(c.nome), ''), p.descricao, '(sem identificação)') AS nome,
                 COALESCE(p.descricao, '') AS descricao, p.data_vencimento::text AS data,
                 COALESCE(p.nao_pago::numeric, 0) AS valor
          FROM "Conta Azul".caz_parcelas p
          LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
          WHERE p.tipo_evento = 'RECEITA' AND p.nao_pago::numeric > 0
            AND p.data_vencimento <= CURRENT_DATE
            AND EXTRACT(YEAR FROM p.data_vencimento) = ${ANO}
            AND EXTRACT(MONTH FROM p.data_vencimento) = ${mes}
          ORDER BY valor DESC
        `);
        const itensVencidas: ItemDetalhe[] = (vencidas.rows as any[]).map((r) => ({
          grupo: "Vencidas não pagas (foto atual)", nome: r.nome, detalhe: r.descricao, data: r.data, valor: parseFloat(r.valor),
        }));
        const itensEstornos = await itensDespesaBucket(db, PREDICADOS_DESPESA.estornos, mes);
        const todos = [...itensVencidas, ...itensEstornos.map((i) => ({ ...i, grupo: "Estornos e devoluções" }))];
        grupos = agruparItens(todos, LIMITE_ITENS);
        realizado = todos.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "csv_beneficio" || metrica === "sga") {
        const orcRateio = await db.execute(sql`
          SELECT metrica, valor::numeric AS valor FROM cortex_core.bp2026_orcado
          WHERE mes = ${mes} AND metrica IN ('csv_beneficio', 'beneficio_total_empresa')
        `);
        const orcMap: Record<string, number> = {};
        for (const r of orcRateio.rows as any[]) orcMap[r.metrica] = parseFloat(r.valor);
        const itensCaju = await itensDespesaBucket(db, PREDICADOS_DESPESA.beneficio_total, mes);
        const totalBruto = itensCaju.reduce((s, i) => s + i.valor, 0);
        if (metrica === "csv_beneficio") {
          const fracao = orcMap["beneficio_total_empresa"] ? orcMap["csv_beneficio"] / orcMap["beneficio_total_empresa"] : 0;
          grupos = agruparItens(itensCaju, LIMITE_ITENS);
          realizado = ratear(totalBruto, orcMap["csv_beneficio"] ?? 0, orcMap["beneficio_total_empresa"] ?? 0) ?? 0;
          rateio = { fracao, totalBruto, totalRateado: realizado };
        } else {
          const itensBucket = await itensDespesaBucket(db, PREDICADOS_DESPESA.sga_bucket, mes);
          const complemento = ratear(
            totalBruto,
            (orcMap["beneficio_total_empresa"] ?? 0) - (orcMap["csv_beneficio"] ?? 0),
            orcMap["beneficio_total_empresa"] ?? 0
          ) ?? 0;
          const todos: ItemDetalhe[] = [
            ...itensBucket,
            { grupo: "Complemento do benefício (rateio)", nome: "Caju — parcela não atribuída ao CSV",
              detalhe: "benefício total × fração orçada do SG&A", data: null, valor: complemento },
          ];
          grupos = agruparItens(todos, LIMITE_ITENS);
          realizado = todos.reduce((s, i) => s + i.valor, 0);
        }
      } else if (metrica === "dfc_real") {
        const result = await db.execute(sql`
          SELECT p.tipo_evento, p.categoria_nome,
                 COALESCE(NULLIF(TRIM(c.nome), ''), p.descricao, '(sem identificação)') AS nome,
                 COALESCE(p.descricao, '') AS descricao, p.data_quitacao::text AS data,
                 COALESCE(p.valor_pago::numeric, 0) AS valor
          FROM "Conta Azul".caz_parcelas p
          LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
          WHERE p.status = 'QUITADO'
            AND EXTRACT(YEAR FROM p.data_quitacao) = ${ANO}
            AND EXTRACT(MONTH FROM p.data_quitacao) = ${mes}
          ORDER BY valor DESC
        `);
        const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
          grupo: `${r.tipo_evento === "RECEITA" ? "(+)" : "(−)"} ${normalizaCategoria(r.categoria_nome)}`,
          nome: r.nome, detalhe: r.descricao, data: r.data,
          valor: parseFloat(r.valor),
        }));
        grupos = agruparItens(itens, LIMITE_ITENS_DFC);
        // entradas primeiro
        grupos.sort((a, b) => (a.titulo.startsWith("(+)") === b.titulo.startsWith("(+)") ? b.total - a.total : a.titulo.startsWith("(+)") ? -1 : 1));
        const entradas = itens.filter((i) => i.grupo.startsWith("(+)")).reduce((s, i) => s + i.valor, 0);
        const saidas = itens.filter((i) => i.grupo.startsWith("(−)")).reduce((s, i) => s + i.valor, 0);
        realizado = entradas - saidas;
      } else {
        return res.status(400).json({ error: "metrica/mes inválidos" });
      }

      res.json({ metrica, mes, titulo: def.titulo, orcado, realizado, grupos, rateio, nota: def.nota });
    } catch (error) {
      console.error("[bp2026] Erro em /api/bp2026/detalhe:", error);
      res.status(500).json({ error: "Erro ao montar detalhamento" });
    }
  });
}
```

- [ ] **Step 2: Registrar** — em `server/routes.ts`, import `registerBp2026DetalheRoutes` junto do `registerBp2026Routes` e invocar logo após `registerBp2026Routes(app, db);`.

- [ ] **Step 3: Smoke do detalhe** — criar `bp2026-detalhe-smoke.ts` na raiz (rodar e DELETAR antes do commit):

```typescript
import "dotenv/config";
import express from "express";
import { registerBp2026Routes } from "./server/routes/bp2026";
import { registerBp2026DetalheRoutes } from "./server/routes/bp2026.detalhe";
import { db } from "./server/db";
const app = express();
registerBp2026Routes(app, db);
registerBp2026DetalheRoutes(app, db);
const server = app.listen(3986, async () => {
  const matriz: any = await (await fetch("http://localhost:3986/api/bp2026/receitas")).json();
  const cel = (m: string, mes: number) => matriz.linhas.find((l: any) => l.metrica === m).meses[mes - 1].realizado;
  for (const [m, mes] of [["csv_salarios", 5], ["inadimplencia", 5], ["mrr_ativo", 5], ["receita_pontual", 5], ["csv_beneficio", 5], ["sga", 5], ["dfc_real", 5]] as const) {
    const d: any = await (await fetch(`http://localhost:3986/api/bp2026/detalhe?metrica=${m}&mes=${mes}`)).json();
    const somaGrupos = d.grupos.reduce((s: number, g: any) => s + g.total, 0);
    const esperado = cel(m, mes);
    const ok = m === "csv_beneficio"
      ? Math.abs(d.rateio.totalRateado - esperado) < 1
      : m === "dfc_real"
        ? Math.abs(d.realizado - esperado) < 1
        : Math.abs(somaGrupos - esperado) < 1;
    console.log(m, "grupos:", d.grupos.length, "somaGrupos:", Math.round(somaGrupos), "celula:", Math.round(esperado), ok ? "OK" : "DIVERGE!");
  }
  const inv: any = await (await fetch("http://localhost:3986/api/bp2026/detalhe?metrica=ebitda&mes=5")).json();
  console.log("derivada => 400?", inv.error ? "OK" : "FALHOU");
  const fut: any = await (await fetch("http://localhost:3986/api/bp2026/detalhe?metrica=cac&mes=11")).json();
  console.log("futuro => grupos vazios?", fut.grupos.length === 0 && fut.realizado === null ? "OK" : "FALHOU");
  server.close(); process.exit(0);
});
```

Expected: TODOS "OK" (invariante soma dos grupos = célula; para dfc_real o realizado entradas−saídas = célula; para csv_beneficio o totalRateado = célula). `npx tsc --noEmit -p . 2>&1 | grep -i bp2026` vazio; vitest 14/14. DELETAR os DOIS smokes (`bp2026-smoke.ts` e `bp2026-detalhe-smoke.ts`).

- [ ] **Step 4: Commit**

```bash
git add server/routes/bp2026.detalhe.ts server/routes.ts
git commit -m "feat(bp2026): endpoint de detalhe por célula com invariante grupo-soma"
```

---

### Task 4: Frontend — drawer e células clicáveis

**Files:**
- Create: `client/src/components/bp2026/BPCellDetail.tsx`
- Modify: `client/src/components/bp2026/BPDreTable.tsx`
- Modify: `client/src/pages/BP2026.tsx`

- [ ] **Step 1: Verificar componentes ui.** Confirmar que existem `client/src/components/ui/sheet.tsx` e `collapsible.tsx` (shadcn). Se `collapsible` não existir, usar `<details>` estilizado. Se `sheet` não existir, reporte BLOCKED.

- [ ] **Step 2: BPCellDetail** — código completo:

```tsx
// client/src/components/bp2026/BPCellDetail.tsx
import { useQuery } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { BPLinha } from "./BPDreTable";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const DERIVADAS: Record<string, string[]> = {
  receita_total_faturavel: ["mrr_ativo", "receita_pontual", "outras_receitas"],
  receita_liquida: ["receita_total_faturavel", "inadimplencia", "impostos_receita"],
  margem_bruta: ["receita_liquida", "csv_salarios", "csv_beneficio", "csv_stack"],
  ebitda: ["margem_bruta", "cac", "sga", "bonus"],
  geracao_caixa: ["ebitda", "impostos_diretos", "capex"],
};

interface ItemDet { nome: string; detalhe: string; data: string | null; valor: number }
interface GrupoDet { titulo: string; total: number; itens: ItemDet[]; itensOmitidos?: { qtd: number; valor: number } }
interface DetalheResponse {
  metrica: string; mes: number; titulo: string;
  orcado: number | null; realizado: number | null;
  grupos: GrupoDet[];
  rateio?: { fracao: number; totalBruto: number; totalRateado: number };
  nota?: string;
}

function fmt(v: number | null): string {
  return v === null ? "—" : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

interface Props {
  metrica: string | null;
  mes: number | null;
  linhas: BPLinha[];
  onClose: () => void;
}

export function BPCellDetail({ metrica, mes, linhas, onClose }: Props) {
  const aberto = metrica !== null && mes !== null;
  const ehDerivada = metrica !== null && metrica in DERIVADAS;

  const { data, isLoading, error } = useQuery<DetalheResponse>({
    queryKey: ["/api/bp2026/detalhe", { metrica: metrica ?? "", mes: String(mes ?? "") }],
    enabled: aberto && !ehDerivada,
  });

  const linha = linhas.find((l) => l.metrica === metrica);
  const celula = linha && mes ? linha.meses[mes - 1] : null;

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            {linha?.titulo} · {mes ? MESES[mes - 1] : ""} 2026
          </SheetTitle>
          <SheetDescription className="text-gray-600 dark:text-zinc-400">
            Orçado {fmt(celula?.orcado ?? null)} · Realizado {fmt(celula?.realizado ?? null)}
            {celula?.atingimento != null && ` · ${(celula.atingimento * 100).toFixed(1)}%`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {ehDerivada && linha && mes ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2">
                Composição do mês (clique nas linhas-fonte da matriz para ver itens):
              </p>
              {DERIVADAS[metrica!].map((m) => {
                const comp = linhas.find((l) => l.metrica === m);
                const cm = comp?.meses[mes - 1];
                return (
                  <div key={m} className="flex items-center justify-between rounded border border-gray-100 dark:border-zinc-800 px-3 py-2 text-sm">
                    <span className="text-gray-800 dark:text-zinc-200">{comp?.titulo}</span>
                    <span className="tabular-nums text-gray-900 dark:text-white">{fmt(cm?.realizado ?? null)}</span>
                  </div>
                );
              })}
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error || !data ? (
            <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar o detalhamento.</p>
          ) : data.grupos.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-500">Sem itens neste mês.</p>
          ) : (
            <>
              {data.grupos.map((g) => (
                <details key={g.titulo} open={data.grupos.length <= 3} className="rounded-lg border border-gray-200 dark:border-zinc-700">
                  <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <span>{g.titulo}</span>
                    <span className="tabular-nums">{fmt(g.total)}</span>
                  </summary>
                  <div className="border-t border-gray-100 dark:border-zinc-800">
                    {g.itens.map((it, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 px-3 py-1.5 text-xs border-b border-gray-50 dark:border-zinc-800/50 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-gray-800 dark:text-zinc-200">{it.nome}</p>
                          {(it.detalhe || it.data) && (
                            <p className="truncate text-gray-500 dark:text-zinc-500">
                              {[it.detalhe, it.data].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{fmt(it.valor)}</span>
                      </div>
                    ))}
                    {g.itensOmitidos && (
                      <p className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-500">
                        +{g.itensOmitidos.qtd} itens ({fmt(g.itensOmitidos.valor)})
                      </p>
                    )}
                  </div>
                </details>
              ))}
              {data.rateio && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  Caju total {fmt(data.rateio.totalBruto)} × fração orçada {(data.rateio.fracao * 100).toFixed(1)}% =
                  <strong> {fmt(data.rateio.totalRateado)}</strong> (valor da célula)
                </div>
              )}
              {data.nota && (
                <p className="text-xs text-gray-500 dark:text-zinc-500">{data.nota}</p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Células clicáveis** — em `BPDreTable.tsx`:
  - `Props` ganha `onCellClick: (metrica: string, mes: number) => void`.
  - No `<td>` dos meses (não no YTD), quando `m.realizado !== null`, adicionar `onClick={() => onCellClick(linha.metrica, m.mes)}` e classes `cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/70` (mantendo as existentes); quando null, sem onClick.
- [ ] **Step 4: Página** — `BP2026.tsx`: estado `const [detalhe, setDetalhe] = useState<{ metrica: string; mes: number } | null>(null);` (importar useState); passar `onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}` à tabela; renderizar `<BPCellDetail metrica={detalhe?.metrica ?? null} mes={detalhe?.mes ?? null} linhas={data.linhas} onClose={() => setDetalhe(null)} />` após a tabela.
- [ ] **Step 5: Verificar** — `npx tsc --noEmit -p . 2>&1 | grep -iE "bp2026|BP2026|BPCell"` vazio; reiniciar dev server; `curl -s -o /dev/null -w "%{http_code}" localhost:3000/bp-2026` → 200. Validação visual do controller na sequência (clicar células de salários/MRR/benefício/derivada/DFC, dark+light).
- [ ] **Step 6: Commit**

```bash
git add client/src/components/bp2026/BPCellDetail.tsx client/src/components/bp2026/BPDreTable.tsx client/src/pages/BP2026.tsx
git commit -m "feat(bp2026): drawer de detalhe por célula com grupos e composição de derivadas"
```

---

### Task 5: Verificação final

- [ ] **Step 1:** `npx vitest run` — 14 bp2026 verdes; 2 suites pré-existentes ignoradas.
- [ ] **Step 2:** Review final do diff da parte (`git log --oneline` desde o spec) + push.
- [ ] **Step 3:** Atualizar PR #247 via REST com a seção Parte 6.
