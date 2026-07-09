import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Activity } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import type { TrendData } from "./types";

function fmtK(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}

export default function SlideEvolucaoTrimestre({ trend }: { trend: TrendData }) {
  const data = trend.series.map((s) => ({ label: s.label, mrr: s.mrr, vendas: s.vendas, churn: s.churn }));
  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader icon={Activity} iconColor="text-sky-400" title="Evolução por Trimestre" gradientColor="#0ea5e9" />
      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        <div className="flex flex-col">
          <p className="text-sm text-zinc-400 mb-2">MRR (fim de cada trimestre)</p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
              <YAxis stroke="#a1a1aa" fontSize={12} tickFormatter={fmtK} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} />
              <Line type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col">
          <p className="text-sm text-zinc-400 mb-2">Vendas (recorrente) × Churn por trimestre</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
              <YAxis stroke="#a1a1aa" fontSize={12} tickFormatter={fmtK} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} />
              <Bar dataKey="vendas" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="churn" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </SlideLayout>
  );
}
