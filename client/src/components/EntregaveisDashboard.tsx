import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface DashboardItem {
  contrato_id: number;
  numero_contrato: string;
  cliente_nome: string | null;
  total_folhas: string;
  concluidas: string;
  atrasadas: string;
}

export function EntregaveisDashboard() {
  const { data: items = [], isLoading } = useQuery<DashboardItem[]>({
    queryKey: ["/api/contratos/entregaveis/dashboard"],
    queryFn: () => fetch("/api/contratos/entregaveis/dashboard").then((r) => r.json()),
  });

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando dashboard...</div>;

  if (items.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Nenhum contrato com entregaveis.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const total = parseInt(item.total_folhas) || 0;
        const done = parseInt(item.concluidas) || 0;
        const overdue = parseInt(item.atrasadas) || 0;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={item.contrato_id} className="p-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.cliente_nome || "Sem cliente"}</p>
                <p className="text-xs text-gray-400">#{item.numero_contrato}</p>
              </div>
              {overdue > 0 ? (
                <Badge variant="destructive" className="text-[10px]">
                  <AlertTriangle className="w-3 h-3 mr-1" />{overdue} atrasado{overdue > 1 ? "s" : ""}
                </Badge>
              ) : progress === 100 ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Completo
                </Badge>
              ) : null}
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{done}/{total} entregaveis</span>
              <span>{progress}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
