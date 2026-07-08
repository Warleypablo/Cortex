# ROI por canal (CAC por canal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir ROI MRR e ROI Pontual (valor vendido ÷ custo total) em cada card da seção "CAC por canal" da tela /gestao/receita, com valores vendidos vindos dos deals ganhos do Bitrix.

**Architecture:** O backend (`computeCacCanais`) já busca uma linha por deal ganho; passamos a trazer `valor_recorrente`/`valor_pontual` de cada deal e a agregação pura (`agregarCacCanais`) acumula `vendidoMrr`/`vendidoPontual` por canal (mês a mês, como clientes). O ROI **não** vai no payload: o frontend calcula `vendido ÷ custoVivo` para reagir ao vivo à edição de metas, como o CAC já faz.

**Tech Stack:** TypeScript, Drizzle (sql tag), Vitest, React + Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-08-roi-por-canal-design.md`

## Global Constraints

- Branch: trabalhar direto na `main` (autorização durável do Ichino; sessão única).
- Commits: Conventional Commits, sempre terminando com `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- Subagentes: **NUNCA** rodar/derrubar dev server (porta 3000), **NUNCA** `git stash`, **NUNCA** amend/rebase. Validar com `npx vitest run <arquivo>` e `npm run check`.
- `npm run check` tem erros pré-existentes (baseline); validar com `npm run check 2>&1 | grep -E "cacCanais|CacPorCanal"` → deve retornar vazio.
- Dark/light mode obrigatório: todo texto novo com par `text-gray-*` / `dark:text-zinc-*` (ou `dark:text-white`).
- Formato do ROI: multiplicador com 1 casa decimal, vírgula BR, sufixo `x` (ex.: `1,8x`). Custo 0 → `—`.

---

### Task 1: Backend — `vendidoMrr`/`vendidoPontual` na agregação pura (TDD)

**Files:**
- Modify: `server/routes/gestaoReceita.cacCanais.ts` (interfaces L44-60, loop de deals L76-81, map de canais L85-115, totais L117-127)
- Test: `server/routes/gestaoReceita.cacCanais.test.ts`

**Interfaces:**
- Consumes: `agregarCacCanais(deals, metas, mesesNums, autos?, contratosCanalMes?)` existente.
- Produces: `DealsSourceMes` ganha `vrec?: number; vpont?: number` (opcionais — deals antigos/testes existentes seguem válidos). `CacCanalOut` e `CacCanaisOut["geral"]` ganham `vendidoMrr: number; vendidoPontual: number`. Task 2 preenche `vrec`/`vpont`; Task 3 consome `vendidoMrr`/`vendidoPontual` no payload.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final do `describe("agregarCacCanais", ...)` em `server/routes/gestaoReceita.cacCanais.test.ts` (antes do `});` final, linha 179):

```ts
  it("vendidoMrr/vendidoPontual: soma valores dos deals por canal", () => {
    const out = agregarCacCanais(
      [
        { source: "WEBFORM", mes: 6, clientes: 1, vrec: 10000, vpont: 5000 },
        { source: "ADVERTISING", mes: 6, clientes: 1, vrec: 2500, vpont: 0 },
        { source: "UC_YWZVA2", mes: 6, clientes: 1, vrec: 0, vpont: 8000 },
      ],
      [],
      JUN,
    );
    const inbound = out.canais.find((c) => c.id === "inbound")!;
    const outbound = out.canais.find((c) => c.id === "outbound")!;
    expect(inbound.vendidoMrr).toBe(12500);
    expect(inbound.vendidoPontual).toBe(5000);
    expect(outbound.vendidoMrr).toBe(0);
    expect(outbound.vendidoPontual).toBe(8000);
    expect(out.geral.vendidoMrr).toBe(12500);
    expect(out.geral.vendidoPontual).toBe(13000);
  });

  it("vendido: multi-mês soma só os meses do range; source fora do catálogo fica fora", () => {
    const out = agregarCacCanais(
      [
        { source: "WEBFORM", mes: 5, clientes: 1, vrec: 1000, vpont: 100 },
        { source: "WEBFORM", mes: 6, clientes: 1, vrec: 2000, vpont: 200 },
        { source: "WEBFORM", mes: 7, clientes: 1, vrec: 4000, vpont: 400 },
        { source: "(não informado)", mes: 6, clientes: 1, vrec: 9999, vpont: 9999 },
      ],
      [],
      MAI_JUN,
    );
    const inbound = out.canais.find((c) => c.id === "inbound")!;
    expect(inbound.vendidoMrr).toBe(3000);
    expect(inbound.vendidoPontual).toBe(300);
    expect(out.geral.vendidoMrr).toBe(3000);
    expect(out.geral.vendidoPontual).toBe(300);
  });

  it("deals sem vrec/vpont (retrocompat): clientes contam, vendido = 0", () => {
    const out = agregarCacCanais([{ source: "WEBFORM", mes: 6, clientes: 2 }], [], JUN);
    const inbound = out.canais.find((c) => c.id === "inbound")!;
    expect(inbound.clientes).toBe(2);
    expect(inbound.vendidoMrr).toBe(0);
    expect(inbound.vendidoPontual).toBe(0);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/gestaoReceita.cacCanais.test.ts`
