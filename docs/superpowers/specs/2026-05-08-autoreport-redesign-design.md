# Auto Report Visual Redesign — Design Spec

**Data:** 2026-05-08
**Branch sugerida:** `feature/autoreport-visual-redesign`
**Tipo:** Soft re-skin (sem mudança de backend ou estrutura de componentes)

---

## Contexto e motivação

A página `/growth/auto-report` (`client/src/pages/AutoReport.tsx`) já passou por um redesign de Command Center em março/2026 (vide `docs/superpowers/plans/2026-03-13-auto-report-command-center.md`). A estrutura atual em 5 sub-componentes (Toolbar, Filters, Table, ActionBar, JobsDrawer) está sólida funcionalmente.

**Problema:** apesar de funcional, gestores de performance percebem a tela como "fria" — parece um sistema técnico de admin, não uma ferramenta de entrega. Isso aumenta a fricção do fluxo semanal de bater 20+ relatórios em sequência e copiar links pra mandar via WhatsApp/email.

**Objetivo:** transformar a sensação da tela de "sistema técnico" para "ferramenta de entrega autônoma", sem mudar fluxo nem backend, com 4-6 commits granulares de refinamento visual.

## Princípios de design

1. **Status-First** — o status do cliente é o herói visual em todos os pontos (hero KPIs, side bar nas linhas, chips, drawer cards). Em uma fila de 20 clientes, o gestor precisa scanear "o que falta" sem ler.
2. **Sensação de progresso** — barra de progresso da semana + estados intermediários durante batch + completion state com recompensa visual.
3. **Encurtar o caminho até o link** — o último passo do gestor é copiar link de Slides → cola no WhatsApp. CTAs de cópia são primários onde aparecem (drawer, action bar pós-batch).
4. **Re-skin, não redesign** — zero mudança de backend, tipos, lógica de classificação ou estrutura de componentes. Apenas edits internos nos 5 sub-componentes existentes.
5. **Profissional & confiante** — paleta sóbria com acentos pontuais; sem gradientes berrantes; tipografia limpa; espaçamento generoso.

## Escopo

### Em escopo
- Visual redesign dos 5 sub-componentes existentes em `client/src/pages/auto-report/`.
- Novo arquivo `client/src/pages/auto-report/tokens.ts` com helpers de cores semânticas.
- Novo botão "Copiar todos os links" no estado de conclusão de batch da Action Bar.
- Estados vazios/loading/erro mais calorosos.
- Dark mode polido em todos os componentes alterados.

### Fora de escopo
- Backend (`server/autoreport/*`, rotas `/api/autoreport/*`).
- Tipos `AutoReportCliente` / `AutoReportJob` em `types.ts`.
- Lógica de classificação de status (`utils.ts`).
- Sort, busca, filtros, geração em lote (lógica mantida igual).
- Mudança da estrutura de 5 sub-componentes + orchestrator.
- Adição de funcionalidades novas além de "Copiar todos os links".

## Estrutura final da página

A página passa de 4 cards verticais (Toolbar / Filters / Table / ActionBar) + Drawer para 3 cards verticais + Drawer:

```
┌─────────────────────────────────────────────────┐
│  Card Hero (Hero header + período + formato)    │  ← AutoReportToolbar (refatorado)
├─────────────────────────────────────────────────┤
│  Card Filtros (busca + gestor + squad)          │  ← AutoReportFilters (refatorado, sem tabs)
├─────────────────────────────────────────────────┤
│  Tabela (sem card wrapper, full width)          │  ← AutoReportTable (refatorado)
└─────────────────────────────────────────────────┘
        Action Bar flutuante (fixed bottom)            ← AutoReportActionBar (refatorado)
        Drawer lateral direita (Sheet)                 ← AutoReportJobsDrawer (refatorado)
```

---

## Seção 1 — Hero Header (substitui título atual no `AutoReportToolbar`)

### Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  Auto Report  ·  Semana de 28/abr a 04/mai           [Ver Jobs] [↻]    │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ ⏳ 18         │  │ ✓ 12          │  │ ⚠ 2           │                  │
│  │ PENDENTES    │  │ GERADOS      │  │ COM ERRO     │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                        │
│  Progresso da semana ▓▓▓▓▓▓▓░░░░░░░░  37%                              │
└────────────────────────────────────────────────────────────────────────┘
```

### Especificação
- **Título** `h1`: `text-2xl font-bold text-gray-900 dark:text-white` (mantido).
- **Subtítulo dinâmico**: substitui *"Geração automática de relatórios semanais"* por *"Semana de DD/mmm a DD/mmm"*, formatado a partir do `dateRange`. Em `text-sm text-gray-500 dark:text-zinc-400`.
- **KPI cards** (3): cada um é um botão clicável.
  - Container: `bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-lg p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-zinc-900`.
  - Quando ativo (filtro aplicado): borda colorida (`border-amber-300 dark:border-amber-800`) + leve fundo (`bg-amber-50/50 dark:bg-amber-950/20`).
  - Ícone à esquerda (`Clock` âmbar / `CheckCircle` verde / `AlertTriangle` vermelho), tamanho `w-5 h-5`.
  - Número grande: `text-3xl font-bold` na cor do status (`text-amber-600 dark:text-amber-400`).
  - Label uppercase: `text-xs font-semibold uppercase tracking-wide text-muted-foreground`.
  - Em mobile (`< sm`): cards em 3 colunas com números menores (`text-xl`).
- **Barra de progresso da semana**: `(gerados) / (gerados + pendentes + com erro) * 100`. Container `h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full`, fill `bg-gradient-to-r from-amber-500 to-emerald-500` com `transition-all duration-500`. Texto à direita: `XX%`.
- **Botões de ação no canto superior direito**: "Ver Jobs" e Refresh mantidos como estão hoje, sem alteração.

### Comportamento
- Clicar em um KPI card seta o filtro de status correspondente. Clicar novamente no mesmo card limpa.
- O filtro de status interno migra de `activeTab: StatusTab` (em `AutoReport.tsx`) para o mesmo state, só que controlado pelos KPIs em vez das tabs.

---

## Seção 2 — Filtros (`AutoReportFilters` refatorado)

### Mudanças
- **Remover** a linha de tabs (`Todos / Pendentes / Gerados / Com Erro`). A função migra para os KPIs do Hero.
- **Adicionar** um chip "Filtro ativo" que aparece quando há filtro aplicado:
  ```
  ▸ Filtrando: Pendentes  ✕         ← só aparece se activeTab !== 'todos'
  ```
  - Aparência: `inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-xs font-medium text-primary`.
  - X clica → `setActiveTab('todos')`.
- **Search input** mais largo (`w-[280px]` em vez de `w-[200px]`), placeholder atualizado para *"Buscar por nome do cliente..."*.
- **Selects de Gestor e Squad**: largura mantida (`w-[180px]`), placeholders ajustados para *"Todos os gestores"* e *"Todos os squads"* (com 1 espaço, sem caps weird).
- **Card** com `p-4` (mantém compacto).

### Props (atualizadas)
- Remover: `activeTab`, `onTabChange`, `tabCounts` (esses passam pra `AutoReportToolbar` para alimentar os KPIs).
- Adicionar: `activeFilter` derivado (mostra qual filtro de status está ativo) ou simplesmente passar `activeTab` para mostrar o chip de filtro ativo.

---

## Seção 3 — Tabela (`AutoReportTable` refatorada)

### Mudanças visuais

#### 3.1 Side bar de status (esquerda da linha)
- `<TableRow>` ganha um `border-l-[3px]` cuja cor é função do status do cliente:
  - Pendente: `border-amber-500`
  - Gerado: `border-emerald-500`
  - Erro: `border-red-500`
  - Sem categoria/inativo: `border-gray-300 dark:border-zinc-700`
- Implementação: helper `getRowBorderClass(cliente, dateRange)` em `tokens.ts` que retorna a classe.

#### 3.2 Plataformas como chips coloridos (substitui dots)
- Substituir o componente `PlatformDot` por `PlatformChip`:
  ```tsx
  <PlatformChip platform="GA4" configured={!!cliente.idGa4} id={cliente.idGa4} />
  <PlatformChip platform="Ads" configured={!!cliente.idGoogleAds} id={cliente.idGoogleAds} />
  <PlatformChip platform="Meta" configured={!!cliente.idMetaAds} id={cliente.idMetaAds} />
  ```
- **Configurado**: `inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border` com cores de marca atenuadas:
  - GA4: `bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800`
  - Ads: `bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800`
  - Meta: `bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800`
- **Não configurado**: `border-dashed text-muted-foreground bg-transparent` (mesmo formato, mas "fantasma"). Conteúdo: três pontos `···` ou label apagada.
- Tooltip: mantém comportamento atual (mostra ID quando configurado, "Não configurado" quando não).

#### 3.3 Última Geração como chip
- Substituir o `<span>` por um chip pequeno com ícone Clock + texto:
  - "nunca": `bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400` + ícone Clock
  - Atrasado (>7d): `bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400` + ícone Clock
  - Recente (≤7d): `bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400` + ícone CheckCircle
- Tooltip mantém: data absoluta `dd/MM/yyyy HH:mm`.

#### 3.4 Linha mais alta + nome em destaque + ação visível
- Aumentar padding vertical: `py-4` por célula (em vez de default).
- Nome do cliente: `text-base font-semibold text-foreground` (era `font-medium` menor).
- Linha de chips abaixo do nome: categoria + chip "Auto" (se `gerar`) — `text-xs`.
- Botão "Gerar agora" sempre visível na coluna de actions:
  - `<Button variant="ghost" size="sm" className="h-8">` com ícone `FileText` ou `Play` + label "Gerar".
  - Remover `opacity-0 group-hover:opacity-100`.
- Hover na linha: `bg-muted/40` (mais sutil que o atual).
- Selecionado: `bg-primary/10` + side bar com cor mais saturada e leve glow `shadow-[inset_3px_0_0_0_currentColor]`.

#### 3.5 Status badge (refinado)
Mantém a função `getStatusBadge` mas com paleta unificada:
- Concluído: `bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800`
- Processando: `bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800` + Loader2 spin
- Erro: `bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800`
- Pendente: `bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800`
- Tamanho ligeiramente maior: `px-2.5 py-1 text-xs` (vs default).

### Mantido
- Sort por colunas (header clicável, ícones ArrowUp/ArrowDown).
- Select all checkbox.
- Comportamento responsivo (esconder Squad em md, esconder Gestor/Plataformas/Última em sm).
- Estados de loading (skeleton) / error / empty (com refinamentos da Seção 6c).

---

## Seção 4 — Action Bar (`AutoReportActionBar` refatorada)

### Container
- `bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-200 dark:border-zinc-800`.
- Shadow mais sutil: `shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]`.
- Transição mantida (translate-y).

### Estado de seleção
```
✓ 5 selecionados   [Selecionar pendentes]  [Limpar]      [▶ Gerar 5 Slides]
```
- Texto à esquerda: `font-medium text-foreground` com ícone `Check` em verde.
- Botões secundários no centro: `variant="outline"` e `variant="ghost"`.
- CTA primário à direita: `size="lg" className="gap-2"`, label dinâmico `Gerar {n} Slides` ou `Gerar {n} PDFs` baseado em `outputFormat`.

### Estado processando
```
⏳ Gerando 12 relatórios   ▓▓▓▓▓▓▓░░░░░  7/12 concluídos · 1 erro
```
- Barra de progresso `h-2.5 rounded-full bg-gray-200 dark:bg-zinc-800`.
- Fill: `bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500`.
- Texto: contagem em tempo real (já vem do React Query polling). Erros em `text-red-600 dark:text-red-400`.

### Estado concluído (NOVO: "Copiar todos os links")
```
✓ 12 relatórios gerados · 1 com erro
                   [📋 Copiar todos os links]  [Ver detalhes]  [✕]
