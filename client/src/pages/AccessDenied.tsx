import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";

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

export default function AccessDenied() {
  usePageTitle("Acesso Negado");
  const [, setLocation] = useLocation();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const goToAllowedRoute = () => {
    if (user?.allowedRoutes && user.allowedRoutes.length > 0) {
      setLocation(user.allowedRoutes[0]);
    } else {
      setLocation('/ferramentas');
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Acesso Negado</CardTitle>
          <CardDescription>
            Você não tem permissão para acessar esta página
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground text-center">
            Entre em contato com um administrador se você acredita que deveria ter acesso a esta página.
          </p>
          <Button onClick={goToAllowedRoute} data-testid="button-go-back">
            Ir para Página Inicial
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
