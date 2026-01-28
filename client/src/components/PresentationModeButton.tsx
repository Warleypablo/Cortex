import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tv, Play, Handshake, BarChart3, DollarSign, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DashboardCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  dashboards: { id: string; label: string; description: string }[];
}

const DASHBOARD_CATEGORIES: DashboardCategory[] = [
  {
    id: "comercial",
    label: "Comercial",
    icon: Handshake,
    dashboards: [
      { id: "closers", label: "Closers", description: "Ranking e métricas de closers" },
      { id: "sdrs", label: "SDRs", description: "Ranking e métricas de SDRs" },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    icon: BarChart3,
    dashboards: [
      { id: "visao-geral", label: "Visão Geral", description: "MRR, clientes ativos e métricas gerais" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    dashboards: [
      { id: "financeiro-resumo", label: "Resumo Financeiro", description: "Receitas, despesas e saldo" },
      { id: "fluxo-caixa", label: "Fluxo de Caixa", description: "Projeção de entradas e saídas" },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    icon: TrendingUp,
    dashboards: [
      { id: "growth-visao-geral", label: "Performance Marketing", description: "ROI, CAC e métricas de anúncios" },
    ],
  },
];

const ALL_DASHBOARDS = DASHBOARD_CATEGORIES.flatMap(cat => cat.dashboards);

export default function PresentationModeButton() {
  const [open, setOpen] = useState(false);
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>(["closers", "sdrs"]);
  const [rotationInterval, setRotationInterval] = useState("30");
  const [, setLocation] = useLocation();

  const handleStart = () => {
    sessionStorage.setItem("presentationConfig", JSON.stringify({
      dashboards: selectedDashboards,
      interval: parseInt(rotationInterval) * 1000
    }));
    setOpen(false);
    setLocation("/dashboard/comercial/apresentacao");
  };

  const toggleCategory = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const category = DASHBOARD_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return;
    
    const categoryDashboardIds = category.dashboards.map(d => d.id);
    const allSelected = categoryDashboardIds.every(id => selectedDashboards.includes(id));
    
    if (allSelected) {
      setSelectedDashboards(selectedDashboards.filter(id => !categoryDashboardIds.includes(id)));
    } else {
      const combined = [...selectedDashboards, ...categoryDashboardIds];
      setSelectedDashboards(combined.filter((id, index) => combined.indexOf(id) === index));
    }
  };

  const isCategoryFullySelected = (categoryId: string) => {
    const category = DASHBOARD_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return false;
    return category.dashboards.every(d => selectedDashboards.includes(d.id));
  };

  const isCategoryPartiallySelected = (categoryId: string) => {
    const category = DASHBOARD_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return false;
    const selected = category.dashboards.filter(d => selectedDashboards.includes(d.id));
    return selected.length > 0 && selected.length < category.dashboards.length;
  };

  const getSelectedCount = (categoryId: string) => {
    const category = DASHBOARD_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return 0;
    return category.dashboards.filter(d => selectedDashboards.includes(d.id)).length;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center justify-center h-10 w-10 rounded-full border border-border bg-background hover:bg-muted transition-colors"
          data-testid="button-presentation-mode"
          aria-label="Modo Apresentação"
        >
          <Tv className="h-4 w-4 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modo Apresentação</DialogTitle>
          <DialogDescription>
            Selecione os dashboards para exibir em tela cheia com rotação automática.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ScrollArea className="h-[300px] pr-3">
            <Accordion type="multiple" defaultValue={["comercial"]} className="w-full">
              {DASHBOARD_CATEGORIES.map(category => {
                const Icon = category.icon;
                const isFullySelected = isCategoryFullySelected(category.id);
                const isPartiallySelected = isCategoryPartiallySelected(category.id);
                const selectedCount = getSelectedCount(category.id);
                
                return (
                  <AccordionItem key={category.id} value={category.id} className="border-b">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          checked={isFullySelected || (isPartiallySelected ? "indeterminate" : false)}
                          onCheckedChange={() => {}}
                          onClick={(e) => toggleCategory(category.id, e)}
                          data-testid={`checkbox-category-${category.id}`}
                        />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{category.label}</span>
                        {selectedCount > 0 && (
                          <span className="text-xs text-muted-foreground ml-auto mr-2">
                            {selectedCount}/{category.dashboards.length}
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="ml-7 space-y-1.5 pb-2">
                        {category.dashboards.map(d => (
                          <label 
                            key={d.id} 
                            className="flex items-start gap-2 cursor-pointer hover:bg-accent/30 rounded-md p-1.5"
                          >
                            <Checkbox
                              checked={selectedDashboards.includes(d.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedDashboards([...selectedDashboards, d.id]);
                                } else {
                                  setSelectedDashboards(selectedDashboards.filter(id => id !== d.id));
                                }
                              }}
                              data-testid={`checkbox-dashboard-${d.id}`}
                            />
                            <div className="grid gap-0.5 leading-none">
                              <span className="text-sm font-medium">
                                {d.label}
                              </span>
                              <p className="text-xs text-muted-foreground">{d.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </ScrollArea>
          
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium">Intervalo de rotação:</label>
            <Select value={rotationInterval} onValueChange={setRotationInterval}>
              <SelectTrigger data-testid="select-rotation-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 segundos</SelectItem>
                <SelectItem value="20">20 segundos</SelectItem>
                <SelectItem value="30">30 segundos</SelectItem>
                <SelectItem value="60">1 minuto</SelectItem>
                <SelectItem value="120">2 minutos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{selectedDashboards.length} de {ALL_DASHBOARDS.length} dashboards selecionados</span>
          </div>
          
          <Button 
            onClick={handleStart} 
            disabled={selectedDashboards.length === 0}
            className="w-full"
            data-testid="button-start-presentation"
          >
            <Play className="mr-2 h-4 w-4" />
            Iniciar Apresentação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
