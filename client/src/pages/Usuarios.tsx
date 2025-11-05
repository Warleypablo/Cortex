import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, Trash2, Settings, Loader2 } from "lucide-react";
import { availablePages, type PageName } from "@shared/schema";

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  createdAt: string;
}

interface UserWithPermissions extends User {
  permissions: string[];
}

const pageLabels: Record<string, string> = {
  "clientes": "Clientes",
  "contratos": "Contratos",
  "colaboradores": "Colaboradores",
  "patrimonio": "Patrimônio",
  "dashboard-financeiro": "Dashboard Financeiro",
  "dashboard-geg": "Dashboard G&G",
  "dashboard-retencao": "Análise de Retenção",
  "dashboard-dfc": "DFC",
  "usuarios": "Usuários",
};

export default function Usuarios() {
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: currentUserPermissions } = useQuery<string[]>({
    queryKey: ["/api/users", selectedUser?.id, "permissions"],
    enabled: !!selectedUser,
    queryFn: async () => {
      return selectedUser?.role === "super_admin" 
        ? availablePages.slice() 
        : [];
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: string[] }) => {
      const response = await fetch(`/api/users/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!response.ok) throw new Error("Failed to update permissions");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setSelectedUser(null);
      toast({
        title: "Permissões atualizadas",
        description: "As permissões do usuário foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar permissões",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserToDelete(null);
      toast({
        title: "Usuário removido",
        description: "O usuário foi removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenPermissions = (user: User) => {
    const userWithPerms: UserWithPermissions = {
      ...user,
      permissions: user.role === "super_admin" ? availablePages.slice() : [],
    };
    setSelectedUser(userWithPerms);
    setPermissions(userWithPerms.permissions);
  };

  const handleSavePermissions = () => {
    if (!selectedUser) return;
    updatePermissionsMutation.mutate({
      userId: selectedUser.id,
      permissions,
    });
  };

  const togglePermission = (page: string) => {
    setPermissions((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-usuarios">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Gerenciamento de Usuários
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie permissões e acesso dos usuários ao sistema
        </p>
      </div>

      <div className="grid gap-4">
        {users?.map((user) => (
          <Card key={user.id} data-testid={`card-user-${user.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {user.name
                        ? user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : user.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {user.name || user.email}
                      {user.role === "super_admin" && (
                        <Badge variant="default" className="gap-1">
                          <Shield className="w-3 h-3" />
                          Super Admin
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {user.role !== "super_admin" && (
                    <>
                      <Dialog open={selectedUser?.id === user.id} onOpenChange={(open) => !open && setSelectedUser(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPermissions(user)}
                            data-testid={`button-permissions-${user.id}`}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Permissões
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Gerenciar Permissões</DialogTitle>
                            <DialogDescription>
                              Selecione quais páginas {selectedUser?.name || selectedUser?.email} pode acessar
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4 py-4">
                            <div className="space-y-3">
                              {availablePages
                                .filter((page) => page !== "usuarios")
                                .map((page) => (
                                  <div key={page} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`perm-${page}`}
                                      checked={permissions.includes(page)}
                                      onCheckedChange={() => togglePermission(page)}
                                      data-testid={`checkbox-${page}`}
                                    />
                                    <label
                                      htmlFor={`perm-${page}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                      {pageLabels[page] || page}
                                    </label>
                                  </div>
                                ))}
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedUser(null)}
                                data-testid="button-cancel-permissions"
                              >
                                Cancelar
                              </Button>
                              <Button
                                onClick={handleSavePermissions}
                                disabled={updatePermissionsMutation.isPending}
                                data-testid="button-save-permissions"
                              >
                                {updatePermissionsMutation.isPending && (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                )}
                                Salvar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserToDelete(user)}
                        data-testid={`button-delete-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{userToDelete?.name || userToDelete?.email}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
