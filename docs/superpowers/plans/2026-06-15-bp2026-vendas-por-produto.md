# BP 2026 — Vendas por Produto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar a sub-aba "Vendas por Produto" ao BP 2026 — matriz serviço × mês (realizado·orçado·atingimento) das métricas de venda quebradas por segmento, com o valor por produto derivado do Bitrix + ClickUp.

**Architecture:** Realizado vem da `Bitrix.crm_deal` (deals ganhos por `data_fechamento`), expandindo `servicos_vendidos` via um de-para ID→segmento. O valor de cada deal é atribuído aos segmentos por uma cascata pura e testável: produto único → valor direto; multi-produto → mix do ClickUp (proporção) × total do Bitrix; sem cobertura → AOV médio. Orçado vem de novas chaves `vendas_*` em `cortex_core.bp2026_orcado`. Frontend reusa o componente de tabela do BP numa nova aba.

**Tech Stack:** Node/Express, Drizzle (`db.execute(sql\`...\`)`), Postgres (GCP), React + TS, Tailwind (dark/light), Vitest (test runner do projeto), Python (seed do orçado).

**Spec:** `docs/superpowers/specs/2026-06-15-bp2026-vendas-por-produto-design.md`

**Decisão travada (cobertura parcial do ClickUp):** se o ClickUp não tiver valor positivo para **todos** os segmentos da natureza presente no deal, o deal inteiro cai no fallback de AOV médio (não mistura mix parcial + AOV no mesmo deal). É a opção mais auditável.

---

## File Structure

- Create `server/okr2026/servicosBitrix.ts` — de-para ID→{nome,natureza,segmento} + parsers. Sem dependências.
- Create `server/okr2026/servicosBitrix.test.ts` — testes do de-para/parser.
- Create `server/routes/bp2026.vendasProduto.helpers.ts` — lógica pura: AOV médio, cascata de atribuição de valor, agregação por mês/segmento. Depende só de `servicosBitrix.ts`.
- Create `server/routes/bp2026.vendasProduto.helpers.test.ts` — testes da cascata com os casos reais.
- Create `server/routes/bp2026.vendasProduto.ts` — `montarVendasProduto(deps)`: queries (deals + mix ClickUp) + monta `Linha[]`. Depende dos helpers acima e de `bp2026.helpers.ts`.
- Modify `server/routes/bp2026.ts` — chamar `montarVendasProduto` e expor `vendasProduto` no payload.
- Modify `scripts/seed-bp2026-orcado.py` — novas métricas `vendas_*` por produto.
- Modify `client/src/pages/BP2026.tsx` — nova aba "Vendas por Produto".

---

## Task 0: Setup — coluna `servicos_vendidos` no banco local

**Files:** nenhum (setup de ambiente).

- [ ] **Step 1: Verificar se a coluna existe no local**

Run:
```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "SELECT column_name FROM information_schema.columns WHERE table_schema='Bitrix' AND table_name='crm_deal' AND column_name='servicos_vendidos';"
```
Expected: 0 rows (não existe) — pois hoje só está no prod.

- [ ] **Step 2: Criar a coluna e popular a partir de `produtos` (idêntica em 100% dos deals)**

Run:
```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "ALTER TABLE \"Bitrix\".crm_deal ADD COLUMN IF NOT EXISTS servicos_vendidos varchar; UPDATE \"Bitrix\".crm_deal SET servicos_vendidos = produtos WHERE servicos_vendidos IS NULL;"
```
Expected: `ALTER TABLE` + `UPDATE <n>`.

- [ ] **Step 3: Confirmar baseline de testes verde**

Run: `npx vitest run server/routes/bp2026.helpers.test.ts`
Expected: PASS (sanity do runner antes de começar).

---

## Task 1: De-para de serviços do Bitrix

