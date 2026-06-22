# Auto Report Command Center Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Auto Report page from a scattered card-based layout into a compact Command Center optimized for weekly batch generation of Slides reports by 10+ managers with 20+ clients each.

**Architecture:** Replace the current 735-line monolithic component with 5 focused sub-components (Toolbar, Filters, Table, ActionBar, JobsDrawer) orchestrated by a slim parent. The layout shifts from vertical cards + 2/3+1/3 grid to a compact toolbar → filter tabs → full-width table → floating action bar.

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui (Table, Tabs, Sheet, Skeleton, Tooltip, Badge, Select, Popover, Calendar), React Query, date-fns, lucide-react.

**Spec:** `docs/superpowers/specs/2026-03-13-auto-report-command-center-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `client/src/pages/auto-report/AutoReportToolbar.tsx` | Period selector, format dropdown, refresh, "Ver Jobs" button |
| Create | `client/src/pages/auto-report/AutoReportFilters.tsx` | Status tabs with counts, search, gestor/squad dropdowns |
| Create | `client/src/pages/auto-report/AutoReportTable.tsx` | Full-width sortable table with platform indicators |
| Create | `client/src/pages/auto-report/AutoReportActionBar.tsx` | Floating sticky bar with selection, batch gen, progress |
| Create | `client/src/pages/auto-report/AutoReportJobsDrawer.tsx` | Right-side Sheet with job list, downloads, retry |
| Create | `client/src/pages/auto-report/utils.ts` | Shared helpers: date parsing, status classification, formatters |
| Create | `client/src/pages/auto-report/types.ts` | Shared types and interfaces |
| Rewrite | `client/src/pages/AutoReport.tsx` | Slim orchestrator importing sub-components |

---

## Chunk 1: Foundation — Types, Utils, and Toolbar

### Task 1: Extract shared types

**Files:**
- Create: `client/src/pages/auto-report/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// client/src/pages/auto-report/types.ts
export interface AutoReportCliente {
  rowIndex: number;
  gerar: boolean;
  cliente: string;
  categoria: 'ecommerce' | 'lead_com_site' | 'lead_sem_site' | '';
  linkPainel: string;
  linkPasta: string;
  idGoogleAds: string;
  idMetaAds: string;
  idGa4: string;
  gestor: string;
  squad: string;
  status: string;
  ultimaGeracao: string;
}

export interface AutoReportJob {
  id: string;
  clienteNome: string;
  categoria: string;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  mensagem?: string;
  presentationId?: string;
  presentationUrl?: string;
  downloadUrl?: string;
  fileName?: string;
  criadoEm: string;
  concluidoEm?: string;
}

export interface PageSelection {
  cover: boolean;
  executiveSummary: boolean;
  investmentChannels: boolean;
  funnelTraffic: boolean;
  campaignsRecommendations: boolean;
}

export type OutputFormat = 'pdf' | 'slides';
export type StatusTab = 'todos' | 'pendentes' | 'gerados' | 'com_erro';
export type SortColumn = 'nome' | 'gestor' | 'squad' | 'ultimaGeracao' | null;
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export const DEFAULT_PAGE_SELECTION: PageSelection = {
  cover: true,
  executiveSummary: true,
  investmentChannels: true,
  funnelTraffic: true,
  campaignsRecommendations: true,
};

export const PAGE_OPTIONS: { key: keyof PageSelection; label: string; description: string }[] = [
  { key: 'investmentChannels', label: 'Investimento & Canais', description: 'Google Ads + Meta Ads' },
  { key: 'funnelTraffic', label: 'Funil & Tráfego', description: 'Métricas GA4' },
  { key: 'campaignsRecommendations', label: 'Campanhas & Recomendações', description: 'Detalhes + Insights' },
];
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/auto-report/types.ts
git commit -m "refactor(auto-report): extract shared types to dedicated module"
```

---

### Task 2: Create utils with date parsing and status classification

**Files:**
- Create: `client/src/pages/auto-report/utils.ts`

- [ ] **Step 1: Create utils file**

```typescript
// client/src/pages/auto-report/utils.ts
import { parse, formatDistanceToNow, format, isValid, isBefore, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AutoReportCliente, StatusTab } from './types';
import type { DateRange } from 'react-day-picker';

