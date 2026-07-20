# Histórico de churn pontual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma barra de churn pontual ao lado da barra de MRR no gráfico "Histórico de Churn {ano}", ocultada em anos cuja cobertura do dado seja baixa demais para ser honesta.

**Architecture:** O endpoint `/api/analytics/churn-historico-mensal` ganha o join lateral com `cup_contratos` (mesmo padrão já validado no endpoint de detalhamento) e passa a somar `valorp` por mês, mais um flag de cobertura. A régua de cobertura vira função pura em `shared/`, testável e importável pelos dois lados. O componente ganha uma `<Bar>` sem `stackId`, que o Recharts posiciona ao lado do grupo empilhado.

**Tech Stack:** TypeScript, React, Drizzle (`db.execute(sql\`\`)`), Recharts, Tailwind, vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-20-churn-historico-pontual-design.md`

## Global Constraints

- Trabalhar em `/Users/mac0267/Cortex-wt-churn-detalhamento`, branch `feature/churn-historico-pontual`. **NÃO** usar `/Users/mac0267/Cortex` — outra sessão está ativa lá.
- Dark mode E light mode obrigatórios. Cor em SVG segue o padrão do arquivo: `const x = isDark ? "#claro" : "#escuro"`. Nunca hex fixo sem ramificação de tema.
- Valores monetários sempre via `formatCurrencyNoDecimals` de `@/lib/utils`.
- **O pontual não recebe percentual nem meta.** Só valor em R$. A meta de 8% permanece definida sobre MRR.
- Nunca renderizar `R$ 0` como se fosse informação — quando o pontual do mês for 0, a linha do tooltip é omitida.
- Limiar de cobertura: **10%** das linhas do ano com `valorp > 0`. Valores medidos: 2026 = 23,5% (mostra), 2025 = 3,7% (oculta), 2024 = 0,0% (oculta).
- `npm run check` tem **124 erros pré-existentes** fora do escopo. Estabelecer baseline antes de editar e comparar depois; só erros novos contam.
- NÃO rodar `npm run dev`. NÃO matar a porta 3000. NÃO usar `git stash`. NÃO fazer amend nem rebase.
- Commits em Conventional Commits com `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `shared/churnPontual.ts` | Limiar e régua de cobertura do dado pontual (função pura) | **Criar** |
| `shared/churnPontual.test.ts` | Testes da régua | **Criar** |
| `server/routes.ts` | Endpoint `churn-historico-mensal`: join lateral, soma de `valorp`, flag de cobertura | Modificar |
| `client/src/components/churn/ChurnHistoricoMensal.tsx` | Tipo, `chartData`, barra nova, tooltip, subtítulo, legenda | Modificar |

**Ordem de dependência:** Task 1 → Task 2 (a Task 2 consome `pontual` e `pontualDisponivel` do payload).

**Nota sobre cobertura de testes:** o `chartData` é um `useMemo` dentro do componente, não uma função exportada. Testá-lo exigiria extrair a montagem inteira (motivos, meta, mês corrente), o que é refactor além do escopo desta feature. Esta plan testa a régua de cobertura — que é a lógica nova e a que tem uma decisão de negócio embutida — e deixa a montagem do `chartData` para a validação manual da Task 3. Isso é uma limitação consciente, não um esquecimento.

---

### Task 1: Backend — somar o pontual e decidir a cobertura

**Files:**
- Create: `shared/churnPontual.ts`
- Create: `shared/churnPontual.test.ts`
- Modify: `server/routes.ts:5379-5392` (query), `:5395-5408` (pivot), `:5462` (`res.json`)

**Interfaces:**
- Consumes: nada
- Produces:
  - `LIMIAR_COBERTURA_PONTUAL: number` (0.10)
  - `pontualTemCobertura(linhasComPontual: number, totalLinhas: number): boolean`
  - No payload de `/api/analytics/churn-historico-mensal`: `series[].pontual: number` e `pontualDisponivel: boolean`

- [ ] **Step 1: Escrever o teste que falha**