Expected: 3 testes novos FALHAM (`vendidoMrr` é `undefined`); os 13 existentes passam.

- [ ] **Step 3: Implementar a agregação**

Em `server/routes/gestaoReceita.cacCanais.ts`:

(a) Interface `DealsSourceMes` (linha 44) — adicionar campos opcionais:

```ts
// 1 linha por deal ganho: source (→ canal) + mês (→ contagem de clientes) + valores
// vendidos do deal (vrec/vpont → ROI). Contratos NÃO vêm daqui — cup_contratos.
export interface DealsSourceMes { source: string; mes: number; clientes: number; vrec?: number; vpont?: number }
```

(b) `CacCanalOut` (linhas 50-56) — adicionar na primeira linha de campos:

```ts
export interface CacCanalOut {
  id: string; label: string; clientes: number; contratos: number; custoTotal: number;
  vendidoMrr: number; vendidoPontual: number;
  cacCliente: number | null; cacContrato: number | null;
```

(c) `CacCanaisOut.geral` (linha 58):

```ts
  geral: {
    cac: number | null; cacContrato: number | null; clientes: number; contratos: number; custoTotal: number;
    vendidoMrr: number; vendidoPontual: number;
  };
```

(d) No loop de deals dentro de `agregarCacCanais` (linhas 76-81), acumular vendido junto com clientes:

```ts
  const clientesCanalMes: Record<string, Record<number, number>> = {};
  const vendidoCanalMes: Record<string, Record<number, { mrr: number; pont: number }>> = {};
  for (const d of deals) {
    const canal = sourceToCanal[d.source];
    if (!canal) continue; // sources fora do catálogo ficam fora da seção (nota na UI)
    (clientesCanalMes[canal] ??= {})[d.mes] = (clientesCanalMes[canal]?.[d.mes] || 0) + (Number(d.clientes) || 0);
    const v = ((vendidoCanalMes[canal] ??= {})[d.mes] ??= { mrr: 0, pont: 0 });
    v.mrr += Number(d.vrec) || 0;
    v.pont += Number(d.vpont) || 0;
  }
```

(e) No map de canais (após a linha `const contratos = ...`, linha 89), somar o range:

```ts
    const porMesVend = vendidoCanalMes[def.id] || {};
    const vendidoMrr = mesesNums.reduce((a, m) => a + (porMesVend[m]?.mrr || 0), 0);
    const vendidoPontual = mesesNums.reduce((a, m) => a + (porMesVend[m]?.pont || 0), 0);
```

E no objeto retornado do map (linha 108-114), incluir os campos:

```ts
    return {
      id: def.id, label: def.label, clientes, contratos, custoTotal,
      vendidoMrr, vendidoPontual,
      cacCliente: clientes > 0 ? Math.round(custoTotal / clientes) : null,
      cacContrato: contratos > 0 ? Math.round(custoTotal / contratos) : null,
      sources: def.sources.map(sourceLabel),
      itens, incentivo,
    };
```

(f) Nos totais (linhas 117-127):

```ts
  const totClientes = canais.reduce((a, c) => a + c.clientes, 0);
  const totContratos = canais.reduce((a, c) => a + c.contratos, 0);
  const totCusto = canais.reduce((a, c) => a + c.custoTotal, 0);
  const totVendMrr = canais.reduce((a, c) => a + c.vendidoMrr, 0);
  const totVendPont = canais.reduce((a, c) => a + c.vendidoPontual, 0);
  return {
    geral: {
      cac: totClientes > 0 ? Math.round(totCusto / totClientes) : null,
      cacContrato: totContratos > 0 ? Math.round(totCusto / totContratos) : null,
      clientes: totClientes, contratos: totContratos, custoTotal: totCusto,
      vendidoMrr: totVendMrr, vendidoPontual: totVendPont,
    },
    canais,
  };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/routes/gestaoReceita.cacCanais.test.ts`
