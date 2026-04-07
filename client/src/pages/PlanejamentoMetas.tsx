import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarRange, Loader2, Copy, Download, AlertCircle, FlaskConical, Check, X, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  CANAL_OPTIONS,
  PLATFORM_MULTISELECT_OPTIONS,
  METRIC_BUDGET_MAP,
  PERCENT_METRICS,
  SEGMENT_DEFAULTS,
  SECTION_METRICS,
  MONTH_NAMES,
  MONTH_NAMES_FULL,
  formatValue,
  SIMULATION_INPUT_METRICS,
  SIMULATION_DERIVED_METRICS,
  simulateMonth,
  PLATFORM_SCOPE,
  CHANNEL_DERIVED_FORMULAS,
  type MetricDisplayConfig,
} from "@/lib/metasBudgetConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

const HIDDEN_PRODUCTS = new Set(['(Vazio)', 'Odonto', 'IFV', 'Bootcamp Vendas', 'Bootcamp Performance', '[Bootcamp Performance]']);

// Map section keys to their segment(s) for budget lookup
const SECTION_TO_SEGMENTS: Record<string, string[]> = {
  ads: ['ads'],
  mql: ['mql'],
  nao_mql: ['nao_mql'],
  meta_ads: ['meta_ads'],
  google_ads: ['google_ads'],
  instagram: ['instagram'],
  youtube: ['youtube'],
  linkedin: ['linkedin'],
};

