import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { pctDaBase, formatPct } from "./churnAggregations";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, LabelList,
} from "recharts";

type FilterAbono = "todos" | "abonados" | "nao_abonados";

interface MesSerie {
  mes: string; // "YYYY-MM"
  total: number;
  pontual: number;
  logos: number;
  porMotivo: Record<string, number>;
}

interface HistoricoResponse {
  series: MesSerie[];
  motivos: string[]; // ordenados por volume desc
  ano: number;
  filterAbono: FilterAbono;
  mrrBasePorMes: Record<string, number>; // "YYYY-MM" -> MRR ativo real do mês
  /** Falso quando a cobertura do dado pontual no ano é baixa demais (< 10% das linhas). */
  pontualDisponivel?: boolean;
}

// Paleta por motivo (ordem = volume desc). "Outros"/"Não especificado" ficam cinza.
const MOTIVO_COLORS = [
  "#dc2626", "#2563eb", "#d97706", "#059669", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
  "#0284c7", "#ca8a04", "#16a34a", "#e11d48",
];
const COR_OUTROS = "#9ca3af";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function corDoMotivo(motivo: string, index: number): string {
  if (motivo === "Outros" || motivo === "Não especificado") return COR_OUTROS;
  return MOTIVO_COLORS[index % MOTIVO_COLORS.length];
}

