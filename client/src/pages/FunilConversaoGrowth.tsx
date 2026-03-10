import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";
import { ArrowDown, DollarSign, Target, Users, TrendingDown, Loader2 } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";

interface FunnelStage {
  key: string;
  label: string;
  value: number;
  color: string;
}
interface Rate { from: string; to: string; rate: number; }
interface TrendRow { month: string; leads: number; mqls: number; rm: number; rr: number; vendas: number; }
interface Summary { totalSpend: number; cpl: number; cpmql: number; cac: number; roas: number; valorVendas: number; }
interface Platforms { meta: { impressions: number; clicks: number; spend: number }; google: { impressions: number; clicks: number; spend: number }; }
interface FunnelData { stages: FunnelStage[]; rates: Rate[]; trend: TrendRow[]; summary: Summary; platforms: Platforms; }

function formatNumber(v: number): string { return new Intl.NumberFormat("pt-BR").format(v); }
function formatCurrency(v: number): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v); }
function formatPercent(v: number): string { return `${v.toFixed(1)}%`; }

function FunnelBar({ stage, maxValue, rate }: { stage: FunnelStage; maxValue: number; rate?: Rate }) {
  const width = maxValue > 0 ? Math.max((stage.value / maxValue) * 100, 2) : 0;
  return (
    <div className="flex items-center gap-4">
      <div className="w-32 text-right text-sm font-medium text-gray-700 dark:text-zinc-300 shrink-0">{stage.label}</div>
      <div className="flex-1">
        <div className="relative h-10 bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
          <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${width}%`, backgroundColor: stage.color }} />
          <div className="absolute inset-0 flex items-center px-3">
            <span className="text-sm font-bold text-white drop-shadow-md">{formatNumber(stage.value)}</span>
          </div>
        </div>
        {rate && (
          <div className="flex items-center gap-1 mt-0.5 ml-1">
            <ArrowDown className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
            <span className="text-xs text-gray-500 dark:text-zinc-400">{formatPercent(rate.rate)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FunilConversaoGrowth() {
  useSetPageInfo("Funil de Conversão", "Growth Marketing");
  usePageTitle("Funil de Conversão");

  const defaultStart = format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd");
  const defaultEnd = format(new Date(), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [plataforma, setPlataforma] = useState("Todos");
  const [campaign, setCampaign] = useState("");

  const { data, isLoading } = useQuery<FunnelData>({
    queryKey: ["/api/growth/funil-conversao", startDate, endDate, plataforma, campaign],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, plataforma, campaign });
      const res = await fetch(`/api/growth/funil-conversao?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const stages = data?.stages || [];
  const rates = data?.rates || [];
  const trend = data?.trend || [];
  const summary = data?.summary || { totalSpend: 0, cpl: 0, cpmql: 0, cac: 0, roas: 0, valorVendas: 0 };
  const platforms = data?.platforms || { meta: { impressions: 0, clicks: 0, spend: 0 }, google: { impressions: 0, clicks: 0, spend: 0 } };
  const maxValue = stages.length > 0 ? Math.max(...stages.map(s => s.value)) : 1;

  return (
    <div className="space-y-4 p-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 dark:text-zinc-400">Início</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-zinc-400">Fim</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-zinc-400">Plataforma</label>
          <Select value={plataforma} onValueChange={setPlataforma}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todas</SelectItem>
              <SelectItem value="Meta">Meta Ads</SelectItem>
              <SelectItem value="Google">Google Ads</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500 dark:text-zinc-400">Campanha</label>
          <Input placeholder="Filtrar por nome de campanha..." value={campaign} onChange={e => setCampaign(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500 dark:text-zinc-400">Carregando funil...</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><DollarSign className="h-3 w-3" />Investimento</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(summary.totalSpend)}</div>
                <div className="text-xs text-gray-400 dark:text-zinc-500">
                  Meta: {formatCurrency(platforms.meta.spend)} | Google: {formatCurrency(platforms.google.spend)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><Users className="h-3 w-3" />CPL</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(summary.cpl)}</div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><Target className="h-3 w-3" />CPMQL</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(summary.cpmql)}</div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><TrendingDown className="h-3 w-3" />CAC</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(summary.cac)}</div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><DollarSign className="h-3 w-3" />Receita</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(summary.valorVendas)}</div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mb-1"><Target className="h-3 w-3" />ROAS</div>
                <div className={`text-lg font-bold ${summary.roas >= 1 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {summary.roas.toFixed(2)}x
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Funnel Visual */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-gray-900 dark:text-white">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stages.map((stage, i) => (
                <FunnelBar key={stage.key} stage={stage} maxValue={maxValue} rate={rates[i - 1]} />
              ))}
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          {trend.length > 1 && (
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-gray-900 dark:text-white">Evolução Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="leads" name="Leads" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="mqls" name="MQL" stroke="#d946ef" fill="#d946ef" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="rm" name="RM" stroke="#ec4899" fill="#ec4899" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="rr" name="RR" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="vendas" name="Vendas" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Conversion Rates Table */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-gray-900 dark:text-white">Taxas de Conversão por Estágio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {rates.map(r => {
                  const fromStage = stages.find(s => s.key === r.from);
                  const toStage = stages.find(s => s.key === r.to);
                  return (
                    <div key={`${r.from}-${r.to}`} className="text-center p-3 rounded-lg bg-gray-50 dark:bg-zinc-800">
                      <div className="text-xs text-gray-500 dark:text-zinc-400 mb-1">
                        {fromStage?.label} → {toStage?.label}
                      </div>
                      <div className={`text-xl font-bold ${r.rate >= 10 ? "text-green-600 dark:text-green-400" : r.rate >= 3 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400"}`}>
                        {formatPercent(r.rate)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
