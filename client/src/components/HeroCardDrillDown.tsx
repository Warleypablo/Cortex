import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";

interface DrillDownItem {
  id: string;
  label: string;
  sublabel?: string;
  valor: number;
  details: Record<string, string | number | null>;
}

interface DrillDownResult {
  metric: string;
  total: number;
  count: number;
  items: DrillDownItem[];
}

type MetricKey = "mrr_ativo" | "vendas_mrr" | "inadimplencia" | "churn" | "vendas_pontuais" | "entregas_pontuais" | "cogs_csv" | "cac_total" | "sga_total" | "capex" | "taxes_on_revenue" | "tax_ir_csll" | "revenue_other";

interface ColumnDef {
  key: string;
  header: string;
  accessor: (item: DrillDownItem) => string;
}

const METRIC_COLUMNS: Record<MetricKey, ColumnDef[]> = {
  mrr_ativo: [
    { key: "cliente", header: "Cliente", accessor: (i) => i.label },
    { key: "squad", header: "Squad", accessor: (i) => String(i.details.squad || "—") },
    { key: "responsavel", header: "Responsável", accessor: (i) => String(i.details.responsavel || "—") },
    { key: "valor", header: "MRR (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  vendas_mrr: [
    { key: "deal", header: "Deal", accessor: (i) => i.label },
    { key: "empresa", header: "Empresa", accessor: (i) => i.sublabel || "—" },
    { key: "closer", header: "Closer", accessor: (i) => String(i.details.closer || "—") },
    { key: "valor", header: "MRR (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  inadimplencia: [
    { key: "cliente", header: "Cliente", accessor: (i) => i.label },
    { key: "valor_total", header: "Valor Total", accessor: (i) => formatBRL(i.valor) },
    { key: "parcelas", header: "Parcelas", accessor: (i) => String(i.details.parcelas ?? "—") },
    { key: "dias_atraso", header: "Dias Atraso", accessor: (i) => String(i.details.dias_atraso ?? i.details.max_dias_atraso ?? "—") },
  ],
  churn: [
    { key: "cliente", header: "Cliente", accessor: (i) => i.label },
    { key: "squad", header: "Squad", accessor: (i) => String(i.details.squad || "—") },
    { key: "produto", header: "Produto", accessor: (i) => String(i.details.produto || "—") },
    { key: "valor", header: "MRR Perdido (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  vendas_pontuais: [
    { key: "deal", header: "Deal", accessor: (i) => i.label },
    { key: "empresa", header: "Empresa", accessor: (i) => i.sublabel || "—" },
    { key: "closer", header: "Closer", accessor: (i) => String(i.details.closer || "—") },
    { key: "valor", header: "Valor (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  entregas_pontuais: [
    { key: "cliente", header: "Cliente", accessor: (i) => i.label },
    { key: "squad", header: "Squad", accessor: (i) => String(i.details.squad || "—") },
    { key: "servico", header: "Serviço", accessor: (i) => String(i.details.servico || "—") },
    { key: "valor", header: "Valor (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  cogs_csv: [
    { key: "fornecedor", header: "Fornecedor", accessor: (i) => i.label },
    { key: "descricao", header: "Descrição", accessor: (i) => i.sublabel || "—" },
    { key: "categoria", header: "Categoria", accessor: (i) => String(i.details.categoria || "—") },
    { key: "valor", header: "Valor (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  cac_total: [
    { key: "fornecedor", header: "Fornecedor", accessor: (i) => i.label },
    { key: "descricao", header: "Descrição", accessor: (i) => i.sublabel || "—" },
    { key: "categoria", header: "Categoria", accessor: (i) => String(i.details.categoria || "—") },
    { key: "valor", header: "Valor (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  sga_total: [
    { key: "fornecedor", header: "Fornecedor", accessor: (i) => i.label },
    { key: "descricao", header: "Descrição", accessor: (i) => i.sublabel || "—" },
    { key: "categoria", header: "Categoria", accessor: (i) => String(i.details.categoria || "—") },
    { key: "valor", header: "Valor (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  capex: [
    { key: "fornecedor", header: "Fornecedor", accessor: (i) => i.label },
    { key: "descricao", header: "Descrição", accessor: (i) => i.sublabel || "—" },
    { key: "categoria", header: "Categoria", accessor: (i) => String(i.details.categoria || "—") },
    { key: "valor", header: "Valor (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  taxes_on_revenue: [
    { key: "fornecedor", header: "Fornecedor", accessor: (i) => i.label },
    { key: "descricao", header: "Descrição", accessor: (i) => i.sublabel || "—" },
    { key: "categoria", header: "Categoria", accessor: (i) => String(i.details.categoria || "—") },
    { key: "valor", header: "Valor (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  tax_ir_csll: [
    { key: "fornecedor", header: "Fornecedor", accessor: (i) => i.label },
    { key: "descricao", header: "Descrição", accessor: (i) => i.sublabel || "—" },
    { key: "categoria", header: "Categoria", accessor: (i) => String(i.details.categoria || "—") },
    { key: "valor", header: "Valor (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
  revenue_other: [
    { key: "fornecedor", header: "Fonte", accessor: (i) => i.label },
    { key: "descricao", header: "Descrição", accessor: (i) => i.sublabel || "—" },
    { key: "categoria", header: "Categoria", accessor: (i) => String(i.details.categoria || "—") },
    { key: "valor", header: "Valor (R$)", accessor: (i) => formatBRL(i.valor) },
  ],
};

const METRIC_HREF: Record<string, string> = {
  inadimplencia: "/dashboard/inadimplencia",
  churn: "/dashboard/churn-detalhamento",
  vendas_mrr: "/dashboard/comercial/closers",
};

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface InadimplenciaClienteRow {
  cliente_nome: string;
  valor_total: number;
  qtd_parcelas: number;
  max_dias_atraso: number;
}

export function HeroCardDrillDown({
  metric,
  title,
  open,
  onOpenChange,
  month,
}: {
  metric: MetricKey | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month?: string;
}) {
  const isInadimplencia = metric === "inadimplencia";

  const { data, isLoading } = useQuery<DrillDownResult>({
    queryKey: ["/api/okr2026/hero-drilldown", metric, month],
    queryFn: async () => {
      const params = new URLSearchParams({ metric: metric! });
      if (month) params.set("month", month);
      const res = await fetch(`/api/okr2026/hero-drilldown?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch drilldown");
      return res.json();
    },
    enabled: open && !!metric && !isInadimplencia,
  });

  const { data: inadData, isLoading: inadLoading } = useQuery<InadimplenciaClienteRow[]>({
    queryKey: ["/api/inadimplencia/clientes"],
    queryFn: async () => {
      const res = await fetch("/api/inadimplencia/clientes");
      if (!res.ok) throw new Error("Failed to fetch inadimplencia");
      return res.json();
    },
    enabled: open && isInadimplencia,
  });

  const loading = isInadimplencia ? inadLoading : isLoading;

  const normalizedItems: DrillDownItem[] = (() => {
    if (isInadimplencia && inadData) {
      return inadData.map((r, i) => ({
        id: String(i),
        label: r.cliente_nome || "Sem nome",
        sublabel: "",
        valor: r.valor_total || 0,
        details: { parcelas: r.qtd_parcelas, max_dias_atraso: r.max_dias_atraso },
      }));
    }
    return data?.items || [];
  })();

  const total = normalizedItems.reduce((s, i) => s + i.valor, 0);
  const count = normalizedItems.length;
  const columns = metric ? METRIC_COLUMNS[metric] : [];
  const detailHref = metric ? METRIC_HREF[metric] : undefined;

  const monthLabel = month
    ? (() => {
        const [y, m] = month.split('-');
        const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        return `${names[parseInt(m, 10) - 1]}/${y}`;
      })()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-900 dark:text-white">
            {title}{monthLabel ? ` — ${monthLabel}` : ''}
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-zinc-400">
            {count} {count === 1 ? "item" : "itens"} — Total: {formatBRL(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : normalizedItems.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-500 dark:text-zinc-400">
              Nenhum item encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-zinc-700">
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={`text-gray-600 dark:text-zinc-400 ${col.key === "valor" ? "text-right" : ""}`}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {normalizedItems.map((item) => (
                  <TableRow key={item.id} className="border-gray-100 dark:border-zinc-800">
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`text-gray-800 dark:text-zinc-200 ${col.key === "valor" ? "text-right font-medium" : ""}`}
                      >
                        {col.accessor(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {detailHref && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-zinc-700 pt-3 flex justify-end">
            <Link href={detailHref} className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              Ver detalhes completos <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
