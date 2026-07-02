# CAC por canal — variáveis de custo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova seção "CAC por canal — variáveis de custo" na aba Macro de `/gestao/receita`: CAC gerencial por macro-canal com custos manuais editáveis por mês e incentivos automáticos por cliente.

**Architecture:** Módulo server novo (`gestaoReceita.cacCanais.ts`) com função pura testável + query de deals ganhos por source/mês; resultado entra no payload do agregador existente como `macro.cacCanais`. No client, helpers compartilhados extraídos para `gestaoUi.tsx` e componente novo `CacPorCanal.tsx`. Edição reusa o fluxo "Editar metas" (`cortex_core.gestao_receita_metas`, chaves novas `cac_canal:*` e `cac_canal_unit:*`).

**Tech Stack:** Express + drizzle `sql` tagged templates (Postgres), vitest, React + TanStack Query + Tailwind (dark/light).

**Spec:** `docs/superpowers/specs/2026-07-02-gestao-receita-cac-por-canal-design.md`

## Global Constraints

- Commits direto na `main` (autorização registrada; Conventional Commits, co-author `Claude Sonnet 4.5 <noreply@anthropic.com>`).
- Dark/light mode obrigatório em toda classe Tailwind (`dark:` variant).
- NÃO rodar `npm run dev` nem matar a porta 3000/3001 (Synapse do usuário roda nelas); validação de tipos com `npx tsc --noEmit`. O dev server do Cortex desta sessão está na **3002**.
- Backend não tem watch: restart manual do server só na validação final (Task 5).
- `npx tsc --noEmit` já tem erros pré-existentes em outros arquivos — o critério é **zero erros nos arquivos deste plano** (`grep` no output).
- Textos da UI em pt-BR com acentuação correta.

---

### Task 1: Módulo server `gestaoReceita.cacCanais.ts` (TDD)

**Files:**
- Create: `server/routes/gestaoReceita.cacCanais.test.ts`
- Create: `server/routes/gestaoReceita.cacCanais.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores. `db.execute(sql...)` no padrão do repo.
- Produces (Tasks 2 e 4 dependem):
  - `CAC_CANAIS: CacCanalDef[]` (catálogo fixo)
  - `agregarCacCanais(deals: DealsSourceMes[], metas: MetaMesRow[], mesesNums: number[]): CacCanaisOut` (pura)
  - `computeCacCanais(db: DbLike, args: { dIni: string; dFim: string; ano: number; mesesNums: number[] }): Promise<CacCanaisOut>`
  - Tipos: `CacCanaisOut = { geral: { cac: number | null; clientes: number; custoTotal: number }; canais: CacCanalOut[] }`; `CacCanalOut = { id: string; label: string; clientes: number; custoTotal: number; cacCliente: number | null; itens: { id: string; label: string; valor: number }[]; incentivo?: { label: string; unit: number; qtd: number; total: number } }`

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `server/routes/gestaoReceita.cacCanais.test.ts`:

```ts
// server/routes/gestaoReceita.cacCanais.test.ts
import { describe, expect, it } from "vitest";
import { agregarCacCanais, CAC_CANAIS } from "./gestaoReceita.cacCanais";

const JUN = [6];
const MAI_JUN = [5, 6];

