# Reconstrução da Tela de Detalhamento de Churn — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir `/dashboard/churn-detalhamento` como uma página única de diagnóstico de causa-raiz (scroll narrativo, 4 ângulos), modular, com drill-down via drawer — reaproveitando os cálculos existentes.

**Architecture:** Reconstrução modular. O orquestrador (`ChurnDetalhamento.tsx`) cuida de fetch, período, filtros e estado do drawer, e produz `filteredContratos: ChurnContract[]`. Cada seção recebe os contratos já filtrados e faz seus próprios `useMemo`, ficando autocontida. Drill-down é um `Sheet` (drawer lateral) único, alimentado por um callback `onDrill(titulo, contratos)`.

**Tech Stack:** React + TypeScript, Vite, Tailwind (dark/light via `dark:`), Recharts, React Query, shadcn/ui (`sheet.tsx`), Vitest + Testing Library.

## Global Constraints

- Dark/light mode obrigatório em TODO componente novo — usar variantes `dark:` do Tailwind, nunca cor hardcoded (regra do CLAUDE.md).
- Não alterar backend nem queries SQL — reorganização é 100% frontend; reusar os endpoints existentes.
- Não alterar a semântica dos cálculos ao migrar `useMemo` — mover sem reescrever a lógica.
- Validação de cada task: `npm run check` (tsc, 0 erros) + verificação no browser em **dark E light** (regra do projeto). Onde houver função pura nova, adicionar teste Vitest.
- Reiniciar o dev server após mudanças (tsx sem watch): `lsof -ti:3000 | xargs kill -9; npm run dev`.
- Commits em Conventional Commits; co-author `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Rota e nome do componente exportado (`ChurnDetalhamento`) e o import em `client/src/App.tsx:73` NÃO mudam.

## File Structure

```
client/src/pages/ChurnDetalhamento.tsx          (modificado) orquestrador enxuto: fetch, período, filtros, filteredContratos, estado do drawer
client/src/pages/RelatorioSemanalChurn.tsx       (REMOVIDO) órfão após Task 1
client/src/components/churn/
  types.ts            (novo) re-export dos tipos compartilhados (ChurnContract, etc.)
  ui/
    TechChartCard.tsx (novo) card de gráfico (movido do arquivo atual)
    SectionBlock.tsx  (novo) bloco de seção (movido)
    ChurnGauge.tsx    (novo) gauge da taxa (movido)
    TechKpiCard.tsx   (novo) card de KPI (movido)
    StatPill.tsx      (novo) pílula de stat (movida)
    CustomTooltip.tsx (novo) tooltip de gráfico (movido)
  ChurnControls.tsx       (novo) período + filtro de abono + filtros colapsáveis
  ChurnKpisHero.tsx       (novo) KPIs do topo + gauge
  ChurnDrillDrawer.tsx    (novo) Sheet lateral: lista contratos do recorte + ação de abonar
  SecaoMotivos.tsx        (novo) motivo→submotivo, evitabilidade, tipo de erro
  SecaoVozCliente.tsx     (novo) sentimento, temas, mural (IA)
  SecaoSegmentacao.tsx    (novo) squad, produto/serviço, ticket, responsável
  SecaoTiming.tsx         (novo) lifetime, evolução mensal
```

**Mapa dos `useMemo` atuais → destino** (linhas de `ChurnDetalhamento.tsx` na versão atual):
- Orquestrador (ficam): `filteredContratos` (599), `filteredMetricas` (708), `filteredChurnPorSquad` (751), `filteredTaxaChurn` (791), `churnPlanejado` (799), `churnExcessFromPreviousMonths` (556), `gaugeStatusOverride` (929), `churnDailyInsights` (830).
- KpisHero: consome `filteredMetricas`, `filteredTaxaChurn`, `churnPlanejado`, `gaugeStatusOverride`.
- SecaoMotivos: `churnPorTipoErro` (1059), `dadosTipoErroAtual` (1159), `motivoSubmotivoTree` (1299), `crossAnalysisData` (1329), `retentionOpportunities` (1419).
- SecaoVozCliente: `textPatternAnalysis` (1272), `contextThemes` (1369), `contratosComMensagem` (1464), `aiPayload` (1470), `aiByContract` (1505), `sentimentDistribution` (1513), `themeDistribution` (1534), `muralMessages` (1554).
- SecaoSegmentacao: `distribuicaoPorSquad` (946), `distribuicaoPorProduto` (971), `distribuicaoPorResponsavel` (1024), `distribuicaoPorTicket` (1587).
- SecaoTiming: `distribuicaoPorLifetime` (995), `churnPorMes` (1194), `comparativoMensal` (1617), `cohortAnalysis` (1650), `lifetimeCurve` (1686), `mrrPerdidoPorMes` (1722).
- Drawer/tabela: `topClientesPerdidos` (1228), `clientesAgrupados` (1760).

---

### Task 1: Faxina — remover as 4 abas

**Objetivo:** Tela passa a renderizar apenas o conteúdo do antigo "Resumo", sem abas. Entrega funcional e visível. Nenhum componente novo ainda.

**Files:**
- Modify: `client/src/pages/ChurnDetalhamento.tsx`
- Delete: `client/src/pages/RelatorioSemanalChurn.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: tela funcional só com Resumo; `filteredContratos` e demais `useMemo` do Resumo intactos.

