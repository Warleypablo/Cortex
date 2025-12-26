import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { CohortData, CohortViewMode, CohortMetricType, CohortCell, CohortRow } from "@shared/schema";
import { Users, DollarSign, TrendingUp, Percent, Hash, AlertTriangle, Info, ArrowUp, ArrowDown } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function getExpectedRetention(monthOffset: number): number {
  return 100 * Math.pow(0.92, monthOffset);
}

function getCellColor(percentage: number, monthOffset: number): string {
  if (monthOffset === 0) {
    return 'bg-muted text-foreground';
  }
  
  const expected = getExpectedRetention(monthOffset);
  const diff = percentage - expected;
  const diffPercent = (diff / expected) * 100;
  
  if (diffPercent >= 15) return 'bg-green-700 text-white';
  if (diffPercent >= 10) return 'bg-green-600 text-white';
  if (diffPercent >= 5) return 'bg-green-500 text-white';
  if (diffPercent >= 0) return 'bg-green-400 text-white';
  if (diffPercent >= -5) return 'bg-yellow-500 text-white';
  if (diffPercent >= -10) return 'bg-orange-500 text-white';
  if (diffPercent >= -15) return 'bg-red-400 text-white';
  if (diffPercent >= -25) return 'bg-red-500 text-white';
  return 'bg-red-600 text-white';
}

function formatCellValue(
  cell: CohortCell,
  viewMode: CohortViewMode,
  metricType: CohortMetricType
): string {
  if (viewMode === 'percentage') {
    return `${Math.round(cell.percentage)}%`;
  }
  if (metricType === 'logo_retention') {
    return cell.clientCount.toString();
  }
  return formatCurrency(cell.value);
}

function isOutlierCell(percentage: number, monthOffset: number): { isOutlier: boolean; direction: "up" | "down" } {
  if (monthOffset === 0) return { isOutlier: false, direction: "up" };
  
  const expected = getExpectedRetention(monthOffset);
  const diffPercent = ((percentage - expected) / expected) * 100;
  
  if (diffPercent > 20) return { isOutlier: true, direction: "up" };
  if (diffPercent < -20) return { isOutlier: true, direction: "down" };
  return { isOutlier: false, direction: "up" };
}

