import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PHASE_CONFIG, groupStatusIntoPhases } from "@/lib/tech-utils";

export default function TechResponsavel() {
  const [selectedPO, setSelectedPO] = useState<string>("");

  // Fetch PO list from board
  const { data: boardData } = useQuery<{ responsavel: string; projetos: any[]; total: number }[]>({
    queryKey: ["/api/tech/board"],
  });

  const poList = boardData
    ? [...new Set(boardData.map((b) => b.responsavel).filter(Boolean))].sort()
    : [];

  // Auto-select first PO
  if (!selectedPO && poList.length > 0) {
    setSelectedPO(poList[0]);
  }

  // KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery<{
    projetosAtivos: number;
    projetosConcluidos: number;
    tempoMedioDeploy: number;
    taxaNoPrazo: number;
    carga: string;
    projetosAtivosList: any[];
  }>({
    queryKey: ["/api/tech/responsavel", selectedPO, "kpis"],
    queryFn: () => fetch(`/api/tech/responsavel/${encodeURIComponent(selectedPO)}/kpis`).then((r) => r.json()),
    enabled: !!selectedPO,
  });

  // Tempo deploy by quarter
  const { data: tempoDeployData } = useQuery<{ media_dias: number; trimestre: string }[]>({
    queryKey: ["/api/tech/tempo-deploy", selectedPO],
    queryFn: () => fetch(`/api/tech/tempo-deploy?meses=12&responsavel=${encodeURIComponent(selectedPO)}`).then((r) => r.json()),
    enabled: !!selectedPO,
  });

  // Prazo por status
  const { data: prazoPorStatusData } = useQuery<{ status: string; media_dias: number; total_transicoes: number }[]>({
    queryKey: ["/api/tech/prazo-por-status", selectedPO],
    queryFn: () => fetch(`/api/tech/prazo-por-status?responsavel=${encodeURIComponent(selectedPO)}`).then((r) => r.json()),
    enabled: !!selectedPO,
  });

  const phases = prazoPorStatusData ? groupStatusIntoPhases(prazoPorStatusData) : [];
  const maxPhaseDays = phases.length > 0 ? Math.max(...phases.map((p) => p.media_dias)) : 1;

  const cargaColor = kpis?.carga === "alta" ? "destructive" : kpis?.carga === "media" ? "warning" : "success";
  const cargaLabel = kpis?.carga === "alta" ? "Carga Alta" : kpis?.carga === "media" ? "Carga Média" : "Carga OK";

  function getUrgenciaStyle(urgencia: string) {
    const u = (urgencia || "").toLowerCase();
    if (u.includes("atrasado")) return { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" };
    if (u.includes("risco")) return { dot: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" };
    return { dot: "bg-green-500", text: "text-green-600 dark:text-green-400" };
  }

  function getTaxaColor(taxa: number) {
    if (taxa >= 80) return "text-green-600 dark:text-green-400";
    if (taxa >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/tech" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-medium">Estatísticas por Responsável</h1>
        </div>
        <Select value={selectedPO} onValueChange={setSelectedPO}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Selecionar responsável..." />
          </SelectTrigger>
          <SelectContent>
            {poList.map((po) => (
              <SelectItem key={po} value={po}>{po}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {!selectedPO ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Selecione um responsável para ver as estatísticas
        </div>
      ) : kpisLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Section 1 — KPIs */}
          <div className="flex items-center gap-2">
            <Badge variant={cargaColor as any}>{cargaLabel}</Badge>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border bg-card p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Projetos Ativos</p>
              <p className="text-3xl font-light mt-1">{kpis?.projetosAtivos ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Concluídos</p>
              <p className="text-3xl font-light mt-1">{kpis?.projetosConcluidos ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Tempo Médio Deploy</p>
              <p className="text-3xl font-light mt-1">{kpis?.tempoMedioDeploy ?? 0}<span className="text-sm text-muted-foreground ml-1">dias</span></p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Taxa No Prazo</p>
              <p className={`text-3xl font-light mt-1 ${getTaxaColor(kpis?.taxaNoPrazo ?? 0)}`}>
                {kpis?.taxaNoPrazo ?? 0}<span className="text-sm ml-0.5">%</span>
              </p>
            </div>
          </div>

          {/* Section 2 — Projetos Ativos */}
          <div className="rounded-lg border bg-card">
            <div className="p-5 border-b">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">Projetos Ativos</h2>
                <Badge variant="secondary" className="text-xs">{kpis?.projetosAtivosList?.length ?? 0}</Badge>
              </div>
            </div>
            {kpis?.projetosAtivosList && kpis.projetosAtivosList.length > 0 ? (
              <div className="divide-y">
                <div className="grid grid-cols-5 gap-4 px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <span>Nome</span>
                  <span>Status</span>
                  <span>Fase</span>
                  <span>Prazo</span>
                  <span>Urgência</span>
                </div>
                {kpis.projetosAtivosList.map((proj: any, i: number) => {
                  const urg = getUrgenciaStyle(proj.urgencia || "No Prazo");
                  return (
                    <div key={i} className="grid grid-cols-5 gap-4 px-5 py-3 text-sm hover:bg-muted/50 transition-colors">
                      <span className="font-medium truncate">{proj.taskName}</span>
                      <span className="text-muted-foreground truncate">{proj.statusProjeto || "\u2014"}</span>
                      <span className="text-muted-foreground truncate">{proj.faseProjeto || "\u2014"}</span>
                      <span className="text-muted-foreground">{proj.dataVencimento ? new Date(proj.dataVencimento).toLocaleDateString("pt-BR") : "\u2014"}</span>
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${urg.dot}`} />
                        <span className={urg.text}>{proj.urgencia || "No Prazo"}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum projeto ativo
              </div>
            )}
          </div>

          {/* Section 3 — Performance Histórica */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tempo de Deploy */}
            <div className="rounded-lg border bg-card p-5">
              <h2 className="text-sm font-medium mb-4">Tempo de Deploy</h2>
              {tempoDeployData && tempoDeployData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={tempoDeployData}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`${Math.round(value * 10) / 10} dias`, "Média"]}
                    />
                    <Bar dataKey="media_dias" fill="hsl(var(--primary))" opacity={0.6} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados de deploy
                </div>
              )}
            </div>

            {/* Tempo por Fase */}
            <div className="rounded-lg border bg-card p-5">
              <h2 className="text-sm font-medium mb-4">Tempo por Fase</h2>
              {phases.length > 0 ? (
                <div className="space-y-3">
                  {phases.map((phase) => (
                    <div key={phase.label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28 truncate text-right">{phase.label}</span>
                      <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${Math.max((phase.media_dias / maxPhaseDays) * 100, 4)}%`,
                            backgroundColor: phase.color,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-14 text-right">{phase.media_dias}d</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados de fases
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
