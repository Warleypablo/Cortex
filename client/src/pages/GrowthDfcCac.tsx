import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface DfcCacResponse {
  meses: string[];
  receita: {
    recorrente: Record<string, number>;
    pontual: Record<string, number>;
    total: Record<string, number>;
    contratos: Record<string, number>;
  };
  custos: {
    grupos: {
      grupo: string;
      prefixo: string;
      linhas: { categoria: string; valores: Record<string, number> }[];
      subtotais: Record<string, number>;
    }[];
    total: Record<string, number>;
  };
  metricas: {
    cac: Record<string, number | null>;
    ticketMedioRec: Record<string, number | null>;
    payback: Record<string, number | null>;
    roi: Record<string, number | null>;
  };
  resumo: {
    cac: number | null;
    ticketMedioRec: number | null;
    payback: number | null;
    roi: number | null;
  };
}

function fmtMoeda(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function fmtMeses(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}m`;
}

function fmtMes(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[parseInt(m) - 1]}/${ano.slice(2)}`;
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">{label}</p>
        <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function GrowthDfcCac() {
  useSetPageInfo("DFC de CAC", "Custos de aquisição vs receita vendida — CAC, Payback e ROI por mês");

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<DfcCacResponse>({
    queryKey: ["/api/growth/dfc-cac"],
    queryFn: async () => {
      const res = await fetch("/api/growth/dfc-cac?meses=6");
      if (!res.ok) throw new Error("Erro ao carregar DFC de CAC");
      return res.json();
    },
  });

  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({
    "06.04": true,
    "06.06": true,
    "06.07": true,
  });

  const toggleGrupo = (prefixo: string) =>
    setExpandidos((prev) => ({ ...prev, [prefixo]: !prev[prefixo] }));

  if (isLoading || !data) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100 dark:bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
        <div className="h-96 rounded-lg bg-gray-100 dark:bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  const { meses, receita, custos, metricas, resumo } = data;

  const thBase = "text-right text-xs font-medium text-gray-500 dark:text-zinc-400 px-3 py-2 whitespace-nowrap";
  const tdBase = "text-right text-sm px-3 py-2 whitespace-nowrap tabular-nums";
  const sectionBg = isDark ? "bg-zinc-800/60" : "bg-gray-100";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard label="CAC (último mês)" value={fmtMoeda(resumo.cac)} sub="custo ÷ contratos fechados" />
        <SummaryCard label="Ticket Médio Rec." value={fmtMoeda(resumo.ticketMedioRec)} sub="MRR vendido ÷ contratos" />
        <SummaryCard label="Payback" value={fmtMeses(resumo.payback)} sub="CAC ÷ ticket médio" />
        <SummaryCard label="ROI de Aquisição" value={fmtPct(resumo.roi)} sub="(receita − custo) ÷ custo" />
      </div>

      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={sectionBg}>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-zinc-400 px-3 py-2 min-w-[220px]">Linha</th>
                {meses.map((m) => <th key={m} className={thBase}>{fmtMes(m)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">

              {/* RECEITA VENDIDA */}
              <tr className={sectionBg}>
                <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide" colSpan={meses.length + 1}>Receita Vendida</td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="px-3 py-2 pl-6 text-gray-700 dark:text-zinc-300">MRR Recorrente</td>
                {meses.map((m) => <td key={m} className={tdBase}>{receita.recorrente[m] ? fmtMoeda(receita.recorrente[m]) : "—"}</td>)}
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="px-3 py-2 pl-6 text-gray-700 dark:text-zinc-300">Pontual</td>
                {meses.map((m) => <td key={m} className={tdBase}>{receita.pontual[m] ? fmtMoeda(receita.pontual[m]) : "—"}</td>)}
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="px-3 py-2 pl-6 font-semibold text-green-700 dark:text-green-400">→ Total Receita</td>
                {meses.map((m) => <td key={m} className={cn(tdBase, "font-semibold text-green-700 dark:text-green-400")}>{receita.total[m] ? fmtMoeda(receita.total[m]) : "—"}</td>)}
              </tr>

              {/* CUSTO DE AQUISIÇÃO */}
              <tr className={sectionBg}>
                <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide" colSpan={meses.length + 1}>Custo de Aquisição</td>
              </tr>

              {custos.grupos.map((grupo) => (
                <React.Fragment key={grupo.prefixo}>
                  <tr className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/30" onClick={() => toggleGrupo(grupo.prefixo)}>
                    <td className="px-3 py-2 pl-4 font-medium text-gray-800 dark:text-zinc-200">
                      <span className="inline-flex items-center gap-1">
                        {expandidos[grupo.prefixo] ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                        {grupo.grupo}
                      </span>
                    </td>
                    {meses.map((m) => <td key={m} className={cn(tdBase, "text-gray-600 dark:text-zinc-400")}>{grupo.subtotais[m] ? fmtMoeda(grupo.subtotais[m]) : "—"}</td>)}
                  </tr>

                  {expandidos[grupo.prefixo] && grupo.linhas.map((linha) => (
                    <tr key={linha.categoria} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-1.5 pl-10 text-xs text-gray-500 dark:text-zinc-400">{linha.categoria.replace(/^\d+\.\d+\.\d+\s+/, "")}</td>
                      {meses.map((m) => <td key={m} className="text-right text-xs px-3 py-1.5 whitespace-nowrap tabular-nums text-gray-500 dark:text-zinc-400">{linha.valores[m] ? fmtMoeda(linha.valores[m]) : "—"}</td>)}
                    </tr>
                  ))}

                  <tr key={`sub-${grupo.prefixo}`} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                    <td className="px-3 py-2 pl-10 text-xs font-semibold text-gray-700 dark:text-zinc-300">→ Subtotal {grupo.prefixo}</td>
                    {meses.map((m) => <td key={m} className="text-right text-xs px-3 py-2 whitespace-nowrap tabular-nums font-semibold text-gray-700 dark:text-zinc-300">{grupo.subtotais[m] ? fmtMoeda(grupo.subtotais[m]) : "—"}</td>)}
                  </tr>
                </React.Fragment>
              ))}

              <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="px-3 py-2 pl-4 font-semibold text-red-700 dark:text-red-400">→ Total Custo</td>
                {meses.map((m) => <td key={m} className={cn(tdBase, "font-semibold text-red-700 dark:text-red-400")}>{custos.total[m] ? fmtMoeda(custos.total[m]) : "—"}</td>)}
              </tr>

              {/* RESULTADO */}
              <tr className={sectionBg}>
                <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide" colSpan={meses.length + 1}>Resultado</td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="px-3 py-2 pl-6 font-semibold text-gray-900 dark:text-white">Resultado Líquido</td>
                {meses.map((m) => {
                  const val = (receita.total[m] || 0) - (custos.total[m] || 0);
                  const hasData = receita.total[m] || custos.total[m];
                  return <td key={m} className={cn(tdBase, "font-semibold", hasData ? (val >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400") : "")}>{hasData ? fmtMoeda(val) : "—"}</td>;
                })}
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="px-3 py-2 pl-6 text-gray-700 dark:text-zinc-300">CAC</td>
                {meses.map((m) => <td key={m} className={tdBase}>{fmtMoeda(metricas.cac[m])}</td>)}
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="px-3 py-2 pl-6 text-gray-700 dark:text-zinc-300">Payback</td>
                {meses.map((m) => <td key={m} className={tdBase}>{fmtMeses(metricas.payback[m])}</td>)}
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="px-3 py-2 pl-6 text-gray-700 dark:text-zinc-300">ROI de Aquisição</td>
                {meses.map((m) => <td key={m} className={cn(tdBase, metricas.roi[m] === null ? "" : metricas.roi[m]! >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>{fmtPct(metricas.roi[m])}</td>)}
              </tr>

            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
