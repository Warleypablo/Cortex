import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CeoMatrizTabela, type CeoMatrizResponse } from "@/components/ceo/CeoMatrizTabela";
import { CeoKpiDetail } from "@/components/ceo/CeoKpiDetail";

// Meses de 2026. Default = mês atual (ou dez/26 se já passou). Define a última coluna.
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

// Estado do drill: qual KPI, em que mês, com que tom (cor do atingimento da célula).
interface DrillState { kpi: string; mes: string; tom: string }

export default function CeoDashboard() {
  const [mes, setMes] = useState<string>(mesCorrenteDefault());
  const [drill, setDrill] = useState<DrillState | null>(null);

  const { data, isLoading, isError } = useQuery<CeoMatrizResponse>({
    queryKey: ["ceo-dashboard-matriz", mes],
    queryFn: async () => {
      const res = await fetch(`/api/ceo-dashboard/matriz?ate=${mes}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const mesLabel = MESES_2026.find((m) => m.value === mes)?.label ?? "";

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
              Realizado vs meta do BP 2026 · mês a mês até{" "}
              <span className="font-medium text-gray-600 dark:text-zinc-300">{mesLabel}</span>
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
          <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 h-[420px] animate-pulse bg-gray-100 dark:bg-zinc-900" />
        )}

        {isError && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 p-4 text-sm text-rose-700 dark:text-rose-300">
            Falha ao carregar o CEO Dashboard. Verifique seu acesso e tente novamente.
          </div>
        )}

        {data && (
          <CeoMatrizTabela
            data={data}
            onCelula={(kpi, mesNum, tom) =>
              setDrill({ kpi, mes: `2026-${String(mesNum).padStart(2, "0")}`, tom })
            }
          />
        )}

        <CeoKpiDetail
          kpiKey={drill?.kpi ?? null}
          mes={drill?.mes ?? mes}
          tom={drill?.tom ?? "neutro"}
          onClose={() => setDrill(null)}
        />
      </div>
    </div>
  );
}
