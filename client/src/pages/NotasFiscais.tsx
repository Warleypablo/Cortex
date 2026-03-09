import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  FileText, Upload, FolderSearch, AlertTriangle, CheckCircle2,
  DollarSign, Hash, TrendingUp, Loader2, RotateCcw
} from "lucide-react";

const MONTHS = [
  { value: "01 - JANEIRO", num: "1", label: "Janeiro" },
  { value: "02 - FEVEREIRO", num: "2", label: "Fevereiro" },
  { value: "03 - MARÇO", num: "3", label: "Março" },
  { value: "04 - ABRIL", num: "4", label: "Abril" },
  { value: "05 - MAIO", num: "5", label: "Maio" },
  { value: "06 - JUNHO", num: "6", label: "Junho" },
  { value: "07 - JULHO", num: "7", label: "Julho" },
  { value: "08 - AGOSTO", num: "8", label: "Agosto" },
  { value: "09 - SETEMBRO", num: "9", label: "Setembro" },
  { value: "10 - OUTUBRO", num: "10", label: "Outubro" },
  { value: "11 - NOVEMBRO", num: "11", label: "Novembro" },
  { value: "12 - DEZEMBRO", num: "12", label: "Dezembro" },
];

const CATEGORIAS = [
  "Fixo", "Freelancer", "Faturas", "Impostos", "Reembolso",
  "Serviços Tomados", "Variável", "Cupom Fiscal", "Invoices"
];

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#84cc16"
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ---- KPI Cards ----

