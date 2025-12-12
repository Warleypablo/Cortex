import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, TrendingUp, TrendingDown, Target, DollarSign, Users, ShoppingCart, BarChart3, Rocket, Percent, Trophy, CircleDollarSign } from "lucide-react";
import { format, subDays, subMonths, eachDayOfInterval, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface KPICardProps {
  title: string;
  value: string;
  meta?: string;
  metaPercent?: number;
  vsLM?: number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function KPICard({ title, value, meta, metaPercent, vsLM, subtitle, icon, trend }: KPICardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {meta && metaPercent !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className={metaPercent > 100 ? "text-green-600" : metaPercent < 100 ? "text-red-500" : ""}>
                  {metaPercent}% da Meta
                </span>
              </p>
            )}
            {meta && metaPercent === undefined && (
              <p className="text-xs text-green-600 mt-1">{meta}</p>
            )}
            {vsLM !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">vs. LM</span>
                <span className={`text-xs font-medium flex items-center gap-0.5 ${vsLM >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {vsLM >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(vsLM).toFixed(1)}%
                </span>
              </div>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${trend === 'up' ? 'bg-green-100 text-green-600' : trend === 'down' ? 'bg-red-100 text-red-500' : 'bg-primary/10 text-primary'}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const channelColors: Record<string, string> = {
  'Facebook': '#1877F2',
  'Google': '#34A853',
  'Orgânico': '#9333EA',
  'Institucional': '#F59E0B',
  'LinkedIn': '#0A66C2',
  'Bing': '#00809D',
  'TikTok': '#000000',
  'Mídia Independente': '#EC4899',
  'Outros': '#6B7280',
};

const mockDailyData = eachDayOfInterval({
  start: new Date(2025, 9, 1),
  end: new Date(2025, 10, 30),
}).map(date => ({
  date: format(date, 'dd/MM'),
  Facebook: Math.floor(Math.random() * 150) + 80,
  Google: Math.floor(Math.random() * 120) + 60,
  Orgânico: Math.floor(Math.random() * 60) + 20,
  Institucional: Math.floor(Math.random() * 40) + 10,
  LinkedIn: Math.floor(Math.random() * 20) + 5,
  Outros: Math.floor(Math.random() * 15) + 5,
  cpmql: Math.floor(Math.random() * 200) + 250,
  FacebookLeads: Math.floor(Math.random() * 300) + 160,
  GoogleLeads: Math.floor(Math.random() * 240) + 120,
  OrgânicoLeads: Math.floor(Math.random() * 120) + 40,
  InstitucionalLeads: Math.floor(Math.random() * 80) + 20,
  LinkedInLeads: Math.floor(Math.random() * 40) + 10,
  OutrosLeads: Math.floor(Math.random() * 30) + 10,
  cpl: Math.floor(Math.random() * 100) + 120,
}));

const mockChannelPerformance = [
  { 
    canal: 'Facebook', 
    leads: 8117, 
    cpmql: 310, 
    leadMql: 76, 
    mql: 6129, 
    mqlRm: 35, 
    rm: 2115, 
    mqlRr: 16, 
    rr: 972, 
    txRrVenda: 35, 
    mqlVenda: 6, 
    vendas: 341, 
    cac: 6017, 
    valorVendas: 4836479, 
    tm: 14183 
  },
  { 
    canal: 'Google', 
    leads: 8209, 
    cpmql: 580, 
    leadMql: 60, 
    mql: 4913, 
    mqlRm: 43, 
    rm: 2130, 
    mqlRr: 22, 
    rr: 1087, 
    txRrVenda: 34, 
    mqlVenda: 7, 
    vendas: 368, 
    cac: 7741, 
    valorVendas: 5248351, 
    tm: 14262 
  },
  { 
    canal: 'Orgânico', 
    leads: 2848, 
    cpmql: null, 
    leadMql: 56, 
    mql: 1609, 
    mqlRm: 52, 
    rm: 841, 
    mqlRr: 31, 
    rr: 492, 
    txRrVenda: 38, 
    mqlVenda: 12, 
    vendas: 187, 
    cac: null, 
    valorVendas: 2749642, 
    tm: 14704 
  },
  { 
    canal: 'Institucional', 
    leads: 1488, 
    cpmql: null, 
    leadMql: 41, 
    mql: 606, 
    mqlRm: 59, 
    rm: 357, 
    mqlRr: 40, 
    rr: 241, 
    txRrVenda: 29, 
    mqlVenda: 12, 
    vendas: 70, 
    cac: null, 
    valorVendas: 892742, 
    tm: 12753 
  },
];

const mockTotals = {
  leads: 21617,
  cpmql: 339,
  leadMql: 65,
  mql: 14013,
  mqlRm: 41,
  rm: 5781,
  mqlRr: 21,
  rr: 2946,
  txRrVenda: 35,
  vendas: 1024,
  cac: null,
  valorVendas: 14509270,
  tm: 14169,
};

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 20;
  const width = 60;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-primary"
      />
    </svg>
  );
}

interface FunnelProps {
  totalLeads: number;
  totalMQLs: number;
  totalVendasMQL: number;
  taxaConversaoMQL: number;
  taxaVendaMQL: number;
}

function FunnelVisualization({ totalLeads, totalMQLs, totalVendasMQL, taxaConversaoMQL, taxaVendaMQL }: FunnelProps) {
  const [activeTab, setActiveTab] = useState<'mql' | 'geral'>('mql');
  
  // Calcular RM e RR estimados (se não tiver dados específicos, estimar proporcionalmente)
  const rmMQL = Math.round(totalMQLs * 0.41); // Proporção típica
  const rrMQL = Math.round(rmMQL * 0.51);
  
  const mqlStages = [
    { label: 'MQLs', value: totalMQLs, color: 'bg-red-500' },
    { label: 'RM MQL', value: rmMQL, percent: totalMQLs > 0 ? Math.round((rmMQL / totalMQLs) * 100) : 0, color: 'bg-orange-500' },
    { label: 'RR MQL', value: rrMQL, percent: rmMQL > 0 ? Math.round((rrMQL / rmMQL) * 100) : 0, color: 'bg-yellow-500' },
    { label: 'Vendas MQL', value: totalVendasMQL, percent: rrMQL > 0 ? Math.round((totalVendasMQL / rrMQL) * 100) : 0, color: 'bg-green-500' },
  ];
  
  const geralStages = [
    { label: 'Leads Total', value: totalLeads, color: 'bg-blue-500' },
    { label: 'MQLs', value: totalMQLs, percent: Math.round(taxaConversaoMQL), color: 'bg-orange-500' },
    { label: 'Vendas', value: totalVendasMQL, percent: Math.round(taxaVendaMQL), color: 'bg-green-500' },
  ];
  
  const stages = activeTab === 'mql' ? mqlStages : geralStages;
  const taxaFinal = activeTab === 'mql' ? (totalMQLs > 0 ? Math.round((totalVendasMQL / totalMQLs) * 100) : 0) : Math.round(taxaVendaMQL);
  const firstStage = stages[0];

  const formatValue = (stage: any) => {
    if (stage.isCurrency) return formatCurrency(stage.value);
    if (stage.isPercent) return `${stage.value}%`;
    return formatNumber(stage.value);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-2">
        <button
          onClick={() => setActiveTab('mql')}
          className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
            activeTab === 'mql' 
              ? 'bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-funnel-mql"
        >
          Funil MQL
        </button>
        <button
          onClick={() => setActiveTab('geral')}
          className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
            activeTab === 'geral' 
              ? 'bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-funnel-geral"
        >
          Funil Geral
        </button>
      </div>
      
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-12 h-12 rounded-full ${firstStage.color} flex items-center justify-center`}>
          <span className="text-white font-bold text-[9px] text-center leading-tight px-1">
            {formatValue(firstStage)}
          </span>
        </div>
        <span className="text-sm font-medium">{firstStage.label}</span>
      </div>
      
      {stages.slice(1).map((stage: any) => (
        <div key={stage.label} className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${stage.color} flex items-center justify-center`}>
            <span className="text-white font-bold text-[9px] text-center leading-tight px-1">
              {formatValue(stage)}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{stage.label}</span>
              {stage.percent !== undefined && (
                <Badge variant="outline" className="text-xs">{stage.percent}%</Badge>
              )}
            </div>
          </div>
        </div>
      ))}
      
      <div className="mt-2 pt-2 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Taxa Final</span>
          <Badge className={taxaFinal >= 0 ? "bg-green-500" : "bg-red-500"}>{taxaFinal}%</Badge>
        </div>
      </div>
    </div>
  );
}

// Atalhos de período para filtro de datas
const datePresets = [
  { label: 'Hoje', getRange: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Últimos 7 dias', getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Últimos 30 dias', getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Mês Atual', getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Mês Anterior', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Trimestre Atual', getRange: () => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }) },
  { label: 'Ano Atual', getRange: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

export default function GrowthVisaoGeral() {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [canal, setCanal] = useState("Todos");
  const [tipoContrato, setTipoContrato] = useState("Todos");
  const [estrategia, setEstrategia] = useState("Todos");
  const [chartView, setChartView] = useState<'mql' | 'leads'>('mql');
  const [investimentoSource, setInvestimentoSource] = useState("todos");

  const { data: investimentoData, isLoading: investimentoLoading } = useQuery<{
    total: { investimento: number; impressions: number; clicks: number };
    bySource: { google: { investimento: number }; meta: { investimento: number } };
    daily: Array<{ date: string; investimento: number; impressions: number; clicks: number; google?: number; meta?: number }>;
  }>({
    queryKey: ['/api/growth/investimento', format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd'), investimentoSource],
    queryFn: async () => {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');
      const res = await fetch(`/api/growth/investimento?startDate=${startDate}&endDate=${endDate}&source=${investimentoSource}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch investimento');
      return res.json();
    }
  });

  // Query para dados cruzados com Bitrix (Negócios Ganhos)
  const { data: visaoGeralData, isLoading: visaoGeralLoading } = useQuery<{
    resumo: {
      investimento: number;
      impressions: number;
      clicks: number;
      ctr: number;
      cpc: number | null;
      negociosGanhos: number;
      negociosTotais: number;
      valorPontual: number;
      valorRecorrente: number;
      valorVendas: number;
      valorTotalGeral: number;
      cac: number | null;
      roi: number | null;
      totalLeads: number;
      totalMQLs: number;
      totalVendasMQL: number;
      taxaConversaoMQL: number;
      taxaVendaMQL: number;
    };
    porAd: Array<{
      adId: string;
      investimento: number;
      impressions: number;
      clicks: number;
      negociosGanhos: number;
      valorVendas: number;
      cac: number | null;
      roi: number | null;
    }>;
    evolucaoDiaria: Array<{ data: string; negocios: number; valor: number }>;
    mqlDiario: Array<{ data: string; canais: Record<string, { leads: number; mqls: number }> }>;
    mqlPorCanal: Array<{ canal: string; leads: number; mqls: number; vendas: number; valorVendas: number }>;
  }>({
    queryKey: ['/api/growth/visao-geral', format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd'), canal, tipoContrato],
    queryFn: async () => {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');
      const res = await fetch(`/api/growth/visao-geral?startDate=${startDate}&endDate=${endDate}&canal=${canal}&tipoContrato=${tipoContrato}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch visao geral');
      return res.json();
    }
  });

  const sparklineData = useMemo(() => {
    return mockChannelPerformance.map(ch => ({
      ...ch,
      sparkline: Array.from({ length: 30 }, () => Math.floor(Math.random() * 100) + 50),
    }));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Rocket className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Marketing</h1>
            <p className="text-sm text-muted-foreground">Visão Geral de Performance</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Canal:</span>
            <Select value={canal} onValueChange={(value) => {
              setCanal(value);
              // Sincronizar com filtro de investimento
              if (value === 'Facebook') setInvestimentoSource('meta');
              else if (value === 'Google') setInvestimentoSource('google');
              else setInvestimentoSource('todos');
            }}>
              <SelectTrigger className="w-[120px]" data-testid="select-canal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
                <SelectItem value="Google">Google</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tipo:</span>
            <Select value={tipoContrato} onValueChange={setTipoContrato}>
              <SelectTrigger className="w-[130px]" data-testid="select-tipo-contrato">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Recorrente">Recorrente</SelectItem>
                <SelectItem value="Pontual">Pontual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Estratégia:</span>
            <Select value={estrategia} onValueChange={setEstrategia}>
              <SelectTrigger className="w-[120px]" data-testid="select-estrategia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Conversão">Conversão</SelectItem>
                <SelectItem value="Awareness">Awareness</SelectItem>
                <SelectItem value="Retargeting">Retargeting</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-date-range">
                <CalendarIcon className="w-4 h-4" />
                {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })}
                {" - "}
                {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex">
                <div className="border-r p-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 pb-1">Atalhos</p>
                  {datePresets.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm font-normal"
                      onClick={() => setDateRange(preset.getRange())}
                      data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  locale={ptBR}
                  numberOfMonths={2}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <KPICard
            title="Investimento"
            value={investimentoLoading ? "Carregando..." : formatCurrency(investimentoData?.total?.investimento || 0)}
            subtitle={investimentoSource === 'todos' && investimentoData?.bySource ? 
              `Google: ${formatCurrency(investimentoData.bySource.google.investimento)} | Meta: ${formatCurrency(investimentoData.bySource.meta.investimento)}` :
              investimentoSource === 'google' ? 'Google Ads' : investimentoSource === 'meta' ? 'Meta Ads' : undefined}
            icon={<DollarSign className="w-5 h-5" />}
            trend="neutral"
          />
          <KPICard
            title="Impressões"
            value={visaoGeralLoading ? "..." : formatNumber(visaoGeralData?.resumo?.impressions || 0)}
            subtitle={visaoGeralData?.resumo?.ctr ? `CTR: ${visaoGeralData.resumo.ctr.toFixed(2)}%` : undefined}
            icon={<Users className="w-5 h-5" />}
            trend="neutral"
          />
          <KPICard
            title="Cliques"
            value={visaoGeralLoading ? "..." : formatNumber(visaoGeralData?.resumo?.clicks || 0)}
            subtitle={visaoGeralData?.resumo?.cpc ? `CPC: ${formatCurrency(visaoGeralData.resumo.cpc)}` : undefined}
            icon={<Target className="w-5 h-5" />}
            trend="neutral"
          />
          <KPICard
            title="Negócios Ganhos"
            value={visaoGeralLoading ? "..." : formatNumber(visaoGeralData?.resumo?.negociosGanhos || 0)}
            subtitle={visaoGeralData?.resumo?.negociosTotais ? `Total período: ${visaoGeralData.resumo.negociosTotais}` : undefined}
            icon={<Trophy className="w-5 h-5" />}
            trend={(visaoGeralData?.resumo?.negociosGanhos || 0) > 0 ? "up" : "neutral"}
          />
          <KPICard
            title="Valor Vendas"
            value={visaoGeralLoading ? "..." : formatCurrency(visaoGeralData?.resumo?.valorVendas || 0)}
            subtitle={visaoGeralData?.resumo?.valorRecorrente ? 
              `Rec: ${formatCurrency(visaoGeralData.resumo.valorRecorrente)} | Pont: ${formatCurrency(visaoGeralData.resumo.valorPontual)}` : undefined}
            icon={<CircleDollarSign className="w-5 h-5" />}
            trend={(visaoGeralData?.resumo?.valorVendas || 0) > 0 ? "up" : "neutral"}
          />
          <KPICard
            title="CAC"
            value={visaoGeralLoading ? "..." : visaoGeralData?.resumo?.cac ? formatCurrency(visaoGeralData.resumo.cac) : "-"}
            subtitle="Custo por Aquisição"
            icon={<DollarSign className="w-5 h-5" />}
            trend={visaoGeralData?.resumo?.cac ? "down" : "neutral"}
          />
          <KPICard
            title="ROI"
            value={visaoGeralLoading ? "..." : visaoGeralData?.resumo?.roi ? `${visaoGeralData.resumo.roi.toFixed(0)}%` : "-"}
            subtitle="Retorno sobre Investimento"
            icon={<Percent className="w-5 h-5" />}
            trend={(visaoGeralData?.resumo?.roi || 0) > 0 ? "up" : "down"}
          />
          <KPICard
            title="ROAS"
            value={visaoGeralLoading ? "..." : 
              (visaoGeralData?.resumo?.investimento && visaoGeralData.resumo.investimento > 0) ? 
                (visaoGeralData.resumo.valorVendas / visaoGeralData.resumo.investimento).toFixed(2) : "-"}
            subtitle="Return on Ad Spend"
            icon={<BarChart3 className="w-5 h-5" />}
            trend={(visaoGeralData?.resumo?.valorVendas || 0) > (visaoGeralData?.resumo?.investimento || 0) ? "up" : "down"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <FunnelVisualization 
                totalLeads={visaoGeralData?.resumo?.totalLeads || 0}
                totalMQLs={visaoGeralData?.resumo?.totalMQLs || 0}
                totalVendasMQL={visaoGeralData?.resumo?.totalVendasMQL || 0}
                taxaConversaoMQL={visaoGeralData?.resumo?.taxaConversaoMQL || 0}
                taxaVendaMQL={visaoGeralData?.resumo?.taxaVendaMQL || 0}
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">MQL por Dia</CardTitle>
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <button
                    onClick={() => setChartView('mql')}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      chartView === 'mql' 
                        ? 'bg-background shadow-sm text-foreground' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid="tab-chart-mql"
                  >
                    MQL
                  </button>
                  <button
                    onClick={() => setChartView('leads')}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      chartView === 'leads' 
                        ? 'bg-background shadow-sm text-foreground' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid="tab-chart-leads"
                  >
                    Leads
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs">
                {Object.entries(channelColors).slice(0, 6).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span>{name}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <div className="w-6 h-0.5 bg-foreground" />
                  <span>{chartView === 'mql' ? 'CPMQL' : 'CPL'}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={(() => {
                      const mqlDiario = visaoGeralData?.mqlDiario || [];
                      const investDiario = investimentoData?.daily || [];
                      
                      return mqlDiario.map((d, idx) => {
                        const dataKey = chartView === 'mql' ? 'mqls' : 'leads';
                        const investItem = investDiario.find(i => i.date === d.data) || { investimento: 0 };
                        const totalMQL = Object.values(d.canais).reduce((sum, c) => sum + (chartView === 'mql' ? c.mqls : c.leads), 0);
                        const cpmql = totalMQL > 0 ? investItem.investimento / totalMQL : 0;
                        
                        return {
                          date: format(new Date(d.data), 'dd/MM'),
                          Facebook: d.canais['facebook']?.[dataKey] || d.canais['Facebook']?.[dataKey] || 0,
                          Google: d.canais['google']?.[dataKey] || d.canais['Google']?.[dataKey] || 0,
                          Orgânico: d.canais['organic']?.[dataKey] || d.canais['Orgânico']?.[dataKey] || d.canais['organico']?.[dataKey] || 0,
                          Institucional: d.canais['institucional']?.[dataKey] || d.canais['Institucional']?.[dataKey] || 0,
                          LinkedIn: d.canais['linkedin']?.[dataKey] || d.canais['LinkedIn']?.[dataKey] || 0,
                          Outros: d.canais['Outros']?.[dataKey] || d.canais['outros']?.[dataKey] || d.canais['(direct)']?.[dataKey] || 0,
                          cpmql
                        };
                      });
                    })()} 
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value: any, name: string) => [
                        name === 'cpmql' ? formatCurrency(value) : formatNumber(value),
                        name === 'cpmql' ? (chartView === 'mql' ? 'CPMQL' : 'CPL') : name
                      ]}
                    />
                    <Bar yAxisId="left" dataKey="Facebook" stackId="a" fill={channelColors['Facebook']} name="Facebook" />
                    <Bar yAxisId="left" dataKey="Google" stackId="a" fill={channelColors['Google']} name="Google" />
                    <Bar yAxisId="left" dataKey="Orgânico" stackId="a" fill={channelColors['Orgânico']} name="Orgânico" />
                    <Bar yAxisId="left" dataKey="Institucional" stackId="a" fill={channelColors['Institucional']} name="Institucional" />
                    <Bar yAxisId="left" dataKey="LinkedIn" stackId="a" fill={channelColors['LinkedIn']} name="LinkedIn" />
                    <Bar yAxisId="left" dataKey="Outros" stackId="a" fill={channelColors['Outros']} name="Outros" />
                    <Line yAxisId="right" type="monotone" dataKey="cpmql" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} name="CPMQL" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance por Canal</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[120px]">Canal</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">CPMQL</TableHead>
                    <TableHead className="text-right">Lead&gt;MQL</TableHead>
                    <TableHead className="text-right">MQL</TableHead>
                    <TableHead className="text-center min-w-[80px]">por data</TableHead>
                    <TableHead className="text-right">MQL&gt;RM</TableHead>
                    <TableHead className="text-right">RM</TableHead>
                    <TableHead className="text-right">MQL&gt;RR</TableHead>
                    <TableHead className="text-right">RR</TableHead>
                    <TableHead className="text-right">Tx RR Venda</TableHead>
                    <TableHead className="text-right">MQL&gt;Venda</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">CAC</TableHead>
                    <TableHead className="text-right">Valor Vendas</TableHead>
                    <TableHead className="text-right">TM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sparklineData.map((row) => (
                    <TableRow key={row.canal} className="hover:bg-muted/30" data-testid={`row-canal-${row.canal.toLowerCase()}`}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: channelColors[row.canal] || '#6B7280' }} />
                          {row.canal}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.leads)}</TableCell>
                      <TableCell className="text-right font-medium" style={{ backgroundColor: row.cpmql ? 'rgba(34, 197, 94, 0.15)' : 'transparent' }}>
                        {row.cpmql ? formatCurrency(row.cpmql) : '-'}
                      </TableCell>
                      <TableCell className="text-right">{row.leadMql}%</TableCell>
                      <TableCell className="text-right font-semibold">{formatNumber(row.mql)}</TableCell>
                      <TableCell className="text-center">
                        <MiniSparkline data={row.sparkline} />
                      </TableCell>
                      <TableCell className="text-right">{row.mqlRm}%</TableCell>
                      <TableCell className="text-right">{formatNumber(row.rm)}</TableCell>
                      <TableCell className="text-right">{row.mqlRr}%</TableCell>
                      <TableCell className="text-right">{formatNumber(row.rr)}</TableCell>
                      <TableCell className="text-right">{row.txRrVenda}%</TableCell>
                      <TableCell className="text-right">{row.mqlVenda}%</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{formatNumber(row.vendas)}</TableCell>
                      <TableCell className="text-right" style={{ backgroundColor: row.cac ? 'rgba(239, 68, 68, 0.15)' : 'transparent' }}>
                        {row.cac ? formatCurrency(row.cac) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}>
                        {formatCurrency(row.valorVendas)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.tm)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell className="sticky left-0 bg-muted/50 z-10">Total</TableCell>
                    <TableCell className="text-right">{formatNumber(mockTotals.leads)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(mockTotals.cpmql)}</TableCell>
                    <TableCell className="text-right">{mockTotals.leadMql}%</TableCell>
                    <TableCell className="text-right">{formatNumber(mockTotals.mql)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{mockTotals.mqlRm}%</TableCell>
                    <TableCell className="text-right">{formatNumber(mockTotals.rm)}</TableCell>
                    <TableCell className="text-right">{mockTotals.mqlRr}%</TableCell>
                    <TableCell className="text-right">{formatNumber(mockTotals.rr)}</TableCell>
                    <TableCell className="text-right">{mockTotals.txRrVenda}%</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-green-600">{formatNumber(mockTotals.vendas)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">{formatCurrency(mockTotals.valorVendas)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(mockTotals.tm)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
