# BP 2026 — Movimento de Estoque (Ponte do MRR + Aba Pontual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao BP 2026 a ponte do MRR (recorrente) na aba Revenue e uma nova aba Pontual com o movimento do estoque de contratos pontuais, ambas só-realizado.

**Architecture:** Backend Express/tsx monta o payload em `server/routes/bp2026.ts` agregando funções `montar*`. A ponte do MRR é montada em `bp2026.revenue.ts` (reusa snapshot+churn já calculados + `vendasMrrPorMes` do handler). A aba Pontual usa snapshot-diff de `cup_data_hist` via helpers puros em `bp2026.pontual.helpers.ts` e a função `montarPontual`. O frontend React renderiza as duas visões no `BPDreTable`, que ganha um modo `mostrarOrcado={false}`.

**Tech Stack:** TypeScript, Express, drizzle-orm (`sql` template), React, Tailwind, vitest. Banco PostgreSQL (prod `dados_turbo` em 34.95.249.110; local `cortex_dev`).

## Global Constraints

- **Só realizado** nas duas pontes: linhas sem orçado/atingimento (`direcao: "neutro"`, `orcado: 0`, `atingimento: null`, renderizadas com `mostrarOrcado={false}`).
- **Granularidade:** total consolidado (sem quebra por produto/segmento).
- **Estoque pontual canônico:** `valorp > 0 AND status NOT IN ('entregue','cancelado/inativo','não usar')` — status são valores exatos (Set/igualdade, nunca ILIKE). `'em cancelamento'` **conta** como estoque.
- **Churn pontual** = saiu do estoque para `status IN ('cancelado/inativo','não usar')`.
- A ponte tem que **fechar**: recorrente com a linha `Δ não explicado`; pontual com Deletados + Saída atípica + Reajuste detalhados.
- `cup_data_hist` resolve "mês" pelo **último snapshot do mês** (`MAX(data_snapshot::date)`); mês 0 = dez/2025 (snapshot 27/12, base da ponte de janeiro).
- Toda métrica nova **precisa** de entrada em `INFO_METRICAS` (`server/routes/bp2026.info.ts`) e ser anexada via `anexarInfo` no payload.
- Dev server não tem watch: reiniciar após mudança de backend (`lsof -ti:3000 | xargs kill -9` e `npm run dev`). Cache do endpoint é 10min — o restart limpa.
- Commits: Conventional Commits, terminar com `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Branch já criada: `feature/bp2026-movimento-estoque`.

## File Structure

- `client/src/components/bp2026/BPDreTable.tsx` *(modify)* — prop `mostrarOrcado` (modo só-realizado).
- `server/routes/bp2026.pontual.helpers.ts` *(create)* — helpers puros: classificação snapshot-diff, decomposição por status, montagem das linhas.
- `server/routes/bp2026.pontual.helpers.test.ts` *(create)* — testes dos helpers (identidade da ponte).
- `server/routes/bp2026.pontual.ts` *(create)* — `montarPontual` (query + chama helper).
- `server/routes/bp2026.revenue.ts` *(modify)* — `montarPonteMrr` (helper puro) + assinatura passa a retornar `{ linhas, ponteMrr }` e a receber `vendasMrrPorMes`.
- `server/routes/bp2026.revenue.test.ts` *(create)* — teste do `montarPonteMrr` (identidade).
- `server/routes/bp2026.ts` *(modify)* — chama `montarPontual`, ajusta chamada de `montarRevenue`, adiciona `pontual` e `ponteMrr` ao payload.
- `server/routes/bp2026.info.ts` *(modify)* — entradas `INFO_METRICAS` das métricas novas.
- `client/src/pages/BP2026.tsx` *(modify)* — campos no tipo, aba Pontual, bloco Ponte do MRR na aba Revenue.

---

### Task 1: Prop `mostrarOrcado` no BPDreTable

Modo só-realizado: esconde orçado + atingimento por célula e o sub-rótulo do cabeçalho. Retrocompatível (default `true`). Sem infra de teste de componente React no projeto → validação por `tsc` + visual.

**Files:**
- Modify: `client/src/components/bp2026/BPDreTable.tsx`

**Interfaces:**
- Produces: `BPDreTable` aceita `mostrarOrcado?: boolean` (default `true`). Quando `false`, cada célula mostra só o realizado.

- [ ] **Step 1: Adicionar `mostrarOrcado` ao `CelulaProps` e ao `Celula`**

Em `CelulaProps` (após `parcial?: boolean;`):

```tsx
interface CelulaProps {
  orcado: number;
  realizado: number | null;
  atingimento: number | null;
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade: "brl" | "int" | "pct" | "dec";
  parcial?: boolean;
  mostrarOrcado?: boolean;
}
```

No início da função `Celula`, antes do cálculo de `naoOrcado`, inserir o early-return:

```tsx
function Celula({ orcado, realizado, atingimento, direcao, unidade, parcial, mostrarOrcado = true }: CelulaProps) {
  if (!mostrarOrcado) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs font-medium tabular-nums text-gray-900 dark:text-white">
          {fmtValor(realizado, unidade)}
        </span>
      </div>
    );
  }
  // gasto/receita sem orçamento: precisa saltar aos olhos, não virar "—"
  const naoOrcado = atingimento === null && orcado === 0 && realizado !== null && realizado > 0;
```

- [ ] **Step 2: Adicionar `mostrarOrcado` ao `Props` e à assinatura do `BPDreTable`**

```tsx
interface Props {
  linhas: BPLinha[];
  mesCorrente: number; // 0-12 (mês atual; parcial quando > mesFechado)
  mesFechado: number; // 0-12 (último mês fechado — período do acumulado)
  onCellClick?: (metrica: string, mes: number) => void;
  mostrarOrcado?: boolean;
}

