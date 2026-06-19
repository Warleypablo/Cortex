import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCreativeRanking, type PerfWindow } from "@/hooks/useCreatives";
import {
  fmtBRL,
  fmtInt,
  fmtPct,
  fmtRoas,
  roasClass,
  RANKING_DIMENSIONS,
} from "@/lib/creativePerfFormat";

/**
 * Painel de inteligência: agrega a performance por atributo (ângulo, persona, formato...)
 * — responde "qual TIPO de criativo converte melhor", que vira briefing pro próximo roteiro.
 */
export function RankingPanel({ win }: { win: PerfWindow }) {
  const [dimension, setDimension] = useState("personagem");
  const { data, isLoading } = useCreativeRanking(win, dimension);
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Agrupar por</span>
        <Select value={dimension} onValueChange={setDimension}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANKING_DIMENSIONS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          ordenado por investimento
        </span>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[180px] sticky left-0 bg-background z-10">
                {RANKING_DIMENSIONS.find((d) => d.value === dimension)?.label ?? "Valor"}
              </TableHead>
              <TableHead className="text-right">Criativos</TableHead>
              <TableHead className="text-right">Investido</TableHead>
              <TableHead className="text-right">Hook %</TableHead>
              <TableHead className="text-right">Hold %</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">CAC</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                  Calculando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                  Sem dados de performance nessa janela.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, idx) => (
              <TableRow key={r.value} className={idx % 2 ? "bg-muted/30" : ""}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium">
                  {r.value === "(sem)" ? (
                    <span className="text-muted-foreground italic">sem tag</span>
                  ) : (
                    r.value
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  <Badge variant="secondary">{r.criativos}</Badge>
                </TableCell>
                <TableCell className="text-right">{fmtBRL(r.spend)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.hookRate)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.holdRate)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.ctr)}</TableCell>
                <TableCell className="text-right">{fmtInt(r.leads)}</TableCell>
                <TableCell className="text-right">{fmtBRL(r.cpl)}</TableCell>
                <TableCell className="text-right">{fmtInt(r.vendas)}</TableCell>
                <TableCell className="text-right">{fmtBRL(r.cac)}</TableCell>
                <TableCell className={`text-right ${roasClass(r.roas)}`}>{fmtRoas(r.roas)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Métricas pagas (hook/hold/CTR) batem com a aba Criativos. Leads/vendas/ROAS via
        <code className="mx-1">utm_content = ad_id</code>no Bitrix. "sem tag" = criativos ainda sem
        o atributo preenchido — preencha no form pra alimentar o ranking.
      </p>
    </div>
  );
}
