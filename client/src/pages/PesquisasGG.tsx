import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart2, 
  MessageSquare, 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users, 
  TrendingUp,
  Search,
  ExternalLink,
  Loader2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardData {
  enps: {
    score: number;
    mediaGeral: number;
    promotores: number;
    neutros: number;
    detratores: number;
    totalRespostas: number;
  };
  oneOnOne: {
    stats: {
      ok: number;
      atencao: number;
      atrasado: number;
      nunca: number;
    };
    colaboradores: Array<{
      colaboradorId: number;
      nome: string;
      squad: string | null;
      ultimaReuniao: string | null;
      totalReunioes: number;
      diasSemReuniao: number | null;
      status: "ok" | "atencao" | "atrasado" | "nunca";
    }>;
  };
  pdi: {
    stats: {
      comPdiAtivo: number;
      semPdi: number;
      totalPdisAtivos: number;
      progressoMedioGeral: number;
    };
    colaboradores: Array<{
      colaboradorId: number;
      nome: string;
      squad: string | null;
      pdiAtivos: number;
      pdiConcluidos: number;
      progressoMedio: number;
    }>;
  };
  recentEnps: Array<{
    id: number;
    score: number;
    comentario: string | null;
    data: string;
    colaboradorId: number;
    nome: string;
    squad: string | null;
  }>;
  alertas: Array<{
    tipo: string;
    colaborador: string;
    colaboradorId: number;
    mensagem: string;
    urgencia: "alta" | "media" | "baixa";
  }>;
}