/**
 * Parse ultimaGeracao string from Google Sheets.
 * Backend writes it as new Date().toLocaleString('pt-BR') → "DD/MM/YYYY, HH:mm:ss"
 */
export function parseUltimaGeracao(value: string): Date | null {
  if (!value || !value.trim()) return null;

  // Try "dd/MM/yyyy, HH:mm:ss" (toLocaleString pt-BR output)
  let parsed = parse(value.trim(), 'dd/MM/yyyy, HH:mm:ss', new Date());
  if (isValid(parsed)) return parsed;

  // Try "dd/MM/yyyy HH:mm:ss" (without comma)
  parsed = parse(value.trim(), 'dd/MM/yyyy HH:mm:ss', new Date());
  if (isValid(parsed)) return parsed;

  // Try "dd/MM/yyyy" (date only)
  parsed = parse(value.trim(), 'dd/MM/yyyy', new Date());
  if (isValid(parsed)) return parsed;

  return null;
}

/**
 * Format relative time for "Última Geração" column.
 */
export function formatRelativeTime(value: string): string {
  const date = parseUltimaGeracao(value);
  if (!date) return 'nunca';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

/**
 * Check if a client's last generation is overdue (> 7 days).
 */
export function isOverdue(value: string): boolean {
  const date = parseUltimaGeracao(value);
  if (!date) return true;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return isBefore(date, sevenDaysAgo);
}

/**
 * Classify a client into a status tab.
 */
export function classifyClientStatus(
  cliente: AutoReportCliente,
  periodStart: Date | undefined
): StatusTab {
  // "Com Erro" takes priority: sheet status contains "erro"
  if (cliente.status?.toLowerCase().includes('erro')) {
    return 'com_erro';
  }

  // "Pendentes": never generated OR generated before period start
  const lastGen = parseUltimaGeracao(cliente.ultimaGeracao);
  if (!lastGen) return 'pendentes';
  if (periodStart && isBefore(lastGen, periodStart)) return 'pendentes';

  return 'gerados';
}

/**
 * Get categoria display label.
 */
export function getCategoriaLabel(categoria: string): string {
  switch (categoria) {
    case 'ecommerce': return 'E-commerce';
    case 'lead_com_site': return 'Lead c/ Site';
    case 'lead_sem_site': return 'Lead s/ Site';
    default: return categoria || 'N/D';
  }
}

/**
 * Get categoria badge variant.
 */
export function getCategoriaBadgeVariant(categoria: string): "default" | "secondary" | "outline" {
  switch (categoria) {
    case 'ecommerce': return 'default';
    case 'lead_com_site': return 'secondary';
    case 'lead_sem_site': return 'outline';
    default: return 'outline';
  }
}

/**
 * Get default date range (last full week, Mon-Sun).
 */
export function getDefaultDateRange(): DateRange {
  const hoje = new Date();
  const inicioSemanaPassada = startOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });
  const fimSemanaPassada = endOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });
  return { from: inicioSemanaPassada, to: fimSemanaPassada };
}

/**
 * Format date range for display in toolbar button.
 */
export function formatDateRange(dateRange: DateRange | undefined): string {
  if (!dateRange?.from) return 'Selecionar período';
  if (!dateRange.to) return format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR });
  return `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/auto-report/utils.ts
git commit -m "refactor(auto-report): create shared utils with date parsing and status classification"
```

---

### Task 3: Build AutoReportToolbar component

**Files:**
- Create: `client/src/pages/auto-report/AutoReportToolbar.tsx`

- [ ] **Step 1: Create the toolbar component**

Build a compact toolbar with:
- Title + subtitle on the left
- "Ver Jobs" button and Refresh button on the top-right
- Period selector (Calendar popover) + preset buttons on second row
- Format dropdown (default: `slides`) on the right of second row
- When PDF is selected, show collapsible page selection checkboxes below

