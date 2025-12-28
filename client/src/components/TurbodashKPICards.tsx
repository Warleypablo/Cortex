import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Target, Users, Percent, BarChart3, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TurbodashClientResponse } from "@shared/schema";

interface KPICardProps {
  label: string;
  value: string;
  variacao: number;
  icon: React.ReactNode;
  iconBgColor: string;
}

function KPICard({ label, value, variacao, icon, iconBgColor }: KPICardProps) {
  const isPositive = variacao >= 0;
  const isNeutral = variacao === 0;
  
  return (
    <Card className="relative overflow-hidden" data-testid={`kpi-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", iconBgColor)}>
            {icon}
          </div>
          {!isNeutral && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs font-medium",
                isPositive 
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" 
                  : "border-rose-500/30 bg-rose-500/10 text-rose-500"
              )}
            >
              {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(variacao).toFixed(1)}%
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-foreground mt-1" data-testid={`kpi-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

interface TurbodashKPICardsProps {
  cnpj: string;
  className?: string;
}

export function TurbodashKPICards({ cnpj, className }: TurbodashKPICardsProps) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<TurbodashClientResponse>({
    queryKey: ['/api/integrations/turbodash/client', cnpj],
    enabled: !!cnpj,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 w-20 mt-3" />
                <Skeleton className="h-6 w-24 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  if (isError || !data) {
    return (
      <div className={cn("p-6 text-center", className)}>
        <p className="text-muted-foreground">Dados do TurboDash não disponíveis para este cliente.</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-2"
          onClick={() => refetch()}
          data-testid="button-retry-turbodash"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }
  
  const kpis = data.kpis;
  
  const kpiCards = [
    { 
      label: "Faturamento", 
      value: formatCurrency(kpis.faturamento), 
      variacao: kpis.faturamento_variacao,
      icon: <DollarSign className="w-5 h-5 text-emerald-500" />,
      iconBgColor: "bg-emerald-500/10"
    },
    { 
      label: "Investimento", 
      value: formatCurrency(kpis.investimento), 
      variacao: kpis.investimento_variacao,
      icon: <BarChart3 className="w-5 h-5 text-blue-500" />,
      iconBgColor: "bg-blue-500/10"
    },
    { 
      label: "ROAS", 
      value: `${kpis.roas.toFixed(2)}x`, 
      variacao: kpis.roas_variacao,
      icon: <Target className="w-5 h-5 text-purple-500" />,
      iconBgColor: "bg-purple-500/10"
    },
    { 
      label: "Compras", 
      value: formatNumber(kpis.compras), 
      variacao: kpis.compras_variacao,
      icon: <ShoppingCart className="w-5 h-5 text-orange-500" />,
      iconBgColor: "bg-orange-500/10"
    },
    { 
      label: "CPA", 
      value: formatCurrency(kpis.cpa), 
      variacao: kpis.cpa_variacao,
      icon: <DollarSign className="w-5 h-5 text-rose-500" />,
      iconBgColor: "bg-rose-500/10"
    },
    { 
      label: "Ticket Médio", 
      value: formatCurrency(kpis.ticket_medio), 
      variacao: kpis.ticket_medio_variacao,
      icon: <DollarSign className="w-5 h-5 text-amber-500" />,
      iconBgColor: "bg-amber-500/10"
    },
    { 
      label: "Sessões", 
      value: formatNumber(kpis.sessoes), 
      variacao: kpis.sessoes_variacao,
      icon: <Users className="w-5 h-5 text-cyan-500" />,
      iconBgColor: "bg-cyan-500/10"
    },
    { 
      label: "CPS", 
      value: formatCurrency(kpis.cps), 
      variacao: kpis.cps_variacao,
      icon: <DollarSign className="w-5 h-5 text-indigo-500" />,
      iconBgColor: "bg-indigo-500/10"
    },
    { 
      label: "Taxa de Conversão", 
      value: formatPercent(kpis.taxa_conversao), 
      variacao: kpis.taxa_conversao_variacao,
      icon: <Percent className="w-5 h-5 text-teal-500" />,
      iconBgColor: "bg-teal-500/10"
    },
    { 
      label: "Taxa de Recorrência", 
      value: formatPercent(kpis.taxa_recorrencia), 
      variacao: kpis.taxa_recorrencia_variacao,
      icon: <RefreshCw className="w-5 h-5 text-pink-500" />,
      iconBgColor: "bg-pink-500/10"
    },
  ];
  
  return (
    <div className={cn("space-y-4", className)} data-testid="turbodash-kpi-cards">
      {data.is_demo && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Exibindo dados de demonstração. Conecte o TurboDash para dados reais.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Performance TurboDash</h3>
          <p className="text-xs text-muted-foreground">
            Período: {new Date(data.periodo_inicio).toLocaleDateString('pt-BR')} - {new Date(data.periodo_fim).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-turbodash"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>
    </div>
  );
}

export default TurbodashKPICards;
