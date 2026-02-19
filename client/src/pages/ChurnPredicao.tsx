import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ShieldAlert,
  Shield,
  ShieldCheck,
  DollarSign,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  TrendingDown,
  Loader2,
  Target,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────

interface RiskFactor {
  sinal: string;
  peso: number;
  valor: number;
  descricao: string;
}

interface ChurnRiskScore {
  contratoId: string;
  clienteNome: string | null;
  cnpj: string | null;
  score: number;
  tier: "baixo" | "moderado" | "alto" | "critico";
  fatores: RiskFactor[];
  mrr: number;
  squad: string | null;
  produto: string | null;
  csResponsavel: string | null;
}

interface RiskSummary {
  totalContratos: number;
  critico: number;
  alto: number;
  moderado: number;
  baixo: number;
  mrrEmRisco: number;
  mrrCritico: number;
  mrrAlto: number;
}

// ── Helpers ────────────────────────────────────────────

const TIER_CONFIG = {
  critico: {
    label: "Critico",
    color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    barColor: "bg-red-500",
    icon: ShieldAlert,
    cardBorder: "border-red-500/30",
    cardBg: "bg-red-500/5",
  },
  alto: {
    label: "Alto",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    barColor: "bg-orange-500",
    icon: AlertTriangle,
    cardBorder: "border-orange-500/30",
    cardBg: "bg-orange-500/5",
  },
  moderado: {
    label: "Moderado",
    color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    barColor: "bg-yellow-500",
    icon: Shield,
    cardBorder: "border-yellow-500/30",
    cardBg: "bg-yellow-500/5",
  },
  baixo: {
    label: "Baixo",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    barColor: "bg-emerald-500",
    icon: ShieldCheck,
    cardBorder: "border-emerald-500/30",
    cardBg: "bg-emerald-500/5",
  },
} as const;

