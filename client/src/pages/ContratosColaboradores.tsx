import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  User,
  Building2,
  MapPin,
  Download,
  Eye,
  Printer,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Colaborador {
  id: number;
  nome: string;
  cpf: string | null;
  cnpj: string | null;
  endereco: string | null;
  estado: string | null;
  cargo: string | null;
  setor: string | null;
  admissao: string | null;
}

const CLAUSULAS_CONTRATO = `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Entre as partes:

CONTRATANTE: TURBO PARTNERS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº XX.XXX.XXX/0001-XX, com sede na Rua XXXXXXXX, nº XXX, Bairro XXXXXXXX, Cidade - Estado, CEP XXXXX-XXX.

CONTRATADO(A): {{NOME}}, pessoa física/jurídica, inscrita no CPF/CNPJ sob o nº {{CPF_CNPJ}}, residente/sediada em {{ENDERECO}}, {{ESTADO}}.

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de {{CARGO}} pelo CONTRATADO(A) à CONTRATANTE.

CLÁUSULA SEGUNDA - DO PRAZO
O presente contrato terá vigência a partir de {{DATA_ADMISSAO}}, por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias.

CLÁUSULA TERCEIRA - DA REMUNERAÇÃO
Pela prestação dos serviços, a CONTRATANTE pagará ao CONTRATADO(A) o valor acordado entre as partes, conforme definido em documento anexo.

CLÁUSULA QUARTA - DAS OBRIGAÇÕES DO CONTRATADO
4.1 Prestar os serviços com zelo, dedicação e competência;
4.2 Cumprir os prazos estabelecidos;
4.3 Manter sigilo sobre informações confidenciais;
4.4 Comunicar previamente qualquer impedimento na execução dos serviços.

CLÁUSULA QUINTA - DAS OBRIGAÇÕES DO CONTRATANTE
5.1 Fornecer as condições necessárias para a execução dos serviços;
5.2 Efetuar os pagamentos nas datas acordadas;
5.3 Disponibilizar informações necessárias para a execução dos trabalhos.

CLÁUSULA SEXTA - DA CONFIDENCIALIDADE
O CONTRATADO(A) compromete-se a manter absoluto sigilo sobre todas as informações a que tiver acesso durante a vigência deste contrato, sob pena de responsabilização civil e criminal.

CLÁUSULA SÉTIMA - DO FORO
As partes elegem o foro da Comarca de São Paulo/SP para dirimir quaisquer questões oriundas do presente contrato.

E, por estarem assim justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor e forma.

Local e Data: São Paulo, {{DATA_ATUAL}}



___________________________________
TURBO PARTNERS LTDA
CONTRATANTE



___________________________________
{{NOME}}
CONTRATADO(A)
`;

export default function ContratosColaboradores() {
  useSetPageInfo("Contratos Colaboradores", "Geração de contratos para colaboradores");
  usePageTitle("Contratos Colaboradores | Turbo Cortex");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data, isLoading } = useQuery<{ colaboradores: Colaborador[] }>({
    queryKey: ["/api/juridico/colaboradores-contrato"],
  });

  const colaboradores = data?.colaboradores || [];

  const filteredColaboradores = useMemo(() => {
    if (!searchTerm) return colaboradores;
    const term = searchTerm.toLowerCase();
    return colaboradores.filter(
      (c) =>
        c.nome?.toLowerCase().includes(term) ||
        c.cpf?.includes(term) ||
        c.cnpj?.includes(term) ||
        c.cargo?.toLowerCase().includes(term)
    );
  }, [colaboradores, searchTerm]);

  const gerarContrato = (colaborador: Colaborador) => {
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const dataAdmissao = colaborador.admissao
      ? format(new Date(colaborador.admissao), "dd/MM/yyyy", { locale: ptBR })
      : "a definir";

    return CLAUSULAS_CONTRATO
      .replace(/\{\{NOME\}\}/g, colaborador.nome || "")
      .replace(/\{\{CPF_CNPJ\}\}/g, colaborador.cnpj || colaborador.cpf || "Não informado")
      .replace(/\{\{ENDERECO\}\}/g, colaborador.endereco || "Não informado")
      .replace(/\{\{ESTADO\}\}/g, colaborador.estado || "")
      .replace(/\{\{CARGO\}\}/g, colaborador.cargo || "Prestador de Serviços")
      .replace(/\{\{DATA_ADMISSAO\}\}/g, dataAdmissao)
      .replace(/\{\{DATA_ATUAL\}\}/g, dataAtual);
  };

  const handlePrint = () => {
    if (!selectedColaborador) return;
    const conteudo = gerarContrato(selectedColaborador);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Contrato - ${selectedColaborador.nome}</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; }
              pre { white-space: pre-wrap; font-family: 'Times New Roman', serif; font-size: 14px; }
            </style>
          </head>
          <body>
            <pre>${conteudo}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    if (!selectedColaborador) return;
    const conteudo = gerarContrato(selectedColaborador);
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Contrato_${selectedColaborador.nome.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Contratos Colaboradores</h1>
          <p className="text-muted-foreground">Gere contratos de prestação de serviços para colaboradores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Selecionar Colaborador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF, CNPJ ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-colaborador"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredColaboradores.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum colaborador encontrado
                </p>
              ) : (
                filteredColaboradores.map((colaborador) => (
                  <div
                    key={colaborador.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover-elevate ${
                      selectedColaborador?.id === colaborador.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    onClick={() => {
                      setSelectedColaborador(colaborador);
                      setShowPreview(true);
                    }}
                    data-testid={`card-colaborador-${colaborador.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{colaborador.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {colaborador.cargo || "Cargo não informado"}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{colaborador.cnpj || colaborador.cpf || "-"}</p>
                        <p>{colaborador.setor || "-"}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview do Contrato
              </span>
              {selectedColaborador && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrint}
                    data-testid="button-print-contrato"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDownload}
                    data-testid="button-download-contrato"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Baixar
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedColaborador ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>Selecione um colaborador para visualizar o contrato</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Nome</p>
                      <p className="font-medium">{selectedColaborador.nome}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                      <p className="font-medium">
                        {selectedColaborador.cnpj || selectedColaborador.cpf || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Endereço</p>
                      <p className="font-medium">
                        {selectedColaborador.endereco || "Não informado"}
                        {selectedColaborador.estado && ` - ${selectedColaborador.estado}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto p-4 bg-card border rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {gerarContrato(selectedColaborador)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
