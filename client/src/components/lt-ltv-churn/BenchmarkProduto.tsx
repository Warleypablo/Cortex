import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { ProdutoBenchmark } from "./types";

type Situacao = "ambos" | "ativo" | "cancelado";

function pick(p: ProdutoBenchmark, situacao: Situacao) {
  if (situacao === "ativo") return { lt: p.ltMedioAtivo, ltv: p.ltvMedioAtivo };
  if (situacao === "cancelado") return { lt: p.ltMedioCancelado, ltv: p.ltvMedio };
  return { lt: p.ltMedioGeral, ltv: p.ltvMedioGeral };
}

export function BenchmarkProduto({ produtos }: { produtos: ProdutoBenchmark[] }) {
  const [situacao, setSituacao] = useState<Situacao>("ambos");

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Benchmark por produto</CardTitle>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Comparação entre todos os produtos (não afetada pelo filtro de produto acima)
            </p>
          </div>
          <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
            <SelectTrigger className="w-[170px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ambos">Ativos e cancelados</SelectItem>
              <SelectItem value="ativo">Apenas ativos</SelectItem>
              <SelectItem value="cancelado">Apenas cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Cancelados</TableHead>
                <TableHead className="text-right">LT (m)</TableHead>
                <TableHead className="text-right">LTV médio</TableHead>
                <TableHead className="text-right">MRR ativo</TableHead>
                <TableHead className="text-right">Rev. churn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((p) => {
                const v = pick(p, situacao);
                return (
                  <TableRow key={p.produto}>
                    <TableCell className="font-medium">{p.produto}</TableCell>
                    <TableCell className="text-right">{p.nAtivos}</TableCell>
                    <TableCell className="text-right">{p.nCancelados}</TableCell>
                    <TableCell className="text-right">{v.lt}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(v.ltv)}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(p.mrrAtivo)}</TableCell>
                    <TableCell className="text-right">{p.revChurnPct}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
