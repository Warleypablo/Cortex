import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Eye, MousePointer, Users, TrendingUp, Target, Smartphone, Image, Video } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { useQuery } from "@tanstack/react-query";
import type { MetaOverview, CampaignPerformance, AdsetPerformance, AdPerformance, CreativePerformance, ConversionFunnel } from "@shared/schema";

export default function MetaAds() {
  const [periodo, setPeriodo] = useState<string>("30");

  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch(periodo) {
      case "7":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90":
        startDate.setDate(endDate.getDate() - 90);
        break;
      case "365":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  const dateRange = getDateRange();

  const { data: overview, isLoading: isLoadingOverview } = useQuery<MetaOverview>({
    queryKey: ['/api/meta-ads/overview', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const response = await fetch(`/api/meta-ads/overview?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!response.ok) throw new Error('Failed to fetch overview');
      return response.json();
    },
  });

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery<CampaignPerformance[]>({
    queryKey: ['/api/meta-ads/campaigns', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const response = await fetch(`/api/meta-ads/campaigns?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      return response.json();
    },
  });

  const { data: adsets, isLoading: isLoadingAdsets } = useQuery<AdsetPerformance[]>({
    queryKey: ['/api/meta-ads/adsets', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const response = await fetch(`/api/meta-ads/adsets?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!response.ok) throw new Error('Failed to fetch adsets');
      return response.json();
    },
  });

  const { data: ads, isLoading: isLoadingAds } = useQuery<AdPerformance[]>({
    queryKey: ['/api/meta-ads/ads', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const response = await fetch(`/api/meta-ads/ads?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!response.ok) throw new Error('Failed to fetch ads');
      return response.json();
    },
  });

  const { data: creatives, isLoading: isLoadingCreatives } = useQuery<CreativePerformance[]>({
    queryKey: ['/api/meta-ads/creatives', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const response = await fetch(`/api/meta-ads/creatives?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!response.ok) throw new Error('Failed to fetch creatives');
      return response.json();
    },
  });

  const { data: funnel, isLoading: isLoadingFunnel } = useQuery<ConversionFunnel>({
    queryKey: ['/api/meta-ads/funnel', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const response = await fetch(`/api/meta-ads/funnel?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!response.ok) throw new Error('Failed to fetch funnel');
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const funnelData = funnel ? [
    { name: 'Impressões', value: funnel.impressions, fill: '#3b82f6' },
    { name: 'Cliques', value: funnel.clicks, fill: '#8b5cf6' },
    { name: 'Leads', value: funnel.leads, fill: '#10b981' },
    { name: 'Negócios Ganhos', value: funnel.won, fill: '#f59e0b' },
  ] : [];

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-title">Meta Ads Analytics</h1>
          <p className="text-muted-foreground">Análise de performance de campanhas Meta integrada com conversões reais do CRM</p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Período de Análise</h2>
              <p className="text-sm text-muted-foreground mt-1">Últimos {periodo} dias</p>
            </div>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[180px]" data-testid="select-periodo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="card-gastos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoadingOverview ? "..." : formatCurrency(overview?.totalSpend || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">Investimento em anúncios</p>
            </CardContent>
          </Card>

          <Card data-testid="card-impressoes">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Impressões</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoadingOverview ? "..." : formatNumber(overview?.totalImpressions || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">CPM: {formatCurrency(overview?.avgCpm || 0)}</p>
            </CardContent>
          </Card>

          <Card data-testid="card-cliques">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cliques</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoadingOverview ? "..." : formatNumber(overview?.totalClicks || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">CTR: {formatPercent(overview?.avgCtr || 0)} | CPC: {formatCurrency(overview?.avgCpc || 0)}</p>
            </CardContent>
          </Card>

          <Card data-testid="card-leads">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Gerados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoadingOverview ? "..." : formatNumber(overview?.totalLeads || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">Custo/Lead: {formatCurrency(overview?.costPerLead || 0)}</p>
            </CardContent>
          </Card>

          <Card data-testid="card-won">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negócios Ganhos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoadingOverview ? "..." : formatNumber(overview?.totalWon || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">Taxa de conversão: {formatPercent(overview?.conversionRate || 0)}</p>
            </CardContent>
          </Card>

          <Card data-testid="card-valor-won">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total WON</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoadingOverview ? "..." : formatCurrency(overview?.totalWonValue || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">Receita gerada</p>
            </CardContent>
          </Card>

          <Card data-testid="card-roas" className="border-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROAS Real</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{isLoadingOverview ? "..." : (overview?.roas || 0).toFixed(2)}x</div>
              <p className="text-xs text-muted-foreground mt-1">Retorno sobre investimento</p>
            </CardContent>
          </Card>

          <Card data-testid="card-cac">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CAC</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoadingOverview ? "..." : formatCurrency(overview?.cac || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">Custo de aquisição</p>
            </CardContent>
          </Card>
        </div>

        {/* Funil de Conversão */}
        <Card className="mb-8" data-testid="card-funil">
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
            <CardDescription>Jornada completa: Impressões → Cliques → Leads → Negócios Ganhos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFunnel ? (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={funnelData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => formatNumber(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="flex flex-col justify-center space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Impressões → Cliques</p>
                      <p className="text-2xl font-bold">{formatPercent(funnel?.clickRate || 0)}</p>
                    </div>
                    <MousePointer className="h-8 w-8 text-blue-500" />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Cliques → Leads</p>
                      <p className="text-2xl font-bold">{formatPercent(funnel?.leadRate || 0)}</p>
                    </div>
                    <Users className="h-8 w-8 text-green-500" />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">Leads → Negócios Ganhos</p>
                      <p className="text-2xl font-bold">{formatPercent(funnel?.wonRate || 0)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-orange-500" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Análises Detalhadas */}
        <Card data-testid="card-analises">
          <CardHeader>
            <CardTitle>Análises Detalhadas</CardTitle>
            <CardDescription>Performance por campanha, conjunto de anúncios, anúncios e criativos</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="campaigns">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campanhas</TabsTrigger>
                <TabsTrigger value="adsets" data-testid="tab-adsets">Conjuntos</TabsTrigger>
                <TabsTrigger value="ads" data-testid="tab-ads">Anúncios</TabsTrigger>
                <TabsTrigger value="creatives" data-testid="tab-creatives">Criativos</TabsTrigger>
              </TabsList>

              <TabsContent value="campaigns" className="mt-6">
                {isLoadingCampaigns ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Objetivo</TableHead>
                          <TableHead className="text-right">Gasto</TableHead>
                          <TableHead className="text-right">Impressões</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">CPC</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">WON</TableHead>
                          <TableHead className="text-right">Valor WON</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                          <TableHead className="text-right">Conv. %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(campaigns || []).map((campaign) => (
                          <TableRow key={campaign.campaignId} data-testid={`row-campaign-${campaign.campaignId}`}>
                            <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                            <TableCell>{campaign.objective || '-'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.spend)}</TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.impressions)}</TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.clicks)}</TableCell>
                            <TableCell className="text-right">{formatPercent(campaign.ctr)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.cpc)}</TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.leads)}</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(campaign.won)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(campaign.wonValue)}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{campaign.roas.toFixed(2)}x</TableCell>
                            <TableCell className="text-right">{formatPercent(campaign.conversionRate)}</TableCell>
                          </TableRow>
                        ))}
                        {(campaigns || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                              Nenhuma campanha encontrada no período selecionado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="adsets" className="mt-6">
                {isLoadingAdsets ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Conjunto de Anúncios</TableHead>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Objetivo</TableHead>
                          <TableHead className="text-right">Gasto</TableHead>
                          <TableHead className="text-right">Impressões</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">WON</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                          <TableHead className="text-right">Conv. %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(adsets || []).map((adset) => (
                          <TableRow key={adset.adsetId} data-testid={`row-adset-${adset.adsetId}`}>
                            <TableCell className="font-medium">{adset.adsetName}</TableCell>
                            <TableCell>{adset.campaignName}</TableCell>
                            <TableCell className="text-sm">{adset.optimizationGoal || '-'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(adset.spend)}</TableCell>
                            <TableCell className="text-right">{formatNumber(adset.impressions)}</TableCell>
                            <TableCell className="text-right">{formatNumber(adset.clicks)}</TableCell>
                            <TableCell className="text-right">{formatPercent(adset.ctr)}</TableCell>
                            <TableCell className="text-right">{formatNumber(adset.leads)}</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(adset.won)}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{adset.roas.toFixed(2)}x</TableCell>
                            <TableCell className="text-right">{formatPercent(adset.conversionRate)}</TableCell>
                          </TableRow>
                        ))}
                        {(adsets || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                              Nenhum conjunto de anúncios encontrado no período selecionado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ads" className="mt-6">
                {isLoadingAds ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anúncio</TableHead>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Conjunto</TableHead>
                          <TableHead className="text-right">Gasto</TableHead>
                          <TableHead className="text-right">Impressões</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">WON</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                          <TableHead className="text-right">Conv. %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(ads || []).map((ad) => (
                          <TableRow key={ad.adId} data-testid={`row-ad-${ad.adId}`}>
                            <TableCell className="font-medium">{ad.adName}</TableCell>
                            <TableCell>{ad.campaignName}</TableCell>
                            <TableCell>{ad.adsetName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(ad.spend)}</TableCell>
                            <TableCell className="text-right">{formatNumber(ad.impressions)}</TableCell>
                            <TableCell className="text-right">{formatNumber(ad.clicks)}</TableCell>
                            <TableCell className="text-right">{formatPercent(ad.ctr)}</TableCell>
                            <TableCell className="text-right">{formatNumber(ad.leads)}</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(ad.won)}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{ad.roas.toFixed(2)}x</TableCell>
                            <TableCell className="text-right">{formatPercent(ad.conversionRate)}</TableCell>
                          </TableRow>
                        ))}
                        {(ads || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                              Nenhum anúncio encontrado no período selecionado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="creatives" className="mt-6">
                {isLoadingCreatives ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Criativo</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Anúncios</TableHead>
                          <TableHead className="text-right">Gasto</TableHead>
                          <TableHead className="text-right">Impressões</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Video 25%</TableHead>
                          <TableHead className="text-right">Video 100%</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">WON</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(creatives || []).map((creative) => (
                          <TableRow key={creative.creativeId} data-testid={`row-creative-${creative.creativeId}`}>
                            <TableCell className="font-medium">{creative.title || creative.creativeName || '-'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {creative.objectType === 'VIDEO' || creative.videoUrl ? (
                                  <>
                                    <Video className="h-4 w-4 text-purple-500" />
                                    <span className="text-sm">Vídeo</span>
                                  </>
                                ) : (
                                  <>
                                    <Image className="h-4 w-4 text-blue-500" />
                                    <span className="text-sm">Imagem</span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatNumber(creative.totalAds)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(creative.spend)}</TableCell>
                            <TableCell className="text-right">{formatNumber(creative.impressions)}</TableCell>
                            <TableCell className="text-right">{formatNumber(creative.clicks)}</TableCell>
                            <TableCell className="text-right">{formatPercent(creative.ctr)}</TableCell>
                            <TableCell className="text-right">{formatNumber(creative.videoP25)}</TableCell>
                            <TableCell className="text-right">{formatNumber(creative.videoP100)}</TableCell>
                            <TableCell className="text-right">{formatNumber(creative.leads)}</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(creative.won)}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{creative.roas.toFixed(2)}x</TableCell>
                          </TableRow>
                        ))}
                        {(creatives || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                              Nenhum criativo encontrado no período selecionado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