- [ ] **Step 1: Confirmar que `RelatorioSemanalChurn` não é importado em nenhum outro lugar**

Run: `grep -rn "RelatorioSemanalChurn" client/src/`
Expected: aparece SOMENTE em `ChurnDetalhamento.tsx` (import + uso) e na própria definição `RelatorioSemanalChurn.tsx`. Se aparecer em outro arquivo, PARAR e reportar.

- [ ] **Step 2: Remover o bloco de abas principais (`mainTab`) e renderizar direto a Análise**

Em `ChurnDetalhamento.tsx`, localizar o `<Tabs value={mainTab} ...>` (~linha 1937) e o bloco condicional `{mainTab === "relatorio" ? <RelatorioSemanalChurn/> : mainTab === "analise" ? (...) : (tabela contratos)}` (~1954). Remover o `<Tabs>...</Tabs>` das abas principais e substituir o condicional para renderizar apenas o conteúdo da análise (o ramo `mainTab === "analise"`). Remover por completo o ramo do `RelatorioSemanalChurn` e o ramo `else` da tabela de contratos (linhas ~4356–4726).

- [ ] **Step 3: Remover as sub-abas Distribuição e Inteligência**

Localizar o array de sub-abas (~linha 1962):
```tsx
{([
  { key: "resumo", label: "Resumo" },
  { key: "distribuicao", label: "Distribuição" },
  { key: "inteligencia", label: "Inteligência" },
] as const).map(...)}
```
Como sobra só "Resumo", remover o seletor de sub-abas inteiro (o `<div>` com os botões) e os blocos `{analysisSubTab === "distribuicao" && (...)}` (~2534–3061) e `{analysisSubTab === "inteligencia" && (...)}` (~3062–4120). Manter o bloco do `resumo` (~2005–2532), renderizando-o incondicionalmente.

- [ ] **Step 4: Remover estados e imports agora órfãos**

Remover os states que só serviam às abas removidas: `mainTab`/`setMainTab` (496), `analysisSubTab`/`setAnalysisSubTab` (499), `viewMode`/`setViewMode` (495), `crossAnalysisView` (497) — **somente se** não forem mais referenciados após os Steps 2–3 (conferir com grep antes de remover cada um). Remover o import `import RelatorioSemanalChurn from "./RelatorioSemanalChurn";` (linha 58). NÃO remover ainda os `useMemo` das abas excluídas — eles serão migrados ou removidos nas próximas tasks; deixá-los não quebra o build (apenas geram warning de não-uso, tolerável até a Task 10). Se o lint (`--max-warnings 0`) falhar por causa deles, prefixar com `// eslint-disable-next-line` temporário e anotar para limpeza na Task 10.

- [ ] **Step 5: Deletar o arquivo órfão**

Run: `git rm client/src/pages/RelatorioSemanalChurn.tsx`

- [ ] **Step 6: Validar typecheck**

Run: `npm run check`
Expected: 0 erros de TypeScript.

- [ ] **Step 7: Validar no browser**

Run: `lsof -ti:3000 | xargs kill -9; npm run dev` e abrir `http://localhost:3000/dashboard/churn-detalhamento`.
Expected: a tela carrega mostrando só o Resumo (gauge, KPIs, MRR por motivo, clientes perdidos), sem barra de abas. Conferir dark E light mode.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(churn): remover abas Contratos, Relatório Semanal, Distribuição e Inteligência

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Extrair tipos e UI compartilhada

