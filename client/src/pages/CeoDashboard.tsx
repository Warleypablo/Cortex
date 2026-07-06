import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CeoKpiCard, type CeoKpi } from "@/components/ceo/CeoKpiCard";
import { CeoKpiDetail } from "@/components/ceo/CeoKpiDetail";
import { atingimentoTom } from "@/components/ceo/ceoFormat";

interface CeoDashboardResponse {
  mes: string;
  kpis: CeoKpi[];
}

// Meses de 2026 até o corrente. Default = mês atual (ou dez/26 se já passou).
const MESES_2026 = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const label = new Date(2026, i, 1).toLocaleDateString("pt-BR", { month: "long" });
  return { value: `2026-${String(n).padStart(2, "0")}`, label: `${label[0].toUpperCase()}${label.slice(1)} 2026` };
});

function mesCorrenteDefault(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = ano < 2026 ? 1 : ano > 2026 ? 12 : hoje.getMonth() + 1;
  return `2026-${String(mes).padStart(2, "0")}`;
}

export default function CeoDashboard() {
  const [mes, setMes] = useState<string>(mesCorrenteDefault());
  const [detalheKpi, setDetalheKpi] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<CeoDashboardResponse>({
    queryKey: ["ceo-dashboard", mes],
    queryFn: async () => {
      const res = await fetch(`/api/ceo-dashboard?mes=${mes}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const mesLabel = MESES_2026.find((m) => m.value === mes)?.label ?? "";
  const kpiSel = data?.kpis.find((k) => k.key === detalheKpi);
  const tomSel = kpiSel ? atingimentoTom(kpiSel.atingimentoPct, kpiSel.direcao) : "neutro";

  return (
    <div className="min-h-full bg-gray-50/50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        {/* Header cockpit */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Turbo Cortex · Visão Executiva
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">CEO Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
              Realizado vs meta do BP 2026 · <span className="font-medium text-gray-600 dark:text-zinc-300">{mesLabel}</span>
            </p>
          </div>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-48 rounded-xl border-gray-200 dark:border-zinc-700 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES_2026.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 dark:border-zinc-800 h-[148px] animate-pulse bg-gray-100 dark:bg-zinc-900" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 p-4 text-sm text-rose-700 dark:text-rose-300">
            Falha ao carregar o CEO Dashboard. Verifique seu acesso e tente novamente.
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.kpis.map((kpi) => (
              <CeoKpiCard key={kpi.key} kpi={kpi} onClick={() => setDetalheKpi(kpi.key)} />
            ))}
          </div>
        )}

        <CeoKpiDetail kpiKey={detalheKpi} mes={mes} tom={tomSel} onClose={() => setDetalheKpi(null)} />
      </div>
    </div>
  );
}
