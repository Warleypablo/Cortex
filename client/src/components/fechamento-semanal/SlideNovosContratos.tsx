import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface NovoContrato {
  id: string;
  contratoNome: string;
  clienteNome: string;
  produto: string;
  squad: string;
  csResponsavel: string;
  vendedor: string;
  valorMrr: number;
  dataInicio: string;
}

export default function SlideNovosContratos({ semanaInicio, semanaFim }: SlideProps) {
  const { data, isLoading } = useQuery<NovoContrato[]>({
    queryKey: ["/api/fechamento-semanal/novos-contratos", { semanaInicio, semanaFim }],
    queryFn: async () => {
      const res = await fetch(
        `/api/fechamento-semanal/novos-contratos?semanaInicio=${semanaInicio}&semanaFim=${semanaFim}`,
        { credentials: "include" }
      );
      return res.json();
    },
  });

  const totalMrr = data?.reduce((sum, c) => sum + c.valorMrr, 0) ?? 0;

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <div className="flex items-baseline gap-6 mb-8">
        <h2 className="text-3xl font-bold text-zinc-300">Novos Contratos</h2>
        {data && data.length > 0 && (
          <span className="text-2xl font-bold text-emerald-400">+{formatCurrencyCompact(totalMrr)} MRR</span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-48 w-full bg-zinc-800" />
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xl">Nenhum contrato novo nesta semana</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Produto</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Squad</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">CS</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white text-xs px-1.5 py-0 shrink-0">NOVO</Badge>
                      <span className="font-medium">{c.clienteNome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{c.produto}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.squad}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.csResponsavel}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(c.valorMrr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