**Files:**
- Create: `server/okr2026/servicosBitrix.ts`
- Test: `server/okr2026/servicosBitrix.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// server/okr2026/servicosBitrix.test.ts
import { describe, it, expect } from "vitest";
import { SERVICOS_BITRIX, parseServicosVendidos, segmentosPorNatureza } from "./servicosBitrix";

describe("de-para de serviços Bitrix", () => {
  it("mapeia os IDs nomeados para o segmento certo", () => {
    expect(SERVICOS_BITRIX[846].segmento).toBe("Performance");
    expect(SERVICOS_BITRIX[852].segmento).toBe("Creators");
    expect(SERVICOS_BITRIX[848].segmento).toBe("Social");
    expect(SERVICOS_BITRIX[870].segmento).toBe("Gestão de Comunidade");
    expect(SERVICOS_BITRIX[868].segmento).toBe("E-commerce");
    expect(SERVICOS_BITRIX[880].segmento).toBe("Site Institucional");
    expect(SERVICOS_BITRIX[882].segmento).toBe("Landing Page");
  });

  it("classifica natureza recorrente vs pontual", () => {
    expect(SERVICOS_BITRIX[846].natureza).toBe("recorrente");
    expect(SERVICOS_BITRIX[850].natureza).toBe("pontual");
    expect(SERVICOS_BITRIX[868].natureza).toBe("pontual");
  });

  it("serviços não nomeados caem em Others", () => {
    expect(SERVICOS_BITRIX[858].segmento).toBe("Others");   // Sustentação (rec)
    expect(SERVICOS_BITRIX[856].segmento).toBe("Others");   // CRO Pontual
  });

  it("parseServicosVendidos extrai IDs e ignora vazios/False", () => {
    expect(parseServicosVendidos("[846, 852]")).toEqual([846, 852]);
    expect(parseServicosVendidos("[850]")).toEqual([850]);
    expect(parseServicosVendidos("False")).toEqual([]);
    expect(parseServicosVendidos("[]")).toEqual([]);
    expect(parseServicosVendidos(null)).toEqual([]);
  });

  it("segmentosPorNatureza devolve segmentos distintos por natureza", () => {
    // [846 Perf-rec, 848 Social-rec, 850 CreatorsPontual-pont, 868 Ecom-pont]
    const r = segmentosPorNatureza([846, 848, 850, 868]);
    expect(r.recorrente.sort()).toEqual(["Performance", "Social"].sort());
    expect(r.pontual.sort()).toEqual(["E-commerce", "Others"].sort());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/okr2026/servicosBitrix.test.ts`
Expected: FAIL ("Cannot find module './servicosBitrix'").

- [ ] **Step 3: Implementar o módulo**

```ts
// server/okr2026/servicosBitrix.ts
// De-para do campo UF_CRM_1755009751812 (Bitrix) -> segmento do BP.
// Decodificado da API Bitrix (crm.deal.userfield.list) em 2026-06-15.
export type Natureza = "recorrente" | "pontual";
export type SegmentoBP =
  | "Performance" | "Creators" | "Social" | "Gestão de Comunidade"
  | "E-commerce" | "Site Institucional" | "Landing Page" | "Others";

export interface ServicoBitrix { id: number; nome: string; natureza: Natureza; segmento: SegmentoBP; }

export const SERVICOS_BITRIX: Record<number, ServicoBitrix> = {
  846: { id: 846, nome: "Gestão de Performance", natureza: "recorrente", segmento: "Performance" },
  852: { id: 852, nome: "Creators Recorrente", natureza: "recorrente", segmento: "Creators" },
  848: { id: 848, nome: "Social Media", natureza: "recorrente", segmento: "Social" },
  870: { id: 870, nome: "Gestão de Comunidade", natureza: "recorrente", segmento: "Gestão de Comunidade" },
  876: { id: 876, nome: "Personalizado Recorrente", natureza: "recorrente", segmento: "Others" },
  858: { id: 858, nome: "Sustentação", natureza: "recorrente", segmento: "Others" },
  860: { id: 860, nome: "E-mail Marketing", natureza: "recorrente", segmento: "Others" },
  854: { id: 854, nome: "CRM", natureza: "recorrente", segmento: "Others" },
  878: { id: 878, nome: "SEO Full", natureza: "recorrente", segmento: "Others" },
  1678: { id: 1678, nome: "Turbooh", natureza: "recorrente", segmento: "Others" },
  864: { id: 864, nome: "Automação", natureza: "recorrente", segmento: "Others" },
  866: { id: 866, nome: "Blog Post", natureza: "recorrente", segmento: "Others" },
  884: { id: 884, nome: "Agente de IA", natureza: "recorrente", segmento: "Others" },
  868: { id: 868, nome: "E-commerce", natureza: "pontual", segmento: "E-commerce" },
  880: { id: 880, nome: "Site Institucional", natureza: "pontual", segmento: "Site Institucional" },
  882: { id: 882, nome: "Landing Page", natureza: "pontual", segmento: "Landing Page" },
  850: { id: 850, nome: "Creators Pontual", natureza: "pontual", segmento: "Others" },
  856: { id: 856, nome: "CRO Pontual", natureza: "pontual", segmento: "Others" },
  874: { id: 874, nome: "Personalizado Pontual", natureza: "pontual", segmento: "Others" },
  1684: { id: 1684, nome: "TikTok Shop", natureza: "pontual", segmento: "Others" },
  872: { id: 872, nome: "Identidade Visual", natureza: "pontual", segmento: "Others" },
  862: { id: 862, nome: "Estruturação Estratégica", natureza: "pontual", segmento: "Others" },
  1774: { id: 1774, nome: "Estruturação Comercial", natureza: "pontual", segmento: "Others" },
  1778: { id: 1778, nome: "Estruturação estratégica", natureza: "pontual", segmento: "Others" },
  1674: { id: 1674, nome: "Fee de Implantação", natureza: "pontual", segmento: "Others" },
};

export const SEGMENTOS_RECORRENTES: SegmentoBP[] = ["Performance", "Creators", "Social", "Gestão de Comunidade", "Others"];
export const SEGMENTOS_PONTUAIS: SegmentoBP[] = ["E-commerce", "Site Institucional", "Landing Page", "Others"];

// Parse "[846, 852]" / "False" / "[]" / null -> number[]
export function parseServicosVendidos(raw: string | null | undefined): number[] {
  if (!raw || raw === "False" || raw === "[]") return [];
  return raw.replace(/[[\] ]/g, "").split(",").filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
}

// Segmentos distintos presentes no deal, por natureza. ID desconhecido -> Others (natureza recorrente por padrão e pontual: ignorado salvo se houver valor — tratado no helper de valor).
export function segmentosPorNatureza(ids: number[]): { recorrente: SegmentoBP[]; pontual: SegmentoBP[] } {
  const rec = new Set<SegmentoBP>();
  const pont = new Set<SegmentoBP>();
  for (const id of ids) {
    const s = SERVICOS_BITRIX[id];
    if (!s) continue;
    (s.natureza === "recorrente" ? rec : pont).add(s.segmento);
  }
  return { recorrente: Array.from(rec), pontual: Array.from(pont) };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/okr2026/servicosBitrix.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/okr2026/servicosBitrix.ts server/okr2026/servicosBitrix.test.ts
git commit -m "feat(bp2026): de-para de serviços vendidos do Bitrix -> segmento BP"
```

