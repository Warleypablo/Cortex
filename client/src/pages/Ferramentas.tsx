import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, BarChart3, MessageSquare, FileText, Activity } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";

interface Ferramenta {
  id: string;
  nome: string;
  descricao: string;
  url: string;
  icon: typeof BarChart3;
}

const ferramentas: Ferramenta[] = [
  {
    id: "1",
    nome: "Moniturbo",
    descricao: "Sistema de monitoramento e análise de performance",
    url: "https://moniturbo.turbopartners.com.br/",
    icon: Activity,
  },
  {
    id: "3",
    nome: "UGC Hub",
    descricao: "Central de conteúdo gerado por usuários",
    url: "#",
    icon: MessageSquare,
  },
  {
    id: "4",
    nome: "Sistema de Contratos",
    descricao: "Gestão completa de contratos e documentos",
    url: "https://contratos.turbopartners.com.br",
    icon: FileText,
  },
  {
    id: "5",
    nome: "Turbo Commerce",
    descricao: "Dashboard de métricas e KPIs de e-commerce",
    url: "https://app.turbodash.com.br/",
    icon: BarChart3,
  },
];

export default function Ferramentas() {
  useSetPageInfo("Ferramentas", "Acesse as ferramentas e sistemas da Turbo Partners");
  
  const handleFerramentaClick = (url: string) => {
    if (url !== "#") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ferramentas.map((ferramenta) => {
            const IconComponent = ferramenta.icon;
            return (
              <Card
                key={ferramenta.id}
                className="hover-elevate cursor-pointer transition-all"
                onClick={() => handleFerramentaClick(ferramenta.url)}
                data-testid={`card-ferramenta-${ferramenta.id}`}
              >
                <CardHeader className="gap-2 space-y-0">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <IconComponent className="w-6 h-6 text-primary" />
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-xl mt-4" data-testid={`text-nome-${ferramenta.id}`}>
                    {ferramenta.nome}
                  </CardTitle>
                  <CardDescription data-testid={`text-descricao-${ferramenta.id}`}>
                    {ferramenta.descricao}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    {ferramenta.url !== "#" ? (
                      <span className="text-primary">Clique para acessar →</span>
                    ) : (
                      <span>Em breve</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
