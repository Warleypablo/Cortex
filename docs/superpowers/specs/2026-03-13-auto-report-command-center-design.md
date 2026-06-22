# Auto Report Command Center — Design Spec

**Date:** 2026-03-13
**Status:** Approved
**Scope:** Frontend redesign of `/growth/auto-report` page

## Context

The Auto Report tab generates weekly marketing reports (PDF/Google Slides) for clients by pulling metrics from GA4, Google Ads, and Meta Ads. Currently used by 10+ managers, each handling 20+ clients.

**Primary workflow:** Manager enters once per week, selects all pending clients, generates Slides reports in batch, monitors progress.

**Current problems:**
- Layout wastes vertical space with 3 separate config cards before reaching client list
- Client list (card-based, 2/3 width) lacks key columns: platforms configured, last generation date
- No status filtering (pending/generated/error)
- No squad filter
- Jobs panel (1/3 width) always visible even when empty
- No batch progress visibility
- Stats cards show numbers without actionable context
- PDF is the default format but Slides is used 90%+ of the time

**Breaking change:** Default output format changes from `pdf` to `slides`.

## Design: Command Center

### 1. Toolbar (Compact Header)

Single card with all configuration inline:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Auto Report                                                [Ver Jobs] ⟳ │
│ Geração automática de relatórios semanais                                │
│                                                                          │
│ 📅 03/03 - 09/03 ▼  [Últ.Sem] [7d] [14d] [30d]          [Slides ▼]    │
└───────────────────────────────────────────────────────────────────────────┘
```

- Period selector with calendar popover + preset buttons (same logic, more compact layout)
- Format dropdown: default `slides`, option `pdf`. When PDF selected, page selection toggles appear below in a collapsible row (same checkboxes as current, just collapsed)
- **"Ver Jobs" button** in top-right: opens the Jobs drawer manually
- Refresh button aligned right next to "Ver Jobs"
- **One line, one card, no vertical waste**

### 2. Filter Tabs + Search Bar

```
┌──────────────────────────────────────────────────────────────────┐
│ [Todos 45] [Pendentes 12] [Gerados ✅ 30] [Com Erro ❌ 3]       │
│                                                                  │
│ 🔍 Pesquisar...     Gestor [▼ Todos]     Squad [▼ Todos]       │
└──────────────────────────────────────────────────────────────────┘
```

**Status tabs** with badge counts:
- **Todos** — all clients with valid `categoria`
- **Pendentes** — clients whose `ultimaGeracao` is empty, or whose parsed date is older than the selected period's start date
- **Gerados** — clients whose `ultimaGeracao` parsed date falls within or after the selected period's start date, AND whose sheet `status` does not contain "erro"
- **Com Erro** — clients whose sheet `status` field (from Google Sheet) contains "erro" (case-insensitive). This uses the persistent sheet status, NOT the ephemeral in-memory jobs, so errors survive server restarts.

**Tab counts reflect current search/gestor/squad filters.** When filtering by Squad "Alpha", counts update to show only Alpha clients. This is more intuitive for managers who filter to their squad.

**`ultimaGeracao` parsing:** The field is written by the backend as `new Date().toLocaleString('pt-BR')`, producing format `DD/MM/YYYY HH:mm:ss`. Parse using `date-fns/parse` with format `dd/MM/yyyy, HH:mm:ss`. If parsing fails, treat as "never generated" (empty).

**Filters:**
- Search by client name (existing)
- Filter by gestor (existing)
- Filter by squad (new — derived from `squad` field on client data)

**Eliminates:** The 4 stats cards (Total, Marcados, Selecionados, Jobs) — tabs provide the same info contextually.

**Removed feature:** The "hide client" / "restore hidden" feature from the current implementation is removed. The new status tabs and filters provide sufficient ways to focus on relevant clients without needing to manually hide others.

### 3. Client Table (Full-Width)

Replaces the card-based list + jobs panel grid. Takes 100% width.

**Columns:**

| Column | Content | Width | Notes |
|--------|---------|-------|-------|
| Checkbox | Selection | 40px | Click row to toggle |
| Nome | Client name + categoria badge below + "Auto" badge if `gerar=true` | flex | Primary identifier |
| Gestor | Manager name | 120px | |
| Squad | Squad name | 100px | |
| Plataformas | 3 dot indicators: GA4, Google Ads, Meta | 100px | Green = configured (id present), Gray = not configured |
| Última Geração | Relative time ("há 2 dias") | 120px | Yellow highlight if > 7 days, gray if never |
| Status | Badge (ok/erro/processando/—) | 80px | Last generation status |

**Row interactions:**
- Click anywhere on row toggles checkbox
- Hover reveals "Gerar" quick action icon button (right side). On mobile/touch: always visible.
- Selected rows get subtle primary background highlight

**Sorting:** Clickable column headers for Nome, Gestor, Squad, Última Geração.
- Click toggles: ascending → descending → default (no sort)
- Active sort column shows arrow indicator (↑ or ↓) next to header text
- Default sort (no column active): Pendentes first — clients with no `ultimaGeracao` first, then sorted by oldest `ultimaGeracao`

**Loading state:** Table shows 6 skeleton rows (animated pulse) while `loadingClientes` is true.

**Error state:** If `GET /api/autoreport/clientes` fails, show an error card with message and "Tentar Novamente" button.

**Empty states:**
- No clients: "Nenhum cliente encontrado na planilha central. Verifique se a planilha está configurada."
- No filter matches: "Nenhum cliente corresponde aos filtros aplicados."

### 4. Floating Action Bar

Sticky bar at the bottom of the viewport. **Only visible when clients are selected OR batch is running.**

**Selection state:**
```
┌──────────────────────────────────────────────────────────────────┐
│ ✅ 12 selecionados  [Selecionar Pendentes] [Limpar]  [▶ Gerar] │
└──────────────────────────────────────────────────────────────────┘
```

- **"Selecionar Pendentes"**: selects all clients currently visible (matching active filters: tab, search, gestor, squad) that are classified as "Pendentes". Does NOT switch tabs.
- **"Limpar"**: deselects all
- **"Gerar"**: starts batch generation

**Progress state (during batch):**
```
┌──────────────────────────────────────────────────────────────────┐
│ ████████████░░░░░░  7/12 concluídos  •  2 erros  •  3 restam   │
└──────────────────────────────────────────────────────────────────┘
```

**How progress tracking works (no backend changes needed):**
The batch endpoint `POST /api/autoreport/gerar-lote` processes reports sequentially (with 2s delays) in a single long-running HTTP request. During this time, each job is added to the server's in-memory `activeJobs` map as it starts processing. The frontend's React Query `refetchInterval: 5000` on `GET /api/autoreport/jobs` continues firing independently of the pending mutation, picking up intermediate job statuses. The progress bar is computed by:
1. Store the batch client names when "Gerar" is clicked (e.g., `batchClientNames: string[]`)
2. On each jobs poll, count jobs matching those client names with status `concluido` or `erro`
3. Progress = (concluidos + erros) / total batch size

**On completion** (mutation resolves or all batch jobs reach terminal state): Show summary in the action bar with "Ver Detalhes" button that opens Jobs drawer. Auto-open the drawer only if the user is still on the AutoReport page.

### 5. Jobs Drawer

Right-side sheet/drawer (shadcn `Sheet` component). Opens:
- Automatically when batch generation completes (if user is on page)
- Manually via "Ver Jobs" button in toolbar
- Manually via "Ver Detalhes" button in action bar after batch completes

**Content:**
```
┌─ Jobs Recentes ──────────────────┐
│                                   │
│ ✅ Cliente ABC        há 2 min   │
│    📊 Abrir Slides               │
│                                   │
│ ✅ Cliente DEF        há 3 min   │
│    📄 Baixar PDF                 │
│                                   │
│ ❌ Cliente GHI        há 3 min   │
│    Erro: Meta Ads timeout        │
│    [↻ Tentar Novamente]          │
│                                   │
│ ⏳ Cliente JKL        agora      │
│    Processando...                │
│                                   │
└───────────────────────────────────┘
```

- Each job shows: status icon, client name, relative time
- **Slides format completed:** "Abrir Slides" link uses `downloadUrl` to download PPTX (since current flow generates downloadable PPTX, not Google Slides links). Opens download.
- **PDF format completed:** "Baixar PDF" link uses `downloadUrl`. Triggers download.
- **Error:** error message + "Tentar Novamente" button (re-fires `gerarRelatorio` mutation for that client)
- **Processing:** spinner animation

### 6. Platform Indicators

Three small dots/pills in the "Plataformas" column:

```
[GA4] [Ads] [Meta]
 🟢    🟢    ⚪
