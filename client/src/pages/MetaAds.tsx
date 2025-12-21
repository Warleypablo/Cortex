import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { DollarSign, Eye, MousePointer, Users, TrendingUp, Target, Smartphone, Filter, X, CalendarIcon } from "lucide-react";
import { usePageInfo } from "@/contexts/PageContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MetaOverview, CampaignPerformance, AdsetPerformance, AdPerformance, ConversionFunnel, MetaLeadFilters } from "@shared/schema";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  "campaigns": { title: "Meta Ads - Campanhas", subtitle: "Performance de campanhas Meta" },
  "adsets": { title: "Meta Ads - Conjuntos de Anúncios", subtitle: "Performance de conjuntos de anúncios" },
  "ads": { title: "Meta Ads - Anúncios", subtitle: "Performance de anúncios individuais" },
};

export default function MetaAds() {
  const { setPageInfo } = usePageInfo();
  const queryClient = useQueryClient();
  
  const [periodo, setPeriodo] = useState<string>("30");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedUtmSources, setSelectedUtmSources] = useState<string[]>([]);
  const [selectedUtmCampaigns, setSelectedUtmCampaigns] = useState<string[]>([]);
  const [selectedUtmTerms, setSelectedUtmTerms] = useState<string[]>([]);
  
  // Drill-down navigation states
  const [activeTab, setActiveTab] = useState<string>("campaigns");
  const [drilldownCampaignId, setDrilldownCampaignId] = useState<string | null>(null);
  const [drilldownCampaignName, setDrilldownCampaignName] = useState<string | null>(null);
  const [drilldownAdsetId, setDrilldownAdsetId] = useState<string | null>(null);
  const [drilldownAdsetName, setDrilldownAdsetName] = useState<string | null>(null);

  useEffect(() => {
    const { title, subtitle } = TAB_TITLES[activeTab] || TAB_TITLES["campaigns"];
    setPageInfo(title, subtitle);
  }, [activeTab, setPageInfo]);

  // Busca o range de datas disponível no banco
  const { data: dataRange } = useQuery<{ minDate: string; maxDate: string }>({
    queryKey: ['/api/meta-ads/date-range'],
    queryFn: async () => {
      const response = await fetch('/api/meta-ads/date-range');
      if (!response.ok) throw new Error('Failed to fetch date range');
      return response.json();
    },
  });

  // Busca as opções de filtros de leads
  const { data: leadFilters } = useQuery<MetaLeadFilters>({
    queryKey: ['/api/meta-ads/filtros-leads'],
    queryFn: async () => {
      const response = await fetch('/api/meta-ads/filtros-leads');
      if (!response.ok) throw new Error('Failed to fetch lead filters');
      return response.json();
    },
  });

  // Função auxiliar para construir query params com filtros
  const buildQueryParams = (startDate: string, endDate: string) => {
    const params = new URLSearchParams();
    params.append('startDate', startDate);
    params.append('endDate', endDate);

    // Append each value individually for array-style query params
    selectedCategories.forEach(category => params.append('categoryNames', category));
    selectedStages.forEach(stage => params.append('stageNames', stage));
    selectedUtmSources.forEach(source => params.append('utmSources', source));
    selectedUtmCampaigns.forEach(campaign => params.append('utmCampaigns', campaign));
    selectedUtmTerms.forEach(term => params.append('utmTerms', term));

    const queryString = params.toString();
    return queryString || '';
  };

  // Limpar todos os filtros
  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedStages([]);
    setSelectedUtmSources([]);
    setSelectedUtmCampaigns([]);
    setSelectedUtmTerms([]);
  };

  // Drill-down navigation handlers
  const handleCampaignClick = (campaignId: string, campaignName: string) => {
    // Force refetch BEFORE updating state - invalidate all adset queries using prefix match
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const firstKey = query.queryKey[0];
        return typeof firstKey === 'string' && firstKey === '/api/meta-ads/adsets';
      }
    });
    
    // Clear adset selection when selecting a new (or same) campaign
    setDrilldownAdsetId(null);
    setDrilldownAdsetName(null);
    setDrilldownCampaignId(campaignId);
    setDrilldownCampaignName(campaignName);
    setActiveTab("adsets");
  };

  const handleAdsetClick = (adsetId: string, adsetName: string) => {
    // Force refetch BEFORE updating state - invalidate all ads queries using prefix match
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const firstKey = query.queryKey[0];
        return typeof firstKey === 'string' && firstKey === '/api/meta-ads/ads';
      }
    });
    
    setDrilldownAdsetId(adsetId);
    setDrilldownAdsetName(adsetName);
    setActiveTab("ads");
  };

  const clearDrilldown = () => {
    setDrilldownCampaignId(null);
    setDrilldownCampaignName(null);
    setDrilldownAdsetId(null);
    setDrilldownAdsetName(null);
    setActiveTab("campaigns");
  };

  // Conta total de filtros ativos
  const activeFiltersCount = selectedCategories.length + selectedStages.length + 
    selectedUtmSources.length + selectedUtmCampaigns.length + selectedUtmTerms.length;

  const getDateRange = () => {
    // Se modo custom estiver selecionado e datas estiverem definidas
    if (periodo === "custom" && customDateRange?.from) {
      return {
        startDate: format(customDateRange.from, 'yyyy-MM-dd'),
        endDate: customDateRange.to ? format(customDateRange.to, 'yyyy-MM-dd') : format(customDateRange.from, 'yyyy-MM-dd')
      };
    }
    
    // Usa a última data disponível como referência ao invés de "hoje"
    const endDate = dataRange?.maxDate ? new Date(dataRange.maxDate) : new Date();
    const startDate = new Date(endDate);
    
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
    queryKey: ['/api/meta-ads/overview', dateRange.startDate, dateRange.endDate, selectedCategories, selectedStages, selectedUtmSources, selectedUtmCampaigns, selectedUtmTerms],
    queryFn: async () => {
      const queryParams = buildQueryParams(dateRange.startDate, dateRange.endDate);
      const response = await fetch(`/api/meta-ads/overview?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch overview');
      return response.json();
    },
  });

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery<CampaignPerformance[]>({
    queryKey: ['/api/meta-ads/campaigns', dateRange.startDate, dateRange.endDate, selectedCategories, selectedStages, selectedUtmSources, selectedUtmCampaigns, selectedUtmTerms],
    queryFn: async () => {
      const queryParams = buildQueryParams(dateRange.startDate, dateRange.endDate);
      const response = await fetch(`/api/meta-ads/campaigns?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      return response.json();
    },
  });

  const { data: adsets, isLoading: isLoadingAdsets } = useQuery<AdsetPerformance[]>({
    queryKey: ['/api/meta-ads/adsets', dateRange.startDate, dateRange.endDate, selectedCategories, selectedStages, selectedUtmSources, selectedUtmCampaigns, selectedUtmTerms, drilldownCampaignId],
    queryFn: async () => {
      // Only fetch if campaign is selected (drill-down prerequisite)
      if (!drilldownCampaignId) {
        return [];
      }
      const queryParams = buildQueryParams(dateRange.startDate, dateRange.endDate);
      const campaignParam = `&campaignId=${drilldownCampaignId}`;
      const response = await fetch(`/api/meta-ads/adsets?${queryParams}${campaignParam}`);
      if (!response.ok) throw new Error('Failed to fetch adsets');
      return response.json();
    },
    enabled: !!drilldownCampaignId, // Only run query when campaign is selected
  });

  const { data: ads, isLoading: isLoadingAds } = useQuery<AdPerformance[]>({
    queryKey: ['/api/meta-ads/ads', dateRange.startDate, dateRange.endDate, selectedCategories, selectedStages, selectedUtmSources, selectedUtmCampaigns, selectedUtmTerms, drilldownAdsetId],
    queryFn: async () => {
      // Only fetch if adset is selected (drill-down prerequisite)
      if (!drilldownAdsetId) {
        return [];
      }
      const queryParams = buildQueryParams(dateRange.startDate, dateRange.endDate);
      const adsetParam = `&adsetId=${drilldownAdsetId}`;
      const response = await fetch(`/api/meta-ads/ads?${queryParams}${adsetParam}`);
      if (!response.ok) throw new Error('Failed to fetch ads');
      return response.json();
    },
    enabled: !!drilldownAdsetId, // Only run query when adset is selected
  });

  const { data: funnel, isLoading: isLoadingFunnel } = useQuery<ConversionFunnel>({
    queryKey: ['/api/meta-ads/funnel', dateRange.startDate, dateRange.endDate, selectedCategories, selectedStages, selectedUtmSources, selectedUtmCampaigns, selectedUtmTerms],
    queryFn: async () => {
      const queryParams = buildQueryParams(dateRange.startDate, dateRange.endDate);
      const response = await fetch(`/api/meta-ads/funnel?${queryParams}`);
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Período de Análise</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {periodo === "custom" && customDateRange?.from
                  ? `${format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} até ${customDateRange.to ? format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR }) : format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })}`
                  : periodo === "365" 
                    ? "Último ano"
                    : `Últimos ${periodo} dias`
                }
              </p>
            </div>
            <Select value={periodo} onValueChange={(value) => {
              setPeriodo(value);
              // Limpar customDateRange se mudar para período predefinido
              if (value !== "custom") {
                setCustomDateRange(undefined);
              }
            }}>
              <SelectTrigger className="w-[180px]" data-testid="select-periodo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Date Range Picker - só aparece quando período = custom */}
            {periodo === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[280px] justify-start text-left font-normal"
                    data-testid="button-date-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange?.from ? (
                      customDateRange.to ? (
                        <>
                          {format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                          {format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                        </>
                      ) : (
                        format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione o período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    numberOfMonths={2}
                    disabled={(date) => {
                      // Não permite datas futuras
                      const maxDate = dataRange?.maxDate ? new Date(dataRange.maxDate) : new Date();
                      return date > maxDate;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Filtros de Leads */}
          <Card className="mt-6" data-testid="card-filtros-leads">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtros de Conversões CRM
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Filtre as métricas de conversão (leads, vendas, ROAS). Não afeta métricas Meta (gasto, impressões)
                  </CardDescription>
                </div>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    data-testid="button-limpar-filtros"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {/* Filtro de Categoria */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-filtro-categoria">
                      Categoria
                      {selectedCategories.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedCategories.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar categoria..." />
                      <CommandEmpty>Nenhuma categoria encontrada</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {leadFilters?.categories.map((category) => (
                          <CommandItem
                            key={category}
                            onSelect={() => {
                              setSelectedCategories(prev =>
                                prev.includes(category)
                                  ? prev.filter(c => c !== category)
                                  : [...prev, category]
                              );
                            }}
                          >
                            <Checkbox
                              checked={selectedCategories.includes(category)}
                              className="mr-2"
                            />
                            <span>{category}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Filtro de Estágio */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-filtro-estagio">
                      Estágio
                      {selectedStages.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedStages.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar estágio..." />
                      <CommandEmpty>Nenhum estágio encontrado</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {leadFilters?.stages.map((stage) => (
                          <CommandItem
                            key={stage}
                            onSelect={() => {
                              setSelectedStages(prev =>
                                prev.includes(stage)
                                  ? prev.filter(s => s !== stage)
                                  : [...prev, stage]
                              );
                            }}
                          >
                            <Checkbox
                              checked={selectedStages.includes(stage)}
                              className="mr-2"
                            />
                            <span>{stage}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Filtro de UTM Source */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-filtro-utm-source">
                      UTM Source
                      {selectedUtmSources.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedUtmSources.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar source..." />
                      <CommandEmpty>Nenhum source encontrado</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {leadFilters?.utmSources.map((source) => (
                          <CommandItem
                            key={source}
                            onSelect={() => {
                              setSelectedUtmSources(prev =>
                                prev.includes(source)
                                  ? prev.filter(s => s !== source)
                                  : [...prev, source]
                              );
                            }}
                          >
                            <Checkbox
                              checked={selectedUtmSources.includes(source)}
                              className="mr-2"
                            />
                            <span>{source}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Filtro de Campanha */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-filtro-campanha">
                      Campanha
                      {selectedUtmCampaigns.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedUtmCampaigns.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar campanha..." />
                      <CommandEmpty>Nenhuma campanha encontrada</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {leadFilters?.utmCampaigns.map((campaign) => (
                          <CommandItem
                            key={campaign.id}
                            onSelect={() => {
                              setSelectedUtmCampaigns(prev =>
                                prev.includes(campaign.id)
                                  ? prev.filter(c => c !== campaign.id)
                                  : [...prev, campaign.id]
                              );
                            }}
                          >
                            <Checkbox
                              checked={selectedUtmCampaigns.includes(campaign.id)}
                              className="mr-2"
                            />
                            <span className="text-sm">{campaign.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Filtro de Conjunto de Anúncios */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-filtro-conjunto">
                      Conjunto de Anúncios
                      {selectedUtmTerms.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedUtmTerms.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar conjunto..." />
                      <CommandEmpty>Nenhum conjunto encontrado</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {leadFilters?.utmTerms.map((term) => (
                          <CommandItem
                            key={term.id}
                            onSelect={() => {
                              setSelectedUtmTerms(prev =>
                                prev.includes(term.id)
                                  ? prev.filter(t => t !== term.id)
                                  : [...prev, term.id]
                              );
                            }}
                          >
                            <Checkbox
                              checked={selectedUtmTerms.includes(term.id)}
                              className="mr-2"
                            />
                            <span className="text-sm">{term.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Badges de filtros ativos */}
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  {selectedCategories.map(category => (
                    <Badge key={category} variant="secondary" className="gap-1">
                      {category}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => setSelectedCategories(prev => prev.filter(c => c !== category))}
                      />
                    </Badge>
                  ))}
                  {selectedStages.map(stage => (
                    <Badge key={stage} variant="secondary" className="gap-1">
                      {stage}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => setSelectedStages(prev => prev.filter(s => s !== stage))}
                      />
                    </Badge>
                  ))}
                  {selectedUtmSources.map(source => (
                    <Badge key={source} variant="secondary" className="gap-1">
                      Source: {source}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => setSelectedUtmSources(prev => prev.filter(s => s !== source))}
                      />
                    </Badge>
                  ))}
                  {selectedUtmCampaigns.map(campaignId => {
                    const campaign = leadFilters?.utmCampaigns.find(c => c.id === campaignId);
                    return (
                      <Badge key={campaignId} variant="secondary" className="gap-1">
                        Camp: {campaign?.name || campaignId}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => setSelectedUtmCampaigns(prev => prev.filter(c => c !== campaignId))}
                        />
                      </Badge>
                    );
                  })}
                  {selectedUtmTerms.map(termId => {
                    const term = leadFilters?.utmTerms.find(t => t.id === termId);
                    return (
                      <Badge key={termId} variant="secondary" className="gap-1">
                        Conjunto: {term?.name || termId}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => setSelectedUtmTerms(prev => prev.filter(t => t !== termId))}
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
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
            <CardDescription>Performance por campanha, conjunto de anúncios e anúncios</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Breadcrumb Navigation */}
            {(drilldownCampaignId || drilldownAdsetId) && (
              <div className="flex items-center gap-2 mb-4 text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearDrilldown}
                  data-testid="button-breadcrumb-all"
                >
                  Todas as Campanhas
                </Button>
                {drilldownCampaignId && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDrilldownAdsetId(null);
                        setDrilldownAdsetName(null);
                        setActiveTab("adsets");
                      }}
                      data-testid="button-breadcrumb-campaign"
                    >
                      {drilldownCampaignName}
                    </Button>
                  </>
                )}
                {drilldownAdsetId && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-medium">{drilldownAdsetName}</span>
                  </>
                )}
              </div>
            )}
            
            <Tabs value={activeTab} onValueChange={(value) => {
              // Enforce hierarchy: can only switch to adsets if campaign selected, ads if adset selected
              if (value === "adsets" && !drilldownCampaignId) {
                // Prevent switching to adsets without a campaign selected
                return;
              }
              if (value === "ads" && !drilldownAdsetId) {
                // Prevent switching to ads without an adset selected
                return;
              }
              setActiveTab(value);
            }}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campanhas</TabsTrigger>
                <TabsTrigger 
                  value="adsets" 
                  data-testid="tab-adsets"
                  disabled={!drilldownCampaignId}
                >
                  Conjuntos
                </TabsTrigger>
                <TabsTrigger 
                  value="ads" 
                  data-testid="tab-ads"
                  disabled={!drilldownAdsetId}
                >
                  Anúncios
                </TabsTrigger>
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
                          <TableHead>Status</TableHead>
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
                          <TableRow 
                            key={campaign.campaignId} 
                            data-testid={`row-campaign-${campaign.campaignId}`}
                            onClick={() => handleCampaignClick(campaign.campaignId, campaign.campaignName)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                            <TableCell>
                              <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {campaign.status || 'N/A'}
                              </Badge>
                            </TableCell>
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
                          <TableHead>Status</TableHead>
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
                          <TableRow 
                            key={adset.adsetId} 
                            data-testid={`row-adset-${adset.adsetId}`}
                            onClick={() => handleAdsetClick(adset.adsetId, adset.adsetName)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell className="font-medium">{adset.adsetName}</TableCell>
                            <TableCell>{adset.campaignName}</TableCell>
                            <TableCell>
                              <Badge variant={adset.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {adset.status || 'N/A'}
                              </Badge>
                            </TableCell>
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
                              {!drilldownCampaignId 
                                ? "Selecione uma campanha na aba Campanhas para ver os conjuntos de anúncios"
                                : "Nenhum conjunto de anúncios encontrado para esta campanha no período selecionado"
                              }
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
                          <TableHead>Status</TableHead>
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
                            <TableCell>
                              <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {ad.status || 'N/A'}
                              </Badge>
                            </TableCell>
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
                            <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                              {!drilldownAdsetId 
                                ? "Selecione um conjunto de anúncios na aba Conjuntos para ver os anúncios"
                                : "Nenhum anúncio encontrado para este conjunto no período selecionado"
                              }
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
