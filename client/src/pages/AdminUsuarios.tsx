import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { format } from "date-fns";
import { Users, Database, Shield, Edit, UserCog, ShieldCheck, ShieldOff, Briefcase, ArrowUpDown, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSetPageInfo } from "@/contexts/PageContext";

type SortColumn = 'name' | 'email' | 'role' | 'allowedRoutes';
type SortDirection = 'asc' | 'desc';

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
  { path: '/admin/logs', label: 'Logs do Sistema', category: 'Administração' },
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

    createUserMutation.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      allowedRoutes: role === 'admin' ? [] : selectedRoutes,
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
    </div>
  );
}
