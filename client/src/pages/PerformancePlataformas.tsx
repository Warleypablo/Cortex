import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, Search, ChevronRight, ChevronDown, ExternalLink, Layers, Target, Users, BarChart3 } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getMetricColor, getColorClasses } from "@/lib/metricFormatting";
import type { MetricRulesetWithThresholds } from "@shared/schema";

type NodeType = 'platform' | 'campaign' | 'adset' | 'ad';

interface PerformanceNode {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null;
  status: string;
  link?: string;
  childrenCount?: number;
  investimento: number;
  impressions: number;
  frequency: number | null;
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
  clientesUnicos: number;
  percRrCliente: number | null;
  cacUnico: number | null;
}


const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
};

const formatNumber = (value: number | null): string => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR").format(value);
};

const formatPercent = (value: number | null): string => {
  if (value === null || value === undefined) return "-";
  return `${value}%`;
};

const formatDecimal = (value: number | null): string => {
  if (value === null || value === undefined) return "-";
  return value.toFixed(2);
};

export default function PerformancePlataformas() {
  useSetPageInfo("Performance por Plataforma", "Análise hierárquica: Plataforma → Campanha → Conjunto → Anúncio");
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const { data: nodes = [], isLoading } = useQuery<PerformanceNode[]>({
    queryKey: ["/api/growth/performance-plataformas", {
      startDate: format(dateRange.from, "yyyy-MM-dd"),
      endDate: format(dateRange.to, "yyyy-MM-dd"),
      status: statusFilter
    }]
  });

  const { data: metricRules = [] } = useQuery<MetricRulesetWithThresholds[]>({
    queryKey: ["/api/metric-rules"]
  });

  const getCellClassName = (metricKey: string, value: number | null): string => {
    if (value === null || value === undefined) return "";
    const color = getMetricColor(value, metricRules, metricKey);
    if (!color || color === 'default') return "";
    return getColorClasses(color);
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const nodesByParent = useMemo(() => {
    const map = new Map<string, PerformanceNode[]>();
    nodes.forEach(node => {
      const parentId = node.parentId || 'root';
      if (!map.has(parentId)) {
        map.set(parentId, []);
      }
      map.get(parentId)!.push(node);
    });
    return map;
  }, [nodes]);

  const getChildren = (parentId: string | null): PerformanceNode[] => {
    return nodesByParent.get(parentId || 'root') || [];
  };

  const filterNodes = (nodesToFilter: PerformanceNode[]): PerformanceNode[] => {
    if (!searchTerm) return nodesToFilter;
    return nodesToFilter.filter(node => 
      node.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getTypeIcon = (type: NodeType) => {
    switch (type) {
      case 'platform': return <Layers className="w-4 h-4" />;
      case 'campaign': return <Target className="w-4 h-4" />;
      case 'adset': return <Users className="w-4 h-4" />;
      case 'ad': return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: NodeType) => {
    switch (type) {
      case 'platform': return 'Plataforma';
      case 'campaign': return 'Campanha';
      case 'adset': return 'Conjunto';
      case 'ad': return 'Anúncio';
    }
  };

  const getIndent = (type: NodeType) => {
    switch (type) {
      case 'platform': return 0;
      case 'campaign': return 1;
      case 'adset': return 2;
      case 'ad': return 3;
    }
  };

  const renderRow = (node: PerformanceNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const children = getChildren(node.id);
    const hasChildren = children.length > 0 || (node.childrenCount && node.childrenCount > 0);
    const indent = getIndent(node.type);

    return (
      <tr key={node.id} className="border-b border-border hover-elevate" data-testid={`row-${node.type}-${node.id}`}>
        <td className="p-2 sticky left-0 bg-background z-10" style={{ paddingLeft: `${indent * 24 + 8}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => toggleExpand(node.id)}
                data-testid={`button-toggle-${node.id}`}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            {getTypeIcon(node.type)}
            <div className="flex flex-col">
              <span className="font-medium text-sm truncate max-w-[200px]" title={node.name}>
                {node.name}
              </span>
              <span className="text-xs text-muted-foreground">{getTypeLabel(node.type)}</span>
            </div>
            {node.link && (
              <a href={node.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </td>
        <td className="p-2 text-center">
          <Badge variant={node.status === 'Ativo' ? 'default' : 'secondary'} className="text-xs">
            {node.status}
          </Badge>
        </td>
        <td className="p-2 text-right">{formatCurrency(node.investimento)}</td>
        <td className="p-2 text-right">{formatNumber(node.impressions)}</td>
        <td className="p-2 text-right">{formatDecimal(node.frequency)}</td>
        <td className={`p-2 text-right ${getCellClassName('ctr', node.ctr)}`}>{formatDecimal(node.ctr)}</td>
        <td className={`p-2 text-right ${getCellClassName('cpm', node.cpm)}`}>{formatCurrency(node.cpm)}</td>
        <td className="p-2 text-right">{formatNumber(node.leads)}</td>
        <td className={`p-2 text-right ${getCellClassName('cpl', node.cpl)}`}>{formatCurrency(node.cpl)}</td>
        <td className="p-2 text-right">{formatNumber(node.mql)}</td>
        <td className="p-2 text-right">{formatPercent(node.percMql)}</td>
        <td className={`p-2 text-right ${getCellClassName('cpmql', node.cpmql)}`}>{formatCurrency(node.cpmql)}</td>
        <td className="p-2 text-right">{formatNumber(node.ra)}</td>
        <td className="p-2 text-right">{formatPercent(node.percRa)}</td>
        <td className={`p-2 text-right ${getCellClassName('cpra', node.cpra)}`}>{formatCurrency(node.cpra)}</td>
        <td className="p-2 text-right">{formatPercent(node.percRaMql)}</td>
        <td className="p-2 text-right">{formatPercent(node.percRrMql)}</td>
        <td className="p-2 text-right">{formatNumber(node.rr)}</td>
        <td className="p-2 text-right">{formatPercent(node.percRr)}</td>
        <td className={`p-2 text-right ${getCellClassName('cprr', node.cprr)}`}>{formatCurrency(node.cprr)}</td>
        <td className="p-2 text-right">{formatNumber(node.clientesUnicos)}</td>
        <td className="p-2 text-right">{formatPercent(node.percRrCliente)}</td>
        <td className={`p-2 text-right ${getCellClassName('cacUnico', node.cacUnico)}`}>{formatCurrency(node.cacUnico)}</td>
      </tr>
    );
  };

  const renderTree = (parentId: string | null = null): JSX.Element[] => {
    const children = filterNodes(getChildren(parentId));
    const rows: JSX.Element[] = [];
    
    for (const node of children) {
      rows.push(renderRow(node));
      if (expandedNodes.has(node.id)) {
        rows.push(...renderTree(node.id));
      }
    }
    
    return rows;
  };

  const platforms = getChildren(null).filter(n => n.type === 'platform');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-sm" data-testid="badge-total-platforms">
          {platforms.length} plataformas
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
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
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              onClick={() => {
                if (expandedNodes.size > 0) {
                  setExpandedNodes(new Set());
                } else {
                  const allIds = new Set(nodes.filter(n => n.type !== 'ad').map(n => n.id));
                  setExpandedNodes(allIds);
                }
              }}
              data-testid="button-expand-collapse"
            >
              {expandedNodes.size > 0 ? "Recolher Tudo" : "Expandir Tudo"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-20">
                  <tr>
                    <th className="p-2 text-left sticky left-0 bg-muted/50 z-30 min-w-[280px]">Nome</th>
                    <th className="p-2 text-center min-w-[80px]">Status</th>
                    <th className="p-2 text-right min-w-[100px]">Investimento</th>
                    <th className="p-2 text-right min-w-[100px]">Impressões</th>
                    <th className="p-2 text-right min-w-[80px]">Freq.</th>
                    <th className="p-2 text-right min-w-[60px]">CTR</th>
                    <th className="p-2 text-right min-w-[80px]">CPM</th>
                    <th className="p-2 text-right min-w-[60px]">Leads</th>
                    <th className="p-2 text-right min-w-[80px]">CPL</th>
                    <th className="p-2 text-right min-w-[60px]">MQL</th>
                    <th className="p-2 text-right min-w-[60px]">%MQL</th>
                    <th className="p-2 text-right min-w-[80px]">CPMQL</th>
                    <th className="p-2 text-right min-w-[60px]">RA</th>
                    <th className="p-2 text-right min-w-[60px]">%RA</th>
                    <th className="p-2 text-right min-w-[80px]">CPRA</th>
                    <th className="p-2 text-right min-w-[70px]">%RA/MQL</th>
                    <th className="p-2 text-right min-w-[70px]">%RR/MQL</th>
                    <th className="p-2 text-right min-w-[60px]">RR</th>
                    <th className="p-2 text-right min-w-[60px]">%RR</th>
                    <th className="p-2 text-right min-w-[80px]">CPRR</th>
                    <th className="p-2 text-right min-w-[80px]">Clientes</th>
                    <th className="p-2 text-right min-w-[70px]">%RR/Cli</th>
                    <th className="p-2 text-right min-w-[80px]">CAC</th>
                  </tr>
                </thead>
                <tbody>
                  {renderTree()}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