function KPICards({ totais }: { totais: any }) {
  if (!totais) return null;
  const cards = [
    { title: "Total NFs", value: Number(totais.total_nfs || 0), icon: FileText, color: "text-blue-500" },
    { title: "Processadas OK", value: Number(totais.total_ok || 0), icon: CheckCircle2, color: "text-emerald-500" },
    { title: "Com Erro", value: Number(totais.total_erros || 0), icon: AlertTriangle, color: "text-amber-500" },
    { title: "Valor Total", value: formatCurrency(Number(totais.valor_total || 0)), icon: DollarSign, color: "text-green-500", isCurrency: true },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.title} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{c.title}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {c.isCurrency ? c.value : c.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Upload Dialog ----

function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [mes, setMes] = useState("");
  const [categoria, setCategoria] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!files || !mes || !categoria) throw new Error("Preencha todos os campos");
      const monthObj = MONTHS.find(m => m.value === mes);
      const formData = new FormData();
      formData.append("mes", mes);
      formData.append("mes_num", monthObj?.num || "1");
      formData.append("categoria", categoria);
      formData.append("ano", "2026");
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch("/api/notas-fiscais/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro no upload");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notas-fiscais/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notas-fiscais/detalhado"] });
      setOpen(false);
      setFiles(null);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" /> Upload NFs
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">Upload de Notas Fiscais</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-gray-700 dark:text-zinc-300">Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-700 dark:text-zinc-300">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-700 dark:text-zinc-300">Arquivos PDF</Label>
            <Input
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending || !mes || !categoria || !files?.length}
            className="w-full"
          >
            {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Processar {files?.length || 0} arquivo(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Visão Geral Tab ----

function VisaoGeralTab({ data }: { data: any }) {
  if (!data) return null;
  const { resumoMensal, resumoCategoria, topPrestadores } = data;

  const monthChartData = (resumoMensal || []).map((r: any) => ({
    name: (r.mes || "").replace(/^\d{2}\s*-\s*/, "").substring(0, 3),
    total: Number(r.total || 0),
    qtd: Number(r.qtd || 0),
    erros: Number(r.erro_count || 0),
  }));

  const catChartData = (resumoCategoria || []).map((r: any, i: number) => ({
    name: r.categoria,
    value: Number(r.total || 0),
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Evolução Mensal */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" /> Evolução Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => formatCurrencyFull(value)}
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Valor Total" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 dark:text-zinc-400 text-center py-8">Nenhum dado ainda. Processe as NFs primeiro.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Categoria */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white text-base">Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {catChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={catChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {catChartData.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrencyFull(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 dark:text-zinc-400 text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Top Prestadores */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white text-base">Top Prestadores</CardTitle>
          </CardHeader>
          <CardContent>
            {(topPrestadores || []).length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {(topPrestadores || []).slice(0, 15).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-zinc-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 dark:text-zinc-500 w-5">{i + 1}</span>
                      <span className="text-sm text-gray-800 dark:text-zinc-200 truncate max-w-[200px]">{p.prestador}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(p.total || 0))}</span>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 ml-2">({p.qtd} NFs)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-zinc-400 text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---- Detalhado Tab ----

function DetalhadoTab({ filterMes, filterCat, filterStatus }: { filterMes: string; filterCat: string; filterStatus: string }) {
  const { data: rows = [] } = useQuery<any[]>({
    queryKey: ["/api/notas-fiscais/detalhado"],
  });

  const filtered = rows.filter((r: any) => {
    if (filterMes && String(r.mes_num) !== filterMes) return false;
    if (filterCat && r.categoria !== filterCat) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-zinc-700">
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Mês</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Categoria</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Prestador</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Arquivo</th>
            <th className="text-right py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Valor</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Moeda</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Padrão</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center py-8 text-gray-500 dark:text-zinc-400">
                Nenhuma NF encontrada
              </td>
            </tr>
          ) : (
            filtered.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                <td className="py-2 px-3 text-gray-800 dark:text-zinc-200">{(r.mes || "").replace(/^\d{2}\s*-\s*/, "").substring(0, 3)}</td>
                <td className="py-2 px-3 text-gray-800 dark:text-zinc-200">{r.categoria}</td>
                <td className="py-2 px-3 text-gray-800 dark:text-zinc-200 max-w-[180px] truncate">{r.prestador}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-zinc-400 max-w-[200px] truncate text-xs">{r.arquivo}</td>
                <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                  {r.valor_brl ? formatCurrencyFull(Number(r.valor_brl)) : "—"}
                </td>
                <td className="py-2 px-3 text-gray-600 dark:text-zinc-400">{r.moeda_original}</td>
                <td className="py-2 px-3 text-gray-500 dark:text-zinc-500 text-xs max-w-[150px] truncate">{r.padrao_usado}</td>
                <td className="py-2 px-3">
                  <Badge variant={r.status === "OK" ? "default" : "destructive"} className="text-xs">
                    {r.status}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-2">{filtered.length} resultado(s)</p>
    </div>
  );
}

// ---- Erros Tab ----

function ErrosTab({ erros }: { erros: any[] }) {
  if (!erros?.length) {
    return <p className="text-center py-8 text-gray-500 dark:text-zinc-400">Nenhum erro encontrado</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-zinc-700">
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Mês</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Categoria</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Prestador</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Arquivo</th>
            <th className="text-left py-2 px-3 text-gray-600 dark:text-zinc-400 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {erros.map((r: any) => (
            <tr key={r.id} className="border-b border-gray-100 dark:border-zinc-800">
              <td className="py-2 px-3 text-gray-800 dark:text-zinc-200">{(r.mes || "").replace(/^\d{2}\s*-\s*/, "").substring(0, 3)}</td>
              <td className="py-2 px-3 text-gray-800 dark:text-zinc-200">{r.categoria}</td>
              <td className="py-2 px-3 text-gray-800 dark:text-zinc-200">{r.prestador}</td>
              <td className="py-2 px-3 text-gray-600 dark:text-zinc-400 text-xs">{r.arquivo}</td>
              <td className="py-2 px-3">
                <Badge variant="destructive" className="text-xs">{r.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Conciliação Tab ----

function ConciliacaoTab() {
  const { data } = useQuery<any>({
    queryKey: ["/api/notas-fiscais/conciliacao"],
  });

  if (!data) return <p className="text-center py-8 text-gray-500 dark:text-zinc-400">Carregando...</p>;

  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Merge NF and CAZ data by month
  const merged = monthNames.map((name, i) => {
    const mesNum = i + 1;
    const nf = (data.nfByMonth || []).find((r: any) => Number(r.mes_num) === mesNum);
    const caz = (data.cazByMonth || []).find((r: any) => Number(r.mes_num) === mesNum);
    return {
      name,
      nf_total: Number(nf?.nf_total || 0),
      caz_total: Number(caz?.caz_total || 0),
    };
  }).filter(m => m.nf_total > 0 || m.caz_total > 0);

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white text-base">NFs vs Conta Azul (mensal)</CardTitle>
        </CardHeader>
        <CardContent>
          {merged.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={merged}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => formatCurrencyFull(value)}
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                />
                <Legend />
                <Bar dataKey="nf_total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Notas Fiscais" />
                <Bar dataKey="caz_total" fill="#10b981" radius={[4, 4, 0, 0]} name="Conta Azul" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 dark:text-zinc-400 text-center py-8">Sem dados para conciliação</p>
          )}
        </CardContent>
      </Card>

      {/* Category breakdown */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white text-base">Total NFs por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data.nfByCategory || []).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-zinc-800 last:border-0">
                <span className="text-sm text-gray-800 dark:text-zinc-200">{c.categoria}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(c.nf_total || 0))}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Main Page ----

export default function NotasFiscais() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [filterMes, setFilterMes] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { data: dashboardData, isLoading } = useQuery<any>({
    queryKey: ["/api/notas-fiscais/dashboard"],
  });

  const [scanError, setScanError] = useState<string | null>(null);

  const scanMutation = useMutation({
    mutationFn: async () => {
      setScanError(null);
      const res = await fetch("/api/notas-fiscais/scan-local", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notas-fiscais/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notas-fiscais/detalhado"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notas-fiscais/conciliacao"] });
    },
    onError: (error: any) => {
      setScanError(error.message || "Erro desconhecido no scan");
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/notas-fiscais/reset?ano=2026");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notas-fiscais/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notas-fiscais/detalhado"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notas-fiscais/conciliacao"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-500" /> Notas Fiscais
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Gestão e extração de valores de notas fiscais — 2026</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <UploadDialog />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSearch className="w-4 h-4" />}
            {scanMutation.isPending ? "Processando..." : "Processar Pasta Local"}
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-red-500 hover:text-red-600"
                onClick={() => {
                  if (confirm("Tem certeza? Isso apagará todas as NFs processadas de 2026.")) {
                    resetMutation.mutate();
                  }
                }}
                disabled={resetMutation.isPending}
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Scan result feedback */}
      {scanMutation.isSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm text-emerald-700 dark:text-emerald-300">
          Scan concluído: {(scanMutation.data as any)?.totalProcessed || 0} processadas, {(scanMutation.data as any)?.totalErrors || 0} erros, {(scanMutation.data as any)?.total || 0} total
        </div>
      )}
      {scanError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          Erro no scan: {scanError}
        </div>
      )}

      {/* KPIs */}
      <KPICards totais={dashboardData?.totais} />

      {/* Tabs */}
      <Tabs defaultValue="visao-geral" className="w-full">
        <TabsList className="bg-gray-100 dark:bg-zinc-800">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="detalhado">
            Detalhado
            {dashboardData?.totais?.total_nfs > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">{Number(dashboardData.totais.total_nfs)}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="erros">
            Erros
            {dashboardData?.erros?.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-xs">{dashboardData.erros.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-4">
          <VisaoGeralTab data={dashboardData} />
        </TabsContent>

        <TabsContent value="detalhado" className="mt-4">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader>
              <div className="flex flex-wrap gap-3 items-center">
                <Select value={filterMes} onValueChange={setFilterMes}>
                  <SelectTrigger className="w-[130px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {MONTHS.map(m => (
                      <SelectItem key={m.num} value={m.num}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCat} onValueChange={setFilterCat}>
                  <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="OK">OK</SelectItem>
                    <SelectItem value="SEM_TEXTO">Sem Texto</SelectItem>
                    <SelectItem value="PROTEGIDO">Protegido</SelectItem>
                    <SelectItem value="VALOR NÃO ENCONTRADO">Valor não encontrado</SelectItem>
                  </SelectContent>
                </Select>
                {(filterMes || filterCat || filterStatus) && (
                  <Button variant="ghost" size="sm" onClick={() => { setFilterMes(""); setFilterCat(""); setFilterStatus(""); }}>
                    Limpar filtros
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <DetalhadoTab
                filterMes={filterMes === "all" ? "" : filterMes}
                filterCat={filterCat === "all" ? "" : filterCat}
                filterStatus={filterStatus === "all" ? "" : filterStatus}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="erros" className="mt-4">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> NFs com Problemas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ErrosTab erros={dashboardData?.erros || []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conciliacao" className="mt-4">
          <ConciliacaoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