```
- Ícone `CheckCircle` verde + texto à esquerda.
- **Botão "Copiar todos os links"** (NOVO): `variant="default"` com ícone `Clipboard`.
  - Ação: pega `batchClientNames`, busca os jobs correspondentes em `jobs`, filtra `status === 'concluido'` e que tenham `presentationUrl`, monta string:
    ```
    Loja Alpha — https://docs.google.com/presentation/d/abc123
    Lojinha Beta — https://docs.google.com/presentation/d/def456
    ```
  - Copia pra clipboard via `navigator.clipboard.writeText(...)`.
  - Toast: *"X links copiados. Cole no WhatsApp/email."*
  - Disabled se 0 jobs concluídos com URL.
- "Ver detalhes" mantido (`variant="outline"`, abre drawer).
- Botão `✕` (Dismiss): `variant="ghost" size="icon"`.

### Props (atualizadas)
Adicionar:
- `jobs: AutoReportJob[]` — necessário para o handler de "Copiar todos os links" ler `presentationUrl` de cada job.

---

## Seção 5 — Drawer de Jobs (`AutoReportJobsDrawer` refatorado)

### Header
```
Jobs Recentes        12 hoje · ✕
─────────────────────────────────
[ Hoje ]  [ Esta semana ]  [Tudo]
```
- Título `font-semibold text-lg`.
- Contador "X hoje" em `text-sm text-muted-foreground`.
- Filtros temporais: 3 chips (variant="outline" quando inativo, variant="default" quando ativo, `size="sm"`).

### Card de job
Cada job vira um div com `border-l-[3px]` na cor do status (igual à tabela), `p-3 rounded-r-lg bg-muted/30 dark:bg-zinc-900/40 mb-2`.

#### Concluído (Slides)
```
▎ Loja Alpha          ✓ há 2 min
▎ E-commerce
▎
▎ [📋 Copiar Link]  [↗ Abrir Slides]
```
- Side bar verde.
- **CTA primário "Copiar Link"** (`variant="default" size="sm"`): copia `job.presentationUrl` no clipboard. Toast confirmação.
- "Abrir Slides" (`variant="ghost" size="sm"`): `<a href={job.presentationUrl} target="_blank">`.

#### Concluído (PDF)
```
▎ Loja Beta           ✓ há 5 min
▎ Lead c/ site
▎ [⬇ Baixar PDF]
```
- Side bar verde.
- "Baixar PDF" primário: `<a href={job.downloadUrl} download>` com ícone `Download`.

#### Processando
```
▎ Loja Gamma          ⏳ processando
▎ E-commerce
```
- Side bar âmbar com `animate-pulse` sutil.
- Sem botões; texto "processando" com `Loader2 animate-spin`.

#### Erro
```
▎ Loja Delta          ✕ há 8 min
▎ Falha ao buscar dados do GA4
▎ [↻ Tentar Novamente]
```
- Side bar vermelha.
- Mensagem em `text-sm text-red-600 dark:text-red-400`.
- "Tentar Novamente" `variant="outline" size="sm"`.

### Agrupamento e ordem
- Jobs agrupados por dia: `Hoje`, `Ontem`, `Esta semana` (D-2 a D-7), `Mais antigos`.
- Header de grupo: `text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2`.
- Dentro de cada grupo: ordenados por `criadoEm` decrescente.
- Filtros temporais escondem grupos: "Hoje" mostra só grupo "Hoje", "Esta semana" mostra Hoje+Ontem+Esta semana, "Tudo" mostra todos.

### Empty state
- Ícone `Inbox` `w-12 h-12 text-muted-foreground/50`.
- Texto: *"Você ainda não gerou nenhum relatório nessa janela."*
- Subtítulo: *"Selecione clientes e clique em Gerar."*

### Largura
- `w-[440px]` (era `w-[400px]`) para acomodar o CTA "Copiar Link" sem quebra.

---

## Seção 6 — Toolbar do período + tokens + estados

### 6a. Toolbar do período (mergeada com Hero em `AutoReportToolbar`)
Reorganização interna do `AutoReportToolbar` para conter:
1. Linha 1: Título + subtítulo do período + botões Ver Jobs / Refresh.
2. Linha 2: 3 KPI cards.
3. Linha 3: Barra de progresso.
4. Linha 4 (após divider sutil): Date picker + presets + format dropdown.
5. Linha 5 (collapsible): Páginas do PDF (só se formato = PDF).

Mantém o componente `AutoReportToolbar` como container único; apenas reorganiza o JSX interno. Adiciona props:
- `tabCounts: Record<StatusTab, number>` — para alimentar os KPIs.
- `activeTab: StatusTab` — para destacar KPI ativo.
- `onTabChange: (tab: StatusTab) => void` — para clicar nos KPIs filtrar status.

### 6b. Tokens em `tokens.ts` (novo arquivo)

```typescript
// client/src/pages/auto-report/tokens.ts

