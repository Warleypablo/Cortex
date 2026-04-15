import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import type {
  MesReceita, Empresa, CellClickPayload,
} from "@shared/receitaRecorrenteTypes";

interface Props {
  meses: MesReceita[];
  onCellClick: (payload: CellClickPayload) => void;
}

// Parse ISO "YYYY-MM-01" como data local (não UTC) para evitar off-by-one
// no fuso horário do Brasil (UTC-3 puxa "2026-03-01" para "2026-02-28"
// quando vai para toLocaleString).
function monthLabel(iso: string): string {
  const [year, month] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  return `${label}/${year.slice(-2)}`;
}

function empresaLabel(e: Empresa): string {
  return e === "TURBO PARTNERS" ? "Turbo" : "PD";
}

function coberturaBadge(pct: number) {
  if (pct >= 90) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
        {pct.toFixed(0)}%
      </span>
    );
  }
  if (pct >= 70) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
        {pct.toFixed(0)}%
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
      {pct.toFixed(0)}%
    </span>
  );
}

function ValorCell({
  value, onClick, disabled,
}: {
  value: number;
  onClick?: () => void;
  disabled: boolean;
}) {
  if (disabled || value === 0) {
    return (
      <td className="px-3 py-2 text-right text-sm text-gray-400 dark:text-zinc-600">
        —
      </td>
    );
  }
  return (
    <td className="px-3 py-2 text-right text-sm">
      <button
        type="button"
        onClick={onClick}
        className="hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
      >
        {formatCurrencyNoDecimals(value)}
      </button>
    </td>
  );
}

export function TabelaReceitaMensal({ meses, onCellClick }: Props) {
  const sorted = [...meses].sort((a, b) => {
    if (a.mes !== b.mes) return a.mes.localeCompare(b.mes);
    return a.empresa.localeCompare(b.empresa);
  });

  // Totalizador do rodapé
  const totais = sorted.reduce(
    (acc, m) => ({
      recorrente: acc.recorrente + m.recorrente_realizado,
      pontual: acc.pontual + m.pontual_realizado,
      nao_classif: acc.nao_classif + m.nao_classif_realizado,
      previsto: acc.previsto + m.total_previsto,
      realizado: acc.realizado + m.total_realizado,
    }),
    { recorrente: 0, pontual: 0, nao_classif: 0, previsto: 0, realizado: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhamento mensal</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-zinc-700">
            <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              <th className="px-3 py-2 text-left">Mês</th>
              <th className="px-3 py-2 text-left">Empresa</th>
              <th className="px-3 py-2 text-right">Recorrente</th>
              <th className="px-3 py-2 text-right">Pontual</th>
              <th className="px-3 py-2 text-right">Não Classif</th>
              <th className="px-3 py-2 text-right">Previsto</th>
              <th className="px-3 py-2 text-right">Realizado</th>
              <th className="px-3 py-2 text-right">% Real</th>
              <th className="px-3 py-2 text-center">Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const pctReal = m.total_previsto > 0 ? (m.total_realizado / m.total_previsto) * 100 : 0;
              const rowCls = cn(
                "border-b border-gray-100 dark:border-zinc-800",
                m.is_futuro && "opacity-60"
              );
              return (
                <tr key={`${m.mes}-${m.empresa}`} className={rowCls}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1">
                      {m.is_futuro && <Clock className="w-3 h-3 text-gray-400" />}
                      <span>{monthLabel(m.mes)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">{empresaLabel(m.empresa)}</td>
                  <ValorCell
                    value={m.recorrente_realizado}
                    onClick={() => onCellClick({ mes: m.mes, tipo: "RECORRENTE", empresa: m.empresa })}
                    disabled={m.is_futuro}
                  />
                  <ValorCell
                    value={m.pontual_realizado}
                    onClick={() => onCellClick({ mes: m.mes, tipo: "PONTUAL", empresa: m.empresa })}
                    disabled={m.is_futuro}
                  />
                  <ValorCell
                    value={m.nao_classif_realizado}
                    onClick={() => onCellClick({ mes: m.mes, tipo: "NAO_CLASSIFICADO", empresa: m.empresa })}
                    disabled={m.is_futuro}
                  />
                  <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(m.total_previsto)}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrencyNoDecimals(m.total_realizado)}
                  </td>
                  <td className="px-3 py-2 text-right">{pctReal.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-center">{coberturaBadge(m.cobertura_cc_pct)}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="border-t-2 border-gray-300 dark:border-zinc-600 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Total</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.recorrente)}</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.pontual)}</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.nao_classif)}</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.previsto)}</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.realizado)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </CardContent>
    </Card>
  );
}
