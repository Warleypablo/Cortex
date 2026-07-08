import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyNoDecimals, formatPercent } from "@/lib/utils";
import type { DrillColuna } from "./tipos";

interface DrillSheetProps {
  open: boolean; onClose: () => void;
  titulo: string; subtitulo?: string;
  colunas: DrillColuna[]; linhas: Record<string, unknown>[];
  carregando?: boolean; erro?: boolean;
  /** Total do card que originou o drill (ex: /api/gestao/receita/detalhe → `total`).
     Quando informado, renderiza um rodapé somando a coluna numérica (tipo "brl") — fecha
     o loop de auditabilidade (soma dos grupos == total do card). Opcional/retrocompatível. */
  total?: number;
  /** Fórmula/composição do drill (ex: "Churn % = Churn R$ ÷ MRR base") — quando informada,
     renderiza um bloco de texto acima da tabela. Usada por drills de RAZÃO (ex: `churn_pct`),
     onde a tabela lista os COMPONENTES em vez de itens somáveis (por isso `total` costuma vir
     omitido nesses casos — ver DrillDetalhe no server/client). */
  formula?: string;
}

function fmt(v: unknown, tipo?: DrillColuna["tipo"]): string {
  if (v == null) return "—";
  if (tipo === "brl") return formatCurrencyNoDecimals(Number(v));
  if (tipo === "pct") return formatPercent(Number(v));
  if (tipo === "int") return String(Math.round(Number(v)));
  return String(v);
}

export function DrillSheet({ open, onClose, titulo, subtitulo, colunas, linhas, carregando, erro, total, formula }: DrillSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700">
        <SheetHeader className="border-b border-gray-200 pb-3 dark:border-zinc-700">
          <SheetTitle className="text-base font-semibold text-gray-900 dark:text-white">{titulo}</SheetTitle>
          {subtitulo && <p className="text-sm text-gray-500 dark:text-zinc-400">{subtitulo}</p>}
        </SheetHeader>
        <div className="mt-4">
          {carregando && <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800" />}
          {erro && <div className="text-sm text-red-600 dark:text-red-400">Falha ao carregar o detalhe.</div>}
          {!carregando && !erro && formula && (
            <div className="mb-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
              {formula}
            </div>
          )}
          {!carregando && !erro && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>{colunas.map((c) => <TableHead key={c.chave}>{c.label}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.length === 0 && (
                    <TableRow><TableCell colSpan={colunas.length} className="text-center text-sm text-gray-400 dark:text-zinc-500">Sem registros.</TableCell></TableRow>
                  )}
                  {linhas.map((linha, i) => (
                    <TableRow key={i}>
                      {colunas.map((c) => <TableCell key={c.chave}>{fmt(linha[c.chave], c.tipo)}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
                {total != null && (
                  <TableFooter>
                    <TableRow>
                      {colunas.map((c, i) => (
                        <TableCell key={c.chave} className="font-semibold text-gray-900 dark:text-white">
                          {c.tipo === "brl" ? formatCurrencyNoDecimals(total) : i === 0 ? "Total" : null}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
