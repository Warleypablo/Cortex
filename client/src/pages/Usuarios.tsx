import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2 } from "lucide-react";
import type { User, UserPermission } from "@shared/schema";

const AVAILABLE_PAGES = [
  { slug: "clientes", label: "Clientes" },
  { slug: "contratos", label: "Contratos" },
  { slug: "colaboradores", label: "Colaboradores" },
  { slug: "colaboradores-analise", label: "Análise de Colaboradores" },
  { slug: "patrimonio", label: "Património" },
  { slug: "ferramentas", label: "Ferramentas" },
  { slug: "visao-geral", label: "Visão Geral" },
  { slug: "dashboard-financeiro", label: "Dashboard Financeiro" },
  { slug: "dashboard-geg", label: "Dashboard G&G" },
  { slug: "dashboard-retencao", label: "Análise de Retenção" },
  { slug: "dashboard-dfc", label: "DFC" },
];

type UserWithPermissions = User & {
  permissions: string[];
};

export default function Usuarios() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Redirect if not super admin
  useEffect(() => {
    if (!authLoading && !currentUser?.isSuperAdmin) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/ferramentas";
      }, 500);
    }
  }, [currentUser, authLoading, toast]);

  const { data: users, isLoading } = useQuery<UserWithPermissions[]>({
    queryKey: ["/api/users"],
    enabled: currentUser?.isSuperAdmin ?? false,
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: string[] }) => {
      await apiRequest("PATCH", `/api/users/${userId}/permissions`, { permissions });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Permissões Atualizadas",
        description: "As permissões do usuário foram atualizadas com sucesso.",
      });
      setEditingUserId(null);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar permissões.",
        variant: "destructive",
      });
    },
  });

  const handleEditPermissions = (user: UserWithPermissions) => {
    setEditingUserId(user.id);
    setSelectedPermissions(user.permissions);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setSelectedPermissions([]);
  };

  const handleSavePermissions = (userId: string) => {
    updatePermissionsMutation.mutate({ userId, permissions: selectedPermissions });
  };

  const togglePermission = (pageSlug: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(pageSlug)
        ? prev.filter((p) => p !== pageSlug)
        : [...prev, pageSlug]
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-users" />
      </div>
    );
  }

  if (!currentUser?.isSuperAdmin) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Gestão de Usuários
        </h1>
        <p className="text-muted-foreground mt-2" data-testid="text-page-description">
          Gerencie as permissões de acesso dos usuários às diferentes páginas do sistema
        </p>
      </div>

      <div className="grid gap-4">
        {users?.map((user) => {
          const isEditing = editingUserId === user.id;
          const displayPermissions = isEditing ? selectedPermissions : user.permissions;

          return (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">
                          {user.firstName} {user.lastName}
                        </CardTitle>
                        {user.isSuperAdmin && (
                          <Badge variant="default" className="gap-1" data-testid={`badge-super-admin-${user.id}`}>
                            <Shield className="w-3 h-3" />
                            Super Admin
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                  </div>

                  {!user.isSuperAdmin && !isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPermissions(user)}
                      data-testid={`button-edit-${user.id}`}
                    >
                      Editar Permissões
                    </Button>
                  )}
                </div>
              </CardHeader>

              {!user.isSuperAdmin && (
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Permissões de Acesso:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {AVAILABLE_PAGES.map((page) => {
                        const hasPermission = displayPermissions.includes(page.slug);
                        
                        return (
                          <div
                            key={page.slug}
                            className="flex items-center space-x-2"
                            data-testid={`permission-${page.slug}-${user.id}`}
                          >
                            <Checkbox
                              id={`${user.id}-${page.slug}`}
                              checked={hasPermission}
                              onCheckedChange={() => isEditing && togglePermission(page.slug)}
                              disabled={!isEditing}
                              data-testid={`checkbox-${page.slug}-${user.id}`}
                            />
                            <label
                              htmlFor={`${user.id}-${page.slug}`}
                              className={`text-sm ${isEditing ? "cursor-pointer" : "cursor-default"}`}
                            >
                              {page.label}
                            </label>
                          </div>
                        );
                      })}
                    </div>

                    {isEditing && (
                      <div className="flex gap-2 pt-4">
                        <Button
                          onClick={() => handleSavePermissions(user.id)}
                          disabled={updatePermissionsMutation.isPending}
                          data-testid={`button-save-${user.id}`}
                        >
                          {updatePermissionsMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Salvando...
                            </>
                          ) : (
                            "Salvar"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={updatePermissionsMutation.isPending}
                          data-testid={`button-cancel-${user.id}`}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
