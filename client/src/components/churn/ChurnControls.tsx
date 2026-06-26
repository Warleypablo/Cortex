import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
} from "lucide-react";
import { format, subMonths } from "date-fns";

export interface ChurnControlsProps {
  dataInicio: string; dataFim: string;
  onChangePeriodo: (inicio: string, fim: string) => void;
  filterAbono: "todos" | "abonados" | "nao_abonados";
  onChangeAbono: (v: "todos" | "abonados" | "nao_abonados") => void;
}

export function ChurnControls(props: ChurnControlsProps): JSX.Element {
  const {
    dataInicio, dataFim, onChangePeriodo,
    filterAbono, onChangeAbono,
  } = props;

  const setQuickPeriod = (months: number) => {
    onChangePeriodo(
      format(subMonths(new Date(), months), "yyyy-MM-dd"),
      format(new Date(), "yyyy-MM-dd"),
    );
  };

  return (
    <>
      {/* Período de Análise */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Período de Análise</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => onChangePeriodo(e.target.value, dataFim)}
                className="w-40"
                data-testid="input-data-inicio"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fim</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => onChangePeriodo(dataInicio, e.target.value)}
                className="w-40"
                data-testid="input-data-fim"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(3)} data-testid="button-period-3m">3M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(6)} data-testid="button-period-6m">6M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(12)} data-testid="button-period-12m">12M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(24)} data-testid="button-period-24m">24M</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtro de abono */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40 w-fit">
          {([
            { key: "todos", label: "Todos" },
            { key: "nao_abonados", label: "Não abonados" },
            { key: "abonados", label: "Abonados" },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => onChangeAbono(opt.key)}
              data-testid={`filter-abono-${opt.key}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterAbono === opt.key
                  ? opt.key === "abonados"
                    ? "bg-amber-100 dark:bg-amber-900/40 shadow-sm text-amber-800 dark:text-amber-300"
                    : "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
