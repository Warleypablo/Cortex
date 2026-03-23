import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ExternalLink,
  Loader2,
  Settings2,
  CalendarDays,
  Save,
} from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

export default function PesquisasGG() {
  const { setPageInfo } = usePageInfo();
  usePageTitle("Pesquisas G&G");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [npsMes, setNpsMes] = useState("");
  const [showNpsConfig, setShowNpsConfig] = useState(false);

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [configMesRef, setConfigMesRef] = useState(mesAtual);
  const [configDataInicio, setConfigDataInicio] = useState("");
  const [configDataFim, setConfigDataFim] = useState("");

  useEffect(() => {
    setPageInfo("Pesquisas G&G", "E-NPS da equipe");
  }, [setPageInfo]);

  const { data: npsMeses } = useQuery<string[]>({
    queryKey: ["/api/rh/nps/meses"],
  });

  const { data: npsDashboard, isLoading: npsLoading } = useQuery<any>({
    queryKey: ["/api/rh/nps/dashboard", npsMes],
    queryFn: async () => {
      const url = npsMes ? `/api/rh/nps/dashboard?mes=${npsMes}` : "/api/rh/nps/dashboard";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
    staleTime: 0,
  });

  const { data: npsRespostas } = useQuery<any[]>({
    queryKey: ["/api/rh/nps/respostas", npsMes],
    queryFn: async () => {
      const url = npsMes ? `/api/rh/nps/respostas?mes=${npsMes}` : "/api/rh/nps/respostas";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
    staleTime: 0,
  });

  const { data: npsConfigData } = useQuery<any>({
    queryKey: ["/api/rh/nps/config", configMesRef],
    queryFn: async () => {
      const res = await fetch(`/api/rh/nps/config/${configMesRef}`, { credentials: "include" });
      return res.json();
    },
    enabled: showNpsConfig && !!configMesRef,
  });

  useEffect(() => {
    if (npsConfigData && npsConfigData.dataInicio) {
      setConfigDataInicio(npsConfigData.dataInicio);
      setConfigDataFim(npsConfigData.dataFim);
    } else if (npsConfigData === null) {
      setConfigDataInicio("");
      setConfigDataFim("");
    }
  }, [npsConfigData]);

  const saveNpsConfig = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/rh/nps/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mesReferencia: configMesRef,
          dataInicio: configDataInicio,
          dataFim: configDataFim,
          ativo: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração salva", description: `Período de atividade do E-NPS para ${configMesRef} foi configurado.` });
      queryClient.invalidateQueries({ queryKey: ["/api/rh/nps/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rh/nps/config-ativo"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header com filtro e link */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Select value={npsMes || "todos"} onValueChange={(v) => setNpsMes(v === "todos" ? "" : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {(npsMeses || []).map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showNpsConfig ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setShowNpsConfig(!showNpsConfig)}
          >
            <Settings2 className="w-4 h-4" />
            Configurar Período
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/rh/nps/responder">
              <ExternalLink className="w-4 h-4" />
              Responder Pesquisa
            </Link>
          </Button>
        </div>
      </div>

      {/* Configuração de Período de Atividade */}
      {showNpsConfig && (
        <Card className="p-5 border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold">Período de Atividade do E-NPS</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Mês Referência</Label>
              <Input
                type="month"
                value={configMesRef}
                onChange={(e) => setConfigMesRef(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Data Início</Label>
              <Input
                type="date"
                value={configDataInicio}
                onChange={(e) => setConfigDataInicio(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Data Fim</Label>
              <Input
                type="date"
                value={configDataFim}
                onChange={(e) => setConfigDataFim(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              className="gap-2 h-9"
              disabled={!configMesRef || !configDataInicio || !configDataFim || saveNpsConfig.isPending}
              onClick={() => saveNpsConfig.mutate()}
            >
              <Save className="w-4 h-4" />
              {saveNpsConfig.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          {npsConfigData && npsConfigData.dataInicio && (
            <p className="text-xs text-muted-foreground mt-3">
              Configuração atual para {configMesRef}: {new Date(npsConfigData.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(npsConfigData.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          )}
        </Card>
      )}

      {npsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !npsDashboard || npsDashboard.totalRespostas === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p>Nenhuma resposta encontrada {npsMes ? `para ${npsMes}` : ""}.</p>
          <p className="mt-2 text-sm">Compartilhe o link da pesquisa com os colaboradores.</p>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="text-sm text-muted-foreground mb-1">Total Respostas</div>
              <div className="text-3xl font-bold">{npsDashboard.totalRespostas}</div>
            </Card>
            {[
              { label: "NPS Empresa", data: npsDashboard.empresa, color: "blue" },
              { label: "NPS Líder", data: npsDashboard.lider, color: "purple" },
              { label: "NPS Produtos", data: npsDashboard.produtos, color: "amber" },
            ].map(({ label, data: d, color }) => {
              const npsColor = d.nps >= 50 ? "text-green-600 dark:text-green-400"
                : d.nps >= 0 ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400";
              return (
                <Card key={label} className="p-5">
                  <div className="text-sm text-muted-foreground mb-1">{label}</div>
                  <div className={`text-3xl font-bold ${npsColor}`}>{d.nps}</div>
                  <div className="text-xs text-muted-foreground mt-1">Média: {d.media}</div>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-green-600 dark:text-green-400">{d.promotores} promotores</span>
                    <span className="text-yellow-600 dark:text-yellow-400">{d.neutros} neutros</span>
                    <span className="text-red-600 dark:text-red-400">{d.detratores} detratores</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Distribuição de Scores</h3>
              <div className="space-y-4">
                {[
                  { label: "Empresa", data: npsDashboard.empresa },
                  { label: "Líder", data: npsDashboard.lider },
                  { label: "Produtos", data: npsDashboard.produtos },
                ].map(({ label, data: d }) => {
                  const total = d.promotores + d.neutros + d.detratores || 1;
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{label}</span>
                        <span>NPS: {d.nps}</span>
                      </div>
                      <div className="flex h-6 rounded-full overflow-hidden">
                        <div className="bg-green-500 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${(d.promotores / total) * 100}%` }}>
                          {d.promotores > 0 ? `${Math.round((d.promotores / total) * 100)}%` : ""}
                        </div>
                        <div className="bg-yellow-500 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${(d.neutros / total) * 100}%` }}>
                          {d.neutros > 0 ? `${Math.round((d.neutros / total) * 100)}%` : ""}
                        </div>
                        <div className="bg-red-500 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${(d.detratores / total) * 100}%` }}>
                          {d.detratores > 0 ? `${Math.round((d.detratores / total) * 100)}%` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> Promotores (9-10)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500" /> Neutros (7-8)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> Detratores (0-6)</span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Motivo de Permanência</h3>
              <div className="space-y-3">
                {(npsDashboard.motivos || []).map((m: any) => {
                  const pct = npsDashboard.totalRespostas > 0 ? Math.round((m.total / npsDashboard.totalRespostas) * 100) : 0;
                  return (
                    <div key={m.motivo} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[75%]">{m.motivo}</span>
                        <span className="font-medium">{m.total} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Por Área */}
          {(npsDashboard.porArea || []).length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Médias por Área</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Área</TableHead>
                      <TableHead className="text-center">Respostas</TableHead>
                      <TableHead className="text-center">Empresa</TableHead>
                      <TableHead className="text-center">Líder</TableHead>
                      <TableHead className="text-center">Produtos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(npsDashboard.porArea || []).map((a: any) => (
                      <TableRow key={a.area}>
                        <TableCell className="font-medium">{a.area}</TableCell>
                        <TableCell className="text-center">{a.total}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={a.mediaEmpresa >= 9 ? "text-green-600" : a.mediaEmpresa >= 7 ? "text-yellow-600" : "text-red-600"}>{a.mediaEmpresa}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={a.mediaLider >= 9 ? "text-green-600" : a.mediaLider >= 7 ? "text-yellow-600" : "text-red-600"}>{a.mediaLider}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={a.mediaProdutos >= 9 ? "text-green-600" : a.mediaProdutos >= 7 ? "text-yellow-600" : "text-red-600"}>{a.mediaProdutos}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Evolução mensal */}
          {(npsDashboard.evolucao || []).length > 1 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Evolução Mensal das Médias</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={npsDashboard.evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", color: "hsl(var(--card-foreground))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="mediaEmpresa" name="Empresa" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="mediaLider" name="Líder" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="mediaProdutos" name="Produtos" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Comentários recentes */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Comentários Anônimos</h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {(npsRespostas || []).slice(0, 30).map((r: any) => (
                <div key={r.id} className="border-b border-border pb-4 last:border-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{r.area}</Badge>
                    <Badge variant="outline" className={`text-xs ${r.scoreEmpresa >= 9 ? "text-green-600" : r.scoreEmpresa >= 7 ? "text-yellow-600" : "text-red-600"}`}>Empresa: {r.scoreEmpresa}</Badge>
                    <Badge variant="outline" className={`text-xs ${r.scoreLider >= 9 ? "text-green-600" : r.scoreLider >= 7 ? "text-yellow-600" : "text-red-600"}`}>Líder: {r.scoreLider}</Badge>
                    <Badge variant="outline" className={`text-xs ${r.scoreProdutos >= 9 ? "text-green-600" : r.scoreProdutos >= 7 ? "text-yellow-600" : "text-red-600"}`}>Produtos: {r.scoreProdutos}</Badge>
                  </div>
                  {r.comentarioEmpresa && (
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground font-medium">Sobre a empresa:</span>
                      <p className="text-muted-foreground">{r.comentarioEmpresa}</p>
                    </div>
                  )}
                  {r.comentarioLider && (
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground font-medium">Sobre o líder:</span>
                      <p className="text-muted-foreground">{r.comentarioLider}</p>
                    </div>
                  )}
                  {r.comentarioProdutos && (
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground font-medium">Sobre produtos:</span>
                      <p className="text-muted-foreground">{r.comentarioProdutos}</p>
                    </div>
                  )}
                  {r.feedbackGeral && (
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground font-medium">Feedback geral:</span>
                      <p className="text-muted-foreground">{r.feedbackGeral}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
