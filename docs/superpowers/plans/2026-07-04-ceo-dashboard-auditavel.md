# CEO Dashboard — Células Auditáveis (drill-down) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada card do CEO Dashboard vira clicável e abre um painel lateral (Sheet) com a composição do número e as linhas brutas por trás dele — igual ao drill do BP 2026.

**Architecture:** Extrai-se o corpo da rota `/api/bp2026/detalhe` numa função exportada `montarDetalheBp` (a rota do BP vira wrapper fino, comportamento inalterado). Um novo endpoint `GET /api/ceo-dashboard/detalhe` (guard `canAccessCeo`) roteia por KPI: os 7 do BP reusam `montarDetalheBp` por métrica-componente; Saldo/Inadimplência/LTV/E-NPS usam fontes próprias. O frontend ganha um `CeoKpiDetail` (Sheet, clone enxuto do `BPCellDetail`) e cards clicáveis.

**Tech Stack:** TypeScript, Express, Drizzle (`sql`), React + React Query, shadcn `Sheet`, Tailwind (dark/light), Vitest.

## Global Constraints

- **Fonte única:** o drill dos KPIs do BP (Receita, Custos, Lucro, CAC, Headcount, Receita/Cabeça) usa `montarDetalheBp` — mesma fonte do BP, drill idêntico.
- **Acesso:** só admin/CONTROL_TOWER, via `canAccessCeo(req.user)` → 403 (NÃO usa o gate por-aba do BP).
- **Refactor do BP sem mudança de comportamento:** `montarDetalheBp` recebe o corpo pós-gate da rota, verbatim; a rota mantém o gate e passa a chamar a função.
- **Forma de resposta:** reusa `ItemDetalhe`/`GrupoDetalhe` de `server/routes/bp2026.helpers.ts`. Grupo do CEO estende com `sinal?: "+"|"-"` e `formato: "brl"|"num"`.
- **Dark/light obrigatório**; nunca hardcodar cor sem variante `dark:`.
- **Card `em_breve` não é clicável** (NPS de clientes).
- **Testes:** Vitest (`npx vitest run <arquivo>`). Co-author: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- **`LIMITE_ITENS = 50`** por grupo (mesmo do BP).

---

### Task 1: Extrair `montarDetalheBp` da rota do BP (refactor mecânico)

**Files:**
- Modify: `server/routes/bp2026.detalhe.ts`

**Interfaces:**
- Produces: `export async function montarDetalheBp(db, opts: { metrica: string; mes: number; segmento?: string }): Promise<DetalheBpResult>` e `export interface DetalheBpResult`.

- [ ] **Step 1: Localizar as fronteiras da extração**

Abra `server/routes/bp2026.detalhe.ts`. A rota é `app.get("/api/bp2026/detalhe", async (req, res) => { ... })`. Dentro dela:
- O **gate** (permanece na rota): leitura de `metrica/mes/aba/segmento` da query, `abasPermitidas(...)` → 403, `metricaPertenceAAba(...)` → 400, validações de `metrica/mes` → 400.
- A partir do ponto após o gate — onde começam `const titulo = ...`, `let orcado`, `const mesCorrente = ...`, `if (mes > mesCorrente) return res.json(...)`, `let grupos: GrupoDetalhe[] = []`, o grande `if/else`, e termina em `res.json({ metrica, mes, titulo, orcado, realizado, grupos, rateio, nota, notaDinamica })` — é o **corpo a extrair**.

Use grep para achar as âncoras exatas:
```
grep -n 'res.status(400).json({ error: "metrica/mes inválidos" })\|let grupos: GrupoDetalhe\|res.json({ metrica, mes, titulo' server/routes/bp2026.detalhe.ts
```

- [ ] **Step 2: Criar a função e o tipo de retorno**

Antes da função `registerBp2026DetalheRoutes`, adicione o tipo e a assinatura:

```ts
export interface DetalheBpResult {
  metrica: string;
  mes: number;
  titulo: string;
  orcado: number | null;
  realizado: number | null;
  grupos: GrupoDetalhe[];
  rateio?: { fracao: number; totalBruto: number; totalRateado: number };
  nota?: string;
  notaDinamica?: string;
}

export async function montarDetalheBp(
  db: any,
  opts: { metrica: string; mes: number; segmento?: string }
): Promise<DetalheBpResult> {
  const { metrica, mes, segmento } = opts;
  // <MOVER PARA CÁ, VERBATIM, todo o corpo pós-gate da rota:>
  //   const titulo = ...; let orcado = ...; ... o if/else que monta `grupos`,
  //   `realizado`, `rateio`, `notaDinamica` ...
  // Substituir os dois retornos que hoje são `res.json(...)` por `return {...}`:
  //   - mês futuro: return { metrica, mes, titulo, orcado, realizado: null, grupos: [], nota: def?.nota };
  //   - final:      return { metrica, mes, titulo, orcado, realizado, grupos, rateio, nota: def?.nota, notaDinamica };
  //   - o `return res.status(400).json(...)` interno (metrica desconhecida) vira `throw new Error("metrica/mes inválidos")`.
}
```

