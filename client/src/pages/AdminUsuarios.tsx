import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Users, Database, Shield, Edit, UserCog, ShieldCheck, ShieldOff, Briefcase, ArrowUpDown, ArrowUp, ArrowDown, Plus, Activity, Settings, Layers, Flag, Trash2, Pencil, BellRing, Package, FileText, TrendingUp, Building2, AlertTriangle, FileCheck, UserMinus, Target, GitBranch, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSetPageInfo } from "@/contexts/PageContext";
import { AdminLogsContent } from "./AdminLogs";
import { ColorPicker } from "@/components/ui/color-picker";

type SortColumn = 'name' | 'email' | 'role' | 'allowedRoutes';
type SortDirection = 'asc' | 'desc';

interface SystemFieldOption {
  id: number;
  field_type: string;
  value: string;
  label: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

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

const FIELD_TYPES = [
  // Clientes
  { key: 'client_status', label: 'Status do Cliente', icon: Activity },
  { key: 'business_type', label: 'Tipo de Negócio', icon: Briefcase },
  { key: 'cluster', label: 'Cluster', icon: Layers },
  { key: 'account_status', label: 'Status da Conta', icon: Flag },
  // Comercial
  { key: 'origem_lead', label: 'Origem do Lead', icon: Target },
  { key: 'pipeline_stage', label: 'Etapa do Pipeline', icon: GitBranch },
  { key: 'motivo_churn', label: 'Motivo de Churn', icon: UserMinus },
  { key: 'prioridade', label: 'Prioridade', icon: AlertTriangle },
  // Contratos
  { key: 'contract_status', label: 'Status do Contrato', icon: Database },
  { key: 'tipo_contrato', label: 'Tipo de Contrato', icon: FileCheck },
  { key: 'product', label: 'Produto', icon: Package },
  { key: 'plan', label: 'Plano', icon: FileText },
  // RH
  { key: 'squad', label: 'Squad', icon: Users },
  { key: 'collaborator_status', label: 'Status Colaborador', icon: UserCog },
  { key: 'cargo', label: 'Cargo', icon: Briefcase },
  { key: 'nivel', label: 'Nível', icon: TrendingUp },
  { key: 'setor', label: 'Setor', icon: Building2 },
];

interface ColaboradorVinculado {
  id: number;
  nome: string;
  setor: string | null;
  cargo: string | null;
  squad: string | null;
  status: string | null;
}

interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
  role: 'admin' | 'user';
  allowedRoutes: string[];
  colaborador: ColaboradorVinculado | null;
}

interface DebugData {
  users: User[];
  allKeys: string[];
  count: number;
  totalKeys: number;
}

