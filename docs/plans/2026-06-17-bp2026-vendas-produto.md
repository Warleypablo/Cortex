# BP 2026 — Aba "Vendas por Produto" via ClickUp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir o realizado da aba "Vendas por Produto" do BP 2026 a partir do ClickUp (`"Clickup".cup_contratos` por `data_criado`), mantendo Orçado × Realizado e reaproveitando o orçado por segmento, com 5 linhas-resumo no topo (Receita Total/MRR/Pontual, Nº Contratos, Nº Clientes).

**Architecture:** O backend já monta a tabela a partir de um `agg: Map<mes, Map<SegmentoBP, CelulaSeg>>`. Produzimos esse mesmo formato a partir do ClickUp (via de-para `produto → segmento`) em vez do Bitrix. Adicionamos um bloco de totais "Visão Geral". O drill-down passa a listar contratos do ClickUp. **Sem mudança de frontend** — o payload mantém as mesmas chaves de métrica por segmento (AOV continua derivado client-side) e as novas linhas de topo são `semDetalhe`.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`...\`)`), Vitest (`vitest run`), PostgreSQL (GCP).

## Global Constraints

- Fonte do realizado: `"Clickup".cup_contratos`, janela pelo mês de `data_criado` (não `data_inicio`).
- Filtro de status: incluir todos **exceto** `'não usar'` — comparar com `LOWER(TRIM(status))`.
- Ano BP: `ANO = 2026` (constante local por arquivo, padrão já usado em `bp2026.ts` e `bp2026.detalhe.ts`).
- Valores podem ser NULL → sempre `COALESCE(..., 0)`.
- De-para `produto → segmento`: default `"Others"` para qualquer valor não listado.
- Reatribuição: se o segmento do produto não existe no bloco da natureza (ex.: `E-commerce` é só pontual), a parcela daquela natureza vai para `"Others"` — garante que o Total bate com a soma dos segmentos.
- **Escopo:** mexer SÓ na aba Vendas por Produto. NÃO alterar CAC/Funil/Revenue. `carregarAtribuicaoVendas`/`agregarVendasProduto` (Bitrix) PERMANECEM — ainda alimentam o `contratosVendidosRec` do CAC em `bp2026.ts`.
- Dark/light mode: nenhum componente novo (frontend inalterado).
- Commits: Conventional Commits, co-autor `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- **Create** `server/routes/bp2026.produtoSegmento.ts` — de-para `PRODUTO_PARA_SEGMENTO` + `segmentoDeProduto()`. Responsabilidade única: traduzir `produto` (ClickUp) → `SegmentoBP`.
- **Create** `server/routes/bp2026.produtoSegmento.test.ts` — testes do de-para.
- **Modify** `server/routes/bp2026.vendasProduto.helpers.ts` — adicionar tipos `VendaProdutoRow`/`TotalMesRow`/`TotalMes`/`AggVendasClickup`/`ContratoRow`, função pura `agregarVendasProdutoClickup()` e filtro puro `contratosDoSegmento()`. (Helpers Bitrix existentes permanecem — usados pelo CAC.)
- **Create** `server/routes/bp2026.vendasProduto.helpers.test.ts` — testes das funções puras novas.
- **Modify** `server/routes/bp2026.vendasProduto.ts` — reescrever `montarVendasProduto()` (recebe `agg`+`totais`, monta topo + blocos, dropa totais in-bloco) e `detalheVendaProdutoMes()` (query ClickUp); adicionar loader `carregarVendasProdutoClickup(db)`; adicionar `semDetalhe?` à interface `Linha`; `const ANO = 2026`. `carregarAtribuicaoVendas`/`parseMetricaProduto` permanecem.
- **Create** `server/routes/bp2026.vendasProduto.test.ts` — teste de `montarVendasProduto` (bloco Visão Geral, orçado combinado, Nº Clientes sem meta).
- **Modify** `server/routes/bp2026.ts` — trocar a montagem da aba: carregar do ClickUp e passar `agg`/`totais`; manter atribuição Bitrix para o CAC.
- **Modify** `server/routes/bp2026.info.ts` — adicionar entradas `INFO_METRICAS` para `vp_receita_total`, `vp_receita_mrr`, `vp_receita_pontual`, `vp_num_contratos`, `vp_num_clientes`. (NÃO alterar chaves genéricas compartilhadas com Funil.)

---

## Task 1: De-para produto → segmento (pure + tests)

**Files:**
- Create: `server/routes/bp2026.produtoSegmento.ts`
- Test: `server/routes/bp2026.produtoSegmento.test.ts`

**Interfaces:**
- Produces: `segmentoDeProduto(produto: string | null | undefined): SegmentoBP` e `PRODUTO_PARA_SEGMENTO: Record<string, SegmentoBP>`.

- [ ] **Step 1: Write the failing test**

```ts
// server/routes/bp2026.produtoSegmento.test.ts
import { describe, it, expect } from "vitest";
import { segmentoDeProduto } from "./bp2026.produtoSegmento";

