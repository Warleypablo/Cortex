import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface RevenueGoalsData {
  resumo: {
    totalPrevisto: number;
    totalRecebido: number;
    totalPendente: number;
    totalInadimplente: number;
    percentualRecebido: number;
    percentualInadimplencia: number;
    quantidadeParcelas: number;
    quantidadeRecebidas: number;
    quantidadePendentes: number;
    quantidadeInadimplentes: number;
  };
  porDia: {
    dia: number;
    dataCompleta: string;
    previsto: number;
    recebido: number;
    pendente: number;
    inadimplente: number;
  }[];
}

const mesesNomes = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'default' | 'success' | 'warning' | 'danger';
}

function KPICard({ title, value, subtitle, icon, trend, trendValue, color = 'default' }: KPICardProps) {
  const colorClasses = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    danger: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <Card data-testid={`card-kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium truncate">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && trendValue && (
              <div className="flex items-center gap-1 mt-1">
                {trend === 'up' ? (
                  <TrendingUp className="w-3 h-3 text-green-600" />
                ) : trend === 'down' ? (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                ) : null}
                <span className={`text-xs font-medium ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {trendValue}
                </span>
              </div>
            )}
          </div>
          <div className={`p-2 rounded-lg shrink-0 ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium mb-2">Dia {label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function RevenueGoals() {
  useSetPageInfo("Revenue Goals", "Acompanhamento de recebimentos do mês");
  
  const hoje = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ month: hoje.getMonth() + 1, year: hoje.getFullYear() });

  const { data, isLoading } = useQuery<RevenueGoalsData>({
    queryKey: ['/api/financeiro/revenue-goals', selectedMonth.month, selectedMonth.year],
    queryFn: async () => {
      const response = await fetch(`/api/financeiro/revenue-goals?mes=${selectedMonth.month}&ano=${selectedMonth.year}`);
      if (!response.ok) throw new Error('Failed to fetch revenue goals');
      return response.json();
    },
  });

  const chartData = data?.porDia.map(d => ({
    dia: d.dia,
    recebido: d.recebido,
    pendente: d.pendente,
    inadimplente: d.inadimplente,
  })) || [];
  
  return (
    <div className="p-6 space-y-6" data-testid="page-revenue-goals">
      <div className="flex justify-end">
        <MonthYearPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              title="Previsto"
              value={formatCurrency(data.resumo.totalPrevisto)}
              subtitle={`${data.resumo.quantidadeParcelas} parcelas`}
              icon={<Target className="w-5 h-5" />}
              color="default"
            />
            <KPICard
              title="Recebido"
              value={formatCurrency(data.resumo.totalRecebido)}
              subtitle={`${data.resumo.quantidadeRecebidas} parcelas`}
              icon={<CheckCircle className="w-5 h-5" />}
              trend={data.resumo.percentualRecebido > 50 ? 'up' : 'neutral'}
              trendValue={formatPercent(data.resumo.percentualRecebido)}
              color="success"
            />
            <KPICard
              title="Pendente"
              value={formatCurrency(data.resumo.totalPendente)}
              subtitle={`${data.resumo.quantidadePendentes} parcelas`}
              icon={<Clock className="w-5 h-5" />}
              color="warning"
            />
            <KPICard
              title="Inadimplente"
              value={formatCurrency(data.resumo.totalInadimplente)}
              subtitle={`${data.resumo.quantidadeInadimplentes} parcelas`}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="danger"
            />
            <KPICard
              title="Taxa Inadimplência"
              value={formatPercent(data.resumo.percentualInadimplencia)}
              subtitle="Do total previsto"
              icon={<TrendingDown className="w-5 h-5" />}
              trend={data.resumo.percentualInadimplencia > 10 ? 'down' : 'up'}
              trendValue={data.resumo.percentualInadimplencia > 10 ? 'Acima do ideal' : 'Dentro do esperado'}
              color={data.resumo.percentualInadimplencia > 10 ? 'danger' : 'success'}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Recebimentos por Dia - {mesesNomes[mes - 1]} {ano}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="10%">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="dia" 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis 
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                        return value;
                      }}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: 20 }}
                      formatter={(value) => <span className="text-sm">{value}</span>}
                    />
                    <Bar 
                      dataKey="recebido" 
                      name="Recebido" 
                      stackId="a" 
                      fill="#22c55e"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar 
                      dataKey="pendente" 
                      name="Pendente" 
                      stackId="a" 
                      fill="#eab308"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar 
                      dataKey="inadimplente" 
                      name="Inadimplente" 
                      stackId="a" 
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-green-200 dark:border-green-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ticket Médio Recebido</p>
                    <p className="text-xl font-bold">
                      {data.resumo.quantidadeRecebidas > 0 
                        ? formatCurrency(data.resumo.totalRecebido / data.resumo.quantidadeRecebidas)
                        : 'R$ 0'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-yellow-200 dark:border-yellow-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ticket Médio Pendente</p>
                    <p className="text-xl font-bold">
                      {data.resumo.quantidadePendentes > 0 
                        ? formatCurrency(data.resumo.totalPendente / data.resumo.quantidadePendentes)
                        : 'R$ 0'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-red-200 dark:border-red-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ticket Médio Inadimplente</p>
                    <p className="text-xl font-bold">
                      {data.resumo.quantidadeInadimplentes > 0 
                        ? formatCurrency(data.resumo.totalInadimplente / data.resumo.quantidadeInadimplentes)
                        : 'R$ 0'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum dado disponível para o período selecionado.
        </div>
      )}
    </div>
  );
}