---

## Task 2: Cascata de atribuição de valor (lógica pura)

**Files:**
- Create: `server/routes/bp2026.vendasProduto.helpers.ts`
- Test: `server/routes/bp2026.vendasProduto.helpers.test.ts`

Tipos e contrato:
- `DealVenda = { id: number; cnpjNorm: string; mes: number; valorRec: number; valorPont: number; ids: number[] }`
- `MixClickup = Map<string, Map<SegmentoBP, number>>` — por CNPJ, valor `valorr`(rec) somado por segmento (mix recorrente). Para pontual usa-se um segundo mapa análogo de `valorp`.
- `AovMedio = Record<string, number>` (chave = SegmentoBP) — peso de fallback.
- `distribuirDeal(deal, mixRec, mixPont, aovRec, aovPont)` retorna `{ segmento: SegmentoBP; natureza: Natureza; valor: number; contrato: 1 }[]`.
- `agregarVendasProduto(deals, mixRec, mixPont, aovRec, aovPont)` retorna `Map<mes, Map<SegmentoBP, { mrr; pont; contratosRec; contratosPont }>>`.

- [ ] **Step 1: Escrever o teste que falha (casos reais validados no prod)**

```ts
// server/routes/bp2026.vendasProduto.helpers.test.ts
import { describe, it, expect } from "vitest";
import { distribuirDeal, aovMedioPorSegmento } from "./bp2026.vendasProduto.helpers";

const noMix = new Map<string, Map<any, number>>();
const aovVazio = {} as Record<string, number>;

describe("distribuirDeal", () => {
  it("produto único: valor inteiro vai para o segmento", () => {
    const r = distribuirDeal(
      { id: 1, cnpjNorm: "X", mes: 6, valorRec: 2997, valorPont: 0, ids: [846] },
      noMix, noMix, aovVazio, aovVazio
    );
    expect(r).toEqual([{ segmento: "Performance", natureza: "recorrente", valor: 2997, contrato: 1 }]);
  });

  it("multi-produto com mix do ClickUp cobrindo todos os segmentos: usa proporção, total = deal (Badbeat)", () => {
    const mixRec = new Map([["BAD", new Map<any, number>([["Performance", 2801], ["Social", 2501], ["Creators", 5498]])]]);
    const r = distribuirDeal(
      { id: 2, cnpjNorm: "BAD", mes: 5, valorRec: 10800, valorPont: 0, ids: [846, 848, 852] },
      mixRec, noMix, aovVazio, aovVazio
    );
    const total = r.reduce((s, x) => s + x.valor, 0);
    expect(Math.round(total)).toBe(10800);
    const perf = r.find((x) => x.segmento === "Performance")!;
    expect(Math.round(perf.valor)).toBe(2801); // 10800 * 2801/10800
  });

  it("mix parcial (ClickUp não cobre todos os segmentos) -> fallback AOV no deal todo (Flico)", () => {
    const mixRec = new Map([["FLI", new Map<any, number>([["Social", 2734]])]]); // faltam Performance e Creators
    const aovRec = { Performance: 4000, Social: 2000, Creators: 6000 };
    const r = distribuirDeal(
      { id: 3, cnpjNorm: "FLI", mes: 5, valorRec: 11500, valorPont: 0, ids: [846, 848, 852] },
      mixRec, noMix, aovRec, {}
    );
    const total = r.reduce((s, x) => s + x.valor, 0);
    expect(Math.round(total)).toBe(11500);
    // pesos AOV 4000:2000:6000 = 1/3 : 1/6 : 1/2
    expect(Math.round(r.find((x) => x.segmento === "Creators")!.valor)).toBe(5750); // 11500/2
  });

  it("rec e pont no mesmo deal: cada natureza usa seu valor (Clube45-like)", () => {
    // [846 Perf-rec, 868 Ecom-pont]; rec=6000 pont=7000
    const r = distribuirDeal(
      { id: 4, cnpjNorm: "Y", mes: 5, valorRec: 6000, valorPont: 7000, ids: [846, 868] },
      noMix, noMix, aovVazio, aovVazio
    );
    expect(r.find((x) => x.segmento === "Performance")!.valor).toBe(6000);
    expect(r.find((x) => x.segmento === "E-commerce")!.valor).toBe(7000);
  });

  it("conta 1 contrato por segmento distinto da natureza", () => {
    const r = distribuirDeal(
      { id: 5, cnpjNorm: "Z", mes: 5, valorRec: 6000, valorPont: 0, ids: [846, 848] },
      new Map([["Z", new Map<any, number>([["Performance", 1], ["Social", 1]])]]), noMix, {}, {}
    );
    expect(r.filter((x) => x.contrato === 1).length).toBe(2);
  });
});

describe("aovMedioPorSegmento", () => {
  it("média do valor recorrente dos deals de segmento recorrente único", () => {
    const deals = [
      { id: 1, cnpjNorm: "", mes: 1, valorRec: 3000, valorPont: 0, ids: [846] },
      { id: 2, cnpjNorm: "", mes: 1, valorRec: 5000, valorPont: 0, ids: [846] },
      { id: 3, cnpjNorm: "", mes: 1, valorRec: 9999, valorPont: 0, ids: [846, 848] }, // multi -> ignorado
    ];
    expect(aovMedioPorSegmento(deals, "recorrente").Performance).toBe(4000);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/bp2026.vendasProduto.helpers.test.ts`
