import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  CalendarDays,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { type ChurnDetalhamentoData } from "@/components/churn/types";

export interface ChurnControlsProps {
  dataInicio: string; dataFim: string;
  onChangePeriodo: (inicio: string, fim: string) => void;
  filterAbono: "todos" | "abonados" | "nao_abonados";
  onChangeAbono: (v: "todos" | "abonados" | "nao_abonados") => void;
  filtros: ChurnDetalhamentoData["filtros"] | undefined;
  filterSquads: string[]; setFilterSquads: (v: string[]) => void;
  filterProdutos: string[]; setFilterProdutos: (v: string[]) => void;
  filterResponsaveis: string[]; setFilterResponsaveis: (v: string[]) => void;
  filterServicos: string[]; setFilterServicos: (v: string[]) => void;
  filterPlanos: string[]; setFilterPlanos: (v: string[]) => void;
  filterClusters: string[]; setFilterClusters: (v: string[]) => void;
  filterEvitabilidades: string[]; setFilterEvitabilidades: (v: string[]) => void;
  filterPossibilidadesRetencao: string[]; setFilterPossibilidadesRetencao: (v: string[]) => void;
  // Extra props for search/sort controls inside the collapsible (not in brief interface, but needed for no-behavior-change)
  searchTerm: string; setSearchTerm: (v: string) => void;
  sortBy: string; setSortBy: (v: string) => void;
  sortOrder: "asc" | "desc"; setSortOrder: (v: "asc" | "desc") => void;
}

export function ChurnControls(props: ChurnControlsProps): JSX.Element {
  const {
    dataInicio, dataFim, onChangePeriodo,
    filterAbono, onChangeAbono,
    filtros,
    filterSquads, setFilterSquads,
    filterProdutos, setFilterProdutos,
    filterResponsaveis, setFilterResponsaveis,
    filterServicos, setFilterServicos,
    filterPlanos, setFilterPlanos,
    filterClusters, setFilterClusters,
    filterEvitabilidades, setFilterEvitabilidades,
    filterPossibilidadesRetencao, setFilterPossibilidadesRetencao,
    searchTerm, setSearchTerm,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
  } = props;

  // Internalized: purely presentational state
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const setQuickPeriod = (months: number) => {
    onChangePeriodo(
      format(subMonths(new Date(), months), "yyyy-MM-dd"),
      format(new Date(), "yyyy-MM-dd"),
    );
  };

  return (
    <>
      {/* Período de Análise */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Período de Análise</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => onChangePeriodo(e.target.value, dataFim)}
                className="w-40"
                data-testid="input-data-inicio"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fim</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => onChangePeriodo(dataInicio, e.target.value)}
                className="w-40"
                data-testid="input-data-fim"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(3)} data-testid="button-period-3m">3M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(6)} data-testid="button-period-6m">6M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(12)} data-testid="button-period-12m">12M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(24)} data-testid="button-period-24m">24M</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtro de abono */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40 w-fit">
          {([
            { key: "todos", label: "Todos" },
            { key: "nao_abonados", label: "Não abonados" },
            { key: "abonados", label: "Abonados" },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => onChangeAbono(opt.key)}
              data-testid={`filter-abono-${opt.key}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterAbono === opt.key
                  ? opt.key === "abonados"
                    ? "bg-amber-100 dark:bg-amber-900/40 shadow-sm text-amber-800 dark:text-amber-300"
                    : "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros Avançados - sempre visível em qualquer sub-aba */}
      <Card className="border-border/50">
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <CardHeader className="py-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto no-default-hover-elevate" data-testid="button-toggle-filters">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-gradient-to-r from-slate-500 to-gray-600">
                    <Filter className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Filtros Avançados</span>
                    {(searchTerm || filterSquads.length > 0 || filterProdutos.length > 0 || filterResponsaveis.length > 0 || filterServicos.length > 0 || filterPlanos.length > 0 || filterClusters.length > 0 || filterEvitabilidades.length > 0 || filterPossibilidadesRetencao.length > 0) && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {[searchTerm ? 1 : 0, filterSquads.length, filterProdutos.length, filterResponsaveis.length, filterServicos.length, filterPlanos.length, filterClusters.length, filterEvitabilidades.length, filterPossibilidadesRetencao.length].reduce((a, b) => a + (b > 0 ? 1 : 0), 0)} ativo(s)
                      </Badge>
                    )}
                  </div>
                </div>
                {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cliente, CNPJ, produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-churn"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Squads</label>
                  <MultiSelect
                    options={filtros?.squads || []}
                    selected={filterSquads}
                    onChange={setFilterSquads}
                    placeholder="Todos os squads"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Produtos</label>
                  <MultiSelect
                    options={filtros?.produtos || []}
                    selected={filterProdutos}
                    onChange={setFilterProdutos}
                    placeholder="Todos os produtos"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Responsáveis</label>
                  <MultiSelect
                    options={filtros?.responsaveis || []}
                    selected={filterResponsaveis}
                    onChange={setFilterResponsaveis}
                    placeholder="Todos os responsáveis"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Serviço</label>
                  <MultiSelect
                    options={filtros?.servicos || []}
                    selected={filterServicos}
                    onChange={setFilterServicos}
                    placeholder="Todos os serviços"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Plano</label>
                  <MultiSelect
                    options={filtros?.planos || []}
                    selected={filterPlanos}
                    onChange={setFilterPlanos}
                    placeholder="Todos os planos"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cluster</label>
                  <MultiSelect
                    options={filtros?.clusters || []}
                    selected={filterClusters}
                    onChange={setFilterClusters}
                    placeholder="Todos os clusters"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Evitabilidade</label>
                  <MultiSelect
                    options={filtros?.evitabilidades || []}
                    selected={filterEvitabilidades}
                    onChange={setFilterEvitabilidades}
                    placeholder="Todas"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Possib. Retenção</label>
                  <MultiSelect
                    options={filtros?.possibilidades_retencao || []}
                    selected={filterPossibilidadesRetencao}
                    onChange={setFilterPossibilidadesRetencao}
                    placeholder="Todas"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ordenar por</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="data_encerramento">Data de Encerramento</SelectItem>
                      <SelectItem value="valorr">MRR</SelectItem>
                      <SelectItem value="lifetime_meses">Lifetime</SelectItem>
                      <SelectItem value="ltv">LTV</SelectItem>
                      <SelectItem value="cliente_nome">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end col-span-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterSquads([]);
                      setFilterProdutos([]);
                      setFilterResponsaveis([]);
                      setFilterServicos([]);
                      setFilterPlanos([]);
                      setFilterClusters([]);
                      setFilterEvitabilidades([]);
                      setFilterPossibilidadesRetencao([]);
                      onChangePeriodo(
                        format(subMonths(new Date(), 12), "yyyy-MM-dd"),
                        format(new Date(), "yyyy-MM-dd"),
                      );
                      setSortBy("data_encerramento");
                      setSortOrder("desc");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Limpar Todos os Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </>
  );
}