const AVAILABLE_ROUTES = [
  // Menu Principal
  { path: '/clientes', label: 'Clientes', category: 'Menu Principal' },
  { path: '/contratos', label: 'Contratos', category: 'Menu Principal' },
  { path: '/colaboradores', label: 'Colaboradores', category: 'Menu Principal' },
  { path: '/colaboradores/analise', label: 'Análise Colaboradores', category: 'Menu Principal' },
  { path: '/patrimonio', label: 'Patrimônio', category: 'Menu Principal' },
  { path: '/ferramentas', label: 'Ferramentas', category: 'Menu Principal' },
  { path: '/turbozap', label: 'TurboZap', category: 'Menu Principal' },
  { path: '/acessos', label: 'Acessos', category: 'Menu Principal' },
  { path: '/conhecimentos', label: 'Conhecimentos', category: 'Menu Principal' },
  { path: '/beneficios', label: 'Benefícios', category: 'Menu Principal' },
  { path: '/cases/chat', label: 'Assistente IA', category: 'Menu Principal' },
  // Financeiro
  { path: '/dashboard/financeiro', label: 'Visão Geral', category: 'Financeiro' },
  { path: '/dashboard/dfc', label: 'DFC', category: 'Financeiro' },
  { path: '/dashboard/fluxo-caixa', label: 'Fluxo de Caixa', category: 'Financeiro' },
  { path: '/dashboard/revenue-goals', label: 'Revenue Goals', category: 'Financeiro' },
  { path: '/dashboard/inadimplencia', label: 'Inadimplência', category: 'Financeiro' },
  { path: '/dashboard/auditoria-sistemas', label: 'Auditoria de Sistemas', category: 'Financeiro' },
  // G&G
  { path: '/dashboard/geg', label: 'Visão Geral', category: 'G&G' },
  { path: '/dashboard/inhire', label: 'Inhire', category: 'G&G' },
  { path: '/dashboard/recrutamento', label: 'Recrutamento', category: 'G&G' },
  // Operação
  { path: '/visao-geral', label: 'Visão Geral', category: 'Operação' },
  { path: '/dashboard/retencao', label: 'Análise de Retenção', category: 'Operação' },
  { path: '/dashboard/meta-ads', label: 'Meta Ads', category: 'Operação' },
  // Tech
  { path: '/dashboard/tech', label: 'Visão Geral', category: 'Tech' },
  { path: '/tech/projetos', label: 'Projetos', category: 'Tech' },
  // Comercial
  { path: '/dashboard/comercial/closers', label: 'Closers', category: 'Comercial' },
  { path: '/dashboard/comercial/sdrs', label: 'SDRs', category: 'Comercial' },
  { path: '/dashboard/comercial/detalhamento-closers', label: 'Detalhamento Closers', category: 'Comercial' },
  { path: '/dashboard/comercial/detalhamento-sdrs', label: 'Detalhamento SDRs', category: 'Comercial' },
  { path: '/dashboard/comercial/detalhamento-vendas', label: 'Detalhamento Vendas', category: 'Comercial' },
  { path: '/dashboard/comercial/analise-vendas', label: 'Análise de Vendas', category: 'Comercial' },
  { path: '/dashboard/comercial/apresentacao', label: 'Modo Apresentação', category: 'Comercial' },
  // Growth
  { path: '/growth/visao-geral', label: 'Visão Geral', category: 'Growth' },
  { path: '/growth/criativos', label: 'Criativos', category: 'Growth' },
  { path: '/growth/performance-plataformas', label: 'Por Plataforma', category: 'Growth' },
  // Jurídico
  { path: '/juridico/clientes', label: 'Clientes Cobrança', category: 'Jurídico' },
  // Investidores
  { path: '/investors-report', label: 'Relatório Investidores', category: 'Investidores' },
  // Administração
  { path: '/admin/usuarios', label: 'Gerenciar Usuários', category: 'Administração' },
  { path: '/admin/regras-notificacoes', label: 'Regras de Notificação', category: 'Administração' },
];

// Pre-defined role presets with access to specific pages
const ROLE_PRESETS: { id: string; label: string; description: string; routes: string[] }[] = [
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Acesso a dashboards financeiros, DFC, fluxo de caixa e inadimplência',
    routes: [
      '/clientes', '/contratos', '/cases/chat',
      '/dashboard/financeiro', '/dashboard/dfc', '/dashboard/fluxo-caixa',
      '/dashboard/revenue-goals', '/dashboard/inadimplencia', '/dashboard/auditoria-sistemas'
    ]
  },
  {
    id: 'comercial',
    label: 'Comercial',
    description: 'Acesso a dashboards de vendas, closers e SDRs',
    routes: [
      '/clientes', '/contratos', '/cases/chat',
      '/dashboard/comercial/closers', '/dashboard/comercial/sdrs',
      '/dashboard/comercial/detalhamento-closers', '/dashboard/comercial/detalhamento-sdrs',
      '/dashboard/comercial/detalhamento-vendas', '/dashboard/comercial/analise-vendas',
      '/dashboard/comercial/apresentacao'
    ]
  },
  {
    id: 'growth',
    label: 'Growth',
    description: 'Acesso a dashboards de Growth, criativos e performance',
    routes: [
      '/clientes', '/contratos', '/cases/chat',
      '/growth/visao-geral', '/growth/criativos', '/growth/performance-plataformas',
      '/dashboard/meta-ads'
    ]
  },
  {
    id: 'operacao',
    label: 'Operação',
    description: 'Acesso a visão geral operacional e retenção',
    routes: [
      '/clientes', '/contratos', '/colaboradores', '/cases/chat',
      '/visao-geral', '/dashboard/retencao'
    ]
  },
  {
    id: 'rh',
    label: 'RH / G&G',
    description: 'Acesso a gestão de pessoas e recrutamento',
    routes: [
      '/clientes', '/colaboradores', '/colaboradores/analise', '/cases/chat',
      '/dashboard/geg', '/dashboard/inhire', '/dashboard/recrutamento'
    ]
  },
  {
    id: 'tech',
    label: 'Tech',
    description: 'Acesso a dashboards de tecnologia e projetos',
    routes: [
      '/clientes', '/ferramentas', '/acessos', '/cases/chat',
      '/dashboard/tech', '/tech/projetos'
    ]
  },
  {
    id: 'juridico',
    label: 'Jurídico',
    description: 'Acesso a módulo jurídico e cobrança',
    routes: [
      '/clientes', '/contratos', '/cases/chat',
      '/juridico/clientes', '/dashboard/inadimplencia'
    ]
  },
  {
    id: 'investidor',
    label: 'Investidor',
    description: 'Acesso apenas ao relatório de investidores',
    routes: ['/investors-report']
  },
  {
    id: 'visualizador',
    label: 'Visualizador Básico',
    description: 'Acesso apenas a clientes e contratos',
    routes: ['/clientes', '/contratos', '/cases/chat']
  },
];

