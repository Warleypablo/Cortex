import { TrendingUp } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import type { RelatorioTrimestralData } from "./types";
import { HeroTile, InfoTile, formatBRL, prevQuarterLabel } from "./visao-kit";

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
        subtitle="Recorrente"
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
            delayMs={0}
          />
          <HeroTile
            label="Vendas (recorrente)"
            q={qoq.vendas}
            vsLabel={vsLabel}
            accent="#38bdf8"
            series={series}
            getValue={(p) => p.vendas}
            delayMs={100}
          />
          <HeroTile
            label="Churn (R$ no trimestre)"
            q={qoq.churn}
            vsLabel={vsLabel}
            accent="#f87171"
            series={series}
            getValue={(p) => p.churn}
            delayMs={200}
          />
        </div>
        <div className="grid grid-cols-4 gap-4 flex-[2] min-h-0">
          <InfoTile
            label="Churn % (média mensal)"
            valor={churnPctMedia}
            formatar={(v) => `${v.toFixed(1).replace(".", ",")}%`}
            sub={`média dos ${nMeses} meses do tri · churn ÷ MRR ativo`}
            delayMs={350}
          />
          <InfoTile
            label="Clientes recorrentes ativos"
            valor={data.ticketsCliente.recorrente.clientes}
            formatar={(v) => String(Math.round(v))}
            sub="com contrato recorrente · foto do fim do tri"
            delayMs={430}
          />
          <InfoTile
            label="Ticket médio recorrente"
            valor={data.ticketsCliente.recorrente.ticketMedio}
            formatar={formatBRL}
            sub={`MRR ÷ ${data.ticketsCliente.recorrente.clientes} clientes recorrentes ativos`}
            delayMs={510}
          />
          <InfoTile
            label="Ticket médio pontual"
            valor={data.ticketsCliente.pontual.ticketMedio}
            formatar={formatBRL}
            sub={`receita pontual ÷ ${data.ticketsCliente.pontual.clientes} clientes atendidos no tri`}
            delayMs={590}
          />
        </div>
      </div>
    </SlideLayout>
  );
}
