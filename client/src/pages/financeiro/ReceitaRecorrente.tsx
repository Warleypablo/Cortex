import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { KpiCards } from "./receita-recorrente/KpiCards";
import { ChartReceitaMensal } from "./receita-recorrente/ChartReceitaMensal";
import { TabelaReceitaMensal } from "./receita-recorrente/TabelaReceitaMensal";
import { DrilldownClientesModal } from "./receita-recorrente/DrilldownClientesModal";
import type {
  ResumoReceitaResponse,
  Empresa,
  CellClickPayload,
  ModoReceita,
} from "@shared/receitaRecorrenteTypes";

type RangeKey = "6m" | "12m" | "ytd";

interface ModalState {
  open: boolean;
  mes: string | null;
  tipo: CellClickPayload["tipo"] | null;
  empresa: Empresa | null;
  modo: ModoReceita;
}

function computeRange(key: RangeKey): { ini: string; fim: string } {
  const now = new Date();
  const fim = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  let ini: Date;
  if (key === "6m") {
    ini = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  } else if (key === "12m") {
    ini = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  } else {
    ini = new Date(now.getFullYear(), 0, 1);
  }
  return {
    ini: ini.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  };
}

export default function ReceitaRecorrente() {
  usePageTitle("Receita Recorrente");
  useSetPageInfo("Receita Recorrente", "MRR realizado por centro de custo (Conta Azul)");

  const [rangeKey, setRangeKey] = useState<RangeKey>("6m");
  const [empresa, setEmpresa] = useState<Empresa | "todas">("todas");
  const [modo, setModo] = useState<ModoReceita>("competencia");
  const [modal, setModal] = useState<ModalState>({
    open: false, mes: null, tipo: null, empresa: null, modo: "competencia",
  });

  const { ini, fim } = useMemo(() => computeRange(rangeKey), [rangeKey]);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { data_ini: ini, data_fim: fim, modo };
    if (empresa !== "todas") params.empresa = empresa;
    return params;
  }, [ini, fim, empresa, modo]);

  const { data, isLoading, error, refetch, isFetching } = useQuery<ResumoReceitaResponse>({
    queryKey: ["/api/financeiro/receita-recorrente/resumo", queryParams],
    staleTime: 5 * 60 * 1000,
  });

  const handleCellClick = (payload: CellClickPayload) => {
    setModal({ open: true, ...payload, modo });
  };

  const handleCloseModal = () => {
    setModal((m) => ({ ...m, open: false }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Receita Recorrente
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            {modo === "competencia"
              ? "Regime de competência — receita alocada ao mês da competência (accrual, padrão MRR)"
              : "Regime de caixa — receita alocada ao mês da quitação (bate com DFC)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={modo} onValueChange={(v) => setModo(v as ModoReceita)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="competencia">Competência</SelectItem>
              <SelectItem value="caixa">Caixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="ytd">Ano corrente (YTD)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={empresa} onValueChange={(v) => setEmpresa(v as Empresa | "todas")}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas empresas</SelectItem>
              <SelectItem value="TURBO PARTNERS">Turbo Partners</SelectItem>
              <SelectItem value="PEIXOTO DEBBANE">Peixoto Debbane</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-red-700 dark:text-red-300">
              Falha ao carregar dados de receita.
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => refetch()}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[440px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </>
      )}

      {/* Content */}
      {data && (
        <div className={isFetching ? "opacity-70 transition-opacity" : ""}>
          <KpiCards cards={data.cards} />
          <div className="mt-6">
            <ChartReceitaMensal meses={data.meses} />
          </div>
          <div className="mt-6">
            <TabelaReceitaMensal meses={data.meses} onCellClick={handleCellClick} />
          </div>
        </div>
      )}

      <DrilldownClientesModal
        open={modal.open}
        mes={modal.mes}
        tipo={modal.tipo}
        empresa={modal.empresa}
        modo={modal.modo}
        onClose={handleCloseModal}
      />
    </div>
  );
}
