import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays } from "date-fns";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatsCard from "@/components/StatsCard";
import { formatCurrency, formatDecimal } from "@/lib/utils";
import type { ContratoCompleto } from "@shared/schema";
import { FileText, DollarSign, TrendingUp, Clock, Layers } from "lucide-react";

type TipoContratoFiltro = "ambos" | "recorrente" | "pontual";

type ContractRow = ContratoCompleto & {
  mrr: number;
  pontual: number;
  ltDias: number;
  ltMeses: number;
  ltv: number;
};

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
};

const formatLT = (ltMeses: number, ltDias: number) => {
  if (ltMeses >= 1) return `${formatDecimal(ltMeses, 1).replace(".", ",")} m`;
  return `${ltDias} d`;
};

const normalizeServico = (servico: string): string => {
  const s = servico.trim();
  const lower = s.toLowerCase();
  if (/^e-?commerce$/.test(lower) || lower === "marketplace") return "E-commerce";
  if (/^e-?mail\s*(marketing|mkt)?$/.test(lower)) return "E-mail Marketing";
  if (/^perfo?r?mance$/.test(lower)) return "Performance";
  if (/^social\s*media$/.test(lower)) return "Social Media";
  if (/^gestao\s*de\s*perfo?r?mance$/i.test(lower.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) return "Gestão de Performance";
  return s;
};

export default function ContratosDetalhamento() {
  usePageTitle("Detalhamento de Contratos");
  useSetPageInfo("Detalhamento de Contratos", "Dashboard completo de contratos (LT, LTV, serviços e produtos)");

  const { data: contratos = [], isLoading } = useQuery<ContratoCompleto[]>({
    queryKey: ["/api/contratos"],
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [squadFilter, setSquadFilter] = useState("all");
  const [servicoFilter, setServicoFilter] = useState("all");
  const [produtoFilter, setProdutoFilter] = useState("all");
  const [tipoContratoFilter, setTipoContratoFilter] = useState<TipoContratoFiltro>("ambos");

  const contratosEnriquecidos = useMemo<ContractRow[]>(() => {
    return contratos.map((contrato) => {
      const inicio = contrato.dataInicio ? new Date(contrato.dataInicio) : null;
      const encerramento = contrato.dataEncerramento ? new Date(contrato.dataEncerramento) : new Date();
      const ltDias = inicio ? Math.max(0, differenceInDays(encerramento, inicio)) : 0;
      const ltMeses = inicio ? Math.max(0, Math.round((ltDias / 30) * 10) / 10) : 0;
      const mrr = parseFloat(contrato.valorr || "0") || 0;
      const pontual = parseFloat(contrato.valorp || "0") || 0;
      const ltv = (mrr * ltMeses) + pontual;

      return {
        ...contrato,
        mrr,
        pontual,
        ltDias,
        ltMeses,
        ltv,
      };
    });
  }, [contratos]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    contratosEnriquecidos.forEach((c) => {
      if (c.status) values.add(c.status);
    });
    return Array.from(values).sort();
  }, [contratosEnriquecidos]);

  const squadOptions = useMemo(() => {
    const values = new Set<string>();
    contratosEnriquecidos.forEach((c) => {
      if (c.squad) values.add(c.squad);
    });
    return Array.from(values).sort();
  }, [contratosEnriquecidos]);

  const servicoOptions = useMemo(() => {
    const values = new Set<string>();
    contratosEnriquecidos.forEach((c) => {
      if (c.servico) values.add(c.servico);
    });
    return Array.from(values).sort();
  }, [contratosEnriquecidos]);

  const produtoOptions = useMemo(() => {
    const values = new Set<string>();
    contratosEnriquecidos.forEach((c) => {
      if (c.produto) values.add(c.produto);
    });
    return Array.from(values).sort();
  }, [contratosEnriquecidos]);

  const contratosFiltrados = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contratosEnriquecidos.filter((c) => {
      if (query) {
        const matchesQuery = [
          c.nomeCliente,
          c.cnpjCliente,
          c.idSubtask,
          c.idTask,
          c.servico,
          c.produto,
          c.responsavel,
          c.csResponsavel,
          c.vendedor,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (squadFilter !== "all" && c.squad !== squadFilter) return false;
      if (servicoFilter !== "all" && c.servico !== servicoFilter) return false;
      if (produtoFilter !== "all" && c.produto !== produtoFilter) return false;

      if (tipoContratoFilter === "recorrente" && c.mrr <= 0) return false;
      if (tipoContratoFilter === "pontual" && c.pontual <= 0) return false;

      return true;
    });
  }, [contratosEnriquecidos, search, statusFilter, squadFilter, servicoFilter, produtoFilter, tipoContratoFilter]);

  const contratosOrdenados = useMemo(() => {
    return [...contratosFiltrados].sort((a, b) => b.ltv - a.ltv);
  }, [contratosFiltrados]);

  const indicadores = useMemo(() => {
    const total = contratosFiltrados.length;
    const mrrTotal = contratosFiltrados.reduce((acc, c) => acc + c.mrr, 0);
    const pontualTotal = contratosFiltrados.reduce((acc, c) => acc + c.pontual, 0);
    const ltvTotal = contratosFiltrados.reduce((acc, c) => acc + c.ltv, 0);
    const ltMedio = total > 0
      ? contratosFiltrados.reduce((acc, c) => acc + c.ltMeses, 0) / total
      : 0;

    return {
      total,
      mrrTotal,
      pontualTotal,
      ltvTotal,
      ltMedio,
    };
  }, [contratosFiltrados]);

  const topServicos = useMemo(() => {
    const counts = new Map<string, number>();
    contratosFiltrados.forEach((c) => {
      const key = c.servico || "Sem serviço";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [contratosFiltrados]);

  const topProdutos = useMemo(() => {
    const counts = new Map<string, number>();
    contratosFiltrados.forEach((c) => {
      const key = c.produto || "Sem produto";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [contratosFiltrados]);

  const ltPorProduto = useMemo(() => {
    const map = new Map<string, { ativos: number[]; cancelados: number[] }>();

    contratosFiltrados.forEach((c) => {
      const mrr = parseFloat(c.valorr || "0") || 0;
      if (mrr <= 500) return;

      const produto = c.produto || "Sem produto";
      if (!map.has(produto)) map.set(produto, { ativos: [], cancelados: [] });
      const entry = map.get(produto)!;

      const inicio = c.dataInicio ? new Date(c.dataInicio) : null;
      if (!inicio) return;

      if (c.dataSolicitacaoEncerramento) {
        const fim = new Date(c.dataSolicitacaoEncerramento);
        const dias = Math.max(0, differenceInDays(fim, inicio));
        entry.cancelados.push(dias);
      } else {
        const dias = Math.max(0, differenceInDays(new Date(), inicio));
        entry.ativos.push(dias);
      }
    });

    return Array.from(map.entries())
      .map(([produto, { ativos, cancelados }]) => {
        const avgAtivo = ativos.length > 0 ? ativos.reduce((a, b) => a + b, 0) / ativos.length : 0;
        const avgCancelado = cancelados.length > 0 ? cancelados.reduce((a, b) => a + b, 0) / cancelados.length : 0;
        return {
          produto,
          qtdAtivos: ativos.length,
          qtdCancelados: cancelados.length,
          ltMedioAtivoDias: Math.round(avgAtivo),
          ltMedioAtivoMeses: Math.round((avgAtivo / 30) * 10) / 10,
          ltMedioCanceladoDias: Math.round(avgCancelado),
          ltMedioCanceladoMeses: Math.round((avgCancelado / 30) * 10) / 10,
        };
      })
      .sort((a, b) => (b.qtdAtivos + b.qtdCancelados) - (a.qtdAtivos + a.qtdCancelados));
  }, [contratosFiltrados]);

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="space-y-6">
            <div className="h-10 bg-muted rounded-lg w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-muted rounded-xl" />
              ))}
            </div>
            <div className="h-96 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold">Detalhamento de Contratos</h1>
                <p className="text-sm text-muted-foreground">
                  {contratosFiltrados.length} contrato{contratosFiltrados.length === 1 ? "" : "s"} encontrados
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              <Input
                placeholder="Buscar por cliente, contrato, serviço..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="lg:col-span-2"
                data-testid="input-search-contratos-detalhamento"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-contratos-detalhamento">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={squadFilter} onValueChange={setSquadFilter}>
                <SelectTrigger data-testid="select-squad-contratos-detalhamento">
                  <SelectValue placeholder="Squad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os squads</SelectItem>
                  {squadOptions.map((squad) => (
                    <SelectItem key={squad} value={squad}>
                      {squad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={servicoFilter} onValueChange={setServicoFilter}>
                <SelectTrigger data-testid="select-servico-contratos-detalhamento">
                  <SelectValue placeholder="Serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os serviços</SelectItem>
                  {servicoOptions.map((servico) => (
                    <SelectItem key={servico} value={servico}>
                      {servico}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={produtoFilter} onValueChange={setProdutoFilter}>
                <SelectTrigger data-testid="select-produto-contratos-detalhamento">
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {produtoOptions.map((produto) => (
                    <SelectItem key={produto} value={produto}>
                      {produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipoContratoFilter} onValueChange={(value) => setTipoContratoFilter(value as TipoContratoFiltro)}>
                <SelectTrigger data-testid="select-tipo-contrato-contratos-detalhamento">
                  <SelectValue placeholder="Tipo de contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambos">Recorrente + Pontual</SelectItem>
                  <SelectItem value="recorrente">Somente recorrente</SelectItem>
                  <SelectItem value="pontual">Somente pontual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard
              title="Contratos"
              value={String(indicadores.total)}
              icon={FileText}
              rawValue={indicadores.total}
              animateValue
              formatValue={(v) => String(Math.round(v))}
            />
            <StatsCard
              title="MRR Total"
              value={formatCurrency(indicadores.mrrTotal)}
              icon={DollarSign}
              variant="success"
              rawValue={indicadores.mrrTotal}
              animateValue
              formatValue={(v) => formatCurrency(v)}
            />
            <StatsCard
              title="Pontual Total"
              value={formatCurrency(indicadores.pontualTotal)}
              icon={Layers}
              variant="info"
              rawValue={indicadores.pontualTotal}
              animateValue
              formatValue={(v) => formatCurrency(v)}
            />
            <StatsCard
              title="LTV Total"
              value={formatCurrency(indicadores.ltvTotal)}
              icon={TrendingUp}
              variant="warning"
              rawValue={indicadores.ltvTotal}
              animateValue
              formatValue={(v) => formatCurrency(v)}
            />
            <StatsCard
              title="LT Médio"
              value={`${formatDecimal(indicadores.ltMedio, 1).replace(".", ",")} m`}
              icon={Clock}
              variant="default"
              rawValue={indicadores.ltMedio}
              animateValue
              formatValue={(v) => `${formatDecimal(v, 1).replace(".", ",")} m`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Top Serviços</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topServicos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados</p>
                ) : (
                  topServicos.map(([servico, total]) => (
                    <div key={servico} className="flex items-center justify-between text-sm">
                      <span className="truncate">{servico}</span>
                      <Badge variant="secondary">{total}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Top Produtos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topProdutos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados</p>
                ) : (
                  topProdutos.map(([produto, total]) => (
                    <div key={produto} className="flex items-center justify-between text-sm">
                      <span className="truncate">{produto}</span>
                      <Badge variant="secondary">{total}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-base">LT por Produto</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Ativos</TableHead>
                      <TableHead className="text-center">LT Médio Ativo</TableHead>
                      <TableHead className="text-center">Cancelados</TableHead>
                      <TableHead className="text-center">LT Médio Cancelado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ltPorProduto.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum produto encontrado com os filtros atuais.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ltPorProduto.map((item) => (
                        <TableRow key={item.produto}>
                          <TableCell className="font-medium">{item.produto}</TableCell>
                          <TableCell className="text-center">
                            {item.qtdAtivos > 0 ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{item.qtdAtivos}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.qtdAtivos > 0 ? (
                              <span className="text-green-600 dark:text-green-400 font-semibold">
                                {formatLT(item.ltMedioAtivoMeses, item.ltMedioAtivoDias)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.qtdCancelados > 0 ? (
                              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{item.qtdCancelados}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.qtdCancelados > 0 ? (
                              <span className="text-red-600 dark:text-red-400 font-semibold">
                                {formatLT(item.ltMedioCanceladoMeses, item.ltMedioCanceladoDias)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contratos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Squad</TableHead>
                      <TableHead>MRR</TableHead>
                      <TableHead>Pontual</TableHead>
                      <TableHead>LT</TableHead>
                      <TableHead>LTV</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Encerramento</TableHead>
                      <TableHead>Pausa</TableHead>
                      <TableHead>Resp.</TableHead>
                      <TableHead>CS</TableHead>
                      <TableHead>Vendedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratosOrdenados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                          Nenhum contrato encontrado com os filtros atuais.
                        </TableCell>
                      </TableRow>
                    ) : (
                      contratosOrdenados.map((contrato, index) => (
                        <TableRow key={contrato.idSubtask || contrato.idTask || `${contrato.nomeCliente || "contrato"}-${index}`}>
                          <TableCell className="font-medium">
                            {contrato.nomeCliente || "Cliente não identificado"}
                          </TableCell>
                          <TableCell>{contrato.servico || "-"}</TableCell>
                          <TableCell>{contrato.produto || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{contrato.status || "-"}</Badge>
                          </TableCell>
                          <TableCell>{contrato.squad || "-"}</TableCell>
                          <TableCell>{formatCurrency(contrato.mrr)}</TableCell>
                          <TableCell>{formatCurrency(contrato.pontual)}</TableCell>
                          <TableCell>{formatLT(contrato.ltMeses, contrato.ltDias)}</TableCell>
                          <TableCell>{formatCurrency(contrato.ltv)}</TableCell>
                          <TableCell>{formatDate(contrato.dataInicio)}</TableCell>
                          <TableCell>{formatDate(contrato.dataEncerramento)}</TableCell>
                          <TableCell>{formatDate(contrato.dataPausa)}</TableCell>
                          <TableCell>{contrato.responsavel || "-"}</TableCell>
                          <TableCell>{contrato.csResponsavel || "-"}</TableCell>
                          <TableCell>{contrato.vendedor || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