function EditPermissionsDialog({ user, open, onOpenChange, onToggleRole }: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleRole: (user: User) => void;
}) {
  const { toast } = useToast();
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(user.allowedRoutes || []);

  const updatePermissionsMutation = useMutation({
    mutationFn: async (allowedRoutes: string[]) => {
      return await apiRequest('POST', `/api/users/${user.id}/permissions`, { allowedRoutes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/debug/users'] });
      toast({
        title: "Permissões atualizadas",
        description: `Permissões de ${user.name} foram atualizadas com sucesso.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar permissões",
        description: error.message || "Ocorreu um erro ao atualizar as permissões.",
        variant: "destructive",
      });
    },
  });

  const handleToggleRoute = (route: string) => {
    if (selectedRoutes.includes(route)) {
      setSelectedRoutes(selectedRoutes.filter((r) => r !== route));
    } else {
      setSelectedRoutes([...selectedRoutes, route]);
    }
  };

  const handleSelectAll = () => {
    setSelectedRoutes(AVAILABLE_ROUTES.map((r) => r.path));
  };

  const handleDeselectAll = () => {
    setSelectedRoutes([]);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = ROLE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedRoutes(preset.routes);
      toast({
        title: "Perfil aplicado",
        description: `Perfil "${preset.label}" aplicado. Clique em Salvar para confirmar.`,
      });
    }
  };

  const handleSave = () => {
    updatePermissionsMutation.mutate(selectedRoutes);
  };

  const handlePromoteToAdmin = () => {
    onToggleRole(user);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Permissões</DialogTitle>
          <DialogDescription>
            Defina quais páginas {user.name} pode acessar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Admin toggle section */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${user.role === 'admin' ? 'bg-primary/10' : 'bg-muted'}`}>
                  {user.role === 'admin' ? (
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  ) : (
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Função do Usuário</p>
                  <p className="text-sm text-muted-foreground">
                    {user.role === 'admin' 
                      ? 'Administrador com acesso total ao sistema' 
                      : 'Usuário comum com acesso limitado'}
                  </p>
                </div>
              </div>
              <Button
                variant={user.role === 'admin' ? 'outline' : 'default'}
                size="sm"
                onClick={handlePromoteToAdmin}
                data-testid="button-toggle-admin"
              >
                {user.role === 'admin' ? (
                  <>
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Remover Admin
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Tornar Admin
                  </>
                )}
              </Button>
            </div>
          </div>

          {user.role !== 'admin' && (
            <>
              <Separator />

              {/* Role presets section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Aplicar Perfil de Acesso</Label>
                </div>
                <Select onValueChange={handleApplyPreset}>
                  <SelectTrigger data-testid="select-role-preset">
                    <SelectValue placeholder="Selecione um perfil para aplicar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id} data-testid={`preset-${preset.id}`}>
                        <div className="flex flex-col">
                          <span className="font-medium">{preset.label}</span>
                          <span className="text-xs text-muted-foreground">{preset.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Manual selection */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  data-testid="button-select-all"
                >
                  Selecionar Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  data-testid="button-deselect-all"
                >
                  Desmarcar Todas
                </Button>
                <div className="ml-auto text-sm text-muted-foreground">
                  {selectedRoutes.length} de {AVAILABLE_ROUTES.length} selecionadas
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(
                  AVAILABLE_ROUTES.reduce((acc, route) => {
                    if (!acc[route.category]) acc[route.category] = [];
                    acc[route.category].push(route);
                    return acc;
                  }, {} as Record<string, typeof AVAILABLE_ROUTES>)
                ).map(([category, routes]) => (
                  <div key={category}>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">{category}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {routes.map((route) => (
                        <div key={route.path} className="flex items-center space-x-2">
                          <Checkbox
                            id={`route-${route.path}`}
                            checked={selectedRoutes.includes(route.path)}
                            onCheckedChange={() => handleToggleRoute(route.path)}
                            data-testid={`checkbox-${route.path}`}
                          />
                          <Label
                            htmlFor={`route-${route.path}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {route.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          {user.role !== 'admin' && (
            <Button
              onClick={handleSave}
              disabled={updatePermissionsMutation.isPending}
              data-testid="button-save"
            >
              {updatePermissionsMutation.isPending ? "Salvando..." : "Salvar Permissões"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddUserDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [emailError, setEmailError] = useState("");

  const validateEmail = (email: string): boolean => {
    const validDomains = ['@turbopartners.com.br', '@gmail.com'];
    const isValid = validDomains.some(domain => email.toLowerCase().endsWith(domain));
    if (!isValid && email.length > 0) {
      setEmailError("Email deve terminar com @turbopartners.com.br ou @gmail.com");
    } else {
      setEmailError("");
    }
    return isValid;
  };

  const createUserMutation = useMutation({
    mutationFn: async (userData: { name: string; email: string; role: 'admin' | 'user'; allowedRoutes: string[] }) => {
      return await apiRequest('POST', '/api/auth/users', userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/debug/users'] });
      toast({
        title: "Usuário criado",
        description: `Usuário ${name} foi criado com sucesso.`,
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Ocorreu um erro ao criar o usuário.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setName("");
    setEmail("");
    setRole('user');
    setSelectedRoutes([]);
    setEmailError("");
  };

  const handleToggleRoute = (route: string) => {
    if (selectedRoutes.includes(route)) {
      setSelectedRoutes(selectedRoutes.filter((r) => r !== route));
    } else {
      setSelectedRoutes([...selectedRoutes, route]);
    }
  };

  const handleSelectAll = () => {
    setSelectedRoutes(AVAILABLE_ROUTES.map((r) => r.path));
  };

  const handleDeselectAll = () => {
    setSelectedRoutes([]);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = ROLE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedRoutes(preset.routes);
      toast({
        title: "Perfil aplicado",
        description: `Perfil "${preset.label}" aplicado.`,
      });
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do usuário.",
        variant: "destructive",
      });
      return;
    }

    if (!email.trim() || !validateEmail(email)) {
      toast({
        title: "Email inválido",
        description: "Email deve terminar com @turbopartners.com.br ou @gmail.com",
        variant: "destructive",
      });
      return;
    }

    const uniqueRoutes = Array.from(new Set(selectedRoutes));
    createUserMutation.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      allowedRoutes: role === 'admin' ? [] : uniqueRoutes,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Usuário</DialogTitle>
          <DialogDescription>
            Crie um novo usuário e defina suas permissões de acesso
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome *</Label>
              <Input
                id="user-name"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="email@turbopartners.com.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (e.target.value.length > 0) {
                    validateEmail(e.target.value);
                  } else {
                    setEmailError("");
                  }
                }}
                className={emailError ? "border-destructive" : ""}
                data-testid="input-user-email"
              />
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Função</Label>
            <Select value={role} onValueChange={(value: 'admin' | 'user') => setRole(value)}>
              <SelectTrigger data-testid="select-user-role">
                <SelectValue placeholder="Selecione a função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user" data-testid="role-user">Usuário</SelectItem>
                <SelectItem value="admin" data-testid="role-admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role !== 'admin' && (
            <>
              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Aplicar Perfil de Acesso</Label>
                </div>
                <Select onValueChange={handleApplyPreset}>
                  <SelectTrigger data-testid="select-add-role-preset">
                    <SelectValue placeholder="Selecione um perfil para aplicar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id} data-testid={`add-preset-${preset.id}`}>
                        <div className="flex flex-col">
                          <span className="font-medium">{preset.label}</span>
                          <span className="text-xs text-muted-foreground">{preset.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  data-testid="button-add-select-all"
                >
                  Selecionar Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  data-testid="button-add-deselect-all"
                >
                  Desmarcar Todas
                </Button>
                <div className="ml-auto text-sm text-muted-foreground">
                  {selectedRoutes.length} de {AVAILABLE_ROUTES.length} selecionadas
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(
                  AVAILABLE_ROUTES.reduce((acc, route) => {
                    if (!acc[route.category]) acc[route.category] = [];
                    acc[route.category].push(route);
                    return acc;
                  }, {} as Record<string, typeof AVAILABLE_ROUTES>)
                ).map(([category, routes]) => (
                  <div key={category}>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">{category}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {routes.map((route) => (
                        <div key={route.path} className="flex items-center space-x-2">
                          <Checkbox
                            id={`add-route-${route.path}`}
                            checked={selectedRoutes.includes(route.path)}
                            onCheckedChange={() => handleToggleRoute(route.path)}
                            data-testid={`add-checkbox-${route.path}`}
                          />
                          <Label
                            htmlFor={`add-route-${route.path}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {route.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            data-testid="button-add-cancel"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={createUserMutation.isPending}
            data-testid="button-add-save"
          >
            {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddEditFieldOptionDialog({ 
  open, 
  onOpenChange, 
  fieldType, 
  fieldLabel,
  editingOption 
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldType: string;
  fieldLabel: string;
  editingOption: SystemFieldOption | null;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  useEffect(() => {
    if (open) {
      if (editingOption) {
        setValue(editingOption.value || "");
        setLabel(editingOption.label || "");
        setColor(editingOption.color || "");
        setSortOrder(editingOption.sort_order?.toString() || "0");
      } else {
        setValue("");
        setLabel("");
        setColor("");
        setSortOrder("0");
      }
    }
  }, [open, editingOption]);

  const resetForm = () => {
    setValue("");
    setLabel("");
    setColor("");
    setSortOrder("0");
  };

  const createMutation = useMutation({
    mutationFn: async (data: { fieldType: string; value: string; label: string; color: string; sortOrder: number }) => {
      return await apiRequest('POST', '/api/system-fields', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-fields', fieldType] });
      toast({ title: "Opção criada", description: "A opção foi adicionada com sucesso." });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar opção", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; value: string; label: string; color: string; sortOrder: number }) => {
      return await apiRequest('PATCH', `/api/system-fields/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-fields', fieldType] });
      toast({ title: "Opção atualizada", description: "A opção foi atualizada com sucesso." });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar opção", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!value.trim() || !label.trim()) {
      toast({ title: "Campos obrigatórios", description: "Valor e Label são obrigatórios.", variant: "destructive" });
      return;
    }

    if (editingOption) {
      updateMutation.mutate({ id: editingOption.id, value, label, color, sortOrder: parseInt(sortOrder) || 0 });
    } else {
      createMutation.mutate({ fieldType, value, label, color, sortOrder: parseInt(sortOrder) || 0 });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingOption ? "Editar Opção" : "Adicionar Opção"}</DialogTitle>
          <DialogDescription>
            {editingOption ? "Edite os dados da opção" : `Adicione uma nova opção para ${fieldLabel}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="field-value">Valor (interno) *</Label>
            <Input
              id="field-value"
              placeholder="valor_interno"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input-field-value"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="field-label">Label (exibição) *</Label>
            <Input
              id="field-label"
              placeholder="Nome de Exibição"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              data-testid="input-field-label"
            />
          </div>
          <ColorPicker
            value={color}
            onChange={setColor}
            label="Cor (opcional)"
            previewLabel={label || "Preview"}
          />
          <div className="space-y-2">
            <Label htmlFor="field-sort-order">Ordem</Label>
            <Input
              id="field-sort-order"
              type="number"
              placeholder="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              data-testid="input-field-sort-order"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-field-cancel">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-field-save"
          >
            {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldTypeCard({ fieldType }: { fieldType: { key: string; label: string; icon: any } }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<SystemFieldOption | null>(null);
  const Icon = fieldType.icon;

  const { data, isLoading } = useQuery<{ fieldType: string; options: SystemFieldOption[] }>({
    queryKey: ['/api/system-fields', fieldType.key],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/system-fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-fields', fieldType.key] });
      toast({ title: "Opção removida", description: "A opção foi desativada com sucesso." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover opção", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (option: SystemFieldOption) => {
    setEditingOption(option);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingOption(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (option: SystemFieldOption) => {
    if (confirm(`Deseja realmente remover a opção "${option.label}"?`)) {
      deleteMutation.mutate(option.id);
    }
  };

  const options = data?.options || [];
  const optionCount = options.length;

  return (
    <Card data-testid={`card-field-${fieldType.key}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">{fieldType.label}</CardTitle>
                <Badge variant="secondary" className="text-xs">{optionCount}</Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={handleAdd} data-testid={`button-add-${fieldType.key}`}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : options.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma opção cadastrada
              </p>
            ) : (
              <div className="space-y-2">
                {options.map((option) => (
                  <div 
                    key={option.id} 
                    className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                    data-testid={`option-${option.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {option.color ? (
                        <Badge className={option.color}>{option.label}</Badge>
                      ) : (
                        <span className="text-sm font-medium">{option.label}</span>
                      )}
                      <span className="text-xs text-muted-foreground truncate">({option.value})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleEdit(option)}
                        data-testid={`button-edit-option-${option.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleDelete(option)}
                        data-testid={`button-delete-option-${option.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <AddEditFieldOptionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        fieldType={fieldType.key}
        fieldLabel={fieldType.label}
        editingOption={editingOption}
      />
    </Card>
  );
}

function SystemFieldsContent() {
  const { toast } = useToast();

  const seedMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/system-fields/seed');
    },
    onSuccess: (data: any) => {
      FIELD_TYPES.forEach(ft => {
        queryClient.invalidateQueries({ queryKey: ['/api/system-fields', ft.key] });
      });
      toast({ 
        title: "Dados iniciais populados", 
        description: `${data.insertedCount || 'Todos'} opções foram inseridas com sucesso.` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao popular dados", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campos do Sistema</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as opções disponíveis para os campos de seleção do sistema
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          data-testid="button-seed-data"
        >
          <Database className="h-4 w-4 mr-2" />
          {seedMutation.isPending ? "Populando..." : "Popular Dados Iniciais"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FIELD_TYPES.map((fieldType) => (
          <FieldTypeCard key={fieldType.key} fieldType={fieldType} />
        ))}
      </div>
    </div>
  );
}

function NotificationRulesContent() {
  const { toast } = useToast();
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);

  const { data: rules = [], isLoading } = useQuery<NotificationRule[]>({
    queryKey: ['/api/notification-rules'],
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/notification-rules/seed');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-rules'] });
      toast({ 
        title: "Regras populadas", 
        description: `${data.insertedCount || 0} regras foram criadas com sucesso.` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao popular regras", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: number; isEnabled: boolean }) => {
      return await apiRequest('PATCH', `/api/notification-rules/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-rules'] });
      toast({ title: "Regra atualizada" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar regra", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/notification-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-rules'] });
      toast({ title: "Regra removida" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover regra", description: error.message, variant: "destructive" });
    },
  });

  const getRuleTypeLabel = (ruleType: string) => {
    const labels: Record<string, string> = {
      'inadimplencia': 'Inadimplência',
      'contrato_vencendo': 'Contrato Vencendo',
      'aniversario': 'Aniversário',
    };
    return labels[ruleType] || ruleType;
  };

  const parseConfig = (config: string | null) => {
    if (!config) return null;
    try {
      return JSON.parse(config);
    } catch {
      return null;
    }
  };

  const formatConfigDisplay = (rule: NotificationRule) => {
    const config = parseConfig(rule.config);
    if (!config) return null;
    
    switch (rule.ruleType) {
      case 'inadimplencia':
        return `Mínimo ${config.minDaysOverdue || 7} dias de atraso`;
      case 'contrato_vencendo':
        return `${config.daysBeforeExpiry || 30} dias antes do vencimento`;
      case 'aniversario':
        return config.enabled ? 'Habilitado' : 'Desabilitado';
      default:
        return JSON.stringify(config);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Regras de Notificação</h2>
          <p className="text-sm text-muted-foreground">
            Configure quais alertas são gerados automaticamente pelo sistema
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          data-testid="button-seed-notification-rules"
        >
          <Database className="h-4 w-4 mr-2" />
          {seedMutation.isPending ? "Populando..." : "Popular Regras Padrão"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BellRing className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              Nenhuma regra de notificação configurada
            </p>
            <Button 
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              data-testid="button-seed-rules-empty"
            >
              {seedMutation.isPending ? "Populando..." : "Criar Regras Padrão"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{rule.name}</CardTitle>
                  <Badge variant="outline">{getRuleTypeLabel(rule.ruleType)}</Badge>
                </div>
                {rule.description && (
                  <CardDescription className="text-sm">
                    {rule.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {formatConfigDisplay(rule) && (
                  <p className="text-sm text-muted-foreground">
                    {formatConfigDisplay(rule)}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isEnabled}
                      onCheckedChange={(checked) => 
                        toggleMutation.mutate({ id: rule.id, isEnabled: checked })
                      }
                      disabled={toggleMutation.isPending}
                      data-testid={`switch-rule-${rule.id}`}
                    />
                    <Label className="text-sm">
                      {rule.isEnabled ? 'Ativo' : 'Inativo'}
                    </Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingRule(rule)}
                      data-testid={`button-edit-rule-${rule.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja remover esta regra?')) {
                          deleteMutation.mutate(rule.id);
                        }
                      }}
                      data-testid={`button-delete-rule-${rule.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditRuleDialog
        rule={editingRule}
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(null)}
      />
    </div>
  );
}

function EditRuleDialog({ 
  rule, 
  open, 
  onOpenChange 
}: { 
  rule: NotificationRule | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (rule?.config) {
      try {
        setConfig(JSON.parse(rule.config));
      } catch {
        setConfig({});
      }
    }
  }, [rule]);

  const updateMutation = useMutation({
    mutationFn: async (data: { config: string }) => {
      return await apiRequest('PATCH', `/api/notification-rules/${rule?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-rules'] });
      toast({ title: "Configuração atualizada" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ config: JSON.stringify(config) });
  };

  if (!rule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Regra: {rule.name}</DialogTitle>
          <DialogDescription>
            Configure os parâmetros desta regra de notificação
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {rule.ruleType === 'inadimplencia' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="minDaysOverdue">Dias mínimos de atraso</Label>
                <Input
                  id="minDaysOverdue"
                  type="number"
                  value={config.minDaysOverdue || 7}
                  onChange={(e) => setConfig({ ...config, minDaysOverdue: parseInt(e.target.value) || 0 })}
                  data-testid="input-min-days-overdue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minValue">Valor mínimo (R$)</Label>
                <Input
                  id="minValue"
                  type="number"
                  value={config.minValue || 0}
                  onChange={(e) => setConfig({ ...config, minValue: parseFloat(e.target.value) || 0 })}
                  data-testid="input-min-value"
                />
              </div>
            </>
          )}

          {rule.ruleType === 'contrato_vencendo' && (
            <div className="space-y-2">
              <Label htmlFor="daysBeforeExpiry">Dias antes do vencimento</Label>
              <Input
                id="daysBeforeExpiry"
                type="number"
                value={config.daysBeforeExpiry || 30}
                onChange={(e) => setConfig({ ...config, daysBeforeExpiry: parseInt(e.target.value) || 0 })}
                data-testid="input-days-before-expiry"
              />
            </div>
          )}

          {rule.ruleType === 'aniversario' && (
            <div className="flex items-center gap-2">
              <Switch
                checked={config.enabled !== false}
                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                data-testid="switch-aniversario-enabled"
              />
              <Label>Notificações de aniversário habilitadas</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit-rule">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-rule"
          >
            {updateMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableTableHead({ 
  column, 
  label, 
  sortColumn, 
  sortDirection, 
  onSort 
}: { 
  column: SortColumn;
  label: string;
  sortColumn: SortColumn | null;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const isActive = sortColumn === column;
  
  return (
    <TableHead 
      className="cursor-pointer select-none hover-elevate"
      onClick={() => onSort(column)}
      data-testid={`th-sort-${column}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );
}

export default function AdminUsuarios() {
  usePageTitle("Administração de Usuários");
  useSetPageInfo("Gerenciar Usuários", "Controle de acesso e permissões de usuários");
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<DebugData>({
    queryKey: ["/api/debug/users"],
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'user' }) => {
      return await apiRequest('POST', `/api/users/${userId}/role`, { role: newRole });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/debug/users'] });
      toast({
        title: "Função atualizada",
        description: `Usuário ${variables.newRole === 'admin' ? 'promovido a administrador' : 'rebaixado a usuário comum'} com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar função",
        description: error.message || "Ocorreu um erro ao atualizar a função do usuário.",
        variant: "destructive",
      });
    },
  });

  const handleToggleRole = (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    toggleRoleMutation.mutate({ userId: user.id, newRole });
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedUsers = useMemo(() => {
    if (!data?.users || !sortColumn) return data?.users || [];
    
    return [...data.users].sort((a, b) => {
      let compareA: string | number;
      let compareB: string | number;
      
      switch (sortColumn) {
        case 'name':
          compareA = a.name?.toLowerCase() || '';
          compareB = b.name?.toLowerCase() || '';
          break;
        case 'email':
          compareA = a.email?.toLowerCase() || '';
          compareB = b.email?.toLowerCase() || '';
          break;
        case 'role':
          compareA = a.role || 'user';
          compareB = b.role || 'user';
          break;
        case 'allowedRoutes':
          compareA = a.role === 'admin' ? Infinity : (a.allowedRoutes?.length || 0);
          compareB = b.role === 'admin' ? Infinity : (b.allowedRoutes?.length || 0);
          break;
        default:
          return 0;
      }
      
      if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data?.users, sortColumn, sortDirection]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Erro ao carregar dados</CardTitle>
            <CardDescription>
              Não foi possível carregar os dados dos usuários. Verifique os logs do servidor.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { users = [], allKeys = [], count = 0, totalKeys = 0 } = data || {};
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const userCount = users.filter((u) => u.role === 'user').length;

  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="usuarios" className="space-y-6">
        <TabsList data-testid="tabs-admin">
          <TabsTrigger value="usuarios" data-testid="tab-usuarios">
            <Users className="h-4 w-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <Activity className="h-4 w-4 mr-2" />
            Logs do Sistema
          </TabsTrigger>
          <TabsTrigger value="fields" data-testid="tab-fields">
            <Settings className="h-4 w-4 mr-2" />
            Campos do Sistema
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <BellRing className="h-4 w-4 mr-2" />
            Regras de Notificação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {count}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-admin-count">
              {adminCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Comuns</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-user-count">
              {userCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={totalKeys > 0 ? "default" : "secondary"}>
              {totalKeys > 0 ? "Ativo" : "Vazio"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Usuários Cadastrados</CardTitle>
            <CardDescription>
              Gerencie permissões e controle de acesso dos usuários
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-user">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Usuário
          </Button>
        </CardHeader>
        <CardContent>
          {sortedUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário cadastrado ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead 
                    column="name" 
                    label="Usuário" 
                    sortColumn={sortColumn} 
                    sortDirection={sortDirection} 
                    onSort={handleSort} 
                  />
                  <SortableTableHead 
                    column="email" 
                    label="Email" 
                    sortColumn={sortColumn} 
                    sortDirection={sortDirection} 
                    onSort={handleSort} 
                  />
                  <TableHead>Colaborador</TableHead>
                  <SortableTableHead 
                    column="role" 
                    label="Função" 
                    sortColumn={sortColumn} 
                    sortDirection={sortDirection} 
                    onSort={handleSort} 
                  />
                  <SortableTableHead 
                    column="allowedRoutes" 
                    label="Páginas Permitidas" 
                    sortColumn={sortColumn} 
                    sortDirection={sortDirection} 
                    onSort={handleSort} 
                  />
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.picture} alt={user.name} />
                          <AvatarFallback>
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium" data-testid={`text-name-${user.id}`}>
                          {user.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-email-${user.id}`}>
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {user.colaborador ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {user.colaborador.setor || 'Sem setor'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {user.colaborador.cargo || 'Sem cargo'}
                          </p>
                          {user.colaborador.squad && (
                            <p className="text-xs text-muted-foreground">
                              Squad: {user.colaborador.squad}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Não vinculado
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'Admin' : 'Usuário'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {user.role === 'admin' ? (
                          <span className="text-muted-foreground">Acesso Total</span>
                        ) : (
                          <span data-testid={`text-routes-${user.id}`}>
                            {user.allowedRoutes?.length || 0} página{user.allowedRoutes?.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(user)}
                        data-testid={`button-edit-${user.id}`}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar Permissões
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingUser && (
        <EditPermissionsDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          onToggleRole={handleToggleRole}
        />
      )}

      <AddUserDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
        </TabsContent>

        <TabsContent value="logs">
          <AdminLogsContent />
        </TabsContent>

        <TabsContent value="fields">
          <SystemFieldsContent />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationRulesContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