Expected: FAIL ("Cannot find module './bp2026.vendasProduto.helpers'").

- [ ] **Step 3: Implementar os helpers**

```ts
// server/routes/bp2026.vendasProduto.helpers.ts
import {
  SERVICOS_BITRIX, parseServicosVendidos, segmentosPorNatureza,
  type SegmentoBP, type Natureza,
} from "../okr2026/servicosBitrix";

export interface DealVenda {
  id: number; cnpjNorm: string; mes: number;
  valorRec: number; valorPont: number; ids: number[];
}
export type MixClickup = Map<string, Map<SegmentoBP, number>>;
export type AovMedio = Record<string, number>;
export interface ParteDeal { segmento: SegmentoBP; natureza: Natureza; valor: number; contrato: 1 }

// Distribui um valor entre segmentos usando pesos; se pesos inválidos (soma 0 ou
// algum segmento sem peso), retorna null para sinalizar fallback.
function pesar(valor: number, segmentos: SegmentoBP[], pesos: Map<SegmentoBP, number> | undefined): Map<SegmentoBP, number> | null {
  if (!pesos) return null;
  let soma = 0;
  for (const s of segmentos) {
    const p = pesos.get(s);
    if (!p || p <= 0) return null; // cobertura incompleta -> fallback
    soma += p;
  }
  if (soma <= 0) return null;
  const out = new Map<SegmentoBP, number>();
  for (const s of segmentos) out.set(s, (valor * (pesos.get(s) as number)) / soma);
  return out;
}

function pesosAov(segmentos: SegmentoBP[], aov: AovMedio): Map<SegmentoBP, number> {
  const m = new Map<SegmentoBP, number>();
  for (const s of segmentos) m.set(s, aov[s] && aov[s] > 0 ? aov[s] : 1); // sem AOV -> peso igual
  return m;
}

function distribuirNatureza(
  valor: number, segmentos: SegmentoBP[], natureza: Natureza,
  mix: Map<SegmentoBP, number> | undefined, aov: AovMedio
): ParteDeal[] {
  if (valor <= 0 || segmentos.length === 0) return [];
  if (segmentos.length === 1) {
    return [{ segmento: segmentos[0], natureza, valor, contrato: 1 }];
  }
  const pesado = pesar(valor, segmentos, mix) ?? pesar(valor, segmentos, pesosAov(segmentos, aov))!;
  return segmentos.map((s) => ({ segmento: s, natureza, valor: pesado.get(s) ?? 0, contrato: 1 as const }));
}

export function distribuirDeal(
  deal: DealVenda, mixRec: MixClickup, mixPont: MixClickup, aovRec: AovMedio, aovPont: AovMedio
): ParteDeal[] {
  const { recorrente, pontual } = segmentosPorNatureza(deal.ids);
  // valor recorrente sem segmento recorrente identificado -> Others
  const segRec = recorrente.length ? recorrente : (deal.valorRec > 0 ? (["Others"] as SegmentoBP[]) : []);
  const segPont = pontual.length ? pontual : (deal.valorPont > 0 ? (["Others"] as SegmentoBP[]) : []);
  return [
    ...distribuirNatureza(deal.valorRec, segRec, "recorrente", mixRec.get(deal.cnpjNorm), aovRec),
    ...distribuirNatureza(deal.valorPont, segPont, "pontual", mixPont.get(deal.cnpjNorm), aovPont),
  ];
}

export function aovMedioPorSegmento(deals: DealVenda[], natureza: Natureza): AovMedio {
  const acc: Record<string, { soma: number; n: number }> = {};
  for (const d of deals) {
    const seg = segmentosPorNatureza(d.ids)[natureza];
    if (seg.length !== 1) continue; // só deals de segmento único têm valor limpo
    const valor = natureza === "recorrente" ? d.valorRec : d.valorPont;
    if (valor <= 0) continue;
    const k = seg[0];
    acc[k] = acc[k] ?? { soma: 0, n: 0 };
    acc[k].soma += valor; acc[k].n += 1;
  }
  const out: AovMedio = {};
  for (const k of Object.keys(acc)) out[k] = acc[k].soma / acc[k].n;
  return out;
}

export interface CelulaSeg { mrr: number; pont: number; contratosRec: number; contratosPont: number }
export function agregarVendasProduto(
  deals: DealVenda[], mixRec: MixClickup, mixPont: MixClickup, aovRec: AovMedio, aovPont: AovMedio
): Map<number, Map<SegmentoBP, CelulaSeg>> {
  const out = new Map<number, Map<SegmentoBP, CelulaSeg>>();
  for (const d of deals) {
    const partes = distribuirDeal(d, mixRec, mixPont, aovRec, aovPont);
    const porMes = out.get(d.mes) ?? new Map<SegmentoBP, CelulaSeg>();
    for (const p of partes) {
      const c = porMes.get(p.segmento) ?? { mrr: 0, pont: 0, contratosRec: 0, contratosPont: 0 };
      if (p.natureza === "recorrente") { c.mrr += p.valor; c.contratosRec += p.contrato; }
      else { c.pont += p.valor; c.contratosPont += p.contrato; }
      porMes.set(p.segmento, c);
    }
    out.set(d.mes, porMes);
  }
  return out;
}

export { parseServicosVendidos, SERVICOS_BITRIX };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/routes/bp2026.vendasProduto.helpers.test.ts`
Expected: PASS (6 tests). Se o caso Flico falhar no valor 5750, conferir os pesos AOV no teste.

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.vendasProduto.helpers.ts server/routes/bp2026.vendasProduto.helpers.test.ts
git commit -m "feat(bp2026): cascata de atribuição de valor de venda por produto (pura, testada)"
```

---

## Task 3: Assembler `montarVendasProduto` (queries + Linha[])

**Files:**
- Create: `server/routes/bp2026.vendasProduto.ts`

Reusa o shape `Linha`/`MesLinha` do funil (copiar a interface local de `bp2026.funil.ts:7-14`) e os helpers `calcAtingimento`/`calcYtd` de `bp2026.helpers.ts`.

- [ ] **Step 1: Implementar o módulo**

```ts
// server/routes/bp2026.vendasProduto.ts
// Sub-aba Vendas por Produto: vendas MRR/Pontual, contratos e AOV por segmento BP.
// Realizado: Bitrix.crm_deal (servicos_vendidos) com valor atribuído pela cascata
// (produto único -> mix ClickUp -> AOV). Total por natureza fecha com o funil agregado.
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd } from "./bp2026.helpers";
import {
  agregarVendasProduto, aovMedioPorSegmento, parseServicosVendidos,
  type DealVenda, type MixClickup,
} from "./bp2026.vendasProduto.helpers";
import {
  SEGMENTOS_RECORRENTES, SEGMENTOS_PONTUAIS, type SegmentoBP,
} from "../okr2026/servicosBitrix";

