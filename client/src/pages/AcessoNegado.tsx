import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AcessoNegado() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-destructive" data-testid="icon-access-denied" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold mb-2" data-testid="text-title">
          Acesso Negado
        </h1>
        
        <p className="text-muted-foreground mb-6" data-testid="text-description">
          Você não tem permissão para acessar esta página. Entre em contato com o administrador para solicitar acesso.
        </p>
        
        <Button
          onClick={() => window.location.href = "/ferramentas"}
          data-testid="button-go-home"
        >
          Voltar para Ferramentas
        </Button>
      </Card>
    </div>
  );
}
