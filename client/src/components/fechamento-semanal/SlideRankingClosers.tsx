import { useQuery } from "@tanstack/react-query";
import { Crown, Trophy, Medal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface RankingCloser {
  closer: string;
  mrr: number;
  pontual: number;
  reunioes: number;
  negociosGanhos: number;
  taxaConversao: number;
}

const PODIUM_ICONS = [Crown, Trophy, Medal];
const PODIUM_COLORS = ["text-yellow-400", "text-zinc-300", "text-amber-600"];

export default function SlideRankingClosers({ semanaInicio, semanaFim }: SlideProps) {
  const params = new URLSearchParams({
    dataFechamentoInicio: semanaInicio,
    dataFechamentoFim: semanaFim,
    dataReuniaoInicio: semanaInicio,
    dataReuniaoFim: semanaFim,
  });

  const { data, isLoading } = useQuery<RankingCloser[]>({
    queryKey: ["/api/closers/chart-receita", { semanaInicio, semanaFim }],
    queryFn: async () => {
      const res = await fetch(`/api/closers/chart-receita?${params}`, { credentials: "include" });
      const raw: RankingCloser[] = await res.json();
      return raw.sort((a, b) => (b.mrr + b.pontual) - (a.mrr + a.pontual));
    },
  });

  const top3 = data?.slice(0, 3) ?? [];
  const rest = data?.slice(3) ?? [];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Ranking de Closers</h2>
      {isLoading ? (
        <Skeleton className="h-48 w-full bg-zinc-800" />
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xl">Nenhuma venda registrada nesta semana</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {top3.map((c, i) => {
              const Icon = PODIUM_ICONS[i];
              const color = PODIUM_COLORS[i];
              return (
                <div key={c.closer} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center text-center">
                  <Icon className={`h-8 w-8 ${color} mb-2`} />
                  <p className="font-bold text-lg leading-tight">{c.closer.split(" ")[0]}</p>
                  <p className={`text-3xl font-bold mt-2 ${color}`}>{formatCurrencyCompact(c.mrr + c.pontual)}</p>
                  <p className="text-zinc-500 text-xs mt-1">{c.negociosGanhos} negócios</p>
                </div>
              );
            })}
          </div>
          {rest.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Closer</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Pontual</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Reuniões</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Negócios</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((c, i) => (
                    <tr key={c.closer} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                      <td className="px-4 py-3 font-medium">{c.closer}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{formatCurrencyCompact(c.mrr)}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{formatCurrencyCompact(c.pontual)}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{c.reunioes}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{c.negociosGanhos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
