import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, PartyPopper, Info } from "lucide-react";
import { formatCurrency, formatCurrencyNoDecimals, formatDecimal, formatPercent } from "@/lib/utils";

interface PorTipo {
  key: string; label: string; preco: number; precoLiquido: number;
  leads: number; ingressos: number; receitaBruta: number; receitaLiquida: number;
}
interface MetaBlock {
  investimento: number; cpm: number; ctr: number; ctrUnico: number;
  connectRate: number; sessoes: number;
  txConversaoVdP: number | null; txConversaoSessoes: number | null;
  leads: number | null; cpl: number | null;
  carrinhoAbandonado: number | null; vendas: number | null;
  receita: number | null; roas: number | null;
  pctLeadCarrinho: number | null; pctCarrinhoVenda: number | null; taxaConversao: number | null;
}
interface Consolidado {
  investimento: number; leads: number; carrinhoAbandonado: number | null; ingressos: number;
  receitaBruta: number; receitaLiquida: number; cpl: number; cacIngresso: number;
  ticketMedioBruto: number; ticketMedioLiquido: number; roasBruto: number; roasLiquido: number;
  taxaConversao: number;
}
interface SummitData {
  year: number;
  meta: MetaBlock;
  consolidado: Consolidado;
  porTipo: PorTipo[];
  premissaPreco: { label: string; preco: number; precoLiquido: number }[];
}

const fmtInt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));

type Row =
  | { label: string; value: string; hint?: string }
  | { label: string; pending: string };
interface Section { title: string; rows: Row[] }