function getEnpsScoreColor(score: number): string {
  if (score >= 50) return "text-green-600 dark:text-green-400";
  if (score >= 0) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getEnpsBgColor(score: number): string {
  if (score >= 9) return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
  if (score >= 7) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
  return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
}

function get1x1StatusConfig(status: string) {
  switch (status) {
    case "ok":
      return { label: "Em dia", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30", icon: CheckCircle2 };
    case "atencao":
      return { label: "Atenção", color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", icon: Clock };
    case "atrasado":
      return { label: "Atrasado", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30", icon: AlertTriangle };
    case "nunca":
      return { label: "Nunca", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-900/30", icon: XCircle };
    default:
      return { label: status, color: "text-muted-foreground", bgColor: "bg-muted", icon: Clock };
  }
}

export default function PesquisasGG() {
  const { setPageInfo } = usePageInfo();
  usePageTitle("Pesquisas G&G");
  
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [search1x1, setSearch1x1] = useState("");
  const [filter1x1, setFilter1x1] = useState("all");
  const [searchPdi, setSearchPdi] = useState("");

  useEffect(() => {
    setPageInfo("Pesquisas G&G", "Visão consolidada de e-NPS, 1x1 e PDI");
  }, [setPageInfo]);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/rh/pesquisas/dashboard"],
  });

  const filtered1x1 = data?.oneOnOne.colaboradores.filter(c => {
    const matchesSearch = c.nome.toLowerCase().includes(search1x1.toLowerCase());
    const matchesFilter = filter1x1 === "all" || c.status === filter1x1;
    return matchesSearch && matchesFilter;
  }) || [];

  const filteredPdi = data?.pdi.colaboradores.filter(c => 
    c.nome.toLowerCase().includes(searchPdi.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Erro ao carregar dados
      </div>
    );
  }

  const totalColaboradores = data.oneOnOne.stats.ok + data.oneOnOne.stats.atencao + data.oneOnOne.stats.atrasado + data.oneOnOne.stats.nunca;

  return (
    <div className="p-6 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6" data-testid="tabs-pesquisas">
          <TabsTrigger value="visao-geral" data-testid="tab-visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="enps" data-testid="tab-enps">E-NPS</TabsTrigger>
          <TabsTrigger value="1x1" data-testid="tab-1x1">1x1</TabsTrigger>
          <TabsTrigger value="pdi" data-testid="tab-pdi">PDI</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5" data-testid="card-enps-summary">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <Badge variant="secondary" className="text-xs">E-NPS</Badge>
              </div>
              <div className="mt-4">
                <p className={`text-3xl font-bold ${getEnpsScoreColor(data.enps.score)}`} data-testid="text-enps-score">
                  {data.enps.score}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Score E-NPS</p>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="text-green-600">{data.enps.promotores} promotores</span>
                <span className="text-yellow-600">{data.enps.neutros} neutros</span>
                <span className="text-red-600">{data.enps.detratores} detratores</span>
              </div>
            </Card>

            <Card className="p-5" data-testid="card-1x1-summary">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <Badge variant="secondary" className="text-xs">1x1</Badge>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold" data-testid="text-1x1-ok">
                  {Math.round((data.oneOnOne.stats.ok / totalColaboradores) * 100)}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">Em dia</p>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="text-green-600">{data.oneOnOne.stats.ok} ok</span>
                <span className="text-yellow-600">{data.oneOnOne.stats.atencao} atenção</span>
                <span className="text-red-600">{data.oneOnOne.stats.atrasado + data.oneOnOne.stats.nunca} crítico</span>
              </div>
            </Card>

            <Card className="p-5" data-testid="card-pdi-summary">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <Badge variant="secondary" className="text-xs">PDI</Badge>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold" data-testid="text-pdi-ativos">
                  {data.pdi.stats.totalPdisAtivos}
                </p>
                <p className="text-sm text-muted-foreground mt-1">PDIs ativos</p>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{data.pdi.stats.comPdiAtivo} com PDI</span>
                <span className="text-yellow-600">{data.pdi.stats.semPdi} sem PDI</span>
              </div>
            </Card>

            <Card className="p-5" data-testid="card-alertas-summary">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <Badge variant="secondary" className="text-xs">Alertas</Badge>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-alertas-count">
                  {data.alertas.length}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Itens de atenção</p>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {data.alertas.filter(a => a.urgencia === "alta").length} de alta prioridade
              </div>
            </Card>
          </div>

          {data.alertas.length > 0 && (
            <Card className="p-6" data-testid="card-alertas-list">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Alertas de Atenção</h3>
                  <p className="text-xs text-muted-foreground">Colaboradores que precisam de acompanhamento</p>
                </div>
              </div>
              <div className="space-y-2">
                {data.alertas.slice(0, 8).map((alerta, idx) => (
                  <div 
                    key={`${alerta.colaboradorId}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                    data-testid={`alerta-${alerta.colaboradorId}-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="secondary"
                        className={alerta.urgencia === "alta" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"}
                      >
                        {alerta.tipo}
                      </Badge>
                      <span className="font-medium text-sm">{alerta.colaborador}</span>
                      <span className="text-sm text-muted-foreground">{alerta.mensagem}</span>
                    </div>
                    <Link href={`/colaborador/${alerta.colaboradorId}`}>
                      <Button size="sm" variant="ghost" data-testid={`button-ver-alerta-${alerta.colaboradorId}`}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-6" data-testid="card-recent-enps">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold">Últimas Respostas E-NPS</h3>
                <p className="text-xs text-muted-foreground">Respostas mais recentes da equipe</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Comentário</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentEnps.slice(0, 10).map((enps) => (
                  <TableRow key={enps.id} data-testid={`row-enps-${enps.id}`}>
                    <TableCell>
                      <Link href={`/colaborador/${enps.colaboradorId}`} className="font-medium hover:underline">
                        {enps.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{enps.squad || "-"}</TableCell>
                    <TableCell>
                      <Badge className={`${getEnpsBgColor(enps.score)}`}>
                        {enps.score}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                      {enps.comentario || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(enps.data), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="enps" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 text-center" data-testid="card-enps-promotores">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-4xl font-bold text-green-600 dark:text-green-400">{data.enps.promotores}</p>
              <p className="text-sm text-muted-foreground mt-1">Promotores (9-10)</p>
            </Card>
            <Card className="p-6 text-center" data-testid="card-enps-neutros">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-3">
                <Users className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="text-4xl font-bold text-yellow-600 dark:text-yellow-400">{data.enps.neutros}</p>
              <p className="text-sm text-muted-foreground mt-1">Neutros (7-8)</p>
            </Card>
            <Card className="p-6 text-center" data-testid="card-enps-detratores">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-3">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-4xl font-bold text-red-600 dark:text-red-400">{data.enps.detratores}</p>
              <p className="text-sm text-muted-foreground mt-1">Detratores (0-6)</p>
            </Card>
          </div>

          <Card className="p-6" data-testid="card-enps-all">
            <h3 className="font-semibold mb-4">Todas as Respostas E-NPS</h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Comentário</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentEnps.map((enps) => (
                  <TableRow key={enps.id} data-testid={`row-all-enps-${enps.id}`}>
                    <TableCell>
                      <Link href={`/colaborador/${enps.colaboradorId}`} className="font-medium hover:underline">
                        {enps.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{enps.squad || "-"}</TableCell>
                    <TableCell className="font-bold">{enps.score}</TableCell>
                    <TableCell>
                      <Badge className={`${getEnpsBgColor(enps.score)}`}>
                        {enps.score >= 9 ? "Promotor" : enps.score >= 7 ? "Neutro" : "Detrator"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                      {enps.comentario || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(enps.data), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="1x1" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center" data-testid="card-1x1-ok-count">
              <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.oneOnOne.stats.ok}</p>
              <p className="text-xs text-muted-foreground">Em dia</p>
            </Card>
            <Card className="p-4 text-center" data-testid="card-1x1-atencao-count">
              <Clock className="w-8 h-8 mx-auto text-yellow-600 dark:text-yellow-400 mb-2" />
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{data.oneOnOne.stats.atencao}</p>
              <p className="text-xs text-muted-foreground">Atenção (15-30d)</p>
            </Card>
            <Card className="p-4 text-center" data-testid="card-1x1-atrasado-count">
              <AlertTriangle className="w-8 h-8 mx-auto text-red-600 dark:text-red-400 mb-2" />
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.oneOnOne.stats.atrasado}</p>
              <p className="text-xs text-muted-foreground">Atrasado (30+d)</p>
            </Card>
            <Card className="p-4 text-center" data-testid="card-1x1-nunca-count">
              <XCircle className="w-8 h-8 mx-auto text-gray-600 dark:text-gray-400 mb-2" />
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{data.oneOnOne.stats.nunca}</p>
              <p className="text-xs text-muted-foreground">Nunca teve</p>
            </Card>
          </div>

          <Card className="p-6" data-testid="card-1x1-list">
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar colaborador..." 
                  className="pl-9"
                  value={search1x1}
                  onChange={(e) => setSearch1x1(e.target.value)}
                  data-testid="input-search-1x1"
                />
              </div>
              <Select value={filter1x1} onValueChange={setFilter1x1}>
                <SelectTrigger className="w-[150px]" data-testid="select-filter-1x1">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ok">Em dia</SelectItem>
                  <SelectItem value="atencao">Atenção</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="nunca">Nunca</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Última 1x1</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered1x1.map((c) => {
                  const statusConfig = get1x1StatusConfig(c.status);
                  return (
                    <TableRow key={c.colaboradorId} data-testid={`row-1x1-${c.colaboradorId}`}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{c.squad || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.ultimaReuniao ? format(new Date(c.ultimaReuniao), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className={statusConfig.color}>
                        {c.diasSemReuniao !== null ? c.diasSemReuniao : "-"}
                      </TableCell>
                      <TableCell>{c.totalReunioes}</TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/colaborador/${c.colaboradorId}`}>
                          <Button size="sm" variant="ghost" data-testid={`button-ver-1x1-${c.colaboradorId}`}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pdi" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center" data-testid="card-pdi-total">
              <Target className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{data.pdi.stats.totalPdisAtivos}</p>
              <p className="text-xs text-muted-foreground">PDIs ativos</p>
            </Card>
            <Card className="p-4 text-center" data-testid="card-pdi-com">
              <Users className="w-8 h-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.pdi.stats.comPdiAtivo}</p>
              <p className="text-xs text-muted-foreground">Com PDI ativo</p>
            </Card>
            <Card className="p-4 text-center" data-testid="card-pdi-sem">
              <AlertTriangle className="w-8 h-8 mx-auto text-yellow-600 dark:text-yellow-400 mb-2" />
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{data.pdi.stats.semPdi}</p>
              <p className="text-xs text-muted-foreground">Sem PDI</p>
            </Card>
            <Card className="p-4 text-center" data-testid="card-pdi-progresso">
              <TrendingUp className="w-8 h-8 mx-auto text-blue-600 dark:text-blue-400 mb-2" />
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.pdi.stats.progressoMedioGeral}%</p>
              <p className="text-xs text-muted-foreground">Progresso médio</p>
            </Card>
          </div>

          <Card className="p-6" data-testid="card-pdi-list">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar colaborador..." 
                  className="pl-9"
                  value={searchPdi}
                  onChange={(e) => setSearchPdi(e.target.value)}
                  data-testid="input-search-pdi"
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>PDIs Ativos</TableHead>
                  <TableHead>Concluídos</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPdi.map((c) => (
                  <TableRow key={c.colaboradorId} data-testid={`row-pdi-${c.colaboradorId}`}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.squad || "-"}</TableCell>
                    <TableCell>
                      {c.pdiAtivos > 0 ? (
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          {c.pdiAtivos}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>{c.pdiConcluidos}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={c.progressoMedio} className="w-20 h-2" />
                        <span className="text-sm text-muted-foreground">{c.progressoMedio}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/colaborador/${c.colaboradorId}`}>
                        <Button size="sm" variant="ghost" data-testid={`button-ver-pdi-${c.colaboradorId}`}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
