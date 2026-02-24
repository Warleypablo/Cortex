import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, BarChart3, MessageSquare, FileText, Activity, FileBarChart, Download, Loader2 } from "lucide-react";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";

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
  usePageTitle("Ferramentas");
  useSetPageInfo("Ferramentas", "Acesse as ferramentas e sistemas da Turbo Partners");

  const now = new Date();
  const [mesSelecionado, setMesSelecionado] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [gerando, setGerando] = useState(false);

  const handleFerramentaClick = (url: string) => {
    if (url !== "#") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleGerarPdf = () => {
    setGerando(true);
    const mes = `${mesSelecionado.year}-${String(mesSelecionado.month).padStart(2, "0")}`;
    window.open(`/api/relatorio-mensal/pdf?mes=${mes}`, "_blank");
    setTimeout(() => setGerando(false), 3000);
  };

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Card especial: Relatório Mensal */}
          <Card className="border-primary/20 dark:border-primary/30 transition-all" data-testid="card-relatorio-mensal">
            <CardHeader className="gap-2 space-y-0">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileBarChart className="w-6 h-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-xl mt-4">Relatório Mensal</CardTitle>
              <CardDescription>Gere o relatório financeiro mensal em PDF com 11 indicadores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <MonthYearPicker
                  value={mesSelecionado}
                  onChange={setMesSelecionado}
                  triggerClassName="w-full"
                />
                <Button
                  onClick={handleGerarPdf}
                  disabled={gerando}
                  className="w-full gap-2"
                  data-testid="button-gerar-pdf"
                >
                  {gerando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Gerar PDF
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cards de ferramentas externas */}
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
