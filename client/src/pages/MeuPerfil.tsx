import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePageInfo } from "@/contexts/PageContext";

interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface ColaboradorData {
  colaboradorId: number;
}

export default function MeuPerfil() {
  const [, setLocation] = useLocation();
  const { setPageInfo } = usePageInfo();

  useEffect(() => {
    setPageInfo("Meu Perfil", "Carregando informações do colaborador...");
  }, [setPageInfo]);

  const { data: user, isLoading: isLoadingUser } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: colaboradorData, isLoading: isLoadingColaborador, isError } = useQuery<ColaboradorData>({
    queryKey: ["/api/colaboradores/by-user", user?.id],
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (colaboradorData?.colaboradorId) {
      setLocation(`/colaborador/${colaboradorData.colaboradorId}`);
    }
  }, [colaboradorData, setLocation]);

  if (isLoadingUser || isLoadingColaborador) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="loading-meu-perfil">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Carregando seu perfil...</p>
      </div>
    );
  }

  if (!colaboradorData?.colaboradorId || isError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <UserX className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>Perfil não vinculado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Seu usuário ({user?.email}) ainda não está vinculado a um colaborador no sistema.
            </p>
            <p className="text-sm text-muted-foreground">
              Entre em contato com a administração para vincular seu perfil.
            </p>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-voltar-home"
            >
              Voltar para a Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