describe("segmentoDeProduto", () => {
  it("mapeia produtos óbvios", () => {
    expect(segmentoDeProduto("Performance")).toBe("Performance");
    expect(segmentoDeProduto("Creators")).toBe("Creators");
    expect(segmentoDeProduto("Social Media")).toBe("Social");
    expect(segmentoDeProduto("Gestão de Comunidade")).toBe("Gestão de Comunidade");
    expect(segmentoDeProduto("Ecommerce")).toBe("E-commerce");
    expect(segmentoDeProduto("Site")).toBe("Site Institucional");
    expect(segmentoDeProduto("Landing Page")).toBe("Landing Page");
    expect(segmentoDeProduto("CRM de Vendas")).toBe("CRM");
  });
  it("aplica os julgamentos do de-para", () => {
    expect(segmentoDeProduto("Gameplan")).toBe("Performance");
    expect(segmentoDeProduto("Consultoria de Performance")).toBe("Performance");
    expect(segmentoDeProduto("TikTok Shop")).toBe("E-commerce");
    expect(segmentoDeProduto("CRO & Alteração")).toBe("E-commerce");
    expect(segmentoDeProduto("Régua de Automação")).toBe("CRM");
    expect(segmentoDeProduto("Broadcast")).toBe("Others");
  });
  it("default Others para desconhecido, vazio e nulo", () => {
    expect(segmentoDeProduto("Produto Novo XYZ")).toBe("Others");
    expect(segmentoDeProduto("(sem produto)")).toBe("Others");
    expect(segmentoDeProduto("")).toBe("Others");
    expect(segmentoDeProduto(null)).toBe("Others");
    expect(segmentoDeProduto(undefined)).toBe("Others");
  });
  it("tolera espaços nas bordas", () => {
    expect(segmentoDeProduto("  Performance  ")).toBe("Performance");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/bp2026.produtoSegmento.test.ts`
Expected: FAIL — `Cannot find module './bp2026.produtoSegmento'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// server/routes/bp2026.produtoSegmento.ts
// De-para do campo `produto` de "Clickup".cup_contratos -> segmento do BP.
// Default (produto não listado, incl. "(sem produto)" e produtos futuros): "Others".
// Julgamentos marcados [REVISAR] no design (docs/plans/2026-06-17-bp2026-vendas-produto-design.md).
import type { SegmentoBP } from "../okr2026/servicosBitrix";

export const PRODUTO_PARA_SEGMENTO: Record<string, SegmentoBP> = {
  // Recorrente (MRR)
  "Performance": "Performance",
  "Consultoria de Performance": "Performance",
  "Gameplan": "Performance",            // serviços "Gameplan (Performance)" / "Fee implantação (Performance)" [REVISAR]
  "Creators": "Creators",
  "Social Media": "Social",
  "Blog Post": "Social",                // [REVISAR] (alt.: Others)
  "Gestão de Comunidade": "Gestão de Comunidade",
  "Gestão & Atendimento": "Gestão de Comunidade", // [REVISAR]
  // Pontual
  "Ecommerce": "E-commerce",
  "TikTok Shop": "E-commerce",          // [REVISAR]
  "CRO & Alteração": "E-commerce",      // serviços Shopify/checkout [REVISAR] (alt.: Others)
  "Site": "Site Institucional",
  "Landing Page": "Landing Page",
  "CRM de Vendas": "CRM",
  "Régua de Automação": "CRM",          // régua e-mail/WhatsApp [REVISAR]
  // Others (explícitos para clareza; também cairiam no default)
  "Broadcast": "Others",                // e-mail mkt/Reportana, MRR-heavy, sem bucket CRM no recorrente [REVISAR]
  "Sustentação": "Others",              // manutenção site/ecommerce, MRR [REVISAR]
  "Estruturação Comercial": "Others",
  "Estruturação Estratégica": "Others",
  "ID Visual": "Others",
  "Pacote Artes / Rótulos": "Others",
  "SEO Full": "Others",                 // [REVISAR] (alt.: Performance)
  "Agente IA": "Others",                // [REVISAR] (alt.: CRM)
  "Fee de implantação": "Others",
  "Dashboard": "Others",
  "Account Management": "Others",
};

export function segmentoDeProduto(produto: string | null | undefined): SegmentoBP {
  const key = (produto ?? "").trim();
  return PRODUTO_PARA_SEGMENTO[key] ?? "Others";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/bp2026.produtoSegmento.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.produtoSegmento.ts server/routes/bp2026.produtoSegmento.test.ts
git commit -m "feat(bp2026): de-para produto ClickUp -> segmento do BP

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Agregação pura ClickUp + filtro de drill-down (helpers + tests)

**Files:**
- Modify: `server/routes/bp2026.vendasProduto.helpers.ts` (adicionar ao final, mantendo o conteúdo Bitrix existente)
- Test: `server/routes/bp2026.vendasProduto.helpers.test.ts`

**Interfaces:**
- Consumes: `segmentoDeProduto` (Task 1), `CelulaSeg` (já existe em helpers, linha 85), `SEGMENTOS_RECORRENTES`/`SEGMENTOS_PONTUAIS`/`SegmentoBP`/`Natureza` (servicosBitrix).
- Produces:
  - `agregarVendasProdutoClickup(produtoRows: VendaProdutoRow[], totalRows: TotalMesRow[]): AggVendasClickup`
  - `contratosDoSegmento(rows: ContratoRow[], natureza: Natureza, segmento: SegmentoBP): ContratoRow[]`
  - tipos `VendaProdutoRow`, `TotalMesRow`, `TotalMes`, `AggVendasClickup`, `ContratoRow`.

- [ ] **Step 1: Write the failing test**

```ts
// server/routes/bp2026.vendasProduto.helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  agregarVendasProdutoClickup, contratosDoSegmento,
  type VendaProdutoRow, type TotalMesRow, type ContratoRow,
} from "./bp2026.vendasProduto.helpers";

describe("agregarVendasProdutoClickup", () => {
  it("soma MRR/Pontual e contratos por segmento e reconcilia os totais", () => {
    const prod: VendaProdutoRow[] = [
      { mes: 1, produto: "Performance", mrr: 1000, pont: 0, contratosMrr: 2, contratosPont: 0 },
      { mes: 1, produto: "Creators", mrr: 0, pont: 500, contratosMrr: 0, contratosPont: 3 },
    ];
    const tot: TotalMesRow[] = [{ mes: 1, contratos: 5, clientes: 4 }];
    const { agg, totais } = agregarVendasProdutoClickup(prod, tot);
    expect(agg.get(1)!.get("Performance")).toEqual({ mrr: 1000, pont: 0, contratosRec: 2, contratosPont: 0 });
    expect(agg.get(1)!.get("Creators")!.pont).toBe(500);
    expect(totais.get(1)).toEqual({ mrr: 1000, pont: 500, contratos: 5, clientes: 4 });
  });

  it("reatribui a Others a parcela cujo segmento não existe no bloco da natureza", () => {
    // E-commerce é segmento pontual; MRR de Ecommerce cai em Others (bloco recorrente)
    const prod: VendaProdutoRow[] = [
      { mes: 2, produto: "Ecommerce", mrr: 300, pont: 800, contratosMrr: 1, contratosPont: 4 },
    ];
    const { agg, totais } = agregarVendasProdutoClickup(prod, []);
    expect(agg.get(2)!.get("Others")!.mrr).toBe(300);
    expect(agg.get(2)!.get("E-commerce")!.pont).toBe(800);
    expect(agg.get(2)!.get("E-commerce")?.mrr ?? 0).toBe(0);
    expect(totais.get(2)!.mrr).toBe(300);
    expect(totais.get(2)!.pont).toBe(800);
  });

  it("conta um contrato com MRR e Pontual nos dois blocos", () => {
    const prod: VendaProdutoRow[] = [
      { mes: 3, produto: "Creators", mrr: 100, pont: 200, contratosMrr: 1, contratosPont: 1 },
    ];
    const { agg } = agregarVendasProdutoClickup(prod, []);
    expect(agg.get(3)!.get("Creators")).toEqual({ mrr: 100, pont: 200, contratosRec: 1, contratosPont: 1 });
  });
});

describe("contratosDoSegmento", () => {
  const rows: ContratoRow[] = [
    { cliente: "A", produto: "Performance", servico: "x", status: "ativo", valorr: 100, valorp: 0, data: null },
    { cliente: "B", produto: "Ecommerce", servico: "y", status: "ativo", valorr: 50, valorp: 900, data: null },
    { cliente: "C", produto: "Performance", servico: "z", status: "ativo", valorr: 0, valorp: 0, data: null },
  ];
  it("filtra por natureza e reatribui Others", () => {
    expect(contratosDoSegmento(rows, "recorrente", "Performance").map((r) => r.cliente)).toEqual(["A"]);
    // MRR de Ecommerce reatribuído a Others
    expect(contratosDoSegmento(rows, "recorrente", "Others").map((r) => r.cliente)).toEqual(["B"]);
    // Pontual de Ecommerce fica em E-commerce
    expect(contratosDoSegmento(rows, "pontual", "E-commerce").map((r) => r.cliente)).toEqual(["B"]);
  });
  it("ignora contratos sem valor na natureza", () => {
    expect(contratosDoSegmento(rows, "recorrente", "Performance").map((r) => r.cliente)).not.toContain("C");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/bp2026.vendasProduto.helpers.test.ts`
Expected: FAIL — `agregarVendasProdutoClickup is not a function` / export ausente.

- [ ] **Step 3: Write minimal implementation**

Adicionar ao FINAL de `server/routes/bp2026.vendasProduto.helpers.ts` (não remover nada do existente):

```ts
// ===== Vendas por Produto via ClickUp (data_criado) =====
import { SEGMENTOS_RECORRENTES, SEGMENTOS_PONTUAIS } from "../okr2026/servicosBitrix";
import { segmentoDeProduto } from "./bp2026.produtoSegmento";

export interface VendaProdutoRow { mes: number; produto: string; mrr: number; pont: number; contratosMrr: number; contratosPont: number }
export interface TotalMesRow { mes: number; contratos: number; clientes: number }
export interface TotalMes { mrr: number; pont: number; contratos: number; clientes: number }
export interface AggVendasClickup {
  agg: Map<number, Map<SegmentoBP, CelulaSeg>>;
  totais: Map<number, TotalMes>;
}
export interface ContratoRow {
  cliente: string; produto: string; servico: string; status: string;
  valorr: number; valorp: number; data: string | null;
}

const SET_REC = new Set<SegmentoBP>(SEGMENTOS_RECORRENTES);
const SET_PONT = new Set<SegmentoBP>(SEGMENTOS_PONTUAIS);

const segNoBloco = (seg: SegmentoBP, natureza: Natureza): SegmentoBP =>
  natureza === "recorrente" ? (SET_REC.has(seg) ? seg : "Others") : (SET_PONT.has(seg) ? seg : "Others");

export function agregarVendasProdutoClickup(
  produtoRows: VendaProdutoRow[], totalRows: TotalMesRow[]
): AggVendasClickup {
  const agg = new Map<number, Map<SegmentoBP, CelulaSeg>>();
  const totais = new Map<number, TotalMes>();
  const cel = (mes: number, seg: SegmentoBP): CelulaSeg => {
    const porMes = agg.get(mes) ?? new Map<SegmentoBP, CelulaSeg>();
    agg.set(mes, porMes);
    const c = porMes.get(seg) ?? { mrr: 0, pont: 0, contratosRec: 0, contratosPont: 0 };
    porMes.set(seg, c);
    return c;
  };
  const tot = (mes: number): TotalMes => {
    const t = totais.get(mes) ?? { mrr: 0, pont: 0, contratos: 0, clientes: 0 };
    totais.set(mes, t);
    return t;
  };
  for (const r of produtoRows) {
    const seg = segmentoDeProduto(r.produto);
    if (r.mrr || r.contratosMrr) {
      const c = cel(r.mes, segNoBloco(seg, "recorrente"));
      c.mrr += r.mrr; c.contratosRec += r.contratosMrr;
      tot(r.mes).mrr += r.mrr;
    }
    if (r.pont || r.contratosPont) {
      const c = cel(r.mes, segNoBloco(seg, "pontual"));
      c.pont += r.pont; c.contratosPont += r.contratosPont;
      tot(r.mes).pont += r.pont;
    }
  }
  for (const tr of totalRows) {
    const t = tot(tr.mes);
    t.contratos = tr.contratos; t.clientes = tr.clientes;
  }
  return { agg, totais };
}

export function contratosDoSegmento(
  rows: ContratoRow[], natureza: Natureza, segmento: SegmentoBP
): ContratoRow[] {
  return rows.filter((r) => {
    const valor = natureza === "recorrente" ? r.valorr : r.valorp;
    if (!(valor > 0)) return false;
    return segNoBloco(segmentoDeProduto(r.produto), natureza) === segmento;
  });
}
```

Nota: `CelulaSeg`, `SegmentoBP` e `Natureza` já estão no escopo do arquivo (importados/definidos no topo — `Natureza` vem do import existente de `servicosBitrix`). Se o TS reclamar de import duplicado de `SEGMENTOS_RECORRENTES`/`SEGMENTOS_PONTUAIS`, mover esses nomes para o import já existente no topo do arquivo em vez de reimportar.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/bp2026.vendasProduto.helpers.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.vendasProduto.helpers.ts server/routes/bp2026.vendasProduto.helpers.test.ts
git commit -m "feat(bp2026): agregação pura de vendas por produto via ClickUp + filtro de drill-down

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Reescrever montarVendasProduto + loader ClickUp

**Files:**
- Modify: `server/routes/bp2026.vendasProduto.ts` (interface `Linha`, `Deps`, `montarVendasProduto`; adicionar `carregarVendasProdutoClickup` e `const ANO`)
- Test: `server/routes/bp2026.vendasProduto.test.ts`

**Interfaces:**
- Consumes: `agregarVendasProdutoClickup`, tipos `AggVendasClickup`/`TotalMes`/`CelulaSeg` (Task 2); `SEGMENTOS_RECORRENTES`/`SEGMENTOS_PONTUAIS`/`SLUG`/`SegmentoBP` (servicosBitrix); `calcAtingimento`/`calcYtd` (bp2026.helpers).
- Produces:
  - `carregarVendasProdutoClickup(db: any): Promise<AggVendasClickup>`
  - `montarVendasProduto(deps: { agg: Map<number, Map<SegmentoBP, CelulaSeg>>; totais: Map<number, TotalMes>; orcado: Record<string, Record<number, number>>; mesCorrente: number; mesFechado: number }): Linha[]` (agora **síncrona**, sem `db`)
  - `Linha` ganha campo opcional `semDetalhe?: boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// server/routes/bp2026.vendasProduto.test.ts
import { describe, it, expect } from "vitest";
import { montarVendasProduto } from "./bp2026.vendasProduto";
import type { CelulaSeg } from "./bp2026.vendasProduto.helpers";
import type { SegmentoBP } from "../okr2026/servicosBitrix";

function mkAgg(mes: number, seg: SegmentoBP, c: CelulaSeg) {
  return new Map([[mes, new Map<SegmentoBP, CelulaSeg>([[seg, c]])]]);
}

describe("montarVendasProduto", () => {
  const totais = new Map([[1, { mrr: 1000, pont: 500, contratos: 5, clientes: 4 }]]);
  const orcado = {
    vendas_mrr: { 1: 800 }, vendas_pontual: { 1: 400 },
    contratos_vendidos_mrr_performance: { 1: 3 }, contratos_vendidos_pontual_ecommerce: { 1: 2 },
  } as Record<string, Record<number, number>>;
  const agg = mkAgg(1, "Performance", { mrr: 1000, pont: 0, contratosRec: 2, contratosPont: 0 });

  it("monta o bloco Visão Geral com Receita Total = MRR+Pontual e orçado combinado", () => {
    const linhas = montarVendasProduto({ agg, totais, orcado, mesCorrente: 1, mesFechado: 0 });
    const total = linhas.find((l) => l.metrica === "vp_receita_total")!;
    expect(total.grupo).toBe("Visão Geral");
    expect(total.meses[0].realizado).toBe(1500);   // 1000 + 500
    expect(total.meses[0].orcado).toBe(1200);       // 800 + 400
    expect(total.semDetalhe).toBe(true);
    expect(total.destaque).toBe(true);
  });

  it("Nº de Clientes é realizado-only (orçado 0)", () => {
    const linhas = montarVendasProduto({ agg, totais, orcado, mesCorrente: 1, mesFechado: 0 });
    const cli = linhas.find((l) => l.metrica === "vp_num_clientes")!;
    expect(cli.meses[0].realizado).toBe(4);
    expect(cli.meses[0].orcado).toBe(0);
    expect(cli.unidade).toBe("int");
    expect(cli.semDetalhe).toBe(true);
  });

  it("Nº de Contratos soma os contratos_vendidos_* como orçado", () => {
    const linhas = montarVendasProduto({ agg, totais, orcado, mesCorrente: 1, mesFechado: 0 });
    const ctr = linhas.find((l) => l.metrica === "vp_num_contratos")!;
    expect(ctr.meses[0].realizado).toBe(5);
    expect(ctr.meses[0].orcado).toBe(5);            // 3 (mrr_performance) + 2 (pontual_ecommerce)
  });

  it("gera as linhas por segmento com as chaves de métrica preservadas", () => {
    const linhas = montarVendasProduto({ agg, totais, orcado, mesCorrente: 1, mesFechado: 0 });
    const mrrPerf = linhas.find((l) => l.metrica === "vendas_mrr_performance")!;
    expect(mrrPerf.grupo).toBe("Recorrente");
    expect(mrrPerf.segmento).toBe("Performance");
    expect(mrrPerf.meses[0].realizado).toBe(1000);
    expect(linhas.some((l) => l.metrica === "aov_venda_mrr_performance")).toBe(true);
    expect(linhas.some((l) => l.metrica === "contratos_vendidos_mrr_performance")).toBe(true);
    // não há mais linha-total in-bloco "Total MRR"
    expect(linhas.some((l) => l.metrica === "vendas_mrr" && !l.segmento)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/bp2026.vendasProduto.test.ts`
Expected: FAIL — `montarVendasProduto` ainda tem assinatura antiga (espera `db`/`atrib`), `vp_receita_total` inexistente.

- [ ] **Step 3: Write minimal implementation**

Em `server/routes/bp2026.vendasProduto.ts`:

3a. Atualizar o cabeçalho e os imports do topo:

```ts
// server/routes/bp2026.vendasProduto.ts
// Sub-aba Vendas por Produto: vendas MRR/Pontual, contratos e AOV por segmento BP.
// Realizado: "Clickup".cup_contratos por data_criado, com produto mapeado a segmento
// (bp2026.produtoSegmento). O drill-down lista os contratos do ClickUp.
// NOTA: carregarAtribuicaoVendas/parseMetricaProduto permanecem — a atribuição Bitrix
// ainda é usada pelo CAC (contratosVendidosRec em bp2026.ts).
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd } from "./bp2026.helpers";
import {
  agregarVendasProduto, aovMedioPorSegmento, parseServicosVendidos, distribuirDeal,
  agregarVendasProdutoClickup, contratosDoSegmento,
  type DealVenda, type MixClickup, type AovMedio, type ProdutoRowMix,
  type CelulaSeg, type TotalMes, type AggVendasClickup, type ContratoRow,
} from "./bp2026.vendasProduto.helpers";
import {
  SEGMENTOS_RECORRENTES, SEGMENTOS_PONTUAIS, SERVICOS_BITRIX, SLUG,
  type SegmentoBP, type Natureza,
} from "../okr2026/servicosBitrix";

const BITRIX_BASE = "https://turbopartners.bitrix24.com.br";
const ANO = 2026;
```

3b. Adicionar `semDetalhe?` à interface `Linha` (linhas 22-26):

```ts
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo"; direcao: "maior_melhor";
  unidade: "brl" | "int" | "pct"; grupo: string; segmento: string; destaque?: boolean;
  semDetalhe?: boolean;
  meses: MesLinha[]; ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}
```

3c. Adicionar o loader (logo após `carregarAtribuicaoVendas`, que permanece intacto):

```ts
// Carrega vendas por produto do ClickUp (data_criado) e agrega no formato da matriz.
export async function carregarVendasProdutoClickup(db: any): Promise<AggVendasClickup> {
  const ini = `${ANO}-01-01`, fim = `${ANO + 1}-01-01`;
  const prodRows = (await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_criado)::int AS mes,
           COALESCE(NULLIF(TRIM(produto), ''), '(sem produto)') AS produto,
           COALESCE(SUM(valorr::numeric), 0)::float AS mrr,
           COALESCE(SUM(valorp::numeric), 0)::float AS pont,
           COUNT(*) FILTER (WHERE COALESCE(valorr,0) > 0)::int AS contratos_mrr,
           COUNT(*) FILTER (WHERE COALESCE(valorp,0) > 0)::int AS contratos_pont
    FROM "Clickup".cup_contratos
    WHERE data_criado >= ${ini} AND data_criado < ${fim}
      AND LOWER(TRIM(status)) <> 'não usar'
    GROUP BY 1, 2
  `)).rows as any[];
  const totRows = (await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_criado)::int AS mes,
           COUNT(*)::int AS contratos,
           COUNT(DISTINCT id_task)::int AS clientes
    FROM "Clickup".cup_contratos
    WHERE data_criado >= ${ini} AND data_criado < ${fim}
      AND LOWER(TRIM(status)) <> 'não usar'
    GROUP BY 1
  `)).rows as any[];
  return agregarVendasProdutoClickup(
    prodRows.map((r) => ({
      mes: Number(r.mes), produto: String(r.produto),
      mrr: Number(r.mrr), pont: Number(r.pont),
      contratosMrr: Number(r.contratos_mrr), contratosPont: Number(r.contratos_pont),
    })),
    totRows.map((r) => ({ mes: Number(r.mes), contratos: Number(r.contratos), clientes: Number(r.clientes) })),
  );
}
```

3d. Substituir TODA a função `montarVendasProduto` (e a `interface Deps` e o `Object.fromEntries`/`orcKey` se necessário — manter `SEG_POR_SLUG`/`orcKey` que são usados por `parseMetricaProduto`) pela versão ClickUp:

```ts
interface Deps {
  agg: Map<number, Map<SegmentoBP, CelulaSeg>>;
  totais: Map<number, TotalMes>;
  orcado: Record<string, Record<number, number>>;
  mesCorrente: number;
  mesFechado: number;
}

export function montarVendasProduto(deps: Deps): Linha[] {
  const { agg, totais, orcado, mesCorrente, mesFechado } = deps;

  const serie = (f: (m: number) => number | null) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));
  const orcOf = (src: string | ((m: number) => number), mes: number): number =>
    typeof src === "function" ? src(mes) : (orcado[src]?.[mes] ?? 0);
  const razao = (num: number | null, den: number | null): number | null =>
    (num === null || den === null || !den) ? null : num / den;
  const somaAte = (s: (number | null)[]) =>
    s.slice(0, mesFechado).reduce<number | null>((acc, v) => (v === null ? acc : (acc ?? 0) + v), null);
  const somaOrcAte = (src: string | ((m: number) => number)) =>
    Array.from({ length: mesFechado }, (_, i) => orcOf(src, i + 1)).reduce((a, b) => a + b, 0);

  const fazLinha = (
    metrica: string, titulo: string, grupo: string, segmento: string,
    unidade: Linha["unidade"], serieReal: (number | null)[], orcSrc: string | ((m: number) => number),
    opts: { ytdOverride?: { orcado: number; realizado: number | null }; destaque?: boolean; semDetalhe?: boolean } = {}
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const o = orcOf(orcSrc, i + 1);
      const r = serieReal[i];
      return { mes: i + 1, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    const ytd = mesFechado === 0
      ? { orcado: 0, realizado: null, atingimento: null }
      : opts.ytdOverride
        ? { ...opts.ytdOverride, atingimento: calcAtingimento(opts.ytdOverride.orcado, opts.ytdOverride.realizado) }
        : (() => { const v = calcYtd(meses, mesFechado, "fluxo"); return { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) }; })();
    return {
      metrica, titulo, tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade, grupo, segmento,
      destaque: opts.destaque, semDetalhe: opts.semDetalhe, meses, ytd,
    };
  };

  const linhas: Linha[] = [];
  const t = (m: number) => totais.get(m);

  // ---- Bloco "Visão Geral" (totais; sem drill-down) ----
  const orcReceitaTotal = (m: number) => (orcado["vendas_mrr"]?.[m] ?? 0) + (orcado["vendas_pontual"]?.[m] ?? 0);
  const orcContratosTotal = (m: number) =>
    SEGMENTOS_RECORRENTES.reduce((s, seg) => s + (orcado[`contratos_vendidos_mrr_${SLUG[seg]}`]?.[m] ?? 0), 0) +
    SEGMENTOS_PONTUAIS.reduce((s, seg) => s + (orcado[`contratos_vendidos_pontual_${SLUG[seg]}`]?.[m] ?? 0), 0);
  const VG = "Visão Geral";
  linhas.push(fazLinha("vp_receita_total", "Receita Total", VG, "", "brl",
    serie((m) => (t(m)?.mrr ?? 0) + (t(m)?.pont ?? 0)), orcReceitaTotal, { destaque: true, semDetalhe: true }));
  linhas.push(fazLinha("vp_receita_mrr", "Receita MRR", VG, "", "brl",
    serie((m) => t(m)?.mrr ?? 0), "vendas_mrr", { semDetalhe: true }));
  linhas.push(fazLinha("vp_receita_pontual", "Receita Pontual", VG, "", "brl",
    serie((m) => t(m)?.pont ?? 0), "vendas_pontual", { semDetalhe: true }));
  linhas.push(fazLinha("vp_num_contratos", "Nº de Contratos", VG, "", "int",
    serie((m) => t(m)?.contratos ?? 0), orcContratosTotal, { semDetalhe: true }));
  linhas.push(fazLinha("vp_num_clientes", "Nº de Clientes", VG, "", "int",
    serie((m) => t(m)?.clientes ?? 0), () => 0, { semDetalhe: true }));

  // ---- Blocos Recorrente / Pontual por segmento ----
  const cel = (m: number, seg: SegmentoBP) => agg.get(m)?.get(seg);
  const blocos = [
    { grupo: "Recorrente", segmentos: SEGMENTOS_RECORRENTES, medida: "vendas_mrr", medidaCtr: "contratos_vendidos_mrr", medidaAov: "aov_venda_mrr", label: "MRR",
      pegaValor: (c?: CelulaSeg) => c?.mrr ?? 0, pegaCtr: (c?: CelulaSeg) => c?.contratosRec ?? 0 },
    { grupo: "Pontual", segmentos: SEGMENTOS_PONTUAIS, medida: "vendas_pontual", medidaCtr: "contratos_vendidos_pontual", medidaAov: "aov_venda_pontual", label: "Pontual",
      pegaValor: (c?: CelulaSeg) => c?.pont ?? 0, pegaCtr: (c?: CelulaSeg) => c?.contratosPont ?? 0 },
  ];
  for (const b of blocos) {
    for (const seg of b.segmentos) {
      const slug = SLUG[seg];
      const valorReal = serie((m) => b.pegaValor(cel(m, seg)));
      const ctrReal = serie((m) => b.pegaCtr(cel(m, seg)));
      const aovReal = Array.from({ length: 12 }, (_, i) => razao(valorReal[i], ctrReal[i]));
      linhas.push(fazLinha(`${b.medida}_${slug}`, `${seg} — ${b.label}`, b.grupo, seg, "brl", valorReal, `${b.medida}_${slug}`));
      linhas.push(fazLinha(`${b.medidaCtr}_${slug}`, `${seg} — Contratos`, b.grupo, seg, "int", ctrReal, `${b.medidaCtr}_${slug}`));
      const aovYtd = mesFechado === 0 ? undefined : {
        orcado: razao(somaOrcAte(`${b.medida}_${slug}`), somaOrcAte(`${b.medidaCtr}_${slug}`)) ?? 0,
        realizado: razao(somaAte(valorReal), somaAte(ctrReal)),
      };
      linhas.push(fazLinha(`${b.medidaAov}_${slug}`, `${seg} — AOV`, b.grupo, seg, "brl", aovReal, `${b.medidaAov}_${slug}`, { ytdOverride: aovYtd }));
    }
  }
  return linhas;
}
```

Nota: `SEG_POR_SLUG` e `orcKey` (linhas 28-31 originais) são usados por `parseMetricaProduto` — **manter**. A nova `montarVendasProduto` usa interpolação direta de slug, então `orcKey` pode ficar só para `parseMetricaProduto`/legado.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/bp2026.vendasProduto.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.vendasProduto.ts server/routes/bp2026.vendasProduto.test.ts
git commit -m "feat(bp2026): montarVendasProduto via ClickUp + bloco Visão Geral

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Reescrever drill-down (detalheVendaProdutoMes) para ClickUp

**Files:**
- Modify: `server/routes/bp2026.vendasProduto.ts` (substituir o corpo de `detalheVendaProdutoMes`)

**Interfaces:**
- Consumes: `contratosDoSegmento`/`ContratoRow` (Task 2), `parseMetricaProduto` (inalterado, mesmo arquivo), `ANO`.
- Produces: `detalheVendaProdutoMes(db, natureza, segmento, mes, modo): Promise<{ itens: ItemVendaDet[]; total: number }>` — agora lê do ClickUp. `ItemVendaDet` inalterado (campo `url?` deixa de ser preenchido).

- [ ] **Step 1: Write the failing test (consistência via fixture do filtro)**

A query é integração (DB), mas a lógica de filtro é a função pura `contratosDoSegmento` (já testada na Task 2). Aqui adicionamos um teste do mapeamento row→item, validando soma == total e modo contagem:

```ts
// adicionar ao server/routes/bp2026.vendasProduto.test.ts
import { montarItensVendaProduto } from "./bp2026.vendasProduto";
import type { ContratoRow } from "./bp2026.vendasProduto.helpers";

describe("montarItensVendaProduto", () => {
  const rows: ContratoRow[] = [
    { cliente: "Alpha", produto: "Performance", servico: "Gestão", status: "ativo", valorr: 300, valorp: 0, data: "2026-01-10" },
    { cliente: "Beta", produto: "Performance", servico: "Gestão", status: "cancelado/inativo", valorr: 200, valorp: 0, data: "2026-01-20" },
  ];
  it("modo valor: total = soma dos valores da natureza, ordenado desc", () => {
    const { itens, total } = montarItensVendaProduto(rows, "recorrente", "Performance", "valor");
    expect(total).toBe(500);
    expect(itens.map((i) => i.nome)).toEqual(["Alpha", "Beta"]);
    expect(itens[0].valor).toBe(300);
    expect(itens[0].grupo).toBe("Contratos");
  });
  it("modo contrato: total = contagem", () => {
    const { total } = montarItensVendaProduto(rows, "recorrente", "Performance", "contrato");
    expect(total).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/bp2026.vendasProduto.test.ts`
Expected: FAIL — `montarItensVendaProduto is not a function`.

- [ ] **Step 3: Write minimal implementation**

Em `server/routes/bp2026.vendasProduto.ts`, extrair a montagem pura e reescrever o handler (substituir TODO o corpo atual de `detalheVendaProdutoMes`, removendo o uso de deals/Bitrix):

```ts
// monta itens do drill-down a partir das linhas de contrato (pura, testável)
export function montarItensVendaProduto(
  rows: ContratoRow[], natureza: Natureza, segmento: SegmentoBP, modo: "valor" | "contrato"
): { itens: ItemVendaDet[]; total: number } {
  const doSeg = contratosDoSegmento(rows, natureza, segmento);
  const valorDe = (c: ContratoRow) => (natureza === "recorrente" ? c.valorr : c.valorp);
  const itens: ItemVendaDet[] = doSeg.map((c) => ({
    grupo: "Contratos",
    nome: c.cliente,
    detalhe: [c.servico || c.produto, c.status].filter(Boolean).join(" · "),
    data: c.data,
    valor: modo === "valor" ? valorDe(c) : 0,
  }));
  itens.sort((a, b) => b.valor - a.valor);
  const total = modo === "valor" ? doSeg.reduce((s, c) => s + valorDe(c), 0) : doSeg.length;
  return { itens, total };
}

export async function detalheVendaProdutoMes(
  db: any, natureza: Natureza, segmento: SegmentoBP, mes: number, modo: "valor" | "contrato"
): Promise<{ itens: ItemVendaDet[]; total: number }> {
  const rows = (await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
           COALESCE(NULLIF(TRIM(c.produto), ''), '(sem produto)') AS produto,
           COALESCE(c.servico, '') AS servico,
           COALESCE(c.status, '') AS status,
           COALESCE(c.valorr::numeric, 0)::float AS valorr,
           COALESCE(c.valorp::numeric, 0)::float AS valorp,
           c.data_criado::text AS data
    FROM "Clickup".cup_contratos c
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
    WHERE EXTRACT(MONTH FROM c.data_criado)::int = ${mes}
      AND c.data_criado >= ${`${ANO}-01-01`} AND c.data_criado < ${`${ANO + 1}-01-01`}
      AND LOWER(TRIM(c.status)) <> 'não usar'
  `)).rows as any[];
  const contratos: ContratoRow[] = rows.map((r) => ({
    cliente: String(r.cliente), produto: String(r.produto), servico: String(r.servico),
    status: String(r.status), valorr: Number(r.valorr), valorp: Number(r.valorp), data: r.data ?? null,
  }));
  return montarItensVendaProduto(contratos, natureza, segmento, modo);
}
```

Manter `ItemVendaDet`, `parseMetricaProduto`, `MEDIDAS_PRODUTO`, `SEG_POR_SLUG` como estão. Remover o import de `distribuirDeal`/`SERVICOS_BITRIX` **apenas se** deixarem de ser usados no arquivo (verificar: `carregarAtribuicaoVendas` ainda usa `aovMedioPorSegmento`/`parseServicosVendidos`; `parseMetricaProduto` não usa `SERVICOS_BITRIX`; o antigo `detalheVendaProdutoMes` usava `distribuirDeal`/`SERVICOS_BITRIX` — após a reescrita, remover esses dois do import se o TS apontar "declared but never used").

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/bp2026.vendasProduto.test.ts`
Expected: PASS (6 testes no total).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.vendasProduto.ts server/routes/bp2026.vendasProduto.test.ts
git commit -m "feat(bp2026): drill-down de vendas por produto lista contratos do ClickUp

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Fiar no bp2026.ts + INFO_METRICAS

