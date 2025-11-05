import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  superAdminOnly?: boolean;
}

export function AuthGuard({ children, requiredPermission, superAdminOnly }: AuthGuardProps) {
  const { user, isLoading, isAuthenticated, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Não Autenticado",
        description: "Fazendo login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }

    // Check super admin requirement
    if (!isLoading && isAuthenticated && superAdminOnly && !isSuperAdmin) {
      toast({
        title: "Acesso Negado",
        description: "Esta página requer permissões de Super Admin.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/acesso-negado";
      }, 500);
      return;
    }

    // Check specific permission requirement
    if (!isLoading && isAuthenticated && requiredPermission && !isSuperAdmin) {
      const userPermissions = (user as any)?.permissions || [];
      const hasPermission = userPermissions.includes(requiredPermission);

      if (!hasPermission) {
        toast({
          title: "Acesso Negado",
          description: "Você não tem permissão para acessar esta página.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/acesso-negado";
        }, 500);
      }
    }
  }, [isLoading, isAuthenticated, isSuperAdmin, requiredPermission, superAdminOnly, user, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-auth" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (superAdminOnly && !isSuperAdmin) {
    return null;
  }

  if (requiredPermission && !isSuperAdmin) {
    const userPermissions = (user as any)?.permissions || [];
    if (!userPermissions.includes(requiredPermission)) {
      return null;
    }
  }

  return <>{children}</>;
}