interface MesLinha { mes: number; orcado: number; realizado: number | null; atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo"; direcao: "maior_melhor";
  unidade: "brl" | "int" | "pct"; grupo: string; segmento: string;
  meses: MesLinha[]; ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

// metrica orçado por (medida, segmento). Ex.: ("vendas_mrr","Performance") -> "vendas_mrr_performance"
const SLUG: Record<SegmentoBP, string> = {
  "Performance": "performance", "Creators": "creators", "Social": "social",
  "Gestão de Comunidade": "gc", "Others": "others",
  "E-commerce": "ecommerce", "Site Institucional": "site", "Landing Page": "landing",
};
const orcKey = (medida: string, seg: SegmentoBP) => `${medida}_${SLUG[seg]}`;

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  mesCorrente: number;
  mesFechado: number;
}

export async function montarVendasProduto(deps: Deps): Promise<Linha[]> {
  const { db, orcado, mesCorrente, mesFechado } = deps;

  // 1. Deals ganhos 2026 com serviços + cnpj normalizado
  const dealsRows = (await db.execute(sql`
    SELECT id,
           EXTRACT(MONTH FROM data_fechamento)::int AS mes,
           regexp_replace(COALESCE(cnpj,''),'\\D','','g') AS cnpj_norm,
           COALESCE(valor_recorrente::numeric,0) AS vr,
           COALESCE(valor_pontual::numeric,0) AS vp,
           servicos_vendidos
    FROM "Bitrix".crm_deal
    WHERE stage_name = 'Negócio Ganho'
      AND data_fechamento >= '2026-01-01' AND data_fechamento < '2027-01-01'
      AND (COALESCE(valor_recorrente,0) > 0 OR COALESCE(valor_pontual,0) > 0)
  `)).rows as any[];

  const deals: DealVenda[] = dealsRows.map((r) => ({
    id: Number(r.id), mes: Number(r.mes),
    cnpjNorm: r.cnpj_norm && [14, 11].includes(r.cnpj_norm.length) ? r.cnpj_norm : "",
    valorRec: parseFloat(r.vr), valorPont: parseFloat(r.vp),
    ids: parseServicosVendidos(r.servicos_vendidos),
  }));

  // 2. Mix do ClickUp: por CNPJ, valorr (rec) e valorp (pont) somados por segmento
  const cnpjs = Array.from(new Set(deals.map((d) => d.cnpjNorm).filter(Boolean)));
  const mixRec: MixClickup = new Map();
  const mixPont: MixClickup = new Map();
  if (cnpjs.length) {
    const mixRows = (await db.execute(sql`
      SELECT regexp_replace(COALESCE(cc.cnpj,''),'\\D','','g') AS cnpj_norm,
             CASE
               WHEN c.produto = 'Performance' THEN 'Performance'
               WHEN c.produto IN ('Creators','Creators - Recorrente') THEN 'Creators'
               WHEN c.produto = 'Social Media' THEN 'Social'
               WHEN c.produto = 'Gestão de Comunidade' THEN 'Gestão de Comunidade'
               WHEN c.produto = 'Ecommerce' THEN 'E-commerce'
               WHEN c.produto = 'Site' THEN 'Site Institucional'
               WHEN c.produto = 'Landing Page' THEN 'Landing Page'
               ELSE 'Others'
             END AS segmento,
             COALESCE(SUM(c.valorr::numeric),0) AS rec,
             COALESCE(SUM(c.valorp::numeric),0) AS pont
      FROM "Clickup".cup_clientes cc
      JOIN "Clickup".cup_contratos c ON c.id_task = cc.task_id
      WHERE regexp_replace(COALESCE(cc.cnpj,''),'\\D','','g') = ANY(${cnpjs})
      GROUP BY 1, 2
    `)).rows as any[];
    for (const row of mixRows) {
      const seg = row.segmento as SegmentoBP;
      const rec = parseFloat(row.rec), pont = parseFloat(row.pont);
      if (rec > 0) {
        const m = mixRec.get(row.cnpj_norm) ?? new Map<SegmentoBP, number>();
        m.set(seg, (m.get(seg) ?? 0) + rec); mixRec.set(row.cnpj_norm, m);
      }
      if (pont > 0) {
        const m = mixPont.get(row.cnpj_norm) ?? new Map<SegmentoBP, number>();
        m.set(seg, (m.get(seg) ?? 0) + pont); mixPont.set(row.cnpj_norm, m);
      }
    }
  }

  // 3. AOV médio (fallback) e agregação por mês/segmento
  const aovRec = aovMedioPorSegmento(deals, "recorrente");
  const aovPont = aovMedioPorSegmento(deals, "pontual");
  const agg = agregarVendasProduto(deals, mixRec, mixPont, aovRec, aovPont);

  // 4. Montar linhas: para cada segmento (rec e pont), 3 linhas — valor, contratos, AOV
  const serie = (f: (m: number) => number | null) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));

  const fazLinha = (
    metrica: string, titulo: string, grupo: string, segmento: string,
    unidade: Linha["unidade"], serieReal: (number | null)[], orcadoMetrica: string
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const o = orcado[orcadoMetrica]?.[i + 1] ?? 0;
      const r = serieReal[i];
      return { mes: i + 1, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    const ytd = mesFechado === 0
      ? { orcado: 0, realizado: null, atingimento: null }
      : (() => { const v = calcYtd(meses, mesFechado, "fluxo"); return { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) }; })();
    return { metrica, titulo, tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade, grupo, segmento, meses, ytd };
  };

  const cel = (m: number, seg: SegmentoBP) => agg.get(m)?.get(seg);
  const linhas: Linha[] = [];

  const blocos: Array<{ grupo: string; segmentos: SegmentoBP[]; medidaValor: "vendas_mrr" | "vendas_pontual"; pegaValor: (c: any) => number; pegaCtr: (c: any) => number }> = [
    { grupo: "Recorrente", segmentos: SEGMENTOS_RECORRENTES, medidaValor: "vendas_mrr", pegaValor: (c) => c?.mrr ?? 0, pegaCtr: (c) => c?.contratosRec ?? 0 },
    { grupo: "Pontual", segmentos: SEGMENTOS_PONTUAIS, medidaValor: "vendas_pontual", pegaValor: (c) => c?.pont ?? 0, pegaCtr: (c) => c?.contratosPont ?? 0 },
  ];

  for (const b of blocos) {
    for (const seg of b.segmentos) {
      const valorReal = serie((m) => b.pegaValor(cel(m, seg)));
      const ctrReal = serie((m) => b.pegaCtr(cel(m, seg)));
      const aovReal = Array.from({ length: 12 }, (_, i) => {
        const v = valorReal[i], n = ctrReal[i];
        return v === null || n === null || !n ? null : v / n;
      });
      const medidaAov = b.medidaValor === "vendas_mrr" ? "aov_venda_mrr" : "aov_venda_pontual";
      const medidaCtr = b.medidaValor === "vendas_mrr" ? "contratos_vendidos_mrr" : "contratos_vendidos_pontual";
      linhas.push(fazLinha(`${b.medidaValor}_${SLUG[seg]}`, `${seg} — ${b.grupo === "Recorrente" ? "MRR" : "Pontual"}`, b.grupo, seg, "brl", valorReal, orcKey(b.medidaValor, seg)));
      linhas.push(fazLinha(`${medidaCtr}_${SLUG[seg]}`, `${seg} — Contratos`, b.grupo, seg, "int", ctrReal, orcKey(medidaCtr, seg)));
      linhas.push(fazLinha(`${medidaAov}_${SLUG[seg]}`, `${seg} — AOV`, b.grupo, seg, "brl", aovReal, orcKey(medidaAov, seg)));
    }
  }
  return linhas;
}
```

- [ ] **Step 2: Verificar compilação (tsc)**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep vendasProduto || echo "OK sem erros no módulo"`
Expected: "OK sem erros no módulo".

