import { MessageSquare, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TurboZap() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">TurboZap</h1>
        <p className="text-muted-foreground">
          Central de cobranças via WhatsApp
        </p>
      </div>

      <Card className="border-2 border-dashed">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <div className="relative">
              <MessageSquare className="w-8 h-8 text-primary" />
              <Zap className="w-4 h-4 text-primary absolute -top-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-2xl">Módulo em Desenvolvimento</CardTitle>
          <CardDescription className="text-base mt-2">
            O TurboZap será sua central de cobranças automatizada via WhatsApp para gestão de clientes inadimplentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="grid gap-4 md:grid-cols-3 text-left">
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2 text-foreground">Mensagens Automatizadas</h3>
              <p className="text-sm text-muted-foreground">
                Envio programado de lembretes e cobranças
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2 text-foreground">Gestão de Inadimplência</h3>
              <p className="text-sm text-muted-foreground">
                Acompanhamento e controle de cobranças
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2 text-foreground">Integração WhatsApp</h3>
              <p className="text-sm text-muted-foreground">
                Comunicação direta com clientes
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground pt-4">
            Em breve, esta funcionalidade estará disponível.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
