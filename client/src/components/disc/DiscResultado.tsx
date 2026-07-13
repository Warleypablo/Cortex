import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DISC_ARQUETIPOS, FATORES, type Fator } from "@shared/disc";

export interface DiscResultadoData {
  scoreD: number;
  scoreI: number;
  scoreS: number;
  scoreC: number;
  dominante: Fator;
  secundario: Fator;
  percentuais?: Record<Fator, number>;
  nome?: string;
  foto?: string | null;
  squad?: string | null;
  criadoEm?: string;
}

const FATOR_META: Record<Fator, { label: string; cor: string }> = {
  D: { label: "Dominância", cor: "#ef4444" },   // vermelho
  I: { label: "Influência", cor: "#f59e0b" },   // âmbar
  S: { label: "Estabilidade", cor: "#22c55e" }, // verde
  C: { label: "Conformidade", cor: "#3b82f6" }, // azul
};

export default function DiscResultado({ data }: { data: DiscResultadoData }) {
  const [modo, setModo] = useState<"barras" | "radar">("barras");

  const scores: Record<Fator, number> = { D: data.scoreD, I: data.scoreI, S: data.scoreS, C: data.scoreC };
  const total = scores.D + scores.I + scores.S + scores.C || 1;
  const pct = (f: Fator) => data.percentuais?.[f] ?? Math.round((scores[f] / total) * 100);

  const chartData = FATORES.map((f) => ({
    fator: f,
    label: FATOR_META[f].label,
    valor: pct(f),
    cor: FATOR_META[f].cor,
  }));

  const dom = DISC_ARQUETIPOS[data.dominante];
  const sec = DISC_ARQUETIPOS[data.secundario];
  const headline = `${dom.nome}-${sec.nome}`;

  return (
    <div className="space-y-6">
      {/* Cabeçalho do perfil */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Seu perfil dominante</p>
              <CardTitle className="text-2xl text-gray-900 dark:text-white flex items-center gap-3">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white font-bold"
                  style={{ backgroundColor: FATOR_META[data.dominante].cor }}
                >
                  {data.dominante}
                </span>
                {headline}
              </CardTitle>
              <p className="mt-1 text-gray-600 dark:text-zinc-400">{dom.tagline}</p>
            </div>
            <div className="flex gap-2">
              {FATORES.map((f) => (
                <div key={f} className="text-center">
                  <div
                    className="text-lg font-bold"
                    style={{ color: FATOR_META[f].cor }}
                  >
                    {pct(f)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400">{f}</div>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Gráfico */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900 dark:text-white text-base">Distribuição dos fatores</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant={modo === "barras" ? "default" : "outline"} onClick={() => setModo("barras")}>
              Barras
            </Button>
            <Button size="sm" variant={modo === "radar" ? "default" : "outline"} onClick={() => setModo("radar")}>
              Radar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {modo === "barras" ? (
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-zinc-700" />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.fator} fill={d.cor} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <RadarChart data={chartData}>
                  <PolarGrid className="stroke-gray-200 dark:stroke-zinc-700" />
                  <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar dataKey="valor" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </RadarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Blocos descritivos do perfil dominante */}
      <div className="grid gap-4 md:grid-cols-3">
        <DescBloco titulo="Pontos fortes" itens={dom.pontosFortes} />
        <DescBloco titulo="Como se comunicar" itens={dom.comunicacao} />
        <DescBloco titulo="Pontos de atenção" itens={dom.atencao} />
      </div>

      <p className="text-xs text-gray-400 dark:text-zinc-500">
        Perfil secundário: <Badge variant="secondary">{sec.nome}</Badge> — o DISC descreve
        tendências de comportamento, não capacidade ou valor. Não existe perfil melhor ou pior.
      </p>
    </div>
  );
}

function DescBloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-900 dark:text-white">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-zinc-300">
          {itens.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gray-400 dark:text-zinc-500">•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