```

- **Green dot** = ID is configured (non-empty `idGa4`, `idGoogleAds`, `idMetaAds`)
- **Gray dot** = not configured
- Tooltip on hover: "GA4: Configurado (ID: 123456)" or "Meta Ads: Não configurado"
- Helps debug: if a report has missing data, managers can see which platform wasn't set up

### 7. "Última Geração" Column

Displays relative time since last report generation:

- "há 1 dia" — normal text color, no highlight
- "há 3 dias" — normal
- "há 8 dias" — `text-amber-600 dark:text-amber-400` (overdue for weekly reports)
- "nunca" — `text-muted-foreground` with dash icon
- Tooltip shows absolute date: "06/03/2026 14:30"

Logic: parsed from `ultimaGeracao` field using `date-fns/parse` with `dd/MM/yyyy, HH:mm:ss` format and `ptBR` locale.

## Component Structure

```
AutoReport.tsx (orchestrator, ~300 lines)
├── AutoReportToolbar.tsx (~80 lines)
│   ├── Period selector (calendar + presets)
│   ├── Format dropdown (slides/pdf)
│   └── Refresh + "Ver Jobs" button
├── AutoReportFilters.tsx (~80 lines)
│   ├── Status tabs (Todos/Pendentes/Gerados/Erro) with counts
│   ├── Search input
│   ├── Gestor select
│   └── Squad select
├── AutoReportTable.tsx (~250 lines)
│   ├── Table header (sortable columns)
│   ├── Table rows (with platform indicators, quick action)
│   ├── Skeleton loading state
│   ├── Error state
│   └── Empty states
├── AutoReportActionBar.tsx (~120 lines)
│   ├── Selection summary
│   ├── Quick actions (Select Pending, Clear)
│   ├── Generate button
│   └── Progress bar (batch mode)
└── AutoReportJobsDrawer.tsx (~120 lines)
    ├── Job list with real-time status
    ├── Download/open links
    └── Retry failed jobs
