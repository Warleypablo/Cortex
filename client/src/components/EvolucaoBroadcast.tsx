/**
 * Gráfico "Evolução do período" do Resumo de broadcast: taxa de abertura (leitura)
 * + reuniões atribuídas ao longo do tempo, com toggle Dia/Semana/Mês.
 * Réplica do gráfico do dash standalone. Dados: GET /api/ghl/broadcasts/evolucao.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Gran = "dia" | "semana" | "mes";
interface Ponto { bucket: string; abertura_pct: number | null; reunioes: number }

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<T>;
  });
}

export default function EvolucaoBroadcast({ from, to }: { from: string; to: string }) {
  const [g, setG] = useState<Gran>("dia");
  const q = useQuery<{ series: Ponto[] }>({
    queryKey: ["/api/ghl/broadcasts/evolucao", from, to, g],
    queryFn: () => fetchJson(`/api/ghl/broadcasts/evolucao?from=${from}&to=${to}&g=${g}`),
  });

  const data = (q.data?.series ?? []).map((p) => ({
    ...p,
    label: (() => { try { return format(new Date(p.bucket), g === "mes" ? "MMM/yy" : "dd/MM", { locale: ptBR }); } catch { return p.bucket; } })(),
  }));

  const Toggle = ({ v, children }: { v: Gran; children: React.ReactNode }) => (
    <Button variant={g === v ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setG(v)}>{children}</Button>
  );

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Evolução do período</CardTitle>
          <p className="text-xs text-muted-foreground">Taxa de abertura e reuniões atribuídas</p>
        </div>
        <div className="flex gap-1">
          <Toggle v="dia">Dia</Toggle>
          <Toggle v="semana">Semana</Toggle>
          <Toggle v="mes">Mês</Toggle>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground h-[280px]"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground h-[280px] flex items-center">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis yAxisId="abertura" tick={{ fontSize: 11 }} className="fill-muted-foreground" unit="%" />
              <YAxis yAxisId="reunioes" orientation="right" tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: any, name: string) => [name === "Abertura" ? `${value}%` : value, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="abertura" type="monotone" dataKey="abertura_pct" name="Abertura" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="reunioes" type="monotone" dataKey="reunioes" name="Reuniões" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
