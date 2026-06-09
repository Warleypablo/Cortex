import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Save, Loader2 } from "lucide-react";
import type { MetricRulesetWithThresholds } from "@shared/schema";
import { AVAILABLE_METRICS } from "@/lib/metricFormatting";

const COLOR_OPTIONS = [
  { value: "green", label: "Verde", className: "bg-green-500" },
  { value: "yellow", label: "Amarelo", className: "bg-yellow-500" },
  { value: "red", label: "Vermelho", className: "bg-red-500" },
  { value: "blue", label: "Azul", className: "bg-blue-500" },
  { value: "default", label: "Padrão", className: "bg-zinc-500" },
];

interface ThresholdRow {
  minValue: string;
  maxValue: string;
  color: string;
  label: string;
}

interface MetricFormattingContentProps {
  metricRules: MetricRulesetWithThresholds[];
  produtos: string[];
  onSave: (data: {
    metricKey: string;
    displayLabel: string;
    thresholds: ThresholdRow[];
    produto?: string | null;
    plataforma?: string | null;
  }) => void;
  isSaving: boolean;
}

interface MetricFormattingSheetProps extends MetricFormattingContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Corpo da configuração de cores — usado dentro de um Sheet ou de abas. */
export function MetricFormattingContent({
  metricRules,
  produtos,
  onSave,
  isSaving,
}: MetricFormattingContentProps) {
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [selectedProduto, setSelectedProduto] = useState<string>("all");
  const [selectedPlataforma, setSelectedPlataforma] = useState<string>("all");
  const [displayLabel, setDisplayLabel] = useState("");
  const [thresholds, setThresholds] = useState<ThresholdRow[]>([
    { minValue: "", maxValue: "", color: "green", label: "Bom" },
    { minValue: "", maxValue: "", color: "yellow", label: "Médio" },
    { minValue: "", maxValue: "", color: "red", label: "Ruim" },
  ]);

  const loadRule = (metricKey: string) => {
    setSelectedMetric(metricKey);
    const rule = metricRules.find(
      (r) =>
        r.metricKey === metricKey &&
        (selectedProduto === "all" ? !r.produto : r.produto === selectedProduto) &&
        (selectedPlataforma === "all" ? !r.plataforma : r.plataforma === selectedPlataforma)
    ) || metricRules.find((r) => r.metricKey === metricKey);

    const metricDef = AVAILABLE_METRICS.find((m) => m.key === metricKey);

    if (rule) {
      setDisplayLabel(rule.displayLabel || metricDef?.label || metricKey);
      setThresholds(
        rule.thresholds.length > 0
          ? rule.thresholds.map((t) => ({
              minValue: t.minValue?.toString() || "",
              maxValue: t.maxValue?.toString() || "",
              color: t.color,
              label: t.label || "",
            }))
          : [{ minValue: "", maxValue: "", color: "green", label: "Bom" }]
      );
    } else {
      setDisplayLabel(metricDef?.label || metricKey);
      setThresholds([
        { minValue: "", maxValue: "", color: "green", label: "Bom" },
        { minValue: "", maxValue: "", color: "yellow", label: "Médio" },
        { minValue: "", maxValue: "", color: "red", label: "Ruim" },
      ]);
    }
  };

  const addThreshold = () => {
    setThresholds([...thresholds, { minValue: "", maxValue: "", color: "default", label: "" }]);
  };

  const removeThreshold = (index: number) => {
    setThresholds(thresholds.filter((_, i) => i !== index));
  };

  const updateThreshold = (index: number, field: keyof ThresholdRow, value: string) => {
    const updated = [...thresholds];
    updated[index] = { ...updated[index], [field]: value };
    setThresholds(updated);
  };

  const handleSave = () => {
    if (!selectedMetric) return;
    onSave({
      metricKey: selectedMetric,
      displayLabel,
      thresholds,
      produto: selectedProduto === "all" ? null : selectedProduto,
      plataforma: selectedPlataforma === "all" ? null : selectedPlataforma,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Métrica</Label>
        <Select value={selectedMetric} onValueChange={loadRule}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma métrica" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={selectedProduto} onValueChange={setSelectedProduto}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {produtos.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={selectedPlataforma} onValueChange={setSelectedPlataforma}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="meta">Meta</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedMetric && (
            <>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={displayLabel} onChange={(e) => setDisplayLabel(e.target.value)} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Faixas</Label>
                  <Button variant="outline" size="sm" onClick={addThreshold}>
                    <Plus className="h-3 w-3 mr-1" /> Faixa
                  </Button>
                </div>

                {thresholds.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded border dark:border-zinc-700">
                    <Input
                      placeholder="Min"
                      value={t.minValue}
                      onChange={(e) => updateThreshold(i, "minValue", e.target.value)}
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground">—</span>
                    <Input
                      placeholder="Max"
                      value={t.maxValue}
                      onChange={(e) => updateThreshold(i, "maxValue", e.target.value)}
                      className="w-20"
                    />
                    <Select value={t.color} onValueChange={(v) => updateThreshold(i, "color", v)}>
                      <SelectTrigger className="w-24">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${COLOR_OPTIONS.find((c) => c.value === t.color)?.className || "bg-zinc-500"}`} />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2.5 h-2.5 rounded-full ${c.className}`} />
                              {c.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Label"
                      value={t.label}
                      onChange={(e) => updateThreshold(i, "label", e.target.value)}
                      className="w-20"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeThreshold(i)} className="h-8 w-8 shrink-0">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </>
      )}
    </div>
  );
}

export function MetricFormattingSheet({ open, onOpenChange, ...content }: MetricFormattingSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Formatação de Métricas</SheetTitle>
          <SheetDescription>Configure cores e faixas para as métricas dos criativos</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <MetricFormattingContent {...content} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
