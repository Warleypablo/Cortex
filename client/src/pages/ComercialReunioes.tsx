import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Phone, TrendingUp, Users, BarChart3, Target, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, format, parse } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, AreaChart, Area, Cell
} from "recharts";

const SDR_COLORS = [
  "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7",
];

const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(139, 92, 246, 0.3)',
  borderRadius: '12px',
  color: '#f1f5f9',
  backdropFilter: 'blur(12px)',
};

interface RRSemanalItem {
  semana: string;
  rrMql: number;
  rrNaoMql: number;
  rrTotal: number;
}

interface RRSemanalPorSDRItem {
  semana: string;
  sdrName: string;
  sdrId: number;
  rrMql: number;
  rrNaoMql: number;
  rrTotal: number;
}

interface ChartDataReunioes {
  sdr: string;
  sdrId: number;
  leads: number;
  reunioesRealizadas: number;
  conversao: number;
}

export default function ComercialReunioes() {
  usePageTitle("Reuniões");
  useSetPageInfo("Reuniões", "Análise de Reuniões Realizadas por SDR");

  const [selectedMonth, setSelectedMonth] = useState("2026-03");

  const months = [
    { value: "2026-03", label: "Março 2026" },
    { value: "2026-02", label: "Fevereiro 2026" },
    { value: "2026-01", label: "Janeiro 2026" },
    { value: "2025-12", label: "Dezembro 2025" },
    { value: "2025-11", label: "Novembro 2025" },
    { value: "2025-10", label: "Outubro 2025" },
  ];

  const dateRange = useMemo(() => {
    const monthDate = parse(selectedMonth, 'yyyy-MM', new Date());
    return {
      startDate: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
    };
  }, [selectedMonth]);

  // 1. RR semanal (MQL vs Não-MQL totals)
  const { data: rrSemanalData, isLoading: rrLoading } = useQuery<RRSemanalItem[]>({
    queryKey: ['/api/growth/orcado-realizado/rr-semanal', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/rr-semanal?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch RR semanal');
      return res.json();
    },
  });

  // 2. Per-SDR totals (leads, reuniões, conversão)
  const { data: chartReunioes, isLoading: chartLoading } = useQuery<ChartDataReunioes[]>({
    queryKey: ['/api/sdrs/chart-reunioes', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/chart-reunioes?dataReuniaoInicio=${dateRange.startDate}&dataReuniaoFim=${dateRange.endDate}&dataLeadInicio=${dateRange.startDate}&dataLeadFim=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch chart reunioes');
      return res.json();
    },
  });

  // 3. Per-SDR weekly RR breakdown (new endpoint)
  const { data: rrPorSDRData, isLoading: rrPorSDRLoading } = useQuery<RRSemanalPorSDRItem[]>({
    queryKey: ['/api/growth/comercial/rr-semanal-por-sdr', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/comercial/rr-semanal-por-sdr?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch RR por SDR');
      return res.json();
    },
  });

  // Accumulated RR data
  const rrAcumuladoData = useMemo(() => {
    if (!rrSemanalData || rrSemanalData.length === 0) return [];
    let acumulado = 0;
    return rrSemanalData.map(item => {
      acumulado += item.rrTotal;
      return { semana: item.semana, acumulado };
    });
  }, [rrSemanalData]);

  // Pivot per-SDR data for stacked chart: { semana, [sdrName]: rrTotal, ... }
  const { rrPorSemanaSDR, sdrNames } = useMemo(() => {
    if (!rrPorSDRData || rrPorSDRData.length === 0) return { rrPorSemanaSDR: [], sdrNames: [] };
    const names = [...new Set(rrPorSDRData.map(d => d.sdrName))];
    const semanaMap = new Map<string, Record<string, number>>();
    for (const item of rrPorSDRData) {
      if (!semanaMap.has(item.semana)) {
        semanaMap.set(item.semana, { semana: 0 } as any);
      }
      const row = semanaMap.get(item.semana)!;
      row[item.sdrName] = (row[item.sdrName] || 0) + item.rrTotal;
    }
    // Preserve week order
    const semanas = [...new Set(rrPorSDRData.map(d => d.semana))];
    const pivoted = semanas.map(s => ({ semana: s, ...semanaMap.get(s) }));
    return { rrPorSemanaSDR: pivoted, sdrNames: names };
  }, [rrPorSDRData]);

  // Sort chart data by reuniões desc
  const sortedChartReunioes = useMemo(() => {
    if (!chartReunioes) return [];
    return [...chartReunioes].sort((a, b) => b.reunioesRealizadas - a.reunioesRealizadas);
  }, [chartReunioes]);

  // Sort by conversão desc
  const sortedByConversao = useMemo(() => {
    if (!chartReunioes) return [];
    return [...chartReunioes].sort((a, b) => b.conversao - a.conversao);
  }, [chartReunioes]);

  const isLoading = rrLoading || chartLoading || rrPorSDRLoading;

  const formatPercent = (val: number) => `${val.toFixed(1)}%`;

  const getConversaoBadge = (pct: number) => {
    if (pct >= 30) return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{pct.toFixed(1)}%</Badge>;
    if (pct >= 15) return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{pct.toFixed(1)}%</Badge>;
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{pct.toFixed(1)}%</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reuniões Realizadas</h1>
          <p className="text-sm text-muted-foreground">Análise detalhada de reuniões por SDR</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* Row 1: RR por Semana + Evolução Acumulada */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Chart 1: RR por Semana (MQL vs Não-MQL) */}
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
              <div className="h-1 bg-gradient-to-r from-violet-500 to-blue-500 rounded-t-lg" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Phone className="h-4 w-4 text-violet-500" />
                  RR por Semana
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-zinc-400 text-xs">
                  Reuniões Realizadas por semana (MQL vs Não-MQL)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={rrSemanalData || []} barCategoryGap="15%">
                    <defs>
                      <linearGradient id="barRrMql" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.8}/>
                      </linearGradient>
                      <linearGradient id="barRrNaoMql" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" vertical={false} />
                    <XAxis dataKey="semana" stroke="#9ca3af" fontSize={10} angle={-45} textAnchor="end" height={60} interval={0} tick={{ fill: '#9ca3af' }} />
                    <YAxis stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [value, name === 'rrMql' ? 'MQL' : 'Não-MQL']}
                      labelFormatter={(label) => `Semana: ${label}`} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => value === 'rrMql' ? 'MQL' : 'Não-MQL'} />
                    <Bar dataKey="rrMql" fill="url(#barRrMql)" radius={[0, 0, 0, 0]} name="rrMql" stackId="stack" />
                    <Bar dataKey="rrNaoMql" fill="url(#barRrNaoMql)" radius={[4, 4, 0, 0]} name="rrNaoMql" stackId="stack" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chart 2: Evolução Acumulada de RR */}
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-lg" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Evolução de RR
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-zinc-400 text-xs">
                  Acumulado de Reuniões Realizadas no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={rrAcumuladoData}>
                    <defs>
                      <linearGradient id="areaRrAcumulado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" vertical={false} />
                    <XAxis dataKey="semana" stroke="#9ca3af" fontSize={10} angle={-45} textAnchor="end" height={60} interval={0} tick={{ fill: '#9ca3af' }} />
                    <YAxis stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(value: number) => [value, 'RR Acumulado']}
                      labelFormatter={(label) => `Semana: ${label}`} />
                    <Area type="monotone" dataKey="acumulado" stroke="#10b981" strokeWidth={2.5} fill="url(#areaRrAcumulado)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: RR por SDR + Conversão por SDR */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Chart 3: Quantidade de RR por SDR */}
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-t-lg" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Reuniões por SDR
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-zinc-400 text-xs">
                  Quantidade de reuniões realizadas por cada SDR
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, sortedChartReunioes.length * 40)}>
                  <BarChart data={sortedChartReunioes} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }} allowDecimals={false} />
                    <YAxis dataKey="sdr" type="category" stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }} width={120} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(value: number) => [value, 'Reuniões']} />
                    <Bar dataKey="reunioesRealizadas" radius={[0, 4, 4, 0]}>
                      {sortedChartReunioes.map((_, i) => (
                        <Cell key={i} fill={SDR_COLORS[i % SDR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chart 4: Taxa de Conversão por SDR */}
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
              <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-lg" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-500" />
                  Taxa de Conversão por SDR
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-zinc-400 text-xs">
                  Conversão de leads em reuniões realizadas (%)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, sortedByConversao.length * 40)}>
                  <BarChart data={sortedByConversao} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }}
                      tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <YAxis dataKey="sdr" type="category" stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }} width={120} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(value: number) => [formatPercent(value), 'Conversão']} />
                    <Bar dataKey="conversao" radius={[0, 4, 4, 0]}>
                      {sortedByConversao.map((entry, i) => {
                        const pct = entry.conversao;
                        const color = pct >= 30 ? '#10b981' : pct >= 15 ? '#f59e0b' : '#ef4444';
                        return <Cell key={i} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: RR por Semana por SDR (full width) */}
          {rrPorSemanaSDR.length > 0 && (
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
              <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-lg" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  RR por Semana por SDR
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-zinc-400 text-xs">
                  Breakdown semanal de reuniões por SDR individual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={rrPorSemanaSDR} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" vertical={false} />
                    <XAxis dataKey="semana" stroke="#9ca3af" fontSize={10} angle={-45} textAnchor="end" height={60} interval={0} tick={{ fill: '#9ca3af' }} />
                    <YAxis stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    {sdrNames.map((name, i) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        stackId="sdr"
                        fill={SDR_COLORS[i % SDR_COLORS.length]}
                        radius={i === sdrNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Row 4: Tabela Detalhada */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <div className="h-1 bg-gradient-to-r from-slate-500 to-gray-500 rounded-t-lg" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                Detalhamento por SDR
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-zinc-400 text-xs">
                Métricas detalhadas de cada SDR no período
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-zinc-700">
                      <TableHead className="text-xs font-semibold text-gray-600 dark:text-zinc-400">SDR</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600 dark:text-zinc-400 text-right">Leads</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600 dark:text-zinc-400 text-right">Reuniões</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600 dark:text-zinc-400 text-right">Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedChartReunioes.map((sdr, i) => (
                      <TableRow key={sdr.sdrId} className="border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <TableCell className="font-medium text-sm text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SDR_COLORS[i % SDR_COLORS.length] }} />
                            {sdr.sdr}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-gray-700 dark:text-zinc-300">{sdr.leads}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-semibold text-gray-900 dark:text-white">{sdr.reunioesRealizadas}</TableCell>
                        <TableCell className="text-right">{getConversaoBadge(sdr.conversao)}</TableCell>
                      </TableRow>
                    ))}
                    {sortedChartReunioes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                          Nenhum dado disponível para o período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                    {/* Totals row */}
                    {sortedChartReunioes.length > 0 && (
                      <TableRow className="border-t-2 border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800/50">
                        <TableCell className="font-bold text-sm text-gray-900 dark:text-white">Total</TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-bold text-gray-900 dark:text-white">
                          {sortedChartReunioes.reduce((sum, s) => sum + s.leads, 0)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-bold text-gray-900 dark:text-white">
                          {sortedChartReunioes.reduce((sum, s) => sum + s.reunioesRealizadas, 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const totalLeads = sortedChartReunioes.reduce((sum, s) => sum + s.leads, 0);
                            const totalRR = sortedChartReunioes.reduce((sum, s) => sum + s.reunioesRealizadas, 0);
                            const avgConv = totalLeads > 0 ? (totalRR / totalLeads) * 100 : 0;
                            return getConversaoBadge(avgConv);
                          })()}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
