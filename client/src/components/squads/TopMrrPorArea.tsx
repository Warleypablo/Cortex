import { useQuery } from "@tanstack/react-query";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, FileText, Receipt } from "lucide-react";

interface ClienteArea {
  nome: string;
  squad: string;
  mrr: number;
  contratos: number;
  responsavel: string;
}

interface AreaData {
  mrr: number;
  contratos: number;
  ticketMedio: number;
  clientes: ClienteArea[];
}

interface TopMrrAreaResponse {
  comunicacao: AreaData;
  performance: AreaData;
}

interface TopMrrPorAreaProps {
  mesAno: string;
}

function AreaCard({
  title,
  color,
  data,
}: {
  title: string;
  color: string;
  data: AreaData;
}) {
  return (
    <Card className="flex-1 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-white">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-zinc-800">
            <DollarSign className="w-4 h-4 mx-auto mb-1 text-gray-500 dark:text-zinc-400" />
            <p className="text-xs text-gray-500 dark:text-zinc-400">MRR Total</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {formatCurrencyNoDecimals(data.mrr)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-zinc-800">
            <FileText className="w-4 h-4 mx-auto mb-1 text-gray-500 dark:text-zinc-400" />
            <p className="text-xs text-gray-500 dark:text-zinc-400">Contratos</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{data.contratos}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-zinc-800">
            <Receipt className="w-4 h-4 mx-auto mb-1 text-gray-500 dark:text-zinc-400" />
            <p className="text-xs text-gray-500 dark:text-zinc-400">Ticket Médio</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {formatCurrencyNoDecimals(data.ticketMedio)}
            </p>
          </div>
        </div>

        {/* Tabela de clientes */}
        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 dark:bg-zinc-800 z-10">
              <TableRow>
                <TableHead className="text-gray-600 dark:text-zinc-400">#</TableHead>
                <TableHead className="text-gray-600 dark:text-zinc-400">Cliente</TableHead>
                <TableHead className="text-gray-600 dark:text-zinc-400">Squad</TableHead>
                <TableHead className="text-right text-gray-600 dark:text-zinc-400">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.clientes.map((c, i) => (
                <TableRow key={`${c.nome}-${i}`} className="border-gray-100 dark:border-zinc-800">
                  <TableCell className="text-gray-500 dark:text-zinc-500 w-8">{i + 1}</TableCell>
                  <TableCell className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                    {c.nome}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-zinc-400 text-sm">{c.squad}</TableCell>
                  <TableCell className="text-right font-semibold text-gray-900 dark:text-white">
                    {formatCurrencyNoDecimals(c.mrr)}
                  </TableCell>
                </TableRow>
              ))}
              {data.clientes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 dark:text-zinc-500 py-8">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TopMrrPorArea({ mesAno }: TopMrrPorAreaProps) {
  const { data, isLoading } = useQuery<TopMrrAreaResponse>({
    queryKey: ["/api/analise-squads/top-mrr-area", mesAno],
    queryFn: async () => {
      const response = await fetch(`/api/analise-squads/top-mrr-area?mesAno=${mesAno}`);
      if (!response.ok) throw new Error("Falha ao buscar dados");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[500px]" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Top MRR por Área</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AreaCard title="Comunicação" color="#ec4899" data={data.comunicacao} />
        <AreaCard title="Performance" color="#3b82f6" data={data.performance} />
      </div>
    </div>
  );
}