Criar `shared/churnPontual.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pontualTemCobertura, LIMIAR_COBERTURA_PONTUAL } from "./churnPontual";

describe("pontualTemCobertura", () => {
  it("aceita a cobertura real de 2026 (23,5%)", () => {
    expect(pontualTemCobertura(120, 510)).toBe(true);
  });

  it("rejeita a cobertura real de 2025 (3,7%)", () => {
    expect(pontualTemCobertura(35, 945)).toBe(false);
  });

  it("rejeita 2024, que não tem nenhuma linha com pontual", () => {
    expect(pontualTemCobertura(0, 428)).toBe(false);
  });

  it("aceita exatamente no limiar", () => {
    expect(pontualTemCobertura(10, 100)).toBe(true);
  });

  it("rejeita logo abaixo do limiar", () => {
    expect(pontualTemCobertura(9, 100)).toBe(false);
  });

  it("rejeita ano sem nenhuma linha, sem dividir por zero", () => {
    expect(pontualTemCobertura(0, 0)).toBe(false);
    expect(pontualTemCobertura(5, 0)).toBe(false);
  });

  it("expõe o limiar como 10%", () => {
    expect(LIMIAR_COBERTURA_PONTUAL).toBe(0.1);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run shared/churnPontual.test.ts`
Expected: FAIL — `Failed to resolve import "./churnPontual"`.

- [ ] **Step 3: Implementar**

Criar `shared/churnPontual.ts`:

```typescript
/**
 * Fração mínima de linhas de churn com valor pontual para que a série
 * pontual do histórico seja exibida.
 *
 * Medido em prod (2026-07-20): 2026 tem 23,5% de cobertura, 2025 tem 3,7%
 * e 2024 tem 0%. O limiar de 10% separa 2026 dos demais com folga dos dois
 * lados, então não é sensível a pequenas variações do dado.
 *
 * Régua por cobertura, e não por "existe algum valorp > 0", porque 2025 tem
 * R$ 152.743 espalhados em 3,7% das linhas: uma série que aparenta medir
 * churn pontual mas mede ~4% dele é pior do que série nenhuma.
 */
export const LIMIAR_COBERTURA_PONTUAL = 0.1;

/** Decide se o dado pontual de um ano tem cobertura suficiente para ser exibido. */
export function pontualTemCobertura(linhasComPontual: number, totalLinhas: number): boolean {
  if (!totalLinhas || totalLinhas <= 0) return false;
  return linhasComPontual / totalLinhas >= LIMIAR_COBERTURA_PONTUAL;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run shared/churnPontual.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 5: Adicionar o join lateral e a soma do pontual à query**

Em `server/routes.ts`, no endpoint `/api/analytics/churn-historico-mensal`, substituir a query (linhas 5379-5392) por:

```typescript
      const result = await db.execute(sql`
        SELECT
          TO_CHAR(c.data_solicitacao_encerramento, 'YYYY-MM') AS mes,
          COALESCE(NULLIF(TRIM(c.motivo_cancelamento), ''), 'Não especificado') AS motivo,
          SUM(COALESCE(c.valor_r, 0)) AS mrr,
          SUM(COALESCE(ct.valorp, 0)) AS pontual,
          COUNT(*) AS logos,
          COUNT(*) FILTER (WHERE COALESCE(ct.valorp, 0) > 0) AS logos_pontual
        FROM cortex_core.vw_cup_churn_ajustado c
        LEFT JOIN LATERAL (
          SELECT MAX(x.valorp::numeric) AS valorp
          FROM "Clickup".cup_contratos x
          WHERE x.id_subtask = c.task_id
        ) ct ON TRUE
        WHERE c.data_solicitacao_encerramento >= ${inicio}::date
          AND c.data_solicitacao_encerramento <= ${fim}::date
          -- Churn BRUTO total (2026-06-30): inclui "nunca virou base" p/ bater com o card
          -- da tela (ver /api/analytics/churn-detalhamento). Abono via toggle da tela.
          ${abonoFilter}
        GROUP BY 1, 2
        ORDER BY 1
      `);
