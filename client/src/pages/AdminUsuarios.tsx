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
import { Users, Database, Shield, Edit, UserCog, ShieldCheck, ShieldOff, Briefcase, ArrowUpDown, ArrowUp, ArrowDown, Plus, Activity, Settings, Layers, Flag, Trash2, Pencil, BellRing, Package, FileText, TrendingUp, Building2, AlertTriangle, FileCheck, UserMinus, Target, GitBranch, ChevronDown, ChevronUp, RefreshCw, Bot, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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

import { 
  PERMISSION_CATEGORIES, 
  PERMISSION_LABELS, 
  ACCESS_PROFILES, 
  ALL_PERMISSION_KEYS,
  permissionsToRoutes,
  routesToPermissions
} from "@shared/nav-config";

// New access profiles (Base, Time, Líder, Control Tower)
const ROLE_PRESETS = [
  {
    id: ACCESS_PROFILES.BASE.id,
    label: ACCESS_PROFILES.BASE.label,
    description: ACCESS_PROFILES.BASE.description,
    permissions: ACCESS_PROFILES.BASE.permissions,
  },
  {
    id: ACCESS_PROFILES.TIME.id,
    label: ACCESS_PROFILES.TIME.label,
    description: ACCESS_PROFILES.TIME.description,
    permissions: ACCESS_PROFILES.TIME.permissions,
  },
  {
    id: ACCESS_PROFILES.LIDER.id,
    label: ACCESS_PROFILES.LIDER.label,
    description: ACCESS_PROFILES.LIDER.description,
    permissions: ACCESS_PROFILES.LIDER.permissions,
  },
  {
    id: ACCESS_PROFILES.CONTROL_TOWER.id,
    label: ACCESS_PROFILES.CONTROL_TOWER.label,
    description: ACCESS_PROFILES.CONTROL_TOWER.description,
    permissions: ACCESS_PROFILES.CONTROL_TOWER.permissions,
  },
];

// Function to detect which access profile matches user's permissions
function detectAccessProfile(allowedRoutes: string[]): { label: string; variant: "default" | "secondary" | "outline" } | null {
  const userPermissions = routesToPermissions(allowedRoutes || []);
  const userPermsSet = new Set(userPermissions);
  
  // Check profiles from most restrictive to least restrictive
  const profiles = [
    { profile: ACCESS_PROFILES.CONTROL_TOWER, variant: "default" as const },
    { profile: ACCESS_PROFILES.LIDER, variant: "default" as const },
    { profile: ACCESS_PROFILES.TIME, variant: "secondary" as const },
    { profile: ACCESS_PROFILES.BASE, variant: "outline" as const },
  ];
  
  for (const { profile, variant } of profiles) {
    const profilePermsSet = new Set(profile.permissions);
    
    // Check if user has all permissions from this profile
    const hasAllProfilePerms = profile.permissions.every(p => userPermsSet.has(p));
    
    // Check if user has exactly these permissions (or subset for higher profiles)
    if (hasAllProfilePerms) {
      // For exact match or superset
      const isExactOrSuperset = userPermissions.length >= profile.permissions.length;
      if (isExactOrSuperset) {
        return { label: profile.label, variant };
      }
    }
  }
  
  // If no profile matches, return custom
  if (userPermissions.length > 0) {
    return { label: "Personalizado", variant: "outline" };
  }
  
  return { label: "Sem acesso", variant: "outline" };
}

function EditPermissionsDialog({ user, open, onOpenChange, onToggleRole }: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleRole: (user: User) => void;
}) {
  const { toast } = useToast();
  // Convert legacy routes to permission keys for backward compatibility
  const initialPermissions = routesToPermissions(user.allowedRoutes || []);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(initialPermissions);

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
    setSelectedRoutes([...ALL_PERMISSION_KEYS]);
  };

  const handleDeselectAll = () => {
    setSelectedRoutes([]);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = ROLE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedRoutes([...preset.permissions]);
      toast({
        title: "Perfil aplicado",
        description: `Perfil "${preset.label}" aplicado. Clique em Salvar para confirmar.`,
      });
    }
  };

  const handleSave = () => {
    // Convert permission keys to routes for API compatibility
    const routesToSave = permissionsToRoutes(selectedRoutes);
    updatePermissionsMutation.mutate(routesToSave);
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
                  {selectedRoutes.length} de {ALL_PERMISSION_KEYS.length} selecionadas
                </div>
              </div>

              <div className="space-y-6">
                {PERMISSION_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">{category.label}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {category.permissions.map((permission) => (
                        <div key={permission.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`route-${permission.key}`}
                            checked={selectedRoutes.includes(permission.key)}
                            onCheckedChange={() => handleToggleRoute(permission.key)}
                            data-testid={`checkbox-${permission.key}`}
                          />
                          <Label
                            htmlFor={`route-${permission.key}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {PERMISSION_LABELS[permission.key] || permission.label}
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
    setSelectedRoutes([...ALL_PERMISSION_KEYS]);
  };

  const handleDeselectAll = () => {
    setSelectedRoutes([]);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = ROLE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedRoutes([...preset.permissions]);
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

    // Convert permission keys to routes for API compatibility
    const uniquePermissions = Array.from(new Set(selectedRoutes));
    const routesToSave = permissionsToRoutes(uniquePermissions);
    createUserMutation.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      allowedRoutes: role === 'admin' ? [] : routesToSave,
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
                  {selectedRoutes.length} de {ALL_PERMISSION_KEYS.length} selecionadas
                </div>
              </div>

              <div className="space-y-6">
                {PERMISSION_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">{category.label}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {category.permissions.map((permission) => (
                        <div key={permission.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`add-route-${permission.key}`}
                            checked={selectedRoutes.includes(permission.key)}
                            onCheckedChange={() => handleToggleRoute(permission.key)}
                            data-testid={`add-checkbox-${permission.key}`}
                          />
                          <Label
                            htmlFor={`add-route-${permission.key}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {PERMISSION_LABELS[permission.key] || permission.label}
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

interface AIProvider {
  id: string;
  name: string;
  models: string[];
  available: boolean;
}

interface AIConfig {
  provider: string;
  model: string;
  providers: AIProvider[];
}

interface TestResult {
  success: boolean;
  provider: string;
  model: string;
  error?: string;
}

function AIConfigContent() {
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data: config, isLoading } = useQuery<AIConfig>({
    queryKey: ['/api/admin/ai/config'],
  });

  useEffect(() => {
    if (config) {
      setSelectedProvider(config.provider);
      setSelectedModel(config.model);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (data: { provider: string; model: string }) => {
      return await apiRequest('PUT', '/api/admin/ai/config', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai/config'] });
      toast({ title: "Configuração salva", description: "As configurações de IA foram atualizadas." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/ai/test');
      return response.json();
    },
    onSuccess: (data: TestResult) => {
      setTestResult(data);
      if (data.success) {
        toast({ title: "Conexão testada com sucesso", description: `${data.provider} (${data.model}) está funcionando.` });
      } else {
        toast({ title: "Erro na conexão", description: data.error || "Falha ao conectar com a IA.", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro ao testar", description: error.message, variant: "destructive" });
    },
  });

  const currentProviderData = config?.providers?.find(p => p.id === selectedProvider);
  const availableModels = currentProviderData?.models || [];

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const providerData = config?.providers?.find(p => p.id === provider);
    if (providerData && providerData.models.length > 0) {
      setSelectedModel(providerData.models[0]);
    }
    setTestResult(null);
  };

  const handleSave = () => {
    updateMutation.mutate({ provider: selectedProvider, model: selectedModel });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Configurações de IA</h2>
          <p className="text-sm text-muted-foreground">
            Configure o provedor e modelo de IA para o assistente GPTurbo
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ai-config-content">
      <div>
        <h2 className="text-lg font-semibold">Configurações de IA</h2>
        <p className="text-sm text-muted-foreground">
          Configure o provedor e modelo de IA para o assistente GPTurbo
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-ai-provider">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Provedor de IA
            </CardTitle>
            <CardDescription>
              Selecione o provedor de inteligência artificial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {config?.providers?.map((provider) => (
                <div
                  key={provider.id}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedProvider === provider.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  } ${!provider.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => provider.available && handleProviderChange(provider.id)}
                  data-testid={`provider-${provider.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedProvider === provider.id ? 'border-primary' : 'border-muted-foreground'
                    }`}>
                      {selectedProvider === provider.id && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Modelos: {provider.models.join(', ')}
                      </p>
                    </div>
                  </div>
                  <Badge variant={provider.available ? "default" : "secondary"}>
                    {provider.available ? "Disponível" : "Não configurado"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-ai-model">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Modelo
            </CardTitle>
            <CardDescription>
              Selecione o modelo de linguagem a ser utilizado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={!currentProviderData?.available}
            >
              <SelectTrigger data-testid="select-model">
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model} data-testid={`model-${model}`}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Configuração atual:</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Provedor:</span>{' '}
                  <span className="font-medium">{config?.providers?.find(p => p.id === config.provider)?.name || config?.provider}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Modelo:</span>{' '}
                  <span className="font-medium">{config?.model}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-ai-actions">
        <CardHeader>
          <CardTitle>Ações</CardTitle>
          <CardDescription>
            Salve as configurações ou teste a conexão com o provedor selecionado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || !selectedProvider || !selectedModel}
              data-testid="button-save-ai-config"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Configurações'
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="button-test-ai-connection"
            >
              {testMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Testar Conexão
                </>
              )}
            </Button>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg border ${
              testResult.success 
                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' 
                : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'
            }`} data-testid="test-result">
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <div>
                  <p className={`font-medium ${testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {testResult.success ? 'Conexão bem sucedida!' : 'Falha na conexão'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testResult.provider} ({testResult.model})
                    {testResult.error && ` - ${testResult.error}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Informações sobre os provedores:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>OpenAI:</strong> Requer OPENAI_API_KEY configurada no ambiente.</li>
              <li><strong>Gemini:</strong> Usa Replit AI Integrations - cobrado nos créditos Replit, sem necessidade de API key própria.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Types for database explorer
interface DatabaseTable {
  name: string;
  columnCount: number;
  rowCount: number;
}

interface DatabaseColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}

interface TableDetails {
  name: string;
  columns: DatabaseColumn[];
  rowCount: number;
  sampleData: Record<string, any>[];
}

interface TablesData {
  tables: DatabaseTable[];
  totalTables: number;
}

// Helper to group tables by prefix
function groupTablesByCategory(tables: DatabaseTable[]): Record<string, DatabaseTable[]> {
  const groups: Record<string, DatabaseTable[]> = {
    'RH (rh_)': [],
    'ContaAzul (caz_)': [],
    'ClickUp (cup_)': [],
    'Meta Ads (meta_)': [],
    'Sistema': [],
  };

  tables.forEach(table => {
    if (table.name.startsWith('rh_')) {
      groups['RH (rh_)'].push(table);
    } else if (table.name.startsWith('caz_')) {
      groups['ContaAzul (caz_)'].push(table);
    } else if (table.name.startsWith('cup_')) {
      groups['ClickUp (cup_)'].push(table);
    } else if (table.name.startsWith('meta_')) {
      groups['Meta Ads (meta_)'].push(table);
    } else {
      groups['Sistema'].push(table);
    }
  });

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([_, tables]) => tables.length > 0)
  );
}

function DatabaseExplorerContent() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<TablesData>({
    queryKey: ['/api/admin/database/tables'],
  });

  const { data: tableDetails, isLoading: isLoadingDetails } = useQuery<TableDetails>({
    queryKey: ['/api/admin/database/tables', selectedTable],
    enabled: !!selectedTable,
  });

  const groupedTables = useMemo(() => {
    if (!data?.tables) return {};
    return groupTablesByCategory(data.tables);
  }, [data?.tables]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Estrutura do Banco de Dados</h2>
            <p className="text-sm text-muted-foreground">
              Visualize todas as tabelas e suas estruturas
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total de Tabelas</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="database-explorer-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Estrutura do Banco de Dados</h2>
          <p className="text-sm text-muted-foreground">
            Visualize todas as tabelas e suas estruturas
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-tables"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-tables">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total de Tabelas</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tables">
              {data?.totalTables || 0}
            </div>
          </CardContent>
        </Card>
        {Object.entries(groupedTables).slice(0, 3).map(([category, tables]) => (
          <Card key={category}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">{category}</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tables.length}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.entries(groupedTables).map(([category, tables]) => (
        <div key={category} className="space-y-4">
          <h3 className="text-md font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {category}
            <Badge variant="secondary">{tables.length} tabelas</Badge>
          </h3>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {tables.map((table) => (
              <Card 
                key={table.name}
                className="cursor-pointer transition-colors hover-elevate"
                onClick={() => setSelectedTable(table.name)}
                data-testid={`card-table-${table.name}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    {table.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {table.columnCount} colunas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ~{table.rowCount.toLocaleString('pt-BR')} linhas
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {selectedTable}
            </DialogTitle>
            <DialogDescription>
              Estrutura e dados de amostra da tabela
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : tableDetails ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Badge variant="outline">{tableDetails.columns.length} colunas</Badge>
                <Badge variant="outline">~{tableDetails.rowCount.toLocaleString('pt-BR')} linhas</Badge>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Estrutura da Tabela</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coluna</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Nulável</TableHead>
                        <TableHead>Valor Padrão</TableHead>
                        <TableHead>PK</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableDetails.columns.map((col) => (
                        <TableRow key={col.column_name}>
                          <TableCell className="font-mono text-sm" data-testid={`cell-column-${col.column_name}`}>
                            {col.column_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {col.data_type}
                          </TableCell>
                          <TableCell>
                            <Badge variant={col.is_nullable === 'YES' ? 'secondary' : 'outline'} className="text-xs">
                              {col.is_nullable === 'YES' ? 'Sim' : 'Não'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono max-w-[200px] truncate">
                            {col.column_default || '-'}
                          </TableCell>
                          <TableCell>
                            {col.is_primary_key && (
                              <Badge variant="default" className="text-xs">PK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {tableDetails.sampleData.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Dados de Amostra (5 linhas)</h4>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {tableDetails.columns.slice(0, 6).map((col) => (
                            <TableHead key={col.column_name} className="text-xs whitespace-nowrap">
                              {col.column_name}
                            </TableHead>
                          ))}
                          {tableDetails.columns.length > 6 && (
                            <TableHead className="text-xs">...</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableDetails.sampleData.map((row, idx) => (
                          <TableRow key={idx}>
                            {tableDetails.columns.slice(0, 6).map((col) => (
                              <TableCell key={col.column_name} className="text-xs max-w-[150px] truncate">
                                {row[col.column_name] !== null && row[col.column_name] !== undefined 
                                  ? String(row[col.column_name]).substring(0, 50) 
                                  : <span className="text-muted-foreground italic">null</span>
                                }
                              </TableCell>
                            ))}
                            {tableDetails.columns.length > 6 && (
                              <TableCell className="text-xs text-muted-foreground">...</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Tabela não encontrada.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTable(null)} data-testid="button-close-table-details">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== CATALOGS CONTENT ====================
interface CatalogInfo {
  name: string;
  table: string;
  description: string;
  specificFields: string[];
}

interface CatalogItem {
  id: number;
  slug: string;
  name: string;
  active: boolean;
  sort_order: number;
  bp_segment?: string;
  is_off?: boolean;
  counts_as_operating?: boolean;
  created_at?: string;
}

function AddEditCatalogItemDialog({
  open,
  onOpenChange,
  catalogName,
  catalogConfig,
  editingItem
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogName: string;
  catalogConfig: CatalogInfo | null;
  editingItem: CatalogItem | null;
}) {
  const { toast } = useToast();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [bpSegment, setBpSegment] = useState("");
  const [isOff, setIsOff] = useState(false);
  const [countsAsOperating, setCountsAsOperating] = useState(true);

  useEffect(() => {
    if (open) {
      if (editingItem) {
        setSlug(editingItem.slug || "");
        setName(editingItem.name || "");
        setSortOrder(editingItem.sort_order?.toString() || "0");
        setActive(editingItem.active ?? true);
        setBpSegment(editingItem.bp_segment || "");
        setIsOff(editingItem.is_off ?? false);
        setCountsAsOperating(editingItem.counts_as_operating ?? true);
      } else {
        setSlug("");
        setName("");
        setSortOrder("0");
        setActive(true);
        setBpSegment("");
        setIsOff(false);
        setCountsAsOperating(true);
      }
    }
  }, [open, editingItem]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return await apiRequest('POST', `/api/admin/catalog/${catalogName}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/catalog', catalogName] });
      toast({ title: "Item criado", description: "O item foi adicionado ao catálogo." });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar item", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; body: Record<string, any> }) => {
      return await apiRequest('PUT', `/api/admin/catalog/${catalogName}/${data.id}`, data.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/catalog', catalogName] });
      toast({ title: "Item atualizado", description: "O item foi atualizado com sucesso." });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar item", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!slug.trim() || !name.trim()) {
      toast({ title: "Campos obrigatórios", description: "Slug e Nome são obrigatórios.", variant: "destructive" });
      return;
    }

    const body: Record<string, any> = {
      slug,
      name,
      sort_order: parseInt(sortOrder) || 0,
      active
    };

    if (catalogConfig?.specificFields.includes('bp_segment')) {
      body.bp_segment = bpSegment;
    }
    if (catalogConfig?.specificFields.includes('is_off')) {
      body.is_off = isOff;
    }
    if (catalogConfig?.specificFields.includes('counts_as_operating')) {
      body.counts_as_operating = countsAsOperating;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const hasSpecificField = (field: string) => catalogConfig?.specificFields.includes(field);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Item" : "Adicionar Item"}</DialogTitle>
          <DialogDescription>
            {editingItem ? "Edite os dados do item" : `Adicione um novo item ao catálogo ${catalogName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="catalog-slug">Slug (identificador único) *</Label>
            <Input
              id="catalog-slug"
              placeholder="meu_slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!!editingItem}
              data-testid="input-catalog-slug"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-name">Nome *</Label>
            <Input
              id="catalog-name"
              placeholder="Nome de exibição"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-catalog-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-sort-order">Ordem</Label>
            <Input
              id="catalog-sort-order"
              type="number"
              placeholder="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              data-testid="input-catalog-sort-order"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={active}
              onCheckedChange={setActive}
              data-testid="switch-catalog-active"
            />
            <Label>Ativo</Label>
          </div>

          {hasSpecificField('bp_segment') && (
            <div className="space-y-2">
              <Label htmlFor="catalog-bp-segment">Segmento BP</Label>
              <Input
                id="catalog-bp-segment"
                placeholder="Segmento"
                value={bpSegment}
                onChange={(e) => setBpSegment(e.target.value)}
                data-testid="input-catalog-bp-segment"
              />
            </div>
          )}

          {hasSpecificField('is_off') && (
            <div className="flex items-center gap-2">
              <Switch
                checked={isOff}
                onCheckedChange={setIsOff}
                data-testid="switch-catalog-is-off"
              />
              <Label>Is Off (Squad inativo)</Label>
            </div>
          )}

          {hasSpecificField('counts_as_operating') && (
            <div className="flex items-center gap-2">
              <Switch
                checked={countsAsOperating}
                onCheckedChange={setCountsAsOperating}
                data-testid="switch-catalog-counts-as-operating"
              />
              <Label>Conta como operando</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-catalog-cancel">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-catalog-save"
          >
            {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatalogsContent() {
  const { toast } = useToast();
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  const { data: catalogs = [], isLoading: isLoadingCatalogs } = useQuery<CatalogInfo[]>({
    queryKey: ['/api/admin/catalogs'],
  });

  const { data: items = [], isLoading: isLoadingItems } = useQuery<CatalogItem[]>({
    queryKey: ['/api/admin/catalog', selectedCatalog],
    enabled: !!selectedCatalog,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ catalogName, id }: { catalogName: string; id: number }) => {
      return await apiRequest('DELETE', `/api/admin/catalog/${catalogName}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/catalog', selectedCatalog] });
      toast({ title: "Item desativado", description: "O item foi desativado com sucesso." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao desativar item", description: error.message, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDeactivate = (item: CatalogItem) => {
    if (confirm(`Deseja realmente desativar o item "${item.name}"?`)) {
      deleteMutation.mutate({ catalogName: selectedCatalog!, id: item.id });
    }
  };

  const selectedCatalogConfig = catalogs.find(c => c.name === selectedCatalog);

  return (
    <div className="space-y-6" data-testid="catalogs-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Catálogos do Sistema</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os catálogos canônicos de produtos, planos, squads e outros
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoadingCatalogs ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          catalogs.map((catalog) => (
            <Card 
              key={catalog.name}
              className={`cursor-pointer transition-colors hover-elevate ${selectedCatalog === catalog.name ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => setSelectedCatalog(catalog.name)}
              data-testid={`card-catalog-${catalog.name}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selectedCatalog === catalog.name ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{catalog.name}</p>
                    <p className="text-xs text-muted-foreground">{catalog.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedCatalog && (
        <Card data-testid="card-catalog-items">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                {selectedCatalog}
              </CardTitle>
              <CardDescription>
                {selectedCatalogConfig?.description}
              </CardDescription>
            </div>
            <Button onClick={handleAdd} data-testid="button-add-catalog-item">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingItems ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum item neste catálogo
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slug</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ordem</TableHead>
                    {selectedCatalogConfig?.specificFields.includes('bp_segment') && (
                      <TableHead>Segmento BP</TableHead>
                    )}
                    {selectedCatalogConfig?.specificFields.includes('is_off') && (
                      <TableHead>Is Off</TableHead>
                    )}
                    {selectedCatalogConfig?.specificFields.includes('counts_as_operating') && (
                      <TableHead>Conta como Operando</TableHead>
                    )}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-catalog-item-${item.id}`}>
                      <TableCell className="font-mono text-sm">{item.slug}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.sort_order}</TableCell>
                      {selectedCatalogConfig?.specificFields.includes('bp_segment') && (
                        <TableCell>{item.bp_segment || '-'}</TableCell>
                      )}
                      {selectedCatalogConfig?.specificFields.includes('is_off') && (
                        <TableCell>
                          {item.is_off ? (
                            <Badge variant="secondary">Off</Badge>
                          ) : (
                            <Badge variant="outline">Ativo</Badge>
                          )}
                        </TableCell>
                      )}
                      {selectedCatalogConfig?.specificFields.includes('counts_as_operating') && (
                        <TableCell>
                          {item.counts_as_operating ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {item.active ? (
                          <Badge className="bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-catalog-item-${item.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {item.active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeactivate(item)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-deactivate-catalog-item-${item.id}`}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <AddEditCatalogItemDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        catalogName={selectedCatalog || ''}
        catalogConfig={selectedCatalogConfig || null}
        editingItem={editingItem}
      />
    </div>
  );
}

// ==================== FIELD REGISTRY CONTENT ====================
interface SystemField {
  id: number;
  field_key: string;
  label: string;
  entity: string;
  field_type: string;
  required: boolean;
  enum_catalog: string | null;
  default_value: string | null;
  help_text: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

function FieldRegistryContent() {
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const { data: fields = [], isLoading } = useQuery<SystemField[]>({
    queryKey: ['/api/admin/system-fields', entityFilter === 'all' ? '' : entityFilter],
    queryFn: async () => {
      const url = entityFilter === 'all' 
        ? '/api/admin/system-fields' 
        : `/api/admin/system-fields?entity=${entityFilter}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch system fields');
      return response.json();
    }
  });

  const getFieldTypeBadge = (type: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
      string: { variant: "outline", label: "Texto" },
      enum: { variant: "default", label: "Enum" },
      currency_cents: { variant: "secondary", label: "Moeda (cents)" },
      date: { variant: "secondary", label: "Data" },
      boolean: { variant: "outline", label: "Boolean" },
      integer: { variant: "outline", label: "Inteiro" },
    };
    const config = variants[type] || { variant: "outline", label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getEntityLabel = (entity: string) => {
    const labels: Record<string, string> = {
      client: 'Cliente',
      contract: 'Contrato',
    };
    return labels[entity] || entity;
  };

  return (
    <div className="space-y-6" data-testid="field-registry-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Registro de Campos do Sistema</h2>
          <p className="text-sm text-muted-foreground">
            Visualize todos os campos configurados para clientes e contratos
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm">Filtrar por entidade:</Label>
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-entity-filter">
            <SelectValue placeholder="Todas as entidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="filter-all">Todos</SelectItem>
            <SelectItem value="client" data-testid="filter-client">Cliente</SelectItem>
            <SelectItem value="contract" data-testid="filter-contract">Contrato</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto">
          {fields.length} campos
        </Badge>
      </div>

      <Card data-testid="card-field-registry">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : fields.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum campo encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave do Campo</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Obrigatório</TableHead>
                  <TableHead>Catálogo Enum</TableHead>
                  <TableHead>Ordem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id} data-testid={`row-field-${field.id}`}>
                    <TableCell className="font-mono text-sm">{field.field_key}</TableCell>
                    <TableCell>{field.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getEntityLabel(field.entity)}</Badge>
                    </TableCell>
                    <TableCell>{getFieldTypeBadge(field.field_type)}</TableCell>
                    <TableCell>
                      {field.required ? (
                        <Badge className="bg-amber-600 hover:bg-amber-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Sim
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          Não
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {field.enum_catalog ? (
                        <Badge 
                          variant="secondary" 
                          className="cursor-pointer hover-elevate"
                          data-testid={`badge-enum-catalog-${field.id}`}
                        >
                          <Layers className="h-3 w-3 mr-1" />
                          {field.enum_catalog}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{field.sort_order}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
  useSetPageInfo("Administração", "Controle de acesso e permissões de usuários");
  
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
          <TabsTrigger value="database" data-testid="tab-database">
            <Database className="h-4 w-4 mr-2" />
            Estrutura do Banco
          </TabsTrigger>
          <TabsTrigger value="ai-config" data-testid="tab-ai-config">
            <Bot className="h-4 w-4 mr-2" />
            Configurações IA
          </TabsTrigger>
          <TabsTrigger value="catalogs" data-testid="tab-catalogs">
            <Layers className="h-4 w-4 mr-2" />
            Catálogos
          </TabsTrigger>
          <TabsTrigger value="system-fields" data-testid="tab-system-fields">
            <FileText className="h-4 w-4 mr-2" />
            Registro de Campos
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
                  <TableHead>Perfil de Acesso</TableHead>
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
                      {user.role === 'admin' ? (
                        <Badge variant="default" data-testid={`badge-profile-${user.id}`}>
                          Control Tower
                        </Badge>
                      ) : (
                        (() => {
                          const profile = detectAccessProfile(user.allowedRoutes);
                          return profile ? (
                            <Badge variant={profile.variant} data-testid={`badge-profile-${user.id}`}>
                              {profile.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline" data-testid={`badge-profile-${user.id}`}>
                              Sem acesso
                            </Badge>
                          );
                        })()
                      )}
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

        <TabsContent value="database">
          <DatabaseExplorerContent />
        </TabsContent>

        <TabsContent value="ai-config">
          <AIConfigContent />
        </TabsContent>

        <TabsContent value="catalogs">
          <CatalogsContent />
        </TabsContent>

        <TabsContent value="system-fields">
          <FieldRegistryContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
