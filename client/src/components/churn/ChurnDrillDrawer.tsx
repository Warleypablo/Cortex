import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { type ChurnContract } from "./types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ChurnDrillDrawerProps {
  open: boolean;
  titulo: string;
  contratos: ChurnContract[];
  onClose: () => void;
  onToggleAbono: (taskId: string, abonar: boolean) => void;
  pendingIds: Set<string>;
  abonadoOverrides: Record<string, boolean>;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yy", { locale: ptBR });
  } catch {
    return d;
  }
}

export function ChurnDrillDrawer({
  open,
  titulo,
  contratos,
  onClose,
  onToggleAbono,
  pendingIds,
  abonadoOverrides,
}: ChurnDrillDrawerProps): JSX.Element {
  const totalMrr = contratos.reduce((sum, c) => sum + (c.valorr ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-gray-900 dark:text-white text-lg font-semibold">
            {titulo}
          </SheetTitle>
          <SheetDescription className="text-gray-500 dark:text-zinc-400 text-sm">
            {contratos.length} contrato{contratos.length !== 1 ? "s" : ""}
            {" · "}
            MRR perdido:{" "}
            <span className="font-medium text-red-600 dark:text-red-400">
              {formatCurrency(totalMrr)}
            </span>
          </SheetDescription>
        </SheetHeader>

        {contratos.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-8">
            Nenhum contrato neste recorte.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-700">
                  <th className="text-left py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                    Cliente
                  </th>
                  <th className="text-right py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                    MRR
                  </th>
                  <th className="text-left py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                    Motivo
                  </th>
                  <th className="text-right py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                    LT
                  </th>
                  <th className="text-right py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                    Data enc.
                  </th>
                  <th className="text-center py-2 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                    Abonar
                  </th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c) => {
                  const isAbonado = abonadoOverrides[c.id] ?? c.is_abonado ?? false;
                  const isPending = pendingIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="py-2 pr-3 text-gray-900 dark:text-white font-medium max-w-[160px] truncate">
                        {c.cliente_nome}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                        {formatCurrency(c.valorr)}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 max-w-[160px]">
                        {c.motivo_cancelamento ? (
                          <span className="truncate block" title={c.motivo_cancelamento}>
                            {c.motivo_cancelamento}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">
                          {c.lifetime_meses.toFixed(1)}m
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatDate(c.data_encerramento)}
                      </td>
                      <td className="py-2 text-center">
                        <Switch
                          checked={isAbonado}
                          disabled={isPending}
                          onCheckedChange={(checked) => onToggleAbono(c.id, checked)}
                          aria-label={`Abonar ${c.cliente_nome}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
