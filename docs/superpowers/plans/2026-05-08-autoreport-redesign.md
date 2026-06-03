# Auto Report Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft re-skin de `/growth/auto-report` que transforma a tela de "sistema técnico" em "ferramenta de entrega" para gestores de performance, com Hero KPIs clicáveis, side bars de status nas linhas, plataformas como chips coloridos, e CTA "Copiar todos os links" pós-batch.

**Architecture:** Apenas mudanças de UI nos 5 sub-componentes existentes (`AutoReportToolbar`, `AutoReportFilters`, `AutoReportTable`, `AutoReportActionBar`, `AutoReportJobsDrawer`) + 3 arquivos novos (`tokens.ts`, `PlatformChip.tsx`, `AutoReportTableSkeleton.tsx`). Zero mudança de backend, tipos, lógica de classificação ou estrutura. Estado da página permanece em `AutoReport.tsx` (orchestrator).

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, shadcn/ui (Card, Button, Badge, Checkbox, Sheet, Tooltip, etc.), lucide-react, date-fns, react-day-picker, React Query (já em uso).

**Spec:** `docs/superpowers/specs/2026-05-08-autoreport-redesign-design.md`

**Branch sugerida:** `feature/autoreport-visual-redesign`

---

## Pré-requisitos para o engenheiro

Antes de começar:

- [ ] Confirmar que está no diretório `/Users/mac0267/Cortex` (`pwd`).
- [ ] Confirmar branch limpa OU criar feature branch:
  ```bash
  git checkout -b feature/autoreport-visual-redesign
  ```
- [ ] Ler a spec completa: `docs/superpowers/specs/2026-05-08-autoreport-redesign-design.md`.
- [ ] Familiarizar-se com os arquivos atuais (já leu, mas revisar):
  - `client/src/pages/AutoReport.tsx` (orchestrator)
  - `client/src/pages/auto-report/AutoReportToolbar.tsx`
  - `client/src/pages/auto-report/AutoReportFilters.tsx`
  - `client/src/pages/auto-report/AutoReportTable.tsx`
  - `client/src/pages/auto-report/AutoReportActionBar.tsx`
  - `client/src/pages/auto-report/AutoReportJobsDrawer.tsx`
  - `client/src/pages/auto-report/types.ts`
  - `client/src/pages/auto-report/utils.ts`
- [ ] Iniciar dev server em terminal separado:
  ```bash
  lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
  ```
  Aguardar ver `Server running on http://localhost:3000`.
- [ ] Abrir navegador em `http://localhost:3000/growth/auto-report` (logar se necessário). Anotar visual atual mentalmente para comparação.

**Nota sobre verificação visual:** este redesign é puramente visual (sem testes unitários). A verificação por tarefa é manual: depois de cada commit, recarregar `/growth/auto-report` e validar o que mudou. Cada tarefa lista o que verificar em **light mode** E **dark mode** (toggle no header da aplicação).

---

## Task 1: Criar `tokens.ts` (paleta unificada)

**Files:**
- Create: `client/src/pages/auto-report/tokens.ts`

- [ ] **Step 1: Criar o arquivo de tokens**

Criar `client/src/pages/auto-report/tokens.ts` com o conteúdo abaixo. Esse arquivo centraliza as classes Tailwind usadas para colorir status (pendente/gerado/erro/inativo) e plataformas (GA4/Ads/Meta), evitando drift entre componentes.

```typescript
// client/src/pages/auto-report/tokens.ts
import type { AutoReportCliente } from './types';
import { classifyClientStatus } from './utils';

export type StatusKind = 'pendente' | 'gerado' | 'erro' | 'inativo';

export const STATUS_CLASSES: Record<StatusKind, {
  bg: string;
  text: string;
  border: string;
  borderLeft: string;
  borderLeftSelected: string;
  iconColor: string;
  numberColor: string;
}> = {
  pendente: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    borderLeft: 'border-l-amber-500',
    borderLeftSelected: 'border-l-amber-600 dark:border-l-amber-400',
    iconColor: 'text-amber-600 dark:text-amber-400',
    numberColor: 'text-amber-600 dark:text-amber-400',
  },
  gerado: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    borderLeft: 'border-l-emerald-500',
    borderLeftSelected: 'border-l-emerald-600 dark:border-l-emerald-400',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    numberColor: 'text-emerald-600 dark:text-emerald-400',
  },
  erro: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    borderLeft: 'border-l-red-500',
    borderLeftSelected: 'border-l-red-600 dark:border-l-red-400',
    iconColor: 'text-red-600 dark:text-red-400',
    numberColor: 'text-red-600 dark:text-red-400',
  },
  inativo: {
    bg: 'bg-gray-50 dark:bg-zinc-900',
    text: 'text-gray-500 dark:text-zinc-400',
    border: 'border-gray-200 dark:border-zinc-700',
    borderLeft: 'border-l-gray-300 dark:border-l-zinc-700',
    borderLeftSelected: 'border-l-gray-400 dark:border-l-zinc-600',
    iconColor: 'text-gray-500 dark:text-zinc-500',
    numberColor: 'text-gray-700 dark:text-zinc-300',
  },
};

export type PlatformKind = 'GA4' | 'Ads' | 'Meta';

export const PLATFORM_CLASSES: Record<PlatformKind, {
  configured: string;
  notConfigured: string;
}> = {
  GA4: {
    configured:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800',
    notConfigured:
      'border border-dashed border-gray-300 text-gray-400 bg-transparent dark:border-zinc-700 dark:text-zinc-600',
  },
  Ads: {
    configured:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    notConfigured:
      'border border-dashed border-gray-300 text-gray-400 bg-transparent dark:border-zinc-700 dark:text-zinc-600',
  },
  Meta: {
    configured:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
    notConfigured:
      'border border-dashed border-gray-300 text-gray-400 bg-transparent dark:border-zinc-700 dark:text-zinc-600',
  },
};

/**
 * Mapeia o resultado de classifyClientStatus para o StatusKind usado na paleta.
 * - 'pendentes' -> 'pendente'
 * - 'gerados' -> 'gerado'
 * - 'com_erro' -> 'erro'
 * - 'todos' (sem categoria) -> 'inativo'
 */
export function clientStatusKind(
  cliente: AutoReportCliente,
  periodStart: Date | undefined
): StatusKind {
  const tab = classifyClientStatus(cliente, periodStart);
  switch (tab) {
    case 'pendentes':
      return 'pendente';
    case 'gerados':
      return 'gerado';
    case 'com_erro':
      return 'erro';
    case 'todos':
    default:
      return 'inativo';
  }
}
```

- [ ] **Step 2: Verificar build do TypeScript**

Run: `npx tsc --noEmit` (do diretório raiz)

Expected: sem erros novos. Se aparecer erro relacionado a `tokens.ts`, revisar imports.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/auto-report/tokens.ts
git commit -m "feat(autoreport): add unified design tokens for status and platforms

Centralizes Tailwind class strings for status colors (pendente/gerado/erro/
inativo) and platform chips (GA4/Ads/Meta) so all components share a single
source of truth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Criar `PlatformChip.tsx` (substitui PlatformDot)

**Files:**
- Create: `client/src/pages/auto-report/PlatformChip.tsx`

- [ ] **Step 1: Criar o componente**

Criar `client/src/pages/auto-report/PlatformChip.tsx`:

```tsx
// client/src/pages/auto-report/PlatformChip.tsx
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PLATFORM_CLASSES, type PlatformKind } from './tokens';

interface PlatformChipProps {
  platform: PlatformKind;
  configured: boolean;
  id: string;
}

export default function PlatformChip({ platform, configured, id }: PlatformChipProps) {
  const classes = configured
    ? PLATFORM_CLASSES[platform].configured
    : PLATFORM_CLASSES[platform].notConfigured;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${classes}`}
        >
          {platform}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {configured
          ? `${platform}: Configurado (ID: ${id})`
          : `${platform}: Não configurado`}
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npx tsc --noEmit`

Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/auto-report/PlatformChip.tsx
git commit -m "feat(autoreport): add PlatformChip component (replaces dots)

New chip-style indicator for GA4/Ads/Meta with brand-tinted background
when configured, dashed outline when not. Tooltip preserves the platform
name + ID behavior of the previous dots.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Refatorar `AutoReportToolbar` com Hero KPIs + remover tabs do `AutoReportFilters`

Esta é a maior tarefa do plano. Faz duas mudanças simultâneas:
1. `AutoReportToolbar` ganha Hero KPIs clicáveis + barra de progresso da semana, e reorganiza layout.
2. `AutoReportFilters` perde a linha de status tabs (a função migra pros KPIs) e ganha um chip "filtro ativo".
3. `AutoReport.tsx` (orchestrator) re-rota as props: `tabCounts`, `activeTab`, `onTabChange` agora vão pro Toolbar (não pro Filters), e Filters recebe apenas o que precisa pro chip de filtro.

**Files:**
- Modify: `client/src/pages/auto-report/AutoReportToolbar.tsx` (rewrite)
- Modify: `client/src/pages/auto-report/AutoReportFilters.tsx` (rewrite)
- Modify: `client/src/pages/AutoReport.tsx` (props rewiring)

- [ ] **Step 1: Reescrever `AutoReportToolbar.tsx`**

Substituir o conteúdo COMPLETO de `client/src/pages/auto-report/AutoReportToolbar.tsx` pelo seguinte:

```tsx
// client/src/pages/auto-report/AutoReportToolbar.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  CalendarIcon,
  RefreshCw,
  ClipboardList,
  Presentation,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import type { OutputFormat, PageSelection, StatusTab } from './types';
import { PAGE_OPTIONS } from './types';
import { formatDateRange, getDefaultDateRange } from './utils';
import { STATUS_CLASSES } from './tokens';

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
  // KPIs (NEW — migrated from AutoReportFilters tabs)
  tabCounts: Record<StatusTab, number>;
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
}