describe("agregarCacCanais", () => {
  it("agrupa sources no macro-canal e soma clientes do período", () => {
    const out = agregarCacCanais(
      [
        { source: "WEBFORM", mes: 6, clientes: 4 },
        { source: "ADVERTISING", mes: 6, clientes: 2 },
        { source: "UC_YWZVA2", mes: 6, clientes: 3 },
      ],
      [],
      JUN,
    );
    const inbound = out.canais.find((c) => c.id === "inbound_pago")!;
    const outbound = out.canais.find((c) => c.id === "outbound")!;
    expect(inbound.clientes).toBe(6);
    expect(outbound.clientes).toBe(3);
  });

  it("ignora sources fora do catálogo (ex.: sem origem)", () => {
    const out = agregarCacCanais([{ source: "(não informado)", mes: 6, clientes: 9 }], [], JUN);
    expect(out.geral.clientes).toBe(0);
  });

  it("soma custo manual dos meses do período; sem edição = 0", () => {
    const out = agregarCacCanais(
      [],
      [
        { chave: "cac_canal:outbound:time", mes: 5, valor: 14000 },
        { chave: "cac_canal:outbound:time", mes: 6, valor: 1000 },
        { chave: "cac_canal:outbound:ferramentas", mes: 6, valor: 1800 },
      ],
      MAI_JUN,
    );
    const outbound = out.canais.find((c) => c.id === "outbound")!;
    expect(outbound.itens.find((i) => i.id === "time")!.valor).toBe(15000);
    expect(outbound.itens.find((i) => i.id === "ferramentas")!.valor).toBe(1800);
    expect(outbound.custoTotal).toBe(16800);
    const evento = out.canais.find((c) => c.id === "evento")!;
    expect(evento.custoTotal).toBe(0);
  });

  it("incentivo automático: unit default 1000 × clientes, mês a mês, com override por mês", () => {
    const out = agregarCacCanais(
      [
        { source: "RC_GENERATOR", mes: 5, clientes: 2 },
        { source: "RC_GENERATOR", mes: 6, clientes: 1 },
      ],
      [{ chave: "cac_canal_unit:indique_ganhe", mes: 6, valor: 500 }],
      MAI_JUN,
    );
    const ig = out.canais.find((c) => c.id === "indique_ganhe")!;
    // mai: 1000 × 2 + jun: 500 × 1
    expect(ig.incentivo!.total).toBe(2500);
    expect(ig.incentivo!.qtd).toBe(3);
    expect(ig.custoTotal).toBe(2500);
    expect(ig.cacCliente).toBe(Math.round(2500 / 3));
  });

  it("cacCliente null quando clientes = 0 (Parceria sem source)", () => {
    const out = agregarCacCanais([], [{ chave: "cac_canal:parceria:time_resp", mes: 6, valor: 4000 }], JUN);
    const parceria = out.canais.find((c) => c.id === "parceria")!;
    expect(parceria.clientes).toBe(0);
    expect(parceria.custoTotal).toBe(4000);
    expect(parceria.cacCliente).toBeNull();
  });

  it("geral = Σ custos ÷ Σ clientes dos 10 canais", () => {
    const out = agregarCacCanais(
      [
        { source: "WEBFORM", mes: 6, clientes: 6 },
        { source: "UC_YWZVA2", mes: 6, clientes: 3 },
      ],
      [
        { chave: "cac_canal:inbound_pago:anuncios", mes: 6, valor: 29500 },
        { chave: "cac_canal:outbound:time", mes: 6, valor: 14000 },
        { chave: "cac_canal:outbound:ferramentas", mes: 6, valor: 1800 },
      ],
      JUN,
    );
    expect(out.geral.clientes).toBe(9);
    expect(out.geral.custoTotal).toBe(45300);
    expect(out.geral.cac).toBe(Math.round(45300 / 9));
  });

  it("retorna sempre os 10 canais na ordem do catálogo", () => {
    const out = agregarCacCanais([], [], JUN);
    expect(out.canais.map((c) => c.id)).toEqual(CAC_CANAIS.map((c) => c.id));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/gestaoReceita.cacCanais.test.ts`
Expected: FAIL — `Cannot find module './gestaoReceita.cacCanais'` (ou equivalente).

- [ ] **Step 3: Implementar o módulo**

Criar `server/routes/gestaoReceita.cacCanais.ts`:

```ts
// server/routes/gestaoReceita.cacCanais.ts
// Seção "CAC por canal — variáveis de custo" (aba Macro da Gestão de Receita).
// CAC GERENCIAL: custos informados à mão por mês (gestao_receita_metas, chaves
// cac_canal:<canal>:<item>) + incentivos automáticos por cliente (unitário editável
// via cac_canal_unit:<canal>, default R$ 1.000). Clientes = deals ganhos Bitrix
// agrupados por source → macro-canal. Não confundir com o card "CAC — custo de
// aquisição" (Conta Azul, regime caixa): não batem por design.
import { sql } from "drizzle-orm";

const STAGE_GANHO = "Negócio Ganho";

export interface CacCanalDef {
  id: string;
  label: string;
  sources: string[]; // códigos crus de crm_deal.source (ver bitrixSources.ts)
  itens: { id: string; label: string }[];
  incentivo?: { label: string; unitDefault: number };
}

// Catálogo fixo (spec 2026-07-02). Parceria ainda não tem source no CRM → clientes 0.
export const CAC_CANAIS: CacCanalDef[] = [
  { id: "inbound_pago", label: "Inbound pago", sources: ["WEBFORM", "ADVERTISING", "OTHER", "STORE"], itens: [{ id: "anuncios", label: "Investimento em anúncios" }] },
  { id: "inbound_organico", label: "Inbound orgânico", sources: ["WEB", "CALL", "BOOKING", "EMAIL", "TRADE_SHOW", "instagram_organic"], itens: [] },
  { id: "outbound", label: "Outbound", sources: ["UC_YWZVA2"], itens: [{ id: "time", label: "Custo de time" }, { id: "ferramentas", label: "Ferramentas (Lemlist, Intexfy...)" }] },
  { id: "social_selling", label: "Social Selling", sources: ["UC_4VCKGM"], itens: [{ id: "anuncios_dist", label: "Anúncios p/ distribuição" }] },
  { id: "reativacao", label: "Reativação", sources: ["UC_HIBVO6", "UC_8HI30Y"], itens: [{ id: "broadcast", label: "Disparos de broadcast" }, { id: "time", label: "Custo de time" }] },
  { id: "recomendacao", label: "Recomendação", sources: ["UC_PTYW1Y", "CALLBACK"], itens: [] },
  { id: "indique_ganhe", label: "Indique e ganhe", sources: ["RC_GENERATOR"], itens: [], incentivo: { label: "Incentivo", unitDefault: 1000 } },
  { id: "evento", label: "Evento", sources: ["RECOMMENDATION", "UC_KYOYOW"], itens: [{ id: "custo_evento", label: "Custo do evento (manual)" }] },
  { id: "parceria", label: "Parceria", sources: [], itens: [{ id: "time_resp", label: "Custo de time responsável" }], incentivo: { label: "Comissão", unitDefault: 1000 } },
  { id: "expansao", label: "Expansão de conta (Crossell)", sources: ["PARTNER", "UC_7WV0LW", "REPEAT_SALE"], itens: [{ id: "time", label: "Custo de time" }] },
];

export interface DealsSourceMes { source: string; mes: number; clientes: number }
export interface MetaMesRow { chave: string; mes: number; valor: number }
export interface CacCanalOut {
  id: string; label: string; clientes: number; custoTotal: number; cacCliente: number | null;
  itens: { id: string; label: string; valor: number }[];
  incentivo?: { label: string; unit: number; qtd: number; total: number };
}
export interface CacCanaisOut {
  geral: { cac: number | null; clientes: number; custoTotal: number };
  canais: CacCanalOut[];
}

// Agregação pura (testável sem banco). Incentivo calculado MÊS A MÊS (unit do mês ×
// clientes do mês) para range multi-mês somar certo mesmo se o unitário mudou no meio;
// o campo `unit` retornado é o do primeiro mês do período (exibição).
export function agregarCacCanais(deals: DealsSourceMes[], metas: MetaMesRow[], mesesNums: number[]): CacCanaisOut {
  const sourceToCanal: Record<string, string> = {};
  for (const c of CAC_CANAIS) for (const s of c.sources) sourceToCanal[s] = c.id;

  const clientesCanalMes: Record<string, Record<number, number>> = {};
  for (const d of deals) {
    const canal = sourceToCanal[d.source];
    if (!canal) continue; // sources fora do catálogo ficam fora da seção (nota na UI)
    (clientesCanalMes[canal] ??= {})[d.mes] = (clientesCanalMes[canal]?.[d.mes] || 0) + (Number(d.clientes) || 0);
  }
  const metaMes: Record<string, Record<number, number>> = {};
  for (const m of metas) (metaMes[m.chave] ??= {})[m.mes] = Number(m.valor) || 0;

  const canais = CAC_CANAIS.map((def) => {
    const porMes = clientesCanalMes[def.id] || {};
    const clientes = mesesNums.reduce((a, m) => a + (porMes[m] || 0), 0);
    const itens = def.itens.map((it) => ({
      id: it.id,
      label: it.label,
      valor: mesesNums.reduce((a, m) => a + (metaMes[`cac_canal:${def.id}:${it.id}`]?.[m] || 0), 0),
    }));
    let incentivo: CacCanalOut["incentivo"];
    if (def.incentivo) {
      const unitDe = (m: number) => metaMes[`cac_canal_unit:${def.id}`]?.[m] ?? def.incentivo!.unitDefault;
      const total = mesesNums.reduce((a, m) => a + unitDe(m) * (porMes[m] || 0), 0);
      incentivo = { label: def.incentivo.label, unit: unitDe(mesesNums[0]), qtd: clientes, total };
    }
    const custoTotal = itens.reduce((a, i) => a + i.valor, 0) + (incentivo?.total || 0);
    return {
      id: def.id, label: def.label, clientes, custoTotal,
      cacCliente: clientes > 0 ? Math.round(custoTotal / clientes) : null,
      itens, incentivo,
    };
  });

  const totClientes = canais.reduce((a, c) => a + c.clientes, 0);
  const totCusto = canais.reduce((a, c) => a + c.custoTotal, 0);
  return {
    geral: { cac: totClientes > 0 ? Math.round(totCusto / totClientes) : null, clientes: totClientes, custoTotal: totCusto },
    canais,
  };
}

// db tipado frouxo de propósito (method shorthand = bivariante, aceita o db do drizzle)
type DbLike = { execute(q: any): Promise<{ rows: any[] }> };

export async function computeCacCanais(
  db: DbLike,
  { dIni, dFim, ano, mesesNums }: { dIni: string; dFim: string; ano: number; mesesNums: number[] },
): Promise<CacCanaisOut> {
  const mesesInSql = sql.join(mesesNums.map((m) => sql`${m}`), sql`, `);
  const [dealsRows, metasRows] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(NULLIF(source, ''), '(não informado)') AS source,
             EXTRACT(MONTH FROM data_fechamento)::int AS mes,
             COUNT(*)::int AS clientes
      FROM "Bitrix".crm_deal
      WHERE stage_name = ${STAGE_GANHO}
        AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}
      GROUP BY 1, 2
    `),
    db.execute(sql`
      SELECT chave, mes, valor::numeric AS valor
      FROM cortex_core.gestao_receita_metas
      WHERE ano = ${ano} AND mes IN (${mesesInSql})
        AND (chave LIKE 'cac_canal:%' OR chave LIKE 'cac_canal_unit:%')
    `),
  ]);
  return agregarCacCanais(
    (dealsRows.rows as any[]).map((r) => ({ source: r.source, mes: Number(r.mes), clientes: Number(r.clientes) || 0 })),
    (metasRows.rows as any[]).map((r) => ({ chave: r.chave, mes: Number(r.mes), valor: Number(r.valor) || 0 })),
    mesesNums,
  );
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx vitest run server/routes/gestaoReceita.cacCanais.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/gestaoReceita.cacCanais.ts server/routes/gestaoReceita.cacCanais.test.ts
git commit -m "feat(gestao-receita): módulo CAC por canal (catálogo, agregação e queries)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 2: Integrar no agregador + whitelist de chaves

**Files:**
- Modify: `server/routes/gestaoReceita.ts` (import ~linha 12; Promise.all da seção 7 ~linha 269; `res.json` macro ~linha 458; `CHAVE_META_OK` ~linha 509)

**Interfaces:**
- Consumes: `computeCacCanais` (Task 1).
- Produces: payload `macro.cacCanais: CacCanaisOut` (Task 4 consome); PUT `/api/gestao/receita/metas` aceita chaves `cac_canal:<a-z_>:<a-z_>` e `cac_canal_unit:<a-z_>`.

- [ ] **Step 1: Import**

Em `server/routes/gestaoReceita.ts`, após a linha `import { computeFunil, ... } from "./gestaoReceita.funil";`:

```ts
import { computeCacCanais } from "./gestaoReceita.cacCanais";
```

- [ ] **Step 2: Chamar no Promise.all da seção 7**

Substituir:

```ts
      const [{ inbound: funilInbound, outbound: funilOutbound, outros: funilOutros }, opcoesProduto] = await Promise.all([
        computeFunil(db, { dIni, dFim }),
        opcoesProdutoFunil(db, { dIni, dFim }),
      ]);
```

por:

```ts
      const [{ inbound: funilInbound, outbound: funilOutbound, outros: funilOutros }, opcoesProduto, cacCanais] = await Promise.all([
        computeFunil(db, { dIni, dFim }),
        opcoesProdutoFunil(db, { dIni, dFim }),
        computeCacCanais(db, { dIni, dFim, ano, mesesNums }),
      ]);
```

- [ ] **Step 3: Incluir no payload**

No `res.json`, dentro de `macro`, logo após o objeto `cac: { ... },`:

```ts
          cacCanais,
```

- [ ] **Step 4: Estender a whitelist do PUT**

Substituir:

```ts
  const CHAVE_META_OK = /^(venda_mrr|venda_pontual|prod_(tm|ctr)_(mrr|pont):.+|cac_op_(orc|real):[a-z_]+)$/;
```

por:

```ts
  const CHAVE_META_OK = /^(venda_mrr|venda_pontual|prod_(tm|ctr)_(mrr|pont):.+|cac_op_(orc|real):[a-z_]+|cac_canal:[a-z_]+:[a-z_]+|cac_canal_unit:[a-z_]+)$/;
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep -E "gestaoReceita" ; echo "grep exit: $?"`
Expected: nenhuma linha; `grep exit: 1`.

- [ ] **Step 6: Commit**

```bash
git add server/routes/gestaoReceita.ts
git commit -m "feat(gestao-receita): payload macro.cacCanais + chaves cac_canal na whitelist de metas

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 3: Extrair helpers compartilhados para `gestaoUi.tsx`

Refactor puro (sem mudança de comportamento): o componente novo (Task 4) precisa de `Fonte`, `MetaInput`, `SectionCard`, `BlockHead`, `Nota`, `PillManual`, `MetasCtx`, `brl`, `brlk`, `pct`, `intBR`, hoje definidos DENTRO de `GestaoReceita.tsx` (837 linhas). Importar da page criaria ciclo.

**Files:**
- Create: `client/src/components/gestao/gestaoUi.tsx`
- Modify: `client/src/pages/gestao/GestaoReceita.tsx` (remover definições movidas; adicionar import)

**Interfaces:**
- Produces: `import { Fonte, MetaInput, SectionCard, BlockHead, Nota, PillManual, brl, brlk, pct, intBR, type MetasCtx } from "@/components/gestao/gestaoUi";`
- As definições movidas são EXATAMENTE as atuais de `GestaoReceita.tsx` (copiar byte a byte, só acrescentando `export`): `MetasCtx` (interface, linhas ~27-31), `brl`/`brlk`/`pct`/`intBR` (linhas ~74-80), `Fonte` (91-101), `MetaInput` (103-116), `SectionCard` (218-232), `BlockHead` (234-241), `Nota` (243-250), `PillManual` (305-308).

- [ ] **Step 1: Criar `client/src/components/gestao/gestaoUi.tsx`**

```tsx
// client/src/components/gestao/gestaoUi.tsx
// Helpers visuais compartilhados da família Gestão de Receita (page + seções extraídas).
// Movidos de GestaoReceita.tsx sem mudança de comportamento.
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

/* ---------- formatadores ---------- */
export const brl = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");
export const brlk = (n: number) => {
  if (Math.abs(n) >= 1000) return "R$ " + (n / 1000).toFixed(Math.abs(n) % 1000 === 0 ? 0 : 1) + "k";
  return brl(n);
};
export const pct = (n: number) => (Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0") + "%";
export const intBR = (n: number) => Math.round(n).toLocaleString("pt-BR");

// contexto de edição de metas (override): quando editando, os campos de meta viram inputs
export interface MetasCtx {
  editando: boolean; mesUnico: boolean; salvando: boolean; numAlteracoes: number;
  get: (chave: string, fallback: number) => number; set: (chave: string, valor: number) => void;
  iniciar: () => void; salvar: () => void; cancelar: () => void;
}

export function Fonte({ tipo }: { tipo: "bitrix" | "clickup" | "bp" | "caixa" | "meta" }) {
  const map = {
    bitrix: { label: "Bitrix", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    clickup: { label: "ClickUp", cls: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
    bp: { label: "BP 2026", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    caixa: { label: "Conta Azul", cls: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
    meta: { label: "Meta Ads", cls: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
  } as const;
  const m = map[tipo];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

// input de meta editável (override); stopPropagation evita disparar o drill do card ao clicar
export function MetaInput({ chave, valorAtual, metas, prefix = "R$" }: { chave: string; valorAtual: number; metas: MetasCtx; prefix?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 dark:border-amber-800 dark:bg-amber-950/40" onClick={(e) => e.stopPropagation()}>
      {prefix && <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">{prefix}</span>}
      <input
        type="number"
        value={metas.get(chave, valorAtual)}
        onChange={(e) => metas.set(chave, Number(e.target.value))}
        className="w-20 bg-transparent text-right text-xs font-semibold tabular-nums text-amber-800 outline-none dark:text-amber-300"
      />
    </span>
  );
}

export function SectionCard({ title, fonte, children, className = "" }: { title?: string; fonte?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 ${className}`}>
      <CardContent className="pt-4 pb-4">
        {title && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{title}</h3>
            {fonte}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export function BlockHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 mt-1 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">{icon}</span>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
    </div>
  );
}

export function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// pill das linhas de realizado manual da tabela "Custo da operação"
export const PillManual = () => (
  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">manual</span>
);
```

- [ ] **Step 2: Atualizar `GestaoReceita.tsx`**

1. Apagar de `GestaoReceita.tsx` as definições movidas: interface `MetasCtx`; consts `brl`, `brlk`, `pct`, `intBR`; funções `Fonte`, `MetaInput`, `SectionCard`, `BlockHead`, `Nota`; const `PillManual`.
2. Adicionar o import (junto dos demais imports de `@/components/gestao/`):

```ts
import { Fonte, MetaInput, SectionCard, BlockHead, Nota, PillManual, brl, brlk, pct, intBR, type MetasCtx } from "@/components/gestao/gestaoUi";
```

3. Limpar imports órfãos da page: conferir com grep se `Info`, `Card`, `CardContent` ainda são usados no arquivo após a remoção; remover do import apenas os que zerarem uso.

Run: `grep -c "Info\b" client/src/pages/gestao/GestaoReceita.tsx` (e o mesmo para `Card`/`CardContent`)
Expected: se a contagem for só a linha do import, remover o símbolo do import.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep -E "GestaoReceita|gestaoUi" ; echo "grep exit: $?"`
Expected: nenhuma linha; `grep exit: 1`.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/gestao/gestaoUi.tsx client/src/pages/gestao/GestaoReceita.tsx
git commit -m "refactor(gestao-receita): extrai helpers visuais compartilhados para gestaoUi.tsx

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 4: Componente `CacPorCanal.tsx` + integração na aba Macro

**Files:**
- Create: `client/src/components/gestao/CacPorCanal.tsx`
- Modify: `client/src/pages/gestao/GestaoReceita.tsx` (tipo `GestaoReceitaData.macro` + render em `SecaoMacro`)

**Interfaces:**
- Consumes: helpers de `gestaoUi.tsx` (Task 3); payload `macro.cacCanais` (Task 2).
- Produces: `<CacPorCanal dados={d.macro.cacCanais} metas={metas} />` e tipos `CacCanaisData`/`CacCanalCard` exportados do componente.

- [ ] **Step 1: Criar `client/src/components/gestao/CacPorCanal.tsx`**

```tsx
// client/src/components/gestao/CacPorCanal.tsx
// Seção "CAC por canal — variáveis de custo" (aba Macro da Gestão de Receita).
// CAC gerencial: custos manuais editáveis por mês (Editar metas) + incentivos
// automáticos por cliente. Clientes = deals ganhos Bitrix por macro-canal.
import { Card, CardContent } from "@/components/ui/card";
import { Filter } from "lucide-react";
import { Fonte, MetaInput, Nota, BlockHead, SectionCard, brl, intBR, type MetasCtx } from "./gestaoUi";

export interface CacCanalItem { id: string; label: string; valor: number }
export interface CacCanalCard {
  id: string; label: string; clientes: number; custoTotal: number; cacCliente: number | null;
  itens: CacCanalItem[];
  incentivo?: { label: string; unit: number; qtd: number; total: number };
}
export interface CacCanaisData {
  geral: { cac: number | null; clientes: number; custoTotal: number };
  canais: CacCanalCard[];
}

export function CacPorCanal({ dados, metas }: { dados: CacCanaisData; metas: MetasCtx }) {
  // valores "ao vivo" durante a edição (mesma mecânica da tabela Custo da operação);
  // fora do modo edição, metas.get devolve o fallback (valor do payload)
  const itemVivo = (c: CacCanalCard, it: CacCanalItem) => metas.get(`cac_canal:${c.id}:${it.id}`, it.valor);
  const unitVivo = (c: CacCanalCard) => metas.get(`cac_canal_unit:${c.id}`, c.incentivo?.unit ?? 0);
  // fora de edição, usa o total do payload (em multi-mês o unitário pode ter variado
  // entre meses, e unit × qtd divergiria do cálculo mês a mês do backend)
  const incentivoVivo = (c: CacCanalCard) =>
    c.incentivo ? (metas.editando ? unitVivo(c) * c.incentivo.qtd : c.incentivo.total) : 0;
  const custoVivo = (c: CacCanalCard) => c.itens.reduce((a, it) => a + itemVivo(c, it), 0) + incentivoVivo(c);
  const geralCusto = dados.canais.reduce((a, c) => a + custoVivo(c), 0);
  const geralCac = dados.geral.clientes > 0 ? Math.round(geralCusto / dados.geral.clientes) : null;

  return (
    <div>
      <BlockHead icon={<Filter className="h-4 w-4" />} title="CAC por canal — variáveis de custo" />
      <SectionCard>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Como é calculado</div>
        <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
          CAC do canal = soma das variáveis de custo ÷ nº de clientes fechados do canal (Bitrix).
          Custos manuais editáveis; incentivos por cliente automáticos.
        </p>
        <div className="mt-3 text-3xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{geralCac != null ? brl(geralCac) : "—"}</div>
        <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          CAC geral · {intBR(dados.geral.clientes)} clientes
        </div>
      </SectionCard>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {dados.canais.map((c) => {
          const custo = custoVivo(c);
          const cac = c.clientes > 0 ? Math.round(custo / c.clientes) : null;
          return (
            <Card key={c.id} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2 dark:border-zinc-800">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.label}</span>
                  <span className="text-right">
                    <span className="block text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{cac != null ? brl(cac) : "—"}</span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">CAC / cliente</span>
                  </span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {c.itens.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="text-gray-700 dark:text-zinc-300">{it.label}</span>
                      {metas.editando
                        ? <MetaInput chave={`cac_canal:${c.id}:${it.id}`} valorAtual={it.valor} metas={metas} />
                        : <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{brl(it.valor)}</span>}
                    </div>
                  ))}
                  {c.incentivo && (
                    <div className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="text-gray-700 dark:text-zinc-300">
                        {c.incentivo.label}{" "}
                        {metas.editando
                          ? <MetaInput chave={`cac_canal_unit:${c.id}`} valorAtual={c.incentivo.unit} metas={metas} />
                          : <b className="tabular-nums">{brl(unitVivo(c))}</b>}{" "}
                        / cliente × {intBR(c.incentivo.qtd)}
                      </span>
                      <span className="font-semibold tabular-nums text-gray-500 dark:text-zinc-400">{brl(incentivoVivo(c))}</span>
                    </div>
                  )}
                  {c.itens.length === 0 && !c.incentivo && (
                    <div className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="text-gray-500 dark:text-zinc-400">Sem custo direto</span>
                      <span className="text-gray-400 dark:text-zinc-500">—</span>
                    </div>
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 text-sm dark:border-zinc-800">
                  <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-zinc-400">
                    Clientes <b className="tabular-nums text-gray-900 dark:text-white">{intBR(c.clientes)}</b> <Fonte tipo="bitrix" />
                  </span>
                  <span className="text-gray-600 dark:text-zinc-400">
                    Custo total <b className="tabular-nums text-gray-900 dark:text-white">{brl(custo)}</b>
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Nota>
        Visão gerencial: custos informados manualmente por mês (botão "Editar metas", mês único) + incentivos automáticos por cliente.
        Não bate com o card "CAC — custo de aquisição" (Conta Azul, regime caixa) por design.
        Parceria ainda não tem source no CRM (clientes 0). Deals de sources fora dos 10 canais (ex.: sem origem) ficam fora desta seção.
      </Nota>
    </div>
  );
}
```

- [ ] **Step 2: Integrar em `GestaoReceita.tsx`**

1. Import junto aos demais:

```ts
import { CacPorCanal, type CacCanaisData } from "@/components/gestao/CacPorCanal";
```

2. Na interface `GestaoReceitaData`, dentro de `macro`, após o campo `cac: {...};`:

```ts
    cacCanais: CacCanaisData;
```

3. Em `SecaoMacro`, logo após o `<div>` que fecha o bloco "CAC — custo de aquisição" (o que contém `<CustoOperacaoTabela ... />`), adicionar:

```tsx
      <div>
        <CacPorCanal dados={d.macro.cacCanais} metas={metas} />
      </div>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep -E "GestaoReceita|CacPorCanal|gestaoUi" ; echo "grep exit: $?"`
Expected: nenhuma linha; `grep exit: 1`.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/gestao/CacPorCanal.tsx client/src/pages/gestao/GestaoReceita.tsx
git commit -m "feat(gestao-receita): seção CAC por canal — variáveis de custo (aba Macro)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 5: Validação end-to-end no browser

**Files:** nenhum (validação). Requer o dev server do Cortex na porta **3002** (NÃO tocar nas portas 3000/3001 — Synapse do usuário).

- [ ] **Step 1: Reiniciar o dev server do Cortex (3002)**

```bash
lsof -ti:3002 -sTCP:LISTEN | xargs kill -9 2>/dev/null
PORT=3002 npm run dev   # em background
```

Expected: server sobe; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/auth/user` → `401`.

- [ ] **Step 2: Validar a seção no browser (mês fechado: Junho 2026)**

Abrir `http://localhost:3002/gestao/receita` (aba Macro). Conferir:
- Seção "CAC por canal — variáveis de custo" após "Custo da operação", com card "Como é calculado" e 10 cards na ordem do catálogo.
- Sem nenhuma edição: custos R$ 0, CAC geral "—" só se 0 clientes (senão R$ 0), clientes por canal > 0 nos canais com venda em junho (Inbound pago, Outbound etc.), Parceria com 0 clientes e CAC "—".
- Consistência: Σ clientes dos cards ≤ 79 (clientes novos de junho; a diferença são deals sem source/fora do catálogo).

- [ ] **Step 3: Validar edição**

Clicar "Editar metas": itens viram inputs âmbar; digitar valores (ex.: Outbound time = 14000, ferramentas = 1800) e conferir "Custo total"/"CAC / cliente"/CAC geral recalculando ao vivo; salvar; recarregar a página e conferir persistência (PUT aceito, GET refletindo).
Depois, restaurar os valores de teste para 0 (editar de novo e salvar), para não deixar custo fictício em produção de dados.

- [ ] **Step 4: Validar dark/light mode**

Alternar o tema e conferir contraste/cores da seção nos dois modos.

- [ ] **Step 5: Workflow pós-conclusão**

Changelog (`docs/CHANGELOG.md`, entrada no topo, formato do repo), commit `docs(changelog): update changelog`, push; épico Obsidian `05-Comercial/gestao-receita.md` (nova task `[x]` + notas); memória `project_gestao_receita.md` (nova seção, chaves novas).