**Key implementation details:**
- Use `Popover` + `Calendar` for date range (same as current)
- Use `Select` component for format dropdown (not RadioGroup — more compact)
- PDF page toggles appear in a collapsible div with `transition-all` when format is 'pdf'
- Preset buttons: Última Semana, 7d, 14d, 30d (same logic as current)

```typescript
// client/src/pages/auto-report/AutoReportToolbar.tsx
// Props:
interface AutoReportToolbarProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  outputFormat: OutputFormat;
  onOutputFormatChange: (format: OutputFormat) => void;
  pageSelection: PageSelection;
  onTogglePage: (key: keyof PageSelection) => void;
  onRefresh: () => void;
  onOpenJobs: () => void;
  isRefreshing: boolean;
}
```

Use imports from: `@/components/ui/card`, `@/components/ui/button`, `@/components/ui/popover`, `@/components/ui/calendar`, `@/components/ui/select`, `@/components/ui/checkbox`, `lucide-react` (CalendarIcon, RefreshCw, FileText, Presentation, ClipboardList). Import `date-fns` utilities and `ptBR` locale.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/auto-report/AutoReportToolbar.tsx
git commit -m "feat(auto-report): add compact toolbar with period, format, and refresh"
```

---

## Chunk 2: Filters and Table

### Task 4: Build AutoReportFilters component

**Files:**
- Create: `client/src/pages/auto-report/AutoReportFilters.tsx`

- [ ] **Step 1: Create the filters component**

Build status tabs + search/filter bar:

```typescript
// Props:
interface AutoReportFiltersProps {
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
  tabCounts: Record<StatusTab, number>;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filtroGestor: string;
  onGestorChange: (gestor: string) => void;
  filtroSquad: string;
  onSquadChange: (squad: string) => void;
  gestores: string[];
  squads: string[];
}
```

**Implementation details:**
- Status tabs: use div buttons (not shadcn Tabs, since we need badge counts and custom styling). Each tab is a button with count badge.
- Active tab: `bg-primary text-primary-foreground` styling
- Inactive tab: `bg-muted/50 hover:bg-muted`
- "Com Erro" tab: count in red badge, only visible when count > 0
- Search: `Input` with `Search` icon (same pattern as current)
- Gestor/Squad: `Select` components side by side
- Everything in a single `Card`

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/auto-report/AutoReportFilters.tsx
git commit -m "feat(auto-report): add filter tabs with status counts and search/squad filters"
```

---

### Task 5: Build AutoReportTable component

**Files:**
- Create: `client/src/pages/auto-report/AutoReportTable.tsx`

- [ ] **Step 1: Create the table component**

Full-width sortable table with all specified columns.

```typescript
// Props:
interface AutoReportTableProps {
  clientes: AutoReportCliente[];
  selectedClientes: Set<number>;
  onToggleCliente: (rowIndex: number) => void;
  onSelectAll: (rowIndexes: number[]) => void;
  sortState: SortState;
  onSort: (column: SortColumn) => void;
  onGerarIndividual: (cliente: AutoReportCliente) => void;
  isGenerating: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetryLoad: () => void;
}
```

**Implementation details:**

**Table header:** Use `TableHead` with clickable headers for sortable columns. Show arrow indicator: `ArrowUp` / `ArrowDown` from lucide-react when sorted, nothing when not. Click cycles: asc → desc → null (remove sort).

**Table rows:** Each `TableRow` is clickable (toggles checkbox). Columns:
- **Checkbox**: `Checkbox` component from shadcn
- **Nome**: Client name as primary text. Below it, two small badges: `getCategoriaLabel()` and "Auto" (green) if `gerar=true`
- **Gestor**: plain text, `text-sm`
- **Squad**: plain text, `text-sm`
- **Plataformas**: 3 small circles (8x8px divs). Green (`bg-green-500`) if id is non-empty, gray (`bg-gray-300 dark:bg-zinc-600`) if empty. Wrap each in `Tooltip` showing platform name + ID. Use flexbox with `gap-1.5`.
- **Última Geração**: `formatRelativeTime()` from utils. Apply `text-amber-600 dark:text-amber-400` if `isOverdue()`. Apply `text-muted-foreground` if "nunca". Wrap in `Tooltip` showing absolute date from `parseUltimaGeracao()`.
- **Status**: Badge component. Use same logic as current `getStatusBadge()` but moved to a helper.