export default function Cohort() {
  usePageTitle("Cohort");
  useSetPageInfo("Cohort de Retenção", "Análise de retenção de clientes e receita por safra");
  
  const [viewMode, setViewMode] = useState<CohortViewMode>('percentage');
  const [metricType, setMetricType] = useState<CohortMetricType>('revenue_retention');
  const [drillDownData, setDrillDownData] = useState<{
    isOpen: boolean;
    row: CohortRow | null;
    monthOffset: number;
    cell: CohortCell | null;
  }>({
    isOpen: false,
    row: null,
    monthOffset: 0,
    cell: null,
  });

  const { data, isLoading, error } = useQuery<CohortData>({
    queryKey: ['/api/cohort', { metricType }],
  });

  const handleCellClick = (row: CohortRow, monthOffset: number, cell: CohortCell) => {
    setDrillDownData({
      isOpen: true,
      row,
      monthOffset,
      cell,
    });
  };

  const closeDrillDown = () => {
    setDrillDownData({
      isOpen: false,
      row: null,
      monthOffset: 0,
      cell: null,
    });
  };

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Erro ao carregar dados de cohort</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">
            {metricType === 'revenue_retention' ? 'Retenção de Receita' : 'Retenção de Clientes (Logo)'}
          </CardTitle>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button
                variant={metricType === 'revenue_retention' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMetricType('revenue_retention')}
                className="rounded-none"
                data-testid="button-metric-revenue"
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Receita
              </Button>
              <Button
                variant={metricType === 'logo_retention' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMetricType('logo_retention')}
                className="rounded-none"
                data-testid="button-metric-logo"
              >
                <Users className="h-4 w-4 mr-1" />
                Clientes
              </Button>
            </div>
            
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'percentage' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('percentage')}
                className="rounded-none"
                data-testid="button-view-percentage"
              >
                <Percent className="h-4 w-4 mr-1" />
                %
              </Button>
              <Button
                variant={viewMode === 'absolute' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('absolute')}
                className="rounded-none"
                data-testid="button-view-absolute"
              >
                <Hash className="h-4 w-4 mr-1" />
                Nº
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="flex gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-40" />
                ))}
              </div>
              <Skeleton className="h-96 w-full" />
            </div>
          ) : data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Users className="h-4 w-4" />
                    Total de Safras
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-total-cohorts">
                    {data.summary.totalCohorts}
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <TrendingUp className="h-4 w-4" />
                    Ret. M1
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-avg-m1">
                    {formatPercent(data.summary.avgRetentionM1, 0)}
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <TrendingUp className="h-4 w-4" />
                    Ret. M3
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-avg-m3">
                    {formatPercent(data.summary.avgRetentionM3, 0)}
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <TrendingUp className="h-4 w-4" />
                    Ret. M12
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-avg-m12">
                    {formatPercent(data.summary.avgRetentionM12, 0)}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm" data-testid="table-cohort">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-background border border-border px-3 py-2 text-left font-semibold min-w-[100px]">
                        Safra
                      </th>
                      <th className="border border-border px-3 py-2 text-center font-semibold bg-muted min-w-[70px]">
                        Base
                      </th>
                      {[...Array(data.maxMonthOffset + 1)].map((_, i) => (
                        <th 
                          key={i} 
                          className="border border-border px-3 py-2 text-center font-semibold min-w-[60px]"
                        >
                          <div>{i}</div>
                          {i > 0 && (
                            <div className="text-xs font-normal text-muted-foreground">
                              ({Math.round(getExpectedRetention(i))}%)
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, rowIndex) => (
                      <tr key={row.cohortMonth} data-testid={`row-cohort-${rowIndex}`}>
                        <td className="sticky left-0 z-10 bg-background border border-border px-3 py-2 font-medium whitespace-nowrap">
                          {row.cohortLabel}
                        </td>
                        <td className="border border-border px-3 py-2 text-center bg-muted font-medium">
                          {metricType === 'logo_retention' 
                            ? row.baselineClients 
                            : formatCurrency(row.baselineRevenue)
                          }
                        </td>
                        {[...Array(data.maxMonthOffset + 1)].map((_, monthOffset) => {
                          const cell = row.cells[monthOffset];
                          if (!cell) {
                            return (
                              <td 
                                key={monthOffset} 
                                className="border border-border px-3 py-2 text-center bg-muted/30"
                              />
                            );
                          }
                          const outlier = isOutlierCell(cell.percentage, monthOffset);
                          const expected = getExpectedRetention(monthOffset);
                          const deviation = monthOffset > 0 ? ((cell.percentage - expected) / expected * 100) : 0;
                          
                          return (
                            <td
                              key={monthOffset}
                              className={`border border-border px-1 py-1 text-center font-medium relative ${getCellColor(cell.percentage, monthOffset)}`}
                              data-testid={`cell-${rowIndex}-${monthOffset}`}
                            >
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <button
                                    onClick={() => handleCellClick(row, monthOffset, cell)}
                                    className="w-full h-full px-2 py-1 rounded hover:ring-2 hover:ring-white/50 cursor-pointer flex items-center justify-center gap-1"
                                    data-testid={`button-cell-${rowIndex}-${monthOffset}`}
                                  >
                                    {outlier.isOutlier && monthOffset > 0 && (
                                      outlier.direction === "down" ? (
                                        <AlertTriangle className="h-3 w-3" />
                                      ) : (
                                        <ArrowUp className="h-3 w-3" />
                                      )
                                    )}
                                    <span>{formatCellValue(cell, viewMode, metricType)}</span>
                                  </button>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-72" side="top" data-testid={`hover-cell-${rowIndex}-${monthOffset}`}>
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-semibold text-sm">{row.cohortLabel}</h4>
                                      <span className="text-xs text-muted-foreground">Mês {monthOffset}</span>
                                    </div>
                                    {outlier.isOutlier && monthOffset > 0 && (
                                      <div className={`p-2 rounded text-xs flex items-center gap-1 ${
                                        outlier.direction === "up" 
                                          ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                                          : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                                      }`}>
                                        {outlier.direction === "up" ? <ArrowUp className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                        {outlier.direction === "up" 
                                          ? "Retenção excepcional (+20%)" 
                                          : "Retenção crítica (-20%)"}
                                      </div>
                                    )}
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Retenção atual:</span>
                                        <span className="font-medium">{formatPercent(cell.percentage, 1)}</span>
                                      </div>
                                      {monthOffset > 0 && (
                                        <>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Esperado (benchmark):</span>
                                            <span className="font-medium">{formatPercent(expected, 1)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Desvio:</span>
                                            <span className={`font-medium ${deviation > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                              {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}%
                                            </span>
                                          </div>
                                        </>
                                      )}
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          {metricType === 'logo_retention' ? "Clientes:" : "Valor:"}
                                        </span>
                                        <span className="font-medium">
                                          {metricType === 'logo_retention' 
                                            ? cell.clientCount 
                                            : formatCurrency(cell.value)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Base inicial:</span>
                                        <span className="font-medium">
                                          {metricType === 'logo_retention' 
                                            ? row.baselineClients 
                                            : formatCurrency(row.baselineRevenue)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t border-border">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Info className="h-3 w-3" />
                                        Clique para ver detalhes da safra
                                      </p>
                                    </div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Card className="mt-6 bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Legenda e Interpretação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>Benchmark: Perda esperada de 8% por mês (curva natural de retenção)</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-green-600 flex items-center justify-center">
                        <ArrowUp className="h-3 w-3 text-white" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">Acima do esperado</span>
                        <span className="text-xs text-muted-foreground ml-1">(+15% ou mais)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded bg-green-400" />
                      <span className="text-sm">Levemente acima</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded bg-yellow-500" />
                      <span className="text-sm">Próximo do esperado</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded bg-orange-500" />
                      <span className="text-sm">Levemente abaixo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-red-600 flex items-center justify-center">
                        <AlertTriangle className="h-3 w-3 text-white" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">Abaixo do esperado</span>
                        <span className="text-xs text-muted-foreground ml-1">(-15% ou mais)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border">
                    <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <ArrowUp className="h-3 w-3 text-green-600" />
                        <span>Outlier positivo (+20%)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                        <span>Outlier negativo (-20%)</span>
                      </div>
                      <div>
                        <span>Clique nas células para ver detalhes</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={drillDownData.isOpen} onOpenChange={(open) => !open && closeDrillDown()}>
        <DialogContent className="max-w-lg" data-testid="dialog-cohort-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Detalhes da Safra - {drillDownData.row?.cohortLabel}
            </DialogTitle>
            <DialogDescription>
              Análise detalhada do mês {drillDownData.monthOffset}
            </DialogDescription>
          </DialogHeader>
          
          {drillDownData.row && drillDownData.cell && (
            <div className="space-y-4">
              {(() => {
                const outlier = isOutlierCell(drillDownData.cell.percentage, drillDownData.monthOffset);
                const expected = getExpectedRetention(drillDownData.monthOffset);
                const deviation = drillDownData.monthOffset > 0 
                  ? ((drillDownData.cell.percentage - expected) / expected * 100) 
                  : 0;
                
                return (
                  <>
                    {outlier.isOutlier && drillDownData.monthOffset > 0 && (
                      <div className={`p-3 rounded-lg flex items-center gap-2 ${
                        outlier.direction === "up" 
                          ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                          : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                      }`}>
                        {outlier.direction === "up" ? <ArrowUp className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        <span className="text-sm font-medium">
                          {outlier.direction === "up" 
                            ? "Esta safra apresenta retenção excepcional neste período" 
                            : "Esta safra apresenta retenção crítica - requer atenção"}
                        </span>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Retenção Atual</p>
                        <p className="text-2xl font-bold">
                          {formatPercent(drillDownData.cell.percentage, 1)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Esperado (Benchmark)</p>
                        <p className="text-2xl font-bold">
                          {drillDownData.monthOffset > 0 ? formatPercent(expected, 1) : "100%"}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {metricType === 'logo_retention' ? "Clientes Retidos" : "Valor Retido"}
                        </p>
                        <p className="text-2xl font-bold">
                          {metricType === 'logo_retention' 
                            ? drillDownData.cell.clientCount 
                            : formatCurrency(drillDownData.cell.value)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Desvio do Benchmark</p>
                        <p className={`text-2xl font-bold ${
                          deviation > 0 
                            ? "text-green-600 dark:text-green-400" 
                            : deviation < 0 
                            ? "text-red-600 dark:text-red-400"
                            : ""
                        }`}>
                          {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-border">
                      <h4 className="font-semibold text-sm mb-2">Informações da Safra</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mês de início:</span>
                          <span className="font-medium">{drillDownData.row.cohortMonth}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Base inicial (clientes):</span>
                          <span className="font-medium">{drillDownData.row.baselineClients}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Base inicial (valor):</span>
                          <span className="font-medium">{formatCurrency(drillDownData.row.baselineRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Meses desde início:</span>
                          <span className="font-medium">{drillDownData.monthOffset}</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
