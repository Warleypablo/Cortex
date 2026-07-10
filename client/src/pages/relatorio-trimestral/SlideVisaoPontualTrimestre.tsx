import { Sparkles } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import type { RelatorioTrimestralData } from "./types";
import { HeroTile, InfoTile, formatBRL, fmtCompact, prevQuarterLabel } from "./visao-kit";

// Espelho da "Visão do Trimestre" recorrente, para o negócio PONTUAL.
//
// A leitura é um funil de estoque, não de recorrência:
//   Vendas (entra na fila) → Receita entregue (sai da fila) → Estoque (fila que sobra)
//
// Por isso o hero é a RECEITA ENTREGUE (o que vira P&L no trimestre), e o estoque
// carrega betterDirection "down": com lead time de ~68 dias, backlog crescendo é
// dívida de entrega, não vitória.
export default function SlideVisaoPontualTrimestre({ data }: { data: RelatorioTrimestralData }) {
  const { qoq, series } = data.trend;
  const vsLabel = prevQuarterLabel(data.trimestre);

  const atual = series.find((p) => p.q === data.trimestre);
  const contratosEntregues = atual?.pontualContratos ?? 0;
  const { tempoMedioEntregaDias, amostraEntregas } = data.visaoPontual;

  // "Vendas (pontual)" = o que o comercial FECHOU no Bitrix (deals ganhos pontuais),
  // mesmo número do card Pontual do "Contratos Fechados". Decisão Ichino (2026-07-10):
  // NÃO usar a aquisição do ClickUp (`vendasPontual`, que era maior — R$ 2,15M).
  // Sobrescreve só o ponto do tri atual na série; o histórico (Q4/Q1) segue do ClickUp
  // (não temos o Bitrix por trimestre), então o QoQ deste card fica oculto p/ não
  // comparar fontes diferentes.
  const vendasPontualBitrix = data.contratosMes.receitaPontual;
  const seriesVendas = series.map((p) =>
    p.q === data.trimestre ? { ...p, vendasPontual: vendasPontualBitrix } : p,
  );
  const qoqVendasBitrix = { atual: vendasPontualBitrix, anterior: 0, betterDirection: "up" as const };

  // Quanto entrou a mais do que saiu: o quanto a fila cresceu por vendas no tri.
  const saldoFila = vendasPontualBitrix - qoq.pontualReceita.atual;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={Sparkles}
        iconColor="text-purple-400"
        title={`Visão do Trimestre — ${data.label}${data.parcial ? " (parcial)" : ""}`}
        gradientColor="#a855f7"
        subtitle="Pontual"
      />
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        <div className="grid grid-cols-3 gap-4 flex-[3] min-h-0">
          <HeroTile
            label="Receita entregue (no trimestre)"
            q={qoq.pontualReceita}
            vsLabel={vsLabel}
            accent="#a855f7"
            series={series}
            getValue={(p) => p.pontual}
            hero
            delayMs={0}
          />
          <HeroTile
            label="Vendas (pontual)"
            q={qoqVendasBitrix}
            vsLabel={vsLabel}
            accent="#38bdf8"
            series={seriesVendas}
            getValue={(p) => p.vendasPontual}
            delayMs={100}
          />
          <HeroTile
            label="Estoque em aberto (fim do tri)"
            q={qoq.pontualEstoque}
            vsLabel={vsLabel}
            accent="#fbbf24"
            series={series}
            getValue={(p) => p.estoquePontual}
            delayMs={200}
          />
        </div>
        <div className="grid grid-cols-4 gap-4 flex-[2] min-h-0">
          <InfoTile
            label="Contratos entregues"
            valor={contratosEntregues}
            formatar={(v) => String(Math.round(v))}
            sub={`entregas com valor pontual no tri`}
            delayMs={350}
          />
          <InfoTile
            label="Clientes atendidos"
            valor={data.ticketsCliente.pontual.clientes}
            formatar={(v) => String(Math.round(v))}
            sub="clientes distintos com entrega no tri"
            delayMs={430}
          />
          <InfoTile
            label="Ticket médio pontual"
            valor={data.ticketsCliente.pontual.ticketMedio}
            formatar={formatBRL}
            sub={`receita pontual ÷ ${data.ticketsCliente.pontual.clientes} clientes atendidos`}
            delayMs={510}
          />
          <InfoTile
            label="Tempo médio de entrega"
            valor={tempoMedioEntregaDias}
            formatar={(v) => `${v.toFixed(1).replace(".", ",")}d`}
            sub={
              saldoFila > 0
                ? `da criação à entrega · ${amostraEntregas} contratos · fila cresceu ${fmtCompact(saldoFila)}`
                : `da criação à entrega · ${amostraEntregas} contratos`
            }
            delayMs={590}
          />
        </div>
      </div>
    </SlideLayout>
  );
}