**Status badge helper:** Define `getStatusBadge(status: string)` as a local function inside `AutoReportTable.tsx` (returns JSX, so not suitable for utils). Logic: if status contains "conclu" or "sucesso" → green Badge with CheckCircle; if "process" → secondary Badge with spinning Loader2; if "erro" → destructive Badge with XCircle; if "pend" → outline Badge with Clock; else → outline Badge with raw status text.

**Hover action:** On row hover, show a small `FileText` icon button on the right side (absolute positioned within the row). On click, fires `onGerarIndividual`. On mobile (no hover), always visible via `sm:opacity-100 md:opacity-0 md:group-hover:opacity-100` on the row (add `group` class to `TableRow`).

**Loading state:** When `isLoading`, render `SkeletonTable` from `@/components/ui/skeleton` with `rows={6}`.

**Error state:** When `isError`, render a centered card with `XCircle` icon, "Erro ao carregar clientes" message, and "Tentar Novamente" button calling `onRetryLoad`.

**Empty states** (two distinct cases):
- When `totalClientes === 0` (no clients from API at all): "Nenhum cliente encontrado na planilha central. Verifique se a planilha está configurada." with `AlertTriangle` icon.
- When `clientes.length === 0` but `totalClientes > 0` (filters returned empty): "Nenhum cliente corresponde aos filtros aplicados." with `Search` icon.
- Pass `totalClientes` as an additional prop to distinguish these cases.

**Select all checkbox:** In table header, a checkbox that selects/deselects all visible clients.

**Responsive column visibility:**
- Desktop (lg+): all columns visible
- Tablet (md): hide Squad column with `hidden lg:table-cell` on Squad header/cells. Truncate Gestor with `max-w-[100px] truncate`.
- Mobile (sm): show only Nome + Status. Hide Gestor, Squad, Plataformas, Última Geração with `hidden md:table-cell`.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/auto-report/AutoReportTable.tsx
git commit -m "feat(auto-report): add full-width sortable table with platform indicators"
```

---

## Chunk 3: Action Bar, Jobs Drawer, and Orchestrator

### Task 6: Build AutoReportActionBar component

**Files:**
- Create: `client/src/pages/auto-report/AutoReportActionBar.tsx`

- [ ] **Step 1: Create the floating action bar**

```typescript
// Props:
interface AutoReportActionBarProps {
  selectedCount: number;
  onSelectPendentes: () => void;
  onClearSelection: () => void;
  onGerar: () => void;
  isGenerating: boolean;
  // Batch progress
  batchTotal: number;
  batchCompleted: number;
  batchErrors: number;
  batchDone: boolean;
  onVerDetalhes: () => void;
}
```

**Implementation details:**

**Container:** `fixed bottom-0 left-0 right-0 z-50` with `bg-white dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 shadow-lg`. Transition in/out with opacity and transform (`translate-y-full` when hidden → `translate-y-0` when visible). Use `transition-all duration-300`.

**Visibility:** Show when `selectedCount > 0` OR `isGenerating` OR `batchDone`.

**Selection state** (not generating):
- Left: checkmark icon + "{n} selecionados"
- Center: "Selecionar Pendentes" outline button + "Limpar" ghost button
- Right: "Gerar Slides" primary button with Play icon (or "Gerar PDF" based on format — pass via prop or context)

**Progress state** (isGenerating):
- Full-width progress bar: `div` with `h-2 bg-gray-200 dark:bg-zinc-700 rounded-full` container. Inner fill div with `bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500`. Width = `(batchCompleted + batchErrors) / batchTotal * 100%`.
- Text: "{completed}/{total} concluídos • {errors} erros • {remaining} restam"
- Error count in `text-red-600 dark:text-red-400`

**Completion state** (batchDone, not generating):
- Summary text: "{completed} gerados, {errors} erros"
- "Ver Detalhes" button to open Jobs drawer
- "Fechar" ghost button to dismiss

**Inner container:** `max-w-7xl mx-auto px-6 py-3` to match page padding.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/auto-report/AutoReportActionBar.tsx
git commit -m "feat(auto-report): add floating action bar with batch progress tracking"
```

