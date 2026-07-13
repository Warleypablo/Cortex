import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DISC_ARQUETIPOS, FATORES, type Fator } from "@shared/disc";

interface MiniData {
  scoreD: number; scoreI: number; scoreS: number; scoreC: number;
  dominante: Fator; secundario: Fator; criadoEm?: string;
}
const FATOR_COR: Record<Fator, string> = { D: "#ef4444", I: "#f59e0b", S: "#22c55e", C: "#3b82f6" };

export default function DiscMiniCard({ colaboradorId }: { colaboradorId: number }) {
  const { data } = useQuery<MiniData | null>({
    queryKey: ["/api/gg/disc/por-colaborador", colaboradorId],
    queryFn: async () => {
      const res = await fetch(`/api/gg/disc/por-colaborador/${colaboradorId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!colaboradorId,
  });

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
          <Brain className="h-4 w-4 text-indigo-500" /> Perfil DISC
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge style={{ backgroundColor: FATOR_COR[data.dominante], color: "white" }}>
                {DISC_ARQUETIPOS[data.dominante].nome}
              </Badge>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                / {DISC_ARQUETIPOS[data.secundario].nome}
              </span>
            </div>
            <div className="flex gap-3">
              {FATORES.map((f) => {
                const scores: Record<Fator, number> = { D: data.scoreD, I: data.scoreI, S: data.scoreS, C: data.scoreC };
                const total = scores.D + scores.I + scores.S + scores.C || 1;
                return (
                  <div key={f} className="text-center">
                    <div className="text-sm font-bold" style={{ color: FATOR_COR[f] }}>
                      {Math.round((scores[f] / total) * 100)}%
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-zinc-500">{f}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-zinc-400">Ainda não fez o teste DISC.</p>
            <Link href="/gg/disc">
              <Button size="sm" variant="outline">Fazer teste</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