export type StatusKind = 'pendente' | 'gerado' | 'erro' | 'inativo';

export const STATUS_CLASSES: Record<StatusKind, {
  bg: string;
  text: string;
  border: string;
  borderLeft: string; // for row side bar
  icon: string;
}> = {
  pendente: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    borderLeft: 'border-l-amber-500',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  gerado: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    borderLeft: 'border-l-emerald-500',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  erro: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    borderLeft: 'border-l-red-500',
    icon: 'text-red-600 dark:text-red-400',
  },
  inativo: {
    bg: 'bg-gray-50 dark:bg-zinc-900',
    text: 'text-gray-500 dark:text-zinc-400',
    border: 'border-gray-200 dark:border-zinc-700',
    borderLeft: 'border-l-gray-300 dark:border-l-zinc-700',
    icon: 'text-gray-500 dark:text-zinc-500',
  },
};

export type PlatformKind = 'GA4' | 'Ads' | 'Meta';

export const PLATFORM_CLASSES: Record<PlatformKind, {
  configured: string; // full classes string for configured chip
  notConfigured: string; // full classes for ghost chip
}> = {
  GA4: {
    configured:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800',
    notConfigured:
      'border-dashed text-muted-foreground bg-transparent dark:text-zinc-600',
  },
  Ads: {
    configured:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    notConfigured:
      'border-dashed text-muted-foreground bg-transparent dark:text-zinc-600',
  },
  Meta: {
    configured:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
    notConfigured:
      'border-dashed text-muted-foreground bg-transparent dark:text-zinc-600',
  },
};

