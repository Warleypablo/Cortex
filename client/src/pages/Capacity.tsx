import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Gauge, Users, Package, Trash2, Plus, BarChart3, Settings } from "lucide-react";
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

interface CapacityRow {
  id: number;
  operador: string;
  produto: string;
  squad: string;
  max_contratos: number;
  atualizado_por: string;
  atualizado_em: string;
  contratos_atuais: number;
  vagas_livres: number;
  utilizacao_pct: number;
}

interface ConsolidadoRow {
  squad: string;
  produto: string;
  capacity_total: number;
  contratos_total: number;
  vagas_livres: number;
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

export default function Capacity() {
  useSetPageInfo({ title: "Capacity", area: "gestao" });
  usePageTitle("Capacity");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state
  const [formOperador, setFormOperador] = useState("");
  const [formProduto, setFormProduto] = useState("");
  const [formSquad, setFormSquad] = useState("");
  const [formMaxContratos, setFormMaxContratos] = useState("");

  // Filters
  const [filterSquad, setFilterSquad] = useState("todos");

  // Data queries
  const { data: capacityData, isLoading: loadingCapacity } = useQuery<CapacityRow[]>({
    queryKey: ["/api/capacity"],
  });

  const { data: consolidadoData, isLoading: loadingConsolidado } = useQuery<ConsolidadoRow[]>({
    queryKey: ["/api/capacity/consolidado"],
  });

  const { data: produtos } = useQuery<string[]>({
    queryKey: ["/api/contratos/produtos-distintos"],
  });

  const { data: evolucaoData } = useQuery<{ operadores: string[] }>({
    queryKey: ["/api/evolucao-mensal"],
  });

  const operadores = evolucaoData?.operadores || [];

  // Mutations
  const upsertMutation = useMutation({
    mutationFn: async (data: { operador: string; produto: string; squad: string; max_contratos: number }) => {
      const res = await fetch("/api/capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao salvar capacity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/consolidado"] });
      toast({ title: "Capacity salva com sucesso" });
      setFormOperador("");
      setFormProduto("");
      setFormSquad("");
      setFormMaxContratos("");
    },
    onError: () => {
      toast({ title: "Erro ao salvar capacity", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/capacity/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/consolidado"] });
      toast({ title: "Capacity removida" });
    },
  });

  // Computed
  const squads = useMemo(() => {
    if (!capacityData) return [];
    return [...new Set(capacityData.map((r) => r.squad))].sort();
  }, [capacityData]);

  const filteredCapacity = useMemo(() => {
    if (!capacityData) return [];
    if (filterSquad === "todos") return capacityData;
    return capacityData.filter((r) => r.squad === filterSquad);
  }, [capacityData, filterSquad]);

  const totals = useMemo(() => {
    if (!filteredCapacity.length) return { capacity: 0, atuais: 0, vagas: 0, pct: 0 };
    const capacity = filteredCapacity.reduce((s, r) => s + r.max_contratos, 0);
    const atuais = filteredCapacity.reduce((s, r) => s + r.contratos_atuais, 0);
    return {
      capacity,
      atuais,
      vagas: capacity - atuais,
      pct: capacity > 0 ? Math.round((atuais / capacity) * 100) : 0,
    };
  }, [filteredCapacity]);

  const chartData = useMemo(() => {
    if (!consolidadoData) return [];
    const grouped: Record<string, { squad: string; utilizacao_pct: number; capacity_total: number; contratos_total: number }> = {};
    for (const row of consolidadoData) {
      if (!grouped[row.squad]) {
        grouped[row.squad] = { squad: row.squad, utilizacao_pct: 0, capacity_total: 0, contratos_total: 0 };
      }
      grouped[row.squad].capacity_total += row.capacity_total;
      grouped[row.squad].contratos_total += row.contratos_total;
    }
    return Object.values(grouped).map((g) => ({
      ...g,
      utilizacao_pct: g.capacity_total > 0 ? Math.round((g.contratos_total / g.capacity_total) * 100) : 0,
    })).sort((a, b) => b.utilizacao_pct - a.utilizacao_pct);
  }, [consolidadoData]);

  const handleSubmit = () => {
    if (!formOperador || !formProduto || !formSquad || !formMaxContratos) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    upsertMutation.mutate({
      operador: formOperador,
      produto: formProduto,
      squad: formSquad,
      max_contratos: parseInt(formMaxContratos),
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Capacity</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Gerencie a capacidade dos operadores por produto</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        {/* ── Dashboard Tab ─────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          {/* Filtro de Squad */}
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

          {/* Cards */}
          {loadingCapacity ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">Capacity Total</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.capacity}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">Contratos Ativos</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.atuais}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">Vagas Livres</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.vagas}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", getUtilizacaoBg(totals.pct))}>
                      <BarChart3 className={cn("h-5 w-5", getUtilizacaoColor(totals.pct))} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">Utilização</p>
                      <p className={cn("text-2xl font-bold", getUtilizacaoColor(totals.pct))}>{totals.pct}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Gráfico de barras por Squad */}
          {chartData.length > 0 && (
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Utilização por Squad</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="squad" tick={{ fill: '#9ca3af' }} width={70} />
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

          {/* Tabela detalhada */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Detalhamento por Operador</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCapacity ? (
                <Skeleton className="h-48" />
              ) : filteredCapacity.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-zinc-400 py-8">
                  Nenhuma capacity configurada. Use a aba "Configuração" para definir.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-zinc-700">
                        <TableHead className="text-gray-600 dark:text-zinc-400">Operador</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">Produto</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">Squad</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Capacity</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Atuais</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Vagas</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Utilização</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCapacity.map((row) => (
                        <TableRow key={row.id} className="border-gray-200 dark:border-zinc-700">
                          <TableCell className="font-medium text-gray-900 dark:text-white">{row.operador}</TableCell>
                          <TableCell className="text-gray-700 dark:text-zinc-300">{row.produto}</TableCell>
                          <TableCell className="text-gray-700 dark:text-zinc-300">{row.squad}</TableCell>
                          <TableCell className="text-right text-gray-900 dark:text-white">{row.max_contratos}</TableCell>
                          <TableCell className="text-right text-gray-900 dark:text-white">{row.contratos_atuais}</TableCell>
                          <TableCell className="text-right text-gray-900 dark:text-white">{row.vagas_livres}</TableCell>
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
        </TabsContent>

        {/* ── Configuração Tab ──────────────────────────────────── */}
        <TabsContent value="config" className="space-y-6 mt-4">
          {/* Formulário */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Definir Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Operador</label>
                  <Select value={formOperador} onValueChange={setFormOperador}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {operadores.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Produto</label>
                  <Select value={formProduto} onValueChange={setFormProduto}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(produtos || []).map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Squad</label>
                  <Select value={formSquad} onValueChange={setFormSquad}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["Supreme", "Forja", "Revo", "Nitro", "Apex", "Fast", "Lumina"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Max Contratos</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 25"
                    value={formMaxContratos}
                    onChange={(e) => setFormMaxContratos(e.target.value)}
                    className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={upsertMutation.isPending}
                  className="h-10"
                >
                  {upsertMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de capacities configuradas */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-gray-900 dark:text-white">Capacities Configuradas</CardTitle>
              <Select value={filterSquad} onValueChange={setFilterSquad}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Squads</SelectItem>
                  {squads.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {loadingCapacity ? (
                <Skeleton className="h-48" />
              ) : filteredCapacity.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-zinc-400 py-8">
                  Nenhuma capacity configurada ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-zinc-700">
                        <TableHead className="text-gray-600 dark:text-zinc-400">Operador</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">Produto</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">Squad</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Max Contratos</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Atuais</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Utilização</TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCapacity.map((row) => (
                        <TableRow key={row.id} className="border-gray-200 dark:border-zinc-700">
                          <TableCell className="font-medium text-gray-900 dark:text-white">{row.operador}</TableCell>
                          <TableCell className="text-gray-700 dark:text-zinc-300">{row.produto}</TableCell>
                          <TableCell className="text-gray-700 dark:text-zinc-300">{row.squad}</TableCell>
                          <TableCell className="text-right text-gray-900 dark:text-white">{row.max_contratos}</TableCell>
                          <TableCell className="text-right text-gray-900 dark:text-white">{row.contratos_atuais}</TableCell>
                          <TableCell className={cn("text-right font-semibold", getUtilizacaoColor(row.utilizacao_pct))}>
                            {row.utilizacao_pct}%
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(row.id)}
                              disabled={deleteMutation.isPending}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
