import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface SquadSaude {
  squad: string;
  mrr: number;
  clientes: number;
  contratos: number;
  churns: number;
  mrrPerdido: number;
  churnRate: number;
  saude: "verde" | "amarelo" | "vermelho";
}

const SAUDE_DOT: Record<string, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-yellow-400",
  vermelho: "bg-red-500",
};

export default function SlideSaudeSquads({ semanaInicio, semanaFim }: SlideProps) {
  const { data, isLoading } = useQuery<SquadSaude[]>({
    queryKey: ["/api/fechamento-semanal/saude-squads", { semanaInicio, semanaFim }],
    queryFn: async () => {
      const res = await fetch(
        `/api/fechamento-semanal/saude-squads?semanaInicio=${semanaInicio}&semanaFim=${semanaFim}`,
        { credentials: "include" }
      );
      return res.json();
    },
  });

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Saúde dos Squads</h2>
      {isLoading ? (
        <Skeleton className="h-48 w-full bg-zinc-800" />
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xl">Sem dados de squads disponíveis</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Squad</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Clientes</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Churns</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR Perdido</th>
                <th className="text-center px-4 py-3 text-zinc-400 font-medium">Saúde</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s, i) => (
                <tr key={s.squad} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                  <td className="px-4 py-3 font-medium">{s.squad}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{formatCurrencyCompact(s.mrr)}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{s.clientes}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{s.churns}</td>
                  <td className="px-4 py-3 text-right text-red-400">
                    {s.mrrPerdido > 0 ? formatCurrencyCompact(s.mrrPerdido) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <span className={`w-3 h-3 rounded-full ${SAUDE_DOT[s.saude]}`} />
                    </div>
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
