# Redesign Minimalista da Tela de Churn — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reduzir a densidade da tela `/dashboard/churn-detalhamento` para "Resumo + seletor": KPIs grandes + ritmo diário + um bloco "Churn por [dimensão]"; todo o detalhamento vai para o drawer.

**Architecture:** Evolutiva, reaproveitando os `useMemo` já existentes nos componentes `Secao*`. Orquestrador `client/src/pages/ChurnDetalhamento.tsx` renderiza: `ChurnControls` → `ChurnKpisHero` (5 KPIs) → `RitmoDiario` → `ChurnPorDimensao`, + `ChurnDrillDrawer` enriquecido. Voz IA e Timing saem da tela e viram conteúdo do drawer (sob demanda).

**Tech Stack:** React + TS, Vite, Tailwind (dark/light via `dark:`), Recharts, React Query, shadcn/ui (Sheet), Vitest.

## Global Constraints

- **Cores por severidade:** escala única emerald→amber→red (pior = mais vermelho), via um helper compartilhado. Aplicada a taxa, ritmo diário e ranking. Nunca cor hardcoded fora do helper para essas superfícies.
- **Tipografia unificada:** números KPI `text-3xl font-bold tabular-nums`; títulos de bloco `text-sm font-semibold`; labels `text-xs text-muted-foreground`. Igual em todos os componentes da tela.
- **Detalhe só no drawer:** nenhuma tabela/sub-análise/Voz-IA/Timing na tela principal — tudo abre via `onDrill`.
- **Voz IA sob demanda:** a query `POST /api/analytics/churn-mensagens-ai` só dispara quando o drawer está aberto, nunca no load da tela.
- **Dark/light obrigatório** em todo componente. Acentos PT corretos.
- **Backend intacto** — só frontend, reusa endpoints existentes.
- Validação por task: `npm run check` (0 NOVOS erros de tsc; baseline pré-existente ~126 em `server/storage.ts` etc.) + `npm run test` (churn test passa). `npm run lint` está QUEBRADO no baseline — não é gate.
- Commits Conventional + trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. NÃO dar `git push` (push é decisão do usuário no fim).
- Rota e nome do componente exportado `ChurnDetalhamento` NÃO mudam.

## File Structure

```
client/src/components/churn/
  severity.ts            (novo) helper de cor por severidade
  ChurnKpisHero.tsx      (modificado) 5 KPIs grandes (incl. NRR), taxa adaptável, severidade, tipografia
  RitmoDiario.tsx        (novo) gráfico churn por dia + toggle métrica + recorte squad
  ChurnPorDimensao.tsx   (novo) seletor de dimensão + ranking % e R$
  ChurnDrillDrawer.tsx   (modificado) drawer rico (contratos + sub-quebra + Voz IA + Timing)
  drawer/DrawerVozCliente.tsx (novo) Voz IA do recorte (sob demanda)
  drawer/DrawerTiming.tsx     (novo) lifetime/cohort/curva do recorte
  drawer/DrawerSubMotivo.tsx  (novo) submotivo + evitabilidade do recorte
client/src/pages/ChurnDetalhamento.tsx  (modificado) orquestrador enxuto
```
Os `Secao*` (`SecaoMotivos/VozCliente/Segmentacao/Timing`) deixam de ser renderizados na tela; sua lógica de cálculo é reaproveitada nos componentes acima e os arquivos órfãos são removidos na Task 7.

---

### Task 1: Helper de severidade + tokens de tipografia

**Files:** Create `client/src/components/churn/severity.ts`; Test `client/src/components/churn/__tests__/severity.test.ts`