export function ChurnHistoricoMensal({
  filterAbono,
  metaPct = 0.08,
  ano = new Date().getFullYear(),
}: {
  filterAbono: FilterAbono;
  metaPct?: number; // meta de churn como % do MRR real do mês (default 8%)
  ano?: number;
}): JSX.Element {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<HistoricoResponse>({
    queryKey: ["/api/analytics/churn-historico-mensal", ano, filterAbono],
    queryFn: async () => {
      const params = new URLSearchParams({ ano: String(ano), filterAbono });
      const res = await fetch(`/api/analytics/churn-historico-mensal?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch churn histórico mensal");
      return res.json();
    },
  });

  const motivos = data?.motivos ?? [];

  // Gera meses de janeiro até o mês atual (se ano corrente) ou dezembro, garantindo eixo contínuo.
  const chartData = useMemo(() => {
    const hoje = new Date();
    const ultimoMes = ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
    const porMes: Record<string, MesSerie> = {};
    (data?.series ?? []).forEach((s) => { porMes[s.mes] = s; });

    const linhas: Array<Record<string, number | string | boolean>> = [];
    for (let m = 1; m <= ultimoMes; m++) {
      const mesKey = `${ano}-${String(m).padStart(2, "0")}`;
      const serie = porMes[mesKey];
      // Meta = % fixo do MRR real (ativo) daquele mês
      const mrrBaseMes = data?.mrrBasePorMes?.[mesKey] ?? 0;
      const isMesCorrente = ano === hoje.getFullYear() && m === hoje.getMonth() + 1;
      const row: Record<string, number | string | boolean> = {
        mes: mesKey,
        mesLabel: isMesCorrente ? `${MESES_PT[m - 1]}*` : MESES_PT[m - 1],
        total: serie ? Math.round(serie.total) : 0,
        pontual: serie ? Math.round(serie.pontual ?? 0) : 0,
        meta: Math.round(mrrBaseMes * metaPct),
        mrrBase: mrrBaseMes,
        isMesCorrente,
      };
      motivos.forEach((motivo) => {
        row[motivo] = serie ? Math.round(serie.porMotivo[motivo] ?? 0) : 0;
      });
      linhas.push(row);
    }
    return linhas;
  }, [data, motivos, metaPct, ano]);

  const axisColor = isDark ? "#e5e7eb" : "#374151";
  const gridColor = isDark ? "#3f3f46" : "#e5e7eb";
  const acimaMetaColor = isDark ? "#f87171" : "#dc2626";
  const dentroMetaColor = isDark ? "#34d399" : "#059669";
  // Âmbar: mesma família da coluna "Pontual" do drawer (DrawerContratosTable),
  // para associar visualmente as duas telas.
  const pontualColor = isDark ? "#fbbf24" : "#d97706";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload as Record<string, number | string | boolean>;
    const total = Number(row?.total ?? 0);
    const meta = Number(row?.meta ?? 0);
    const mrrBase = Number(row?.mrrBase ?? 0);
    const isMesCorrente = Boolean(row?.isMesCorrente);
    const pctTotal = pctDaBase(total, mrrBase);
    const pontual = Number(row?.pontual ?? 0);
    const itens = motivos
      .map((motivo, i) => ({ motivo, valor: Number(row?.[motivo] ?? 0), cor: corDoMotivo(motivo, i) }))
      .filter((x) => x.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    return (
      <div className="rounded-md border border-border bg-background px-3 py-2 shadow-lg text-xs space-y-1 min-w-[200px]">
        <p className="font-semibold text-foreground capitalize">
          {label} {ano}
          {isMesCorrente && (
            <span className="ml-1 font-normal text-muted-foreground">· mês em curso</span>
          )}
        </p>
        <p className="text-muted-foreground">
          Churn: <span className="font-semibold text-foreground">{formatCurrencyNoDecimals(total)}</span>
          {pctTotal !== null && (
            <span className="font-semibold text-foreground"> · {formatPct(pctTotal)}</span>
          )}
        </p>
        {meta > 0 && (
          <p className="text-muted-foreground">
            Meta ({formatPct(metaPct)}): <span className="font-medium text-foreground">{formatCurrencyNoDecimals(meta)}</span>
            {total > meta && (
              <span className="text-red-500">
                {" "}(+{formatCurrencyNoDecimals(total - meta)}
                {pctTotal !== null && ` · +${((pctTotal - metaPct) * 100).toFixed(1).replace(".", ",")}pp`})
              </span>
            )}
          </p>
        )}
        {pontual > 0 && (
          <p className="text-muted-foreground">
            Pontual:{" "}
            <span className="font-semibold" style={{ color: pontualColor }}>
              {formatCurrencyNoDecimals(pontual)}
            </span>
          </p>
        )}
        <div className="pt-1 border-t border-border/50 space-y-0.5">
          {itens.map((x) => {
            const pctItem = pctDaBase(x.valor, mrrBase);
            return (
              <div key={x.motivo} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: x.cor }} />
                  {x.motivo}
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-medium text-foreground tabular-nums">{formatCurrencyNoDecimals(x.valor)}</span>
                  {pctItem !== null && (
                    <span className="text-muted-foreground tabular-nums w-10 text-right">
                      {formatPct(pctItem, 2)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Histórico de Churn {ano}</p>
          <p className="text-xs text-muted-foreground">
            MRR perdido por mês e motivo · % sobre o MRR ativo do mês · linha tracejada = meta {formatPct(metaPct)}
            {filterAbono === "nao_abonados" && " · sem abonados"}
            {filterAbono === "abonados" && " · só abonados"}
            {" · * mês em curso"}
            {data && !data.pontualDisponivel && " · sem dado de churn pontual neste ano"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground animate-pulse">
          Carregando histórico...
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
          Nenhum churn no período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 34, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="mesLabel"
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
              className="capitalize"
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrencyNoDecimals(v)}
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? "#27272a" : "#f4f4f5", opacity: 0.5 }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {motivos.map((motivo, i) => (
              <Bar
                key={motivo}
                dataKey={motivo}
                stackId="churn"
                fill={corDoMotivo(motivo, i)}
                radius={i === motivos.length - 1 ? [3, 3, 0, 0] : undefined}
              >
                {i === motivos.length - 1 && (
                  <LabelList
                    dataKey="total"
                    position="top"
                    content={(props: any) => {
                      const { x, y, width, index } = props;
                      const row = chartData[index] as Record<string, number | string | boolean>;
                      const total = Number(row?.total ?? 0);
                      if (total <= 0) return null;
                      const pct = pctDaBase(total, Number(row?.mrrBase ?? 0));
                      const acimaDaMeta = pct !== null && pct > metaPct;
                      const cx = Number(x) + Number(width) / 2;
                      return (
                        <g>
                          <text
                            x={cx}
                            y={Number(y) - 14}
                            textAnchor="middle"
                            style={{ fontSize: 10, fill: axisColor, fontWeight: 600 }}
                          >
                            {formatCurrencyNoDecimals(total)}
                          </text>
                          {pct !== null && (
                            <text
                              x={cx}
                              y={Number(y) - 3}
                              textAnchor="middle"
                              style={{
                                fontSize: 10,
                                fill: acimaDaMeta ? acimaMetaColor : dentroMetaColor,
                                fontWeight: 700,
                              }}
                            >
                              {formatPct(pct)}
                            </text>
                          )}
                        </g>
                      );
                    }}
                  />
                )}
              </Bar>
            ))}
            {data?.pontualDisponivel && (
              <Bar
                dataKey="pontual"
                name="Pontual"
                fill={pontualColor}
                radius={[3, 3, 0, 0]}
              />
            )}
            <Line
              type="monotone"
              dataKey="meta"
              name={`Meta ${formatPct(metaPct)} (MRR)`}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
