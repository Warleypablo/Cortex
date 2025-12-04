import { useState } from "react";
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
import { format } from "date-fns";
import { Users, Database, Key, Shield, Edit, UserCog, ShieldCheck, ShieldOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
  role: 'admin' | 'user';
  allowedRoutes: string[];
}

interface DebugData {
  users: User[];
  allKeys: string[];
  count: number;
  totalKeys: number;
}

const AVAILABLE_ROUTES = [
  { path: '/', label: 'Clientes', category: 'Menu Principal' },
  { path: '/contratos', label: 'Contratos', category: 'Menu Principal' },
  { path: '/colaboradores', label: 'Colaboradores', category: 'Menu Principal' },
  { path: '/patrimonio', label: 'Patrimônio', category: 'Menu Principal' },
  { path: '/ferramentas', label: 'Ferramentas', category: 'Menu Principal' },
  { path: '/turbozap', label: 'TurboZap', category: 'Menu Principal' },
  { path: '/dashboard/financeiro', label: 'Visão Geral', category: 'Financeiro' },
  { path: '/dashboard/dfc', label: 'DFC', category: 'Financeiro' },
  { path: '/dashboard/fluxo-caixa', label: 'Fluxo de Caixa', category: 'Financeiro' },
  { path: '/dashboard/inadimplencia', label: 'Inadimplência', category: 'Financeiro' },
  { path: '/dashboard/auditoria-sistemas', label: 'Auditoria de Sistemas', category: 'Financeiro' },
  { path: '/dashboard/geg', label: 'Visão Geral', category: 'G&G' },
  { path: '/dashboard/inhire', label: 'Inhire', category: 'G&G' },
  { path: '/dashboard/recrutamento', label: 'Recrutamento', category: 'G&G' },
  { path: '/visao-geral', label: 'Visão Geral', category: 'Operação' },
  { path: '/dashboard/retencao', label: 'Análise de Retenção', category: 'Operação' },
  { path: '/dashboard/meta-ads', label: 'Meta Ads', category: 'Operação' },
  { path: '/dashboard/tech', label: 'Projetos', category: 'Tech' },
  { path: '/dashboard/comercial/closers', label: 'Closers', category: 'Comercial' },
  { path: '/dashboard/comercial/sdrs', label: 'SDRs', category: 'Comercial' },
  { path: '/dashboard/comercial/detalhamento-closers', label: 'Detalhamento Closers', category: 'Comercial' },
  { path: '/dashboard/comercial/analise-vendas', label: 'Análise de Vendas', category: 'Comercial' },
  { path: '/dashboard/comercial/apresentacao', label: 'Modo Apresentação', category: 'Comercial' },
  { path: '/admin/usuarios', label: 'Gerenciar Usuários', category: 'Administração' },
];

function EditPermissionsDialog({ user, open, onOpenChange }: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  const handleSave = () => {
    updatePermissionsMutation.mutate(selectedRoutes);
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
          <div className="flex items-center gap-2">
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={updatePermissionsMutation.isPending}
            data-testid="button-save"
          >
            {updatePermissionsMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsuarios() {
  const [editingUser, setEditingUser] = useState<User | null>(null);
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

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Gerenciar Usuários</h1>
          <p className="text-muted-foreground mt-2">
            Visualize todos os usuários cadastrados no sistema
          </p>
        </div>

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
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          Gerenciar Usuários
        </h1>
        <p className="text-muted-foreground mt-2">
          Controle de acesso e permissões de usuários
        </p>
      </div>

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
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
          <CardDescription>
            Gerencie permissões e controle de acesso dos usuários
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário cadastrado ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Páginas Permitidas</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.picture} alt={user.name} />
                          <AvatarFallback>
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium" data-testid={`text-name-${user.id}`}>
                            {user.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {user.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-email-${user.id}`}>
                      {user.email}
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
                    <TableCell data-testid={`text-created-${user.id}`}>
                      {(() => {
                        try {
                          const date = new Date(user.createdAt);
                          if (isNaN(date.getTime())) return '-';
                          return format(date, "dd/MM/yyyy 'às' HH:mm");
                        } catch {
                          return '-';
                        }
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.role !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar Permissões
                          </Button>
                        )}
                        <Button
                          variant={user.role === 'admin' ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => handleToggleRole(user)}
                          disabled={toggleRoleMutation.isPending}
                          data-testid={`button-toggle-role-${user.id}`}
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
        />
      )}
    </div>
  );
}
