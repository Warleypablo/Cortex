import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  ArrowUp,
  ArrowDown,
  FileText,
  XCircle,
  CheckCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import type { AutoReportCliente, SortState, SortColumn } from "./types";
import { formatRelativeTime, isOverdue, parseUltimaGeracao, getCategoriaLabel, getCategoriaBadgeVariant } from "./utils";

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
      <Badge className="bg-green-600 hover:bg-green-600 text-white border-transparent">
        <CheckCircle className="w-3 h-3 mr-1" />
        OK
      </Badge>
    );
  }
  if (s.includes('process')) {
    return (
      <Badge variant="secondary">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ...
      </Badge>
    );
  }
  if (s.includes('erro')) {
    return (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        Erro
      </Badge>
    );
  }
  if (s.includes('pend')) {
    return (
      <Badge variant="outline">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      {status || '\u2014'}
    </Badge>
  );
}

function PlatformDot({
  configured,
  label,
  id,
}: {
  configured: boolean;
  label: string;
  id: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`w-2.5 h-2.5 rounded-full inline-block ${
            configured ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-600'
          }`}
        />
      </TooltipTrigger>
      <TooltipContent>
        {configured ? `${label}: Configurado (ID: ${id})` : `${label}: Nao configurado`}
      </TooltipContent>
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
}: AutoReportTableProps) {
  // Loading state
  if (isLoading) {
    return <SkeletonTable rows={6} />;
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <XCircle className="w-12 h-12 text-red-500" />
        <p className="text-lg font-medium text-foreground">Erro ao carregar clientes</p>
        <Button variant="outline" onClick={onRetryLoad}>
          Tentar Novamente
        </Button>
      </div>
    );
  }

  // Empty state: no clients in spreadsheet at all
  if (totalClientes === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <p className="text-lg font-medium text-foreground">Nenhum cliente encontrado na planilha central.</p>
        <p className="text-sm text-muted-foreground">Verifique se a planilha esta configurada.</p>
      </div>
    );
  }

  // Empty state: filters yielded no results
  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Search className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">Nenhum cliente corresponde aos filtros aplicados.</p>
      </div>
    );
  }

  const allVisibleIndexes = clientes.map((c) => c.rowIndex);
  const allSelected = allVisibleIndexes.length > 0 && allVisibleIndexes.every((idx) => selectedClientes.has(idx));
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: 40 }}>
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as unknown as HTMLButtonElement).dataset.state = someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked';
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
            <TableHead
              className="hidden md:table-cell"
              style={{ width: 100 }}
            >
              Plataformas
            </TableHead>
            <TableHead
              className="hidden md:table-cell cursor-pointer hover:text-foreground"
              style={{ width: 120 }}
              onClick={() => onSort('ultimaGeracao')}
            >
              Ultima Geracao
              <SortIcon column="ultimaGeracao" sortState={sortState} />
            </TableHead>
            <TableHead style={{ width: 80 }}>
              Status
            </TableHead>
            <TableHead style={{ width: 40 }} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => {
            const isSelected = selectedClientes.has(cliente.rowIndex);
            const relTime = formatRelativeTime(cliente.ultimaGeracao);
            const overdue = isOverdue(cliente.ultimaGeracao);
            const parsedDate = parseUltimaGeracao(cliente.ultimaGeracao);
            const absoluteDate = parsedDate ? format(parsedDate, 'dd/MM/yyyy HH:mm') : 'Nunca gerado';

            return (
              <TableRow
                key={cliente.rowIndex}
                className={`group cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
                onClick={() => onToggleCliente(cliente.rowIndex)}
              >
                {/* Checkbox */}
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleCliente(cliente.rowIndex)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Selecionar ${cliente.cliente}`}
                  />
                </TableCell>

                {/* Nome */}
                <TableCell>
                  <div>
                    <span className="font-medium">{cliente.cliente}</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge
                        variant={getCategoriaBadgeVariant(cliente.categoria)}
                        className="text-xs"
                      >
                        {getCategoriaLabel(cliente.categoria)}
                      </Badge>
                      {cliente.gerar && (
                        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                          Auto
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Gestor */}
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground truncate max-w-[120px] block">
                    {cliente.gestor || '\u2014'}
                  </span>
                </TableCell>

                {/* Squad */}
                <TableCell className="hidden lg:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {cliente.squad || '\u2014'}
                  </span>
                </TableCell>

                {/* Plataformas */}
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-1.5">
                    <PlatformDot
                      configured={!!cliente.idGa4}
                      label="GA4"
                      id={cliente.idGa4}
                    />
                    <PlatformDot
                      configured={!!cliente.idGoogleAds}
                      label="Google Ads"
                      id={cliente.idGoogleAds}
                    />
                    <PlatformDot
                      configured={!!cliente.idMetaAds}
                      label="Meta Ads"
                      id={cliente.idMetaAds}
                    />
                  </div>
                </TableCell>

                {/* Ultima Geracao */}
                <TableCell className="hidden md:table-cell">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`text-sm ${
                          relTime === 'nunca'
                            ? 'text-muted-foreground'
                            : overdue
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-foreground'
                        }`}
                      >
                        {relTime}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{absoluteDate}</TooltipContent>
                  </Tooltip>
                </TableCell>

                {/* Status */}
                <TableCell>
                  {getStatusBadge(cliente.status)}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity md:opacity-0 sm:opacity-100 h-8 w-8"
                    disabled={isGenerating}
                    onClick={(e) => {
                      e.stopPropagation();
                      onGerarIndividual(cliente);
                    }}
                    title="Gerar relatorio"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