export function BPDreTable({ linhas, mesCorrente, mesFechado, onCellClick, mostrarOrcado = true }: Props) {
```

- [ ] **Step 3: Sub-rótulo do cabeçalho condicional**

Trocar o texto fixo:

```tsx
              <div className="text-[10px] font-normal normal-case text-gray-400 dark:text-zinc-500">
                {mostrarOrcado ? "realizado · orçado · ating." : "realizado"}
              </div>
```

- [ ] **Step 4: Passar `mostrarOrcado` para as duas instâncias de `Celula`**

Na célula dos meses (dentro do `linha.meses.map`):

```tsx
                          <Celula orcado={m.orcado} realizado={m.realizado} atingimento={m.atingimento} direcao={linha.direcao} unidade={linha.unidade ?? "brl"} parcial={m.mes === mesCorrente && mesCorrente > mesFechado} mostrarOrcado={mostrarOrcado} />
```

Na célula do YTD:

```tsx
                  <Celula
                    orcado={linha.ytd.orcado}
                    realizado={linha.ytd.realizado}
                    atingimento={linha.ytd.atingimento}
                    direcao={linha.direcao}
                    unidade={linha.unidade ?? "brl"}
                    mostrarOrcado={mostrarOrcado}
                  />
```

- [ ] **Step 5: Verificar tipos**

Run: `npm run check`
Expected: sem erros novos em `BPDreTable.tsx` (compila).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/bp2026/BPDreTable.tsx
git commit -m "feat(bp2026): modo mostrarOrcado no BPDreTable (so realizado)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Helpers puros da ponte pontual (snapshot-diff)

Classificação das transições entre dois snapshots e montagem das 13+ linhas. Tudo puro (sem db) e testável. A identidade da ponte é validada por teste.

**Files:**
- Create: `server/routes/bp2026.pontual.helpers.ts`
- Test: `server/routes/bp2026.pontual.helpers.test.ts`

**Interfaces:**
- Produces:
  - `RegPontual = { idSubtask: string; valorp: number; status: string }`
  - `ehEstoquePontual(r: RegPontual): boolean`
  - `classificarPonte(ant: RegPontual[], atual: RegPontual[]): PonteMes` onde `PonteMes = { estoqueIni; venda; entrega; churn; deletados; saidaAtipica; reajuste; estoqueFim }` (todos `number`)
  - `decomporStatus(atual: RegPontual[]): Record<string, number>`
  - `STATUS_DECOMP: ReadonlyArray<{ chave: string; titulo: string }>`
  - `LinhaPontual` (shape compatível com `BPLinha`)
  - `montarLinhasPontual(porMes: Record<number, RegPontual[]>, mesCorrente: number, mesFechado: number): LinhaPontual[]`

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `server/routes/bp2026.pontual.helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ehEstoquePontual,
  classificarPonte,
  decomporStatus,
  montarLinhasPontual,
} from "./bp2026.pontual.helpers";

const ant = [
  { idSubtask: "A", valorp: 1000, status: "ativo" },        // permanece (reajuste +100)
  { idSubtask: "B", valorp: 500, status: "triagem" },       // vira entregue
  { idSubtask: "C", valorp: 300, status: "pausado" },       // vira churn
  { idSubtask: "D", valorp: 200, status: "ativo" },         // deletado (some)
  { idSubtask: "E", valorp: 100, status: "entregue" },      // já não era estoque (ignora)
  { idSubtask: "G", valorp: 150, status: "ativo" },         // valorp some (saída atípica)
];
const atual = [
  { idSubtask: "A", valorp: 1100, status: "ativo" },        // reajuste
  { idSubtask: "B", valorp: 500, status: "entregue" },      // entrega
  { idSubtask: "C", valorp: 300, status: "cancelado/inativo" }, // churn
  { idSubtask: "G", valorp: 0, status: "ativo" },           // saída atípica (valorp 0)
  { idSubtask: "F", valorp: 700, status: "triagem" },       // venda nova
];

describe("ehEstoquePontual", () => {
  it("exige valorp>0 e status fora da lista de exclusão", () => {
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 10, status: "ativo" })).toBe(true);
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 10, status: "em cancelamento" })).toBe(true);
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 0, status: "ativo" })).toBe(false);
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 10, status: "entregue" })).toBe(false);
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 10, status: "cancelado/inativo" })).toBe(false);
  });
});

describe("classificarPonte", () => {
  const p = classificarPonte(ant, atual);
  it("classifica cada categoria", () => {
    expect(p.estoqueIni).toBe(2150); // A+B+C+D+G (E fora)
    expect(p.venda).toBe(700);       // F
    expect(p.entrega).toBe(500);     // B
    expect(p.churn).toBe(300);       // C
    expect(p.deletados).toBe(200);   // D
    expect(p.saidaAtipica).toBe(150);// G (valorp 0)
    expect(p.reajuste).toBe(100);    // A 1000->1100
    expect(p.estoqueFim).toBe(1800); // A1100 + F700
  });
  it("a ponte fecha (identidade)", () => {
    expect(
      p.estoqueIni + p.venda - p.entrega - p.churn - p.deletados - p.saidaAtipica + p.reajuste
    ).toBe(p.estoqueFim);
  });
});

describe("decomporStatus", () => {
  it("soma valorp por status, só do estoque, fechando no estoque final", () => {
    const d = decomporStatus(atual);
    expect(d["ativo"]).toBe(1100);
    expect(d["triagem"]).toBe(700);
    expect(d["entregue"]).toBeUndefined();
    expect(d["cancelado/inativo"]).toBeUndefined();
    const soma = Object.values(d).reduce((s, v) => s + v, 0);
    expect(soma).toBe(1800);
  });
});