function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function ScoreBar({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 76) return "bg-red-500";
    if (score >= 51) return "bg-orange-500";
    if (score >= 31) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getColor()}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono font-bold w-8 text-right">{score}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export default function ChurnPredicao() {
  usePageTitle("Predição de Churn");
  useSetPageInfo("Predição de Churn", "Identificação proativa de contratos em risco");

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("todos");
  const [squadFilter, setSquadFilter] = useState<string>("todos");
  const [produtoFilter, setProdutoFilter] = useState<string>("todos");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Data fetching
  const { data: summary, isLoading: summaryLoading } = useQuery<RiskSummary>({
    queryKey: ["/api/churn-risk/summary"],
  });

  const { data: scores, isLoading: scoresLoading } = useQuery<ChurnRiskScore[]>({
    queryKey: ["/api/churn-risk/scores"],
  });

  const recalculateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/churn-risk/recalculate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/churn-risk"] });
    },
  });

  // Derived data
  const squads = useMemo(() => {
    if (!scores) return [];
    const set = new Set<string>();
    scores.forEach((s) => { if (s.squad) set.add(s.squad); });
    return Array.from(set).sort();
  }, [scores]);

  const produtos = useMemo(() => {
    if (!scores) return [];
    const set = new Set<string>();
    scores.forEach((s) => { if (s.produto) set.add(s.produto); });
    return Array.from(set).sort();
  }, [scores]);

  const filteredScores = useMemo(() => {
    if (!scores) return [];
    return scores.filter((s) => {
      if (tierFilter !== "todos" && s.tier !== tierFilter) return false;
      if (squadFilter !== "todos" && s.squad !== squadFilter) return false;
      if (produtoFilter !== "todos" && s.produto !== produtoFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchNome = s.clienteNome?.toLowerCase().includes(q);
        const matchCnpj = s.cnpj?.includes(q);
        const matchContrato = s.contratoId.toLowerCase().includes(q);
        if (!matchNome && !matchCnpj && !matchContrato) return false;
      }
      return true;
    });
  }, [scores, tierFilter, squadFilter, produtoFilter, search]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isLoading = summaryLoading || scoresLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <Target className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Predição de Churn
            </h1>
            <p className="text-muted-foreground text-sm">
              Identificação proativa de contratos em risco de cancelamento
            </p>
          </div>
        </div>
        <Button
          onClick={() => recalculateMutation.mutate()}
          disabled={recalculateMutation.isPending}
          variant="outline"
          className="gap-2"
        >
          {recalculateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Recalcular Scores
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(["critico", "alto", "moderado", "baixo"] as const).map((tier) => {
          const config = TIER_CONFIG[tier];
          const Icon = config.icon;
          const count = summary?.[tier] ?? 0;
          return (
            <Card
              key={tier}
              className={`border ${config.cardBorder} ${config.cardBg} cursor-pointer transition-all hover:scale-[1.02]`}
              onClick={() => setTierFilter(tierFilter === tier ? "todos" : tier)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <Badge variant="outline" className={config.color}>
                    {config.label}
                  </Badge>
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">contratos</p>
              </CardContent>
            </Card>
          );
        })}

        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                MRR em Risco
              </Badge>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyBR(summary?.mrrEmRisco ?? 0)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">critico + alto</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, CNPJ ou contrato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tiers</SelectItem>
            <SelectItem value="critico">Critico</SelectItem>
            <SelectItem value="alto">Alto</SelectItem>
            <SelectItem value="moderado">Moderado</SelectItem>
            <SelectItem value="baixo">Baixo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={squadFilter} onValueChange={setSquadFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Squad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Squads</SelectItem>
            {squads.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={produtoFilter} onValueChange={setProdutoFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Produtos</SelectItem>
            {produtos.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(tierFilter !== "todos" || squadFilter !== "todos" || produtoFilter !== "todos" || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTierFilter("todos");
              setSquadFilter("todos");
              setProdutoFilter("todos");
              setSearch("");
            }}
          >
            Limpar filtros
          </Button>
        )}

        <span className="text-sm text-muted-foreground ml-auto">
          {filteredScores.length} contratos
        </span>
      </div>

      {/* Table */}
      <Card className="border-gray-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-zinc-900/50">
                <TableHead className="w-8" />
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Tier</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead>Squad</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>CS Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredScores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {scores && scores.length === 0
                      ? 'Nenhum score calculado. Clique em "Recalcular Scores" para iniciar.'
                      : "Nenhum contrato encontrado com os filtros aplicados."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredScores.map((score) => {
                  const isExpanded = expandedRows.has(score.contratoId);
                  const tierConfig = TIER_CONFIG[score.tier];
                  const activeFactors = score.fatores.filter((f) => f.valor > 0);

                  return (
                    <>
                      <TableRow
                        key={score.contratoId}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                        onClick={() => toggleRow(score.contratoId)}
                      >
                        <TableCell className="w-8">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {score.clienteNome || "N/A"}
                            </p>
                            <p className="text-xs text-muted-foreground">{score.contratoId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ScoreBar score={score.score} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={tierConfig.color}>
                            {tierConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrencyBR(score.mrr)}
                        </TableCell>
                        <TableCell className="text-sm">{score.squad || "-"}</TableCell>
                        <TableCell className="text-sm">{score.produto || "-"}</TableCell>
                        <TableCell className="text-sm">{score.csResponsavel || "-"}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${score.contratoId}-detail`}>
                          <TableCell colSpan={8} className="bg-gray-50/50 dark:bg-zinc-900/30 p-0">
                            <div className="px-12 py-4 space-y-2">
                              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">
                                Fatores de Risco ({activeFactors.length} ativos)
                              </p>
                              {activeFactors.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum fator de risco significativo identificado.
                                </p>
                              ) : (
                                <div className="grid gap-2">
                                  {activeFactors
                                    .sort((a, b) => b.valor - a.valor)
                                    .map((fator, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-3 text-sm"
                                      >
                                        <div className="flex items-center gap-2 min-w-[160px]">
                                          <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
                                          <span className="font-medium text-gray-700 dark:text-zinc-300">
                                            {fator.sinal}
                                          </span>
                                        </div>
                                        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden max-w-[100px]">
                                          <div
                                            className={`h-full rounded-full ${
                                              fator.valor / fator.peso > 0.7
                                                ? "bg-red-500"
                                                : fator.valor / fator.peso > 0.4
                                                ? "bg-orange-500"
                                                : "bg-yellow-500"
                                            }`}
                                            style={{
                                              width: `${(fator.valor / fator.peso) * 100}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-xs font-mono text-muted-foreground w-12">
                                          {fator.valor}/{fator.peso}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {fator.descricao}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              )}
                              {score.cnpj && (
                                <p className="text-xs text-muted-foreground mt-3">
                                  CNPJ: {score.cnpj}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
