import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, Loader2, Copy, Download, AlertCircle, ArrowLeftRight } from "lucide-react";
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
  deriveInboundMetrics,
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

// Order of sections when rendering all of them (no platform filter applied)
const ALL_SECTIONS = ['inbound', 'meta_ads', 'google_ads', 'instagram', 'youtube', 'linkedin'];

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
  const [selectedProdutos, setSelectedProdutos] = useState<string[]>([]);
  const [selectedPlataformas, setSelectedPlataformas] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<{ metricId: string; month: string; section: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showBaseAnualDialog, setShowBaseAnualDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showCopyCombinationDialog, setShowCopyCombinationDialog] = useState(false);
  const [showTier3, setShowTier3] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Sections to render in sequence: empty platform filter = all (inbound + every platform);
  // otherwise just the selected platforms.
  const visibleSections = useMemo(() => {
    if (selectedPlataformas.length === 0) return ALL_SECTIONS;
    return selectedPlataformas;
  }, [selectedPlataformas]);

  const currentFunil = selectedProdutos.length === 1 ? selectedProdutos[0] : 'todos';
  // Editing only allowed when at most 1 product selected (each table edits its own segment)
  const canEdit = selectedProdutos.length <= 1;

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

  // Compute derived inbound metric values (for metrics without budget storage)
  const computedInboundValues = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const month of ALL_MONTHS) {
      const monthValues: Record<string, number> = {};
      const inboundMetrics = SECTION_METRICS.inbound?.metrics || [];
      for (const m of inboundMetrics) {
        if (m.isSubHeader) continue;
        monthValues[m.id] = getCellValue(m.id, month);
      }
      deriveInboundMetrics(monthValues);
      result[month] = monthValues;
    }
    return result;
  }, [getCellValue]);

  // Compute derived channel values for each platform section
  // Shape: { [section]: { [month]: { [metricId]: value } } }
  const computedChannelValues = useMemo(() => {
    const result: Record<string, Record<string, Record<string, number>>> = {};
    for (const section of visibleSections) {
      if (section === 'inbound') continue;
      const formula = CHANNEL_DERIVED_FORMULAS[section];
      if (!formula) continue;
      const sectionMetrics = SECTION_METRICS[section]?.metrics || [];
      const sectionResult: Record<string, Record<string, number>> = {};
      for (const month of ALL_MONTHS) {
        const tier1Inputs: Record<string, number> = {};
        for (const m of sectionMetrics) {
          if (m.tier !== 1 || m.isSubHeader) continue;
          const mapping = METRIC_BUDGET_MAP[m.id];
          if (!mapping) continue;
          tier1Inputs[mapping.key] = getCellValue(m.id, month);
        }
        const derived = formula(tier1Inputs);
        const monthDerived: Record<string, number> = {};
        for (const m of sectionMetrics) {
          if (m.tier !== 2) continue;
          const mapping = METRIC_BUDGET_MAP[m.id];
          if (mapping && derived[mapping.key] !== undefined) {
            monthDerived[m.id] = derived[mapping.key];
          }
        }
        sectionResult[month] = monthDerived;
      }
      result[section] = sectionResult;
    }
    return result;
  }, [visibleSections, getCellValue]);

  // Get the display value for a cell (uses computed values for derived metrics)
  const getDisplayValue = useCallback((metricId: string, month: string, section: string): number => {
    // Inbound section: derived metrics (no budget mapping) come from inbound formula engine
    if (section === 'inbound' && !METRIC_BUDGET_MAP[metricId] && computedInboundValues[month]?.[metricId] !== undefined) {
      return computedInboundValues[month][metricId];
    }
    // Platform sections: Tier 2 metrics come from the channel formula
    if (section !== 'inbound' && computedChannelValues[section]?.[month]?.[metricId] !== undefined) {
      return computedChannelValues[section][month][metricId];
    }
    return getCellValue(metricId, month);
  }, [computedInboundValues, computedChannelValues, getCellValue]);

  // Format cell display value
  const formatCellValue = useCallback((value: number, metricId: string, fmt: 'currency' | 'number' | 'percent'): string => {
    if (value === 0) return '-';
    return formatValue(value, fmt);
  }, []);

  // Check if a metric is editable within its section
  const isCellEditable = useCallback((metricId: string, section: string): boolean => {
    if (!METRIC_BUDGET_MAP[metricId]) return false;
    // For platform sections, only Tier 1 metrics are editable (Tier 2 are derived)
    if (section !== 'inbound') {
      const sectionMetrics = SECTION_METRICS[section]?.metrics || [];
      const metricConfig = sectionMetrics.find(m => m.id === metricId);
      if (metricConfig?.tier && metricConfig.tier !== 1) return false;
    }
    return true;
  }, []);

  // Start editing a cell
  const startEditing = useCallback((metricId: string, month: string, section: string) => {
    if (!canEdit || !isCellEditable(metricId, section)) return;
    const value = getDisplayValue(metricId, month, section);
    const displayValue = PERCENT_METRICS.has(metricId) ? (value * 100) : value;
    setEditingCell({ metricId, month, section });
    setEditValue(displayValue === 0 ? '' : String(displayValue));
  }, [canEdit, getDisplayValue, isCellEditable]);

  // Save a single cell (and derived Tier 2 values for platform sections)
  const saveCell = useCallback(async (metricId: string, month: string, rawValue: string, section: string) => {
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

      // For platform sections with Tier 1 metrics, also compute and save Tier 2 derived values
      if (section !== 'inbound') {
        const formula = CHANNEL_DERIVED_FORMULAS[section];
        const sectionMetrics = SECTION_METRICS[section]?.metrics || [];
        const metricConfig = sectionMetrics.find(m => m.id === metricId);

        if (formula && metricConfig?.tier === 1) {
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
  }, [selectedYear, currentFunil, yearBudgets, queryClient, getCellValue]);

  // Handle cell navigation (Tab, Enter, Escape)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, metricId: string, month: string, section: string) => {
    const sectionMetrics = SECTION_METRICS[section]?.metrics || [];
    const monthIdx = ALL_MONTHS.indexOf(month);
    const metricIdx = sectionMetrics.findIndex(m => m.id === metricId);

    if (e.key === 'Escape') {
      setEditingCell(null);
      return;
    }

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      saveCell(metricId, month, editValue, section);

      if (e.key === 'Tab') {
        const nextMonth = ALL_MONTHS[monthIdx + 1];
        if (nextMonth) {
          startEditing(metricId, nextMonth, section);
        } else {
          setEditingCell(null);
        }
      } else {
        const nextMetric = sectionMetrics.slice(metricIdx + 1).find(m => !m.isSubHeader && isCellEditable(m.id, section));
        if (nextMetric) {
          startEditing(nextMetric.id, month, section);
        } else {
          setEditingCell(null);
        }
      }
    }
  }, [editValue, saveCell, startEditing, isCellEditable]);

  // Handle blur (auto-save)
  const handleBlur = useCallback(() => {
    if (editingCell) {
      saveCell(editingCell.metricId, editingCell.month, editValue, editingCell.section);
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

  // Check if a metric has any non-zero values across all months
  const hasAnyValue = useCallback((metricId: string, section: string): boolean => {
    return ALL_MONTHS.some(m => getDisplayValue(metricId, m, section) !== 0);
  }, [getDisplayValue]);

  // Compute annual total/average for a metric
  const getAnnualSummary = useCallback((metricId: string, fmt: 'currency' | 'number' | 'percent', section: string): string => {
    const values = ALL_MONTHS.map(m => getDisplayValue(metricId, m, section));
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

  // Section currently targeted by dialog actions (Definir Base Anual / Copiar Metas / Copiar de Outra Combinação)
  const [dialogSection, setDialogSection] = useState<string>('inbound');
  const dialogIsPorCanal = dialogSection !== 'inbound';
  const dialogSectionMetrics = SECTION_METRICS[dialogSection]?.metrics || [];

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
        {(isLoading || isSaving) && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
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
      </div>

      {/* Stacked section tables */}
      {visibleSections.map(section => {
        const sectionCfg = SECTION_METRICS[section];
        if (!sectionCfg) return null;
        const sectionMetrics = sectionCfg.metrics;
        const isPlatformSection = section !== 'inbound';
        const sectionCompanyLevel = isPlatformSection && PLATFORM_SCOPE[section] === 'company';
        const hasTier3InSection = isPlatformSection && sectionMetrics.some(m => m.tier === 3);
        const sectionLabel = section === 'inbound'
          ? 'Visão Consolidada'
          : (PLATFORM_MULTISELECT_OPTIONS.find(o => o.value === section)?.label || sectionCfg.label);

        const openBaseAnual = () => { setDialogSection(section); setShowBaseAnualDialog(true); };
        const openCopyMetas = () => { setDialogSection(section); setShowCopyDialog(true); };
        const openCopyCombination = () => { setDialogSection(section); setShowCopyCombinationDialog(true); };

        return (
          <Card key={section} className="border bg-card overflow-hidden">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  {sectionLabel}
                  {sectionCompanyLevel && (
                    <span className="text-[10px] font-normal text-muted-foreground px-2 py-0.5 rounded bg-muted/50">Company-level</span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={openBaseAnual} disabled={!canEdit} title={!canEdit ? 'Selecione no máximo um produto' : undefined}>
                    <Copy className="w-4 h-4 mr-2" />
                    Definir Base Anual
                  </Button>
                  <Button variant="outline" size="sm" onClick={openCopyMetas} disabled={!canEdit} title={!canEdit ? 'Selecione no máximo um produto' : undefined}>
                    <Download className="w-4 h-4 mr-2" />
                    Copiar Metas de Outro Mês
                  </Button>
                  {isPlatformSection && (
                    <Button variant="outline" size="sm" onClick={openCopyCombination} disabled={!canEdit} title={!canEdit ? 'Selecione no máximo um produto' : undefined}>
                      <ArrowLeftRight className="w-4 h-4 mr-2" />
                      Copiar de Outra Combinação
                    </Button>
                  )}
                </div>
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
                    {sectionMetrics.map((metric) => {
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

                      const hasTier = isPlatformSection && metric.tier;
                      if (hasTier && metric.tier === 3 && !showTier3) return null;

                      const filled = hasAnyValue(metric.id, section);
                      const isTier2 = hasTier && metric.tier === 2;
                      const isTier3 = hasTier && metric.tier === 3;
                      const editable = isCellEditable(metric.id, section);

                      return (
                        <tr
                          key={metric.id}
                          className={cn(
                            "border-b hover:bg-muted/20 transition-colors",
                            !isPlatformSection && !filled && "bg-amber-500/5",
                            isPlatformSection && !filled && !isTier2 && !isTier3 && "bg-amber-500/5",
                            isTier2 && "bg-blue-500/[0.04] dark:bg-blue-400/[0.03]",
                            isTier3 && "bg-muted/10 opacity-70"
                          )}
                        >
                          <td className={cn(
                            "px-4 py-2 text-sm font-medium sticky left-0 z-10 border-r",
                            isTier2 ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-card"
                          )}>
                            <div className="flex items-center gap-2">
                              {!isPlatformSection && !filled && (
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                              {isPlatformSection && !filled && !isTier2 && !isTier3 && (
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                              <span className={cn(
                                !isPlatformSection && !filled && "text-muted-foreground",
                                isPlatformSection && !filled && !isTier2 && !isTier3 && "text-muted-foreground",
                                isTier2 && "italic text-blue-600 dark:text-blue-400"
                              )}>
                                {metric.name}
                              </span>
                            </div>
                          </td>
                          {ALL_MONTHS.map(month => {
                            const value = getDisplayValue(metric.id, month, section);
                            const isEditing = editingCell?.metricId === metric.id && editingCell?.month === month && editingCell?.section === section;
                            const showDerivedStyle = isTier2;

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
                                onClick={() => editable && !isEditing && startEditing(metric.id, month, section)}
                              >
                                {isEditing ? (
                                  <input
                                    ref={inputRef}
                                    type="number"
                                    step={PERCENT_METRICS.has(metric.id) ? '0.01' : metric.format === 'currency' ? '0.01' : '1'}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, metric.id, month, section)}
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
                            {getAnnualSummary(metric.id, metric.format, section)}
                          </td>
                        </tr>
                      );
                    })}
                    {hasTier3InSection && (
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
        );
      })}

      {/* Definir Base Anual Dialog */}
      <DefinirBaseAnualDialog
        open={showBaseAnualDialog}
        onOpenChange={setShowBaseAnualDialog}
        metrics={dialogSectionMetrics}
        selectedYear={selectedYear}
        selectedFunil={currentFunil}
        isPorCanal={dialogIsPorCanal}
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
        targetCanal={dialogIsPorCanal ? dialogSection : 'meta_ads'}
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
