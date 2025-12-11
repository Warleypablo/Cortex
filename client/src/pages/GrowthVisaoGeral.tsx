import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, TrendingUp, TrendingDown, Target, DollarSign, Users, ShoppingCart, BarChart3, Rocket, Percent } from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
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

function FunnelVisualization() {
  const [activeTab, setActiveTab] = useState<'mql' | 'leads'>('mql');
  
  const mqlStages = [
    { label: 'MQLs', value: 14013, color: 'bg-red-500' },
    { label: 'RM MQL', value: 5781, percent: 41, color: 'bg-orange-500' },
    { label: 'RR MQL', value: 2946, percent: 51, color: 'bg-yellow-500' },
    { label: 'Vendas MQL', value: 1024, percent: 35, color: 'bg-green-500' },
  ];
  
  const leadsStages = [
    { label: 'Leads Total', value: 28426, color: 'bg-blue-500' },
    { label: 'RM Leads', value: 8743, percent: 31, color: 'bg-orange-500' },
    { label: 'RR Leads', value: 4102, percent: 47, color: 'bg-yellow-500' },
    { label: 'Vendas Leads', value: 1312, percent: 32, color: 'bg-green-500' },
  ];
  
  const stages = activeTab === 'mql' ? mqlStages : leadsStages;
  const taxaFinal = activeTab === 'mql' ? 7 : 5;
  const firstStage = stages[0];

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
          onClick={() => setActiveTab('leads')}
          className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
            activeTab === 'leads' 
              ? 'bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-funnel-leads"
        >
          Funil Geral
        </button>
      </div>
      
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-12 h-12 rounded-full ${activeTab === 'mql' ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'} flex items-center justify-center`}>
          <span className="text-white font-bold text-xs">{formatNumber(firstStage.value)}</span>
        </div>
        <span className="text-sm font-medium">{firstStage.label}</span>
      </div>
      
      {stages.slice(1).map((stage) => (
        <div key={stage.label} className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${stage.color} flex items-center justify-center`}>
            <span className="text-white font-bold text-xs">{formatNumber(stage.value)}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{stage.label}</span>
              <Badge variant="outline" className="text-xs">{stage.percent}%</Badge>
            </div>
          </div>
        </div>
      ))}
      
      <div className="mt-2 pt-2 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Taxa Final</span>
          <Badge className="bg-green-500">{taxaFinal}%</Badge>
        </div>
      </div>
    </div>
  );
}

export default function GrowthVisaoGeral() {
  const [dateRange, setDateRange] = useState({
    from: new Date(2025, 9, 1),
    to: new Date(2025, 10, 30),
  });
  const [canal, setCanal] = useState("Todos");
  const [tipoContrato, setTipoContrato] = useState("Todos");
  const [estrategia, setEstrategia] = useState("Todos");
  const [chartView, setChartView] = useState<'mql' | 'leads'>('mql');

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
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger className="w-[120px]" data-testid="select-canal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
                <SelectItem value="Google">Google</SelectItem>
                <SelectItem value="Orgânico">Orgânico</SelectItem>
                <SelectItem value="Institucional">Institucional</SelectItem>
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
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KPICard
            title="Investimento"
            value="R$ 4.900.385"
            meta="Meta"
            metaPercent={210}
            vsLM={-6.8}
            icon={<DollarSign className="w-5 h-5" />}
            trend="down"
          />
          <KPICard
            title="MQL"
            value="14.013"
            meta="Meta"
            metaPercent={240}
            vsLM={40.0}
            icon={<Users className="w-5 h-5" />}
            trend="up"
          />
          <KPICard
            title="CPMQL"
            value="R$ 339"
            meta="-15% abaixo (Meta R$399)"
            vsLM={14.7}
            icon={<Target className="w-5 h-5" />}
            trend="up"
          />
          <KPICard
            title="Vendas"
            value="1.024"
            vsLM={8.9}
            icon={<ShoppingCart className="w-5 h-5" />}
            trend="up"
          />
          <KPICard
            title="CAC"
            value="R$ 4.786"
            vsLM={-1.9}
            icon={<DollarSign className="w-5 h-5" />}
            trend="down"
          />
          <KPICard
            title="Valor Vendas"
            value="R$ 14.509.270"
            vsLM={14.5}
            subtitle="TM Rec: R$ 16.240 | TM Pont: R$ 8.970"
            icon={<BarChart3 className="w-5 h-5" />}
            trend="up"
          />
          <KPICard
            title="ROAS"
            value="3,06"
            vsLM={8.7}
            icon={<Percent className="w-5 h-5" />}
            trend="up"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <FunnelVisualization />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">{chartView === 'mql' ? 'MQL' : 'Leads'} por Dia</CardTitle>
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
                  <div className="w-6 h-0.5 bg-black" />
                  <span>{chartView === 'mql' ? 'CPMQL' : 'CPL'}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mockDailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 500]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }} 
                    />
                    <Bar yAxisId="left" dataKey={chartView === 'mql' ? 'Facebook' : 'FacebookLeads'} stackId="a" fill={channelColors['Facebook']} name="Facebook" />
                    <Bar yAxisId="left" dataKey={chartView === 'mql' ? 'Google' : 'GoogleLeads'} stackId="a" fill={channelColors['Google']} name="Google" />
                    <Bar yAxisId="left" dataKey={chartView === 'mql' ? 'Orgânico' : 'OrgânicoLeads'} stackId="a" fill={channelColors['Orgânico']} name="Orgânico" />
                    <Bar yAxisId="left" dataKey={chartView === 'mql' ? 'Institucional' : 'InstitucionalLeads'} stackId="a" fill={channelColors['Institucional']} name="Institucional" />
                    <Bar yAxisId="left" dataKey={chartView === 'mql' ? 'LinkedIn' : 'LinkedInLeads'} stackId="a" fill={channelColors['LinkedIn']} name="LinkedIn" />
                    <Bar yAxisId="left" dataKey={chartView === 'mql' ? 'Outros' : 'OutrosLeads'} stackId="a" fill={channelColors['Outros']} name="Outros" />
                    <Line yAxisId="right" type="monotone" dataKey={chartView === 'mql' ? 'cpmql' : 'cpl'} stroke="#000" strokeWidth={2} dot={false} name={chartView === 'mql' ? 'CPMQL' : 'CPL'} />
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