- [ ] **Step 3: Commit**

```bash
git add server/routes/bp2026.vendasProduto.ts
git commit -m "feat(bp2026): assembler montarVendasProduto (deals Bitrix + mix ClickUp)"
```

---

## Task 4: Ligar no payload do BP 2026

**Files:**
- Modify: `server/routes/bp2026.ts`

- [ ] **Step 1: Importar o assembler**

Adicionar perto de `import { montarFunil } from "./bp2026.funil";` (linha 16):
```ts
import { montarVendasProduto } from "./bp2026.vendasProduto";
```

- [ ] **Step 2: Chamar após o funil (depois da linha 513)**

```ts
      // 12b. Vendas por Produto (sub-aba)
      const vendasProduto = await montarVendasProduto({ db, orcado, mesCorrente, mesFechado });
```

- [ ] **Step 3: Expor no payload (no objeto `payload`, junto de `funil:`, ~linha 548)**

```ts
        vendasProduto: anexarInfo(vendasProduto),
```

- [ ] **Step 4: Reiniciar o server e checar o endpoint**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; (npm run dev &) ; sleep 6
curl -s http://localhost:3000/api/bp2026/receitas | python3 -c "import sys,json; d=json.load(sys.stdin); vp=d['vendasProduto']; print('linhas:', len(vp)); print([l['titulo'] for l in vp[:6]])"
```
Expected: `linhas: 27` (5 rec × 3 + 4 pont × 3 = 27) e títulos como "Performance — MRR".

- [ ] **Step 5: Validar que a soma por produto fecha com o funil (mês fechado, ex. maio=5)**

Run:
```bash
curl -s http://localhost:3000/api/bp2026/receitas | python3 -c "
import sys,json
d=json.load(sys.stdin)
def soma(metric_pref, mes):
    return sum((l['meses'][mes-1]['realizado'] or 0) for l in d['vendasProduto'] if l['metrica'].startswith(metric_pref))