**Interfaces — Produces:**
```ts
// Mapeia "quão ruim" (0 = ok, 1 = pior) para classes Tailwind de cor (dark/light safe).
export type Severity = "ok" | "warn" | "bad" | "critical";
export function severityLevel(value: number): Severity; // value 0..1
export function severityTextClass(value: number): string;  // ex "text-emerald-600 dark:text-emerald-400"
export function severityBarClass(value: number): string;   // ex "bg-red-500"
export function severityHex(value: number): string;        // p/ Recharts fill, ex "#ef4444"
```
Thresholds: <0.25 ok (emerald), <0.5 warn (amber), <0.75 bad (orange), >=0.75 critical (red).

- [ ] **Step 1: Teste** `severity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { severityLevel, severityHex } from "../severity";
describe("severity", () => {
  it("classifica por faixa", () => {
    expect(severityLevel(0.1)).toBe("ok");
    expect(severityLevel(0.4)).toBe("warn");
    expect(severityLevel(0.6)).toBe("bad");
    expect(severityLevel(0.9)).toBe("critical");
  });
  it("hex muda com severidade", () => {
    expect(severityHex(0.1)).not.toBe(severityHex(0.9));
  });
});
```
- [ ] **Step 2:** `npx vitest run client/src/components/churn/__tests__/severity.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `severity.ts` com os 4 níveis e as 4 funções. Clamp `value` em [0,1].
- [ ] **Step 4:** Rodar o teste → PASS.
- [ ] **Step 5:** `npm run check` → 0 novos erros.
- [ ] **Step 6:** Commit `feat(churn): helper de cor por severidade`.

---

### Task 2: KPIs grandes (ChurnKpisHero)

**Files:** Modify `client/src/components/churn/ChurnKpisHero.tsx`; Modify `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces — Consumes:** `severity.ts`. **Produces:** `ChurnKpisHero` agora recebe `nrrPct?: number` (de `nrrData.nrr_pct`, já fetchado no orquestrador) e renderiza 5 KPIs: Taxa de churn % · MRR perdido · Logos perdidos · % evitável · NRR.