---

### Task 7: Build AutoReportJobsDrawer component

**Files:**
- Create: `client/src/pages/auto-report/AutoReportJobsDrawer.tsx`

- [ ] **Step 1: Create the jobs drawer**

```typescript
// Props:
interface AutoReportJobsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: AutoReportJob[];
  onRetryJob: (clienteNome: string) => void;
}
```

**Implementation details:**

Use shadcn `Sheet` component with `side="right"`. Width: `w-[400px]`.

**Header:** `SheetHeader` with "Jobs Recentes" title and description showing total count.

**Job list:** ScrollArea containing job cards. Each job card is a `div` with:
- Top row: status icon + client name (truncated) + relative time
- Status icons: `CheckCircle` (green) for concluido, `Loader2` (spinning) for processando, `XCircle` (red) for erro, `Clock` for pendente
- Completed with PPTX download: "Baixar PPTX" link with `Presentation` icon → `<a href={job.downloadUrl} download>`
- Completed with PDF download: "Baixar PDF" link with `FileText` icon → `<a href={job.downloadUrl} download>`
- Detect format from `job.fileName`: ends with `.pptx` → PPTX, else PDF
- Error: red text showing `job.mensagem`, plus "Tentar Novamente" outline button → `onRetryJob(job.clienteNome)`
- Processing: "Processando..." with muted text

**Empty state:** Clock icon + "Nenhum relatório gerado ainda"

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/auto-report/AutoReportJobsDrawer.tsx
git commit -m "feat(auto-report): add jobs drawer with real-time status and downloads"
```

---

### Task 8: Rewrite AutoReport.tsx orchestrator

**Files:**
- Rewrite: `client/src/pages/AutoReport.tsx`

- [ ] **Step 1: Rewrite the main component**

This is the most critical task. The new `AutoReport.tsx` becomes a slim orchestrator (~300 lines) that:

1. **Manages all state:**
   - `dateRange` (initialized via `getDefaultDateRange()` from utils), `outputFormat` (initialized to `'slides'` — NOT `'pdf'`), `pageSelection` (toolbar state)
   - `activeTab`, `searchTerm`, `filtroGestor`, `filtroSquad` (filter state)
   - `selectedClientes: Set<number>` (selection state)
   - `sortState: SortState` (table sort)
   - `jobsDrawerOpen: boolean` (drawer visibility)
   - `batchClientNames: string[]` (for progress tracking)
   - `batchDone: boolean` (completion flag)

2. **React Query hooks:**
   - `useQuery` for `/api/autoreport/clientes` (same as current)
   - `useQuery` for `/api/autoreport/jobs` with `refetchInterval: 5000`
   - `useMutation` for single report generation (same as current)
   - `useMutation` for batch generation — on mutate, store `batchClientNames`; on success/error, set `batchDone = true` and open drawer (auto-open is safe because if user navigates away, the component unmounts and callback is irrelevant)
   - Import `queryClient` from `@/lib/queryClient`. In mutation `onSuccess` callbacks, call `queryClient.invalidateQueries({ queryKey: ['/api/autoreport/jobs'] })` and `queryClient.invalidateQueries({ queryKey: ['/api/autoreport/clientes'] })`
   - Import and use `useToast` from `@/hooks/use-toast`. Show toast on single report success ("Relatório gerado!"), single report error ("Erro ao gerar relatório"), and batch completion summary ("X gerados, Y erros")

3. **Computed values (useMemo):**
   - `gestores`: unique gestor names from clientes
   - `squads`: unique squad names from clientes
   - `clientesValidos`: clientes with valid categoria
   - `clientesFiltrados`: apply search + gestor + squad filters
   - `clientesByTab`: further filter by activeTab using `classifyClientStatus()`
   - `tabCounts`: count per status tab (computed from clientesFiltrados, NOT clientesByTab)
   - `batchProgress`: computed from jobs matching `batchClientNames` — count completed + errors

4. **Sorting logic:**
   - Apply `sortState` to `clientesByTab` before passing to table
   - Default sort (null column): pendentes first (null ultimaGeracao first, then oldest)
   - Sort by column: use `localeCompare` for strings, date comparison for ultimaGeracao

5. **Key handlers:**
   - `handleSelectPendentes`: select all visible clients classified as 'pendentes'
   - `handleGerarLote`: fire batch mutation with selected clients, store their names in `batchClientNames`
   - `handleRetryJob`: find client by name in clientes list, fire single generation mutation
   - `handleSort`: cycle sort: if same column → toggle direction → if desc, set to null; if different column → asc

6. **Layout:**
```tsx
<div className="p-6 space-y-4 pb-24"> {/* pb-24 for action bar space */}
  <AutoReportToolbar ... />
  <AutoReportFilters ... />
  <AutoReportTable ... />
  <AutoReportActionBar ... />
  <AutoReportJobsDrawer ... />
