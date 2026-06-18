import { Timer, AlertTriangle } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

// Dados hardcoded espelhando a aba "Projetos" do Painel ClickUp — Projetos Tech
// (https://tech-dash.pages.dev/projetos), recorte Q2 2026. Capturados em 2026-06-18.
// Atualizar manualmente a cada reporte enquanto não houver integração.
const PERIODO = "Q2 2026";

const RESUMO = {
  totalProjetos: 31,
  tipos: 6,
  tempoMedio: 32.9,
  tempoMediano: 29.3,
  noPrazo: 97,
  metaPrazo: 90,
  antesPrazo: 83,
  metaAntes: 30,
  gargalo: "Design Review",
};

// Fluxo do pipeline (ordem de trabalho). Design Review é o gargalo (maior tempo médio).
const TEMPO_POR_STATUS = [
  { status: "Pronto p/ Design", dias: 4.0, color: "#2dd4bf" },
  { status: "Design", dias: 3.8, color: "#4ade80" },
  { status: "Design Review", dias: 8.7, color: "#16a34a" },
  { status: "Pronto p/ Dev", dias: 1.7, color: "#60a5fa" },
  { status: "Desenvolvimento", dias: 5.1, color: "#818cf8" },
  { status: "Dev Review", dias: 6.0, color: "#a78bfa" },
  { status: "Pronto p/ Lançar", dias: 3.5, color: "#fb923c" },
];

// Ordenado por volume de projetos entregues no trimestre.
const TEMPO_POR_TIPO = [
  { tipo: "E-Commerce Standard", projetos: 14, dias: 39.8, color: "#22c55e" },
  { tipo: "CRO", projetos: 8, dias: 17.5, color: "#eab308" },
  { tipo: "Landing Page", projetos: 5, dias: 29.9, color: "#ec4899" },
  { tipo: "Site", projetos: 2, dias: 63.3, color: "#3b82f6" },
  { tipo: "Ecommerce Plus", projetos: 1, dias: 37.5, color: "#14b8a6" },
  { tipo: "Integração", projetos: 1, dias: 8.2, color: "#71717a" },
];

function fmtDias(v: number): string {
  return `${v.toFixed(1).replace(".", ",")}d`;
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <SecondaryCard className="p-3 flex flex-col justify-center gap-0.5">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </SecondaryCard>
  );
}

interface Props {
  // Mantidos por compatibilidade com o caller — slide agora usa dados hardcoded do tech-dash.
  techData?: unknown;
  mesLabel?: string;
}

export default function SlideEntregasPontuaisTech(_props: Props) {
  const maxStatus = Math.max(...TEMPO_POR_STATUS.map((s) => s.dias));
  const maxTipo = Math.max(...TEMPO_POR_TIPO.map((t) => t.dias));
  const prazoOk = RESUMO.noPrazo >= RESUMO.metaPrazo;
  const antesOk = RESUMO.antesPrazo >= RESUMO.metaAntes;

  return (
    <SlideLayout section="tech" padding="28px 36px">
      <SlideHeader
        icon={Timer}
        iconColor="text-blue-400"
        title="Entregas Tech · Performance"
        subtitle={`${PERIODO} · Pronto p/ Design → Deploy`}
        badge="Painel ClickUp"
        gradientColor="#3b82f6"
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 shrink-0 mb-4">
        <KpiCard label="Projetos entregues" value={String(RESUMO.totalProjetos)} sub={`${RESUMO.tipos} tipos · ${PERIODO}`} accent="text-blue-400" />
        <KpiCard label="Tempo médio" value={fmtDias(RESUMO.tempoMedio)} sub={`mediano ${fmtDias(RESUMO.tempoMediano)}`} accent="text-cyan-400" />
        <KpiCard label="Entregues no prazo" value={`${RESUMO.noPrazo}%`} sub={`meta ${RESUMO.metaPrazo}%`} accent={prazoOk ? "text-emerald-400" : "text-red-400"} />
        <KpiCard label="Antes do prazo" value={`${RESUMO.antesPrazo}%`} sub={`meta ${RESUMO.metaAntes}%`} accent={antesOk ? "text-emerald-400" : "text-red-400"} />
      </div>

      {/* Grid: Tempo por Status + Tempo por Tipo */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Tempo médio por status */}
        <ChartCard>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-zinc-200">Tempo Médio por Status</p>
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <AlertTriangle className="h-3 w-3" /> gargalo: {RESUMO.gargalo}
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-2">
            {TEMPO_POR_STATUS.map((s) => {
              const isGargalo = s.status === RESUMO.gargalo;
              return (
                <div key={s.status} className="flex items-center gap-2">
                  <span className={`text-[11px] w-28 shrink-0 text-right ${isGargalo ? "text-amber-300 font-semibold" : "text-zinc-400"}`}>
                    {s.status}
                  </span>
                  <div className="flex-1 h-4 rounded bg-zinc-800/60 overflow-hidden">
                    <div
                      className="h-full rounded flex items-center justify-end pr-1.5"
                      style={{ width: `${(s.dias / maxStatus) * 100}%`, backgroundColor: s.color }}
                    >
                      <span className="text-[10px] font-bold text-black/70 tabular-nums">{fmtDias(s.dias)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        {/* Tempo médio por tipo */}
        <ChartCard>
          <p className="text-sm font-bold text-zinc-200 mb-2">Tempo Médio por Tipo de Projeto</p>
          <div className="flex-1 flex flex-col justify-center gap-2.5">
            {TEMPO_POR_TIPO.map((t) => (
              <div key={t.tipo}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-sm text-white truncate">{t.tipo}</span>
                    <span className="text-[10px] text-zinc-500 shrink-0">{t.projetos} proj</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: t.color }}>{fmtDias(t.dias)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(t.dias / maxTipo) * 100}%`, backgroundColor: t.color }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </SlideLayout>
  );
}