**Objetivo:** Tirar os componentes de UI reutilizáveis e os tipos para `components/churn/`, sem mudar comportamento. Prepara terreno para as seções.

**Files:**
- Create: `client/src/components/churn/types.ts`
- Create: `client/src/components/churn/ui/TechChartCard.tsx`, `SectionBlock.tsx`, `ChurnGauge.tsx`, `TechKpiCard.tsx`, `StatPill.tsx`, `CustomTooltip.tsx`
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces:**
- Produces:
  - `types.ts`: `export interface ChurnContract { ... }` (mover verbatim de `ChurnDetalhamento.tsx:79-112`), `ChurnPorSquad`, `ChurnPorMotivo`, `ChurnBreakdownItem`, `ChurnDetalhamentoData`, `RetentionPoint` (mover de :114-178). Exportar `CHART_COLORS` (objeto de :180-185).
  - `ui/TechChartCard.tsx`: `export function TechChartCard(props: { title: string; subtitle?: string; icon?: any; children: React.ReactNode; className?: string }): JSX.Element` — mover de :382-421.
  - `ui/SectionBlock.tsx`: `export function SectionBlock(props: { title: string; icon?: any; children: React.ReactNode }): JSX.Element` — mover de :423-448.
  - `ui/ChurnGauge.tsx`: `export function ChurnGauge(props: { value: number; status?: string; ... }): JSX.Element` — mover de :337-380 (copiar a assinatura exata das props do componente atual).
  - `ui/TechKpiCard.tsx`: `export function TechKpiCard(props: { title: string; value: string; subtitle: string; icon: any; ... }): JSX.Element` — mover de :286-309.
  - `ui/StatPill.tsx`: mover de :311-334. `ui/CustomTooltip.tsx`: mover de :269-284.

- [ ] **Step 1: Criar `types.ts` movendo as interfaces**

Recortar as interfaces/`type`/`CHART_COLORS` de `ChurnDetalhamento.tsx` (linhas 79-185) para `client/src/components/churn/types.ts`, adicionando `export` a cada uma. Manter os nomes idênticos.

- [ ] **Step 2: Importar os tipos de volta no orquestrador**

Em `ChurnDetalhamento.tsx`, adicionar:
```tsx
import { type ChurnContract, type ChurnDetalhamentoData, type ChurnPorSquad, type ChurnPorMotivo, type ChurnBreakdownItem, type RetentionPoint, CHART_COLORS } from "@/components/churn/types";
```

- [ ] **Step 3: Mover cada componente de UI para `ui/`**

Para cada um (`TechChartCard`, `SectionBlock`, `ChurnGauge`, `TechKpiCard`, `StatPill`, `CustomTooltip`): recortar a definição do arquivo atual, colar no arquivo `ui/<Nome>.tsx` com `export`, e adicionar os imports que ele usa (Card/ícones/Recharts/`CHART_COLORS`). Importar de volta no orquestrador via `@/components/churn/ui/<Nome>`.

- [ ] **Step 4: Validar typecheck**

Run: `npm run check`
Expected: 0 erros.

- [ ] **Step 5: Validar no browser**

Resumo deve renderizar idêntico ao final da Task 1 (gauge, KPIs, cards). Conferir dark/light.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(churn): extrair tipos e UI compartilhada para components/churn

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Componente `ChurnControls`

**Objetivo:** Extrair os controles (período, filtro de abono, painel de filtros colapsável) para um componente próprio, controlado pelo orquestrador via props.

**Files:**
- Create: `client/src/components/churn/ChurnControls.tsx`
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces:**
- Consumes: tipos de `types.ts`.
- Produces:
```tsx
export interface ChurnControlsProps {
  dataInicio: string; dataFim: string;
  onChangePeriodo: (inicio: string, fim: string) => void;
  filterAbono: "todos" | "abonados" | "nao_abonados";
  onChangeAbono: (v: "todos" | "abonados" | "nao_abonados") => void;
  filtros: ChurnDetalhamentoData["filtros"] | undefined;
  filterSquads: string[]; setFilterSquads: (v: string[]) => void;
  filterProdutos: string[]; setFilterProdutos: (v: string[]) => void;
  filterResponsaveis: string[]; setFilterResponsaveis: (v: string[]) => void;
  filterServicos: string[]; setFilterServicos: (v: string[]) => void;
  filterPlanos: string[]; setFilterPlanos: (v: string[]) => void;
  filterClusters: string[]; setFilterClusters: (v: string[]) => void;
  filterEvitabilidades: string[]; setFilterEvitabilidades: (v: string[]) => void;
  filterPossibilidadesRetencao: string[]; setFilterPossibilidadesRetencao: (v: string[]) => void;
}
export function ChurnControls(props: ChurnControlsProps): JSX.Element
```

