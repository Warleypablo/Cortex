import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type {
  DrilldownResponse, TipoReceita, Empresa,
} from "@shared/receitaRecorrenteTypes";

interface Props {
  open: boolean;
  mes: string | null;
  tipo: TipoReceita | null;
  empresa: Empresa | null;
  onClose: () => void;
}

const TIPO_LABEL: Record<TipoReceita, string> = {
  RECORRENTE: "Recorrente",
  PONTUAL: "Pontual",
  NAO_CLASSIFICADO: "Não Classificado",
};

// Parse local date para evitar off-by-one no Brasil.
function monthLabelLong(iso: string | null): string {
  if (!iso) return "";
  const [year, month] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

export function DrilldownClientesModal({ open, mes, tipo, empresa, onClose }: Props) {
  const [search, setSearch] = useState("");

  // queryKey[1] must be an object so the default queryFn builds the query string correctly.
  const queryParams = useMemo(() => {
    if (!mes || !tipo) return null;
    const p: Record<string, string> = { mes, tipo };
    if (empresa) p.empresa = empresa;
    return p;
  }, [mes, tipo, empresa]);

  const { data, isLoading, error, refetch } = useQuery<DrilldownResponse>({
    queryKey: ["/api/financeiro/receita-recorrente/drilldown", queryParams],
    enabled: open && !!queryParams,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(p =>
      (p.cliente_nome || "").toLowerCase().includes(q) ||
      (p.descricao || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const total = useMemo(
    () => filtered.reduce((acc, p) => acc + (p.valor_bruto || 0), 0),
    [filtered]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Parcelas — {monthLabelLong(mes)} — {tipo ? TIPO_LABEL[tipo] : ""} — {empresa || "Todas empresas"}
          </DialogTitle>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {isLoading
              ? "Carregando…"
              : `${formatCurrencyNoDecimals(total)} em ${filtered.length} parcelas`}
          </p>
        </DialogHeader>

        <div className="py-2">
          <Input
            placeholder="Buscar por cliente ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-y-auto flex-1">
          {error && (
            <div className="p-4 text-center">
              <p className="text-red-600 dark:text-red-400 mb-2">Falha ao carregar parcelas.</p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              Sem parcelas nessa categoria.
            </div>
          )}

          {!isLoading && !error && filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-left">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id_parcela}
                    className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-3 py-2 font-medium">
                      {p.cliente_nome || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-zinc-400 max-w-[300px] truncate">
                      {p.descricao || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-zinc-400 text-xs">
                      {p.categoria_nome || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrencyNoDecimals(p.valor_bruto)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">{p.status}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-zinc-400">
                      {p.data_vencimento}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
