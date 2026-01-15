import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Target, Settings, Save, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SalesGoal {
  id?: number;
  goal_type: string;
  goal_key: string;
  goal_value: number;
  period_month: number | null;
  period_year: number | null;
  updated_by?: string;
  updated_at?: string;
}

interface SalesGoalsModalProps {
  type: "closers" | "sdrs";
  periodMonth: number;
  periodYear: number;
  trigger?: React.ReactNode;
}

export function SalesGoalsModal({ type, periodMonth, periodYear, trigger }: SalesGoalsModalProps) {
  const [open, setOpen] = useState(false);
  const [metaVendas, setMetaVendas] = useState<string>("");
  const [metaReunioes, setMetaReunioes] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const goalTypeVendas = `${type}_vendas`;
  const goalTypeReunioes = `${type}_reunioes`;

  const { data: goals, isLoading } = useQuery<SalesGoal[]>({
    queryKey: ["/api/sales-goals", type, periodMonth, periodYear],
    queryFn: async () => {
      const res = await fetch(`/api/sales-goals?periodMonth=${periodMonth}&periodYear=${periodYear}`);
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (goals) {
      const vendasGoal = goals.find(g => g.goal_type === goalTypeVendas && g.goal_key === "global");
      const reunioesGoal = goals.find(g => g.goal_type === goalTypeReunioes && g.goal_key === "global");
      
      setMetaVendas(vendasGoal?.goal_value?.toString() || "");
      setMetaReunioes(reunioesGoal?.goal_value?.toString() || "");
    }
  }, [goals, goalTypeVendas, goalTypeReunioes]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const goalsToSave: any[] = [];
      
      if (metaVendas) {
        goalsToSave.push({
          goalType: goalTypeVendas,
          goalKey: "global",
          goalValue: parseFloat(metaVendas),
          periodMonth,
          periodYear
        });
      }
      
      if (metaReunioes) {
        goalsToSave.push({
          goalType: goalTypeReunioes,
          goalKey: "global",
          goalValue: parseFloat(metaReunioes),
          periodMonth,
          periodYear
        });
      }
      
      if (goalsToSave.length === 0) {
        throw new Error("Preencha pelo menos uma meta");
      }
      
      return apiRequest("POST", "/api/sales-goals/batch", { goals: goalsToSave });
    },
    onSuccess: () => {
      toast({
        title: "Metas salvas",
        description: "As metas foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-goals"] });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as metas.",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const title = type === "closers" ? "Metas dos Closers" : "Metas dos SDRs";
  const vendasLabel = type === "closers" ? "Meta de Vendas (MRR)" : "Meta de Vendas (Contratos)";
  const reunioesLabel = type === "closers" ? "Meta de Reuniões Realizadas" : "Meta de Reuniões Agendadas";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="icon"
            className="border-amber-500/50 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300"
            data-testid="button-open-goals-modal"
          >
            <Target className="w-5 h-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" data-testid="modal-sales-goals">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure as metas para {new Date(periodYear, periodMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="meta-vendas">{vendasLabel}</Label>
                <Input
                  id="meta-vendas"
                  type="number"
                  placeholder={type === "closers" ? "Ex: 100000" : "Ex: 15"}
                  value={metaVendas}
                  onChange={(e) => setMetaVendas(e.target.value)}
                  data-testid="input-meta-vendas"
                />
                {type === "closers" && metaVendas && (
                  <p className="text-xs text-muted-foreground">
                    R$ {parseFloat(metaVendas || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="meta-reunioes">{reunioesLabel}</Label>
                <Input
                  id="meta-reunioes"
                  type="number"
                  placeholder="Ex: 250"
                  value={metaReunioes}
                  onChange={(e) => setMetaReunioes(e.target.value)}
                  data-testid="input-meta-reunioes"
                />
              </div>
            </>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="button-cancel-goals"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-goals"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Metas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
