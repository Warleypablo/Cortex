import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, BellRing, Calendar, AlertTriangle, FileText, Save, RefreshCw, Settings } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSetPageInfo } from "@/contexts/PageContext";

interface NotificationRule {
  id: number;
  ruleType: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  config: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RuleConfig {
  diasAtraso?: number;
  valorMinimo?: number;
  diasAntecedencia?: number;
  priority?: 'high' | 'medium' | 'low';
}

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'Alta', color: 'bg-red-500' },
  { value: 'medium', label: 'Média', color: 'bg-yellow-500' },
  { value: 'low', label: 'Baixa', color: 'bg-green-500' },
];

const RULE_TYPE_ICONS: Record<string, typeof Bell> = {
  'inadimplencia': AlertTriangle,
  'contrato_vencendo': FileText,
  'aniversario': Calendar,
};

const RULE_TYPE_LABELS: Record<string, string> = {
  'inadimplencia': 'Inadimplência',
  'contrato_vencendo': 'Contrato Vencendo',
  'aniversario': 'Aniversário',
};

function RuleCard({ rule, onUpdate }: { rule: NotificationRule; onUpdate: () => void }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [config, setConfig] = useState<RuleConfig>(() => {
    try {
      return rule.config ? JSON.parse(rule.config) : {};
    } catch {
      return {};
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async (isEnabled: boolean) => {
      return await apiRequest('PATCH', `/api/notification-rules/${rule.id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-rules'] });
      toast({
        title: "Regra atualizada",
        description: `A regra "${rule.name}" foi ${rule.isEnabled ? 'desativada' : 'ativada'}.`,
      });
      onUpdate();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Ocorreu um erro ao atualizar a regra.",
        variant: "destructive",
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: RuleConfig) => {
      return await apiRequest('PATCH', `/api/notification-rules/${rule.id}`, { 
        config: JSON.stringify(newConfig) 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-rules'] });
      toast({
        title: "Configuração salva",
        description: `As configurações da regra "${rule.name}" foram atualizadas.`,
      });
      setIsEditing(false);
      onUpdate();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    updateConfigMutation.mutate(config);
  };

  const Icon = RULE_TYPE_ICONS[rule.ruleType] || Bell;
  const priorityOption = PRIORITY_OPTIONS.find(p => p.value === config.priority);

  return (
    <Card className="relative" data-testid={`card-rule-${rule.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${rule.isEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
              <Icon className={`h-5 w-5 ${rule.isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <CardTitle className="text-base">{rule.name}</CardTitle>
              <CardDescription className="text-sm mt-1">
                {rule.description || RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {priorityOption && (
              <Badge variant="outline" className="text-xs">
                <span className={`w-2 h-2 rounded-full ${priorityOption.color} mr-1.5`} />
                {priorityOption.label}
              </Badge>
            )}
            <Switch
              checked={rule.isEnabled}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
              data-testid={`switch-rule-${rule.id}`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-4" />
        
        {isEditing ? (
          <div className="space-y-4">
            {rule.ruleType === 'inadimplencia' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`diasAtraso-${rule.id}`}>Dias de Atraso</Label>
                    <Input
                      id={`diasAtraso-${rule.id}`}
                      type="number"
                      min={1}
                      value={config.diasAtraso || 7}
                      onChange={(e) => setConfig({ ...config, diasAtraso: parseInt(e.target.value) || 0 })}
                      data-testid={`input-diasAtraso-${rule.id}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`valorMinimo-${rule.id}`}>Valor Mínimo (R$)</Label>
                    <Input
                      id={`valorMinimo-${rule.id}`}
                      type="number"
                      min={0}
                      value={config.valorMinimo || 0}
                      onChange={(e) => setConfig({ ...config, valorMinimo: parseFloat(e.target.value) || 0 })}
                      data-testid={`input-valorMinimo-${rule.id}`}
                    />
                  </div>
                </div>
              </>
            )}
            
            {(rule.ruleType === 'contrato_vencendo' || rule.ruleType === 'aniversario') && (
              <div className="space-y-2">
                <Label htmlFor={`diasAntecedencia-${rule.id}`}>Dias de Antecedência</Label>
                <Input
                  id={`diasAntecedencia-${rule.id}`}
                  type="number"
                  min={1}
                  value={config.diasAntecedencia || (rule.ruleType === 'contrato_vencendo' ? 30 : 3)}
                  onChange={(e) => setConfig({ ...config, diasAntecedencia: parseInt(e.target.value) || 0 })}
                  data-testid={`input-diasAntecedencia-${rule.id}`}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor={`priority-${rule.id}`}>Prioridade</Label>
              <Select
                value={config.priority || 'medium'}
                onValueChange={(value) => setConfig({ ...config, priority: value as 'high' | 'medium' | 'low' })}
              >
                <SelectTrigger id={`priority-${rule.id}`} data-testid={`select-priority-${rule.id}`}>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${option.color}`} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleSaveConfig} 
                disabled={updateConfigMutation.isPending}
                data-testid={`button-save-${rule.id}`}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateConfigMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setConfig(rule.config ? JSON.parse(rule.config) : {});
                  setIsEditing(false);
                }}
                data-testid={`button-cancel-${rule.id}`}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {rule.ruleType === 'inadimplencia' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Dias de atraso:</span>
                    <span>{config.diasAtraso || 7}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Valor mínimo:</span>
                    <span>R$ {(config.valorMinimo || 0).toLocaleString('pt-BR')}</span>
                  </div>
                </>
              )}
              {(rule.ruleType === 'contrato_vencendo' || rule.ruleType === 'aniversario') && (
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">Dias de antecedência:</span>
                  <span>{config.diasAntecedencia || (rule.ruleType === 'contrato_vencendo' ? 30 : 3)}</span>
                </div>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(true)}
              data-testid={`button-edit-${rule.id}`}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuleCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-4" />
        <div className="space-y-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminNotificationRules() {
  const { toast } = useToast();
  
  useSetPageInfo("Regras de Notificação", "Configurar regras automáticas de notificação");

  const { data: rules, isLoading, refetch } = useQuery<NotificationRule[]>({
    queryKey: ['/api/notification-rules'],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/generate');
      if (!response.ok) {
        throw new Error('Failed to generate notifications');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Notificações geradas",
        description: `${data.generated || 0} notificações foram geradas com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar notificações",
        description: error.message || "Ocorreu um erro ao gerar as notificações.",
        variant: "destructive",
      });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/notification-rules/seed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-rules'] });
      toast({
        title: "Regras padrão criadas",
        description: "As regras de notificação padrão foram criadas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao criar as regras padrão.",
        variant: "destructive",
      });
    },
  });

  const enabledCount = rules?.filter(r => r.isEnabled).length || 0;
  const totalCount = rules?.length || 0;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BellRing className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Regras de Notificação</h1>
              <p className="text-sm text-muted-foreground">
                {enabledCount} de {totalCount} regras ativas
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {(!rules || rules.length === 0) && !isLoading && (
              <Button
                variant="outline"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                data-testid="button-seed-rules"
              >
                {seedMutation.isPending ? 'Criando...' : 'Criar Regras Padrão'}
              </Button>
            )}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-notifications"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
              {generateMutation.isPending ? 'Gerando...' : 'Gerar Notificações'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {isLoading ? (
            <>
              <RuleCardSkeleton />
              <RuleCardSkeleton />
              <RuleCardSkeleton />
            </>
          ) : rules && rules.length > 0 ? (
            rules.map((rule) => (
              <RuleCard key={rule.id} rule={rule} onUpdate={refetch} />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma regra encontrada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Clique no botão acima para criar as regras de notificação padrão.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