Expected: 16 testes PASSAM.

- [ ] **Step 5: Typecheck sem erros novos**

Run: `npm run check 2>&1 | grep -E "cacCanais"`
Expected: saída vazia.

- [ ] **Step 6: Commit**

```bash
git add server/routes/gestaoReceita.cacCanais.ts server/routes/gestaoReceita.cacCanais.test.ts
git commit -m "feat(gestao-receita): agrega vendidoMrr/vendidoPontual por canal no CAC por canal

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — buscar `valor_recorrente`/`valor_pontual` dos deals

**Files:**
- Modify: `server/routes/gestaoReceita.cacCanais.ts` (query de deals L215-223, push L266-276)

**Interfaces:**
- Consumes: `DealsSourceMes.vrec/vpont` (Task 1).
- Produces: payload do endpoint `/api/gestao-receita` com `cacCanais.canais[].vendidoMrr/vendidoPontual` e `cacCanais.geral.vendidoMrr/vendidoPontual` preenchidos (consumido pela Task 3).

- [ ] **Step 1: Adicionar colunas à query de deals**

Em `computeCacCanais`, na primeira query do `Promise.all` (linhas 215-223), acrescentar as duas colunas de valor:

```ts
    db.execute(sql`
      SELECT COALESCE(NULLIF(source, ''), '(não informado)') AS source,
             EXTRACT(MONTH FROM data_fechamento)::int AS mes,
             regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') AS cnpj_norm,
             data_fechamento,
             COALESCE(valor_recorrente::numeric, 0) AS vrec,
             COALESCE(valor_pontual::numeric, 0) AS vpont
      FROM "Bitrix".crm_deal
      WHERE stage_name = ${STAGE_GANHO}
        AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}
    `),
```

E atualizar o comentário acima da query para:

```ts
    // uma linha por deal ganho: source (→ canal) + mês (→ clientes) + valores vendidos
    // (vrec/vpont → ROI, mesma fonte do card "Venda nova") + cnpj/data p/ montar
    // o mapa cnpj→canal (desempate: deal ganho mais recente do período).
```

- [ ] **Step 2: Preencher vrec/vpont no push**

No loop de `dealsRows` (linha 269):

```ts
    clientesDeals.push({
      source: r.source, mes: Number(r.mes), clientes: 1,
      vrec: parseFloat(r.vrec) || 0, vpont: parseFloat(r.vpont) || 0,
    });
```

- [ ] **Step 3: Verificar contra o banco local com script temporário**

Criar `scripts/tmp-check-roi-canal.ts` (temporário, apagado no Step 5):

```ts
// Verificação manual da Task 2 — apagar após uso.
import { db } from "../server/db";
import { computeCacCanais } from "../server/routes/gestaoReceita.cacCanais";

const out = await computeCacCanais(db as any, { dIni: "2026-06-01", dFim: "2026-07-01", ano: 2026, mesesNums: [6] });
console.log("geral:", JSON.stringify(out.geral));
for (const c of out.canais) {
  console.log(`${c.id}: clientes=${c.clientes} vendidoMrr=${c.vendidoMrr} vendidoPontual=${c.vendidoPontual}`);
}
process.exit(0);
```

Run: `npx tsx scripts/tmp-check-roi-canal.ts`
Expected: `geral.vendidoMrr` e `geral.vendidoPontual` > 0, próximos (≤) de R$ 285.235 / R$ 383.298 (totais jun/26 dos deals ganhos; a diferença são deals com source fora dos 9 canais). Nenhum canal com vendido negativo.

- [ ] **Step 4: Cross-check SQL (banco local)**

```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "
SELECT ROUND(SUM(COALESCE(valor_recorrente::numeric,0))) AS mrr,
       ROUND(SUM(COALESCE(valor_pontual::numeric,0))) AS pontual
FROM \"Bitrix\".crm_deal
WHERE stage_name = 'Negócio Ganho'
  AND data_fechamento >= '2026-06-01' AND data_fechamento < '2026-07-01'
  AND source IN ('WEBFORM','ADVERTISING','STORE','WEB','CALL','BOOKING','EMAIL','TRADE_SHOW','instagram_organic','UC_YWZVA2','UC_4VCKGM','UC_HIBVO6','UC_8HI30Y','OTHER','UC_PTYW1Y','CALLBACK','RC_GENERATOR','RECOMMENDATION','UC_KYOYOW','PARTNER','UC_7WV0LW','REPEAT_SALE');"
