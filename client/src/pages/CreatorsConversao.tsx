import { useState } from "react";
import type { ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Repeat, Clapperboard, Percent, ExternalLink } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "@/components/lt-ltv-churn/utils";

interface ClienteConvertido {
  idTask: string;
  nome: string | null;
  nPontuais: number;
  valorPontual: number;
  primeiroPontual: string;
  primeiroRecorrente: string;
  diasAteConverter: number;
  mrr: number;
  servicosRecorrentes: string;
  recEmCreators: boolean;
}

interface ConversaoPayload {
  resumo: {
    totalPontuais: number;
    convertidos: number;
    convertidosCreators: number;
    taxa: number;
  };
  clientes: ClienteConvertido[];
}

const MESES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Meses selecionáveis: jan/2025 até o mês atual. */
function mesesDisponiveis(): string[] {
  const out: string[] = [];
  const now = new Date();
  const fim = now.getFullYear() * 12 + now.getMonth();
  for (let k = 2025 * 12; k <= fim; k++) {
    out.push(`${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

function fmtMes(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MESES_LABEL[Number(m) - 1]}/${y}`;
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Kpi({
  icon: Icon, label, value, sub,
}: { icon: ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-zinc-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CreatorsConversao() {
  useSetPageInfo("Creators Conversão", "Clientes pontuais de Creators que se tornaram recorrentes");
  const [de, setDe] = useState("2026-01");
  const [ate, setAte] = useState("2026-06");
  const [soCreators, setSoCreators] = useState(false);
  const meses = mesesDisponiveis();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/creators-conversao", de, ate],
    queryFn: () => fetchJson<ConversaoPayload>(buildUrl("/api/creators-conversao", { de, ate })),
  });

  const clientes = (data?.clientes ?? []).filter((c) => !soCreators || c.recEmCreators);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500 dark:text-zinc-400">Pontual criado de</Label>
          <Select value={de} onValueChange={setDe}>
            <SelectTrigger className="w-[120px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>{fmtMes(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="text-xs text-gray-500 dark:text-zinc-400">até</Label>
          <Select value={ate} onValueChange={setAte}>
            <SelectTrigger className="w-[120px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>{fmtMes(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="so-creators" checked={soCreators} onCheckedChange={setSoCreators} />
          <Label htmlFor="so-creators" className="text-xs text-gray-600 dark:text-zinc-400">
            Só Creators Rec.
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : isError || !data ? (
        <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar os dados.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Users} label="Pontuais no período" value={String(data.resumo.totalPontuais)} />
            <Kpi icon={Repeat} label="Converteram p/ recorrente" value={String(data.resumo.convertidos)} />
            <Kpi icon={Clapperboard} label="p/ Creators Recorrente" value={String(data.resumo.convertidosCreators)} />
            <Kpi icon={Percent} label="Taxa de conversão" value={`${(data.resumo.taxa * 100).toFixed(1)}%`} />
          </div>

          <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
            <CardContent className="p-0">
              {clientes.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 dark:text-zinc-400">
                  Nenhuma conversão no período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-zinc-700/50">
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Pontuais</TableHead>
                      <TableHead className="text-right">Valor pontual</TableHead>
                      <TableHead>1º pontual</TableHead>
                      <TableHead>Conversão</TableHead>
                      <TableHead className="text-right">Dias até converter</TableHead>
                      <TableHead className="text-right">MRR contratado</TableHead>
                      <TableHead>Serviço recorrente</TableHead>
                      <TableHead>Destino</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.map((c) => (
                      <TableRow key={c.idTask} className="border-gray-200 dark:border-zinc-700/50">
                        <TableCell className="font-medium text-gray-900 dark:text-white">
                          <a
                            href={`https://app.clickup.com/t/${c.idTask}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            {c.nome ?? c.idTask}
                            <ExternalLink className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                          </a>
                        </TableCell>
                        <TableCell className="text-right">{c.nPontuais}</TableCell>
                        <TableCell className="text-right">{formatCurrencyNoDecimals(c.valorPontual)}</TableCell>
                        <TableCell>{fmtData(c.primeiroPontual)}</TableCell>
                        <TableCell>{fmtData(c.primeiroRecorrente)}</TableCell>
                        <TableCell className="text-right">{c.diasAteConverter}d</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrencyNoDecimals(c.mrr)}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-gray-600 dark:text-zinc-400" title={c.servicosRecorrentes}>
                          {c.servicosRecorrentes}
                        </TableCell>
                        <TableCell>
                          {c.recEmCreators ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400">
                              Creators Rec.
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-gray-600 dark:text-zinc-400">
                              Outro produto
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