**Files:**
- Modify: `server/routes/bp2026.ts` (import linha 17; montagem da aba ~linha 527)
- Modify: `server/routes/bp2026.info.ts` (adicionar entradas vp_*)

**Interfaces:**
- Consumes: `carregarVendasProdutoClickup`/`montarVendasProduto` (Tasks 3-4).

- [ ] **Step 1: Atualizar import em `server/routes/bp2026.ts`**

Linha 17 — adicionar `carregarVendasProdutoClickup`:

```ts
import { montarVendasProduto, carregarAtribuicaoVendas, carregarVendasProdutoClickup } from "./bp2026.vendasProduto";
```

(Linha 18 — `agregarVendasProduto` permanece; é usado pelo CAC.)

- [ ] **Step 2: Trocar a montagem da aba (~linhas 518-527)**

Manter as linhas 520-526 (atribuição Bitrix → `agg`/`contratosVendidosRec` do CAC) **intactas**. Substituir a linha 527:

De:
```ts
      const vendasProduto = await montarVendasProduto({ db, orcado, mesCorrente, mesFechado, atrib });
```
Para:
```ts
      const { agg: aggVendas, totais: totaisVendas } = await carregarVendasProdutoClickup(db);
      const vendasProduto = montarVendasProduto({ agg: aggVendas, totais: totaisVendas, orcado, mesCorrente, mesFechado });
```