```

Expected: `mrr` e `pontual` idênticos a `geral.vendidoMrr`/`geral.vendidoPontual` do Step 3.

- [ ] **Step 5: Apagar o script temporário e rodar testes + typecheck**

```bash
rm scripts/tmp-check-roi-canal.ts
npx vitest run server/routes/gestaoReceita.cacCanais.test.ts
npm run check 2>&1 | grep -E "cacCanais"
```

Expected: 16 testes passam; grep vazio.

- [ ] **Step 6: Commit**

```bash
git add server/routes/gestaoReceita.cacCanais.ts
git commit -m "feat(gestao-receita): busca valor vendido MRR/Pontual dos deals no CAC por canal

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — ROI nos cards, no geral e na Nota

**Files:**
- Modify: `client/src/components/gestao/CacPorCanal.tsx` (tipos L12-22, header SectionCard L70-80, rodapé do card L136-143, Nota L150-156)

**Interfaces:**
- Consumes: `CacCanalCard.vendidoMrr/vendidoPontual` e `CacCanaisData.geral.vendidoMrr/vendidoPontual` (payload da Task 2); helpers existentes `brl`, `custoVivo`, `geralCusto`.
- Produces: UI final. Nenhuma task posterior consome.

- [ ] **Step 1: Atualizar tipos e adicionar helper de formatação**

(a) `CacCanalCard` (linha 12) — adicionar após `custoTotal`:

```ts
export interface CacCanalCard {
  id: string; label: string; clientes: number; contratos: number; custoTotal: number;
  vendidoMrr: number; vendidoPontual: number;
  cacCliente: number | null; cacContrato: number | null;
  sources: string[];
  itens: CacCanalItem[];
  incentivo?: { label: string; unit: number; qtd: number; total: number };
}
```

(b) `CacCanaisData` (linha 19):

```ts
export interface CacCanaisData {
  geral: {
    cac: number | null; cacContrato: number | null; clientes: number; contratos: number; custoTotal: number;
    vendidoMrr: number; vendidoPontual: number;
  };
  canais: CacCanalCard[];
}
```

(c) Helper module-level, logo após `type ModoCac = "cliente" | "contrato";` (linha 24):

```ts
// ROI como multiplicador ROAS (1 casa, vírgula BR). Custo 0 → null (UI exibe "—",
// mantendo o valor vendido visível). Divide pelo custo VIVO p/ reagir à edição de metas.
const roiX = (vendido: number, custo: number) =>
  custo > 0
    ? (vendido / custo).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "x"
    : null;
```

- [ ] **Step 2: ROI geral no SectionCard do header**

Após o bloco `CAC geral · N clientes` (linha 77-79, o `<div className="mt-0.5 ...">`), adicionar:

```tsx
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 dark:text-zinc-400">
          <span>
            ROI MRR <b className="tabular-nums text-gray-900 dark:text-white">{roiX(dados.geral.vendidoMrr, geralCusto) ?? "—"}</b>
            {" · vendido "}<b className="tabular-nums text-gray-700 dark:text-zinc-300">{brl(dados.geral.vendidoMrr)}</b>
          </span>
          <span>
            ROI Pontual <b className="tabular-nums text-gray-900 dark:text-white">{roiX(dados.geral.vendidoPontual, geralCusto) ?? "—"}</b>
            {" · vendido "}<b className="tabular-nums text-gray-700 dark:text-zinc-300">{brl(dados.geral.vendidoPontual)}</b>
          </span>
        </div>
```

- [ ] **Step 3: Bloco de ROI no rodapé de cada card**

Após o `<div>` do rodapé "Clientes/Custo total" (linhas 136-143), adicionar como irmão:

```tsx
                <div className="mt-1 space-y-1 border-t border-gray-100 pt-2 text-sm dark:border-zinc-800">
                  {([["ROI MRR", c.vendidoMrr], ["ROI Pontual", c.vendidoPontual]] as [string, number][]).map(([lbl, vendido]) => (
                    <div key={lbl} className="flex items-center justify-between gap-2">
                      <span className="text-gray-600 dark:text-zinc-400">
                        {lbl} <b className="tabular-nums text-gray-900 dark:text-white">{roiX(vendido, custo) ?? "—"}</b>
                      </span>
                      <span className="text-gray-500 dark:text-zinc-400">
                        vendido <b className="tabular-nums text-gray-700 dark:text-zinc-300">{brl(vendido)}</b>
                      </span>
                    </div>
                  ))}
                </div>
```