describe("montarLinhasPontual", () => {
  const porMes = { 0: ant, 1: atual };
  const linhas = montarLinhasPontual(porMes, 1, 1);
  const by = (m: string) => linhas.find((l) => l.metrica === m)!;
  it("estoque inicial positivo, fluxos com sinal, estoque final destaque", () => {
    expect(by("pontual_estoque_ini").meses[0].realizado).toBe(2150);
    expect(by("pontual_venda").meses[0].realizado).toBe(700);
    expect(by("pontual_entrega").meses[0].realizado).toBe(-500);
    expect(by("pontual_churn").meses[0].realizado).toBe(-300);
    expect(by("pontual_deletados").meses[0].realizado).toBe(-200);
    expect(by("pontual_saida_atipica").meses[0].realizado).toBe(-150);
    expect(by("pontual_reajuste").meses[0].realizado).toBe(100);
    expect(by("pontual_estoque_fim").meses[0].realizado).toBe(1800);
    expect(by("pontual_estoque_fim").destaque).toBe(true);
  });
  it("decomposição por status soma ao estoque final", () => {
    expect(by("pontual_status_ativo").meses[0].realizado).toBe(1100);
    expect(by("pontual_status_triagem").meses[0].realizado).toBe(700);
  });
  it("todas as linhas são só-realizado (orcado 0, atingimento null, neutro)", () => {
    for (const l of linhas) {
      expect(l.direcao).toBe("neutro");
      expect(l.meses[0].orcado).toBe(0);
      expect(l.meses[0].atingimento).toBeNull();
    }
  });
  it("YTD: inicial=jan(dez), fluxos somados, final=posição", () => {
    expect(by("pontual_estoque_ini").ytd.realizado).toBe(2150);
    expect(by("pontual_venda").ytd.realizado).toBe(700);
    expect(by("pontual_estoque_fim").ytd.realizado).toBe(1800);
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `npx vitest run server/routes/bp2026.pontual.helpers.test.ts`
Expected: FAIL — `Cannot find module './bp2026.pontual.helpers'`.

- [ ] **Step 3: Implementar os helpers**

Criar `server/routes/bp2026.pontual.helpers.ts`:

```ts
// server/routes/bp2026.pontual.helpers.ts
// Ponte do estoque pontual via snapshot-diff de cup_data_hist (helpers puros).
// Estoque pontual = valorp>0 e status fora da lista de exclusão. A ponte fecha:
// estoque_ini + venda − entrega − churn − deletados − saída_atípica + reajuste = estoque_fim.

export interface RegPontual {
  idSubtask: string;
  valorp: number;
  status: string;
}

const ESTOQUE_STATUS_EXCLUDE = new Set(["entregue", "cancelado/inativo", "não usar"]);
const CHURN_STATUS = new Set(["cancelado/inativo", "não usar"]);

export function ehEstoquePontual(r: RegPontual): boolean {
  return r.valorp > 0 && !ESTOQUE_STATUS_EXCLUDE.has(r.status);
}

export interface PonteMes {
  estoqueIni: number;
  venda: number;
  entrega: number;
  churn: number;
  deletados: number;
  saidaAtipica: number;
  reajuste: number;
  estoqueFim: number;
}

// Classifica a transição de cada contrato (id_subtask) entre o estoque do snapshot
// anterior e o do atual. Venda inclui contratos que (re)entraram no estoque.
export function classificarPonte(ant: RegPontual[], atual: RegPontual[]): PonteMes {
  const antMap = new Map(ant.map((r) => [r.idSubtask, r]));
  const atualMap = new Map(atual.map((r) => [r.idSubtask, r]));
  const p: PonteMes = {
    estoqueIni: 0, venda: 0, entrega: 0, churn: 0,
    deletados: 0, saidaAtipica: 0, reajuste: 0, estoqueFim: 0,
  };
  for (const r of ant) {
    if (!ehEstoquePontual(r)) continue;
    p.estoqueIni += r.valorp;
    const a = atualMap.get(r.idSubtask);
    if (!a) { p.deletados += r.valorp; continue; }
    if (ehEstoquePontual(a)) { p.reajuste += a.valorp - r.valorp; continue; }
    if (a.status === "entregue") p.entrega += r.valorp;
    else if (CHURN_STATUS.has(a.status)) p.churn += r.valorp;
    else p.saidaAtipica += r.valorp;
  }
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    p.estoqueFim += r.valorp;
    const prev = antMap.get(r.idSubtask);
    if (!prev || !ehEstoquePontual(prev)) p.venda += r.valorp;
  }
  return p;
}

export function decomporStatus(atual: RegPontual[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    out[r.status] = (out[r.status] ?? 0) + r.valorp;
  }
  return out;
}

export const STATUS_DECOMP = [
  { chave: "ativo", titulo: "· Em execução (ativo)" },
  { chave: "triagem", titulo: "· Triagem" },
  { chave: "pausado", titulo: "· Pausado" },
  { chave: "onboarding", titulo: "· Onboarding" },
  { chave: "em cancelamento", titulo: "· Em cancelamento" },
] as const;

export interface LinhaPontual {
  metrica: string;
  titulo: string;
  tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade: "brl" | "int" | "pct";
  nota?: string;
  destaque?: boolean;
  meses: { mes: number; orcado: number; realizado: number | null; atingimento: number | null }[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const NOTA_VENDA =
  "Venda = entrada no estoque (contratos pontuais que passaram a constar no snapshot do " +
  "ClickUp), medida por diferença de snapshots — não é o 'Vendas Pontual' do Bitrix de outras abas.";

// porMes[m] = registros (valorp>0) do último snapshot do mês m; m=0 é dez/2025.
export function montarLinhasPontual(
  porMes: Record<number, RegPontual[]>,
  mesCorrente: number,
  mesFechado: number,
): LinhaPontual[] {
  const ponte: (PonteMes | null)[] = Array.from({ length: 13 }, () => null);
  const decomp: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  for (let m = 1; m <= 12; m++) {
    if (m > mesCorrente) continue;
    ponte[m] = classificarPonte(porMes[m - 1] ?? [], porMes[m] ?? []);
    decomp[m] = decomporStatus(porMes[m] ?? []);
  }

  const serieFluxo = (pick: (p: PonteMes) => number, signo: 1 | -1) =>
    Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const p = ponte[m];
      return m <= mesCorrente && p ? signo * pick(p) : null;
    });
  const sumYtd = (serie: (number | null)[]): number | null => {
    if (mesFechado === 0) return null;
    let s: number | null = null;
    for (let m = 1; m <= mesFechado; m++) {
      const v = serie[m - 1];
      if (v !== null) s = (s ?? 0) + v;
    }
    return s;
  };

  const mk = (
    metrica: string,
    titulo: string,
    tipoAgregacao: "fluxo" | "estoque",
    serie: (number | null)[],
    ytdReal: number | null,
    extra: Partial<LinhaPontual> = {},
  ): LinhaPontual => ({
    metrica, titulo, tipoAgregacao, direcao: "neutro", unidade: "brl", ...extra,
    meses: serie.map((r, i) => ({ mes: i + 1, orcado: 0, realizado: r, atingimento: null })),
    ytd: { orcado: 0, realizado: mesFechado === 0 ? null : ytdReal, atingimento: null },
  });

  const serieEstoqueIni = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; const p = ponte[m];
    return m <= mesCorrente && p ? p.estoqueIni : null;
  });
  const serieEstoqueFim = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; const p = ponte[m];
    return m <= mesCorrente && p ? p.estoqueFim : null;
  });

  const linhas: LinhaPontual[] = [
    mk("pontual_estoque_ini", "(=) Estoque inicial", "estoque", serieEstoqueIni, ponte[1]?.estoqueIni ?? null),
    mk("pontual_venda", "(+) Venda", "fluxo", serieFluxo((p) => p.venda, 1), sumYtd(serieFluxo((p) => p.venda, 1)), { nota: NOTA_VENDA }),
    mk("pontual_entrega", "(−) Entrega", "fluxo", serieFluxo((p) => p.entrega, -1), sumYtd(serieFluxo((p) => p.entrega, -1))),
    mk("pontual_churn", "(−) Churn", "fluxo", serieFluxo((p) => p.churn, -1), sumYtd(serieFluxo((p) => p.churn, -1))),
    mk("pontual_deletados", "(−) Deletados", "fluxo", serieFluxo((p) => p.deletados, -1), sumYtd(serieFluxo((p) => p.deletados, -1))),
    mk("pontual_saida_atipica", "(−) Saída atípica", "fluxo", serieFluxo((p) => p.saidaAtipica, -1), sumYtd(serieFluxo((p) => p.saidaAtipica, -1))),
    mk("pontual_reajuste", "(±) Reajuste de valor", "fluxo", serieFluxo((p) => p.reajuste, 1), sumYtd(serieFluxo((p) => p.reajuste, 1))),
    mk("pontual_estoque_fim", "(=) Estoque final", "estoque", serieEstoqueFim, mesFechado === 0 ? null : ponte[mesFechado]?.estoqueFim ?? null, { destaque: true }),
  ];

  for (const { chave, titulo } of STATUS_DECOMP) {
    const serie = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1; const d = decomp[m];
      return m <= mesCorrente && d ? d[chave] ?? 0 : null;
    });
    const ytdReal = mesFechado === 0 ? null : decomp[mesFechado]?.[chave] ?? 0;
    linhas.push(mk(`pontual_status_${chave.replace(/\s+/g, "_")}`, titulo, "estoque", serie, ytdReal));
  }

  // Linha "Outros" defensiva: garante que a decomposição feche no estoque final
  // mesmo se surgir um status fora dos 5 conhecidos. Só entra se houver valor.
  const serieOutros = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; const p = ponte[m]; const d = decomp[m];
    if (!(m <= mesCorrente && p && d)) return null;
    const conhecido = STATUS_DECOMP.reduce((s, { chave }) => s + (d[chave] ?? 0), 0);
    return p.estoqueFim - conhecido;
  });
  if (serieOutros.some((v) => v !== null && Math.abs(v) > 0.5)) {
    const ytdOutros = mesFechado === 0 ? null : serieOutros[mesFechado - 1] ?? 0;
    linhas.push(mk("pontual_status_outros", "· Outros status", "estoque", serieOutros, ytdOutros));
  }

  return linhas;
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `npx vitest run server/routes/bp2026.pontual.helpers.test.ts`
Expected: PASS (todos os blocos).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.pontual.helpers.ts server/routes/bp2026.pontual.helpers.test.ts
git commit -m "feat(bp2026): helpers da ponte pontual (snapshot-diff) com identidade testada

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `montarPontual` + wire no payload + INFO

Query do snapshot-diff (último snapshot de cada mês, mês 0 = dez/2025), monta as linhas via helper, anexa info e expõe em `payload.pontual`.

**Files:**
- Create: `server/routes/bp2026.pontual.ts`
- Modify: `server/routes/bp2026.ts`
- Modify: `server/routes/bp2026.info.ts`

**Interfaces:**
- Consumes: `montarLinhasPontual`, `RegPontual` (Task 2); `anexarInfo` e `INFO_METRICAS` (handler).
- Produces: `montarPontual({ db, mesCorrente, mesFechado }): Promise<LinhaPontual[]>`; campo `pontual: BPLinha[]` no payload.

- [ ] **Step 1: Implementar `montarPontual`**

Criar `server/routes/bp2026.pontual.ts`:

```ts
// server/routes/bp2026.pontual.ts
// Sub-aba Pontual: movimento do estoque de contratos pontuais (ponte) via
// snapshot-diff de cup_data_hist. Total consolidado, só realizado.
import { sql } from "drizzle-orm";
import { montarLinhasPontual, type RegPontual, type LinhaPontual } from "./bp2026.pontual.helpers";

interface Deps {
  db: any;
  mesCorrente: number;
  mesFechado: number;
}

export async function montarPontual({ db, mesCorrente, mesFechado }: Deps): Promise<LinhaPontual[]> {
  // Último snapshot de cada mês; mês 0 = dez/2025 (base da ponte de janeiro).
  const result = await db.execute(sql`
    WITH alvo AS (
      SELECT gs.mes, MAX(h.data_snapshot::date) AS d
      FROM generate_series(0, 12) AS gs(mes)
      JOIN "Clickup".cup_data_hist h
        ON h.data_snapshot::date >= (make_date(2025, 12, 1) + (gs.mes || ' months')::interval)::date
       AND h.data_snapshot::date <  (make_date(2025, 12, 1) + ((gs.mes + 1) || ' months')::interval)::date
      GROUP BY gs.mes
    )
    SELECT a.mes, h.id_subtask, h.valorp::numeric AS valorp, h.status
    FROM alvo a
    JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.d
    WHERE h.valorp::numeric > 0
    ORDER BY a.mes
  `);

  const porMes: Record<number, RegPontual[]> = {};
  for (const row of result.rows as any[]) {
    const mes = Number(row.mes);
    (porMes[mes] ??= []).push({
      idSubtask: String(row.id_subtask),
      valorp: parseFloat(row.valorp),
      status: row.status,
    });
  }

  return montarLinhasPontual(porMes, mesCorrente, mesFechado);
}
```

- [ ] **Step 2: Adicionar entradas em `INFO_METRICAS`**

Em `server/routes/bp2026.info.ts`, dentro do objeto `INFO_METRICAS` (antes do fechamento `};` final), adicionar:

```ts
  // ===== Pontual (movimento do estoque) =====
  pontual_estoque_ini: {
    definicao: "Valor do estoque de pontual no fim do mês anterior (posição de abertura).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês anterior (valorp>0, status fora de entregue/cancelado/não usar).",
    calculo: "Soma de valorp dos contratos em estoque no snapshot anterior. Janeiro abre com dez/2025.",
  },
  pontual_venda: {
    definicao: "Pontual que entrou no estoque no mês (entrada).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos em estoque no snapshot do mês que não estavam em estoque no anterior. Não é o 'Vendas Pontual' do Bitrix.",
  },
  pontual_entrega: {
    definicao: "Pontual que saiu do estoque por entrega no mês (saída).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos que estavam em estoque e passaram a status 'entregue'.",
  },
  pontual_churn: {
    definicao: "Pontual que saiu do estoque por cancelamento no mês (saída).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos que estavam em estoque e passaram a 'cancelado/inativo' ou 'não usar'.",
  },
  pontual_deletados: {
    definicao: "Pontual que sumiu do snapshot do ClickUp no mês (saída).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos que estavam em estoque e não aparecem mais no snapshot do mês.",
  },
  pontual_saida_atipica: {
    definicao: "Pontual que saiu do estoque por outro motivo (ex.: valorp zerado).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos que saíram do estoque sem ser entrega, churn ou deleção.",
  },
  pontual_reajuste: {
    definicao: "Variação de valor de contratos que permaneceram no estoque no mês.",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ (valorp atual − valorp anterior) dos contratos presentes no estoque nos dois snapshots.",
  },
  pontual_estoque_fim: {
    definicao: "Valor do estoque de pontual no fim do mês (posição de fechamento).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês (valorp>0, status fora de entregue/cancelado/não usar).",
    calculo: "Estoque inicial + venda − entrega − churn − deletados − saída atípica + reajuste.",
  },
  pontual_status_ativo: {
    definicao: "Parte do estoque final em contratos com status ativo (em execução).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'ativo'.",
  },
  pontual_status_triagem: {
    definicao: "Parte do estoque final em contratos em triagem.",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'triagem'.",
  },
  pontual_status_pausado: {
    definicao: "Parte do estoque final em contratos pausados.",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'pausado'.",
  },
  pontual_status_onboarding: {
    definicao: "Parte do estoque final em contratos em onboarding.",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'onboarding'.",
  },
  pontual_status_em_cancelamento: {
    definicao: "Parte do estoque final em contratos em cancelamento (ainda contam como estoque).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'em cancelamento'.",
  },
  pontual_status_outros: {
    definicao: "Parte do estoque final em contratos com outros status (defensiva).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Estoque final menos a soma dos cinco status conhecidos.",
  },
```

- [ ] **Step 3: Wire no handler `bp2026.ts`**

Adicionar o import no topo (junto aos outros `montar*`):

```ts
import { montarPontual } from "./bp2026.pontual";
```

Depois da montagem da Revenue (linha que define `const revenue = await montarRevenue(...)`), adicionar:

```ts
      // 9b. Pontual (sub-aba): movimento do estoque pontual via snapshot-diff
      const pontual = await montarPontual({ db, mesCorrente, mesFechado });
```

No objeto `payload`, adicionar o campo (junto aos demais `anexarInfo(...)`):

```ts
        pontual: anexarInfo(pontual),
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run check`
Expected: compila sem erros novos.

- [ ] **Step 5: Smoke do endpoint contra produção**

```bash
cd /Users/mac0267/Cortex
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
lsof -ti:3000 | xargs kill -9 2>/dev/null
DB_HOST=34.95.249.110 DB_USER=postgres DB_NAME=dados_turbo DB_PASSWORD="$PROD_PASS" npm run dev &
sleep 6
curl -s localhost:3000/api/bp2026/receitas | node -e "const d=JSON.parse(require('fs').readFileSync(0));const p=d.pontual;const g=m=>p.find(x=>x.metrica===m).meses[d.mesFechado-1].realizado;const id=['pontual_estoque_ini','pontual_venda','pontual_entrega','pontual_churn','pontual_deletados','pontual_saida_atipica','pontual_reajuste'].map(g);const fim=p.find(x=>x.metrica==='pontual_estoque_fim').meses[d.mesFechado-1].realizado;const soma=id[0]+id[1]+id[2]+id[3]+id[4]+id[5]+id[6];console.log('mesFechado',d.mesFechado,'soma_ponte',Math.round(soma),'estoque_fim',Math.round(fim),'fecha',Math.round(soma)===Math.round(fim));"
lsof -ti:3000 | xargs kill -9 2>/dev/null
```

Expected: `fecha true` (a ponte do último mês fechado bate com o estoque final).

- [ ] **Step 6: Commit**

```bash
git add server/routes/bp2026.pontual.ts server/routes/bp2026.ts server/routes/bp2026.info.ts
git commit -m "feat(bp2026): montarPontual e payload.pontual (ponte do estoque pontual)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Ponte do MRR (recorrente) no backend

Helper puro `montarPonteMrr` (identidade testada) + `montarRevenue` passa a receber `vendasMrrPorMes` e retornar `{ linhas, ponteMrr }`. Wire no handler e INFO.

**Files:**
- Modify: `server/routes/bp2026.revenue.ts`
- Create: `server/routes/bp2026.revenue.test.ts`
- Modify: `server/routes/bp2026.ts`
- Modify: `server/routes/bp2026.info.ts`

**Interfaces:**
- Consumes: `vendasMrrPorMes: Record<number, number>` (já no handler), `snap`/`churnRs` (já em `montarRevenue`).
- Produces: `montarPonteMrr(mrrTotal, churnTotal, vendasMrr, mesCorrente, mesFechado): Linha[]`; `montarRevenue(...)` retorna `{ linhas: Linha[]; ponteMrr: Linha[] }`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `server/routes/bp2026.revenue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { montarPonteMrr } from "./bp2026.revenue";

describe("montarPonteMrr", () => {
  const mrrTotal = { 0: 1000, 1: 1100, 2: 1180 };
  const churnTotal = { 1: 50, 2: 60 };
  const vendasMrr = { 1: 200, 2: 150 };
  const linhas = montarPonteMrr(mrrTotal, churnTotal, vendasMrr, 2, 2);
  const by = (m: string) => linhas.find((l) => l.metrica === m)!;

  it("monta as 5 linhas com sinais corretos (jan)", () => {
    expect(by("ponte_mrr_ini").meses[0].realizado).toBe(1000);   // dez
    expect(by("ponte_mrr_vendas").meses[0].realizado).toBe(200);
    expect(by("ponte_mrr_churn").meses[0].realizado).toBe(-50);
    expect(by("ponte_mrr_delta").meses[0].realizado).toBe(-50);  // 1100-1000-200+50
    expect(by("ponte_mrr_fim").meses[0].realizado).toBe(1100);
  });

  it("a ponte fecha em cada mês", () => {
    for (let i = 0; i < 2; i++) {
      const ini = by("ponte_mrr_ini").meses[i].realizado!;
      const ven = by("ponte_mrr_vendas").meses[i].realizado!;
      const chu = by("ponte_mrr_churn").meses[i].realizado!;
      const del = by("ponte_mrr_delta").meses[i].realizado!;
      const fim = by("ponte_mrr_fim").meses[i].realizado!;
      expect(ini + ven + chu + del).toBe(fim);
    }
  });

  it("YTD: inicial=jan(dez), fluxos somados, final=posição; tudo só-realizado", () => {
    expect(by("ponte_mrr_ini").ytd.realizado).toBe(1000);
    expect(by("ponte_mrr_vendas").ytd.realizado).toBe(350);
    expect(by("ponte_mrr_fim").ytd.realizado).toBe(1180);
    for (const l of linhas) {
      expect(l.direcao).toBe("neutro");
      expect(l.meses[0].orcado).toBe(0);
      expect(l.meses[0].atingimento).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run server/routes/bp2026.revenue.test.ts`
Expected: FAIL — `montarPonteMrr` não exportado.

- [ ] **Step 3: Implementar `montarPonteMrr` e ajustar `montarRevenue`**

Em `server/routes/bp2026.revenue.ts`:

Atualizar a interface `Deps` para receber `vendasMrrPorMes`:

```ts
interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  vendasMrrPorMes: Record<number, number>;
  mesCorrente: number;
  mesFechado: number;
}
```

Adicionar o helper puro (no fim do arquivo, exportado):

```ts
const NOTA_PONTE_INI =
  "MRR ativo no fim do mês anterior (posição de abertura). Janeiro abre com dez/2025.";
const NOTA_PONTE_DELTA =
  "Fecha a ponte: MRR final − inicial − vendas + churn. Captura o que vazou sem virar churn " +
  "declarado (downgrades, reajustes, vendas não ativadas; abonados já entram no churn bruto).";

// Ponte do MRR consolidada (só realizado). mrrTotal indexado 0..12 (0 = dez/2025);
// churnTotal e vendasMrr indexados 1..12. Fecha: ini + vendas − churn + delta = fim.
export function montarPonteMrr(
  mrrTotal: Record<number, number>,
  churnTotal: Record<number, number>,
  vendasMrr: Record<number, number>,
  mesCorrente: number,
  mesFechado: number,
): Linha[] {
  const ini = (m: number) => mrrTotal[m - 1] ?? 0;
  const fim = (m: number) => mrrTotal[m] ?? 0;
  const ven = (m: number) => vendasMrr[m] ?? 0;
  const chu = (m: number) => churnTotal[m] ?? 0;
  const delta = (m: number) => fim(m) - ini(m) - ven(m) + chu(m);

  const serie = (f: (m: number) => number) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));
  const sumYtd = (f: (m: number) => number): number | null => {
    if (mesFechado === 0) return null;
    let s = 0;
    for (let m = 1; m <= mesFechado; m++) s += f(m);
    return s;
  };

  const mk = (
    metrica: string,
    titulo: string,
    tipoAgregacao: "fluxo" | "estoque",
    s: (number | null)[],
    ytdReal: number | null,
    extra: Partial<Linha> = {},
  ): Linha => ({
    metrica, titulo, tipoAgregacao, direcao: "neutro", unidade: "brl", ...extra,
    meses: s.map((r, i) => ({ mes: i + 1, orcado: 0, realizado: r, atingimento: null })),
    ytd: { orcado: 0, realizado: mesFechado === 0 ? null : ytdReal, atingimento: null },
  });

  return [
    mk("ponte_mrr_ini", "(=) MRR inicial", "estoque", serie(ini), ini(1), { nota: NOTA_PONTE_INI }),
    mk("ponte_mrr_vendas", "(+) Vendas MRR", "fluxo", serie(ven), sumYtd(ven)),
    mk("ponte_mrr_churn", "(−) Churn", "fluxo", serie((m) => -chu(m)), sumYtd((m) => -chu(m))),
    mk("ponte_mrr_delta", "(±) Δ não explicado", "fluxo", serie(delta), sumYtd(delta), { nota: NOTA_PONTE_DELTA }),
    mk("ponte_mrr_fim", "(=) MRR final", "estoque", serie(fim), mesFechado === 0 ? null : fim(mesFechado), { destaque: true }),
  ];
}
```

Atualizar a assinatura/retorno de `montarRevenue`. Trocar a linha de assinatura:

```ts
export async function montarRevenue({ db, orcado, vendasMrrPorMes, mesCorrente, mesFechado }: Deps): Promise<{ linhas: Linha[]; ponteMrr: Linha[] }> {
```

No fim de `montarRevenue`, antes do `return linhas;`, calcular os totais e a ponte e trocar o return:

```ts
  // Ponte do MRR consolidada: totais por mês a partir do snap (0 = dez/2025) e do churn.
  const mrrTotal: Record<number, number> = {};
  for (let m = 0; m <= 12; m++) {
    mrrTotal[m] = LINHAS_SERVICO.reduce((acc, { chave }) => acc + (snap[chave]?.[m]?.mrr ?? 0), 0);
  }
  const churnTotal: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    churnTotal[m] = LINHAS_SERVICO.reduce((acc, { chave }) => acc + (churnRs[chave]?.[m] ?? 0), 0);
  }
  const ponteMrr = montarPonteMrr(mrrTotal, churnTotal, vendasMrrPorMes, mesCorrente, mesFechado);

  return { linhas, ponteMrr };
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx vitest run server/routes/bp2026.revenue.test.ts`
Expected: PASS.

- [ ] **Step 5: Ajustar o handler `bp2026.ts`**

Trocar a chamada de `montarRevenue` (atualmente `const revenue = await montarRevenue({ db, orcado, mesCorrente, mesFechado });`) por:

```ts
      // 9. Revenue por linha de serviço + ponte do MRR consolidada (sub-aba)
      const { linhas: revenue, ponteMrr } = await montarRevenue({ db, orcado, vendasMrrPorMes, mesCorrente, mesFechado });
```

No objeto `payload`, adicionar:

```ts
        ponteMrr: anexarInfo(ponteMrr),
```

- [ ] **Step 6: Adicionar INFO das métricas da ponte**

Em `server/routes/bp2026.info.ts`, dentro de `INFO_METRICAS`, adicionar:

```ts
  // ===== Ponte do MRR (recorrente) =====
  ponte_mrr_ini: {
    definicao: "MRR ativo no fim do mês anterior (posição de abertura da ponte).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês anterior (status ativo/onboarding/triagem). Janeiro abre com dez/2025.",
    calculo: "Soma de valorr da base ativa no snapshot anterior.",
  },
  ponte_mrr_vendas: {
    definicao: "Novo MRR vendido no mês (new business).",
    fonte: FONTE_BITRIX,
    calculo: "Σ valor_recorrente dos deals ganhos no mês.",
  },
  ponte_mrr_churn: {
    definicao: "MRR perdido por churn no mês (saída).",
    fonte: FONTE_CHURN,
    calculo: "Soma do churn bruto em R$ de todos os produtos no mês (sinal negativo na ponte).",
  },
  ponte_mrr_delta: {
    definicao: "Ajuste que fecha a ponte: MRR não explicado (downgrades, reajustes, vendas não ativadas).",
    fonte: "Derivada das demais linhas da ponte.",
    calculo: "MRR final − MRR inicial − vendas + churn. Negativo quando houve vazamento de MRR.",
  },
  ponte_mrr_fim: {
    definicao: "MRR ativo no fim do mês (posição de fechamento).",
    fonte: FONTE_SNAPSHOT,
    calculo: "MRR inicial + vendas − churn + Δ não explicado.",
  },
```

- [ ] **Step 7: Verificar tipos e rodar a suíte de testes do bp2026**

Run: `npm run check`
Expected: compila sem erros.

Run: `npx vitest run server/routes/bp2026.revenue.test.ts server/routes/bp2026.pontual.helpers.test.ts server/routes/bp2026.helpers.test.ts`
Expected: PASS em todos.

- [ ] **Step 8: Commit**

```bash
git add server/routes/bp2026.revenue.ts server/routes/bp2026.revenue.test.ts server/routes/bp2026.ts server/routes/bp2026.info.ts
git commit -m "feat(bp2026): ponte do MRR recorrente (payload.ponteMrr) com identidade testada

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Frontend — aba Pontual + bloco Ponte do MRR

Expor `ponteMrr` e `pontual` no tipo, renderizar a ponte como bloco no topo da aba Revenue e criar a 10ª aba "Pontual". Validação por `tsc` + browser (dark/light).

**Files:**
- Modify: `client/src/pages/BP2026.tsx`

**Interfaces:**
- Consumes: `data.ponteMrr`, `data.pontual` (Task 3 e 4); `BPDreTable` com `mostrarOrcado` (Task 1).

- [ ] **Step 1: Adicionar os campos ao tipo `ReceitasResponse`**

```tsx
  revenue: BPLinha[];
  ponteMrr: BPLinha[];
  pontual: BPLinha[];
  funil: BPLinha[];
```

- [ ] **Step 2: Adicionar a `TabsTrigger` "Pontual"**

Após `<TabsTrigger value="outras">Outras Receitas</TabsTrigger>`:

```tsx
          <TabsTrigger value="pontual">Pontual</TabsTrigger>
```

- [ ] **Step 3: Renderizar a Ponte do MRR no topo da aba Revenue**

Substituir o bloco `<TabsContent value="revenue" ...>` inteiro por:

```tsx
        <TabsContent value="revenue" className="mt-4 space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
              Ponte do MRR — movimento mensal (só realizado)
            </h3>
            <BPDreTable
              linhas={data.ponteMrr}
              mesCorrente={data.mesCorrente}
              mesFechado={data.mesFechado}
              mostrarOrcado={false}
            />
          </div>
          <BPDreTable
            linhas={data.revenue}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            onCellClick={(metrica, mes) => setDetalhe({ metrica, mes })}
          />
        </TabsContent>
```

- [ ] **Step 4: Adicionar o `TabsContent` da aba Pontual**

Após o `<TabsContent value="outras">...</TabsContent>` (antes do `</Tabs>`):

```tsx
        <TabsContent value="pontual" className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
            Movimento do estoque de contratos pontuais (só realizado)
          </h3>
          <BPDreTable
            linhas={data.pontual}
            mesCorrente={data.mesCorrente}
            mesFechado={data.mesFechado}
            mostrarOrcado={false}
          />
        </TabsContent>
```

- [ ] **Step 5: Verificar tipos**

Run: `npm run check`
Expected: compila sem erros.

- [ ] **Step 6: Verificação visual no browser**

```bash
cd /Users/mac0267/Cortex
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
lsof -ti:3000 | xargs kill -9 2>/dev/null
DB_HOST=34.95.249.110 DB_USER=postgres DB_NAME=dados_turbo DB_PASSWORD="$PROD_PASS" npm run dev
```

Abrir `http://localhost:3000/bp-2026`:
- Aba **Revenue**: bloco "Ponte do MRR" no topo (5 linhas, só realizado), tabela por produto abaixo intacta.
- Aba **Pontual**: ponte (8 linhas) + decomposição por status; estoque final em negrito.
- Conferir **dark e light mode**. As colunas mostram só o número realizado (sem orçado/ating.).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/BP2026.tsx
git commit -m "feat(bp2026): aba Pontual e bloco Ponte do MRR na Revenue

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Validação final contra produção e fechamento

Confere a identidade das duas pontes mês a mês contra produção e fecha a branch.

**Files:** nenhum (validação).

- [ ] **Step 1: Identidade da ponte pontual em todos os meses (SQL direto em produção)**

```bash
cd /Users/mac0267/Cortex
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
WITH alvo AS (
  SELECT gs.mes, MAX(h.data_snapshot::date) AS d
  FROM generate_series(0, 6) AS gs(mes)
  JOIN \"Clickup\".cup_data_hist h
    ON h.data_snapshot::date >= (make_date(2025,12,1) + (gs.mes||' months')::interval)::date
   AND h.data_snapshot::date <  (make_date(2025,12,1) + ((gs.mes+1)||' months')::interval)::date
  GROUP BY gs.mes
),
snap AS (
  SELECT a.mes, h.id_subtask, h.valorp::numeric AS v, h.status,
         (h.valorp::numeric>0 AND h.status NOT IN ('entregue','cancelado/inativo','não usar')) AS est
  FROM alvo a JOIN \"Clickup\".cup_data_hist h ON h.data_snapshot::date=a.d
  WHERE h.valorp::numeric>0
)
SELECT m AS mes,
  ROUND((SELECT COALESCE(SUM(v),0) FROM snap WHERE mes=m-1 AND est)) AS ini,
  ROUND((SELECT COALESCE(SUM(cur.v),0) FROM snap cur WHERE cur.mes=m AND cur.est
         AND NOT EXISTS (SELECT 1 FROM snap pr WHERE pr.mes=m-1 AND pr.est AND pr.id_subtask=cur.id_subtask))) AS venda,
  ROUND((SELECT COALESCE(SUM(v),0) FROM snap WHERE mes=m AND est)) AS fim
FROM generate_series(1,6) AS g(m) ORDER BY m;"
```

Expected: série coerente (ini do mês = fim do mês anterior; valores positivos). Confronto fino da identidade já coberto pelo Step 5 da Task 3 (`fecha true`).

- [ ] **Step 2: Conferir a ponte do MRR via endpoint (produção)**

```bash
cd /Users/mac0267/Cortex
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
lsof -ti:3000 | xargs kill -9 2>/dev/null
DB_HOST=34.95.249.110 DB_USER=postgres DB_NAME=dados_turbo DB_PASSWORD="$PROD_PASS" npm run dev &
sleep 6
curl -s localhost:3000/api/bp2026/receitas | node -e "const d=JSON.parse(require('fs').readFileSync(0));const p=d.ponteMrr;const v=(m,i)=>p.find(x=>x.metrica===m).meses[i].realizado;for(let i=0;i<d.mesFechado;i++){const ini=v('ponte_mrr_ini',i),ven=v('ponte_mrr_vendas',i),chu=v('ponte_mrr_churn',i),del=v('ponte_mrr_delta',i),fim=v('ponte_mrr_fim',i);console.log('mes',i+1,'fecha',Math.round(ini+ven+chu+del)===Math.round(fim));}"
lsof -ti:3000 | xargs kill -9 2>/dev/null
```

Expected: `fecha true` para todos os meses fechados.

- [ ] **Step 3: Suíte de testes completa e tipos**

Run: `npm run check && npx vitest run server/routes/bp2026.pontual.helpers.test.ts server/routes/bp2026.revenue.test.ts server/routes/bp2026.helpers.test.ts`
Expected: tudo PASS / sem erro de tipo.

- [ ] **Step 4: Push e abrir PR**

```bash
cd /Users/mac0267/Cortex
git push
gh pr create --base main --head feature/bp2026-movimento-estoque \
  --title "feat(bp2026): movimento de estoque — ponte do MRR + aba Pontual" \
  --body "$(cat <<'EOF'
## O que muda
- Aba **Revenue**: bloco "Ponte do MRR" (estoque inicial → vendas → churn → Δ não explicado → estoque final), só realizado, consolidado.
- Nova aba **Pontual**: movimento do estoque pontual via snapshot-diff de cup_data_hist (estoque → venda → entrega → churn → deletados/saída/reajuste → estoque final) + decomposição por status.
- `BPDreTable` ganha modo `mostrarOrcado={false}`.

## Validação
- Identidade das duas pontes fecha em todos os meses fechados (testes unitários + smoke contra produção).
- Spec: docs/superpowers/specs/2026-06-17-bp2026-movimento-estoque-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR criado contra `main`.

---

## Self-Review

**1. Spec coverage:**
- Ponte do MRR recorrente (5 linhas, Δ visível, só realizado, consolidado) → Task 4 + Task 5. ✓
- Aba Pontual (ponte snapshot-diff, ajustes detalhados, decomposição por status, consolidado, só realizado, nova aba) → Tasks 2, 3, 5. ✓
- `mostrarOrcado` no BPDreTable → Task 1. ✓
- INFO_METRICAS de toda métrica nova → Tasks 3 e 4. ✓
- Validação de identidade contra produção → Tasks 3 (smoke), 4 (teste), 6. ✓
- Fora de escopo (drill, por produto, orçado, não mexer em view/estoque-pontual) → respeitado (nenhuma task toca esses pontos). ✓

**2. Placeholder scan:** Sem TBD/TODO; todo passo de código tem o código; comandos com saída esperada. ✓

**3. Type consistency:** `RegPontual`, `PonteMes`, `LinhaPontual`, `montarLinhasPontual`, `montarPontual`, `montarPonteMrr` e o retorno `{ linhas, ponteMrr }` de `montarRevenue` usados de forma idêntica entre tasks. Métricas `pontual_*` e `ponte_mrr_*` batem entre helper, INFO e teste. ✓
