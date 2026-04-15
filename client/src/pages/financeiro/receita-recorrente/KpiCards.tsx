import { Card, CardContent } from "@/components/ui/card";
import { HeroMetric } from "@/components/HeroMetric";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { CardsReceita } from "@shared/receitaRecorrenteTypes";

interface Props {
  cards: CardsReceita;
}

function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

function formatDelta(pct: number): { value: string; isPositive: boolean } {
  const sign = pct >= 0 ? "+" : "";
  return {
    value: `${sign}${pct.toFixed(1)}% vs mês anterior`,
    isPositive: pct >= 0,
  };
}

export function KpiCards({ cards }: Props) {
  const gapColor = (() => {
    if (!cards.gap_contratado) return "text-gray-500";
    const pct = Math.abs(cards.gap_contratado.pct);
    if (pct < 3) return "text-emerald-600 dark:text-emerald-400";
    if (pct < 10) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  })();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            label="Gap vs Contratado"
            value={
              cards.gap_contratado
                ? `${formatCurrencyNoDecimals(cards.gap_contratado.valor)} (${cards.gap_contratado.pct.toFixed(1)}%)`
                : "—"
            }
            subtitle="MRR contratado (ClickUp) − MRR realizado recorrente (Conta Azul)"
          />
          <div className={`mt-1 text-xs ${gapColor}`}>
            {cards.gap_contratado
              ? Math.abs(cards.gap_contratado.pct) < 3
                ? "Dentro da tolerância"
                : Math.abs(cards.gap_contratado.pct) < 10
                ? "Atenção"
                : "Divergência alta"
              : ""}
          </div>
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
            value={`+${cards.novos_recorrente} / −${cards.churned_recorrente}`}
            subtitle="Clientes com parcela recorrente neste mês que não estavam no mês anterior (ou vice-versa)"
          />
        </CardContent>
      </Card>
    </div>
  );
}
