import { useQuery } from "@tanstack/react-query";
import { TrendingDown, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface ChurnContrato {
  id: string;
  cliente_nome: string;
  squad: string;
  valorr: number;
  motivo_cancelamento: string;
}

interface ChurnData {
  contratos: ChurnContrato[];
  mrrTotal: number;
  qtdContratos: number;
}

export default function SlideChurn({ semanaInicio, semanaFim }: SlideProps) {
  const { data, isLoading } = useQuery<ChurnData>({
    queryKey: ["/api/analytics/churn-detalhamento", { startDate: semanaInicio, endDate: semanaFim }],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/churn-detalhamento?startDate=${semanaInicio}&endDate=${semanaFim}`,
        { credentials: "include" }
      );
      const raw: ChurnContrato[] = await res.json();
      const mrrTotal = raw.reduce((sum, c) => sum + (c.valorr || 0), 0);
      return { contratos: raw.slice(0, 8), mrrTotal, qtdContratos: raw.length };
    },
  });

  const cards = [
    { label: "Contratos Perdidos", value: String(data?.qtdContratos ?? 0), icon: TrendingDown, color: "text-red-400" },
    { label: "MRR Perdido", value: formatCurrencyCompact(data?.mrrTotal ?? 0), icon: DollarSign, color: "text-red-400" },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Churn da Semana</h2>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full bg-zinc-800" />
          <Skeleton className="h-48 w-full bg-zinc-800" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6 mb-10">
            {cards.map((c) => (
              <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-5">
                <c.icon className={`h-10 w-10 ${c.color}`} />
                <div>
                  <p className="text-zinc-400 text-sm">{c.label}</p>
                  <p className={`text-4xl font-bold ${c.color}`}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>
          {data && data.contratos.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Squad</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Motivo</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contratos.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                      <td className="px-4 py-3 font-medium">{c.cliente_nome}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.squad}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.motivo_cancelamento}</td>
                      <td className="px-4 py-3 text-right text-red-400 font-semibold">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(c.valorr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-zinc-500 text-xl">Nenhum churn registrado nesta semana 🎉</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
