// client/src/components/bp2026/BPMonthSelector.tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  mes: number; // 1-12
  mesMaximo: number; // último mês navegável (mesCorrente)
  parcial: boolean; // true quando o mês exibido é o mês corrente incompleto
  onChange: (mes: number) => void;
}

export function BPMonthSelector({ mes, mesMaximo, parcial, onChange }: Props) {
  return (
    <div className="flex items-center gap-2" data-testid="bp-month-selector">
      <Button
        variant="outline"
        size="icon"
        disabled={mes <= 1}
        onClick={() => onChange(mes - 1)}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-36 text-center font-semibold text-gray-900 dark:text-white">
        {MESES[mes - 1]} 2026
        {parcial && (
          <Badge variant="outline" className="ml-2 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
            parcial
          </Badge>
        )}
      </span>
      <Button
        variant="outline"
        size="icon"
        disabled={mes >= mesMaximo}
        onClick={() => onChange(mes + 1)}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
