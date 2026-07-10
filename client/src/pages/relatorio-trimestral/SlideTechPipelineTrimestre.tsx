import { Timer, AlertTriangle, CheckCircle2 } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { TechPipelineData } from "./types";
import { ACCENT, entranceWith, entrance, GrowBar, DeckKeyframes } from "./deck-kit";
import { useCountUp } from "./useCountUp";

function fmtDias(v: number): string {
  return `${v.toFixed(1).replace(".", ",")}d`;
}

function KpiCard({
  label, value, sub, color = "#fff", delayMs, icon: Icon,
}: {
  label: string; value: string; sub: string; color?: string; delayMs: number; icon?: typeof Timer;
}) {
  return (
    <div {...entrance(delayMs)}>
      <SecondaryCard className="px-4 py-3 h-full flex flex-col justify-center" borderColor={color}>
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3 w-3 shrink-0" style={{ color }} />}
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest whitespace-nowrap">{label}</p>
        </div>
        <p className="text-[28px] leading-none font-black mt-1.5 tabular-nums" style={{ color }}>{value}</p>
        <p className="text-[10px] text-zinc-500 mt-1 leading-tight">{sub}</p>
      </SecondaryCard>
    </div>
  );
}

export default function SlideTechPipelineTrimestre({
  pipeline, label,
}: {
  pipeline: TechPipelineData; label: string;
}) {
  const medioAnim = useCountUp(pipeline.tempoMedioDias, 800, 200);
  const medianoAnim = useCountUp(pipeline.tempoMedianoDias, 800, 250);
  const prazoAnim = useCountUp(pipeline.noPrazo.pct, 800, 300);
  const projetosAnim = useCountUp(pipeline.projetos, 800, 150);

  if (!pipeline.disponivel) {
    return (
      <SlideLayout section="tech" padding="28px 36px">
        <SlideHeader icon={Timer} iconColor="text-cyan-400" title={`Projetos Tech — Tempo por Status — ${label}`} gradientColor={ACCENT.cyan} />
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <p className="text-zinc-400">Painel de pipeline indisponível para este trimestre.</p>
          <p className="text-xs text-zinc-600">Fonte: {pipeline.fonte}</p>
        </div>
      </SlideLayout>
    );
  }

  const maxStatus = Math.max(...pipeline.porStatus.map((s) => s.dias), 0.1);
  const tipos = pipeline.porTipo.slice(0, 6);
  const maxTipo = Math.max(...tipos.map((t) => t.dias), 0.1);

  const bateuMeta = pipeline.noPrazo.pct >= pipeline.noPrazo.meta;

  return (
    <SlideLayout section="tech" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader
        icon={Timer}
        iconColor="text-cyan-400"
        title={`Projetos Tech — Tempo por Status — ${label}`}
        gradientColor={ACCENT.cyan}
        subtitle={`Do "Pronto p/ Design" ao Deploy · fonte: ${pipeline.fonte}`}
      />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Hero: 5 KPIs */}
        <div className="grid grid-cols-5 gap-3 shrink-0">
          <KpiCard
            label="Projetos entregues"
            value={String(Math.round(projetosAnim))}
            sub={`${pipeline.tipos} tipos diferentes`}
            color={ACCENT.cyan}
            delayMs={0}
          />
          <KpiCard
            label="Tempo médio total"
            value={fmtDias(medioAnim)}
            sub="do Pronto p/ Design ao Deploy"
            color="#fff"
            icon={Timer}
            delayMs={60}
          />
          <KpiCard
            label="Tempo mediano"
            value={fmtDias(medianoAnim)}
            sub="50% dos projetos abaixo disso"
            color="#fff"
            delayMs={120}
          />
          <KpiCard
            label="Entregues no prazo"
            value={`${Math.round(prazoAnim)}%`}
            sub={`meta ${pipeline.noPrazo.meta}% · ${pipeline.noPrazo.total} projetos com prazo`}
            color={bateuMeta ? ACCENT.mrr : ACCENT.churn}
            icon={bateuMeta ? CheckCircle2 : AlertTriangle}
            delayMs={180}
          />
          <KpiCard
            label="Status mais demorado"
            value={pipeline.statusMaisLento}
            sub="maior tempo médio"
            color={ACCENT.amber}
            icon={AlertTriangle}
            delayMs={240}
          />
        </div>

        {/* Dois blocos: tempo por status e tempo por tipo */}
        <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
          <div {...entranceWith(300, "flex flex-col min-h-0")}>
            <SecondaryCard className="px-4 py-3 flex-1 flex flex-col min-h-0" borderColor={ACCENT.cyan}>
              <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-2.5 shrink-0">
                Tempo médio por status
              </p>
              <div className="flex-1 flex flex-col justify-center gap-2 min-h-0">
                {pipeline.porStatus.map((s, i) => (
                  <div key={s.status} className="flex items-center gap-2.5">
                    <span className="w-[104px] text-[11px] text-zinc-400 text-right truncate shrink-0" title={s.label}>
                      {s.label}
                    </span>
                    <div className="flex-1 h-5 rounded-md overflow-hidden bg-white/[0.04]">
                      <GrowBar
                        widthPct={(s.dias / maxStatus) * 100}
                        delayMs={380 + i * 60}
                        className="rounded-md"
                        style={{ backgroundColor: s.color }}
                      />
                    </div>
                    <span className="w-12 text-[11px] font-bold text-white text-right shrink-0 tabular-nums">
                      {fmtDias(s.dias)}
                    </span>
                  </div>
                ))}
              </div>
            </SecondaryCard>
          </div>

          <div {...entranceWith(380, "flex flex-col min-h-0")}>
            <SecondaryCard className="px-4 py-3 flex-1 flex flex-col min-h-0" borderColor={ACCENT.pontual}>
              <div className="flex items-baseline justify-between gap-2 mb-2.5 shrink-0">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Tempo médio por tipo</p>
                <p className="text-[10px] text-zinc-600">barra vermelha = estourou o prazo</p>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-2 min-h-0">
                {tipos.map((t, i) => {
                  // dentroDoPrazo null = tipo sem prazo definido no config do tech-dash
                  const cor = t.dentroDoPrazo === false ? ACCENT.churn : t.dentroDoPrazo === true ? ACCENT.vendas : "#52525b";
                  return (
                    <div key={t.tipo} className="flex items-center gap-2.5">
                      <span className="w-[112px] text-[11px] text-zinc-400 text-right truncate shrink-0" title={t.tipo}>
                        {t.tipo} <span className="text-zinc-600">({t.projetos})</span>
                      </span>
                      <div className="flex-1 h-5 rounded-md overflow-hidden bg-white/[0.04]">
                        <GrowBar
                          widthPct={(t.dias / maxTipo) * 100}
                          delayMs={460 + i * 60}
                          className="rounded-md"
                          style={{ backgroundColor: cor }}
                        />
                      </div>
                      <span className="w-12 text-[11px] font-bold text-white text-right shrink-0 tabular-nums">
                        {fmtDias(t.dias)}
                      </span>
                      <span className="w-20 text-[10px] text-zinc-600 text-right shrink-0 tabular-nums">
                        {t.prazoDiasUteis != null ? `prazo ${t.prazoDiasUteis}d úteis` : "sem prazo"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SecondaryCard>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
