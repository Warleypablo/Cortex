import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, PartyPopper, Megaphone, Users, Ticket, DollarSign, TrendingUp, Info,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { formatCurrency, formatCurrencyNoDecimals, formatDecimal, formatPercent } from "@/lib/utils";

interface PorTipo {
  key: string;
  label: string;
  preco: number;
  cadastros: number;
  ingressos: number;
  receita: number;
}
interface SerieMes {
  mes: string;
  label: string;
  investimento: number;
  cadastros: number;
  ingressos: number;
  receita: number;
  roas: number;
}
interface Campanha {
  nome: string;
  investimento: number;
  impressoes: number;
  cliques: number;
}
interface SummitData {
  year: number;
  totais: {
    investimento: number;
    impressoes: number;
    cliques: number;
    cadastros: number;
    ingressos: number;
    receita: number;
    cpl: number;
    cacIngresso: number;
    ticketMedio: number;
    roas: number;
    taxaConversao: number;
  };
  porTipo: PorTipo[];
  series: SerieMes[];
  campanhas: Campanha[];
  premissaPreco: { label: string; preco: number }[];
}

const fmtInt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));

function Kpi({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-gray-600 dark:text-zinc-400 text-xs font-medium">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function GrowthCreatorSummit() {
  usePageTitle("Creator Summit");
  useSetPageInfo("Creator Summit", "Funil do evento (pipeline de Eventos) — investimento, inscrições e ingressos");

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

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
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

      {data && (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi icon={<Megaphone className="h-3.5 w-3.5" />} label="Investimento" value={formatCurrencyNoDecimals(data.totais.investimento)} />
            <Kpi icon={<Users className="h-3.5 w-3.5" />} label="Cadastros" value={fmtInt(data.totais.cadastros)} sub={`CPL ${formatCurrency(data.totais.cpl)}`} />
            <Kpi icon={<Ticket className="h-3.5 w-3.5" />} label="Ingressos" value={fmtInt(data.totais.ingressos)} sub={`Conv. ${formatPercent(data.totais.taxaConversao * 100)}`} />
            <Kpi icon={<DollarSign className="h-3.5 w-3.5" />} label="CAC / Ingresso" value={formatCurrency(data.totais.cacIngresso)} />
            <Kpi icon={<DollarSign className="h-3.5 w-3.5" />} label="Receita" value={formatCurrencyNoDecimals(data.totais.receita)} sub={`Ticket ${formatCurrency(data.totais.ticketMedio)}`} />
            <Kpi icon={<TrendingUp className="h-3.5 w-3.5" />} label="ROAS" value={`${formatDecimal(data.totais.roas)}x`} />
          </div>

          {/* Funil simples */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Funil do Evento</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px] rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3">
                <div className="text-xs text-blue-700 dark:text-blue-300">Cadastros</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">{fmtInt(data.totais.cadastros)}</div>
              </div>
              <div className="text-gray-400 dark:text-zinc-600 text-sm font-medium">
                → {formatPercent(data.totais.taxaConversao * 100)} →
              </div>
              <div className="flex-1 min-w-[140px] rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3">
                <div className="text-xs text-emerald-700 dark:text-emerald-300">Ingressos vendidos</div>
                <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">{fmtInt(data.totais.ingressos)}</div>
              </div>
              <div className="text-gray-400 dark:text-zinc-600 text-sm font-medium">=</div>
              <div className="flex-1 min-w-[140px] rounded-lg bg-fuchsia-50 dark:bg-fuchsia-950/40 p-3">
                <div className="text-xs text-fuchsia-700 dark:text-fuchsia-300">Receita</div>
                <div className="text-2xl font-bold text-fuchsia-900 dark:text-fuchsia-200">{formatCurrencyNoDecimals(data.totais.receita)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Por tipo de ingresso */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Por tipo de ingresso</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Cadastros</TableHead>
                    <TableHead className="text-right">Ingressos</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.porTipo.map((t) => (
                    <TableRow key={t.key}>
                      <TableCell className="font-medium text-gray-900 dark:text-white">{t.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(t.preco)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(t.cadastros)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(t.ingressos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.cadastros > 0 ? formatPercent((t.ingressos / t.cadastros) * 100) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrencyNoDecimals(t.receita)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-gray-300 dark:border-zinc-600 font-semibold">
                    <TableCell className="text-gray-900 dark:text-white">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{fmtInt(data.totais.cadastros)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(data.totais.ingressos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(data.totais.taxaConversao * 100)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyNoDecimals(data.totais.receita)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Evolução temporal */}
          {data.series.length > 0 && (
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Evolução mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={data.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-zinc-700" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="money" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} />
                    <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        if (name === "Investimento" || name === "Receita") return formatCurrency(Number(value));
                        return fmtInt(Number(value));
                      }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="money" dataKey="investimento" name="Investimento" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="money" dataKey="receita" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="count" dataKey="cadastros" name="Cadastros" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="count" dataKey="ingressos" name="Ingressos" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Campanhas */}
          {data.campanhas.length > 0 && (
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Campanhas (Meta) — identificadas por "summit" no nome</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-right">Investimento</TableHead>
                      <TableHead className="text-right">Impressões</TableHead>
                      <TableHead className="text-right">Cliques</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.campanhas.map((c) => (
                      <TableRow key={c.nome}>
                        <TableCell className="text-gray-900 dark:text-white max-w-[420px] truncate">{c.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(c.investimento)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(c.impressoes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(c.cliques)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Premissa de receita */}
          <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-zinc-500 px-1">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Receita estimada por preço tabelado do ingresso (valor do comprador):{" "}
              {data.premissaPreco.map((p, i) => (
                <span key={p.label}>
                  {i > 0 && " · "}{p.label} {formatCurrency(p.preco)}
                </span>
              ))}
              . Ingressos sem tipo identificado usam o preço PASS. Gasto = campanhas Meta com "summit" no nome.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
