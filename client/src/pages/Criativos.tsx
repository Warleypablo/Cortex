import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, X, ArrowUpDown, TrendingUp, Rocket, ExternalLink, Loader2 } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CriativoData {
  id: string;
  adName: string;
  link: string;
  dataCriacao: string | null;
  status: string;
  investimento: number;
  impressions: number;
  frequency: number | null;
  videoHook: number | null;
  videoHold: number | null;
  ctr: number | null;
  cpm: number | null;
  leads: number;
  cpl: number | null;
  mql: number;
  percMql: number | null;
  cpmql: number | null;
  ra: number;
  percRa: number | null;
  cpra: number | null;
  percRaMql: number | null;
  percRrMql: number | null;
  rr: number;
  percRr: number | null;
  cprr: number | null;
  ganhosAceleracao: number | null;
  ganhosPontuais: number | null;
  cacAceleracao: number | null;
  leadTimeClienteUnico: number | null;
  clientesUnicos: number;
  percRrCliente: number | null;
  cacUnico: number | null;
}

type SortConfig = {
  key: keyof CriativoData;
  direction: 'asc' | 'desc';
};

const datePresets = [
  { label: 'Hoje', getRange: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Últimos 7 dias', getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Últimos 30 dias', getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Mês Atual', getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Mês Anterior', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Trimestre Atual', getRange: () => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }) },
  { label: 'Ano Atual', getRange: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${value}%`;
}

export default function Criativos() {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'investimento', direction: 'desc' });

  const { data: criativos = [], isLoading } = useQuery<CriativoData[]>({
    queryKey: ['/api/growth/criativos', format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd'), statusFilter],
    queryFn: async () => {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');
      const res = await fetch(`/api/growth/criativos?startDate=${startDate}&endDate=${endDate}&status=${statusFilter}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch criativos');
      return res.json();
    }
  });

  const filteredData = useMemo(() => {
    let result = [...criativos];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.adName.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term)
      );
    }
    
    result.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortConfig.direction === 'asc' 
        ? aStr.localeCompare(bStr) 
        : bStr.localeCompare(aStr);
    });
    
    return result;
  }, [criativos, searchTerm, sortConfig]);

  const handleSort = (key: keyof CriativoData) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const totals = useMemo(() => {
    return {
      investimento: filteredData.reduce((sum, item) => sum + (item.investimento || 0), 0),
      leads: filteredData.reduce((sum, item) => sum + (item.leads || 0), 0),
      mql: filteredData.reduce((sum, item) => sum + (item.mql || 0), 0),
      ra: filteredData.reduce((sum, item) => sum + (item.ra || 0), 0),
      rr: filteredData.reduce((sum, item) => sum + (item.rr || 0), 0),
      clientesUnicos: filteredData.reduce((sum, item) => sum + (item.clientesUnicos || 0), 0),
    };
  }, [filteredData]);

  const SortableHeader = ({ column, label }: { column: keyof CriativoData; label: string }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 whitespace-nowrap text-xs"
      onClick={() => handleSort(column)}
      data-testid={`header-${column}`}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </div>
    </TableHead>
  );

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Rocket className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Criativos</h1>
            <p className="text-sm text-muted-foreground">Performance de Anúncios Meta Ads</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar criativo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[200px]"
              data-testid="input-search"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchTerm("")}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px]" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="Ativo">Ativos</SelectItem>
              <SelectItem value="Pausado">Pausados</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-date-range">
                <CalendarIcon className="w-4 h-4" />
                {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })}
                {" - "}
                {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex">
                <div className="border-r p-2 space-y-1">
                  {datePresets.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => setDateRange(preset.getRange())}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  locale={ptBR}
                  numberOfMonths={2}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-4 p-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Investimento</p>
            <p className="text-xl font-bold">{formatCurrency(totals.investimento)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Leads</p>
            <p className="text-xl font-bold">{formatNumber(totals.leads)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">MQLs</p>
            <p className="text-xl font-bold">{formatNumber(totals.mql)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reuniões Marcadas</p>
            <p className="text-xl font-bold">{formatNumber(totals.ra)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reuniões Realizadas</p>
            <p className="text-xl font-bold">{formatNumber(totals.rr)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Clientes</p>
            <p className="text-xl font-bold">{formatNumber(totals.clientesUnicos)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 p-4 pt-0">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Performance por Criativo</CardTitle>
              <Badge variant="outline">{filteredData.length} criativos</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <SortableHeader column="id" label="AD ID" />
                      <SortableHeader column="adName" label="Criativo" />
                      <SortableHeader column="status" label="Status" />
                      <SortableHeader column="investimento" label="Invest." />
                      <SortableHeader column="impressions" label="Impr." />
                      <SortableHeader column="frequency" label="Freq." />
                      <SortableHeader column="videoHook" label="V. Hook" />
                      <SortableHeader column="videoHold" label="V. HOLD" />
                      <SortableHeader column="ctr" label="CTR" />
                      <SortableHeader column="cpm" label="CPM" />
                      <SortableHeader column="leads" label="Leads" />
                      <SortableHeader column="cpl" label="CPL" />
                      <SortableHeader column="mql" label="MQL" />
                      <SortableHeader column="percMql" label="% MQL" />
                      <SortableHeader column="cpmql" label="CPMQL" />
                      <SortableHeader column="ra" label="RA" />
                      <SortableHeader column="percRaMql" label="% RA MQL" />
                      <SortableHeader column="cpra" label="CPRA" />
                      <SortableHeader column="rr" label="RR" />
                      <SortableHeader column="percRrMql" label="% RR MQL" />
                      <SortableHeader column="cprr" label="CPRR" />
                      <SortableHeader column="clientesUnicos" label="Clientes" />
                      <SortableHeader column="cacUnico" label="CAC" />
                      <TableHead className="text-xs">Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item) => (
                      <TableRow key={item.id} data-testid={`row-criativo-${item.id}`}>
                        <TableCell className="font-mono text-xs text-muted-foreground" title={item.id}>
                          {item.id?.slice(-8) || '-'}
                        </TableCell>
                        <TableCell className="font-medium max-w-[250px] truncate" title={item.adName}>
                          {item.adName}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={item.status === 'Ativo' ? 'default' : 'secondary'}
                            className={item.status === 'Ativo' ? 'bg-green-500' : ''}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.investimento)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.impressions)}</TableCell>
                        <TableCell className="text-right">{item.frequency !== null ? item.frequency.toFixed(2) : '-'}</TableCell>
                        <TableCell className="text-right">{formatPercent(item.videoHook)}</TableCell>
                        <TableCell className="text-right">{formatPercent(item.videoHold)}</TableCell>
                        <TableCell className="text-right">{item.ctr !== null ? `${item.ctr}%` : '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cpm)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.leads)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cpl)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.mql)}</TableCell>
                        <TableCell className="text-right">{formatPercent(item.percMql)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cpmql)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.ra)}</TableCell>
                        <TableCell className="text-right">{formatPercent(item.percRaMql)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cpra)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.rr)}</TableCell>
                        <TableCell className="text-right">{formatPercent(item.percRrMql)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cprr)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.clientesUnicos)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cacUnico)}</TableCell>
                        <TableCell>
                          {item.link && (
                            <a 
                              href={item.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={24} className="text-center py-8 text-muted-foreground">
                          Nenhum criativo encontrado para o período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
