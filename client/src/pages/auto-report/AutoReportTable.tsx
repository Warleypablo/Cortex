import type { ReactNode } from 'react';
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
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  ArrowUp,
  ArrowDown,
  Play,
  XCircle,
  CheckCircle,
  Clock,
  Loader2,
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
  let icon: ReactNode = <Clock className="w-3 h-3" />;

  if (relTime === 'nunca') {
    chipClasses =
      'bg-gray-100 text-gray-500 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700';
  } else if (overdue) {
    chipClasses =
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800';
  } else {
    chipClasses =
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800';
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
  );
}
