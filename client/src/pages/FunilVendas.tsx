import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, DollarSign, TrendingUp, Target, ArrowRight } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

interface FunilEtapa {
  key: string;
  label: string;
  count: number;
  valor: number;
}

interface FunilKPIs {
  total_deals: number;
  valor_pipeline: number;
  taxa_conversao: number;
  ticket_medio: number;
}

interface Deal {
  id: number;
  title: string;
  stage_name: string;
  stage_key: string;
  closer: string;
  closer_name: string | null;
  sdr: string;
  source: string;
  valor_recorrente: number;
  valor_pontual: number;
  date_create: string;
  data_fechamento: string | null;
}

interface Filtros {
  closers: { id: number; name: string }[];
  sdrs: { id: number; name: string }[];
  sources: string[];
}

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-500",
  qualificado: "bg-cyan-500",
  reuniao: "bg-indigo-500",
  proposta: "bg-violet-500",
  negociacao: "bg-amber-500",
  ganho: "bg-emerald-500",
  perdido: "bg-red-500",
  outros: "bg-gray-400",
};

const STAGE_BG: Record<string, string> = {
  lead: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  qualificado: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800",
  reuniao: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800",
  proposta: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800",
  negociacao: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  ganho: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  perdido: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  outros: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800",
};

function KPICards({ kpis }: { kpis: FunilKPIs }) {
  const cards = [
    { title: "Total de Deals", value: String(kpis.total_deals), icon: Users, color: "text-blue-500" },
    { title: "Valor do Pipeline", value: formatCurrency(kpis.valor_pipeline), icon: DollarSign, color: "text-green-500" },
    { title: "Taxa de Conversão", value: `${kpis.taxa_conversao}%`, icon: TrendingUp, color: "text-emerald-500" },
    { title: "Ticket Médio", value: formatCurrency(kpis.ticket_medio), icon: Target, color: "text-violet-500" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.title} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{c.title}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FunilVisual({
  etapas,
  selectedStage,
  onSelectStage,
}: {
  etapas: FunilEtapa[];
  selectedStage: string | null;
  onSelectStage: (key: string | null) => void;
}) {
  if (etapas.length === 0) return <p className="text-center text-gray-400 py-8">Nenhum deal encontrado</p>;

  const maxCount = Math.max(...etapas.map(e => e.count));
  const mainStages = etapas.filter(e => !["ganho", "perdido", "outros"].includes(e.key));
  const terminalStages = etapas.filter(e => ["ganho", "perdido"].includes(e.key));
  const outrosStage = etapas.find(e => e.key === "outros");

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 p-6">
      <div className="space-y-1">
        {mainStages.map((etapa, i) => {
          const widthPct = maxCount > 0 ? Math.max((etapa.count / maxCount) * 100, 15) : 15;
          const prevCount = i > 0 ? mainStages[i - 1].count : null;
          const conversionPct = prevCount && prevCount > 0 ? Math.round((etapa.count / prevCount) * 100) : null;
          const isSelected = selectedStage === etapa.key;

          return (
            <div key={etapa.key}>
              {conversionPct !== null && (
                <div className="flex items-center gap-2 py-1 pl-4">
                  <ArrowRight className="w-3 h-3 text-gray-300" />
                  <span className="text-xs font-medium text-gray-400 dark:text-zinc-500">{conversionPct}% conversão</span>
                </div>
              )}
              <button
                onClick={() => onSelectStage(isSelected ? null : etapa.key)}
                className={`w-full text-left transition-all rounded-lg border p-3 ${isSelected ? "ring-2 ring-primary" : ""} ${STAGE_BG[etapa.key] || STAGE_BG.outros}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${STAGE_COLORS[etapa.key] || STAGE_COLORS.outros}`} />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{etapa.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">{etapa.count} deals</Badge>
                    <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">{formatCurrency(etapa.valor)}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${STAGE_COLORS[etapa.key] || STAGE_COLORS.outros}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </button>
            </div>
          );
        })}

        {terminalStages.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-1 pl-4">
              <ArrowRight className="w-3 h-3 text-gray-300" />
              <span className="text-xs font-medium text-gray-400 dark:text-zinc-500">Resultado</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {terminalStages.map(etapa => {
                const isSelected = selectedStage === etapa.key;
                return (
                  <button
                    key={etapa.key}
                    onClick={() => onSelectStage(isSelected ? null : etapa.key)}
                    className={`text-left transition-all rounded-lg border p-3 ${isSelected ? "ring-2 ring-primary" : ""} ${STAGE_BG[etapa.key] || STAGE_BG.outros}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full ${STAGE_COLORS[etapa.key]}`} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{etapa.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{etapa.count}</Badge>
                      <span className="text-xs text-gray-600 dark:text-zinc-400">{formatCurrency(etapa.valor)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {outrosStage && outrosStage.count > 0 && (
          <button
            onClick={() => onSelectStage(selectedStage === "outros" ? null : "outros")}
            className={`w-full text-left transition-all rounded-lg border p-3 mt-2 ${selectedStage === "outros" ? "ring-2 ring-primary" : ""} ${STAGE_BG.outros}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Outros</span>
              </div>
              <Badge variant="secondary" className="text-xs">{outrosStage.count} deals</Badge>
            </div>
          </button>
        )}
      </div>
    </Card>
  );
}

function DealsTable({ deals, isLoading }: { deals: Deal[]; isLoading: boolean }) {
  if (isLoading) return <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando deals...</div>;
  if (deals.length === 0) return <p className="text-center text-gray-400 py-8">Nenhum deal encontrado</p>;

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Título</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Closer</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">SDR</th>
              <th className="text-right py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">MRR</th>
              <th className="text-right py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Pontual</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Etapa</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Fonte</th>
              <th className="text-left py-2.5 px-3 text-gray-600 dark:text-zinc-400 font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                <td className="py-2 px-3 text-gray-900 dark:text-white font-medium max-w-[200px] truncate">{deal.title || "—"}</td>
                <td className="py-2 px-3 text-gray-700 dark:text-zinc-300">{deal.closer_name || deal.closer || "—"}</td>
                <td className="py-2 px-3 text-gray-700 dark:text-zinc-300">{deal.sdr || "—"}</td>
                <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                  {Number(deal.valor_recorrente) > 0 ? formatCurrency(Number(deal.valor_recorrente)) : "—"}
                </td>
                <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                  {Number(deal.valor_pontual) > 0 ? formatCurrency(Number(deal.valor_pontual)) : "—"}
                </td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${STAGE_COLORS[deal.stage_key] || STAGE_COLORS.outros}`} />
                    <span className="text-gray-700 dark:text-zinc-300 text-xs">{deal.stage_name}</span>
                  </div>
                </td>
                <td className="py-2 px-3 text-gray-600 dark:text-zinc-400 text-xs">{deal.source || "—"}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-zinc-400 text-xs">
                  {deal.date_create ? new Date(deal.date_create).toLocaleDateString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-xs text-gray-400">{deals.length} deal(s)</div>
    </Card>
  );
}

export default function FunilVendas() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [closer, setCloser] = useState("");
  const [sdr, setSdr] = useState("");
  const [source, setSource] = useState("");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const { data: filtros } = useQuery<Filtros>({
    queryKey: ["/api/comercial/funil/filtros"],
    queryFn: () => fetch("/api/comercial/funil/filtros").then(r => r.json()),
  });

  const buildParams = () => {
    const p = new URLSearchParams();
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim) p.set("dataFim", dataFim);
    if (closer && closer !== "all") p.set("closer", closer);
    if (sdr && sdr !== "all") p.set("sdr", sdr);
    if (source && source !== "all") p.set("source", source);
    return p.toString();
  };

  const params = buildParams();

  const { data: etapasData, isLoading: etapasLoading } = useQuery<{ etapas: FunilEtapa[]; kpis: FunilKPIs }>({
    queryKey: ["/api/comercial/funil/etapas", params],
    queryFn: () => fetch(`/api/comercial/funil/etapas?${params}`).then(r => r.json()),
  });

  const dealParams = new URLSearchParams(params);
  if (selectedStage) dealParams.set("stage", selectedStage);

  const { data: deals = [], isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ["/api/comercial/funil/deals", dealParams.toString()],
    queryFn: () => fetch(`/api/comercial/funil/deals?${dealParams.toString()}`).then(r => r.json()),
  });

  if (etapasLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-500" /> Funil de Vendas
        </h1>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">De</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[150px] bg-white dark:bg-zinc-800" />
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">Até</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[150px] bg-white dark:bg-zinc-800" />
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">Closer</Label>
            <Select value={closer} onValueChange={setCloser}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(filtros?.closers || []).map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">SDR</Label>
            <Select value={sdr} onValueChange={setSdr}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(filtros?.sdrs || []).map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-zinc-400">Fonte</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(filtros?.sources || []).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {etapasData?.kpis && <KPICards kpis={etapasData.kpis} />}

      <FunilVisual
        etapas={etapasData?.etapas || []}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
      />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Deals {selectedStage ? `— ${etapasData?.etapas.find(e => e.key === selectedStage)?.label || selectedStage}` : ""}
          </h2>
          {selectedStage && (
            <button onClick={() => setSelectedStage(null)} className="text-xs text-blue-500 hover:underline">
              Limpar filtro
            </button>
          )}
        </div>
        <DealsTable deals={deals} isLoading={dealsLoading} />
      </div>
    </div>
  );
}
