import { Card, CardContent } from "@/components/ui/card";
import { HeroMetric } from "@/components/HeroMetric";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { CardsReceita } from "@shared/receitaRecorrenteTypes";

interface Props {
  cards: CardsReceita;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDelta(pct: number): { value: string; isPositive: boolean } | undefined {
  if (pct === 0) return undefined;
  const sign = pct > 0 ? "+" : "";
  return {
    value: `${sign}${pct.toFixed(1)}% vs mês anterior`,
    isPositive: pct > 0,
  };
}

export function KpiCards({ cards }: Props) {
  return (
    <div
      role="region"
      aria-label="KPIs de Receita Recorrente"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="MRR Recorrente (mês)"
            value={formatCurrencyNoDecimals(cards.mrr_recorrente_atual)}
            trend={formatDelta(cards.mrr_recorrente_delta_pct)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Receita Pontual (mês)"
            value={formatCurrencyNoDecimals(cards.pontual_atual)}
            trend={formatDelta(cards.pontual_delta_pct)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Mix Recorrente %"
            value={formatPct(cards.mix_recorrente_pct)}
            subtitle="% da receita total do mês que é recorrente"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Realizado do mês"
            value={formatPct(cards.realizado_pct)}
            subtitle="% do valor previsto que já foi pago"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Ticket Médio Recorrente"
            value={formatCurrencyNoDecimals(cards.ticket_medio_recorrente)}
            subtitle="Valor recorrente do mês / clientes únicos"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Entrantes / Saintes"
            value={`+${Math.max(0, cards.novos_recorrente)} / −${Math.max(0, cards.churned_recorrente)}`}
            subtitle="Clientes com parcela recorrente neste mês que não estavam no mês anterior (ou vice-versa)"
          />
        </CardContent>
      </Card>
    </div>
  );
}
