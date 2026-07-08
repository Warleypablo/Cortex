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
     Quando informado, renderiza um rodapé. Com 1 única coluna "brl", mostra `total` ali
     (reconciliação total do card == total do drill). Com MAIS DE UMA coluna "brl" (ex:
     `cross_sell`: MRR + Pontual, `cliente_contratos`: MRR + Pontual), soma CADA coluna
     individualmente a partir de `linhas` — repetir o mesmo `total` combinado embaixo de
     colunas diferentes estaria errado (bug corrigido: ver DrillSheet.test.tsx). */
  total?: number;
  /** Tipo de exibição do `total` quando ele NÃO é a soma de uma coluna "brl" (ex:
     `contratos_ativos`: `total` é uma CONTAGEM de linhas — `int` — enquanto a tabela tem 2
     colunas "brl", MRR/LTV, que continuam sendo somadas normalmente a partir de `linhas`). Quando
     presente (e diferente de "brl"), a 1ª coluna do rodapé mostra `"Total: <total formatado no
     tipo certo>"` em vez do "Total" genérico, e nenhuma coluna "brl" usa o `total` bruto (mesmo
     com 1 única coluna "brl" — nesse caso ela também soma a partir de `linhas`, porque `total`
     não representa uma soma monetária). Omitido = comportamento default (`total` é sempre "brl"). */
  totalTipo?: DrillColuna["tipo"];
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

/** Tipo efetivo de uma célula: por padrão o `tipo` da COLUNA, mas uma linha pode sobrescrever só
   para si mesma via `${chave}Tipo` (ex: `valorTipo: "int"`) — usado pelas composições da Fase
   2C-i (`receita_cabeca`, `conversao_caixa`), onde a mesma coluna "valor" mistura brl/int/pct
   entre os componentes de uma única tabela (ex: "Nº de pessoas" é int, "= Conversão" é pct, o
   resto é brl). Linhas sem essa chave (a maioria dos drills) usam o `tipo` da coluna normalmente. */
function tipoCelula(linha: Record<string, unknown>, coluna: DrillColuna): DrillColuna["tipo"] {
  const override = linha[`${coluna.chave}Tipo`];
  return (override as DrillColuna["tipo"] | undefined) ?? coluna.tipo;
}

export function DrillSheet({ open, onClose, titulo, subtitulo, colunas, linhas, carregando, erro, total, totalTipo, formula }: DrillSheetProps) {
  // Colunas monetárias — se houver mais de 1 (ex: `cross_sell`: MRR + Pontual), o rodapé soma
  // CADA uma a partir de `linhas` em vez de repetir o `total` combinado embaixo das duas (bug:
  // ver docstring de `total` acima). `somaColuna` só é usada nesse caso (>1 coluna brl).
  const colunasBrl = colunas.filter((c) => c.tipo === "brl");
  function somaColuna(chave: string): number {
    return linhas.reduce((acc, linha) => acc + (Number(linha[chave]) || 0), 0);
  }
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
                      {colunas.map((c) => <TableCell key={c.chave}>{fmt(linha[c.chave], tipoCelula(linha, c))}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
                {total != null && (
                  <TableFooter>
                    <TableRow>
                      {colunas.map((c, i) => {
                        if (c.tipo === "brl") {
                          // `total` bruto só reconcilia direto com ESTA coluna quando ela é a
                          // ÚNICA "brl" da tabela E `total` de fato representa uma soma monetária
                          // (sem `totalTipo`, ou `totalTipo: "brl"`). Em qualquer outro caso (>1
                          // coluna "brl", ex: `cross_sell`/`cliente_contratos`; ou `total` sendo
                          // uma CONTAGEM, ex: `contratos_ativos`) soma esta coluna a partir de
                          // `linhas` em vez de repetir/reaproveitar o escalar `total`.
                          const usarTotalBruto = colunasBrl.length === 1 && (!totalTipo || totalTipo === "brl");
                          const valor = usarTotalBruto ? total : somaColuna(c.chave);
                          return (
                            <TableCell key={c.chave} className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrencyNoDecimals(valor)}
                            </TableCell>
                          );
                        }
                        if (i === 0) {
                          // `totalTipo` não-"brl" (ex: "int") → `total` não é soma de coluna
                          // monetária nenhuma (ex: contagem de linhas) — exibe o escalar formatado
                          // no tipo certo junto do rótulo, em vez do "Total" genérico.
                          const label = totalTipo && totalTipo !== "brl" ? `Total: ${fmt(total, totalTipo)}` : "Total";
                          return (
                            <TableCell key={c.chave} className="font-semibold text-gray-900 dark:text-white">
                              {label}
                            </TableCell>
                          );
                        }
                        return <TableCell key={c.chave} className="font-semibold text-gray-900 dark:text-white" />;
                      })}
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