- [ ] **Step 1: Criar `ChurnControls.tsx`**

Mover para cá: o JSX do seletor de período, o seletor de abono (`Todos/Não abonados/Abonados`, ~1981-2003) e o `<Collapsible open={isFiltersOpen}>` com os 8 multi-selects (~4192+). Internalizar o state `isFiltersOpen` (useState local). Receber valores/setters dos filtros via props acima. Usar o componente de multi-select já usado hoje (mesma fonte: `data?.filtros?.squads` etc., agora via prop `filtros`).

- [ ] **Step 2: Plugar no orquestrador**

Em `ChurnDetalhamento.tsx`, substituir os trechos movidos por `<ChurnControls .../>`, passando os states existentes (`dataInicio`, `dataFim`, `filterAbono`, `filter*`) e setters. `onChangePeriodo` chama `setDataInicio`/`setDataFim`.

- [ ] **Step 3: Validar typecheck + browser**

Run: `npm run check` (0 erros). No browser: período, abono e filtros colapsáveis funcionam e alteram os números do Resumo. Dark/light ok.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(churn): extrair ChurnControls (período, abono, filtros)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Componente `ChurnKpisHero`

**Objetivo:** Extrair os KPIs do topo + gauge para um componente. Definir os 4 KPIs do design.

**Files:**
- Create: `client/src/components/churn/ChurnKpisHero.tsx`
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces:**
- Consumes: `ChurnContract`, `ChurnGauge`, `TechKpiCard`.
- Produces:
```tsx
export interface ChurnKpisHeroProps {
  contratos: ChurnContract[];                 // filteredContratos
  mrrPerdido: number;                          // de filteredMetricas
  taxaChurn: number;                           // de filteredTaxaChurn
  gaugeStatus: string;                         // de gaugeStatusOverride
  churnPlanejado?: number;                     // de churnPlanejado (opcional)
}
export function ChurnKpisHero(props: ChurnKpisHeroProps): JSX.Element
```
KPIs renderizados: **MRR perdido**, **Taxa de churn**, **Nº de logos perdidos** (`contratos.filter(c => c.tipo === 'churn' && !c.is_abonado).length`), **% evitável** (`evitabilidade_churn`), com **lifetime médio** e **ticket médio** como secundários (StatPill).

- [ ] **Step 1: Escrever teste do cálculo de "% evitável"**

Extrair a regra de % evitável como função pura `pctEvitavel(contratos: ChurnContract[]): number` dentro de `ChurnKpisHero.tsx` (exportada). Criar `client/src/components/churn/__tests__/ChurnKpisHero.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pctEvitavel } from "../ChurnKpisHero";

describe("pctEvitavel", () => {
  it("retorna a fração de churn marcado como evitável", () => {
    const contratos = [
      { tipo: "churn", is_abonado: false, evitabilidade_churn: "Evitável" },
      { tipo: "churn", is_abonado: false, evitabilidade_churn: "Inevitável" },
      { tipo: "churn", is_abonado: false, evitabilidade_churn: "Evitável" },
    ] as any;
    expect(pctEvitavel(contratos)).toBeCloseTo(66.67, 1);
  });
  it("retorna 0 para lista vazia", () => {
    expect(pctEvitavel([])).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run client/src/components/churn/__tests__/ChurnKpisHero.test.ts`
Expected: FAIL (`pctEvitavel` não existe).

- [ ] **Step 3: Implementar `ChurnKpisHero` + `pctEvitavel`**