interface KpiCardProps {
  label: string;
  count: number;
  kind: 'pendente' | 'gerado' | 'erro';
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function KpiCard({ label, count, kind, icon, active, onClick }: KpiCardProps) {
  const tokens = STATUS_CLASSES[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border p-4 transition-colors cursor-pointer ${
        active
          ? `${tokens.bg} ${tokens.border}`
          : 'bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900'
      }`}
      data-testid={`kpi-${kind}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={tokens.iconColor}>{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${tokens.numberColor}`}>{count}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-1">
        {label}
      </div>
    </button>
  );
}

export default function AutoReportToolbar({
  dateRange,
  onDateRangeChange,
  outputFormat,
  onOutputFormatChange,
  pageSelection,
  onTogglePage,
  onRefresh,
  onOpenJobs,
  isRefreshing,
  tabCounts,
  activeTab,
  onTabChange,
}: AutoReportToolbarProps) {
  const selectedPagesCount = Object.values(pageSelection).filter(Boolean).length;

  const setPresetRange = (preset: 'ultima_semana' | '7d' | '14d' | '30d') => {
    switch (preset) {
      case 'ultima_semana':
        onDateRangeChange(getDefaultDateRange());
        break;
      case '7d':
        onDateRangeChange({ from: subDays(new Date(), 7), to: subDays(new Date(), 1) });
        break;
      case '14d':
        onDateRangeChange({ from: subDays(new Date(), 14), to: subDays(new Date(), 1) });
        break;
      case '30d':
        onDateRangeChange({ from: subDays(new Date(), 30), to: subDays(new Date(), 1) });
        break;
    }
  };

  // Period subtitle: "Semana de DD/mmm a DD/mmm"
  const periodSubtitle = dateRange?.from && dateRange?.to
    ? `Semana de ${format(dateRange.from, 'dd/MMM', { locale: ptBR })} a ${format(dateRange.to, 'dd/MMM', { locale: ptBR })}`
    : 'Selecione um período';

  // Progress bar: gerados / total
  const totalKpi = tabCounts.pendentes + tabCounts.gerados + tabCounts.com_erro;
  const progressPct = totalKpi > 0 ? Math.round((tabCounts.gerados / totalKpi) * 100) : 0;

  // Click on KPI: toggles. If already active, reset to 'todos'.
  const handleKpiClick = (tab: StatusTab) => {
    if (activeTab === tab) {
      onTabChange('todos');
    } else {
      onTabChange(tab);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Row 1: Title + period + actions */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auto Report</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">{periodSubtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenJobs}
              data-testid="button-open-jobs"
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Ver Jobs
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Row 2: KPI cards (clickable status filters) */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            label="Pendentes"
            count={tabCounts.pendentes}
            kind="pendente"
            icon={<Clock className="w-5 h-5" />}
            active={activeTab === 'pendentes'}
            onClick={() => handleKpiClick('pendentes')}
          />
          <KpiCard
            label="Gerados"
            count={tabCounts.gerados}
            kind="gerado"
            icon={<CheckCircle className="w-5 h-5" />}
            active={activeTab === 'gerados'}
            onClick={() => handleKpiClick('gerados')}
          />
          <KpiCard
            label="Com Erro"
            count={tabCounts.com_erro}
            kind="erro"
            icon={<AlertTriangle className="w-5 h-5" />}
            active={activeTab === 'com_erro'}
            onClick={() => handleKpiClick('com_erro')}
          />
        </div>

        {/* Row 3: Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso da semana</span>
            <span className="font-medium">{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Row 4: Period config + format */}
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-200 dark:border-zinc-800">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[260px] justify-start text-left"
                data-testid="button-date-picker"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDateRange(dateRange)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={onDateRangeChange}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPresetRange('ultima_semana')}
              data-testid="button-preset-semana"
            >
              Últ. Semana
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPresetRange('7d')}
              data-testid="button-preset-7d"
            >
              7d
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPresetRange('14d')}
              data-testid="button-preset-14d"
            >
              14d
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPresetRange('30d')}
              data-testid="button-preset-30d"
            >
              30d
            </Button>
          </div>

          <div className="ml-auto">
            <Select
              value={outputFormat}
              onValueChange={(value) => onOutputFormatChange(value as OutputFormat)}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-output-format">
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slides">
                  <span className="flex items-center gap-2">
                    <Presentation className="w-4 h-4" />
                    Google Slides
                  </span>
                </SelectItem>
                <SelectItem value="pdf">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 5: PDF page selection (collapsible) */}
        <div
          className="transition-all duration-200 overflow-hidden"
          style={{ maxHeight: outputFormat === 'pdf' ? '200px' : '0px' }}
        >
          <div className="pt-2 border-t border-gray-200 dark:border-zinc-700">
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
              Páginas do PDF ({selectedPagesCount} de 5):
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-zinc-800">
                <Checkbox checked disabled className="opacity-60" />
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  Capa (obrigatória)
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-zinc-800">
                <Checkbox checked disabled className="opacity-60" />
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  Resumo Executivo (obrigatória)
                </span>
              </div>
              {PAGE_OPTIONS.map((page) => (
                <div
                  key={page.key}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                    pageSelection[page.key]
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-gray-50 dark:bg-zinc-800/50 border-transparent hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                  onClick={() => onTogglePage(page.key)}
                  data-testid={`toggle-page-${page.key}`}
                >
                  <Checkbox
                    checked={pageSelection[page.key]}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => onTogglePage(page.key)}
                  />
                  <div>
                    <div className="text-xs font-medium text-gray-900 dark:text-white">
                      {page.label}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-zinc-400">
                      {page.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Reescrever `AutoReportFilters.tsx`** (remove tabs, adiciona chip de filtro ativo)

Substituir o conteúdo COMPLETO de `client/src/pages/auto-report/AutoReportFilters.tsx` por:

```tsx
// client/src/pages/auto-report/AutoReportFilters.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import type { StatusTab } from './types';

interface AutoReportFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filtroGestor: string;
  onGestorChange: (gestor: string) => void;
  filtroSquad: string;
  onSquadChange: (squad: string) => void;
  gestores: string[];
  squads: string[];
  // For active filter chip
  activeTab: StatusTab;
  onClearStatusFilter: () => void;
}

const STATUS_LABELS: Record<StatusTab, string> = {
  todos: '',
  pendentes: 'Pendentes',
  gerados: 'Gerados',
  com_erro: 'Com Erro',
};

export default function AutoReportFilters({
  searchTerm,
  onSearchChange,
  filtroGestor,
  onGestorChange,
  filtroSquad,
  onSquadChange,
  gestores,
  squads,
  activeTab,
  onClearStatusFilter,
}: AutoReportFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Active status filter chip */}
        {activeTab !== 'todos' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrando:</span>
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-xs font-medium text-primary"
              data-testid="active-filter-chip"
            >
              {STATUS_LABELS[activeTab]}
              <button
                type="button"
                onClick={onClearStatusFilter}
                className="hover:bg-primary/10 rounded-full p-0.5 transition-colors"
                aria-label="Limpar filtro de status"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}

        {/* Search + dropdowns row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do cliente..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 w-[280px]"
              data-testid="input-search"
            />
          </div>

          <Select value={filtroGestor} onValueChange={onGestorChange}>
            <SelectTrigger className="w-[180px]" data-testid="select-gestor">
              <SelectValue placeholder="Todos os gestores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os gestores</SelectItem>
              {gestores.map((gestor) => (
                <SelectItem key={gestor} value={gestor}>
                  {gestor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroSquad} onValueChange={onSquadChange}>
            <SelectTrigger className="w-[180px]" data-testid="select-squad">
              <SelectValue placeholder="Todos os squads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os squads</SelectItem>
              {squads.map((squad) => (
                <SelectItem key={squad} value={squad}>
                  {squad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
```

**ATENÇÃO:** o `Select` de gestor/squad em alguns shadcn/ui não aceita `value=""`. Use `"todos"` como sentinela. O orchestrator já usa `"todos"` como default — confirmar no Step 3 abaixo.

- [ ] **Step 3: Atualizar `AutoReport.tsx`** (orchestrator) com props rewiring

Editar `client/src/pages/AutoReport.tsx`. Existem duas mudanças:

**Mudança 3a:** No JSX do `AutoReportToolbar`, adicionar 3 novas props (`tabCounts`, `activeTab`, `onTabChange`).

Localizar o bloco `<AutoReportToolbar ... />` e substituir por:

```tsx
<AutoReportToolbar
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
  outputFormat={outputFormat}
  onOutputFormatChange={setOutputFormat}
  pageSelection={pageSelection}
  onTogglePage={togglePage}
  onRefresh={() => {
    refetchClientes();
    refetchJobs();
  }}
  onOpenJobs={() => setJobsDrawerOpen(true)}
  isRefreshing={isLoading}
  tabCounts={tabCounts}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

**Mudança 3b:** No JSX do `AutoReportFilters`, REMOVER `activeTab`/`onTabChange`/`tabCounts` e adicionar `onClearStatusFilter`:

Localizar o bloco `<AutoReportFilters ... />` e substituir por:

```tsx
<AutoReportFilters
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  filtroGestor={filtroGestor}
  onGestorChange={setFiltroGestor}
  filtroSquad={filtroSquad}
  onSquadChange={setFiltroSquad}
  gestores={gestores}
  squads={squads}
  activeTab={activeTab}
  onClearStatusFilter={() => setActiveTab('todos')}
/>
```

**Mudança 3c (sentinela do Select):** Verificar se os filtros `filtroGestor` e `filtroSquad` usam o sentinel `"todos"` ou outro. Hoje o código tem:

```tsx
if (filtroGestor !== "todos" && c.gestor !== filtroGestor) return false;
```

E o estado inicial é `useState("todos")`. Mas o `SelectItem` no Filters atual estava com `value="__all__"`. Trocando para `value="todos"` no novo Filters (já feito no Step 2). Confirmar visualmente que o filtro continua funcionando.

- [ ] **Step 4: Verificar build do TypeScript**

Run: `npx tsc --noEmit`

Expected: zero erros.

Se aparecer erro tipo "Property 'tabCounts' does not exist on type 'AutoReportFiltersProps'": confirma que removeu as props antigas do orchestrator (Mudança 3b).

- [ ] **Step 5: Verificação visual**

1. Recarregar `http://localhost:3000/growth/auto-report`.
2. **Light mode**: ver o card hero com:
   - Título "Auto Report" + subtítulo "Semana de DD/MMM a DD/MMM"
   - 3 cards de KPI lado a lado, cada um com número grande colorido (âmbar/verde/vermelho)
   - Barra de progresso fina abaixo dos KPIs
   - Selecionador de data + presets + dropdown de formato em uma linha logo abaixo
3. Clicar no KPI "Pendentes" → tabela filtra (só mostra pendentes), card do KPI ganha fundo âmbar discreto, e aparece chip "Filtrando: Pendentes" no card de filtros logo abaixo.
4. Clicar no `X` do chip → filtro limpa, KPI volta ao estado inativo.
5. **Dark mode**: alternar para dark mode. Validar:
   - Hero card com fundo escuro, números mantêm visibilidade
   - KPIs ativos têm fundo escuro tonalizado (sem estourar)
   - Barra de progresso visível
6. Verificar que o seletor de gestores e squads ainda funciona — selecionar um gestor deve filtrar a tabela.
7. Verificar que a coluna de tabs antiga sumiu do `AutoReportFilters`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/auto-report/AutoReportToolbar.tsx \
        client/src/pages/auto-report/AutoReportFilters.tsx \
        client/src/pages/AutoReport.tsx
git commit -m "feat(autoreport): add hero KPIs to toolbar and consolidate status filter

Replaces the plain title with a hero header containing 3 clickable KPI
cards (Pendentes/Gerados/Com Erro) and a weekly progress bar. The status
filter migrates from a separate tabs row in AutoReportFilters into the
KPI cards, leaving Filters with only search + gestor + squad + an active
filter chip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Refatorar `AutoReportTable` (side bars + chips + linhas mais altas)

**Files:**
- Modify: `client/src/pages/auto-report/AutoReportTable.tsx` (rewrite)

- [ ] **Step 1: Reescrever `AutoReportTable.tsx`**

Substituir o conteúdo COMPLETO de `client/src/pages/auto-report/AutoReportTable.tsx` por:

```tsx
// client/src/pages/auto-report/AutoReportTable.tsx
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowUp,
  ArrowDown,
  Play,
  XCircle,
  CheckCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Search,
  CloudOff,
  FileWarning,
  SearchX,
} from 'lucide-react';
import { format } from 'date-fns';
import type { AutoReportCliente, SortState, SortColumn } from './types';
import {
  formatRelativeTime,
  isOverdue,
  parseUltimaGeracao,
  getCategoriaLabel,
  getCategoriaBadgeVariant,
} from './utils';
import { STATUS_CLASSES, clientStatusKind } from './tokens';
import PlatformChip from './PlatformChip';
import AutoReportTableSkeleton from './AutoReportTableSkeleton';

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
  totalClientes: number;
  periodStart: Date | undefined;
  onClearAllFilters: () => void;
}

function SortIcon({ column, sortState }: { column: SortColumn; sortState: SortState }) {
  if (sortState.column !== column) return null;
  if (sortState.direction === 'asc') return <ArrowUp className="w-3.5 h-3.5 ml-1 inline" />;
  return <ArrowDown className="w-3.5 h-3.5 ml-1 inline" />;
}

function getStatusBadge(status: string) {
  const s = (status || '').toLowerCase();

  if (s.includes('conclu') || s.includes('sucesso')) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/30">
        <CheckCircle className="w-3 h-3 mr-1" />
        OK
      </Badge>
    );
  }
  if (s.includes('process')) {
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/30">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ...
      </Badge>
    );
  }
  if (s.includes('erro')) {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/30">
        <XCircle className="w-3 h-3 mr-1" />
        Erro
      </Badge>
    );
  }
  if (s.includes('pend')) {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  }
  return <Badge variant="outline">{status || '—'}</Badge>;
}

function UltimaGeracaoChip({ value }: { value: string }) {
  const date = parseUltimaGeracao(value);
  const relTime = formatRelativeTime(value);
  const overdue = isOverdue(value);
  const absoluteDate = date ? format(date, 'dd/MM/yyyy HH:mm') : 'Nunca gerado';

  let chipClasses = '';
  let icon: React.ReactNode = <Clock className="w-3 h-3" />;

  if (relTime === 'nunca') {
    chipClasses = 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700';
  } else if (overdue) {
    chipClasses = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800';
  } else {
    chipClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800';
    icon = <CheckCircle className="w-3 h-3" />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${chipClasses}`}
        >
          {icon}
          {relTime}
        </span>
      </TooltipTrigger>
      <TooltipContent>{absoluteDate}</TooltipContent>
    </Tooltip>
  );
}

export default function AutoReportTable({
  clientes,
  selectedClientes,
  onToggleCliente,
  onSelectAll,
  sortState,
  onSort,
  onGerarIndividual,
  isGenerating,
  isLoading,
  isError,
  onRetryLoad,
  totalClientes,
  periodStart,
  onClearAllFilters,
}: AutoReportTableProps) {
  if (isLoading) {
    return <AutoReportTableSkeleton rows={6} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-lg border border-dashed border-gray-200 dark:border-zinc-800">
        <CloudOff className="w-12 h-12 text-red-500/70" />
        <p className="text-lg font-semibold text-foreground">Erro ao carregar clientes</p>
        <p className="text-sm text-muted-foreground">Verifique a conexão e tente novamente.</p>
        <Button variant="outline" onClick={onRetryLoad}>
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (totalClientes === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-lg border border-dashed border-gray-200 dark:border-zinc-800">
        <FileWarning className="w-12 h-12 text-amber-500/70" />
        <p className="text-lg font-semibold text-foreground">Nenhum cliente configurado ainda</p>
        <p className="text-sm text-muted-foreground">
          Verifique se a planilha central está configurada com clientes ativos.
        </p>
      </div>
    );
  }

  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-lg border border-dashed border-gray-200 dark:border-zinc-800">
        <SearchX className="w-12 h-12 text-muted-foreground/50" />
        <p className="text-lg font-semibold text-foreground">
          Nenhum cliente bate com esses filtros
        </p>
        <Button variant="outline" onClick={onClearAllFilters}>
          Limpar filtros
        </Button>
      </div>
    );
  }

  const allVisibleIndexes = clientes.map((c) => c.rowIndex);
  const allSelected =
    allVisibleIndexes.length > 0 && allVisibleIndexes.every((idx) => selectedClientes.has(idx));
  const someSelected = !allSelected && allVisibleIndexes.some((idx) => selectedClientes.has(idx));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectAll([]);
    } else {
      onSelectAll(allVisibleIndexes);
    }
  };

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/30">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: 40 }}>
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as unknown as HTMLButtonElement).dataset.state = someSelected
                        ? 'indeterminate'
                        : allSelected
                          ? 'checked'
                          : 'unchecked';
                    }
                  }}
                  onCheckedChange={handleSelectAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => onSort('nome')}
              >
                Nome
                <SortIcon column="nome" sortState={sortState} />
              </TableHead>
              <TableHead
                className="hidden md:table-cell cursor-pointer hover:text-foreground"
                style={{ width: 120 }}
                onClick={() => onSort('gestor')}
              >
                Gestor
                <SortIcon column="gestor" sortState={sortState} />
              </TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer hover:text-foreground"
                style={{ width: 100 }}
                onClick={() => onSort('squad')}
              >
                Squad
                <SortIcon column="squad" sortState={sortState} />
              </TableHead>
              <TableHead className="hidden md:table-cell" style={{ width: 160 }}>
                Plataformas
              </TableHead>
              <TableHead
                className="hidden md:table-cell cursor-pointer hover:text-foreground"
                style={{ width: 140 }}
                onClick={() => onSort('ultimaGeracao')}
              >
                Última Geração
                <SortIcon column="ultimaGeracao" sortState={sortState} />
              </TableHead>
              <TableHead style={{ width: 100 }}>Status</TableHead>
              <TableHead style={{ width: 100 }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((cliente) => {
              const isSelected = selectedClientes.has(cliente.rowIndex);
              const kind = clientStatusKind(cliente, periodStart);
              const tokens = STATUS_CLASSES[kind];
              const borderClass = isSelected
                ? `border-l-[5px] ${tokens.borderLeftSelected}`
                : `border-l-[3px] ${tokens.borderLeft}`;

              return (
                <TableRow
                  key={cliente.rowIndex}
                  className={`group cursor-pointer ${borderClass} ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
                  }`}
                  onClick={() => onToggleCliente(cliente.rowIndex)}
                >
                  <TableCell className="py-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleCliente(cliente.rowIndex)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Selecionar ${cliente.cliente}`}
                    />
                  </TableCell>

                  <TableCell className="py-4">
                    <div>
                      <span className="text-base font-semibold text-foreground">
                        {cliente.cliente}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          variant={getCategoriaBadgeVariant(cliente.categoria)}
                          className="text-[10px]"
                        >
                          {getCategoriaLabel(cliente.categoria)}
                        </Badge>
                        {cliente.gerar && (
                          <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                            Auto
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell py-4">
                    <span className="text-sm text-muted-foreground truncate max-w-[120px] block">
                      {cliente.gestor || '—'}
                    </span>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell py-4">
                    <span className="text-sm text-muted-foreground">
                      {cliente.squad || '—'}
                    </span>
                  </TableCell>

                  <TableCell className="hidden md:table-cell py-4">
                    <div className="flex items-center gap-1">
                      <PlatformChip platform="GA4" configured={!!cliente.idGa4} id={cliente.idGa4} />
                      <PlatformChip platform="Ads" configured={!!cliente.idGoogleAds} id={cliente.idGoogleAds} />
                      <PlatformChip platform="Meta" configured={!!cliente.idMetaAds} id={cliente.idMetaAds} />
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell py-4">
                    <UltimaGeracaoChip value={cliente.ultimaGeracao} />
                  </TableCell>

                  <TableCell className="py-4">{getStatusBadge(cliente.status)}</TableCell>

                  <TableCell className="py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      disabled={isGenerating}
                      onClick={(e) => {
                        e.stopPropagation();
                        onGerarIndividual(cliente);
                      }}
                      data-testid={`button-gerar-${cliente.rowIndex}`}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Gerar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Atualizar `AutoReport.tsx`** para passar as 2 novas props (`periodStart`, `onClearAllFilters`)

Editar `client/src/pages/AutoReport.tsx`. Localizar o bloco `<AutoReportTable ... />` e substituir por:

```tsx
<AutoReportTable
  clientes={clientesSorted}
  selectedClientes={selectedClientes}
  onToggleCliente={toggleCliente}
  onSelectAll={handleSelectAll}
  sortState={sortState}
  onSort={handleSort}
  onGerarIndividual={(c) => gerarRelatorioMutation.mutate(c)}
  isGenerating={gerarRelatorioMutation.isPending}
  isLoading={isLoading}
  isError={isError}
  onRetryLoad={() => refetchClientes()}
  totalClientes={clientesValidos.length}
  periodStart={dateRange?.from}
  onClearAllFilters={() => {
    setSearchTerm('');
    setFiltroGestor('todos');
    setFiltroSquad('todos');
    setActiveTab('todos');
  }}
/>
```

- [ ] **Step 3: Verificar build**

Run: `npx tsc --noEmit`

Expected: erro sobre `AutoReportTableSkeleton` (será criado na Task 5). Pode ignorar TEMPORARIAMENTE — vamos criar na próxima task.

**Para destravar este commit**, criar um stub mínimo do skeleton já neste passo:

Criar `client/src/pages/auto-report/AutoReportTableSkeleton.tsx` com este conteúdo provisório:

```tsx
// client/src/pages/auto-report/AutoReportTableSkeleton.tsx (stub - rewritten in Task 5)
import { SkeletonTable } from '@/components/ui/skeleton';

interface AutoReportTableSkeletonProps {
  rows?: number;
}

export default function AutoReportTableSkeleton({ rows = 6 }: AutoReportTableSkeletonProps) {
  return <SkeletonTable rows={rows} />;
}
```

Run: `npx tsc --noEmit` novamente. Expected: zero erros.

- [ ] **Step 4: Verificação visual**

1. Recarregar `http://localhost:3000/growth/auto-report`.
2. Cada linha agora tem:
   - **Barra colorida lateral à esquerda** (âmbar/verde/vermelho/cinza) refletindo status
   - Nome do cliente em destaque maior
   - Plataformas como **chips coloridos** (GA4 laranja, Ads azul, Meta indigo) — desconfigurados aparecem com borda tracejada apagada
   - Última geração como **chip com ícone**
   - Botão "Gerar" sempre visível (não só no hover)
3. Selecionar uma linha (clicar no checkbox) → barra lateral engrossa.
4. Hover sobre uma linha → fundo muda sutilmente.
5. **Dark mode**: todos os chips e barras laterais permanecem visíveis e legíveis.
6. Estados vazios (testar): desativar conexão de internet, dar refresh → ver tela de erro com `CloudOff`.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/auto-report/AutoReportTable.tsx \
        client/src/pages/auto-report/AutoReportTableSkeleton.tsx \
        client/src/pages/AutoReport.tsx
git commit -m "feat(autoreport): redesign table rows with status side bars and platform chips

Each row now has a colored left border (amber/emerald/red/gray) reflecting
status, taller padding (py-4), bigger client name (text-base font-semibold),
PlatformChip component replacing dots, UltimaGeracaoChip with semantic
colors, and an always-visible 'Gerar' button. Empty/error states polished
with FileWarning/SearchX/CloudOff icons.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `AutoReportTableSkeleton` definitivo

**Files:**
- Modify: `client/src/pages/auto-report/AutoReportTableSkeleton.tsx` (rewrite stub)

- [ ] **Step 1: Reescrever o skeleton com novo layout**

Substituir o conteúdo de `client/src/pages/auto-report/AutoReportTableSkeleton.tsx` por:

```tsx
// client/src/pages/auto-report/AutoReportTableSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

interface AutoReportTableSkeletonProps {
  rows?: number;
}

export default function AutoReportTableSkeleton({ rows = 6 }: AutoReportTableSkeletonProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/30">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-muted/30">
        <Skeleton className="w-4 h-4" />
        <Skeleton className="w-32 h-4" />
        <Skeleton className="hidden md:block w-20 h-4 ml-auto" />
        <Skeleton className="hidden md:block w-32 h-4" />
        <Skeleton className="hidden md:block w-28 h-4" />
        <Skeleton className="w-20 h-4" />
      </div>
      {/* Rows skeleton */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-4 border-l-[3px] border-l-gray-200 dark:border-l-zinc-800 border-b border-b-gray-100 dark:border-b-zinc-900 last:border-b-0"
        >
          <Skeleton className="w-4 h-4" />
          <div className="space-y-2">
            <Skeleton className="w-40 h-4" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-10 h-4" />
            </div>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-4">
            <Skeleton className="w-20 h-3" />
            <div className="flex items-center gap-1">
              <Skeleton className="w-10 h-5 rounded-md" />
              <Skeleton className="w-10 h-5 rounded-md" />
              <Skeleton className="w-10 h-5 rounded-md" />
            </div>
            <Skeleton className="w-24 h-5 rounded-md" />
          </div>
          <Skeleton className="w-16 h-5 rounded-md" />
          <Skeleton className="w-16 h-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npx tsc --noEmit`

Expected: zero erros.

- [ ] **Step 3: Verificação visual**

1. Para forçar o estado de loading, abrir DevTools → Network → throttle para "Slow 3G". Recarregar `/growth/auto-report`.
2. Durante o loading, ver o skeleton com:
   - Barras laterais cinzas (mesmo formato das linhas reais)
   - Placeholders de chips de plataforma
   - Padding alto (py-4)
3. Voltar throttle pra "No throttling".

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/auto-report/AutoReportTableSkeleton.tsx
git commit -m "feat(autoreport): polish loading skeleton to match new row layout

Skeleton now mirrors the new table row anatomy (left border, py-4 padding,
platform chip placeholders) so the loading state feels continuous with
the loaded state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Refatorar `AutoReportActionBar` (polish + Copiar todos os links)

**Files:**
- Modify: `client/src/pages/auto-report/AutoReportActionBar.tsx` (rewrite)
- Modify: `client/src/pages/AutoReport.tsx` (passar `jobs` para ActionBar)

- [ ] **Step 1: Reescrever `AutoReportActionBar.tsx`**

Substituir o conteúdo COMPLETO de `client/src/pages/auto-report/AutoReportActionBar.tsx` por:

```tsx
// client/src/pages/auto-report/AutoReportActionBar.tsx
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  Play,
  Presentation,
  FileText,
  Clipboard,
  X,
} from 'lucide-react';
import type { OutputFormat, AutoReportJob } from './types';

interface AutoReportActionBarProps {
  selectedCount: number;
  onSelectPendentes: () => void;
  onClearSelection: () => void;
  onGerar: () => void;
  isGenerating: boolean;
  batchTotal: number;
  batchCompleted: number;
  batchErrors: number;
  batchDone: boolean;
  onVerDetalhes: () => void;
  onDismiss: () => void;
  outputFormat: OutputFormat;
  // NEW: needed for "Copiar todos os links"
  jobs: AutoReportJob[];
  batchClientNames: string[];
}

export default function AutoReportActionBar({
  selectedCount,
  onSelectPendentes,
  onClearSelection,
  onGerar,
  isGenerating,
  batchTotal,
  batchCompleted,
  batchErrors,
  batchDone,
  onVerDetalhes,
  onDismiss,
  outputFormat,
  jobs,
  batchClientNames,
}: AutoReportActionBarProps) {
  const { toast } = useToast();
  const isVisible = selectedCount > 0 || isGenerating || batchDone;

  const progressPercent =
    batchTotal > 0 ? Math.round(((batchCompleted + batchErrors) / batchTotal) * 100) : 0;

  const remaining = batchTotal - batchCompleted - batchErrors;

  const handleCopyAllLinks = async () => {
    const completedJobs = jobs.filter(
      (j) =>
        batchClientNames.includes(j.clienteNome) &&
        j.status === 'concluido' &&
        j.presentationUrl,
    );

    if (completedJobs.length === 0) {
      toast({
        title: 'Nenhum link disponível',
        description: 'Os links aparecem após a conclusão dos relatórios.',
        variant: 'destructive',
      });
      return;
    }

    const text = completedJobs
      .map((j) => `${j.clienteNome} — ${j.presentationUrl}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${completedJobs.length} links copiados`,
        description: 'Cole no WhatsApp ou e-mail.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao copiar',
        description: 'Tente abrir os jobs e copiar individualmente.',
        variant: 'destructive',
      });
    }
  };

  const completedWithUrlCount = jobs.filter(
    (j) =>
      batchClientNames.includes(j.clienteNome) &&
      j.status === 'concluido' &&
      j.presentationUrl,
  ).length;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-200 dark:border-zinc-800 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 ease-in-out ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* State 1: Selection */}
        {!isGenerating && !batchDone && selectedCount > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>{selectedCount} selecionados</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onSelectPendentes}>
                Selecionar Pendentes
              </Button>
              <Button variant="ghost" size="sm" onClick={onClearSelection}>
                Limpar
              </Button>
            </div>
            <Button size="lg" onClick={onGerar} className="gap-2">
              <Play className="w-4 h-4" />
              {outputFormat === 'slides' ? (
                <>
                  <Presentation className="w-4 h-4" />
                  Gerar {selectedCount} Slides
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Gerar {selectedCount} PDFs
                </>
              )}
            </Button>
          </div>
        )}

        {/* State 2: Progress */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                Gerando {batchTotal} relatórios
              </span>
              <span className="text-muted-foreground">
                {batchCompleted}/{batchTotal} concluídos
                {batchErrors > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {' · '}
                    {batchErrors} erros
                  </span>
                )}
                {remaining > 0 && <span> · {remaining} restam</span>}
              </span>
            </div>
            <div className="h-2.5 bg-gray-200 dark:bg-zinc-800 rounded-full w-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* State 3: Completion */}
        {batchDone && !isGenerating && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>
                {batchCompleted} relatórios gerados
                {batchErrors > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {' · '}
                    {batchErrors} com erro
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleCopyAllLinks}
                disabled={completedWithUrlCount === 0}
                data-testid="button-copy-all-links"
              >
                <Clipboard className="w-4 h-4 mr-2" />
                Copiar todos os links ({completedWithUrlCount})
              </Button>
              <Button variant="outline" size="sm" onClick={onVerDetalhes}>
                Ver Detalhes
              </Button>
              <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Fechar">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Atualizar `AutoReport.tsx`** para passar `jobs` e `batchClientNames`

Editar `client/src/pages/AutoReport.tsx`. Localizar `<AutoReportActionBar ... />` e substituir por:

```tsx
<AutoReportActionBar
  selectedCount={selectedClientes.size}
  onSelectPendentes={handleSelectPendentes}
  onClearSelection={() => setSelectedClientes(new Set())}
  onGerar={handleGerarLote}
  isGenerating={gerarLoteMutation.isPending}
  batchTotal={batchClientNames.length}
  batchCompleted={batchProgress.completed}
  batchErrors={batchProgress.errors}
  batchDone={batchDone}
  onVerDetalhes={() => setJobsDrawerOpen(true)}
  onDismiss={handleDismissBatch}
  outputFormat={outputFormat}
  jobs={jobs}
  batchClientNames={batchClientNames}
/>
```

- [ ] **Step 3: Verificar build**

Run: `npx tsc --noEmit`

Expected: zero erros.

- [ ] **Step 4: Verificação visual**

1. Recarregar `/growth/auto-report`.
2. Selecionar 2 clientes → action bar aparece com:
   - Backdrop blur (efeito de "vidro" sob o conteúdo)
   - Ícone CheckCircle verde + texto "2 selecionados"
   - Botão grande "Gerar 2 Slides" à direita
3. Clicar "Gerar" → ver barra de progresso com gradient âmbar→verde, contagem em tempo real.
4. Após concluir → ver "Copiar todos os links (X)" + "Ver Detalhes" + X.
5. Clicar "Copiar todos os links" → toast "X links copiados" e os links no clipboard formatados como `Cliente — URL` por linha. Colar em um editor de texto pra confirmar formato.
6. **Dark mode**: validar que action bar continua legível e o backdrop blur funciona.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/auto-report/AutoReportActionBar.tsx \
        client/src/pages/AutoReport.tsx
git commit -m "feat(autoreport): polish action bar and add 'Copiar todos os links' CTA

Action bar gets backdrop blur, larger primary CTA with dynamic count
('Gerar X Slides'), refined progress gradient. Completion state adds a
new primary 'Copiar todos os links' button that copies all generated
Slides URLs to clipboard formatted as 'Cliente — URL' per line.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Refatorar `AutoReportJobsDrawer` (Copy Link primary + agrupamento + filtros temporais)

**Files:**
- Modify: `client/src/pages/auto-report/AutoReportJobsDrawer.tsx` (rewrite)

- [ ] **Step 1: Reescrever o drawer**

Substituir o conteúdo COMPLETO de `client/src/pages/auto-report/AutoReportJobsDrawer.tsx` por:

```tsx
// client/src/pages/auto-report/AutoReportJobsDrawer.tsx
import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  Loader2,
  XCircle,
  Clock,
  FileText,
  Presentation,
  Inbox,
  Clipboard,
  ExternalLink,
  Download,
} from 'lucide-react';
import {
  isToday,
  isYesterday,
  isThisWeek,
  formatDistanceToNow,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AutoReportJob } from './types';

type TimeFilter = 'hoje' | 'semana' | 'tudo';

interface AutoReportJobsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: AutoReportJob[];
  onRetryJob: (clienteNome: string) => void;
}

function getStatusBorderClass(status: AutoReportJob['status']): string {
  switch (status) {
    case 'concluido':
      return 'border-l-emerald-500';
    case 'processando':
      return 'border-l-amber-500';
    case 'erro':
      return 'border-l-red-500';
    case 'pendente':
    default:
      return 'border-l-gray-300 dark:border-l-zinc-700';
  }
}

function getStatusIcon(status: AutoReportJob['status']) {
  switch (status) {
    case 'concluido':
      return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
    case 'processando':
      return <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />;
    case 'erro':
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'pendente':
    default:
      return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
  }
}

function groupJobsByDay(jobs: AutoReportJob[]): {
  hoje: AutoReportJob[];
  ontem: AutoReportJob[];
  semana: AutoReportJob[];
  antigos: AutoReportJob[];
} {
  const groups = { hoje: [] as AutoReportJob[], ontem: [] as AutoReportJob[], semana: [] as AutoReportJob[], antigos: [] as AutoReportJob[] };
  jobs.forEach((job) => {
    const date = new Date(job.criadoEm);
    if (isToday(date)) groups.hoje.push(job);
    else if (isYesterday(date)) groups.ontem.push(job);
    else if (isThisWeek(date, { weekStartsOn: 1 })) groups.semana.push(job);
    else groups.antigos.push(job);
  });
  return groups;
}

function applyTimeFilter(jobs: AutoReportJob[], filter: TimeFilter): AutoReportJob[] {
  if (filter === 'tudo') return jobs;
  return jobs.filter((j) => {
    const date = new Date(j.criadoEm);
    if (filter === 'hoje') return isToday(date);
    if (filter === 'semana') return isThisWeek(date, { weekStartsOn: 1 });
    return true;
  });
}

interface JobCardProps {
  job: AutoReportJob;
  onRetryJob: (clienteNome: string) => void;
  onCopyLink: (url: string, clienteNome: string) => void;
}

function JobCard({ job, onRetryJob, onCopyLink }: JobCardProps) {
  const borderClass = getStatusBorderClass(job.status);
  const date = new Date(job.criadoEm);
  const relTime = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  const isPptx = job.fileName?.endsWith('.pptx');
  const pulseClass = job.status === 'processando' ? 'animate-pulse' : '';

  return (
    <div
      className={`p-3 rounded-r-lg bg-muted/30 dark:bg-zinc-900/40 border-l-[3px] ${borderClass} ${pulseClass}`}
      data-testid={`job-${job.id}`}
    >
      {/* Top row: icon + name + time */}
      <div className="flex items-center gap-2 mb-1">
        {getStatusIcon(job.status)}
        <span className="font-semibold text-sm truncate flex-1">{job.clienteNome}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{relTime}</span>
      </div>

      {/* Categoria below name */}
      {job.categoria && (
        <p className="text-xs text-muted-foreground mb-2 ml-6 capitalize">
          {job.categoria.replace(/_/g, ' ')}
        </p>
      )}

      {/* Concluido (Slides) — primary "Copiar Link" + secondary "Abrir" */}
      {job.status === 'concluido' && job.presentationUrl && !isPptx && (
        <div className="flex items-center gap-2 ml-6">
          <Button
            size="sm"
            onClick={() => onCopyLink(job.presentationUrl!, job.clienteNome)}
            className="gap-1.5"
            data-testid={`btn-copy-${job.id}`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            Copiar Link
          </Button>
          <a
            href={job.presentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Abrir Slides
          </a>
        </div>
      )}

      {/* Concluido (PDF) — primary "Baixar PDF" */}
      {job.status === 'concluido' && job.downloadUrl && isPptx === false && !job.presentationUrl && (
        <div className="ml-6">
          <Button asChild size="sm" className="gap-1.5">
            <a href={job.downloadUrl} download={job.fileName}>
              <Download className="w-3.5 h-3.5" />
              Baixar PDF
            </a>
          </Button>
        </div>
      )}

      {/* Concluido (PPTX) — Baixar PPTX */}
      {job.status === 'concluido' && isPptx && job.downloadUrl && (
        <div className="ml-6">
          <Button asChild size="sm" className="gap-1.5">
            <a href={job.downloadUrl} download={job.fileName}>
              <Presentation className="w-3.5 h-3.5" />
              Baixar PPTX
            </a>
          </Button>
        </div>
      )}

      {/* Erro */}
      {job.status === 'erro' && (
        <div className="ml-6 space-y-2">
          {job.mensagem && (
            <p className="text-xs text-red-600 dark:text-red-400">{job.mensagem}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetryJob(job.clienteNome)}
            data-testid={`btn-retry-${job.id}`}
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Processando */}
      {job.status === 'processando' && (
        <p className="text-xs text-muted-foreground ml-6">Processando...</p>
      )}
    </div>
  );
}

export default function AutoReportJobsDrawer({
  open,
  onOpenChange,
  jobs,
  onRetryJob,
}: AutoReportJobsDrawerProps) {
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('hoje');

  const filteredJobs = useMemo(() => applyTimeFilter(jobs, timeFilter), [jobs, timeFilter]);
  const grouped = useMemo(() => groupJobsByDay(filteredJobs), [filteredJobs]);
  const todayCount = useMemo(() => jobs.filter((j) => isToday(new Date(j.criadoEm))).length, [jobs]);

  const handleCopyLink = async (url: string, clienteNome: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copiado',
        description: `${clienteNome} — pronto para colar.`,
      });
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Selecione e copie manualmente.',
        variant: 'destructive',
      });
    }
  };

  const renderGroup = (label: string, jobsInGroup: AutoReportJob[]) => {
    if (jobsInGroup.length === 0) return null;
    return (
      <div key={label} className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-1 sticky top-0 bg-background">
          {label}
        </h3>
        {jobsInGroup
          .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
          .map((job) => (
            <JobCard key={job.id} job={job} onRetryJob={onRetryJob} onCopyLink={handleCopyLink} />
          ))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[440px] sm:w-[440px]" side="right">
        <SheetHeader>
          <SheetTitle className="text-lg">Jobs Recentes</SheetTitle>
          <SheetDescription>
            {todayCount} {todayCount === 1 ? 'job' : 'jobs'} hoje
          </SheetDescription>
        </SheetHeader>

        {/* Time filter chips */}
        <div className="flex items-center gap-2 mt-4 pb-3 border-b border-gray-200 dark:border-zinc-800">
          {(['hoje', 'semana', 'tudo'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={timeFilter === f ? 'default' : 'outline'}
              onClick={() => setTimeFilter(f)}
              data-testid={`time-filter-${f}`}
            >
              {f === 'hoje' ? 'Hoje' : f === 'semana' ? 'Esta semana' : 'Tudo'}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-[calc(100vh-200px)] mt-4">
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Inbox className="w-12 h-12 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Nenhum relatório nessa janela
              </p>
              <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                Selecione clientes na tabela e clique em Gerar.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pr-3">
              {renderGroup('Hoje', grouped.hoje)}
              {renderGroup('Ontem', grouped.ontem)}
              {renderGroup('Esta semana', grouped.semana)}
              {renderGroup('Mais antigos', grouped.antigos)}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npx tsc --noEmit`

Expected: zero erros.

- [ ] **Step 3: Verificação visual**

1. Recarregar `/growth/auto-report`.
2. Clicar em "Ver Jobs" no canto superior direito → drawer abre na lateral direita (440px de largura).
3. Header mostra "Jobs Recentes" + "X jobs hoje".
4. 3 chips de filtro temporal: Hoje (ativo) / Esta semana / Tudo.
5. Jobs agrupados por dia (Hoje, Ontem, Esta semana, Mais antigos).
6. Cada job tem barra lateral colorida (verde concluído, âmbar processando, vermelho erro).
7. Para um job concluído com Slides: ver botão primário "Copiar Link" + link "Abrir Slides".
8. Clicar "Copiar Link" → toast "Link copiado: {cliente} — pronto para colar."
9. Trocar filtro pra "Tudo" → ver mais jobs antigos (grupo "Mais antigos").
10. **Dark mode**: validar legibilidade.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/auto-report/AutoReportJobsDrawer.tsx
git commit -m "feat(autoreport): redesign jobs drawer with copy-link primary CTA and time grouping

Job cards now have status side bars (matching table rows), grouping by
day (Hoje/Ontem/Esta semana/Mais antigos), and time filters (Hoje/Esta
semana/Tudo). Slides jobs show 'Copiar Link' as the primary action with
'Abrir Slides' as secondary, matching the user's WhatsApp delivery flow.
Drawer width grew from 400 to 440px.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Verificação final + sweep responsivo + dark mode

**Files:** nenhum (apenas verificação manual e ajustes pontuais).

- [ ] **Step 1: Sweep light mode (workflow completo)**

1. Recarregar `/growth/auto-report` em light mode.
2. **Hero**: ver título + subtítulo do período + 3 KPIs lado a lado + barra de progresso. KPIs com números coloridos.
3. **KPIs clicáveis**:
   - Clicar Pendentes → tabela filtra, KPI fica ativo (fundo âmbar discreto), chip "Filtrando: Pendentes" aparece nos filtros.
   - Clicar de novo no mesmo KPI → desativa, volta a "todos".
   - Clicar X do chip → idem.
4. **Filtros**: digitar busca, mudar gestor, mudar squad. Tabela filtra.
5. **Tabela**:
   - Cada linha com barra colorida lateral (status).
   - Plataformas como chips coloridos (preenchido = configurado).
   - Última geração como chip semântico.
   - Botão "Gerar" sempre visível.
   - Hover muda o fundo sutilmente.
   - Selecionar linha → barra engrossa, fundo primary/10.
6. **Action bar (seleção)**: backdrop blur + CTA grande "Gerar X Slides".
7. **Action bar (progress)**: barra gradient âmbar→verde, contagem em tempo real.
8. **Action bar (completion)**: "Copiar todos os links (X)" + Ver Detalhes + X.
9. **Drawer**: agrupamento por dia, chip filters, "Copiar Link" primário.

- [ ] **Step 2: Sweep dark mode**

Toggle dark mode (header ou setting). Repetir todas as 9 etapas acima. Anotar qualquer cor que estoure ou desapareça.

**Pontos de atenção comuns:**
- Hero card: fundo deve ter contraste com o body.
- KPIs ativos: o fundo `bg-amber-950/30` deve ser visível mas não estourar.
- Chips de plataforma desconfigurados: borda tracejada deve ser visível.
- Side bars das linhas: cores 500 funcionam em ambos os modos.
- Action bar backdrop blur: validar que o efeito acontece em dark.

Se encontrar algum problema visual: ajustar inline o token afetado em `tokens.ts` e revalidar.

- [ ] **Step 3: Sweep responsivo**

Abrir DevTools, alternar viewport para:

1. **Tablet (768px)**: coluna Squad some. Plataformas e Gestor permanecem.
2. **Mobile (375px)**: coluna Gestor/Squad/Plataformas/Última Geração somem. Apenas Nome + Status visíveis. Hero KPIs em 3 colunas comprimidas (números menores podem ser ajustados aqui se quebrarem).
3. **Action bar mobile**: CTAs empilham (`flex-wrap` já no JSX). Validar que não há overflow horizontal.
4. **Drawer mobile**: ocupa 100% da tela (default Sheet).

Se hero KPIs estourarem em mobile, ajustar inline o `text-3xl` para `text-xl sm:text-3xl` em `KpiCard`.

- [ ] **Step 4: Workflow end-to-end real**

1. Selecionar 3 clientes pendentes.
2. Clicar "Gerar 3 Slides".
3. Aguardar geração concluir (pode demorar segundos a minutos).
4. Clicar "Copiar todos os links" → colar em um editor → confirmar formato `Cliente — URL`.
5. Abrir drawer → encontrar um dos jobs gerados → clicar "Copiar Link" → confirmar toast.

- [ ] **Step 5: Commit final (se houver ajustes)**

Se Step 2 ou Step 3 exigiu mudanças:

```bash
git add client/src/pages/auto-report/
git commit -m "fix(autoreport): polish dark mode and responsive edge cases

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Caso contrário, pular o commit.

- [ ] **Step 6: Push**

```bash
git push -u origin feature/autoreport-visual-redesign
```

- [ ] **Step 7: Confirmar para o usuário**

Reportar:
- Branch criada e pushed.
- 9 commits granulares (1 por task + ajuste opcional).
- Verificação manual em light/dark mode + responsivo concluída.
- Workflow end-to-end testado com geração real.

---

## Self-Review (auditoria pós-escrita do plano)

**Spec coverage:**
- Seção 1 (Hero header) → Task 3 ✓
- Seção 2 (Filtros consolidados) → Task 3 ✓
- Seção 3 (Tabela status-first) → Task 4 ✓
- Seção 4 (Action Bar) → Task 6 ✓
- Seção 5 (Drawer) → Task 7 ✓
- Seção 6a (Toolbar mergeada) → Task 3 ✓
- Seção 6b (tokens.ts) → Task 1 ✓
- Seção 6c (estados vazios) → Task 4 (incluído na rewrite da Table) ✓
- Seção 6d (dark mode) → Task 8 ✓
- Seção 6e (responsivo) → Task 8 ✓

**Placeholder scan:** sem TBD, TODO, "implement later". Cada step tem código completo ou comando exato.

**Type consistency:**
- `STATUS_CLASSES`, `PLATFORM_CLASSES`, `clientStatusKind` definidos em Task 1, usados em Tasks 2, 3, 4 ✓
- `tabCounts`, `activeTab`, `onTabChange` na Toolbar (Task 3); orchestrator passa em Task 3 ✓
- `jobs`, `batchClientNames` na ActionBar (Task 6); orchestrator passa em Task 6 ✓
- `periodStart`, `onClearAllFilters` na Table (Task 4); orchestrator passa em Task 4 ✓
- `AutoReportTableSkeleton` criado em Task 4 (stub) e refeito em Task 5 ✓

**Conhecida:** o stub na Task 4 Step 3 é necessário porque o `AutoReportTable.tsx` (rewrite na Task 4) já importa `AutoReportTableSkeleton`. O stub destrava o build até a Task 5 fazer o skeleton final. Essa transição está explícita no plano.

Plano revisado e fechado.