```

Atenção: as colunas do `WHERE` e do `SELECT` passam a precisar do prefixo `c.` porque a tabela ganhou alias. O `LATERAL` com `MAX` garante uma linha por contrato mesmo que `cup_contratos` tenha mais de uma para o mesmo `id_subtask` — `id_subtask` é único hoje (2.929 linhas, 2.929 distintos), mas a guarda custa zero.

- [ ] **Step 6: Somar o pontual no pivot e contar a cobertura**

Substituir o bloco do pivot (linhas 5395-5408) por:

```typescript
      // Pivot: mês -> { total, pontual, porMotivo }
      const mesesMap: Record<string, { mes: string; total: number; pontual: number; logos: number; porMotivo: Record<string, number> }> = {};
      const motivoTotals: Record<string, number> = {};
      let totalLinhas = 0;
      let linhasComPontual = 0;
      for (const r of result.rows as any[]) {
        const mes = r.mes as string;
        const motivo = r.motivo as string;
        const mrr = Number(r.mrr) || 0;
        const pontual = Number(r.pontual) || 0;
        const logos = Number(r.logos) || 0;
        if (!mesesMap[mes]) mesesMap[mes] = { mes, total: 0, pontual: 0, logos: 0, porMotivo: {} };
        mesesMap[mes].porMotivo[motivo] = (mesesMap[mes].porMotivo[motivo] || 0) + mrr;
        mesesMap[mes].total += mrr;
        // O pontual NÃO é quebrado por motivo: a barra é sólida. 3 motivos concentram
        // 66,8% do valorp e 9 dos 21 motivos têm valorp zero — empilhar produziria uma
        // pilha de ~4 blocos com metade da legenda sem representação.
        mesesMap[mes].pontual += pontual;
        mesesMap[mes].logos += logos;
        motivoTotals[motivo] = (motivoTotals[motivo] || 0) + mrr;
        totalLinhas += logos;
        linhasComPontual += Number(r.logos_pontual) || 0;
      }
```

- [ ] **Step 7: Expor o flag de cobertura na resposta**

No topo do arquivo, logo abaixo do import existente `import { BP2026_TAB_IDS } from "../shared/bp2026-tabs";` (linha 10), adicionar:

```typescript
import { pontualTemCobertura } from "../shared/churnPontual";
```

Caminho relativo, não `@shared/...`. O arquivo usa os dois estilos, mas o precedente mais próximo deste caso — `bp2026-tabs`, também um módulo de lógica pura compartilhada — usa relativo, e o relativo não depende de resolução de alias no bundle do esbuild (`npm run build` roda `esbuild --packages=external`).

Substituir a linha 5462 por:

```typescript
      const pontualDisponivel = pontualTemCobertura(linhasComPontual, totalLinhas);
      res.json({ series, motivos, ano, filterAbono, mrrBasePorMes, pontualDisponivel });
```

- [ ] **Step 8: Verificar**

Run: `npx vitest run shared/churnPontual.test.ts && npm run check`
Expected: 7 testes passando; tsc com os mesmos 124 erros pré-existentes, nenhum novo em `server/routes.ts` ou `shared/churnPontual.ts`.

- [ ] **Step 9: Commit**

```bash
git add shared/churnPontual.ts shared/churnPontual.test.ts server/routes.ts
git commit -m "feat(churn): somar valor pontual no histórico mensal

Endpoint passa a devolver series[].pontual e pontualDisponivel. O flag usa
régua de cobertura (>= 10% das linhas do ano com valorp), não existência:
2025 tem R\$ 152.743 em apenas 3,7% das linhas, e uma série que aparenta
medir churn pontual mas mede 4% dele é pior que série nenhuma.

O pontual não é quebrado por motivo — a barra será sólida.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Frontend — barra de pontual ao lado da de MRR

**Files:**
- Modify: `client/src/components/churn/ChurnHistoricoMensal.tsx` — `MesSerie` e `HistoricoResponse` (linhas 14-27), cores (`:98-101`), `chartData` (`:71-96`), tooltip (`:103+`), subtítulo (`:169-175`), `<Bar>` nova e legenda da meta (`:256-267`)

**Interfaces:**
- Consumes: `series[].pontual: number` e `pontualDisponivel: boolean` (Task 1)
- Produces: nada

- [ ] **Step 1: Estender os tipos do payload**

Em `client/src/components/churn/ChurnHistoricoMensal.tsx`, substituir as interfaces (linhas 14-27) por:

```typescript
interface MesSerie {
  mes: string; // "YYYY-MM"
  total: number;
  pontual: number;
  logos: number;
  porMotivo: Record<string, number>;
}

interface HistoricoResponse {
  series: MesSerie[];
  motivos: string[]; // ordenados por volume desc
  ano: number;
  filterAbono: FilterAbono;
  mrrBasePorMes: Record<string, number>; // "YYYY-MM" -> MRR ativo real do mês
  /** Falso quando a cobertura do dado pontual no ano é baixa demais (< 10% das linhas). */
  pontualDisponivel?: boolean;
}
```

