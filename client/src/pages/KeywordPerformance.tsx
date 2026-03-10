import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUpDown, TrendingUp, MousePointerClick, DollarSign, Target, Loader2 } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";

interface KeywordData {
  keywordKey: number;
  keyword: string;
  matchType: string;
  status: string;
  qualityScore: number | null;
  adGroup: string;
  campaign: string;
  campaignStatus: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  avgCpc: number;
  roas: number;
}

interface Summary {
  totalKeywords: number;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  avgCpc: number;
  roas: number;
}

type SortKey = keyof KeywordData;
type SortConfig = { key: SortKey; direction: "asc" | "desc" };

function formatNumber(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(v);
}
function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);
}
function formatPercent(v: number): string {
  return `${v.toFixed(2)}%`;
}

function QualityBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 dark:text-zinc-600">-</span>;
  const color = score >= 7 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    : score >= 4 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>{score}/10</span>;
}

function MatchBadge({ type }: { type: string }) {
  const labels: Record<string, string> = { EXACT: "Exata", PHRASE: "Frase", BROAD: "Ampla" };
  const colors: Record<string, string> = {
    EXACT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    PHRASE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    BROAD: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  };
  return <Badge className={`${colors[type] || colors.BROAD} text-xs`}>{labels[type] || type}</Badge>;
}

export default function KeywordPerformance() {
  useSetPageInfo("Keywords Performance", "Google Ads");
  usePageTitle("Keywords Performance");

  const defaultStart = format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd");
  const defaultEnd = format(new Date(), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [matchType, setMatchType] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortConfig>({ key: "cost", direction: "desc" });

  const { data, isLoading } = useQuery<{ keywords: KeywordData[]; summary: Summary }>({
    queryKey: ["/api/growth/keyword-performance", startDate, endDate, matchType, statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate, endDate, matchType, status: statusFilter, search,
        sortBy: sort.key, sortDir: sort.direction,
      });
      const res = await fetch(`/api/growth/keyword-performance?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const keywords = data?.keywords || [];
  const summary = data?.summary || { totalKeywords: 0, impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0, ctr: 0, avgCpc: 0, roas: 0 };

  const sorted = useMemo(() => {
    const arr = [...keywords];
    arr.sort((a, b) => {
      const va = a[sort.key] ?? 0;
      const vb = b[sort.key] ?? 0;
      return va > vb ? (sort.direction === "asc" ? 1 : -1) : va < vb ? (sort.direction === "asc" ? -1 : 1) : 0;
    });
    return arr;
  }, [keywords, sort]);

  const toggleSort = (key: SortKey) => {
    setSort(prev => ({ key, direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc" }));
  };

  const SortHeader = ({ label, sortKey, className }: { label: string; sortKey: SortKey; className?: string }) => (
    <TableHead className={`cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-zinc-800 ${className || ""}`} onClick={() => toggleSort(sortKey)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sort.key === sortKey ? "text-blue-500" : "text-gray-400 dark:text-zinc-500"}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4 p-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 dark:text-zinc-400">Início</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-zinc-400">Fim</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-zinc-400">Correspondência</label>
          <Select value={matchType} onValueChange={setMatchType}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="EXACT">Exata</SelectItem>
              <SelectItem value="PHRASE">Frase</SelectItem>
              <SelectItem value="BROAD">Ampla</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-zinc-400">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="ENABLED">Ativo</SelectItem>
              <SelectItem value="PAUSED">Pausado</SelectItem>
              <SelectItem value="REMOVED">Removido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500 dark:text-zinc-400">Buscar</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input placeholder="Keyword ou campanha..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><Target className="h-3 w-3" />Keywords</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(summary.totalKeywords)}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><TrendingUp className="h-3 w-3" />Impressões</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(summary.impressions)}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><MousePointerClick className="h-3 w-3" />Cliques</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(summary.clicks)}</div>
            <div className="text-xs text-gray-400 dark:text-zinc-500">CTR: {formatPercent(summary.ctr)}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><DollarSign className="h-3 w-3" />Investimento</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(summary.cost)}</div>
            <div className="text-xs text-gray-400 dark:text-zinc-500">CPC: {formatCurrency(summary.avgCpc)}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><Target className="h-3 w-3" />Conversões</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(Math.round(summary.conversions))}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><TrendingUp className="h-3 w-3" />ROAS</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{summary.roas.toFixed(2)}x</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500 dark:text-zinc-400">Carregando keywords...</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-gray-500 dark:text-zinc-400">
              Nenhuma keyword encontrada. Verifique se o sync já foi executado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-zinc-800">
                    <SortHeader label="Keyword" sortKey="keyword" className="min-w-[200px]" />
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead className="w-16">QS</TableHead>
                    <SortHeader label="Campanha" sortKey="campaign" className="min-w-[150px]" />
                    <SortHeader label="Impressões" sortKey="impressions" className="text-right" />
                    <SortHeader label="Cliques" sortKey="clicks" className="text-right" />
                    <SortHeader label="CTR" sortKey="ctr" className="text-right" />
                    <SortHeader label="CPC Médio" sortKey="avgCpc" className="text-right" />
                    <SortHeader label="Custo" sortKey="cost" className="text-right" />
                    <SortHeader label="Conversões" sortKey="conversions" className="text-right" />
                    <SortHeader label="ROAS" sortKey="roas" className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((kw) => (
                    <TableRow key={kw.keywordKey} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                      <TableCell className="font-medium text-gray-900 dark:text-white">
                        {kw.keyword}
                        <div className="text-xs text-gray-400 dark:text-zinc-500">{kw.adGroup}</div>
                      </TableCell>
                      <TableCell><MatchBadge type={kw.matchType} /></TableCell>
                      <TableCell><QualityBadge score={kw.qualityScore} /></TableCell>
                      <TableCell className="text-gray-600 dark:text-zinc-400 text-sm">{kw.campaign}</TableCell>
                      <TableCell className="text-right text-gray-900 dark:text-white">{formatNumber(kw.impressions)}</TableCell>
                      <TableCell className="text-right text-gray-900 dark:text-white">{formatNumber(kw.clicks)}</TableCell>
                      <TableCell className="text-right">{formatPercent(kw.ctr)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(kw.avgCpc)}</TableCell>
                      <TableCell className="text-right font-medium text-gray-900 dark:text-white">{formatCurrency(kw.cost)}</TableCell>
                      <TableCell className="text-right">{kw.conversions > 0 ? formatNumber(Math.round(kw.conversions)) : "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {kw.roas > 0 ? <span className={kw.roas >= 1 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}>{kw.roas.toFixed(2)}x</span> : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