```

## Data Flow

No backend changes required. Same API endpoints:
- `GET /api/autoreport/clientes` → client list (includes `ultimaGeracao`, `status` from sheet)
- `POST /api/autoreport/gerar` → single report generation
- `POST /api/autoreport/gerar-lote` → batch reports (long-running, jobs tracked via polling)
- `GET /api/autoreport/jobs` → job status (polling every 5s)
- `GET /api/autoreport/download/:jobId` → download generated file

**New frontend computed state:**
- Status tab counts: computed from client list + current filters
- "Pendentes" classification: `ultimaGeracao` empty or parsed date < selected period start
- "Com Erro" classification: sheet `status` field contains "erro" (case-insensitive)
- "Gerados" classification: not pendentes AND not com erro
- Batch progress: tracked via `batchClientNames` state + jobs polling
- Sort state: `{ column: string | null, direction: 'asc' | 'desc' }` in component state
- Squad options: derived from `new Set(clientes.map(c => c.squad).filter(Boolean))`

## Dark/Light Mode

All components use Tailwind `dark:` variants per project convention:
- Table: `bg-white dark:bg-zinc-900`
- Borders: `border-gray-200 dark:border-zinc-700`
- Text: `text-gray-900 dark:text-white` / `text-gray-600 dark:text-zinc-400`
- Action bar: `bg-white dark:bg-zinc-800 border-t shadow-lg`
- Progress bar fill: `bg-green-500 dark:bg-green-400`
- Error count text: `text-red-600 dark:text-red-400`
- Overdue "Última Geração": `text-amber-600 dark:text-amber-400`
- Drawer: uses shadcn Sheet component (already themed)

## Responsive Behavior

- **Desktop (lg+):** Full table with all columns visible
- **Tablet (md):** Hide Squad column. Gestor column truncated.
- **Mobile (sm):** Table shows Nome + Status only. Quick action "Gerar" button always visible (not hover-dependent). Filters stack vertically. Action bar takes full width.

## Out of Scope

- Backend API changes
- Template modifications
- New data sources
- PDF page selection UI (kept as-is, just collapsed under format dropdown)
- Batch confirmation dialog (not needed — the action is reversible since reports can be regenerated)
- Keyboard accessibility beyond browser defaults
