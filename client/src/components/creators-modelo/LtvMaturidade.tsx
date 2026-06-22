import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { RedesignPayload } from "./types";

export function LtvMaturidade({ data }: { data: RedesignPayload }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const lt = data.ltvMaduro;
  const dados = [
    { nome: "Pontual (realizado)", valor: data.placar.porCliente.pontual, cor: "#6366f1" },
    { nome: "Recorrente (blended)", valor: lt.realizadoBlended, cor: "#7dd3fc" },
    { nome: "Recorrente (ativos)", valor: lt.realizadoAtivo, cor: "#0ea5e9" },
  ];
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">LTV por cliente — ajustado por maturidade</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Pontual já é realizado. Recorrente vai do realizado blended ao realizado entre ativos (ainda subindo). Comparar maçã com maçã exige olhar a faixa, não só o blended.
        </p>
      </CardHeader>
      <CardContent>
        {data.maturidade.aviso && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Maturidades diferentes: recorrente {data.maturidade.recorrenteIdade}m vs pontual {data.maturidade.pontualIdade}m de idade média. O LTV recorrente realizado ainda vai crescer — compare pela faixa/projeção.</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dados} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} />
            <Tooltip contentStyle={{ backgroundColor: isDark ? "#18181b" : "#fff", border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`, borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827" }} formatter={(v: number) => formatCurrencyNoDecimals(v)} />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="LTV/cliente">
              {dados.map((d, i) => <Cell key={i} fill={d.cor} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