Regras da mudança:
- Mover o corpo **sem alterar a lógica**. Onde o corpo lia `req.query` (metrica/mes/segmento), passar a usar os parâmetros `opts`.
- Trocar cada `res.json({...})` por `return {...}` (mesmos campos).
- O único `res.status(400)` que sobrava DENTRO do corpo (métrica desconhecida) vira `throw new Error("metrica/mes inválidos")` — a rota captura no try/catch e responde 400.

- [ ] **Step 3: Reescrever a rota como wrapper fino**

A rota mantém o gate; após o gate, chama a função:

```ts
  app.get("/api/bp2026/detalhe", async (req, res) => {
    try {
      const metrica = String(req.query.metrica ?? "");
      const mes = parseInt(String(req.query.mes ?? ""), 10);
      const aba = String(req.query.aba ?? "");
      const segmento = req.query.segmento ? String(req.query.segmento) : undefined;
      // --- GATE (inalterado): abasPermitidas -> 403; metricaPertenceAAba -> 400;
      //     validação metrica/mes -> 400 ---
      const user = req.user as any;
      const minhasAbas = abasPermitidas(user?.role, user?.allowedBpTabs);
      if (!minhasAbas.includes(aba)) return res.status(403).json({ error: "Sem acesso a esta aba" });
      if (!metricaPertenceAAba(metrica, aba)) return res.status(400).json({ error: "métrica não pertence à aba" });
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) return res.status(400).json({ error: "metrica/mes inválidos" });
      // (manter aqui as demais checagens de "métrica conhecida" que já existiam no gate)

      const result = await montarDetalheBp(db, { metrica, mes, segmento });
      res.json(result);
    } catch (e) {
      console.error("[api] Error /api/bp2026/detalhe:", e);
      res.status(400).json({ error: "metrica/mes inválidos" });
    }
  });
```

(Preservar exatamente as checagens de gate que já existiam — copie-as do código atual; o exemplo acima é o esqueleto.)

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem NOVOS erros referenciando `bp2026.detalhe.ts`.

- [ ] **Step 5: Verificação de comportamento (caracterização via BP no browser — feita na Task 5)**

Este é refactor puro; a garantia é "saída do BP inalterada". A verificação funcional (abrir `/bp-2026`, clicar numa célula de CAC/Custos e conferir que o drawer ainda funciona) é feita na Task 5. Aqui, só `tsc`.

- [ ] **Step 6: Commit**

```bash
git add server/routes/bp2026.detalhe.ts
git commit -m "refactor(bp2026): extrai montarDetalheBp da rota /detalhe (comportamento inalterado)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Helpers puros do detalhe do CEO + mover `parseMesNum`

**Files:**
- Create: `server/routes/ceoDashboard.detalhe.helpers.ts`
- Test: `server/routes/ceoDashboard.detalhe.helpers.test.ts`
- Modify: `server/routes/ceoDashboard.helpers.ts` (adicionar `parseMesNum`)
- Modify: `server/routes/ceoDashboard.ts` (importar `parseMesNum` do helpers)

**Interfaces:**
- Consumes: `agruparItens`, `ItemDetalhe`, `GrupoDetalhe` de `./bp2026.helpers`; `DetalheBpResult` de `./bp2026.detalhe` (Task 1).
- Produces: `CeoGrupo`, `CeoDetalheResponse`, `LIMITE_ITENS`, `KPI_COMPONENTES`, `achatarComponente`, `mapDetalheBpGrupos`, `bancosToGrupo`, `inadClientesToGrupos`, `enpsRespostasToGrupos`, `ltvRowsToGrupos`, `grupoMargemBruta`, `receitaCabecaGrupos`, `formatBRL`; e `parseMesNum` em `ceoDashboard.helpers.ts`.

- [ ] **Step 1: Mover `parseMesNum` para `ceoDashboard.helpers.ts`**

Em `server/routes/ceoDashboard.helpers.ts`, adicionar (export):

```ts
// "2026-06" -> 6. BP é fixo em ANO=2026; fora disso cai no mês corrente informado.
export function parseMesNum(mes: string | undefined, mesCorrente: number): number {
  if (!mes) return mesCorrente;
  const m = /^2026-(\d{2})$/.exec(mes);
  if (!m) return mesCorrente;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 12 ? n : mesCorrente;
}
```

Em `server/routes/ceoDashboard.ts`, remover a função local `parseMesNum` e passar a importá-la:
`import { assembleCeoKpis, canAccessCeo, parseMesNum, type CeoDashboardResponse } from "./ceoDashboard.helpers";`

- [ ] **Step 2: Escrever o teste dos helpers**

Create `server/routes/ceoDashboard.detalhe.helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  achatarComponente, mapDetalheBpGrupos, bancosToGrupo, inadClientesToGrupos,
  enpsRespostasToGrupos, ltvRowsToGrupos, receitaCabecaGrupos, KPI_COMPONENTES,
} from "./ceoDashboard.detalhe.helpers";
import type { DetalheBpResult } from "./bp2026.detalhe";

