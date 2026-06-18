import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Rocket } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

// Dados hardcoded espelhando o Painel ClickUp — Projetos Tech (https://tech-dash.pages.dev/).
// Capturados em 2026-06-18. Atualizar manualmente a cada reporte enquanto não houver integração.
const RESUMO = {
  entregueAno: 849514,
  projetosAno: 70,
  ticketMedioAno: 12135.91,
  metaAnual: 2400000,
};

const TRIMESTRES = [
  { label: "Q1", realizado: 458705, meta: 450000 },
  { label: "Q2", realizado: 390809, meta: 600000 },
  { label: "Q3", realizado: 0, meta: 650000 },
  { label: "Q4", realizado: 0, meta: 700000 },
];

const TOP_ACCOUNTS = [
  { nome: "Davi Ferraz", projetos: 26, valor: 365580 },
  { nome: "Bibiana Paz", projetos: 20, valor: 247694 },
  { nome: "Vinicius Paiva", projetos: 18, valor: 182240 },
  { nome: "Hiuri Liberato", projetos: 4, valor: 29000 },
  { nome: "Breno Carmo", projetos: 2, valor: 25000 },
];

const MEDALHAS = ["🥇", "🥈", "🥉"];
const ACCENT = "#60a5fa"; // azul do tema tech
const META_COLOR = "#3f3f46";

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

function QuarterTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.dataKey === "realizado" ? ACCENT : "#a1a1aa" }}>
          {p.dataKey === "realizado" ? "Realizado" : "Meta"}: {fmtBRL(p.value)}
        </p>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <SecondaryCard className="flex flex-col items-center justify-center p-3 text-center">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
    </SecondaryCard>
  );
}

interface Props {
  // Mantidos por compatibilidade com o caller — slide agora usa dados hardcoded do tech-dash.
  techData?: unknown;
  mesLabel?: string;
}

export default function SlideAreaTech(_props: Props) {
  const pctMeta = (RESUMO.entregueAno / RESUMO.metaAnual) * 100;
  const maxAccount = TOP_ACCOUNTS[0].valor;

  return (
    <SlideLayout section="tech" padding="28px 36px">
      <SlideHeader
        icon={Rocket}
        iconColor="text-blue-400"
        title="Área Tech"
        subtitle="Projetos Tech · 2026"
        badge="Painel ClickUp"
        gradientColor="#3b82f6"
      />

      {/* KPIs — Visão Geral 2026 */}
      <div className="grid grid-cols-4 gap-3 shrink-0 mb-4">
        <KpiCard label="Entregue em 2026" value={fmtBRL(RESUMO.entregueAno)} sub={`${RESUMO.projetosAno} projetos`} accent="text-blue-400" />
        <KpiCard label="Projetos entregues" value={String(RESUMO.projetosAno)} sub="no ano" accent="text-white" />
        <KpiCard label="Ticket médio" value={fmtBRL(RESUMO.ticketMedioAno)} sub="média do ano" accent="text-cyan-400" />

        {/* Meta anual com barra de progresso */}
        <SecondaryCard className="flex flex-col justify-center p-3" borderColor={ACCENT}>
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Meta anual</p>
            <p className="text-lg font-black tabular-nums" style={{ color: ACCENT }}>{pctMeta.toFixed(0)}%</p>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mb-1">
            <div className="h-full rounded-full" style={{ width: `${pctMeta}%`, backgroundColor: ACCENT }} />
          </div>
          <p className="text-[10px] text-zinc-500 tabular-nums">
            {fmtBRL(RESUMO.entregueAno)} / {fmtBRL(RESUMO.metaAnual)}
          </p>
        </SecondaryCard>
      </div>

      {/* Grid: Trimestres + Top Accounts */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Realizado vs Meta por trimestre */}
        <ChartCard>
          <div className="flex items-center gap-4 mb-1">
            <p className="text-sm font-bold text-zinc-200">Realizado vs Meta por Trimestre</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ACCENT }} /> Realizado
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: META_COLOR }} /> Meta
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TRIMESTRES} margin={{ top: 20, right: 10, left: 0, bottom: 4 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a40" />
                <XAxis dataKey="label" height={22} interval={0} tick={{ fill: "#d4d4d8", fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} tickFormatter={fmtK} width={42} />
                <Tooltip content={<QuarterTooltip />} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="meta" fill={META_COLOR} radius={[3, 3, 0, 0]} />
                <Bar dataKey="realizado" radius={[3, 3, 0, 0]}>
                  {TRIMESTRES.map((t) => (
                    <Cell key={t.label} fill={t.realizado >= t.meta ? "#22c55e" : ACCENT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Top Accounts 2026 */}
        <ChartCard>
          <p className="text-sm font-bold text-zinc-200 mb-2">Top Accounts · 2026</p>
          <div className="flex-1 flex flex-col justify-center gap-2">
            {TOP_ACCOUNTS.map((acc, i) => (
              <div key={acc.nome} className="flex items-center gap-3">
                <span className="w-6 text-center text-base shrink-0">
                  {MEDALHAS[i] ?? <span className="text-xs text-zinc-500">{i + 1}º</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate">{acc.nome}</span>
                    <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: ACCENT }}>
                      {fmtBRL(acc.valor)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(acc.valor / maxAccount) * 100}%`, backgroundColor: i < 3 ? ACCENT : "#52525b" }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 shrink-0 w-16 text-right">{acc.projetos} projetos</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </SlideLayout>
  );
}