`pontualDisponivel` é opcional de propósito: se o backend não mandar (deploy fora de ordem), a tela degrada para "sem barra de pontual" em vez de quebrar.

- [ ] **Step 2: Levar o pontual para o `chartData`**

Dentro do `useMemo` do `chartData`, no objeto `row` (após a linha `total: serie ? Math.round(serie.total) : 0,`), adicionar:

```typescript
        pontual: serie ? Math.round(serie.pontual ?? 0) : 0,
```

O `?? 0` cobre respostas de um backend antigo que ainda não manda o campo.

- [ ] **Step 3: Declarar a cor do pontual**

Junto das demais constantes de cor (após `dentroMetaColor`, linha ~101), adicionar:

```typescript
  // Âmbar: mesma família da coluna "Pontual" do drawer (DrawerContratosTable),
  // para associar visualmente as duas telas.
  const pontualColor = isDark ? "#fbbf24" : "#d97706";
```

- [ ] **Step 4: Adicionar a linha de Pontual ao tooltip**

No `CustomTooltip`, logo após a declaração de `pctTotal`, adicionar:

```typescript
    const pontual = Number(row?.pontual ?? 0);
```

E, imediatamente **antes** do bloco `<div className="pt-1 border-t border-border/50 space-y-0.5">` (o bloco que lista os motivos), inserir:

```tsx
        {pontual > 0 && (
          <p className="text-muted-foreground">
            Pontual:{" "}
            <span className="font-semibold" style={{ color: pontualColor }}>
              {formatCurrencyNoDecimals(pontual)}
            </span>
          </p>
        )}
```

Sem percentual — decisão da spec. A linha é omitida quando o mês não tem pontual.

- [ ] **Step 5: Renderizar a barra**

Logo **após** o `{motivos.map((motivo, i) => ( ... ))}` que gera as barras empilhadas, e **antes** do `<Line ... />`, inserir:

```tsx
            {data?.pontualDisponivel && (
              <Bar
                dataKey="pontual"
                name="Pontual"
                fill={pontualColor}
                radius={[3, 3, 0, 0]}
              />
            )}
```

Sem `stackId`: as barras de motivo usam `stackId="churn"`, e o Recharts posiciona uma barra sem esse `stackId` lado a lado com o grupo empilhado. Sem `LabelList` — o label do topo permanece só na barra de MRR; dois labels por mês poluiriam.

- [ ] **Step 6: Explicitar que a meta é do MRR**

Substituir o `name` da `<Line>` (linha ~261):

```tsx
              name={`Meta ${formatPct(metaPct)} (MRR)`}
```

Com duas barras por mês, o Recharts desenha a linha no centro do grupo — visualmente entre as duas. A meta vale só para a de MRR, e a legenda passa a dizer isso. Não reposicionar a linha: mexer em posicionamento por estética costuma quebrar em telas estreitas.

- [ ] **Step 7: Ajustar o subtítulo**

Substituir o parágrafo do subtítulo (linhas ~169-175) por:

```tsx
          <p className="text-xs text-muted-foreground">
            MRR perdido por mês e motivo · % sobre o MRR ativo do mês · linha tracejada = meta {formatPct(metaPct)}
            {filterAbono === "nao_abonados" && " · sem abonados"}
            {filterAbono === "abonados" && " · só abonados"}
            {" · * mês em curso"}
            {data && !data.pontualDisponivel && " · sem dado de churn pontual neste ano"}
          </p>
```

O texto é genérico de propósito. "Disponível a partir de 2026" seria hardcode disfarçado: mentiria num ano futuro sem pontual e exigiria manutenção se 2025 for corrigido na origem.

- [ ] **Step 8: Verificar**

Run: `npm run check && npx vitest run client/src/components/churn/ shared/churnPontual.test.ts`
Expected: tsc com os mesmos 124 erros pré-existentes, nenhum novo em `ChurnHistoricoMensal.tsx`; 33 testes de churn + 7 de `churnPontual` passando.