(O `custo` é a variável já existente no map — `custoVivo(c)` — então o ROI recalcula ao vivo durante a edição de metas.)

- [ ] **Step 4: Atualizar a Nota da seção**

No `<Nota>` (linhas 150-156), acrescentar antes da frase sobre "Parceria":

```tsx
        <b> ROI MRR</b> = valor recorrente vendido ÷ custo total do canal; <b>ROI Pontual</b> = valor pontual vendido ÷ custo total.
        Valores vendidos = deals ganhos do Bitrix (mesma fonte do card "Venda nova"); como deals com source fora dos 9 canais ficam de fora,
        a soma dos canais pode ficar abaixo do card.
```

- [ ] **Step 5: Typecheck**

Run: `npm run check 2>&1 | grep -E "CacPorCanal|cacCanais"`
Expected: vazio.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/gestao/CacPorCanal.tsx
git commit -m "feat(gestao-receita): ROI MRR e ROI Pontual nos cards do CAC por canal

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Verificação e2e no browser + changelog + push

**Files:**
- Modify: `docs/CHANGELOG.md` (entrada no topo)

**Interfaces:**
- Consumes: tudo das Tasks 1-3.
- Produces: feature verificada e publicada.

⚠️ Esta task reinicia o dev server — executar na sessão principal, **não** delegar a subagente.

- [ ] **Step 1: Reiniciar o dev server**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev
```

(Antes de matar, conferir com `lsof -a -p $(lsof -ti:3000) -d cwd` se o server na 3000 é desta árvore; se for de outra sessão/worktree, subir na 3001 com `PORT=3001 npm run dev`.)

- [ ] **Step 2: Verificar no browser (light e dark)**

Abrir `http://localhost:3000/gestao/receita` (aba Macro, jun/2026), seção "CAC por canal":
- Cada card mostra ROI MRR e ROI Pontual + vendido; Inbound com valores > 0.
- Card "Recomendação" (custo 0): ROI `—`, vendido visível.
- Header: ROI MRR/Pontual gerais ao lado do CAC geral; soma dos vendidos ≈ card "Venda nova" da tela (pode ficar abaixo).
- Clicar "Editar metas", alterar um custo → ROI do card recalcula ao vivo.
- Alternar toggle "Por cliente/Por contrato" → ROI não muda.
- Alternar dark mode → contraste ok nas linhas novas.

- [ ] **Step 3: Entrada no changelog**

Adicionar no topo de `docs/CHANGELOG.md` (após `# Changelog`):

```markdown
## 2026-07-08 | feat(gestao-receita): ROI MRR e ROI Pontual por canal no CAC por canal

**O que foi feito:**
- Cada card da seção "CAC por canal" (aba Macro) ganhou **ROI MRR** e **ROI Pontual** (multiplicador, ex.: 1,8x) + valor vendido; card geral idem.
- ROI = valor vendido ÷ custo total do canal; valores vendidos = `valor_recorrente`/`valor_pontual` dos deals ganhos do Bitrix (mesma fonte do card "Venda nova"), agregados por source → macro-canal.
- ROI recalcula ao vivo na edição de metas (divide pelo custo vivo); custo 0 → "—"; independe do toggle Por cliente/Por contrato.

**Por que:**
- Pedido do stakeholder: ler o retorno de cada canal sobre o custo investido, separado em recorrente e pontual.

**Arquivos alterados:**
- `server/routes/gestaoReceita.cacCanais.ts` - query de deals traz vrec/vpont; agregação acumula vendidoMrr/vendidoPontual por canal e no geral.
- `server/routes/gestaoReceita.cacCanais.test.ts` - 3 testes novos (agregação, multi-mês/fora do catálogo, retrocompat).
- `client/src/components/gestao/CacPorCanal.tsx` - bloco de ROI nos cards e no header + nota atualizada.

**Impacto arquitetural:** Nenhum. Payload cresce 2 campos por canal; ROI calculado no frontend (custo vivo).

---
```

- [ ] **Step 4: Commit final + push**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): ROI por canal no CAC por canal

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 5: Obsidian sync**

Seguir `agents/obsidian-sync-SKILL.md`: domínio `05-Comercial/` — procurar épico da Gestão de Receita (`grep -rl "gestao" "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/05-Comercial/"`), adicionar task `- [x] ROI MRR/Pontual por canal na seção CAC por canal #comercial ✅ 2026-07-08` (ou nota, se não houver épico) e atualizar `atualizado:` no frontmatter.
