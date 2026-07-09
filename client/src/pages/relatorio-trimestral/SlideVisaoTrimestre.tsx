import { TrendingUp } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { RelatorioTrimestralData, Qoq } from "./types";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function variacaoPct(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function VariacaoBadge({ q }: { q: Qoq }) {
  const pct = variacaoPct(q.atual, q.anterior);
  if (pct === null) return <span className="text-zinc-500 text-sm">—</span>;
  const positivo = pct >= 0;
  const bom = q.betterDirection === "up" ? positivo : !positivo;
  const cor = bom ? "text-emerald-400" : "text-red-400";
  const seta = positivo ? "▲" : "▼";
  return <span className={`${cor} text-sm font-bold tabular-nums`}>{seta} {Math.abs(pct).toFixed(1).replace(".", ",")}%</span>;
}

function Card({ label, valor, q }: { label: string; valor: string; q: Qoq }) {
  return (
    <SecondaryCard className="p-5 flex flex-col gap-2">
      <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-white tabular-nums">{valor}</p>
      <div className="flex items-center gap-2">
        <VariacaoBadge q={q} />
        <span className="text-xs text-zinc-500">vs {formatBRL(q.anterior)}</span>
      </div>
    </SecondaryCard>
  );
}

export default function SlideVisaoTrimestre({ data }: { data: RelatorioTrimestralData }) {
  const { qoq } = data.trend;
  const churnPct = data.turboMetrics.mrrAtivo > 0
    ? (data.turboMetrics.churnMrr / data.turboMetrics.mrrAtivo) * 100 : 0;
  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={TrendingUp}
        iconColor="text-emerald-400"
        title={`Visão do Trimestre — ${data.label}${data.parcial ? " (parcial)" : ""}`}
        gradientColor="#10b981"
      />
      <div className="flex-1 grid grid-cols-3 gap-5 content-center">
        <Card label="MRR (fim do tri)" valor={formatBRL(qoq.mrr.atual)} q={qoq.mrr} />
        <Card label="Vendas (recorrente)" valor={formatBRL(qoq.vendas.atual)} q={qoq.vendas} />
        <Card label="Churn (R$)" valor={formatBRL(qoq.churn.atual)} q={qoq.churn} />
        <SecondaryCard className="p-5 flex flex-col gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Churn %</p>
          <p className="text-3xl font-black text-white tabular-nums">{churnPct.toFixed(1).replace(".", ",")}%</p>
          <span className="text-xs text-zinc-500">churn R$ ÷ MRR ativo</span>
        </SecondaryCard>
        <SecondaryCard className="p-5 flex flex-col gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Clientes ativos</p>
          <p className="text-3xl font-black text-white tabular-nums">{data.turboMetrics.clientesAtivos}</p>
          <span className="text-xs text-zinc-500">foto do fim do tri</span>
        </SecondaryCard>
        <SecondaryCard className="p-5 flex flex-col gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Ticket médio</p>
          <p className="text-3xl font-black text-white tabular-nums">{formatBRL(data.turboMetrics.ticketMedioCliente)}</p>
          <span className="text-xs text-zinc-500">MRR ÷ clientes</span>
        </SecondaryCard>
      </div>
    </SlideLayout>
  );
}
