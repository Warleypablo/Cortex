import { MessageSquare, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";

export default function TurboZap() {
  usePageTitle("TurboZap");
  useSetPageInfo("TurboZap", "Central de cobranças via WhatsApp");
  
  return (
    <div className="p-6 max-w-4xl mx-auto">

      <Card className="border-2 border-dashed" data-testid="card-turbozap-placeholder">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4" data-testid="icon-turbozap">
            <div className="relative">
              <MessageSquare className="w-8 h-8 text-primary" />
              <Zap className="w-4 h-4 text-primary absolute -top-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-2xl" data-testid="text-development-status">Módulo em Desenvolvimento</CardTitle>
          <CardDescription className="text-base mt-2" data-testid="text-turbozap-description">
            O TurboZap será sua central de cobranças automatizada via WhatsApp para gestão de clientes inadimplentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="grid gap-4 md:grid-cols-3 text-left">
            <div className="p-4 rounded-lg bg-muted/50" data-testid="card-feature-messages">
              <h3 className="font-semibold mb-2 text-foreground" data-testid="text-feature-messages-title">Mensagens Automatizadas</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-messages-desc">
                Envio programado de lembretes e cobranças
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50" data-testid="card-feature-management">
              <h3 className="font-semibold mb-2 text-foreground" data-testid="text-feature-management-title">Gestão de Inadimplência</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-management-desc">
                Acompanhamento e controle de cobranças
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50" data-testid="card-feature-integration">
              <h3 className="font-semibold mb-2 text-foreground" data-testid="text-feature-integration-title">Integração WhatsApp</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-integration-desc">
                Comunicação direta com clientes
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground pt-4" data-testid="text-coming-soon">
            Em breve, esta funcionalidade estará disponível.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