const det = (over: Partial<DetalheBpResult> = {}): DetalheBpResult => ({
  metrica: "cac", mes: 6, titulo: "CAC", orcado: 100, realizado: 80,
  grupos: [
    { titulo: "Vendas", total: 50, itens: [{ nome: "A", detalhe: "", data: null, valor: 30 }, { nome: "B", detalhe: "", data: null, valor: 20 }] },
    { titulo: "Ads", total: 30, itens: [{ nome: "C", detalhe: "", data: null, valor: 30 }] },
  ],
  ...over,
});

describe("achatarComponente", () => {
  it("junta todos os itens num grupo só, total = realizado, com sinal/formato", () => {
    const g = achatarComponente(det(), { titulo: "CAC", sinal: "-", formato: "brl" });
    expect(g.titulo).toBe("CAC");
    expect(g.total).toBe(80);           // realizado
    expect(g.sinal).toBe("-");
    expect(g.formato).toBe("brl");
    expect(g.itens.map((i) => i.nome).sort()).toEqual(["A", "B", "C"]); // achatado
  });
  it("total cai para soma dos grupos quando realizado é null", () => {
    const g = achatarComponente(det({ realizado: null }), { formato: "brl" });
    expect(g.total).toBe(80); // 50 + 30
  });
});

describe("mapDetalheBpGrupos", () => {
  it("preserva os grupos do BP, aplicando formato/sinal", () => {
    const gs = mapDetalheBpGrupos(det(), { formato: "num" });
    expect(gs.map((g) => g.titulo)).toEqual(["Vendas", "Ads"]);
    expect(gs.every((g) => g.formato === "num")).toBe(true);
  });
});

describe("bancosToGrupo", () => {
  it("um grupo com uma linha por conta, total = soma", () => {
    const g = bancosToGrupo([
      { nmbanco: "Itaú", empresa: "Partners", balance: 100 },
      { nmbanco: "BB", empresa: "Filial", balance: 50 },
    ]);
    expect(g.total).toBe(150);
    expect(g.formato).toBe("brl");
    expect(g.itens[0].nome).toContain("Itaú");
  });
});

describe("inadClientesToGrupos", () => {
  it("um grupo de clientes, item por cliente", () => {
    const gs = inadClientesToGrupos([
      { idCliente: "1", nomeCliente: "Cliente X", valorTotal: 500, quantidadeParcelas: 2 },
    ]);
    expect(gs[0].itens[0].nome).toBe("Cliente X");
    expect(gs[0].itens[0].valor).toBe(500);
    expect(gs[0].formato).toBe("brl");
  });
});

describe("enpsRespostasToGrupos", () => {
  it("classifica em Promotores(>=9)/Neutros(7-8)/Detratores(<=6), formato num", () => {
    const gs = enpsRespostasToGrupos([
      { area: "Growth", scoreEmpresa: 10, comentarioEmpresa: "ótimo" },
      { area: "Ops", scoreEmpresa: 7, comentarioEmpresa: null },
      { area: "CX", scoreEmpresa: 3, comentarioEmpresa: "ruim" },
      { area: null, scoreEmpresa: null, comentarioEmpresa: null }, // ignorado
    ]);
    expect(gs.map((g) => g.titulo)).toEqual(["Promotores", "Neutros", "Detratores"]);
    expect(gs.every((g) => g.formato === "num")).toBe(true);
    expect(gs[0].itens[0].detalhe).toContain("nota 10");
  });
});

describe("ltvRowsToGrupos", () => {
  it("um grupo de clientes por LTV, formato brl", () => {
    const gs = ltvRowsToGrupos([{ nome: "Cliente Y", ltv_total: 28000 }]);
    expect(gs[0].itens[0].valor).toBe(28000);
    expect(gs[0].formato).toBe("brl");
  });
});

describe("receitaCabecaGrupos", () => {
  it("dois grupos só-valor (Receita brl, Headcount num) + nota da fórmula", () => {
    const r = receitaCabecaGrupos(1938555, 140);
    expect(r.grupos.map((g) => g.formato)).toEqual(["brl", "num"]);
    expect(r.grupos[1].total).toBe(140);
    expect(r.nota).toContain("÷ 140");
  });
});

