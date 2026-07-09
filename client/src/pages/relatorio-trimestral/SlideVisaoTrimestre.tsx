import { TrendingUp } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { RelatorioTrimestralData, Qoq, TrendPoint } from "./types";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

// Formato compacto p/ valores de apoio (sparkline, "vs"): R$ 1,06M · R$ 788k
function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return formatBRL(v);
}

function variacaoPct(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

// Label do trimestre anterior a partir de "YYYY-Qn" (Q1 recua para Q4 do ano anterior)
function prevQuarterLabel(trimestre: string): string {
  const [anoStr, qStr] = trimestre.split("-Q");
  const ano = parseInt(anoStr, 10);
  const q = parseInt(qStr, 10);
  return q === 1 ? `Q4 ${ano - 1}` : `Q${q - 1} ${ano}`;
}

function VariacaoBadge({ q }: { q: Qoq }) {
  const pct = variacaoPct(q.atual, q.anterior);
  if (pct === null) return <span className="text-zinc-500 text-sm">—</span>;
  const positivo = pct >= 0;
  const bom = q.betterDirection === "up" ? positivo : !positivo;
  const cor = bom ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10";
  const seta = positivo ? "▲" : "▼";
  return (
    <span className={`${cor} text-sm font-bold tabular-nums rounded-full px-2.5 py-0.5`}>
      {seta} {Math.abs(pct).toFixed(1).replace(".", ",")}%
    </span>
  );
}

// Sparkline de barras por trimestre: anteriores apagados (zinc), o atual na cor da métrica.
function QuarterSparkline({
  series,
  getValue,
  accent,
}: {
  series: TrendPoint[];
  getValue: (p: TrendPoint) => number;
  accent: string;
}) {
  if (series.length < 2) return null;
  const max = Math.max(...series.map(getValue));
  if (max <= 0) return null;
  const BAR_H = 52;
  return (
    <div className="flex items-end gap-2 mt-auto pt-3">
      {series.map((p, i) => {
        const v = getValue(p);
        const isCurrent = i === series.length - 1;
        const h = Math.max(Math.round((v / max) * BAR_H), 4);
        return (
          <div key={p.q} className="flex flex-col items-center flex-1 min-w-0" title={`${p.label}: ${fmtCompact(v)}`}>
            <div
              className="w-full rounded-t-sm"
              style={{ height: h, backgroundColor: isCurrent ? accent : "#3f3f46", opacity: isCurrent ? 1 : 0.8 }}
            />
            <span className={`text-[9px] mt-1 leading-none ${isCurrent ? "text-zinc-300 font-bold" : "text-zinc-600"}`}>
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HeroTile({
  label,
  q,
  vsLabel,
  accent,
  series,
  getValue,
  hero = false,
}: {
  label: string;
  q: Qoq;
  vsLabel: string;
  accent: string;
  series: TrendPoint[];
  getValue: (p: TrendPoint) => number;
  hero?: boolean;
}) {
  return (
    <SecondaryCard className="p-5 flex flex-col min-h-0" borderColor={accent}>
      <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className={`${hero ? "text-5xl" : "text-4xl"} font-black text-white mt-1.5`}>{formatBRL(q.atual)}</p>
      <div className="flex items-center gap-2 mt-2">
        <VariacaoBadge q={q} />
        <span className="text-xs text-zinc-500">
          vs {vsLabel} · {fmtCompact(q.anterior)}
        </span>
      </div>
      <QuarterSparkline series={series} getValue={getValue} accent={accent} />
    </SecondaryCard>
  );
}

function InfoTile({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <SecondaryCard className="p-5 flex flex-col justify-center">
      <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-4xl font-black text-white mt-1.5">{valor}</p>
      <span className="text-xs text-zinc-500 mt-2">{sub}</span>
    </SecondaryCard>
  );
}

export default function SlideVisaoTrimestre({ data }: { data: RelatorioTrimestralData }) {
  const { qoq, series } = data.trend;
  const vsLabel = prevQuarterLabel(data.trimestre);
  // Churn % como MÉDIA MENSAL do trimestre (churn do tri ÷ nº de meses ÷ MRR ativo).
  // O total do tri ÷ MRR lê como churn mensal catastrófico — média mensal é a leitura honesta.
  const nMeses = data.mesesComputados.length || 3;
  const churnPctMedia = data.turboMetrics.mrrAtivo > 0
    ? (data.turboMetrics.churnMrr / nMeses / data.turboMetrics.mrrAtivo) * 100
    : 0;
  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={TrendingUp}
        iconColor="text-emerald-400"
        title={`Visão do Trimestre — ${data.label}${data.parcial ? " (parcial)" : ""}`}
        gradientColor="#10b981"
      />
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        <div className="grid grid-cols-3 gap-4 flex-[3] min-h-0">
          <HeroTile
            label="MRR (fim do trimestre)"
            q={qoq.mrr}
            vsLabel={vsLabel}
            accent="#34d399"
            series={series}
            getValue={(p) => p.mrr}
            hero
          />
          <HeroTile
            label="Vendas (recorrente)"
            q={qoq.vendas}
            vsLabel={vsLabel}
            accent="#38bdf8"
            series={series}
            getValue={(p) => p.vendas}
          />
          <HeroTile
            label="Churn (R$ no trimestre)"
            q={qoq.churn}
            vsLabel={vsLabel}
            accent="#f87171"
            series={series}
            getValue={(p) => p.churn}
          />
        </div>
        <div className="grid grid-cols-3 gap-4 flex-[2] min-h-0">
          <InfoTile
            label="Churn % (média mensal)"
            valor={`${churnPctMedia.toFixed(1).replace(".", ",")}%`}
            sub={`média dos ${nMeses} meses do tri · churn ÷ MRR ativo`}
          />
          <InfoTile
            label="Clientes ativos"
            valor={String(data.turboMetrics.clientesAtivos)}
            sub="foto do fim do trimestre"
          />
          <InfoTile
            label="Ticket médio por cliente"
            valor={formatBRL(data.turboMetrics.ticketMedioCliente)}
            sub="MRR ÷ clientes ativos"
          />
        </div>
      </div>
    </SlideLayout>
  );
}
