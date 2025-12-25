import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { CohortData, CohortViewMode, CohortMetricType, CohortCell } from "@shared/schema";
import { Users, DollarSign, TrendingUp, Percent, Hash } from "lucide-react";

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

export default function Cohort() {
  useSetPageInfo("Cohort de Retenção", "Análise de retenção de clientes e receita por safra");
  
  const [viewMode, setViewMode] = useState<CohortViewMode>('percentage');
  const [metricType, setMetricType] = useState<CohortMetricType>('revenue_retention');

  const { data, isLoading, error } = useQuery<CohortData>({
    queryKey: ['/api/cohort', { metricType }],
  });

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
                          return (
                            <td
                              key={monthOffset}
                              className={`border border-border px-3 py-2 text-center font-medium ${getCellColor(cell.percentage, monthOffset)}`}
                              data-testid={`cell-${rowIndex}-${monthOffset}`}
                              title={monthOffset > 0 ? `Esperado: ${Math.round(getExpectedRetention(monthOffset))}%` : undefined}
                            >
                              {formatCellValue(cell, viewMode, metricType)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-4">
                <div className="flex items-center gap-2">
                  <span>Legenda (vs esperado -8%/mês):</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-600" />
                  <span>Acima do esperado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-yellow-500" />
                  <span>Próximo do esperado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span>Abaixo do esperado</span>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
