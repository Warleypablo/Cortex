// client/src/components/creators-modelo/FunilSobrevivencia.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import type { CreatorsModeloPayload } from "./types";

export function FunilSobrevivencia({ data }: { data: CreatorsModeloPayload }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const [base, setBase] = useState<"vendido" | "entregue">("entregue");

  const funil = base === "entregue" ? data.funilEntregue : data.funilVendido;
  const dadosFunil = funil.map((f) => ({ nome: `${f.nivel}ª entrega`, valor: f.atingiram }));
  const dadosCurva = data.curvaRecorrente.map((c) => ({ nome: `${c.meses}m`, valor: c.pctSobrevivencia }));

  const tooltip = {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
    borderRadius: 8,
    color: isDark ? "#f4f4f5" : "#111827",
  };

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Sobrevivência: pontual × recorrente</CardTitle>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Pontual = funil de entregas ({data.meta.pctSequenciados}% dos clientes) · Recorrente = % ativo após N meses
            </p>
          </div>
          <Select value={base} onValueChange={(v) => setBase(v as "vendido" | "entregue")}>
            <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entregue">Base: entregue</SelectItem>
              <SelectItem value="vendido">Base: vendido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">Pontual — entregas (clientes)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dadosFunil} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} />
                <YAxis tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltip} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="Clientes">
                  {dadosFunil.map((_, i) => <Cell key={i} fill="#6366f1" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-sky-600 dark:text-sky-400">Recorrente — % ainda ativo</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dadosCurva} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} />
                <YAxis tick={{ fill: axis, fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltip} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="% ativo">
                  {dadosCurva.map((_, i) => <Cell key={i} fill="#0ea5e9" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
