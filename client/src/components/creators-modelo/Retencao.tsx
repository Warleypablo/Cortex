import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Repeat } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { RedesignPayload } from "./types";

export function Retencao({ data }: { data: RedesignPayload }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const tt = { backgroundColor: isDark ? "#18181b" : "#fff", border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`, borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827" };
  const [base, setBase] = useState<"vendido" | "entregue">("entregue");
  const funil = (base === "entregue" ? data.retencao.funilEntregue : data.retencao.funilVendido)
    .map((f) => ({ nome: `${f.nivel}ª`, valor: f.atingiram }));
  const safra = data.retencao.safra.map((s) => ({ nome: s.safra, valor: s.pctAtivo }));
  const rec = data.retencao.recompra;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Retenção: pontual × recorrente</CardTitle>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Pontual = funil de entregas concluídas (clientes) · Recorrente = % ainda ativo por safra de entrada</p>
            </div>
            <Select value={base} onValueChange={(v) => setBase(v as "vendido" | "entregue")}>
              <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="entregue">Base: entregue</SelectItem><SelectItem value="vendido">Base: vendido</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">Pontual — clientes por entrega ({data.meta.pctSequenciados}% sequenciados)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funil} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} /><XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} /><YAxis tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tt} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="Clientes">{funil.map((_, i) => <Cell key={i} fill="#6366f1" />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-sky-600 dark:text-sky-400">Recorrente — % ativo por safra</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={safra} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} /><XAxis dataKey="nome" tick={{ fill: axis, fontSize: 10 }} angle={-30} textAnchor="end" height={50} /><YAxis domain={[0, 100]} tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tt} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="% ativo">{safra.map((_, i) => <Cell key={i} fill="#0ea5e9" />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Repeat className="h-4 w-4 text-indigo-500" /> Recompra (avulsos)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{rec.pctRecompra}%</div>
          <p className="text-sm text-gray-600 dark:text-zinc-300">{rec.comRecompra} de {rec.totalAvulsos} clientes avulsos compraram 2+ vezes.</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Para os avulsos (compra única), recompra é o sinal de retenção.</p>
        </CardContent>
      </Card>
    </div>
  );
}
