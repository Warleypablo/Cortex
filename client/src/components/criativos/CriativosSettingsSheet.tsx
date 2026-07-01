import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Save, Trash2, RotateCcw, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetricRulesetWithThresholds } from "@shared/schema";
import { MetricFormattingContent } from "@/components/MetricFormattingSheet";
import {
  ALL_COLUMNS, type ColumnConfig, type SavedView, defaultConfig,
} from "@/lib/criativosColumns";

const COLUMN_BY_KEY = new Map(ALL_COLUMNS.map((c) => [c.key as string, c]));

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: ColumnConfig;
  onChangeConfig: (c: ColumnConfig) => void;
  // Preset da plataforma atual (padrão do time) — usado por "Restaurar padrão".
  resetConfig?: ColumnConfig;
  views: SavedView[];
  onChangeViews: (v: SavedView[]) => void;
  // Cores (formatação de métricas)
  metricRules: MetricRulesetWithThresholds[];
  produtos: string[];
  onSaveRule: (data: any) => void;
  isSavingRule: boolean;
}

let viewSeq = 0;

export function CriativosSettingsSheet({
  open, onOpenChange, config, onChangeConfig, resetConfig, views, onChangeViews,
  metricRules, produtos, onSaveRule, isSavingRule,
}: Props) {
  const [selectedViewId, setSelectedViewId] = useState<string>("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const visibleSet = new Set(config.visible);

  const toggleColumn = (key: string) => {
    const visible = visibleSet.has(key)
      ? config.visible.filter((k) => k !== key)
      : [...config.visible, key];
    onChangeConfig({ ...config, visible });
  };

  const setAll = (on: boolean) => {
    onChangeConfig({ ...config, visible: on ? ALL_COLUMNS.map((c) => c.key as string) : [] });
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const order = [...config.order];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    onChangeConfig({ ...config, order });
  };

  // ── Views ──
  const applyView = (id: string) => {
    setSelectedViewId(id);
    if (id === "") return;
    const v = views.find((x) => x.id === id);
    if (v) onChangeConfig({ ...v.config });
  };
  const saveAsView = () => {
    const name = window.prompt("Nome da visualização:");
    if (!name) return;
    const id = `view-${Date.now()}-${viewSeq++}`;
    const next = [...views, { id, name, config: { ...config } }];
    onChangeViews(next);
    setSelectedViewId(id);
  };
  const updateView = () => {
    if (!selectedViewId) return;
    onChangeViews(views.map((v) => (v.id === selectedViewId ? { ...v, config: { ...config } } : v)));
  };
  const deleteView = () => {
    if (!selectedViewId) return;
    onChangeViews(views.filter((v) => v.id !== selectedViewId));
    setSelectedViewId("");
  };
  const restoreDefault = () => {
    // Volta ao PADRÃO DO TIME da plataforma atual (não ao default global).
    onChangeConfig(resetConfig ?? defaultConfig());
    setSelectedViewId("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurações da tabela</SheetTitle>
          <SheetDescription>Personalize as colunas e as cores das métricas</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="colunas" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="colunas" className="flex-1">Colunas</TabsTrigger>
            <TabsTrigger value="cores" className="flex-1">Cores</TabsTrigger>
          </TabsList>

          <TabsContent value="colunas" className="mt-4 space-y-4">
            {/* Visualizações salvas */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visualização</div>
              <div className="flex items-center gap-2">
                <Select value={selectedViewId} onValueChange={applyView}>
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue placeholder="Padrão" />
                  </SelectTrigger>
                  <SelectContent>
                    {views.length === 0 && <SelectItem value="__none" disabled>Nenhuma salva</SelectItem>}
                    {views.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8" onClick={saveAsView} title="Salvar como nova visualização">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Salvar
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={updateView} disabled={!selectedViewId}>
                  <Save className="w-3.5 h-3.5 mr-1" /> Atualizar
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 dark:text-red-400" onClick={deleteView} disabled={!selectedViewId}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={restoreDefault}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar padrão
                </Button>
              </div>
            </div>

            {/* Ações de seleção */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{config.visible.length} de {ALL_COLUMNS.length} colunas</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAll(true)}>Marcar todas</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAll(false)}>Limpar</Button>
              </div>
            </div>

            {/* Lista ordenável de colunas */}
            <div className="border border-border rounded-md divide-y divide-border max-h-[calc(100vh-340px)] overflow-y-auto">
              {config.order.map((key, idx) => {
                const def = COLUMN_BY_KEY.get(key);
                if (!def) return null;
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragIndex !== null) reorder(dragIndex, idx); setDragIndex(null); }}
                    onDragEnd={() => setDragIndex(null)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 text-xs bg-card",
                      dragIndex === idx && "opacity-50",
                    )}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab shrink-0" />
                    <Checkbox
                      checked={visibleSet.has(key)}
                      onCheckedChange={() => toggleColumn(key)}
                      aria-label={def.label}
                    />
                    <span className="flex-1 truncate">{def.label}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{def.group}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">Arraste pela alça para reordenar. A largura de cada coluna é ajustável direto na tabela.</p>
          </TabsContent>

          <TabsContent value="cores" className="mt-4">
            <MetricFormattingContent
              metricRules={metricRules}
              produtos={produtos}
              onSave={onSaveRule}
              isSaving={isSavingRule}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
