import { Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatValor, type CeoUnidade } from "./ceoFormat";

export interface PontoEvolucao { mes: number; realizado: number | null; orcado: number | null }

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STROKE: Record<string, string> = {
  verde: "#10b981", ambar: "#f59e0b", vermelho: "#f43f5e", neutro: "#f97316",
};

// Eixo Y compacto: "R$ 1,5M", "R$ 320 mil", "112". Mantém leitura sem poluir.
function tickCompacto(v: number, unidade: CeoUnidade): string {
  if (unidade !== "brl") return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`;
  return `R$ ${Math.round(v)}`;
}

function TooltipEvolucao({ active, payload, label, unidade }: any) {
  if (!active || !payload?.length) return null;
  const real = payload.find((p: any) => p.dataKey === "realizado")?.value;
  const meta = payload.find((p: any) => p.dataKey === "orcado")?.value;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
      <p className="text-xs text-gray-700 dark:text-zinc-300 tabular-nums">
        Realizado <span className="font-semibold">{formatValor(real ?? null, unidade)}</span>
      </p>
      {meta != null && (
        <p className="text-xs text-gray-500 dark:text-zinc-500 tabular-nums">
          Meta <span className="font-medium">{formatValor(meta, unidade)}</span>
        </p>
      )}
    </div>
  );
}

export function CeoEvolucaoChart({
  data, unidade, tom = "neutro",
}: { data: PontoEvolucao[]; unidade: CeoUnidade; tom?: string }) {
  const cor = STROKE[tom] ?? STROKE.neutro;
  const temMeta = data.some((d) => d.orcado != null);
  const rows = data.map((d) => ({ ...d, label: MES_ABREV[d.mes - 1] ?? String(d.mes) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="ceoEvoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-zinc-800" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400 dark:text-zinc-500" tickLine={false} axisLine={false} />
          <YAxis width={56} tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400 dark:text-zinc-500" tickLine={false} axisLine={false}
            tickFormatter={(v) => tickCompacto(v, unidade)} />
          <Tooltip content={<TooltipEvolucao unidade={unidade} />} cursor={{ stroke: cor, strokeOpacity: 0.35, strokeWidth: 1 }} />
          {temMeta && (
            <Line type="monotone" dataKey="orcado" name="Meta" stroke="currentColor" className="text-gray-400 dark:text-zinc-600"
              strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          )}
          <Area type="monotone" dataKey="realizado" name="Realizado" stroke={cor} strokeWidth={2.5}
            fill="url(#ceoEvoFill)" dot={{ r: 2.5, fill: cor, strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