</div>
```

- [ ] **Step 2: Verify the page loads correctly**

Run: `npm run dev` (or check the dev server if running)
Navigate to `/growth/auto-report` and verify:
- Toolbar renders with period selector and Slides default
- Filter tabs show with counts
- Table renders with all columns
- Action bar appears when clients are selected
- Jobs drawer opens via "Ver Jobs" button

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/AutoReport.tsx client/src/pages/auto-report/
git commit -m "feat(auto-report): redesign as Command Center with table, filters, and floating action bar

Replaces card-based layout with compact toolbar, status filter tabs,
full-width sortable table with platform indicators, floating action bar
with batch progress tracking, and jobs drawer.

Default format changed from PDF to Google Slides.
Removes hide/restore feature (replaced by status tab filtering)."
```

---

## Chunk 4: Polish and Dark Mode Verification

### Task 9: Dark mode and responsive polish

**Files:**
- Modify: all 5 new components + orchestrator as needed

- [ ] **Step 1: Review dark mode across all components**

Check each component renders correctly in dark mode. Key areas:
- Table borders and hover states
- Action bar background and shadow
- Progress bar fill color
- Badge colors in tabs
- Platform indicator dot visibility
- Tooltip backgrounds

Ensure all components use `dark:` variants per project convention:
- `bg-white dark:bg-zinc-900` for surfaces
- `border-gray-200 dark:border-zinc-700` for borders
- `text-gray-900 dark:text-white` for primary text
- `text-gray-600 dark:text-zinc-400` for secondary text

- [ ] **Step 2: Review responsive behavior**

Check that on smaller screens:
- Filter tabs wrap properly
- Table is scrollable horizontally
- Action bar takes full width
- Search/filter inputs stack vertically on mobile

- [ ] **Step 3: Commit any fixes**

```bash
git add client/src/pages/auto-report/ client/src/pages/AutoReport.tsx
git commit -m "fix(auto-report): polish dark mode and responsive layout"
```

---

### Task 10: Final integration test

- [ ] **Step 1: Test complete workflow**

1. Load page → verify toolbar, tabs, table render
2. Change period preset → verify tab counts update
3. Switch format to PDF → verify page selection appears
4. Switch back to Slides → verify page selection hides
5. Search for a client → verify table filters
6. Filter by gestor → verify table and tab counts update
7. Filter by squad → verify table and tab counts update
8. Click status tab → verify table shows correct clients
9. Select clients via checkboxes → verify action bar appears
10. Click "Selecionar Pendentes" → verify correct clients selected
11. Click "Gerar" → verify progress bar appears and updates
12. After completion → verify drawer opens with job results
13. Click "Ver Jobs" in toolbar → verify drawer opens
14. Test in dark mode → verify all colors correct

- [ ] **Step 2: Final commit and push**

```bash
git add -A
git commit -m "feat(auto-report): complete Command Center redesign

- Compact toolbar with period selector and format dropdown
- Status filter tabs (Todos/Pendentes/Gerados/Com Erro) with counts
- Full-width sortable table with platform indicators
- Floating action bar with batch progress tracking
- Jobs drawer with download links and retry
- Default format: Google Slides
- Dark mode and responsive support"

git push
```