export default function PlanejamentoMetas() {
  usePageTitle("Planejamento de Metas");
  useSetPageInfo("Planejamento de Metas", "Visão anual de targets de marketing e vendas");

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [activeTab, setActiveTab] = useState<'inbound' | 'por_canal'>('inbound');
  const [selectedProdutos, setSelectedProdutos] = useState<string[]>([]);
  const [selectedPlataformas, setSelectedPlataformas] = useState<string[]>(['meta_ads']);
  const [editingCell, setEditingCell] = useState<{ metricId: string; month: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showBaseAnualDialog, setShowBaseAnualDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showCopyCombinationDialog, setShowCopyCombinationDialog] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [simValues, setSimValues] = useState<Record<string, Record<string, number>>>({});
  const [showTier3, setShowTier3] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Derive the current section and funil based on active tab
  const currentSection = activeTab === 'inbound' ? 'inbound'
    : selectedPlataformas.length === 1 ? selectedPlataformas[0] : (selectedPlataformas[0] || 'meta_ads');
  const currentFunil = selectedProdutos.length === 1 ? selectedProdutos[0] : 'todos';
  // Editing only allowed when at most 1 product and 1 platform selected
  const canEdit = selectedProdutos.length <= 1 && selectedPlataformas.length <= 1;
  // Company-level platforms don't have product filters
  const isCompanyLevel = activeTab === 'por_canal' && PLATFORM_SCOPE[currentSection] === 'company';

  // Fetch available funnels (products)
  const { data: funis } = useQuery<string[]>({
    queryKey: ['/api/growth/orcado-realizado/funis'],
    queryFn: async () => {
      const res = await fetch('/api/growth/orcado-realizado/funis', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch funis');
      return res.json();
    },
  });

  // Fetch all 12 months of budgets
  const { data: yearBudgets, isLoading } = useQuery<Record<string, Record<string, any>>>({
    queryKey: ['/api/growth/orcado-realizado/budgets/year', selectedYear, currentFunil],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/budgets/year?year=${selectedYear}&funil=${currentFunil}`, { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  // Get the current section's metrics
  const sectionConfig = SECTION_METRICS[currentSection];
  const metrics = sectionConfig?.metrics || [];

  // Get cell value from yearBudgets
  const getCellValue = useCallback((metricId: string, month: string): number => {
    const mapping = METRIC_BUDGET_MAP[metricId];
    if (!mapping) return 0;

    const monthKey = `${selectedYear}-${month}`;
    const segmentData = yearBudgets?.[monthKey]?.[mapping.segment];
    if (segmentData && segmentData[mapping.key] !== undefined) {
      return segmentData[mapping.key];
    }

    // Fallback to defaults
    const defaults = SEGMENT_DEFAULTS[mapping.segment];
    return defaults?.[mapping.key] ?? 0;
  }, [yearBudgets, selectedYear]);

  // ===== Simulation Mode =====

  // Initialize simulation values from current budgets
  const enterSimulation = useCallback(() => {
    const initial: Record<string, Record<string, number>> = {};
    for (const month of ALL_MONTHS) {
      const monthValues: Record<string, number> = {};
      // Load all Inbound metrics for this month
      const inboundMetrics = SECTION_METRICS.inbound?.metrics || [];
      for (const m of inboundMetrics) {
        if (m.isSubHeader) continue;
        monthValues[m.id] = getCellValue(m.id, month);
      }
      // Run simulation to fill derived values
      simulateMonth(monthValues);
      initial[month] = monthValues;
    }
    setSimValues(initial);
    setSimulationMode(true);
  }, [getCellValue]);

  const exitSimulation = useCallback(() => {
    setSimulationMode(false);
    setSimValues({});
    setEditingCell(null);
  }, []);

  // Update a simulation input and recalculate derived metrics for that month
  const updateSimValue = useCallback((metricId: string, month: string, rawValue: string) => {
    let value = parseFloat(rawValue) || 0;
    if (PERCENT_METRICS.has(metricId)) value = value / 100;

    setSimValues(prev => {
      const monthValues = { ...prev[month], [metricId]: value };
      simulateMonth(monthValues);
      return { ...prev, [month]: monthValues };
    });
  }, []);

  // Apply simulation: save all simulated values as budgets
  const applySimulation = useCallback(async () => {
    setIsSaving(true);
    try {
      const inboundMetrics = (SECTION_METRICS.inbound?.metrics || []).filter(m => !m.isSubHeader);

      for (const month of ALL_MONTHS) {
        const monthData = simValues[month];
        if (!monthData) continue;

        // Group by segment
        const segments: Record<string, Record<string, number>> = {};
        for (const m of inboundMetrics) {
          const mapping = METRIC_BUDGET_MAP[m.id];
          if (!mapping || monthData[m.id] === undefined) continue;
          if (!segments[mapping.segment]) segments[mapping.segment] = {};
          segments[mapping.segment][mapping.key] = monthData[m.id];
        }

        // Save each segment
        const mes = `${selectedYear}-${month}`;
        await Promise.all(
          Object.entries(segments).map(([segmento, metricas]) =>
            fetch('/api/growth/orcado-realizado/budgets', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mes, segmento, funil: currentFunil, metricas }),
            })
          )
        );
      }

      queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets/year'] });
      queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets'] });
      exitSimulation();
    } catch (error) {
      console.error('Failed to apply simulation:', error);
    } finally {
      setIsSaving(false);
    }
  }, [simValues, selectedYear, currentFunil, queryClient, exitSimulation]);

  // Compute derived inbound metric values (for metrics without budget storage)
  const computedInboundValues = useMemo(() => {
    if (activeTab !== 'inbound') return {};
    const result: Record<string, Record<string, number>> = {};
    for (const month of ALL_MONTHS) {
      const monthValues: Record<string, number> = {};
      const inboundMetrics = SECTION_METRICS.inbound?.metrics || [];
      for (const m of inboundMetrics) {
        if (m.isSubHeader) continue;
        monthValues[m.id] = getCellValue(m.id, month);
      }
      simulateMonth(monthValues);
      result[month] = monthValues;
    }
    return result;
  }, [activeTab, getCellValue]);

  // Compute derived channel values for Por Canal (Tier 2 auto-calculated from Tier 1)
  const computedChannelValues = useMemo(() => {
    if (activeTab !== 'por_canal') return {};
    const formula = CHANNEL_DERIVED_FORMULAS[currentSection];
    if (!formula) return {};

    const result: Record<string, Record<string, number>> = {};
    const sectionMetrics = SECTION_METRICS[currentSection]?.metrics || [];

    for (const month of ALL_MONTHS) {
      // Gather all Tier 1 values for this month (using JSONB keys)
      const tier1Inputs: Record<string, number> = {};
      for (const m of sectionMetrics) {
        if (m.tier !== 1 || m.isSubHeader) continue;
        const mapping = METRIC_BUDGET_MAP[m.id];
        if (!mapping) continue;
        tier1Inputs[mapping.key] = getCellValue(m.id, month);
      }
      // Compute derived values (returns JSONB keys)
      const derived = formula(tier1Inputs);
      // Map back to metric IDs
      const monthDerived: Record<string, number> = {};
      for (const m of sectionMetrics) {
        if (m.tier !== 2) continue;
        const mapping = METRIC_BUDGET_MAP[m.id];
        if (mapping && derived[mapping.key] !== undefined) {
          monthDerived[m.id] = derived[mapping.key];
        }
      }
      result[month] = monthDerived;
    }
    return result;
  }, [activeTab, currentSection, getCellValue]);

  // Get the display value for a cell (respects simulation mode and derived values)
  const getDisplayValue = useCallback((metricId: string, month: string): number => {
    if (simulationMode && simValues[month]?.[metricId] !== undefined) {
      return simValues[month][metricId];
    }
    // Use computed values for derived inbound metrics (no budget mapping)
    if (!METRIC_BUDGET_MAP[metricId] && computedInboundValues[month]?.[metricId] !== undefined) {
      return computedInboundValues[month][metricId];
    }
    // Use computed channel values for Tier 2 metrics in Por Canal
    if (activeTab === 'por_canal' && computedChannelValues[month]?.[metricId] !== undefined) {
      return computedChannelValues[month][metricId];
    }
    return getCellValue(metricId, month);
  }, [simulationMode, simValues, computedInboundValues, computedChannelValues, activeTab, getCellValue]);

  // Format cell display value
  const formatCellValue = useCallback((value: number, metricId: string, fmt: 'currency' | 'number' | 'percent'): string => {
    if (value === 0) return '-';
    return formatValue(value, fmt);
  }, []);

  // Check if a metric is editable in current mode
  const isCellEditable = useCallback((metricId: string): boolean => {
    // Derived metrics (no budget mapping) are never directly editable
    if (!METRIC_BUDGET_MAP[metricId]) return false;
    if (simulationMode) {
      // In simulation mode, only inputs are editable (not derived)
      return SIMULATION_INPUT_METRICS.has(metricId);
    }
    // In Por Canal, only Tier 1 metrics are editable
    if (activeTab === 'por_canal') {
      const sectionMetrics = SECTION_METRICS[currentSection]?.metrics || [];
      const metricConfig = sectionMetrics.find(m => m.id === metricId);
      if (metricConfig?.tier && metricConfig.tier !== 1) return false;
    }
    return true;
  }, [simulationMode, activeTab, currentSection]);

  // Start editing a cell
  const startEditing = useCallback((metricId: string, month: string) => {
    if (!canEdit || !isCellEditable(metricId)) return;
    const value = getDisplayValue(metricId, month);
    const displayValue = PERCENT_METRICS.has(metricId) ? (value * 100) : value;
    setEditingCell({ metricId, month });
    setEditValue(displayValue === 0 ? '' : String(displayValue));
  }, [getDisplayValue, isCellEditable]);

  // Save a single cell (and derived Tier 2 values for Por Canal)
  const saveCell = useCallback(async (metricId: string, month: string, rawValue: string) => {
    // In simulation mode, update sim values instead of saving to DB
    if (simulationMode) {
      updateSimValue(metricId, month, rawValue);
      return;
    }

    const mapping = METRIC_BUDGET_MAP[metricId];
    if (!mapping) return;

    let value = parseFloat(rawValue) || 0;
    if (PERCENT_METRICS.has(metricId)) value = value / 100;

    setIsSaving(true);
    try {
      const mes = `${selectedYear}-${month}`;
      const monthKey = mes;
      const existingSegment = yearBudgets?.[monthKey]?.[mapping.segment] || {};
      const updatedMetricas = { ...existingSegment, [mapping.key]: value };

      // For Por Canal with Tier 1 metrics, also compute and save Tier 2 derived values
      if (activeTab === 'por_canal') {
        const formula = CHANNEL_DERIVED_FORMULAS[currentSection];
        const sectionMetrics = SECTION_METRICS[currentSection]?.metrics || [];
        const metricConfig = sectionMetrics.find(m => m.id === metricId);

        if (formula && metricConfig?.tier === 1) {
          // Gather all current Tier 1 values, including the one being saved
          const tier1Inputs: Record<string, number> = {};
          for (const m of sectionMetrics) {
            if (m.tier !== 1 || m.isSubHeader) continue;
            const mMapping = METRIC_BUDGET_MAP[m.id];
            if (!mMapping) continue;
            if (m.id === metricId) {
              tier1Inputs[mMapping.key] = value;
            } else {
              tier1Inputs[mMapping.key] = getCellValue(m.id, month);
            }
          }
          // Compute derived values and merge into the save payload
          const derived = formula(tier1Inputs);
          Object.assign(updatedMetricas, derived);
        }
      }

      await fetch('/api/growth/orcado-realizado/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, segmento: mapping.segment, funil: currentFunil, metricas: updatedMetricas }),
      });

      queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets/year'] });
      queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets'] });
    } catch (error) {
      console.error('Failed to save cell:', error);
    } finally {
      setIsSaving(false);
    }
  }, [simulationMode, updateSimValue, selectedYear, currentFunil, yearBudgets, queryClient, activeTab, currentSection, getCellValue]);

  // Handle cell navigation (Tab, Enter, Escape)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, metricId: string, month: string) => {
    const monthIdx = ALL_MONTHS.indexOf(month);
    const metricIdx = metrics.findIndex(m => m.id === metricId);

    if (e.key === 'Escape') {
      setEditingCell(null);
      return;
    }

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      saveCell(metricId, month, editValue);

      if (e.key === 'Tab') {
        // Move to next month
        const nextMonth = ALL_MONTHS[monthIdx + 1];
        if (nextMonth) {
          startEditing(metricId, nextMonth);
        } else {
          setEditingCell(null);
        }
      } else {
        // Enter: move to next editable metric in same month (skip sub-headers & non-editable tiers)
        const nextMetric = metrics.slice(metricIdx + 1).find(m => !m.isSubHeader && isCellEditable(m.id));
        if (nextMetric) {
          startEditing(nextMetric.id, month);
        } else {
          setEditingCell(null);
        }
      }
    }
  }, [editValue, metrics, saveCell, startEditing]);

  // Handle blur (auto-save)
  const handleBlur = useCallback(() => {
    if (editingCell) {
      saveCell(editingCell.metricId, editingCell.month, editValue);
      setEditingCell(null);
    }
  }, [editingCell, editValue, saveCell]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Exit simulation when switching tabs
  useEffect(() => {
    if (activeTab !== 'inbound' && simulationMode) {
      exitSimulation();
    }
  }, [activeTab, simulationMode, exitSimulation]);

  // Check if a metric has any non-zero values across all months
  const hasAnyValue = useCallback((metricId: string): boolean => {
    return ALL_MONTHS.some(m => getDisplayValue(metricId, m) !== 0);
  }, [getDisplayValue]);

  // Compute annual total/average for a metric
  const getAnnualSummary = useCallback((metricId: string, fmt: 'currency' | 'number' | 'percent'): string => {
    const values = ALL_MONTHS.map(m => getDisplayValue(metricId, m));
    const nonZero = values.filter(v => v !== 0);
    if (nonZero.length === 0) return '-';

    if (fmt === 'percent') {
      const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
      return formatValue(avg, 'percent');
    }
    if (fmt === 'currency' && (metricId.includes('cpm') || metricId.includes('cpl') || metricId.includes('ticket') || metricId.includes('cac') || metricId.includes('aov'))) {
      // Rate-like currency metrics: show average
      const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
      return formatValue(avg, 'currency');
    }
    // Volume metrics: show sum
    const sum = values.reduce((a, b) => a + b, 0);
    return formatValue(sum, fmt);
  }, [getDisplayValue]);

  // Available years
  const years = useMemo(() => {
    const y = currentYear;
    return [String(y - 1), String(y), String(y + 1)];
  }, [currentYear]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarRange className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Planejamento de Metas</h1>
            <p className="text-muted-foreground text-sm">Defina targets anuais para marketing e vendas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {simulationMode ? (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                <FlaskConical className="w-3.5 h-3.5" />
                Modo Simulação
              </div>
              <Button size="sm" onClick={applySimulation} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Aplicar Simulação
              </Button>
              <Button variant="outline" size="sm" onClick={exitSimulation} disabled={isSaving}>
                <X className="w-4 h-4 mr-2" />
                Descartar
              </Button>
            </>
          ) : (
            <>
              {activeTab === 'inbound' && (
                <Button variant="outline" size="sm" onClick={enterSimulation} className="text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10">
                  <FlaskConical className="w-4 h-4 mr-2" />
                  Simular
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowBaseAnualDialog(true)} disabled={!canEdit} title={!canEdit ? 'Selecione apenas um produto e uma plataforma' : undefined}>
                <Copy className="w-4 h-4 mr-2" />
                Definir Base Anual
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCopyDialog(true)} disabled={!canEdit} title={!canEdit ? 'Selecione apenas um produto e uma plataforma' : undefined}>
                <Download className="w-4 h-4 mr-2" />
                Copiar Metas de Outro Mês
              </Button>
              {activeTab === 'por_canal' && (
                <Button variant="outline" size="sm" onClick={() => setShowCopyCombinationDialog(true)} disabled={!canEdit} title={!canEdit ? 'Selecione apenas um produto e uma plataforma' : undefined}>
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Copiar de Outra Combinação
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium mr-1">Ano:</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="h-5 w-px bg-border" />
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'inbound' | 'por_canal')}>
          <TabsList className="h-8">
            <TabsTrigger value="inbound" className="text-xs px-4">Inbound</TabsTrigger>
            <TabsTrigger value="por_canal" className="text-xs px-4">Por Canal</TabsTrigger>
          </TabsList>
        </Tabs>
        {activeTab === 'por_canal' && (
          <>
            <div className="h-5 w-px bg-border" />
            {!isCompanyLevel && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Produto:</span>
                <MultiSelect
                  options={(funis || []).filter(f => !HIDDEN_PRODUCTS.has(f)).map(f => ({ value: f, label: f }))}
                  selected={selectedProdutos}
                  onChange={setSelectedProdutos}
                  placeholder="Todos os Produtos"
                  className="w-[180px] text-xs"
                />
              </div>
            )}
            {isCompanyLevel && (
              <span className="text-[10px] text-muted-foreground px-2 py-1 rounded bg-muted/50">Company-level (sem filtro de produto)</span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">Plataforma:</span>
              <MultiSelect
                options={PLATFORM_MULTISELECT_OPTIONS}
                selected={selectedPlataformas}
                onChange={setSelectedPlataformas}
                placeholder="Todas as Plataformas"
                className="w-[180px] text-xs"
              />
            </div>
          </>
        )}
      </div>

      {/* Spreadsheet Table */}
      <Card className="border bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              {activeTab === 'inbound'
                ? 'Inbound — Visão Consolidada'
                : `${selectedPlataformas.map(p => PLATFORM_MULTISELECT_OPTIONS.find(o => o.value === p)?.label || p).join(', ') || 'Todas as Plataformas'}${selectedProdutos.length > 0 ? ` — ${selectedProdutos.join(', ')}` : ''}`
              }
            </CardTitle>
            {(isLoading || isSaving) && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3 sticky left-0 bg-muted/40 z-10 min-w-[200px]">
                    Métrica
                  </th>
                  {ALL_MONTHS.map(m => (
                    <th key={m} className="text-center text-xs font-semibold uppercase tracking-wide px-2 py-3 min-w-[100px]">
                      {MONTH_NAMES[m]}
                    </th>
                  ))}
                  <th className="text-center text-xs font-semibold uppercase tracking-wide px-3 py-3 min-w-[110px] bg-muted/60">
                    Ano
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => {
                  // Sub-header row (section separator)
                  if (metric.isSubHeader) {
                    return (
                      <tr key={metric.id} className="bg-muted/30 border-b">
                        <td
                          colSpan={ALL_MONTHS.length + 2}
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sticky left-0"
                        >
                          {metric.name}
                        </td>
                      </tr>
                    );
                  }

                  // In Por Canal: hide Tier 3 unless toggle is on
                  const isPorCanal = activeTab === 'por_canal';
                  const hasTier = isPorCanal && metric.tier;
                  if (hasTier && metric.tier === 3 && !showTier3) return null;

                  const filled = hasAnyValue(metric.id);
                  const isTier2 = hasTier && metric.tier === 2;
                  const isTier3 = hasTier && metric.tier === 3;
                  // For Inbound: keep original derived logic (only in simulation mode)
                  const isDerivedInbound = !isPorCanal && simulationMode && SIMULATION_DERIVED_METRICS.has(metric.id);
                  const editable = isCellEditable(metric.id);

                  return (
                    <tr
                      key={metric.id}
                      className={cn(
                        "border-b hover:bg-muted/20 transition-colors",
                        // Inbound: original amber highlight for unfilled
                        !isPorCanal && !filled && "bg-amber-500/5",
                        // Por Canal: amber only for unfilled Tier 1
                        isPorCanal && !filled && !isTier2 && !isTier3 && "bg-amber-500/5",
                        isTier2 && "bg-blue-500/[0.04] dark:bg-blue-400/[0.03]",
                        isTier3 && "bg-muted/10 opacity-70"
                      )}
                    >
                      <td className={cn(
                        "px-4 py-2 text-sm font-medium sticky left-0 z-10 border-r",
                        isTier2 ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-card"
                      )}>
                        <div className="flex items-center gap-2">
                          {/* Inbound: original alert icon for unfilled */}
                          {!isPorCanal && !filled && (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          {/* Por Canal: alert only for unfilled Tier 1 */}
                          {isPorCanal && !filled && !isTier2 && !isTier3 && (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className={cn(
                            // Inbound: original muted style for unfilled
                            !isPorCanal && !filled && "text-muted-foreground",
                            // Por Canal: tier-aware styling
                            isPorCanal && !filled && !isTier2 && !isTier3 && "text-muted-foreground",
                            (isTier2 || isDerivedInbound) && "italic text-blue-600 dark:text-blue-400"
                          )}>
                            {metric.name}
                          </span>
                        </div>
                      </td>
                      {ALL_MONTHS.map(month => {
                        const value = getDisplayValue(metric.id, month);
                        const isEditing = editingCell?.metricId === metric.id && editingCell?.month === month;
                        const showDerivedStyle = isTier2 || isDerivedInbound;

                        return (
                          <td
                            key={month}
                            className={cn(
                              "px-1 py-1 text-center transition-colors",
                              editable && !isEditing && "cursor-pointer hover:bg-primary/5",
                              !editable && "cursor-default",
                              showDerivedStyle && "bg-blue-500/5",
                              value === 0 && !isEditing && !showDerivedStyle && "text-muted-foreground/40"
                            )}
                            onClick={() => editable && !isEditing && startEditing(metric.id, month)}
                          >
                            {isEditing ? (
                              <input
                                ref={inputRef}
                                type="number"
                                step={PERCENT_METRICS.has(metric.id) ? '0.01' : metric.format === 'currency' ? '0.01' : '1'}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, metric.id, month)}
                                onBlur={handleBlur}
                                className="w-full px-2 py-1 text-center text-sm border-2 border-primary rounded bg-background text-foreground focus:outline-none focus:ring-0"
                              />
                            ) : (
                              <span className={cn(
                                "text-sm tabular-nums",
                                showDerivedStyle && "italic text-blue-600 dark:text-blue-400"
                              )}>
                                {formatCellValue(value, metric.id, metric.format)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums bg-muted/30 border-l">
                        {getAnnualSummary(metric.id, metric.format)}
                      </td>
                    </tr>
                  );
                })}
                {/* Tier 3 toggle row for Por Canal */}
                {activeTab === 'por_canal' && metrics.some(m => m.tier === 3) && (
                  <tr className="border-b">
                    <td
                      colSpan={ALL_MONTHS.length + 2}
                      className="px-4 py-2 sticky left-0"
                    >
                      <button
                        onClick={() => setShowTier3(!showTier3)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                      >
                        <span>{showTier3 ? '▾' : '▸'}</span>
                        <span>{showTier3 ? 'Ocultar métricas de acompanhamento' : 'Ver mais métricas (acompanhamento)'}</span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Definir Base Anual Dialog */}
      <DefinirBaseAnualDialog
        open={showBaseAnualDialog}
        onOpenChange={setShowBaseAnualDialog}
        metrics={metrics}
        selectedYear={selectedYear}
        selectedFunil={currentFunil}
        isPorCanal={activeTab === 'por_canal'}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets/year'] });
          queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets'] });
        }}
      />

      {/* Copiar Metas Dialog */}
      <CopiarMetasDialog
        open={showCopyDialog}
        onOpenChange={setShowCopyDialog}
        selectedYear={selectedYear}
        selectedFunil={currentFunil}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets/year'] });
          queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets'] });
        }}
      />

      {/* Copiar de Outra Combinação Dialog */}
      <CopiarCombinacaoDialog
        open={showCopyCombinationDialog}
        onOpenChange={setShowCopyCombinationDialog}
        selectedYear={selectedYear}
        targetProduto={selectedProdutos.length === 1 ? selectedProdutos[0] : 'todos'}
        targetCanal={selectedPlataformas.length === 1 ? selectedPlataformas[0] : 'meta_ads'}
        funis={funis || []}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets/year'] });
          queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets'] });
        }}
      />
    </div>
  );
}

// ===== Definir Base Anual Dialog =====

function DefinirBaseAnualDialog({
  open,
  onOpenChange,
  metrics,
  selectedYear,
  selectedFunil,
  isPorCanal,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: MetricDisplayConfig[];
  selectedYear: string;
  selectedFunil: string;
  isPorCanal?: boolean;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // In Por Canal mode, only show Tier 1 metrics
  const filteredMetrics = metrics.filter(m => !m.isSubHeader && (!isPorCanal || !m.tier || m.tier === 1));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const promises = Object.entries(values)
        .filter(([, v]) => v !== '' && parseFloat(v) !== 0)
        .map(([metricId, rawValue]) => {
          const mapping = METRIC_BUDGET_MAP[metricId];
          if (!mapping) return Promise.resolve();

          let value = parseFloat(rawValue) || 0;
          if (PERCENT_METRICS.has(metricId)) value = value / 100;

          return fetch('/api/growth/orcado-realizado/budgets/bulk-set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              year: parseInt(selectedYear),
              segment: mapping.segment,
              key: mapping.key,
              value,
              months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
              funil: selectedFunil,
            }),
          });
        });

      await Promise.all(promises);
      onSaved();
      onOpenChange(false);
      setValues({});
    } catch (error) {
      console.error('Failed to set base anual:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Definir Base Anual</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os valores que serão aplicados para todos os 12 meses de {selectedYear}.
            {isPorCanal && ' Métricas derivadas serão calculadas automaticamente.'}
            {' '}Deixe em branco para não alterar.
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {filteredMetrics.map(metric => (
            <div key={metric.id} className="flex items-center gap-3">
              <Label className="min-w-[160px] text-sm">{metric.name}</Label>
              <div className="flex items-center gap-1 flex-1">
                <Input
                  type="number"
                  step={PERCENT_METRICS.has(metric.id) ? '0.01' : '1'}
                  placeholder={metric.format === 'percent' ? '0.00' : '0'}
                  value={values[metric.id] ?? ''}
                  onChange={(e) => setValues(prev => ({ ...prev, [metric.id]: e.target.value }))}
                  className="h-8 text-sm"
                />
                {PERCENT_METRICS.has(metric.id) && <span className="text-xs text-muted-foreground">%</span>}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Aplicar para 12 meses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Copiar Metas Dialog =====

function CopiarMetasDialog({
  open,
  onOpenChange,
  selectedYear,
  selectedFunil,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedYear: string;
  selectedFunil: string;
  onSaved: () => void;
}) {
  const [sourceMonth, setSourceMonth] = useState('');
  const [targetMonths, setTargetMonths] = useState<string[]>([]);
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    if (!sourceMonth || targetMonths.length === 0) return;

    setIsCopying(true);
    try {
      const mesOrigem = `${selectedYear}-${sourceMonth}`;
      const promises = targetMonths.map(m => {
        const mesDestino = `${selectedYear}-${m}`;
        return fetch('/api/growth/orcado-realizado/budgets/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mesOrigem, mesDestino, funil: selectedFunil }),
        });
      });

      await Promise.all(promises);
      onSaved();
      onOpenChange(false);
      setSourceMonth('');
      setTargetMonths([]);
    } catch (error) {
      console.error('Failed to copy budgets:', error);
    } finally {
      setIsCopying(false);
    }
  };

  const toggleTargetMonth = (month: string) => {
    setTargetMonths(prev =>
      prev.includes(month)
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const selectAllTargets = () => {
    const available = ALL_MONTHS.filter(m => m !== sourceMonth);
    setTargetMonths(available);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar Metas</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Copie todos os valores de um mês para outros meses de {selectedYear}.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm mb-2 block">Mês de origem:</Label>
            <Select value={sourceMonth} onValueChange={(v) => { setSourceMonth(v); setTargetMonths([]); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {ALL_MONTHS.map(m => (
                  <SelectItem key={m} value={m}>{MONTH_NAMES_FULL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceMonth && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Copiar para:</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAllTargets}>
                  Selecionar todos
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ALL_MONTHS.filter(m => m !== sourceMonth).map(m => (
                  <button
                    key={m}
                    onClick={() => toggleTargetMonth(m)}
                    className={cn(
                      "px-3 py-2 rounded-md text-xs font-medium transition-all border",
                      targetMonths.includes(m)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                    )}
                  >
                    {MONTH_NAMES[m]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCopying}>
            Cancelar
          </Button>
          <Button onClick={handleCopy} disabled={isCopying || !sourceMonth || targetMonths.length === 0}>
            {isCopying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Copiar para {targetMonths.length} {targetMonths.length === 1 ? 'mês' : 'meses'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Copiar de Outra Combinação Dialog =====

function CopiarCombinacaoDialog({
  open,
  onOpenChange,
  selectedYear,
  targetProduto,
  targetCanal,
  funis,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedYear: string;
  targetProduto: string;
  targetCanal: string;
  funis: string[];
  onSaved: () => void;
}) {
  const [sourceProduto, setSourceProduto] = useState('todos');
  const [sourceCanal, setSourceCanal] = useState('meta_ads');
  const [copyMode, setCopyMode] = useState<'all' | 'rates_only'>('all');
  const [isCopying, setIsCopying] = useState(false);

  const targetCanalLabel = CANAL_OPTIONS.find(c => c.key === targetCanal)?.label || targetCanal;
  const targetProdutoLabel = targetProduto === 'todos' ? 'Todos os produtos' : targetProduto;

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      const res = await fetch('/api/growth/orcado-realizado/budgets/copy-combination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          sourceSegmento: sourceCanal,
          sourceFunil: sourceProduto,
          targetSegmento: targetCanal,
          targetFunil: targetProduto,
          mode: copyMode,
        }),
      });

      if (!res.ok) throw new Error('Failed to copy combination');

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to copy combination:', error);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar de Outra Combinação</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Copie as metas de 12 meses de outra combinação Produto × Canal para a seleção atual.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Origem:</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <span className="text-xs text-muted-foreground mb-1 block">Produto</span>
                <Select value={sourceProduto} onValueChange={setSourceProduto}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os produtos</SelectItem>
                    {funis.filter(f => !HIDDEN_PRODUCTS.has(f)).map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <span className="text-xs text-muted-foreground mb-1 block">Canal</span>
                <Select value={sourceCanal} onValueChange={setSourceCanal}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAL_OPTIONS.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Target (read-only) */}
          <div className="rounded-md bg-muted/50 p-3 border">
            <span className="text-xs text-muted-foreground font-medium">Destino:</span>
            <p className="text-sm font-medium mt-0.5">{targetProdutoLabel} × {targetCanalLabel}</p>
          </div>

          {/* Copy mode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Modo de cópia:</Label>
            <RadioGroup value={copyMode} onValueChange={(v) => setCopyMode(v as 'all' | 'rates_only')}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="all" id="copy-all" className="mt-0.5" />
                <div>
                  <Label htmlFor="copy-all" className="text-sm font-normal cursor-pointer">Copiar tudo</Label>
                  <p className="text-xs text-muted-foreground">Todas as métricas e volumes dos 12 meses</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="rates_only" id="copy-rates" className="mt-0.5" />
                <div>
                  <Label htmlFor="copy-rates" className="text-sm font-normal cursor-pointer">Copiar apenas taxas</Label>
                  <p className="text-xs text-muted-foreground">Só métricas de % (CTR, conversão, etc.) — volumes ficam para preencher manualmente</p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCopying}>
            Cancelar
          </Button>
          <Button onClick={handleCopy} disabled={isCopying}>
            {isCopying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