funil_mrr=[l for l in d['funil'] if l['metrica']=='funil_vendas_mrr'][0]['meses'][4]['realizado']
print('soma produto MRR mai:', round(soma('vendas_mrr_',5)), '| funil MRR mai:', round(funil_mrr))
"
```
Expected: os dois valores praticamente iguais (diferença só de centavos de arredondamento).

- [ ] **Step 6: Commit**

```bash
git add server/routes/bp2026.ts
git commit -m "feat(bp2026): expor vendasProduto no payload de /api/bp2026/receitas"
```

---

## Task 5: Orçado de vendas por produto (seed)

**Files:**
- Modify: `scripts/seed-bp2026-orcado.py`

Métricas novas (chaves `metrica` na `cortex_core.bp2026_orcado`), por mês 2026:
- `vendas_mrr_{performance,creators,social,gc,others}`
- `contratos_vendidos_mrr_{...}` e `aov_venda_mrr_{...}`
- `vendas_pontual_{ecommerce,site,landing,others}`
- `contratos_vendidos_pontual_{...}` e `aov_venda_pontual_{...}`

Valores: aba **CAC** da planilha (imagem 2). Recorrente está 100% visível (Performance MRR 64.500→90.000, AOV 3.000, Contratos 22→30; Creators, Social, GC, Others idem). **Pontual:** E-commerce 42% AOV 15.000, Site 10% AOV 12.000, Landing 8% — as demais linhas pontuais estavam cortadas no print; ler os valores restantes direto da aba CAC antes de semear.

- [ ] **Step 1: Ler os valores faltantes do pontual na planilha CAC** (E-commerce/Site/Landing/Others: MRR/Pontual, AOV, Contratos por mês). Registrar no script como dicionário, no mesmo padrão dos targets recorrentes.

- [ ] **Step 2: Adicionar as métricas ao seed** seguindo o padrão existente do arquivo (mesma estrutura de `metrica, mes, valor`). Derivar `aov_venda_*` = vendas ÷ contratos quando a planilha só der dois dos três.

- [ ] **Step 3: Rodar o seed no banco LOCAL**

Run: `python3 scripts/seed-bp2026-orcado.py` (conferir no topo do script que aponta para o local)
Expected: insert/upsert das novas métricas, sem erro.

- [ ] **Step 4: Aplicar também no PROD** (regra obrigatória: schema/seed sempre nos dois — ver memória `feedback_db_prod_sync`). Rodar o mesmo seed apontando para prod, ou gerar os INSERTs e aplicar via psql no prod.

- [ ] **Step 5: Validar orçado presente**

Run:
```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "SELECT metrica, valor FROM cortex_core.bp2026_orcado WHERE mes=1 AND metrica LIKE 'vendas_mrr_%' ORDER BY 1;"
```
Expected: 5 linhas (performance/creators/social/gc/others) com os valores da planilha. Soma ≈ vendas_mrr (215.000).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-bp2026-orcado.py
git commit -m "feat(bp2026): seed do orçado de vendas por produto (recorrente + pontual)"
```

