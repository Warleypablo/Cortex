import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface SquadRow { squad: string; cancelamentos: number; mrr: number; pct: number; }
interface OperadorRow { operador: string; cancelamentos: number; mrr: number; pct: number; }
interface ContratoRow { nome: string; squad: string; operador: string; valor_r: number; motivo: string; }

interface DetalheData {
  produto: string;
  mes: string;
  total_cancelamentos: number;
  total_mrr: number;
  ltv_mediano: number;
  squads: SquadRow[];
  operadores: OperadorRow[];
  contratos: ContratoRow[];
}

const PIE_COLORS = [
  "#6d28d9","#2563eb","#059669","#d97706","#dc2626",
  "#7c3aed","#0891b2","#65a30d","#ea580c","#db2777",
];

function formatMesLabel(mes: string): string {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, m] = mes.split("-");
  return `${meses[parseInt(m) - 1]}/${ano.slice(2)}`;
}

interface Props {
  produto: string;
  mes: string | null;
  onClose: () => void;
}

function PieLegend({ items, colors }: { items: { label: string; pct: number }[]; colors: string[] }) {
  return (
    <div className="space-y-1 mt-2">
      {items.slice(0, 6).map((item, i) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: colors[i % colors.length] }}
          />
          <span className="truncate text-gray-700 dark:text-zinc-300 flex-1" title={item.label}>
            {item.label}
          </span>
          <span className="font-medium text-gray-900 dark:text-white tabular-nums">
            {item.pct.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChurnDetalheDrawer({ produto, mes, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<DetalheData>({
    queryKey: ["/api/churn/produto-mes-detalhe", produto, mes],
    queryFn: () =>
      fetch(`/api/churn/produto-mes-detalhe?produto=${encodeURIComponent(produto)}&mes=${mes}`)
        .then(r => { if (!r.ok) throw new Error("API error"); return r.json(); }),
    enabled: !!mes && !!produto,
  });

  const tooltipStyle = {
    background: isDark ? "#18181b" : "#fff",
    border: isDark ? "1px solid #3f3f46" : "1px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 11,
  };

  return (
    <Sheet open={!!mes} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[520px] sm:max-w-[520px] overflow-y-auto bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700 p-0"
      >
        <SheetHeader className="border-b border-gray-200 dark:border-zinc-700 px-5 py-4">
          <SheetTitle className="text-base font-semibold text-gray-900 dark:text-white">
            {produto} — {mes ? formatMesLabel(mes) : ""}
          </SheetTitle>
          {data && !isLoading && (
            <p className="text-sm text-muted-foreground">
              {data.total_cancelamentos} contratos · {formatCurrencyNoDecimals(data.total_mrr)} perdidos
            </p>
          )}
        </SheetHeader>

        <div className="px-5 py-4">
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-36 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800" />
              ))}
            </div>
          )}

          {data && !isLoading && (
            <div className="space-y-6">

              {/* Pies: Squad e Operador */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                    Por Squad
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={data.squads}
                        dataKey="cancelamentos"
                        nameKey="squad"
                        cx="50%"
                        cy="50%"
                        outerRadius={62}
                        strokeWidth={0}
                      >
                        {data.squads.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [`${v} contratos`, name]}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend
                    items={data.squads.map(s => ({ label: s.squad, pct: s.pct }))}
                    colors={PIE_COLORS}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                    Por Operador
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={data.operadores}
                        dataKey="cancelamentos"
                        nameKey="operador"
                        cx="50%"
                        cy="50%"
                        outerRadius={62}
                        strokeWidth={0}
                      >
                        {data.operadores.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [`${v} contratos`, name]}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend
                    items={data.operadores.map(o => ({ label: o.operador, pct: o.pct }))}
                    colors={PIE_COLORS}
                  />
                </div>
              </div>

              {/* LTV Mediano */}
              <div className="rounded-lg bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 p-4">
                <p className="text-xs text-muted-foreground mb-1">LTV Mediano da Safra Perdida</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrencyNoDecimals(data.ltv_mediano)}
                </p>
              </div>

              {/* Contratos perdidos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Contratos Perdidos ({data.contratos.length})
                </p>
                <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-zinc-800/60">
                        <th className="text-left p-2 font-medium text-gray-600 dark:text-zinc-400">Cliente</th>
                        <th className="text-left p-2 font-medium text-gray-600 dark:text-zinc-400">Squad</th>
                        <th className="text-right p-2 font-medium text-gray-600 dark:text-zinc-400">MRR</th>
                        <th className="text-left p-2 font-medium text-gray-600 dark:text-zinc-400">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.contratos.map((c, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-zinc-800">
                          <td className="p-2 text-gray-900 dark:text-zinc-100 max-w-[140px] truncate" title={c.nome}>
                            {c.nome}
                          </td>
                          <td className="p-2 text-gray-600 dark:text-zinc-400 max-w-[90px] truncate" title={c.squad}>
                            {c.squad}
                          </td>
                          <td className="p-2 text-right font-medium text-gray-900 dark:text-zinc-100 tabular-nums">
                            {formatCurrencyNoDecimals(c.valor_r)}
                          </td>
                          <td className="p-2 text-gray-600 dark:text-zinc-400 max-w-[110px] truncate" title={c.motivo}>
                            {c.motivo}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
