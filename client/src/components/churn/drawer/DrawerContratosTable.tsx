import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { type ChurnContract } from "@/components/churn/types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yy", { locale: ptBR });
  } catch {
    return d;
  }
}

export function DrawerContratosTable({
  contratos,
  onToggleAbono,
  pendingIds,
  abonadoOverrides,
}: {
  contratos: ChurnContract[];
  onToggleAbono: (taskId: string, abonar: boolean) => void;
  pendingIds: Set<string>;
  abonadoOverrides: Record<string, boolean>;
}): JSX.Element {
  if (contratos.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-8">
        Nenhum contrato neste recorte.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-zinc-700">
            <th className="text-left py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              Cliente
            </th>
            <th className="text-left py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              Responsável
            </th>
            <th className="text-right py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              MRR
            </th>
            <th className="text-right py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              Pontual
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
                <td
                  className="py-2 pr-3 text-gray-600 dark:text-zinc-400 max-w-[130px] truncate"
                  title={c.responsavel || undefined}
                >
                  {c.responsavel && c.responsavel !== "Não especificado" ? (
                    c.responsavel
                  ) : (
                    <span className="text-gray-400 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                  {c.valorr ? (
                    formatCurrency(c.valorr)
                  ) : (
                    <span className="font-normal text-gray-400 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  {c.valorp ? (
                    formatCurrency(c.valorp)
                  ) : (
                    <span className="font-normal text-gray-400 dark:text-zinc-600">—</span>
                  )}
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
                    {(c.lifetime_meses ?? 0).toFixed(1)}m
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
  );
}
