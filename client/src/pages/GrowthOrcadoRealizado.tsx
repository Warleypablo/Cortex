import { useState } from "react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Target, DollarSign, Users, BarChart3, Megaphone, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricType = 'manual' | 'formula';

interface Metric {
  id: string;
  name: string;
  type: MetricType;
  orcado: number | string | null;
  realizado: number | string | null;
  percentual: number | null;
  format: 'currency' | 'number' | 'percent';
  isHeader?: boolean;
  indent?: number;
  emoji?: string;
}

interface MetricSection {
  title: string;
  icon: React.ReactNode;
  metrics: Metric[];
}

function formatValue(value: number | string | null, format: 'currency' | 'number' | 'percent'): string {
  if (value === null || value === '') return '-';
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    case 'percent':
      return `${(value * 100).toFixed(2)}%`;
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(value);
    default:
      return String(value);
  }
}

function getVarianceColor(percentual: number | null): string {
  if (percentual === null) return '';
  if (percentual >= 100) return 'text-green-500';
  if (percentual >= 80) return 'text-yellow-500';
  return 'text-red-500';
}

function getVarianceBadge(percentual: number | null) {
  if (percentual === null) return null;
  const isPositive = percentual >= 100;
  return (
    <Badge variant={isPositive ? 'default' : 'destructive'} className="ml-2">
      {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
      {percentual.toFixed(1)}%
    </Badge>
  );
}

const mockData: MetricSection[] = [
  {
    title: 'Métricas de Marketing: Ads',
    icon: <Megaphone className="w-5 h-5" />,
    metrics: [
      { id: 'investimento', name: 'Investimento', type: 'manual', orcado: 95500, realizado: 0, percentual: 0, format: 'currency' },
      { id: 'cpm', name: 'CPM', type: 'formula', orcado: 100, realizado: null, percentual: 0, format: 'currency' },
      { id: 'impressoes', name: 'Impressões', type: 'formula', orcado: 955000, realizado: 0, percentual: 0, format: 'number' },
      { id: 'ctr', name: 'CTR', type: 'manual', orcado: 0.009, realizado: null, percentual: 0, format: 'percent' },
      { id: 'cliques_saida', name: 'Cliques de Saída', type: 'formula', orcado: 8595, realizado: 0, percentual: 0, format: 'number' },
      { id: 'visualizacao_pagina', name: 'Visualização de Página', type: 'formula', orcado: 7306, realizado: null, percentual: null, format: 'number' },
      { id: 'cps', name: 'CPS', type: 'formula', orcado: 13.07, realizado: null, percentual: null, format: 'currency' },
    ],
  },
  {
    title: 'Métricas de Marketing: Site',
    icon: <LineChart className="w-5 h-5" />,
    metrics: [
      { id: 'connect_rate', name: 'Connect Rate', type: 'manual', orcado: 0.85, realizado: null, percentual: null, format: 'percent' },
      { id: 'conversao_pagina', name: 'Conversão da Página', type: 'manual', orcado: 0.18, realizado: null, percentual: null, format: 'percent' },
      { id: 'cpl', name: 'CPL', type: 'formula', orcado: 73, realizado: null, percentual: null, format: 'currency' },
      { id: 'leads', name: 'Leads', type: 'formula', orcado: 1315, realizado: 0, percentual: 0, format: 'number' },
      { id: 'mql', name: 'MQL', type: 'formula', orcado: 229, realizado: 0, percentual: 0, format: 'number' },
      { id: 'mql_perc', name: 'MQL (%)', type: 'manual', orcado: 0.22, realizado: null, percentual: 0, format: 'percent' },
      { id: 'cpmql', name: 'CPMQL', type: 'formula', orcado: 417, realizado: null, percentual: 0, format: 'currency' },
    ],
  },
  {
    title: 'Métricas de Vendas: MQL',
    icon: <Users className="w-5 h-5" />,
    metrics: [
      { id: 'mql_ra_perc', name: '% Reunião agendadas MQL', type: 'manual', orcado: 0.30, realizado: null, percentual: 0, format: 'percent' },
      { id: 'mql_ra_num', name: 'Nº Reunião agendada MQL', type: 'formula', orcado: 69, realizado: 0, percentual: 0, format: 'number' },
      { id: 'mql_rr_num', name: 'Nº Reunião realizada MQL', type: 'formula', orcado: 65, realizado: 0, percentual: 0, format: 'number' },
      { id: 'mql_noshow', name: '% No-show', type: 'manual', orcado: 0.05, realizado: 1.0, percentual: 2000, format: 'percent' },
      { id: 'mql_taxa_vendas', name: 'Taxa RR/Vendas MQL', type: 'manual', orcado: 0.30, realizado: null, percentual: 0, format: 'percent' },
      { id: 'mql_novos_clientes', name: 'Novos Clientes MQL', type: 'formula', orcado: 19, realizado: 0, percentual: 0, format: 'number' },
      { id: 'mql_tx_recorrente', name: 'Tx de Contratos Recorrentes', type: 'manual', orcado: 0.60, realizado: null, percentual: 0, format: 'percent' },
      { id: 'mql_tx_implantacao', name: 'Tx de Contratos Implantação', type: 'manual', orcado: 0.45, realizado: null, percentual: 0, format: 'percent' },
      { id: 'mql_contratos_acel', name: 'Nº Novos Contratos Aceleração MQL', type: 'formula', orcado: 11, realizado: 0, percentual: 0, format: 'number', emoji: '🏎️' },
      { id: 'mql_ticket_acel', name: 'Ticket Médio Aceleração MQL', type: 'manual', orcado: 4000, realizado: null, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'mql_fat_acel', name: 'Faturamento Aceleração (MRR novo) de MQL', type: 'formula', orcado: 44641, realizado: 0, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'mql_contratos_impl', name: 'Nº Novos Contratos Implantação MQL', type: 'formula', orcado: 8, realizado: 0, percentual: 0, format: 'number', emoji: '🔧' },
      { id: 'mql_ticket_impl', name: 'Ticket Médio Implantação MQL', type: 'manual', orcado: 8500, realizado: null, percentual: 0, format: 'currency', emoji: '🔧' },
      { id: 'mql_fat_impl', name: 'Faturamento Implantação MQL', type: 'formula', orcado: 71147, realizado: 0, percentual: 0, format: 'currency', emoji: '🔧' },
    ],
  },
  {
    title: 'Métricas de Vendas: Não-MQL',
    icon: <Users className="w-5 h-5" />,
    metrics: [
      { id: 'nmql_ra_perc', name: '% Reunião agendadas não-MQL', type: 'manual', orcado: 0.14, realizado: null, percentual: 0, format: 'percent' },
      { id: 'nmql_ra_num', name: 'Nº Reunião agendada não-MQL', type: 'formula', orcado: 152, realizado: 0, percentual: 0, format: 'number' },
      { id: 'nmql_rr_num', name: 'Nº Reunião realizada não-MQL', type: 'formula', orcado: 144, realizado: 0, percentual: 0, format: 'number' },
      { id: 'nmql_noshow', name: '% No-show', type: 'manual', orcado: 0.05, realizado: null, percentual: 0, format: 'percent' },
      { id: 'nmql_taxa_vendas', name: 'Taxa RR/Vendas não MQL', type: 'manual', orcado: 0.25, realizado: null, percentual: null, format: 'percent' },
      { id: 'nmql_novos_clientes', name: 'Novos Clientes não MQL', type: 'formula', orcado: 34, realizado: 0, percentual: 0, format: 'number' },
      { id: 'nmql_tx_recorrente', name: 'Tx de Contratos Recorrentes', type: 'manual', orcado: 0.65, realizado: null, percentual: 0, format: 'percent' },
      { id: 'nmql_tx_implantacao', name: 'Tx de Contratos Implantação', type: 'manual', orcado: 0.45, realizado: null, percentual: 0, format: 'percent' },
      { id: 'nmql_contratos_acel', name: 'Nº Novos Contratos Aceleração não-MQL', type: 'formula', orcado: 22, realizado: 0, percentual: 0, format: 'number', emoji: '🏎️' },
      { id: 'nmql_ticket_acel', name: 'Ticket Médio Aceleração não-MQL', type: 'manual', orcado: 4000, realizado: null, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'nmql_fat_acel', name: 'Faturamento Aceleração (MRR novo) de não-MQL', type: 'formula', orcado: 89193.34, realizado: 0, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'nmql_contratos_impl', name: 'Nº Novos Contratos Implantação não-MQL', type: 'formula', orcado: 15, realizado: 0, percentual: 0, format: 'number', emoji: '🔧' },
      { id: 'nmql_ticket_impl', name: 'Ticket Médio Implantação não-MQL', type: 'manual', orcado: 8500, realizado: null, percentual: null, format: 'currency', emoji: '🔧' },
      { id: 'nmql_fat_impl', name: 'Faturamento Implantação não-MQL', type: 'formula', orcado: 131217.12, realizado: 0, percentual: 0, format: 'currency', emoji: '🔧' },
    ],
  },
  {
    title: 'Métricas de Vendas: Outbound',
    icon: <Target className="w-5 h-5" />,
    metrics: [
      { id: 'out_leads', name: 'Leads', type: 'manual', orcado: 800, realizado: null, percentual: 0, format: 'number' },
      { id: 'out_ra_perc', name: '% Reunião agendadas MQL', type: 'manual', orcado: 0.10, realizado: null, percentual: 0, format: 'percent' },
      { id: 'out_ra_num', name: 'Nº Reunião agendada MQL', type: 'formula', orcado: 84, realizado: 0, percentual: 0, format: 'number' },
      { id: 'out_rr_num', name: 'Nº Reunião realizada MQL', type: 'formula', orcado: 80, realizado: 0, percentual: 0, format: 'number' },
      { id: 'out_noshow', name: '% No-show', type: 'manual', orcado: 0.05, realizado: 1.0, percentual: 2000, format: 'percent' },
      { id: 'out_taxa_vendas', name: 'Taxa RR/Vendas MQL', type: 'manual', orcado: 0.275, realizado: null, percentual: 0, format: 'percent' },
      { id: 'out_novos_clientes', name: 'Novos Clientes não MQL', type: 'formula', orcado: 21, realizado: 0, percentual: 0, format: 'number' },
      { id: 'out_tx_recorrente', name: 'Tx de Contratos Recorrentes', type: 'manual', orcado: 0.65, realizado: null, percentual: 0, format: 'percent' },
      { id: 'out_tx_implantacao', name: 'Tx de Contratos Implantação', type: 'manual', orcado: 0.45, realizado: null, percentual: 0, format: 'percent' },
      { id: 'out_contratos_acel', name: 'Nº Novos Contratos Aceleração não-MQL', type: 'formula', orcado: 14, realizado: 0, percentual: 0, format: 'number', emoji: '🏎️' },
      { id: 'out_ticket_acel', name: 'Ticket Médio Aceleração não-MQL', type: 'manual', orcado: 4000, realizado: null, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'out_fat_acel', name: 'Faturamento Aceleração (MRR novo) de não-MQL', type: 'formula', orcado: 54204.15, realizado: 0, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'out_contratos_impl', name: 'Nº Novos Contratos Implantação não-MQL', type: 'formula', orcado: 9, realizado: 0, percentual: 0, format: 'number', emoji: '🔧' },
      { id: 'out_ticket_impl', name: 'Ticket Médio Implantação não-MQL', type: 'manual', orcado: 8500, realizado: null, percentual: null, format: 'currency', emoji: '🔧' },
      { id: 'out_fat_impl', name: 'Faturamento Implantação não-MQL', type: 'formula', orcado: 79742.64, realizado: 0, percentual: 0, format: 'currency', emoji: '🔧' },
    ],
  },
  {
    title: 'Total',
    icon: <BarChart3 className="w-5 h-5" />,
    metrics: [
      { id: 'total_ra_perc', name: '% RA', type: 'formula', orcado: 0.2317, realizado: null, percentual: null, format: 'percent' },
      { id: 'total_ra', name: 'Reuniões Agendadas', type: 'formula', orcado: 305, realizado: 0, percentual: 0, format: 'number' },
      { id: 'total_cpra', name: 'R$/Reunião Agendadas (CPRA)', type: 'formula', orcado: 313, realizado: null, percentual: 0, format: 'currency' },
      { id: 'total_rr', name: 'Reuniões Realizadas', type: 'formula', orcado: 290, realizado: 0, percentual: 0, format: 'number' },
      { id: 'total_cprr', name: 'R$/Reunião Realizadas (CPRR)', type: 'formula', orcado: 330, realizado: null, percentual: null, format: 'currency' },
      { id: 'total_noshow', name: 'No show', type: 'formula', orcado: 0.05, realizado: null, percentual: 0, format: 'percent' },
      { id: 'total_conv_rrv', name: 'Conversão de RR/V (%)', type: 'formula', orcado: 0.28, realizado: null, percentual: 0, format: 'percent' },
      { id: 'total_novos_clientes', name: 'Novos Clientes', type: 'formula', orcado: 74, realizado: 0, percentual: 0, format: 'number' },
      { id: 'total_ganhos_acel', name: 'Negócios Ganhos Aceleração', type: 'formula', orcado: 47, realizado: 0, percentual: 0, format: 'number', emoji: '🏎️' },
      { id: 'total_ganhos_impl', name: 'Negócios Ganhos Implantação', type: 'formula', orcado: 33, realizado: 0, percentual: 0, format: 'number', emoji: '🔧' },
      { id: 'total_faturamento', name: 'Faturamento Total', type: 'formula', orcado: 470146, realizado: 0, percentual: 0, format: 'currency' },
      { id: 'total_fat_acel', name: 'Faturamento A', type: 'formula', orcado: 188039, realizado: 0, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'total_fat_impl', name: 'Faturamento I', type: 'formula', orcado: 282107, realizado: 0, percentual: 0, format: 'currency', emoji: '🔧' },
      { id: 'total_conv_funil', name: 'Taxa de Conversão do Funil inteiro', type: 'formula', orcado: 0.0561, realizado: null, percentual: null, format: 'percent' },
      { id: 'total_conv_mql', name: 'Tx de conversão MQL', type: 'formula', orcado: 0.0812, realizado: null, percentual: 0, format: 'percent' },
      { id: 'total_roas', name: 'ROAS', type: 'formula', orcado: 4.92, realizado: null, percentual: 0, format: 'number' },
      { id: 'total_roas_acel', name: 'ROAS Aceleração', type: 'formula', orcado: 1.97, realizado: null, percentual: 0, format: 'number' },
      { id: 'total_cac_ads', name: 'CAC ADS', type: 'formula', orcado: 1805.10, realizado: null, percentual: 0, format: 'currency' },
      { id: 'total_ticket_geral', name: 'Ticket Médio Geral', type: 'formula', orcado: 4192.07, realizado: null, percentual: 0, format: 'currency' },
      { id: 'total_ticket_acel', name: 'Ticket Médio Aceleração', type: 'formula', orcado: 4000, realizado: null, percentual: 0, format: 'currency' },
      { id: 'total_ticket_impl', name: 'Ticket Médio Implantação', type: 'formula', orcado: 8500, realizado: null, percentual: 0, format: 'currency' },
      { id: 'total_cac_acel', name: 'CAC Aceleração', type: 'formula', orcado: 2031.50, realizado: null, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'total_cac_impl', name: 'CAC Implantação', type: 'formula', orcado: 2877.46, realizado: null, percentual: 0, format: 'currency' },
    ],
  },
];

export default function GrowthOrcadoRealizado() {
  usePageTitle("Orçado x Realizado");
  useSetPageInfo("Orçado x Realizado", "Controle de Métricas de Marketing e Vendas");
  
  const [selectedMonth, setSelectedMonth] = useState("2026-01");
  
  const months = [
    { value: "2026-01", label: "Janeiro 2026" },
    { value: "2026-02", label: "Fevereiro 2026" },
    { value: "2026-03", label: "Março 2026" },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="growth-orcado-realizado-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Orçado x Realizado</h1>
            <p className="text-muted-foreground text-sm">Acompanhamento de metas de marketing e vendas</p>
          </div>
        </div>
        
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48" data-testid="select-month">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Investimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 95.500</div>
            <p className="text-xs text-muted-foreground">Orçado para o período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads Gerados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.315</div>
            <p className="text-xs text-muted-foreground">Meta de leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Novos Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">74</div>
            <p className="text-xs text-muted-foreground">Meta de novos clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 470.146</div>
            <p className="text-xs text-muted-foreground">Meta de faturamento</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {mockData.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {section.icon}
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Métrica</TableHead>
                    <TableHead className="text-center w-[15%]">Tipo</TableHead>
                    <TableHead className="text-right w-[15%]">Orçado</TableHead>
                    <TableHead className="text-right w-[15%]">Realizado</TableHead>
                    <TableHead className="text-right w-[15%]">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.metrics.map((metric) => (
                    <TableRow key={metric.id} data-testid={`metric-row-${metric.id}`}>
                      <TableCell className="font-medium">
                        {metric.emoji && <span className="mr-2">{metric.emoji}</span>}
                        {metric.name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={metric.type === 'manual' ? 'outline' : 'secondary'}>
                          {metric.type === 'manual' ? 'Manual' : 'Fórmula'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatValue(metric.orcado, metric.format)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatValue(metric.realizado, metric.format)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono", getVarianceColor(metric.percentual))}>
                        {metric.percentual !== null ? `${metric.percentual.toFixed(2)}%` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
