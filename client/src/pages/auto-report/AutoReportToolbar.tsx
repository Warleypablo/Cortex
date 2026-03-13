import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, RefreshCw, ClipboardList, Presentation, FileText } from "lucide-react";
import { subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import type { OutputFormat, PageSelection } from "./types";
import { PAGE_OPTIONS } from "./types";
import { formatDateRange, getDefaultDateRange } from "./utils";

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auto Report</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Geracao automatica de relatorios semanais
            </p>
          </div>
          <div className="flex items-center gap-2">
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
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Date range + Format row */}
        <div className="flex items-center gap-3 flex-wrap">
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

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetRange('ultima_semana')}
              data-testid="button-preset-semana"
            >
              Ult. Semana
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetRange('7d')}
              data-testid="button-preset-7d"
            >
              7d
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetRange('14d')}
              data-testid="button-preset-14d"
            >
              14d
            </Button>
            <Button
              variant="outline"
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

        {/* Page selection (PDF only) - collapsible */}
        <div
          className="transition-all duration-200 overflow-hidden"
          style={{ maxHeight: outputFormat === 'pdf' ? '200px' : '0px' }}
        >
          <div className="pt-2 border-t border-gray-200 dark:border-zinc-700">
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
              Paginas do PDF ({selectedPagesCount} de 5):
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-zinc-800">
                <Checkbox checked disabled className="opacity-60" />
                <span className="text-xs text-gray-500 dark:text-zinc-400">Capa (obrigatoria)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-zinc-800">
                <Checkbox checked disabled className="opacity-60" />
                <span className="text-xs text-gray-500 dark:text-zinc-400">Resumo Executivo (obrigatoria)</span>
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
                    <div className="text-xs font-medium text-gray-900 dark:text-white">{page.label}</div>
                    <div className="text-[10px] text-gray-500 dark:text-zinc-400">{page.description}</div>
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