---

## Task 6: Frontend — nova sub-aba "Vendas por Produto"

**Files:**
- Modify: `client/src/pages/BP2026.tsx`

- [ ] **Step 1: Tipar o novo campo no payload**

No bloco de interface (perto de `funil: BPLinha[];`, linha ~16):
```tsx
  vendasProduto: BPLinha[];
```

- [ ] **Step 2: Adicionar o gatilho da aba**

Depois de `<TabsTrigger value="funil">Funil Comercial</TabsTrigger>` (linha 62):
```tsx
          <TabsTrigger value="vendasProduto">Vendas por Produto</TabsTrigger>
```

- [ ] **Step 3: Adicionar o conteúdo da aba** (reusar o mesmo componente de tabela das outras abas, ex. `<BPTabela linhas={...} .../>` — copiar o uso exato da aba `funil`, linhas 92-99, trocando `value`, `linhas={data.vendasProduto}` e o título). Agrupar visualmente por `grupo` (Recorrente/Pontual) e por `segmento` se o componente suportar; caso não, ordenar as linhas por grupo/segmento (já vêm ordenadas do backend). Garantir dark/light (o componente reusado já trata).

```tsx
        <TabsContent value="vendasProduto" className="mt-4">
          <BPTabela
            linhas={data.vendasProduto}
            titulo="Vendas por Produto"
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
          />
        </TabsContent>
```
(Usar o nome/props EXATOS do componente que a aba `funil` usa — conferir nas linhas 92-99 antes de escrever.)

- [ ] **Step 4: Testar no browser** (server já rodando): abrir `/bp-2026`, aba "Vendas por Produto". Conferir: linhas por segmento, realizado·orçado·ating, e dark + light mode.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/BP2026.tsx
git commit -m "feat(bp2026): sub-aba Vendas por Produto (matriz serviço × mês)"
```

---

## Task 7: Verificação final

- [ ] **Step 1:** `npx vitest run server/okr2026/servicosBitrix.test.ts server/routes/bp2026.vendasProduto.helpers.test.ts` → todos PASS.
- [ ] **Step 2:** Soma por produto (MRR e Pontual) = total do funil em cada mês fechado (reusar o check do Task 4 Step 5 para todos os meses ≤ mesFechado).
- [ ] **Step 3:** Conferir mês corrente (parcial) não quebra (deals recentes sem ClickUp caem no AOV).
- [ ] **Step 4:** Dark e light mode ok na aba.
- [ ] **Step 5:** `superpowers:finishing-a-development-branch` — PR para staging com descrição (decodificação Bitrix, cascata, fontes), CI verde.
- [ ] **Step 6:** Pós-conclusão: Obsidian + chamado Cortex DB (status `review`) conforme MEMORY.md.

---

## Self-Review (cobertura do spec)

- De-para 25 IDs → Task 1. ✓
- Cascata produto único / mix ClickUp / AOV → Task 2 (puro) + Task 3 (queries). ✓
- Mix = proporção × total Bitrix (soma fecha) → Task 3 (pesar normaliza ao valor do deal) + Task 4 Step 5 (validação). ✓
- Cobertura parcial ClickUp → AOV no deal todo → `pesar()` retorna null se algum segmento sem peso → fallback. ✓
- Contratos por produto (soma > total) → contagem por segmento distinto. ✓
- AOV por produto → linha derivada valor÷contratos. ✓
- Orçado recorrente + pontual → Task 5 (chaves `vendas_*` novas; pontual lido da planilha). ✓
- Reuniões/Taxa fora → não há linhas para elas. ✓
- Nova sub-aba → Task 6. ✓
- Setup `servicos_vendidos` local → Task 0. ✓
- Riscos (timing, multi-contrato, ID novo) → fallback AOV, SUM por segmento no mix, default Others. ✓