- [ ] **Step 3: Adicionar entradas INFO_METRICAS em `server/routes/bp2026.info.ts`**

Adicionar dentro do objeto `INFO_METRICAS` (perto das entradas de vendas, ~linha 283):

```ts
  vp_receita_total: {
    definicao: "Receita total vendida no mês (MRR + Pontual), por data de criação do contrato.",
    fonte: 'ClickUp — "Clickup".cup_contratos, por data_criado (exceto status "não usar").',
    calculo: "Σ valorr + Σ valorp dos contratos criados no mês. Orçado = vendas_mrr + vendas_pontual.",
  },
  vp_receita_mrr: {
    definicao: "MRR novo vendido no mês (bookings; não é a base ativa).",
    fonte: 'ClickUp — "Clickup".cup_contratos, por data_criado.',
    calculo: "Σ valorr dos contratos criados no mês. Orçado = vendas_mrr.",
  },
  vp_receita_pontual: {
    definicao: "Receita pontual vendida no mês.",
    fonte: 'ClickUp — "Clickup".cup_contratos, por data_criado.',
    calculo: "Σ valorp dos contratos criados no mês. Orçado = vendas_pontual.",
  },
  vp_num_contratos: {
    definicao: "Contratos criados no mês.",
    fonte: 'ClickUp — "Clickup".cup_contratos, por data_criado.',
    calculo: "COUNT(*) dos contratos criados no mês. Orçado = Σ contratos_vendidos_* (pode contar 2× um contrato com MRR e Pontual).",
  },
  vp_num_clientes: {
    definicao: "Clientes distintos com contrato criado no mês.",
    fonte: 'ClickUp — "Clickup".cup_contratos, por data_criado.',
    calculo: "COUNT(DISTINCT id_task) dos contratos criados no mês. Sem orçado (não há meta de clientes novos).",
  },
```

