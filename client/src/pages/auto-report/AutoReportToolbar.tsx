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
import { STATUS_CLASSES, type StatusKind } from './tokens';

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
  tabCounts: Record<StatusTab, number>;
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
}

interface KpiCardProps {
  label: string;
  count: number;
  kind: Exclude<StatusKind, 'inativo'>;
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

  const periodSubtitle = dateRange?.from && dateRange?.to
    ? `Semana de ${format(dateRange.from, 'dd/MMM', { locale: ptBR })} a ${format(dateRange.to, 'dd/MMM', { locale: ptBR })}`
    : 'Selecione um período';

  const totalKpi = tabCounts.pendentes + tabCounts.gerados + tabCounts.com_erro;
  const progressPct = totalKpi > 0 ? Math.round((tabCounts.gerados / totalKpi) * 100) : 0;

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
