import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CeoKpiCard, type CeoKpi } from "@/components/ceo/CeoKpiCard";

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

  const { data, isLoading, isError } = useQuery<CeoDashboardResponse>({
    queryKey: ["ceo-dashboard", mes],
    queryFn: async () => {
      const res = await fetch(`/api/ceo-dashboard?mes=${mes}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CEO Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Snapshot executivo · realizado vs meta do BP 2026
          </p>
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-48">
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
            <div key={i} className="rounded-xl border border-gray-200 dark:border-zinc-700 h-[120px] animate-pulse bg-gray-100 dark:bg-zinc-800" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 p-4 text-sm text-rose-700 dark:text-rose-300">
          Falha ao carregar o CEO Dashboard. Verifique seu acesso e tente novamente.
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.kpis.map((kpi) => (
            <CeoKpiCard key={kpi.key} kpi={kpi} />
          ))}
        </div>
      )}
    </div>
  );
}