- [ ] **Step 9: Commit**

```bash
git add client/src/components/churn/ChurnHistoricoMensal.tsx
git commit -m "feat(churn): barra de churn pontual no histórico mensal

Pontual entra como barra sólida âmbar ao lado da barra de MRR empilhada
por motivo, sem percentual e sem meta — não há base de estoque pontual
auditável com a mesma régua do MRR base.

A série é ocultada em anos de cobertura baixa, com aviso no subtítulo, e
a legenda da meta passa a dizer (MRR): com duas barras por mês o Recharts
desenha a linha no centro do grupo, e a meta vale só para o MRR.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Validação e fechamento

**Files:** nenhum (validação)

- [ ] **Step 1: Rodar a suíte e o typecheck**

Run: `npm run check && npm test`
Expected: tsc com 124 erros pré-existentes. A suíte tem **13 falhas pré-existentes** em `server/routes/capacityTimes.helpers.test.ts` (12), `server/seed/capacityMetas.test.ts` (1) e `server/routes/sdr-assistant.test.ts` (não carrega — falta API key do Anthropic SDK). Essas falhas existem na `main` e não são desta branch. Qualquer falha **além** dessas é regressão.

- [ ] **Step 2: Reconciliar contra prod**

Rodar contra **prod** (`dados_turbo`, 34.95.249.110), não local — o local está 13 dias atrasado. A série de 2026 deve bater com:

| Mês | MRR | Pontual |
|---|---:|---:|
| jan | 162.431,00 | 12.597 |
| fev | 101.655,50 | 18.497 |
| mar | 151.063,00 | 89.197 |
| abr | 152.262,00 | 95.267 |
| mai | 184.823,00 | 157.302 |
| jun | 186.662,00 | 132.452 |
| jul (parcial) | 66.930,00 | 171.272 |

Total do ano: R$ 1.005.826,50 de MRR e R$ 676.584 de pontual.

- [ ] **Step 3: Validar o comportamento por ano**

Com o build de produção rodando (`npm run build` e depois `NODE_ENV=production PORT=3005 node dist/index.js` — **não** usar `npm run dev`, e **não** tocar na porta 3000):

- `?ano=2026`: barra de pontual visível, sem o aviso no subtítulo
- `?ano=2025`: barra ausente, subtítulo com "· sem dado de churn pontual neste ano" (cobertura 3,7%)
- `?ano=2024`: idem (cobertura 0,0%)

- [ ] **Step 4: Validar o visual**

Em dark mode E light mode:
- As duas barras aparecem lado a lado, sem sobreposição, e a de MRR mantém o empilhamento por motivo
- A linha tracejada de meta passa no centro do grupo e a legenda diz "Meta 8,0% (MRR)"
- O tooltip mostra a linha "Pontual" em âmbar, e a omite em meses sem pontual (jan e fev têm valores baixos mas não-zero; nenhum mês de 2026 tem pontual zero, então para ver a omissão use um ano com dado esparso)
- Alternar o toggle de abono: a barra de pontual cai ~34% e a de MRR ~13%. É comportamento esperado, não bug

- [ ] **Step 5: Fechar**

Atualizar `docs/CHANGELOG.md` seguindo o padrão das entradas existentes, sincronizar o vault Obsidian conforme `agents/obsidian-sync-SKILL.md` e atualizar o chamado no Cortex DB com `status='review'` (não `concluido`).

---

## Dívidas registradas (fora do escopo)

| Dívida | Por que fica fora |
|---|---|
| `valorp` vazio em 2023/2024 e 3,7% em 2025 na origem | Trabalho de dados; é o que impede a série histórica |
| `logos` conta linhas, não clientes — no pontual infla (8 clientes com 4 subtasks = R$ 245 mil dos R$ 676 mil de 2026) | Comportamento já existente para MRR; mudar a semântica é outra discussão |
| "Não especificado" é 10,9% do pontual contra 3,8% do MRR | Preenchimento de motivo pior em contratos pontuais, corrigível na origem |
| `valorp` vem da tabela viva `cup_contratos` | É o valor de hoje, não o do momento do churn — aproximação numa tela retrospectiva |
| `chartData` não é testável sem extrair a montagem inteira do `useMemo` | Refactor além do escopo; a régua de cobertura, que é a lógica nova, está testada |