- [ ] **Step 4: Verificar compilação e suíte completa**

Run: `npx tsc --noEmit` (ou `npm run check` se existir)
Expected: sem erros de tipo.

Run: `npx vitest run`
Expected: toda a suíte verde (inclui os testes novos + os pré-existentes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.ts server/routes/bp2026.info.ts
git commit -m "feat(bp2026): aba Vendas por Produto passa a usar ClickUp (data_criado)

Substitui a fonte do realizado da aba de Bitrix para ClickUp cup_contratos.
A atribuicao Bitrix permanece alimentando o CAC (contratosVendidosRec).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Verificação de integração (dev server + browser + números)

**Files:** nenhum (verificação). Usar `superpowers:verification-before-completion`.

- [ ] **Step 1: Obter os números esperados do banco (com o filtro de status correto)**

Run (produção, mesma credencial do design):
```bash
cd /Users/mac0267/Cortex
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "SELECT TO_CHAR(data_criado,'YYYY-MM') mes, COUNT(*) contratos, COUNT(DISTINCT id_task) clientes, COALESCE(SUM(valorr),0)::numeric(12,0) mrr, COALESCE(SUM(valorp),0)::numeric(12,0) pontual FROM \"Clickup\".cup_contratos WHERE data_criado >= '2026-01-01' AND data_criado < '2027-01-01' AND LOWER(TRIM(status)) <> 'não usar' GROUP BY 1 ORDER BY 1;"
```
Expected: tabela mês-a-mês (jan: ~196014 MRR / ~382591 pontual / 125 contratos / 74 clientes — confirmar com o filtro aplicado). Anotar como baseline.

- [ ] **Step 2: Reiniciar o dev server**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; cd /Users/mac0267/Cortex && npm run dev
```
Expected: server sobe na porta 3000 sem erro. (Atenção: o banco LOCAL pode estar desatualizado — ver memória `database-environments`. Se os números divergirem do baseline de produção, re-sincronizar `cup_contratos`/`cup_clientes` local antes de concluir.)

- [ ] **Step 3: Validar o endpoint**

Run:
```bash
curl -s "http://localhost:3000/api/bp2026/receitas" | npx --yes json -e 'this.vp=this.vendasProduto.filter(l=>l.metrica.startsWith("vp_")).map(l=>({m:l.metrica,jan:l.meses[0]}))' vp 2>/dev/null || curl -s "http://localhost:3000/api/bp2026/receitas"
```
Expected: o array `vendasProduto` contém as 5 linhas `vp_*` no topo (grupo "Visão Geral") + blocos Recorrente/Pontual; `vp_receita_mrr` de janeiro bate com o baseline (Step 1); `vp_num_clientes` orçado = 0.

- [ ] **Step 4: Validar no browser (`superpowers:verify` / claude-in-chrome)**

Abrir `http://localhost:3000/bp-2026`, aba "Vendas por Produto". Conferir:
  - Bloco "Visão Geral" no topo com Receita Total/MRR/Pontual + Nº Contratos + Nº Clientes.
  - Clicar numa célula de um segmento (ex.: Performance — MRR de janeiro) → drill-down lista **contratos do ClickUp** (cliente, serviço · status, data_criado, valor); soma dos itens == valor da célula.
  - Clicar numa célula de AOV → painel mostra o cálculo (razão), como antes.
  - Linhas `vp_*` do topo NÃO são clicáveis (semDetalhe).
  - Dark mode E light mode renderizam corretamente.

- [ ] **Step 5: Checagem de consistência célula ≡ detalhe**

Para um segmento/mês com valor: somar os itens do `/api/bp2026/detalhe?metrica=vendas_mrr_performance&mes=1` e comparar com o realizado da célula `vendas_mrr_performance` em janeiro no payload da matriz. Devem ser iguais.

- [ ] **Step 6: Pós-conclusão (workflow obrigatório do CLAUDE.md)**

  - Atualizar o vault Obsidian (TASK correspondente), se existir chamado.
  - Atualizar status do chamado no Cortex DB para `review` (se houver chamado associado).
  - `git-autopush`: garantir que todos os commits foram para `origin/feature/bp2026-vendas-produto`.

---

## Self-Review (preenchido pelo autor do plano)

**1. Cobertura do spec:**
- Receita por produto via ClickUp → Tasks 1-3 (de-para + agg + montagem). ✅
- Filtro por data_criado → Tasks 3-4 (queries por `data_criado`). ✅
- Linha Superior (Receita Total/MRR/Pontual) → Task 3 (bloco Visão Geral). ✅
- Nº Contratos + Nº Clientes → Task 3. ✅
- Orçado × Realizado por produto → Task 3 (reaproveita orçado por segmento). ✅
- Manter AOV → Task 3 (chaves preservadas; AOV client-side intacto). ✅
- Substituir Bitrix → Tasks 3-5 (montagem e drill-down trocados; CAC fora de escopo). ✅
- Drill-down ClickUp → Task 4. ✅

**2. Placeholder scan:** sem TODO/TBD; os `[REVISAR]` são marcadores de design (de-para) que o usuário já aprovou revisar — ficam como comentários no código, não bloqueiam. ✅

**3. Type consistency:** `CelulaSeg` (helpers) reusado em agg/montagem; `montarVendasProduto` muda assinatura (recebe `agg`/`totais`, não `db`/`atrib`) e a chamada em `bp2026.ts` é atualizada na Task 5; `Linha` ganha `semDetalhe?` na Task 3 antes de ser usado; chaves de métrica por segmento idênticas às atuais (`vendas_mrr_<slug>` etc.) → AOV client-side e parseMetricaProduto seguem válidos. ✅