describe("KPI_COMPONENTES", () => {
  it("custos tem 6 componentes, receita 3", () => {
    expect(KPI_COMPONENTES.custos).toHaveLength(6);
    expect(KPI_COMPONENTES.receita).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run server/routes/ceoDashboard.detalhe.helpers.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar os helpers**

Create `server/routes/ceoDashboard.detalhe.helpers.ts`:

```ts
import { agruparItens, type ItemDetalhe, type GrupoDetalhe } from "./bp2026.helpers";
import type { DetalheBpResult } from "./bp2026.detalhe";

export const LIMITE_ITENS = 50;

export interface CeoGrupo extends GrupoDetalhe {
  sinal?: "+" | "-";
  formato: "brl" | "num";
}

export interface CeoDetalheResponse {
  kpi: string;
  titulo: string;
  mes: number;
  orcado: number | null;
  realizado: number | null;
  atingimentoPct: number | null;
  grupos: CeoGrupo[];
  nota?: string;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export function formatBRL(v: number): string { return brl.format(v || 0); }

export interface ComponenteKpi { slug: string; titulo: string; sinal?: "+" | "-" }
export const KPI_COMPONENTES: Record<string, ComponenteKpi[]> = {
  receita: [
    { slug: "mrr_ativo", titulo: "MRR Ativo", sinal: "+" },
    { slug: "receita_pontual", titulo: "Venda Pontual", sinal: "+" },
    { slug: "outras_receitas", titulo: "Outras Receitas", sinal: "+" },
  ],
  custos: [
    { slug: "csv_salarios", titulo: "CSV — Salários", sinal: "-" },
    { slug: "csv_beneficio", titulo: "CSV — Benefício (Caju)", sinal: "-" },
    { slug: "csv_stack", titulo: "CSV — Stack Tecnologia", sinal: "-" },
    { slug: "cac", titulo: "CAC", sinal: "-" },
    { slug: "sga", titulo: "SG&A", sinal: "-" },
    { slug: "bonus", titulo: "Bônus", sinal: "-" },
  ],
};

// Achata todos os grupos de um DetalheBpResult num único grupo (itens juntos, cap LIMITE).
export function achatarComponente(
  det: DetalheBpResult,
  opts: { titulo?: string; sinal?: "+" | "-"; formato: "brl" | "num" }
): CeoGrupo {
  const titulo = opts.titulo ?? det.titulo;
  const itens: ItemDetalhe[] = [];
  for (const g of det.grupos) for (const it of g.itens) itens.push({ ...it, grupo: titulo });
  const agrupado = agruparItens(itens, LIMITE_ITENS)[0];
  const total = det.realizado ?? det.grupos.reduce((s, g) => s + g.total, 0);
  return {
    titulo, total, sinal: opts.sinal, formato: opts.formato,
    itens: agrupado?.itens ?? [],
    itensOmitidos: agrupado?.itensOmitidos,
  };
}

// Preserva os grupos do BP como grupos do CEO (aplica formato/sinal).
export function mapDetalheBpGrupos(
  det: DetalheBpResult,
  opts: { formato: "brl" | "num"; sinal?: "+" | "-" }
): CeoGrupo[] {
  return det.grupos.map((g) => ({ ...g, formato: opts.formato, sinal: opts.sinal }));
}

export function bancosToGrupo(
  rows: Array<{ nmbanco: string; empresa: string; balance: number }>
): CeoGrupo {
  const itens = rows.map((r) => ({
    nome: [r.nmbanco, r.empresa].filter(Boolean).join(" · "),
    detalhe: "", data: null as string | null, valor: Number(r.balance) || 0,
  }));
  return {
    titulo: "Contas bancárias", formato: "brl",
    total: itens.reduce((s, i) => s + i.valor, 0), itens,
  };
}

export function inadClientesToGrupos(
  clientes: Array<{ idCliente: string; nomeCliente: string; valorTotal: number; quantidadeParcelas: number }>
): CeoGrupo[] {
  const itens: ItemDetalhe[] = clientes.map((c) => ({
    grupo: "Clientes inadimplentes",
    nome: c.nomeCliente, detalhe: `${c.quantidadeParcelas} parcela(s)`,
    data: null, valor: Number(c.valorTotal) || 0,
  }));
  return agruparItens(itens, LIMITE_ITENS).map((g) => ({ ...g, formato: "brl" as const }));
}

export function enpsRespostasToGrupos(
  respostas: Array<{ area: string | null; scoreEmpresa: number | null; comentarioEmpresa: string | null }>
): CeoGrupo[] {
  const bucket = (s: number | null) =>
    s == null ? null : s >= 9 ? "Promotores" : s >= 7 ? "Neutros" : "Detratores";
  const itens: ItemDetalhe[] = [];
  for (const r of respostas) {
    const g = bucket(r.scoreEmpresa);
    if (!g) continue;
    itens.push({
      grupo: g, nome: r.area || "Anônimo",
      detalhe: `nota ${r.scoreEmpresa}${r.comentarioEmpresa ? " · " + r.comentarioEmpresa : ""}`,
      data: null, valor: 0, // score vai no detalhe; formato "num" mostra a contagem
    });
  }
  const ordem = ["Promotores", "Neutros", "Detratores"];
  return agruparItens(itens, LIMITE_ITENS)
    .map((g) => ({ ...g, formato: "num" as const }))
    .sort((a, b) => ordem.indexOf(a.titulo) - ordem.indexOf(b.titulo));
}

export function ltvRowsToGrupos(
  rows: Array<{ nome: string; ltv_total: number }>
): CeoGrupo[] {
  const itens: ItemDetalhe[] = rows.map((r) => ({
    grupo: "Clientes (LTV)", nome: r.nome || "—", detalhe: "", data: null, valor: Number(r.ltv_total) || 0,
  }));
  return agruparItens(itens, LIMITE_ITENS).map((g) => ({ ...g, formato: "brl" as const }));
}

// Lucro: Margem Bruta (só-valor, +) e os componentes de custo drilláveis vêm no endpoint.
export function grupoMargemBruta(valor: number): CeoGrupo {
  return { titulo: "Margem Bruta", total: valor, sinal: "+", formato: "brl", itens: [],
    itensOmitidos: undefined };
}

export function receitaCabecaGrupos(receita: number, headcount: number): { grupos: CeoGrupo[]; nota: string } {
  const rc = headcount ? receita / headcount : 0;
  return {
    grupos: [
      { titulo: "Receita (MRR + Pontual + Outras)", total: receita, formato: "brl", itens: [] },
      { titulo: "Headcount (colaboradores ativos)", total: headcount, formato: "num", itens: [] },
    ],
    nota: `Receita ÷ Headcount = ${formatBRL(receita)} ÷ ${headcount} = ${formatBRL(rc)}`,
  };
}
```

- [ ] **Step 5: Rodar os testes (helpers) e ver passar**

Run: `npx vitest run server/routes/ceoDashboard.detalhe.helpers.test.ts`
Expected: PASS. E rodar o teste existente do dashboard p/ garantir que mover `parseMesNum` não quebrou:
Run: `npx vitest run server/routes/ceoDashboard.helpers.test.ts` → PASS.

- [ ] **Step 6: Verificar tsc**

Run: `npx tsc --noEmit`
Expected: sem novos erros em `ceoDashboard*`.

- [ ] **Step 7: Commit**

```bash
git add server/routes/ceoDashboard.detalhe.helpers.ts server/routes/ceoDashboard.detalhe.helpers.test.ts server/routes/ceoDashboard.helpers.ts server/routes/ceoDashboard.ts
git commit -m "feat(ceo-dashboard): helpers puros do drill + parseMesNum compartilhado

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Endpoint `GET /api/ceo-dashboard/detalhe`

**Files:**
- Create: `server/routes/ceoDashboard.detalhe.ts`
- Modify: `server/routes.ts` (import + registro junto de `registerCeoDashboardRoutes`)

**Interfaces:**
- Consumes: `montarDetalheBp` de `./bp2026.detalhe`; `computarBpReceitas` de `./bp2026`; `storage` de `../storage`; `sql` de `drizzle-orm`; helpers da Task 2; `canAccessCeo`, `parseMesNum` de `./ceoDashboard.helpers`.
- Produces: `registerCeoDashboardDetalheRoutes(app, db)`.

- [ ] **Step 1: Escrever o módulo**

Create `server/routes/ceoDashboard.detalhe.ts`:

```ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { montarDetalheBp } from "./bp2026.detalhe";
import { computarBpReceitas } from "./bp2026";
import { storage } from "../storage";
import { canAccessCeo, parseMesNum } from "./ceoDashboard.helpers";
import {
  achatarComponente, mapDetalheBpGrupos, bancosToGrupo, inadClientesToGrupos,
  enpsRespostasToGrupos, ltvRowsToGrupos, grupoMargemBruta, receitaCabecaGrupos,
  KPI_COMPONENTES, type CeoGrupo, type CeoDetalheResponse,
} from "./ceoDashboard.detalhe.helpers";

const TITULOS: Record<string, string> = {
  receita: "Receita", custos: "Custos & Despesas", lucro: "Lucro (EBITDA)",
  caixa: "Saldo de Caixa", inadimplencia: "Inadimplência Total", cac: "CAC",
  ltv: "LTV", headcount: "Headcount", enps: "E-NPS", receita_cabeca: "Receita / Cabeça",
};

function linhaValor(bp: any, arr: "linhas" | "metricasGerais", metrica: string, mesNum: number): { orcado: number | null; realizado: number | null } {
  const linha = (bp[arr] ?? []).find((l: any) => l.metrica === metrica);
  const m = linha?.meses?.find((x: any) => x.mes === mesNum);
  return { orcado: m?.orcado ?? null, realizado: m?.realizado ?? null };
}

async function componentesGrupos(db: any, kpi: string, mesNum: number): Promise<CeoGrupo[]> {
  const comps = KPI_COMPONENTES[kpi];
  const grupos: CeoGrupo[] = [];
  for (const c of comps) {
    const det = await montarDetalheBp(db, { metrica: c.slug, mes: mesNum });
    grupos.push(achatarComponente(det, { titulo: c.titulo, sinal: c.sinal, formato: "brl" }));
  }
  return grupos;
}

export async function buildCeoDetalhe(db: any, kpi: string, mes?: string): Promise<CeoDetalheResponse> {
  const bp: any = await computarBpReceitas(db);
  const mesNum = parseMesNum(mes, bp.mesCorrente);
  const base = { kpi, titulo: TITULOS[kpi] ?? kpi, mes: mesNum, orcado: null as number | null, realizado: null as number | null, atingimentoPct: null as number | null };
  let grupos: CeoGrupo[] = [];
  let nota: string | undefined;

  if (kpi === "receita" || kpi === "custos") {
    grupos = await componentesGrupos(db, kpi, mesNum);
    const metrica = kpi === "receita" ? "receita_total" : "despesa_total";
    const v = linhaValor(bp, "metricasGerais", metrica, mesNum);
    base.orcado = v.orcado; base.realizado = v.realizado;
  } else if (kpi === "cac") {
    const det = await montarDetalheBp(db, { metrica: "cac", mes: mesNum });
    grupos = mapDetalheBpGrupos(det, { formato: "brl", sinal: "-" });
    base.orcado = det.orcado; base.realizado = det.realizado;
  } else if (kpi === "headcount") {
    const det = await montarDetalheBp(db, { metrica: "colaboradores", mes: mesNum });
    grupos = mapDetalheBpGrupos(det, { formato: "num" });
    const v = linhaValor(bp, "metricasGerais", "colaboradores", mesNum);
    base.orcado = v.orcado; base.realizado = v.realizado;
  } else if (kpi === "lucro") {
    const mb = linhaValor(bp, "linhas", "margem_bruta", mesNum);
    grupos.push(grupoMargemBruta(mb.realizado ?? 0));
    for (const slug of ["cac", "sga", "bonus"]) {
      const det = await montarDetalheBp(db, { metrica: slug, mes: mesNum });
      grupos.push(achatarComponente(det, { sinal: "-", formato: "brl" }));
    }
    const eb = linhaValor(bp, "linhas", "ebitda", mesNum);
    base.orcado = eb.orcado; base.realizado = eb.realizado;
    nota = "EBITDA = Margem Bruta − CAC − SG&A − Bônus";
  } else if (kpi === "receita_cabeca") {
    const rec = linhaValor(bp, "metricasGerais", "receita_total", mesNum);
    const head = linhaValor(bp, "metricasGerais", "colaboradores", mesNum);
    const rc = receitaCabecaGrupos(rec.realizado ?? 0, head.realizado ?? 0);
    grupos = rc.grupos; nota = rc.nota;
    const v = linhaValor(bp, "metricasGerais", "receita_cabeca", mesNum);
    base.orcado = v.orcado; base.realizado = v.realizado;
  } else if (kpi === "caixa") {
    const rows: any = await db.execute(sql`
      SELECT nmbanco, empresa, balance FROM "Conta Azul".caz_bancos ORDER BY balance DESC NULLS LAST`);
    grupos = [bancosToGrupo(rows.rows ?? [])];
    base.realizado = grupos[0].total;
  } else if (kpi === "inadimplencia") {
    const res = await storage.getInadimplenciaClientes(undefined, undefined, "valor", 200);
    grupos = inadClientesToGrupos(res.clientes ?? []);
    base.realizado = (res.clientes ?? []).reduce((s: number, c: any) => s + (Number(c.valorTotal) || 0), 0);
  } else if (kpi === "ltv") {
    const rows: any = await db.execute(sql`
      SELECT COALESCE(c.nome, t.id_task) AS nome, t.ltv_total FROM (
        SELECT id_task, SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)) AS ltv_total
        FROM cortex_core.vw_lt_contratos GROUP BY id_task
      ) t LEFT JOIN "Clickup".cup_clientes c ON c.task_id = t.id_task
      ORDER BY t.ltv_total DESC NULLS LAST LIMIT 200`);
    grupos = ltvRowsToGrupos(rows.rows ?? []);
    nota = "O card mostra a MÉDIA de LTV por cliente; abaixo, o LTV de cada cliente.";
  } else if (kpi === "enps") {
    const respostas: any = await storage.getRhNpsRespostas();
    grupos = enpsRespostasToGrupos(respostas ?? []);
    nota = "E-NPS (empresa) — todas as respostas disponíveis.";
  } else {
    throw new Error("kpi inválido");
  }

  const atingimentoPct = base.orcado != null && base.realizado != null && base.orcado !== 0
    ? Math.round((base.realizado / base.orcado) * 1000) / 10 : null;
  return { ...base, atingimentoPct, grupos, nota };
}

export function registerCeoDashboardDetalheRoutes(app: Express, db: any) {
  app.get("/api/ceo-dashboard/detalhe", async (req: any, res) => {
    try {
      if (!canAccessCeo(req.user)) return res.status(403).json({ error: "Acesso restrito ao CEO Dashboard" });
      const kpi = typeof req.query.kpi === "string" ? req.query.kpi : "";
      if (!kpi || kpi === "nps") return res.status(400).json({ error: "kpi inválido" });
      const mes = typeof req.query.mes === "string" ? req.query.mes : undefined;
      const payload = await buildCeoDetalhe(db, kpi, mes);
      res.json(payload);
    } catch (error) {
      console.error("[api] Error building CEO detalhe:", error);
      res.status(500).json({ error: "Falha ao montar o detalhe do CEO Dashboard" });
    }
  });
}
```

- [ ] **Step 2: Registrar no `server/routes.ts`**

Adicionar o import junto de `registerCeoDashboardRoutes`:
```ts
import { registerCeoDashboardDetalheRoutes } from "./routes/ceoDashboard.detalhe";
```
E a chamada logo após `registerCeoDashboardRoutes(app, db);`:
```ts
  registerCeoDashboardDetalheRoutes(app, db);
```

- [ ] **Step 3: Verificar tsc**

Run: `npx tsc --noEmit`
Expected: sem novos erros referenciando `ceoDashboard.detalhe`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/ceoDashboard.detalhe.ts server/routes.ts
git commit -m "feat(ceo-dashboard): endpoint GET /api/ceo-dashboard/detalhe (drill por KPI)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — drawer `CeoKpiDetail` + card clicável

**Files:**
- Create: `client/src/components/ceo/CeoKpiDetail.tsx`
- Modify: `client/src/components/ceo/CeoKpiCard.tsx` (onClick + cursor, exceto em_breve)
- Modify: `client/src/pages/CeoDashboard.tsx` (estado + render do drawer)

**Interfaces:**
- Consumes: endpoint `/api/ceo-dashboard/detalhe`; tipo `CeoKpi` (já existe em `CeoKpiCard`).
- Produces: `CeoKpiDetail` (default/named export).

- [ ] **Step 1: Tornar o `CeoKpiCard` clicável**

Em `client/src/components/ceo/CeoKpiCard.tsx`, adicionar prop opcional `onClick` e aplicar só quando não for `em_breve`. No `<div>` externo, adicionar quando clicável: `onClick`, `role="button"`, `tabIndex={0}`, e classes `cursor-pointer hover:border-gray-300 dark:hover:border-zinc-600 transition-colors`. Assinatura:

```tsx
export function CeoKpiCard({ kpi, onClick }: { kpi: CeoKpi; onClick?: () => void }) {
  const emBreve = kpi.status === "em_breve";
  const clicavel = !emBreve && !!onClick;
  // ...
  // no container:
  //   className={[..., clicavel ? "cursor-pointer hover:border-gray-300 dark:hover:border-zinc-600 transition-colors" : ""].join(" ")}
  //   {...(clicavel ? { onClick, role: "button", tabIndex: 0 } : {})}
```

- [ ] **Step 2: Criar o drawer `CeoKpiDetail.tsx`**

Create `client/src/components/ceo/CeoKpiDetail.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface ItemDet { nome: string; detalhe: string; data: string | null; valor: number; url?: string }
interface GrupoDet { titulo: string; total: number; sinal?: "+" | "-"; formato: "brl" | "num"; itens: ItemDet[]; itensOmitidos?: { qtd: number; valor: number } }
interface DetalheResponse {
  kpi: string; titulo: string; mes: number;
  orcado: number | null; realizado: number | null; atingimentoPct: number | null;
  grupos: GrupoDet[]; nota?: string;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmt = (v: number, f: "brl" | "num") => (f === "num" ? int.format(v) : brl.format(v));

export function CeoKpiDetail({ kpiKey, mes, onClose }: { kpiKey: string | null; mes: string; onClose: () => void }) {
  const aberto = kpiKey !== null;
  const { data, isLoading, isError } = useQuery<DetalheResponse>({
    queryKey: ["/api/ceo-dashboard/detalhe", { kpi: kpiKey, mes }],
    enabled: aberto,
  });

  return (
    <Sheet open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            {data?.titulo ?? "Detalhe"}{data ? ` · ${MESES[data.mes - 1]} 2026` : ""}
          </SheetTitle>
          <SheetDescription className="text-gray-500 dark:text-zinc-400">
            {data && (data.orcado != null
              ? `Orçado ${brl.format(data.orcado)} · Realizado ${data.realizado != null ? brl.format(data.realizado) : "—"}${data.atingimentoPct != null ? ` · ${Math.round(data.atingimentoPct)}% da meta` : ""}`
              : data.realizado != null ? `Realizado ${brl.format(data.realizado)}` : "")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {isLoading && <><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></>}
          {isError && <p className="text-sm text-rose-600 dark:text-rose-400">Falha ao carregar o detalhamento.</p>}
          {data && data.grupos.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-zinc-500">Sem detalhamento para este mês.</p>
          )}
          {data && data.grupos.map((g) => {
            const totalDisplay = g.formato === "num"
              ? int.format(g.itens.length ? g.itens.length + (g.itensOmitidos?.qtd ?? 0) : g.total)
              : brl.format(g.total);
            const prefixo = g.sinal ? `${g.sinal} ` : "";
            return (
              <details key={g.titulo} open={data.grupos.length <= 4} className="rounded-lg border border-gray-200 dark:border-zinc-700">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <span>{prefixo}{g.titulo}</span>
                  <span className="tabular-nums">{totalDisplay}</span>
                </summary>
                {g.itens.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-zinc-800">
                    {g.itens.map((it, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 px-3 py-1.5 text-xs border-b border-gray-50 dark:border-zinc-800/50 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-gray-800 dark:text-zinc-200">
                            {it.url ? <a href={it.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{it.nome}</a> : it.nome}
                          </p>
                          {(it.detalhe || it.data) && (
                            <p className="truncate text-gray-500 dark:text-zinc-500">{[it.detalhe, it.data].filter(Boolean).join(" · ")}</p>
                          )}
                        </div>
                        {g.formato === "brl" && (
                          <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{brl.format(it.valor)}</span>
                        )}
                      </div>
                    ))}
                    {g.itensOmitidos && (
                      <p className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-500">
                        +{g.itensOmitidos.qtd} itens ({g.formato === "num" ? int.format(g.itensOmitidos.qtd) : brl.format(g.itensOmitidos.valor)})
                      </p>
                    )}
                  </div>
                )}
              </details>
            );
          })}
          {data?.nota && <p className="text-xs text-gray-500 dark:text-zinc-500">{data.nota}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Ligar no `CeoDashboard.tsx`**

Em `client/src/pages/CeoDashboard.tsx`:
- importar `import { CeoKpiDetail } from "@/components/ceo/CeoKpiDetail";`
- estado: `const [detalheKpi, setDetalheKpi] = useState<string | null>(null);`
- no map dos cards: `<CeoKpiCard key={kpi.key} kpi={kpi} onClick={() => setDetalheKpi(kpi.key)} />`
- após a grade, renderizar: `<CeoKpiDetail kpiKey={detalheKpi} mes={mes} onClose={() => setDetalheKpi(null)} />`

- [ ] **Step 4: Verificar tsc**

Run: `npx tsc --noEmit`
Expected: sem novos erros em `client/src/components/ceo/*` nem `CeoDashboard.tsx`.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ceo/CeoKpiDetail.tsx client/src/components/ceo/CeoKpiCard.tsx client/src/pages/CeoDashboard.tsx
git commit -m "feat(ceo-dashboard): drawer de auditoria (CeoKpiDetail) + cards clicáveis

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Validação no browser + reconciliação com o BP

**Files:** nenhum (validação). Requer server rodando (o controller sobe/valida; subagente NÃO roda dev server).

- [ ] **Step 1: Suíte de testes nova**

Run: `npx vitest run server/routes/ceoDashboard.detalhe.helpers.test.ts server/routes/ceoDashboard.helpers.test.ts client/src/components/ceo/ceoFormat.test.ts`
Expected: tudo verde.

- [ ] **Step 2: Typecheck geral**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Browser — abrir o drawer de cada card**

Com o server rodando e logado como admin em `/ceo-dashboard`:
- Clicar em cada um dos 10 cards (menos NPS) → drawer abre com grupos.
- Custos: 6 grupos (CSV Salários/Benefício/Stack, CAC, SG&A, Bônus); expandir CSV Salários → linhas (parcelas/pessoas).
- Verificar dark E light mode no drawer.
- Card NPS ("em breve") NÃO abre drawer.

- [ ] **Step 4: Reconciliação com o BP (drill idêntico)**

Abrir `/bp-2026` e comparar o drill de CAC (aba DRE, célula CAC do mesmo mês) com o grupo CAC do card Custos / o card CAC do CEO: **os itens devem ser os mesmos** (mesma fonte via `montarDetalheBp`). Idem Headcount (colaboradores) e uma linha de SG&A. Registrar qualquer divergência.

- [ ] **Step 5: Pós-conclusão**

- git-autopush garantido (commits + push no fechamento pelo controller).
- Atualizar Obsidian/CHANGELOG conforme fluxo do projeto.

---

## Notas de implementação

- **Formato por grupo (`formato: "brl"|"num"`):** substitui a heurística `isInt` do BP. `num` mostra
  contagem (grupos de Headcount e E-NPS, e o grupo Headcount de Receita/Cabeça); `brl` mostra R$.
  Itens de grupos `num` não exibem valor (score do E-NPS vai no `detalhe`; pessoas não têm R$).
- **Grupos só-valor** (Margem Bruta, e Receita/Headcount em Receita/Cabeça) têm `itens: []`; o drawer
  mostra o `total` no cabeçalho do grupo e não desenha corpo.
- **Reuso real:** Custos/CAC/Headcount/Receita saem de `montarDetalheBp` — os mesmos itens que o BP
  mostra. Isso é o que a Task 5 (reconciliação) verifica.
- **`margem_bruta` é derivada** no BP (não tem handler no `/detalhe`); por isso o Lucro a trata como
  grupo só-valor e busca o número em `computarBpReceitas().linhas`.