function MetricsTable({ sections }: { sections: Section[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Métrica</TableHead>
          <TableHead className="text-right">Realizado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sections.map((section) => (
          <Fragment key={section.title}>
            <TableRow className="bg-muted/50 border-l-4 border-l-primary/40">
              <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-wide py-2.5 text-muted-foreground">
                {section.title}
              </TableCell>
            </TableRow>
            {section.rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="text-gray-900 dark:text-white">
                  {row.label}
                  {"hint" in row && row.hint && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-zinc-500">({row.hint})</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {"pending" in row ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400">{row.pending}</span>
                  ) : (
                    row.value
                  )}
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

export default function GrowthCreatorSummit() {
  usePageTitle("Creator Summit");
  useSetPageInfo("Creator Summit", "Funil do evento (pipeline de Eventos) — Meta Ads e consolidado");

  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading, error } = useQuery<SummitData>({
    queryKey: ["/api/growth/creator-summit", year],
    queryFn: async () => {
      const r = await fetch(`/api/growth/creator-summit?year=${year}`);
      if (!r.ok) throw new Error("Falha ao carregar dados do Creator Summit");
      return r.json();
    },
  });

  const years = [year - 1, year, year + 1].filter((y, i, a) => a.indexOf(y) === i);

  const m = data?.meta;
  const cons = data?.consolidado;

  const pend = "pendente: integração pixel";
  // Linha que vira "pendente" quando o valor é null (não sincronizado).
  const row = (label: string, v: number | null, fmt: (n: number) => string, hint?: string): Row =>
    v === null ? { label, pending: pend } : { label, value: fmt(v), ...(hint ? { hint } : {}) };
  const custoVenda = m && m.vendas ? m.investimento / m.vendas : null;
  const custoCarrinho = m && m.carrinhoAbandonado ? m.investimento / m.carrinhoAbandonado : null;

  const metaSections: Section[] = m
    ? [
        {
          title: "Mídia",
          rows: [
            { label: "Investimento", value: formatCurrencyNoDecimals(m.investimento) },
            { label: "CPM", value: formatCurrency(m.cpm) },
            { label: "CTR de saída", value: formatPercent(m.ctr) },
            { label: "CTR de saída único", value: formatPercent(m.ctrUnico) },
            { label: "Connect Rate", value: formatPercent(m.connectRate), hint: "VdP ÷ cliques de saída" },
            { label: "Sessões", value: fmtInt(m.sessoes), hint: "GA4" },
            row("Tx conversão de página (por VdP)", m.txConversaoVdP, formatPercent, "leads ÷ VdP"),
            row("Tx conversão de página (por sessões)", m.txConversaoSessoes, formatPercent, "leads ÷ sessões"),
          ],
        },
        {
          title: "Funil (atribuição do pixel)",
          rows: [
            row("Leads", m.leads, fmtInt, "evento Lead - Summit ES"),
            row("Custo por lead", m.cpl, formatCurrency),
            row("% Lead → Carrinho", m.pctLeadCarrinho, formatPercent),
            row("Carrinho abandonado", m.carrinhoAbandonado, fmtInt, "InitiateCheckout"),
            row("Custo por carrinho abandonado", custoCarrinho, formatCurrency),
            row("% Carrinho → Venda", m.pctCarrinhoVenda, formatPercent),
            row("Vendas", m.vendas, fmtInt, "Compra - Creators Summit ES"),
            row("Custo por venda", custoVenda, formatCurrency),
            row("Taxa de conversão (Lead → Venda)", m.taxaConversao, formatPercent),
            row("Receita", m.receita, formatCurrencyNoDecimals),
            row("ROAS", m.roas, (n) => `${formatDecimal(n)}x`),
          ],
        },
      ]
    : [];

  const consSections: Section[] = cons
    ? [
        {
          title: "Marketing",
          rows: [
            { label: "Investimento", value: formatCurrencyNoDecimals(cons.investimento) },
            { label: "Leads", value: fmtInt(cons.leads) },
            { label: "CPL", value: formatCurrency(cons.cpl) },
          ],
        },
        {
          title: "Conversão",
          rows: [
            { label: "Ingressos vendidos", value: fmtInt(cons.ingressos) },
            { label: "Taxa de conversão (Lead → Ingresso)", value: formatPercent(cons.taxaConversao * 100) },
            { label: "CAC por ingresso", value: formatCurrency(cons.cacIngresso) },
          ],
        },
        {
          title: "Receita",
          rows: [
            { label: "Receita bruta", value: formatCurrencyNoDecimals(cons.receitaBruta), hint: "valor do comprador" },
            { label: "Receita líquida", value: formatCurrencyNoDecimals(cons.receitaLiquida), hint: "valor a receber (após taxa Sympla)" },
            { label: "Ticket médio líquido", value: formatCurrency(cons.ticketMedioLiquido) },
            { label: "ROAS bruto", value: `${formatDecimal(cons.roasBruto)}x` },
            { label: "ROAS líquido", value: `${formatDecimal(cons.roasLiquido)}x` },
          ],
        },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-fuchsia-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Creator Summit</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300">
            Pipeline de Eventos
          </span>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-gray-500 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
        </div>
      )}

      {error && (
        <Card className="border-red-300 dark:border-red-800">
          <CardContent className="p-4 text-red-600 dark:text-red-400">
            Erro ao carregar dados. Tente novamente.
          </CardContent>
        </Card>
      )}

      {data && m && cons && (
        <>
          <Tabs defaultValue="consolidado">
            <TabsList>
              <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
              <TabsTrigger value="meta">Meta Ads</TabsTrigger>
            </TabsList>

            {/* ---- Consolidado ---- */}
            <TabsContent value="consolidado" className="space-y-6 mt-4">
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Métricas — {data.year} (todos os canais)</CardTitle>
                </CardHeader>
                <CardContent><MetricsTable sections={consSections} /></CardContent>
              </Card>

              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Por tipo de ingresso</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Preço líq.</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Ingressos</TableHead>
                        <TableHead className="text-right">Conversão</TableHead>
                        <TableHead className="text-right">Receita líq.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.porTipo.map((t) => (
                        <TableRow key={t.key}>
                          <TableCell className="font-medium text-gray-900 dark:text-white">{t.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(t.precoLiquido)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(t.leads)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(t.ingressos)}</TableCell>
                          <TableCell className="text-right tabular-nums">{t.leads > 0 ? formatPercent((t.ingressos / t.leads) * 100) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrencyNoDecimals(t.receitaLiquida)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-gray-300 dark:border-zinc-600 font-semibold">
                        <TableCell className="text-gray-900 dark:text-white">Total</TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums">{fmtInt(cons.leads)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(cons.ingressos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPercent(cons.taxaConversao * 100)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrencyNoDecimals(cons.receitaLiquida)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- Meta Ads ---- */}
            <TabsContent value="meta" className="space-y-6 mt-4">
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Métricas Meta Ads — {data.year}</CardTitle>
                </CardHeader>
                <CardContent><MetricsTable sections={metaSections} /></CardContent>
              </Card>

              <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-zinc-500 px-1">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Tudo aqui é atribuição do Meta: mídia/sessões das campanhas com "summit" no nome (sessões via GA4),
                  carrinho = evento InitiateCheckout e vendas = conversão personalizada do pixel ("Compra - Creators
                  Summit ES"). Por isso difere da aba Consolidado, que conta todas as {data.consolidado.ingressos} vendas
                  (incl. as sem rastro de canal, via Bitrix).
                </span>
              </div>
            </TabsContent>
          </Tabs>

          {/* Premissa de receita */}
          <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-zinc-500 px-1">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Receita por preço tabelado do ingresso —{" "}
              {data.premissaPreco.map((p, i) => (
                <span key={p.label}>
                  {i > 0 && " · "}{p.label} {formatCurrency(p.preco)} bruto / {formatCurrency(p.precoLiquido)} líq.
                </span>
              ))}
              . Ingressos sem tipo identificado usam o preço PASS.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
