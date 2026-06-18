import { useQuery } from "@tanstack/react-query";
import { Crown, Trophy, Medal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface RankingSDR {
  sdr: string;
  sdrId: number;
  leads: number;
  reunioesRealizadas: number;
  conversao: number;
}

const PODIUM_ICONS = [Crown, Trophy, Medal];
const PODIUM_COLORS = ["text-yellow-400", "text-zinc-300", "text-amber-600"];

export default function SlideRankingSDRs({ semanaInicio, semanaFim }: SlideProps) {
  const params = new URLSearchParams({
    dataReuniaoInicio: semanaInicio,
    dataReuniaoFim: semanaFim,
    dataLeadInicio: semanaInicio,
    dataLeadFim: semanaFim,
  });

  const { data, isLoading } = useQuery<RankingSDR[]>({
    queryKey: ["/api/sdrs/chart-reunioes", { semanaInicio, semanaFim }],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/chart-reunioes?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const sorted = data ? [...data].sort((a, b) => b.reunioesRealizadas - a.reunioesRealizadas) : [];
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Ranking de SDRs</h2>
      {isLoading ? (
        <Skeleton className="h-48 w-full bg-zinc-800" />
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xl">Nenhuma reunião registrada nesta semana</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {top3.map((s, i) => {
              const Icon = PODIUM_ICONS[i];
              const color = PODIUM_COLORS[i];
              return (
                <div key={s.sdrId} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center text-center">
                  <Icon className={`h-8 w-8 ${color} mb-2`} />
                  <p className="font-bold text-lg leading-tight">{s.sdr.split(" ")[0]}</p>
                  <p className={`text-4xl font-bold mt-2 ${color}`}>{s.reunioesRealizadas}</p>
                  <p className="text-zinc-500 text-xs mt-1">reuniões</p>
                  <p className="text-zinc-400 text-xs mt-1">{s.leads} leads · {s.conversao.toFixed(0)}% conv.</p>
                </div>
              );
            })}
          </div>
          {rest.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">SDR</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Leads</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Reuniões</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((s, i) => (
                    <tr key={s.sdrId} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                      <td className="px-4 py-3 font-medium">{s.sdr}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{s.leads}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{s.reunioesRealizadas}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{s.conversao.toFixed(0)}%</td>
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