Criar o componente com os 4 KPIs + secundários, movendo o JSX do hero do Resumo (~2005-2200, parte dos KPIs/gauge). Implementar `pctEvitavel` lendo `evitabilidade_churn` (comparar case-insensitive contendo "evit" e não "inevit" — espelhar a lógica atual da aba Inteligência).

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run client/src/components/churn/__tests__/ChurnKpisHero.test.ts`
Expected: PASS.

- [ ] **Step 5: Plugar no orquestrador + typecheck + browser**

Substituir o hero inline por `<ChurnKpisHero .../>`. `npm run check` 0 erros. No browser os 4 KPIs aparecem corretos; dark/light ok.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(churn): ChurnKpisHero com 4 KPIs de diagnóstico (+ teste pctEvitavel)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Componente `ChurnDrillDrawer`

**Objetivo:** Drawer lateral único (`Sheet`) que lista os contratos de um recorte e permite abonar inline. Migra a ação de abono que estava na aba Contratos.

**Files:**
- Create: `client/src/components/churn/ChurnDrillDrawer.tsx`
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces:**
- Consumes: `ChurnContract`, `@/components/ui/sheet`.
- Produces:
```tsx
export interface ChurnDrillDrawerProps {
  open: boolean;
  titulo: string;
  contratos: ChurnContract[];
  onClose: () => void;
  onToggleAbono: (taskId: string, abonar: boolean) => void;  // dispara a mutation no orquestrador
  pendingIds: Set<string>;
  abonadoOverrides: Record<string, boolean>;
}
export function ChurnDrillDrawer(props: ChurnDrillDrawerProps): JSX.Element
```
- O orquestrador mantém o `useState` do recorte:
```tsx
const [drill, setDrill] = useState<{ titulo: string; contratos: ChurnContract[] } | null>(null);
const onDrill = (titulo: string, contratos: ChurnContract[]) => setDrill({ titulo, contratos });
```

- [ ] **Step 1: Criar `ChurnDrillDrawer.tsx`**

Usar `Sheet`/`SheetContent` (lado direito). Listar os contratos (cliente, MRR, motivo, lifetime, data) numa tabela compacta; cada linha com `Switch` de abono (estado efetivo = `abonadoOverrides[id] ?? c.is_abonado`, desabilitado se `pendingIds.has(id)`), chamando `onToggleAbono`. Reaproveitar colunas/linhas expandíveis da antiga aba Contratos (~4398-4595) que forem úteis.

- [ ] **Step 2: Manter a mutation de abono no orquestrador e expor `onToggleAbono`**

A `abonarMutation` (atual ~514-541) e os states `abonadoOverrides`/`pendingIds` permanecem no orquestrador. Criar `const onToggleAbono = (taskId, abonar) => abonarMutation.mutate({ taskId, abonar });` e passar ao drawer junto de `pendingIds`/`abonadoOverrides`. Renderizar `<ChurnDrillDrawer open={!!drill} titulo={drill?.titulo ?? ""} contratos={drill?.contratos ?? []} onClose={() => setDrill(null)} .../>` no fim do JSX.

- [ ] **Step 3: Validar typecheck + browser**

`npm run check` 0 erros. Para testar a abertura agora (antes das seções existirem), adicionar temporariamente um botão "abrir exemplo" que chama `onDrill("Teste", filteredContratos)` — abre o drawer, lista contratos, abono alterna. Remover o botão temporário antes do commit. Dark/light ok.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(churn): ChurnDrillDrawer (Sheet lateral) com abono inline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Seção `SecaoMotivos` (ângulo 1)

**Objetivo:** Primeira seção do scroll: motivo→submotivo, evitabilidade, tipo de erro. Liga ao drawer.

**Files:**
- Create: `client/src/components/churn/SecaoMotivos.tsx`
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces:**
- Consumes: `ChurnContract`, UI compartilhada.
- Produces:
```tsx
export interface SecaoMotivosProps {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}
export function SecaoMotivos(props: SecaoMotivosProps): JSX.Element
```

- [ ] **Step 1: Criar `SecaoMotivos.tsx` movendo os `useMemo` do ângulo**

Mover para dentro do componente (recalculando a partir de `props.contratos`): `motivoSubmotivoTree`, `crossAnalysisData`, `churnPorTipoErro`, `dadosTipoErroAtual`, `retentionOpportunities`. Internalizar os states de UI próprios (`crossAnalysisView`, `expandedMotivo`) como `useState` local. Renderizar os gráficos/tabelas que estavam em Distribuição/Inteligência relativos a motivo/evitabilidade/tipo de erro, usando `SectionBlock`/`TechChartCard`. Em cada item clicável, chamar `props.onDrill(label, contratosDoRecorte)` filtrando `props.contratos`.

- [ ] **Step 2: Plugar no orquestrador (abaixo do hero)**

`<SecaoMotivos contratos={filteredContratos} onDrill={onDrill} />`.

- [ ] **Step 3: Validar typecheck + browser**

`npm run check` 0 erros. No browser: seção renderiza; clicar num motivo abre o drawer com os contratos daquele motivo. Dark/light ok.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(churn): SecaoMotivos (motivo→submotivo, evitabilidade, tipo de erro)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Seção `SecaoVozCliente` (ângulo 2)

**Objetivo:** Segunda seção: sentimento, temas, mural de mensagens (IA). Liga ao drawer.

**Files:**
- Create: `client/src/components/churn/SecaoVozCliente.tsx`
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces:**
- Consumes: `ChurnContract`, React Query (`POST /api/analytics/churn-mensagens-ai`).
- Produces:
```tsx
export interface SecaoVozClienteProps {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}
export function SecaoVozCliente(props: SecaoVozClienteProps): JSX.Element
```

- [ ] **Step 1: Criar `SecaoVozCliente.tsx` movendo a lógica de IA**

Mover para o componente: `contratosComMensagem`, `aiPayload`, o `useQuery`/`useMutation` que chama `POST /api/analytics/churn-mensagens-ai` (atual ~1470-1505), `aiByContract`, `sentimentDistribution`, `themeDistribution`, `textPatternAnalysis`, `contextThemes`, `muralMessages`. Internalizar os states do mural (`muralSortBy`, `muralFilterSentiment`, `muralFilterTheme`, `muralExpandedId`, `selectedThemeKeyword`, `expandedOpTheme`, `expandedCxTheme`). Renderizar donut de sentimento, ranking de temas e o mural. Clique num tema/sentimento → `onDrill`.

- [ ] **Step 2: Plugar no orquestrador (abaixo de Motivos) + typecheck + browser**

`<SecaoVozCliente contratos={filteredContratos} onDrill={onDrill} />`. `npm run check` 0 erros. No browser: análise de IA carrega (loading state visível), mural filtra; clicar tema abre drawer. Dark/light ok.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(churn): SecaoVozCliente (sentimento, temas e mural via IA)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Seção `SecaoSegmentacao` (ângulo 3)

**Objetivo:** Terceira seção: squad, produto/serviço, faixa de ticket, responsável. Liga ao drawer.

**Files:**
- Create: `client/src/components/churn/SecaoSegmentacao.tsx`
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces:**
- Produces:
```tsx
export interface SecaoSegmentacaoProps {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}
export function SecaoSegmentacao(props: SecaoSegmentacaoProps): JSX.Element
```

- [ ] **Step 1: Criar `SecaoSegmentacao.tsx` movendo os `useMemo`**

Mover: `distribuicaoPorSquad`, `distribuicaoPorProduto`, `distribuicaoPorResponsavel`, `distribuicaoPorTicket` (recalculados de `props.contratos`). Manter a exclusão de squads irrelevantes (`['turbo interno','squad x','interno','x']`, atual ~772) idêntica. Renderizar os BarCharts/Pies via `TechChartCard`. Clique numa barra/fatia → `onDrill(label, recorte)`.

- [ ] **Step 2: Plugar no orquestrador (abaixo de Voz do Cliente) + typecheck + browser**

`<SecaoSegmentacao contratos={filteredContratos} onDrill={onDrill} />`. `npm run check` 0 erros. Browser: gráficos por squad/produto/ticket/responsável; clique abre drawer. Dark/light ok.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(churn): SecaoSegmentacao (squad, produto, ticket, responsável)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Seção `SecaoTiming` (ângulo 4)

**Objetivo:** Quarta seção: distribuição por lifetime + evolução mensal. Liga ao drawer.

**Files:**
- Create: `client/src/components/churn/SecaoTiming.tsx`
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

**Interfaces:**
- Consumes: `ChurnContract`; opcionalmente a série mensal já calculada no orquestrador.
- Produces:
```tsx
export interface SecaoTimingProps {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}
export function SecaoTiming(props: SecaoTimingProps): JSX.Element
```

- [ ] **Step 1: Criar `SecaoTiming.tsx` movendo os `useMemo`**

Mover: `distribuicaoPorLifetime`, `churnPorMes`, `comparativoMensal`, `cohortAnalysis`, `lifetimeCurve`, `mrrPerdidoPorMes` (recalculados de `props.contratos`). Renderizar distribuição por lifetime (Pie) + evolução mensal (BarChart). Clique numa faixa de lifetime/mês → `onDrill(label, recorte)`.

- [ ] **Step 2: Plugar no orquestrador (abaixo de Segmentação) + typecheck + browser**

`<SecaoTiming contratos={filteredContratos} onDrill={onDrill} />`. `npm run check` 0 erros. Browser: lifetime e evolução mensal renderizam; clique abre drawer. Dark/light ok.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(churn): SecaoTiming (lifetime e evolução mensal)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Limpeza final + polimento

**Objetivo:** Remover todo o código morto remanescente, garantir lint limpo, estados de loading/vazio e dark/light em toda a página. Orquestrador enxuto.

**Files:**
- Modify: `client/src/pages/ChurnDetalhamento.tsx` (e componentes de `components/churn/` conforme necessário)

**Interfaces:**
- Consumes: tudo das Tasks 2-9.
- Produces: orquestrador final só com fetch + período + filtros + `filteredContratos`/`filteredMetricas`/`filteredTaxaChurn`/`gaugeStatusOverride`/`churnPlanejado`/`churnExcessFromPreviousMonths` + estado do drawer + mutation de abono; JSX = `<ChurnControls/>`, `<ChurnKpisHero/>`, `<SecaoMotivos/>`, `<SecaoVozCliente/>`, `<SecaoSegmentacao/>`, `<SecaoTiming/>`, `<ChurnDrillDrawer/>`.

- [ ] **Step 1: Remover `useMemo`/states/imports órfãos**

Run: `npm run lint`
Para cada warning de variável/import não usado em `ChurnDetalhamento.tsx` (ex.: `useMemo`s migrados, `topClientesPerdidos` se não reaproveitado, ícones soltos), remover. Remover qualquer `eslint-disable` temporário da Task 1. Conferir que `filteredChurnPorSquad`/`churnDailyInsights` ainda são usados; se não, remover.

- [ ] **Step 2: Estados de loading e vazio**

Garantir: enquanto `isLoading`, esqueleto/spinner; quando `filteredContratos.length === 0`, cada seção mostra empty state ("Sem churn no período/recorte"). Verificar que nenhuma seção quebra com lista vazia.

- [ ] **Step 3: Lint + typecheck + testes**

Run: `npm run check && npm run lint && npm run test`
Expected: tsc 0 erros, eslint 0 warnings, vitest passa.

- [ ] **Step 4: Revisão visual completa no browser**

Percorrer a página inteira em dark E light: hero → motivos → voz do cliente → segmentação → timing → drawer. Trocar período e filtros e confirmar que todas as seções reagem. Confirmar responsividade básica.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(churn): limpeza final, loading/empty states e polimento da reconstrução

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (preenchido pelo autor do plano)

**Spec coverage:**
- Foco diagnóstico → Tasks 6-9 (4 ângulos). ✓
- Scroll narrativo / sem abas → Task 1 (remove abas) + ordem de plug das seções (hero→motivos→voz→seg→timing). ✓
- Drill via drawer → Task 5 + `onDrill` nas Tasks 6-9. ✓
- Período mês atual + filtros → Task 3 (mantém states atuais, default inalterado). ✓
- Descarte do Relatório Semanal → Task 1 (Steps 1,5). ✓
- KPIs do topo (MRR perdido, taxa, logos, % evitável) → Task 4. ✓
- Modularização → Tasks 2-9 (UI compartilhada + 1 componente por seção). ✓
- Ação de abono migrada → Task 5 (drawer). ✓
- Backend intacto → Global Constraints; nenhuma task toca server/SQL. ✓

**Placeholder scan:** sem TBD/TODO; interfaces com tipos explícitos; cada task tem comando de validação e commit.

**Type consistency:** `ChurnContract`/`ChurnDetalhamentoData` definidos na Task 2 e consumidos com o mesmo nome nas Tasks 3-9; `onDrill(titulo, contratos)` idêntico em Tasks 5-9; `pctEvitavel` definido e testado na Task 4.

**Nota sobre TDD:** a reconstrução não introduz lógica de negócio nova (migra `useMemo` validados), por isso o ciclo de validação é typecheck + lint + verificação no browser (dark/light), com teste Vitest onde há função pura nova (`pctEvitavel`, Task 4). Alinhado ao CLAUDE.md ("testes mínimos para lógica de negócio").
