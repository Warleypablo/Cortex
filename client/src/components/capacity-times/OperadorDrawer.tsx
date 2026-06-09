import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

interface Contrato {
  cliente: string;
  produto: string;
  status: string;
  valorr: number;
  valorp: number;
  id_subtask: string;
}

interface Props {
  operador: string | null;
  onClose: () => void;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ativo"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400"
      : status === "onboarding"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400";
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", cls)}>
      {status}
    </span>
  );
}

export function OperadorDrawer({ operador, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<{ contratos: Contrato[] }>({
    queryKey: ["/api/capacity-times/contratos", operador],
    queryFn: async () => {
      const res = await fetch(`/api/capacity-times/contratos?nome=${encodeURIComponent(operador!)}`);
      if (!res.ok) throw new Error("Erro ao buscar contratos");
      return res.json();
    },
    enabled: !!operador,
  });

  const contratos = data?.contratos ?? [];
  const totalMrr = contratos.reduce((s, c) => s + c.valorr, 0);

  return (
    <Sheet open={!!operador} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 overflow-y-auto"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-gray-900 dark:text-white text-lg">
            {operador}
          </SheetTitle>
          {!isLoading && (
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {contratos.length} contrato{contratos.length !== 1 ? "s" : ""} · MRR total{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totalMrr)}
              </span>
            </p>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100 dark:bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        ) : contratos.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-zinc-400 py-12">
            Nenhum contrato ativo encontrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200 dark:border-zinc-700">
                <TableHead className="text-gray-600 dark:text-zinc-400">Cliente</TableHead>
                <TableHead className="text-gray-600 dark:text-zinc-400">Produto</TableHead>
                <TableHead className="text-gray-600 dark:text-zinc-400">Status</TableHead>
                <TableHead className="text-right text-gray-600 dark:text-zinc-400">MRR</TableHead>
                <TableHead className="text-right text-gray-600 dark:text-zinc-400">Pontual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratos.map((c) => (
                <TableRow key={c.id_subtask} className="border-gray-200 dark:border-zinc-700">
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {c.cliente}
                  </TableCell>
                  <TableCell className="text-gray-700 dark:text-zinc-300">{c.produto}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right text-gray-900 dark:text-white">
                    {c.valorr > 0 ? formatCurrency(c.valorr) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-gray-500 dark:text-zinc-400">
                    {c.valorp > 0 ? formatCurrency(c.valorp) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SheetContent>
    </Sheet>
  );
}