/**
 * Map StatusTab to StatusKind for visual styling.
 */
export function statusTabToKind(tab: 'pendentes' | 'gerados' | 'com_erro'): StatusKind {
  switch (tab) {
    case 'pendentes': return 'pendente';
    case 'gerados': return 'gerado';
    case 'com_erro': return 'erro';
  }
}

/**
 * Compute the StatusKind for a given client based on classifyClientStatus result.
 */
export function clientStatusKind(
  cliente: AutoReportCliente,
  periodStart: Date | undefined
): StatusKind {
  const tab = classifyClientStatus(cliente, periodStart);
  if (tab === 'todos') return 'inativo';
  return statusTabToKind(tab);
}
```

### 6c. Estados vazios / loading / erro

#### Loading
Trocar `SkeletonTable` por uma versão que respeita o novo layout: linhas com side bar cinza, nome em skeleton retangular, plataformas como chips em skeleton circular pequeno. Manter componente em `client/src/pages/auto-report/AutoReportTableSkeleton.tsx` (novo).

#### Empty (sem clientes)
- Ícone `FileWarning` `w-12 h-12 text-amber-500/70`.
- Título `Nenhum cliente configurado ainda` `text-lg font-semibold`.
- Subtítulo `Verifique se a planilha central está configurada com clientes ativos.` `text-sm text-muted-foreground`.

#### Empty (filtros zeraram)
- Ícone `SearchX` `w-12 h-12 text-muted-foreground/50`.
- Título `Nenhum cliente bate com esses filtros` `text-lg font-semibold`.
- Botão `Limpar filtros` `variant="outline"` que reseta `searchTerm`, `filtroGestor`, `filtroSquad`, `activeTab`. Esse botão precisa de um callback novo passado pela orchestrator.

#### Erro de carga
- Ícone `CloudOff` (lucide-react) `w-12 h-12 text-red-500/70`.
- Título `Erro ao carregar clientes`.
- Subtítulo: `Verifique a conexão e tente novamente.`
- Botão `Tentar novamente` (mantido).

### 6d. Dark mode
Já contemplado em todos os tokens da seção 6b. Validação manual obrigatória pós-implementação:
- Hero card com `bg-zinc-900/50 backdrop-blur-sm border border-zinc-800` em dark.
- KPI cards `bg-zinc-900` em dark.
- Side bars de status mantém boa visibilidade contra `bg-zinc-900` (cores 500 já funcionam).

### 6e. Responsivo
- KPI cards em mobile: `grid grid-cols-3 gap-2` com `text-xl` em vez de `text-3xl`.
- Tabela mantém comportamento atual (esconder Squad em `md`, esconder mais colunas em `sm`).
- Drawer ocupa `100vw` em mobile (default do Sheet shadcn).
- Action Bar mantém `max-w-7xl mx-auto` no inner; em mobile, CTAs empilham com `flex-wrap`.

---

## Mudanças no orchestrator (`AutoReport.tsx`)

Mudanças mínimas, escopo controlado:

1. **Remover `activeTab` props passadas a `AutoReportFilters`** — migrar para `AutoReportToolbar`.
2. **Adicionar callback `handleClearAllFilters`** — usado pelo empty state da tabela.
3. **Passar `jobs` para `AutoReportActionBar`** — necessário para "Copiar todos os links".
4. **Garantir que o cálculo de `tabCounts` esteja alinhado com os KPIs** — já existe.

Nenhuma mudança em queries, mutations, sort, filtros computados ou handlers existentes.

---

## Lista de arquivos afetados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `client/src/pages/AutoReport.tsx` | Edit | Pequenos ajustes de props |
| `client/src/pages/auto-report/AutoReportToolbar.tsx` | Edit | Adiciona Hero KPIs + barra de progresso + reorganiza layout interno |
| `client/src/pages/auto-report/AutoReportFilters.tsx` | Edit | Remove tabs, adiciona chip de filtro ativo |
| `client/src/pages/auto-report/AutoReportTable.tsx` | Edit | Side bar de status, plataformas como chips, última geração como chip, ação visível, padding |
| `client/src/pages/auto-report/AutoReportActionBar.tsx` | Edit | Polish + botão "Copiar todos os links" |
| `client/src/pages/auto-report/AutoReportJobsDrawer.tsx` | Edit | Side bars, agrupamento por dia, CTA "Copiar Link" primário, filtros temporais |
| `client/src/pages/auto-report/tokens.ts` | Create | Tokens de cor centralizados |
| `client/src/pages/auto-report/AutoReportTableSkeleton.tsx` | Create | Skeleton com novo layout |
| `client/src/pages/auto-report/PlatformChip.tsx` | Create | Substitui `PlatformDot` inline em `AutoReportTable.tsx` |

---

## Critérios de sucesso

1. Gestor abre a tela e em ≤ 2s identifica quantos clientes faltam fazer relatório nessa semana (KPI hero).
2. Gestor consegue filtrar para "Pendentes" em 1 clique (KPI clicável).
3. Em uma linha da tabela, o status do cliente é identificável sem ler o badge (side bar lateral).
4. Plataformas desconfiguradas são óbvias (chip outline tracejado vs chip preenchido).
5. Após gerar lote de N relatórios, gestor consegue copiar todos os links de Slides em 1 clique.
6. Drawer mostra job concluído com CTA "Copiar Link" primário.
7. Dark mode consistente: nenhum elemento "estoura" ou desaparece.
8. Mobile: KPIs e action bar ainda funcionais (não quebram layout).

---

## Plano de testes manuais (pós-implementação)

1. Carregar página: ver Hero com KPIs zerados ou com valores reais.
2. Clicar em KPI "Pendentes" → tabela filtra, chip de filtro ativo aparece.
3. Clicar no `✕` do chip → filtros limpam, KPI volta ao estado neutro.
4. Mudar período no date picker → KPIs e barra de progresso atualizam.
5. Selecionar 3 clientes → action bar aparece com CTA "Gerar 3 Slides".
6. Clicar Gerar → ver progresso atualizando em tempo real.
7. Após batch concluir → ver "Copiar todos os links". Clicar → toast confirmação.
8. Colar no editor → ver formato `Cliente — URL` em linhas.
9. Abrir drawer → ver jobs agrupados por dia, com CTA "Copiar Link" funcionando.
10. Validar dark mode em todos os passos acima.
11. Testar mobile: redimensionar viewport para ~ 375px e validar que tudo ainda funciona.

---

## Estimativa

4-6 commits granulares, ~1-2 dias de implementação. Sem mudança de backend, sem migrações, sem novas dependências.