- [ ] **Step 1:** No `ChurnKpisHero`, aplicar tipografia unificada (números `text-3xl font-bold tabular-nums`, labels `text-xs text-muted-foreground`) e cor por severidade na Taxa de churn (normalizar: `min(taxa / metaOuTeto, 1)`; usar `severityTextClass`). Remover o gauge denso se não couber no estilo "número na cara" (manter um indicador compacto). **% evitável**: severidade inversa (mais evitável = mais vermelho, pois é mais acionável).
- [ ] **Step 2:** Adicionar o 5º KPI **NRR** lendo a nova prop `nrrPct`. No orquestrador, passar `nrrPct={nrrData?.nrr_pct}`.
- [ ] **Step 3: Taxa adaptável ao seletor de meses (#10):** garantir que a Taxa de churn usa o recorte de período atual (denominador = base do período). Localizar como `taxaChurn` é calculada hoje (`filteredTaxaChurn` no orquestrador); confirmar que reflete `dataInicio/dataFim`. Se estiver fixa no mês corrente, ajustar para o período selecionado. Documentar a fórmula no report.
- [ ] **Step 4:** `npm run check` 0 novos + `npx vitest run .../ChurnKpisHero.test.ts` (pctEvitavel) ainda passa.
- [ ] **Step 5:** Commit `feat(churn): 5 KPIs grandes (incl. NRR), taxa adaptável e cor por severidade`.

---

### Task 3: Ritmo diário (RitmoDiario)

**Files:** Create `client/src/components/churn/RitmoDiario.tsx`; Modify `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces — Produces:**
```tsx
export function RitmoDiario({ contratos, onDrill }: {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}): JSX.Element
```

- [ ] **Step 1:** Calcular série **por dia** do período: agrupar `contratos` (churn, `!is_abonado`) por `data_encerramento` (e `data_pausa` p/ pausados) em buckets diários. Métricas por dia: `mrr` (Σ valorr), `count` (nº logos), e `taxa` (se base diária disponível; senão omitir taxa do toggle). Internalizar `useState` do toggle de métrica (`"mrr" | "count"`) e do recorte (`"total" | porSquad`).
- [ ] **Step 2:** Render: BarChart (Recharts) por dia, barras coloridas por severidade (dia com mais churn = mais vermelho, normalizando pelo máximo do período via `severityHex`). Toggle de métrica + seletor de equipe (Total / lista de squads de `contratos`). Tipografia unificada.
- [ ] **Step 3:** Drill: clique num dia → `onDrill("Dia DD/MM", contratos do dia [+ squad se filtrado])`.
- [ ] **Step 4:** Plugar `<RitmoDiario contratos={filteredContratos} onDrill={onDrill} />` no orquestrador, logo após `<ChurnKpisHero/>`.
- [ ] **Step 5:** `npm run check` 0 novos. Commit `feat(churn): bloco Ritmo Diário (série por dia + toggle métrica + recorte squad)`.

---

### Task 4: Churn por dimensão (ChurnPorDimensao)

**Files:** Create `client/src/components/churn/ChurnPorDimensao.tsx`; Modify `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces — Produces:**
```tsx
export type Dimensao = "motivo" | "produto" | "cluster" | "pessoa" | "squad";
export function ChurnPorDimensao({ contratos, onDrill }: {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}): JSX.Element
```

- [ ] **Step 1:** Internalizar `useState<Dimensao>("motivo")`. Para cada dimensão, agrupar `contratos` (churn, `!is_abonado`) e computar por item: `count`, `mrr`, `pct` (% do total de churn). Campos por dimensão: motivo=`motivo_cancelamento`, produto=`produto`/`servico`, cluster=`cluster`, pessoa=`responsavel`, squad=`squad` (excluir squads irrelevantes `['turbo interno','squad x','interno','x']`). Reaproveitar a lógica das `Secao*` existentes (ler do git/dos componentes atuais).
- [ ] **Step 2:** Render: seletor de dimensão (botões/dropdown compacto) + ranking horizontal (barras) com **% e R$ por item**, barra colorida por severidade (item maior = mais vermelho, normalizando pelo maior do ranking). Tipografia unificada. Ordenar desc por mrr.
- [ ] **Step 3:** Drill: clique num item → `onDrill("<Dimensão>: <item>", contratos do recorte)` com o predicado da dimensão ativa.
- [ ] **Step 4:** Plugar `<ChurnPorDimensao contratos={filteredContratos} onDrill={onDrill} />` após `<RitmoDiario/>`.
- [ ] **Step 5:** `npm run check` 0 novos. Commit `feat(churn): bloco Churn por Dimensão (seletor + ranking % e R$)`.

---

### Task 5: Drawer rico (ChurnDrillDrawer + sub-componentes)

**Files:** Modify `client/src/components/churn/ChurnDrillDrawer.tsx`; Create `client/src/components/churn/drawer/DrawerSubMotivo.tsx`, `DrawerVozCliente.tsx`, `DrawerTiming.tsx`

**Interfaces — Produces:** o drawer recebe `contratos` do recorte e, abaixo da lista de contratos, renderiza abas/seções:
```tsx
export function DrawerSubMotivo({ contratos }: { contratos: ChurnContract[] }): JSX.Element // motivo→submotivo + evitabilidade
export function DrawerVozCliente({ contratos, enabled }: { contratos: ChurnContract[]; enabled: boolean }): JSX.Element // IA sob demanda
export function DrawerTiming({ contratos }: { contratos: ChurnContract[] }): JSX.Element // lifetime/cohort/curva
```

- [ ] **Step 1:** `DrawerSubMotivo`: reaproveitar `motivoSubmotivoTree` + evitabilidade de `SecaoMotivos` (recalcular de `props.contratos`).
- [ ] **Step 2:** `DrawerVozCliente`: reaproveitar a lógica de IA de `SecaoVozCliente` (sentimento/temas/mural + `useQuery` de `churn-mensagens-ai`), mas com `enabled` ligado ao drawer aberto — a query só dispara quando `enabled === true`. Loading state.
- [ ] **Step 3:** `DrawerTiming`: reaproveitar lifetime/cohort/curva de `SecaoTiming` (recalcular de `props.contratos`).
- [ ] **Step 4:** No `ChurnDrillDrawer`, abaixo da tabela de contratos existente, adicionar abas (shadcn ou botões): "Contratos" (atual) · "Submotivo" · "Voz do Cliente" · "Timing". Renderizar os 3 sub-componentes; passar `enabled={open && abaAtiva==="voz"}` ao `DrawerVozCliente`. Manter o abonar inline.
- [ ] **Step 5:** `npm run check` 0 novos. Commit `feat(churn): drawer rico (submotivo, voz IA sob demanda, timing)`.

---

### Task 6: Orquestrador enxuto + remoção do Painel Executivo

**Files:** Modify `client/src/pages/ChurnDetalhamento.tsx`

- [ ] **Step 1:** Remover da tela principal: `<SecaoMotivos/>`, `<SecaoVozCliente/>`, `<SecaoSegmentacao/>`, `<SecaoTiming/>` (substituídos por KpisHero+RitmoDiario+ChurnPorDimensao+drawer). Remover o card "Painel Executivo Detalhado" (NRR já virou KPI; cross-sell sai; squad ranking virou dimensão). Remover a tabela `topClientesPerdidos` e o "Observatório de Churn Diário" se redundantes com o Ritmo Diário (avaliar; se Observatório tiver insight único — ex. excesso acumulado — manter de forma compacta).
- [ ] **Step 2:** Ordem final do JSX: `ChurnControls` → `ChurnKpisHero` → `RitmoDiario` → `ChurnPorDimensao` → `ChurnDrillDrawer`. Loading/empty states preservados.
- [ ] **Step 3:** `npm run check` 0 novos + `npm run test` (churn passa).
- [ ] **Step 4:** Commit `refactor(churn): orquestrador enxuto, remover Painel Executivo e seções densas`.

---

### Task 7: Limpeza de órfãos + coerência final

**Files:** Modify/Delete em `client/src/components/churn/`

- [ ] **Step 1:** Após Tasks 1-6, identificar `Secao*` e helpers não mais referenciados (`grep` cada um). Remover `SecaoMotivos/VozCliente/Segmentacao/Timing.tsx` se órfãos; mover qualquer cálculo ainda necessário para os componentes ativos antes de deletar. Remover imports órfãos no orquestrador.
- [ ] **Step 2:** Varredura de coerência: tipografia unificada aplicada em KpisHero/RitmoDiario/ChurnPorDimensao/drawer; cor por severidade consistente; dark/light em tudo; acentos PT corretos.
- [ ] **Step 3:** `npm run check` 0 novos + `npm run test`. Commit `refactor(churn): remover seções órfãs e padronizar tipografia/cores`.

---

## Self-Review

- Densidade↓ (Resumo+seletor) → Tasks 2-6. Cores severidade → Task 1 + aplicação 2-4. Tipografia → Task 2 + Task 7. NRR→KPI → Task 2. Timing→drawer → Task 5. Voz IA sob demanda → Task 5 Step 2. Ritmo diário → Task 3. Churn por Motivo/Produto/Cluster/Pessoa/Squad + % → Task 4. Taxa adaptável → Task 2 Step 3. Detalhe só no clique → drawer (Task 5). Painel Executivo (NRR→KPI, resto sai) → Task 2 + Task 6.
- Sem placeholders; cada task tem validação + commit. Tipos: `Dimensao`, `Severity`, `onDrill(titulo, contratos)` consistentes.
- TDD só onde há função pura nova (`severity.ts`, Task 1); o resto valida via `npm run check` + browser (regra do projeto; lint quebrado no baseline).
