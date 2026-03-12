import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, Users, TrendingUp, DollarSign } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface GestorRow {
  nome: string;
  nivel: string;
  squad: string;
  mrr_alvo: number;
  ticket_alvo: number;
  mrr_atual: number;
  contratos_atuais: number;
  ticket_medio_atual: number;
  utilizacao_pct: number;
}

function getUtilizacaoColor(pct: number): string {
  if (pct >= 90) return "text-red-600 dark:text-red-400";
  if (pct >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

function getUtilizacaoBg(pct: number): string {
  if (pct >= 90) return "bg-red-100 dark:bg-red-900/30";
  if (pct >= 70) return "bg-yellow-100 dark:bg-yellow-900/30";
  return "bg-green-100 dark:bg-green-900/30";
}

function getBarColor(pct: number): string {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#eab308";
  return "#22c55e";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function Capacity() {
  useSetPageInfo("Capacity", "Performance dos Gestores por nível de cargo");
  usePageTitle("Capacity");

  const [filterSquad, setFilterSquad] = useState("todos");

  const { data: gestores, isLoading } = useQuery<GestorRow[]>({
    queryKey: ["/api/capacity/gestores"],
  });

  const squads = useMemo(() => {
    if (!gestores) return [];
    return [...new Set(gestores.map((g) => g.squad).filter(Boolean))].sort();
  }, [gestores]);

  const filtered = useMemo(() => {
    if (!gestores) return [];
    if (filterSquad === "todos") return gestores;
    return gestores.filter((g) => g.squad === filterSquad);
  }, [gestores, filterSquad]);

  const totals = useMemo(() => {
    if (!filtered.length) return { gestores: 0, mrr_alvo: 0, mrr_atual: 0, utilizacao: 0 };
    const mrr_alvo = filtered.reduce((s, g) => s + g.mrr_alvo, 0);
    const mrr_atual = filtered.reduce((s, g) => s + g.mrr_atual, 0);
    return {
      gestores: filtered.length,
      mrr_alvo,
      mrr_atual,
      utilizacao: mrr_alvo > 0 ? Math.round((mrr_atual / mrr_alvo) * 1000) / 10 : 0,
    };
  }, [filtered]);

  const chartData = useMemo(() => {
    if (!gestores) return [];
    const grouped: Record<string, { squad: string; mrr_alvo: number; mrr_atual: number }> = {};
    for (const g of gestores) {
      const sq = g.squad || "Sem Squad";
      if (!grouped[sq]) grouped[sq] = { squad: sq, mrr_alvo: 0, mrr_atual: 0 };
      grouped[sq].mrr_alvo += g.mrr_alvo;
      grouped[sq].mrr_atual += g.mrr_atual;
    }
    return Object.values(grouped)
      .map((g) => ({
        ...g,
        utilizacao_pct: g.mrr_alvo > 0 ? Math.round((g.mrr_atual / g.mrr_alvo) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.utilizacao_pct - a.utilizacao_pct);
  }, [gestores]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Capacity</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Performance dos Gestores por nível de cargo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Squad:</span>
          <Select value={filterSquad} onValueChange={setFilterSquad}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {squads.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de resumo */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Gestores</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.gestores}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">MRR Alvo Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totals.mrr_alvo)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">MRR Atual Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totals.mrr_atual)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", getUtilizacaoBg(totals.utilizacao))}>
                  <Gauge className={cn("h-5 w-5", getUtilizacaoColor(totals.utilizacao))} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Utilização Geral</p>
                  <p className={cn("text-2xl font-bold", getUtilizacaoColor(totals.utilizacao))}>{totals.utilizacao}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico por Squad */}
      {chartData.length > 0 && (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Utilização por Squad</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis type="number" domain={[0, 'auto']} tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="squad" tick={{ fill: '#9ca3af' }} width={90} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "Utilização"]}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="utilizacao_pct" radius={[0, 4, 4, 0]} maxBarSize={30}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(entry.utilizacao_pct)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabela de gestores */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Gestores de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-zinc-400 py-8">
              Nenhum gestor encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-zinc-700">
                    <TableHead className="text-gray-600 dark:text-zinc-400">Gestor</TableHead>
                    <TableHead className="text-gray-600 dark:text-zinc-400">Nível</TableHead>
                    <TableHead className="text-gray-600 dark:text-zinc-400">Squad</TableHead>
                    <TableHead className="text-gray-600 dark:text-zinc-400 text-right">MRR Alvo</TableHead>
                    <TableHead className="text-gray-600 dark:text-zinc-400 text-right">MRR Atual</TableHead>
                    <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Contratos</TableHead>
                    <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Ticket Médio</TableHead>
                    <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Utilização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.nome} className="border-gray-200 dark:border-zinc-700">
                      <TableCell className="font-medium text-gray-900 dark:text-white">{row.nome}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {row.nivel || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-zinc-300">{row.squad || "—"}</TableCell>
                      <TableCell className="text-right text-gray-900 dark:text-white">{formatCurrency(row.mrr_alvo)}</TableCell>
                      <TableCell className="text-right text-gray-900 dark:text-white">{formatCurrency(row.mrr_atual)}</TableCell>
                      <TableCell className="text-right text-gray-900 dark:text-white">{row.contratos_atuais}</TableCell>
                      <TableCell className="text-right text-gray-900 dark:text-white">{formatCurrency(row.ticket_medio_atual)}</TableCell>
                      <TableCell className={cn("text-right font-semibold", getUtilizacaoColor(row.utilizacao_pct))}>
                        {row.utilizacao_pct}%
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
