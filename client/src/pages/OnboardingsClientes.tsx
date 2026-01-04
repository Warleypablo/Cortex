import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  UserPlus, 
  Building2, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  ChevronRight
} from "lucide-react";

interface ClienteUnificado {
  id: number;
  nome: string;
  cnpj: string | null;
  fonte: 'conta_azul' | 'clickup';
  status?: string;
}

interface OnboardingCliente {
  id: number;
  clienteId: number;
  clienteNome: string;
  dataInicio: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  progresso: number;
  responsavel: string | null;
}

function formatCNPJ(cnpj: string | null | undefined) {
  if (!cnpj) return "-";
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'concluido':
      return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Concluído</Badge>;
    case 'em_andamento':
      return <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="w-3 h-3 mr-1" />Em Andamento</Badge>;
    case 'pendente':
    default:
      return <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
  }
}

export default function OnboardingsClientes() {
  usePageTitle("Onboardings de Clientes");
  useSetPageInfo({
    title: "Onboardings de Clientes",
    breadcrumbs: [
      { label: "Operação" },
      { label: "Onboardings" }
    ]
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<ClienteUnificado | null>(null);

  const { data: clientes = [], isLoading: isLoadingClientes } = useQuery<ClienteUnificado[]>({
    queryKey: ["/api/operacao/clientes-unificados", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const response = await fetch(`/api/operacao/clientes-unificados?search=${encodeURIComponent(searchQuery)}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const { data: onboardings = [], isLoading: isLoadingOnboardings } = useQuery<OnboardingCliente[]>({
    queryKey: ["/api/operacao/onboardings-clientes"],
    queryFn: async () => {
      const response = await fetch("/api/operacao/onboardings-clientes", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch onboardings");
      return response.json();
    },
  });

  const onboardingsEmAndamento = onboardings.filter(o => o.status === 'em_andamento').length;
  const onboardingsConcluidos = onboardings.filter(o => o.status === 'concluido').length;
  const onboardingsPendentes = onboardings.filter(o => o.status === 'pendente').length;

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onboardings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{onboardingsEmAndamento}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{onboardingsConcluidos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{onboardingsPendentes}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Buscar Cliente para Onboarding
              </CardTitle>
              <CardDescription>Pesquise por nome ou CNPJ no Conta Azul e ClickUp</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Digite o nome ou CNPJ do cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-cliente-onboarding"
            />
          </div>

          {isLoadingClientes && searchQuery.length >= 2 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoadingClientes && clientes.length > 0 && (
            <div className="mt-4 border rounded-md max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente) => (
                    <TableRow 
                      key={`${cliente.fonte}-${cliente.id}`}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedCliente(cliente)}
                      data-testid={`row-cliente-${cliente.fonte}-${cliente.id}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          {cliente.nome}
                        </div>
                      </TableCell>
                      <TableCell>{formatCNPJ(cliente.cnpj)}</TableCell>
                      <TableCell>
                        <Badge variant={cliente.fonte === 'conta_azul' ? 'default' : 'secondary'}>
                          {cliente.fonte === 'conta_azul' ? 'Conta Azul' : 'ClickUp'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoadingClientes && searchQuery.length >= 2 && clientes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum cliente encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Onboardings Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingOnboardings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : onboardings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum onboarding ativo</p>
              <p className="text-sm">Busque um cliente acima para iniciar um novo onboarding</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onboardings.map((onboarding) => (
                  <TableRow key={onboarding.id} data-testid={`row-onboarding-${onboarding.id}`}>
                    <TableCell className="font-medium">{onboarding.clienteNome}</TableCell>
                    <TableCell>{new Date(onboarding.dataInicio).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{getStatusBadge(onboarding.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={onboarding.progresso} className="w-24 h-2" />
                        <span className="text-sm text-muted-foreground">{onboarding.progresso}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{onboarding.responsavel || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
