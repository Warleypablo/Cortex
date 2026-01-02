import { useState, useMemo, useDeferredValue, useCallback, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Loader2,
  FileCheck,
  Briefcase,
  DollarSign,
  Eye,
  X,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Entidade {
  id: number;
  tipoPessoa: 'fisica' | 'juridica';
  cpfCnpj: string;
  nomeRazaoSocial: string;
  emailPrincipal: string | null;
  emailCobranca: string | null;
  telefonePrincipal: string | null;
  telefoneCobranca: string | null;
  cep: string | null;
  numero: string | null;
  logradouro: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string | null;
  estado: string | null;
  tipoEntidade: 'cliente' | 'fornecedor' | 'ambos';
  observacoes: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

interface ContratoServico {
  id?: number;
  servicoNome: string;
  plano: string | null;
  valorOriginal: number;
  valorNegociado: number;
  descontoPercentual: number;
  valorFinal: number;
  economia: number;
  modalidade: string | null;
}

interface ContratoDoc {
  id: number;
  numeroContrato: string;
  entidadeId: number;
  entidadeNome: string;
  entidadeCpfCnpj: string;
  comercialResponsavel: string | null;
  comercialResponsavelEmail: string | null;
  idCrmBitrix: string | null;
  status: 'rascunho' | 'ativo' | 'pausado' | 'cancelado' | 'encerrado';
  dataInicio: string | null;
  dataFim: string | null;
  observacoes: string | null;
  servicos?: ContratoServico[];
  criadoEm: string;
  atualizadoEm: string;
}

interface DashboardStats {
  entidades: {
    totalAtivas: number;
    clientes: number;
    fornecedores: number;
    ambos: number;
  };
  contratos: {
    total: number;
    rascunhos: number;
    ativos: number;
    pausados: number;
    cancelados: number;
    encerrados: number;
  };
  valorTotalAtivos: number;
}

const statusColors: Record<string, string> = {
  rascunho: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  ativo: "bg-green-500/10 text-green-500 border-green-500/20",
  pausado: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  cancelado: "bg-red-500/10 text-red-500 border-red-500/20",
  encerrado: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  pausado: "Pausado",
  cancelado: "Cancelado",
  encerrado: "Encerrado",
};

const formatCpfCnpj = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
};

function DashboardTab() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/contratos/dashboard'],
  });

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entidades Ativas</p>
                <p className="text-3xl font-bold">{stats.entidades.totalAtivas}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex gap-2 text-xs text-muted-foreground">
              <span>{stats.entidades.clientes} clientes</span>
              <span>•</span>
              <span>{stats.entidades.fornecedores} fornecedores</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contratos Ativos</p>
                <p className="text-3xl font-bold">{stats.contratos.ativos}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              de {stats.contratos.total} contratos totais
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total Ativos</p>
                <p className="text-3xl font-bold">{formatCurrency(stats.valorTotalAtivos)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-orange-500" />
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Soma de todos os serviços ativos
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rascunhos</p>
                <p className="text-3xl font-bold">{stats.contratos.rascunhos}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gray-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-gray-500" />
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Contratos pendentes de assinatura
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status dos Contratos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.contratos)
                .filter(([key]) => key !== 'total')
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColors[status]}>
                        {statusLabels[status]}
                      </Badge>
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipos de Entidades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>Clientes</span>
                </div>
                <span className="font-medium">{stats.entidades.clientes}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>Fornecedores</span>
                </div>
                <span className="font-medium">{stats.entidades.fornecedores}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Ambos</span>
                </div>
                <span className="font-medium">{stats.entidades.ambos}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const EntidadeFormDialog = memo(function EntidadeFormDialog({
  open,
  onOpenChange,
  entidade,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidade: Entidade | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Entidade>>({
    tipoPessoa: 'juridica',
    tipoEntidade: 'cliente',
    ativo: true,
    ...entidade,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Entidade>) => {
      const res = await apiRequest('POST', '/api/contratos/entidades', data);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Entidade criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/entidades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/dashboard'] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar entidade", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Entidade>) => {
      const res = await apiRequest('PUT', `/api/contratos/entidades/${entidade?.id}`, data);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Entidade atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/entidades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/dashboard'] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar entidade", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entidade) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entidade ? 'Editar Entidade' : 'Nova Entidade'}</DialogTitle>
          <DialogDescription>
            {entidade ? 'Atualize os dados da entidade' : 'Cadastre um novo cliente ou fornecedor'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Pessoa</Label>
              <Select
                value={formData.tipoPessoa}
                onValueChange={(v) => setFormData({ ...formData, tipoPessoa: v as 'fisica' | 'juridica' })}
              >
                <SelectTrigger data-testid="select-tipo-pessoa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                  <SelectItem value="fisica">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Entidade</Label>
              <Select
                value={formData.tipoEntidade}
                onValueChange={(v) => setFormData({ ...formData, tipoEntidade: v as 'cliente' | 'fornecedor' | 'ambos' })}
              >
                <SelectTrigger data-testid="select-tipo-entidade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{formData.tipoPessoa === 'fisica' ? 'CPF' : 'CNPJ'}</Label>
              <Input
                data-testid="input-cpf-cnpj"
                value={formData.cpfCnpj || ''}
                onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value.replace(/\D/g, '') })}
                placeholder={formData.tipoPessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{formData.tipoPessoa === 'fisica' ? 'Nome Completo' : 'Razão Social'}</Label>
              <Input
                data-testid="input-nome-razao"
                value={formData.nomeRazaoSocial || ''}
                onChange={(e) => setFormData({ ...formData, nomeRazaoSocial: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-mail Principal</Label>
              <Input
                data-testid="input-email-principal"
                type="email"
                value={formData.emailPrincipal || ''}
                onChange={(e) => setFormData({ ...formData, emailPrincipal: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail de Cobrança</Label>
              <Input
                data-testid="input-email-cobranca"
                type="email"
                value={formData.emailCobranca || ''}
                onChange={(e) => setFormData({ ...formData, emailCobranca: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone Principal</Label>
              <Input
                data-testid="input-telefone-principal"
                value={formData.telefonePrincipal || ''}
                onChange={(e) => setFormData({ ...formData, telefonePrincipal: e.target.value.replace(/\D/g, '') })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone de Cobrança</Label>
              <Input
                data-testid="input-telefone-cobranca"
                value={formData.telefoneCobranca || ''}
                onChange={(e) => setFormData({ ...formData, telefoneCobranca: e.target.value.replace(/\D/g, '') })}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input
                data-testid="input-cep"
                value={formData.cep || ''}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value.replace(/\D/g, '') })}
                placeholder="00000-000"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Logradouro</Label>
              <Input
                data-testid="input-logradouro"
                value={formData.logradouro || ''}
                onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Número</Label>
              <Input
                data-testid="input-numero"
                value={formData.numero || ''}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input
                data-testid="input-bairro"
                value={formData.bairro || ''}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                data-testid="input-cidade"
                value={formData.cidade || ''}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Input
                data-testid="input-estado"
                value={formData.estado || ''}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                maxLength={2}
                placeholder="UF"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              data-testid="textarea-observacoes"
              value={formData.observacoes || ''}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-entidade">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {entidade ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

function EntidadesTab() {
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntidade, setSelectedEntidade] = useState<Entidade | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ entidades: Entidade[] }>({
    queryKey: ['/api/contratos/entidades', tipoFilter, deferredSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tipoFilter !== 'todos') params.set('tipo', tipoFilter);
      if (deferredSearch) params.set('search', deferredSearch);
      params.set('ativo', 'true');
      const res = await fetch(`/api/contratos/entidades?${params}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/contratos/entidades/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Entidade desativada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/entidades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/dashboard'] });
    },
  });

  const handleEdit = useCallback((entidade: Entidade) => {
    setSelectedEntidade(entidade);
    setDialogOpen(true);
  }, []);

  const handleNew = useCallback(() => {
    setSelectedEntidade(null);
    setDialogOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search-entidades"
              placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-72"
            />
          </div>

          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-40" data-testid="select-tipo-filter">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="cliente">Clientes</SelectItem>
              <SelectItem value="fornecedor">Fornecedores</SelectItem>
              <SelectItem value="ambos">Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleNew} data-testid="button-nova-entidade">
          <Plus className="mr-2 h-4 w-4" />
          Nova Entidade
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome/Razão Social</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.entidades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma entidade encontrada
                  </TableCell>
                </TableRow>
              ) : (
                data?.entidades.map((entidade) => (
                  <TableRow key={entidade.id} data-testid={`row-entidade-${entidade.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {entidade.tipoPessoa === 'juridica' ? (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        {entidade.nomeRazaoSocial}
                      </div>
                    </TableCell>
                    <TableCell>{formatCpfCnpj(entidade.cpfCnpj)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        entidade.tipoEntidade === 'cliente' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        entidade.tipoEntidade === 'fornecedor' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                        'bg-orange-500/10 text-orange-500 border-orange-500/20'
                      }>
                        {entidade.tipoEntidade === 'cliente' ? 'Cliente' :
                         entidade.tipoEntidade === 'fornecedor' ? 'Fornecedor' : 'Ambos'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entidade.emailPrincipal && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{entidade.emailPrincipal}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {entidade.telefonePrincipal && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{formatPhone(entidade.telefonePrincipal)}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(entidade)}
                          data-testid={`button-edit-entidade-${entidade.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(entidade.id)}
                          data-testid={`button-delete-entidade-${entidade.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <EntidadeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entidade={selectedEntidade}
        onSuccess={() => {}}
      />
    </div>
  );
}

const ContratoFormDialog = memo(function ContratoFormDialog({
  open,
  onOpenChange,
  contrato,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: ContratoDoc | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<{
    numeroContrato: string;
    entidadeId: number | null;
    comercialResponsavel: string;
    comercialResponsavelEmail: string;
    idCrmBitrix: string;
    status: string;
    dataInicio: string;
    dataFim: string;
    observacoes: string;
  }>({
    numeroContrato: contrato?.numeroContrato || '',
    entidadeId: contrato?.entidadeId || null,
    comercialResponsavel: contrato?.comercialResponsavel || '',
    comercialResponsavelEmail: contrato?.comercialResponsavelEmail || '',
    idCrmBitrix: contrato?.idCrmBitrix || '',
    status: contrato?.status || 'rascunho',
    dataInicio: contrato?.dataInicio ? contrato.dataInicio.split('T')[0] : '',
    dataFim: contrato?.dataFim ? contrato.dataFim.split('T')[0] : '',
    observacoes: contrato?.observacoes || '',
  });

  const [servicos, setServicos] = useState<ContratoServico[]>(contrato?.servicos || []);

  const { data: proximoNumero } = useQuery<{ proximoNumero: string }>({
    queryKey: ['/api/contratos/proximo-numero'],
    enabled: !contrato,
  });

  const { data: entidadesData } = useQuery<{ entidades: Entidade[] }>({
    queryKey: ['/api/contratos/entidades'],
    queryFn: async () => {
      const res = await fetch('/api/contratos/entidades?ativo=true');
      return res.json();
    },
  });

  useState(() => {
    if (!contrato && proximoNumero) {
      setFormData(prev => ({ ...prev, numeroContrato: proximoNumero.proximoNumero }));
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contratos/contratos', { contrato: formData, servicos });
      return res;
    },
    onSuccess: () => {
      toast({ title: "Contrato criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/proximo-numero'] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar contrato", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PUT', `/api/contratos/contratos/${contrato?.id}`, { contrato: formData, servicos });
      return res;
    },
    onSuccess: () => {
      toast({ title: "Contrato atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/dashboard'] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar contrato", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contrato) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const addServico = () => {
    setServicos([...servicos, {
      servicoNome: '',
      plano: null,
      valorOriginal: 0,
      valorNegociado: 0,
      descontoPercentual: 0,
      valorFinal: 0,
      economia: 0,
      modalidade: null,
    }]);
  };

  const updateServico = (index: number, field: keyof ContratoServico, value: any) => {
    const updated = [...servicos];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'valorOriginal' || field === 'valorNegociado') {
      const original = field === 'valorOriginal' ? value : updated[index].valorOriginal;
      const negociado = field === 'valorNegociado' ? value : updated[index].valorNegociado;
      const desconto = original > 0 ? ((original - negociado) / original) * 100 : 0;
      updated[index].descontoPercentual = desconto;
      updated[index].valorFinal = negociado;
      updated[index].economia = original - negociado;
    }

    setServicos(updated);
  };

  const removeServico = (index: number) => {
    setServicos(servicos.filter((_, i) => i !== index));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contrato ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
          <DialogDescription>
            {contrato ? 'Atualize os dados do contrato' : 'Crie um novo contrato para um cliente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Número do Contrato</Label>
              <Input
                data-testid="input-numero-contrato"
                value={formData.numeroContrato || proximoNumero?.proximoNumero || ''}
                onChange={(e) => setFormData({ ...formData, numeroContrato: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger data-testid="select-status-contrato">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cliente/Entidade</Label>
              <Select
                value={formData.entidadeId?.toString() || ''}
                onValueChange={(v) => setFormData({ ...formData, entidadeId: parseInt(v) })}
              >
                <SelectTrigger data-testid="select-entidade-contrato">
                  <SelectValue placeholder="Selecione uma entidade" />
                </SelectTrigger>
                <SelectContent>
                  {entidadesData?.entidades.map((ent) => (
                    <SelectItem key={ent.id} value={ent.id.toString()}>
                      {ent.nomeRazaoSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Comercial Responsável</Label>
              <Input
                data-testid="input-comercial-responsavel"
                value={formData.comercialResponsavel}
                onChange={(e) => setFormData({ ...formData, comercialResponsavel: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail Comercial</Label>
              <Input
                data-testid="input-comercial-email"
                type="email"
                value={formData.comercialResponsavelEmail}
                onChange={(e) => setFormData({ ...formData, comercialResponsavelEmail: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>ID CRM Bitrix</Label>
              <Input
                data-testid="input-crm-bitrix"
                value={formData.idCrmBitrix}
                onChange={(e) => setFormData({ ...formData, idCrmBitrix: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Input
                data-testid="input-data-inicio"
                type="date"
                value={formData.dataInicio}
                onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Fim</Label>
              <Input
                data-testid="input-data-fim"
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Serviços do Contrato</Label>
              <Button type="button" variant="outline" size="sm" onClick={addServico} data-testid="button-add-servico">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Serviço
              </Button>
            </div>

            {servicos.map((servico, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Serviço</Label>
                      <Input
                        data-testid={`input-servico-nome-${index}`}
                        value={servico.servicoNome}
                        onChange={(e) => updateServico(index, 'servicoNome', e.target.value)}
                        placeholder="Nome do serviço"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Plano</Label>
                      <Input
                        data-testid={`input-servico-plano-${index}`}
                        value={servico.plano || ''}
                        onChange={(e) => updateServico(index, 'plano', e.target.value)}
                        placeholder="Plano/tier"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor Original</Label>
                      <Input
                        data-testid={`input-servico-original-${index}`}
                        type="number"
                        step="0.01"
                        value={servico.valorOriginal}
                        onChange={(e) => updateServico(index, 'valorOriginal', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor Negociado</Label>
                      <Input
                        data-testid={`input-servico-negociado-${index}`}
                        type="number"
                        step="0.01"
                        value={servico.valorNegociado}
                        onChange={(e) => updateServico(index, 'valorNegociado', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-sm">
                    <span className="text-muted-foreground">
                      Desconto: {servico.descontoPercentual.toFixed(1)}%
                    </span>
                    <span className="text-green-500 font-medium">
                      Economia: {formatCurrency(servico.economia)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeServico(index)}
                    data-testid={`button-remove-servico-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}

            {servicos.length > 0 && (
              <div className="flex justify-end text-sm">
                <span className="font-medium">
                  Total: {formatCurrency(servicos.reduce((acc, s) => acc + s.valorFinal, 0))}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              data-testid="textarea-observacoes-contrato"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-contrato">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {contrato ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

function ContratosTab() {
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<ContratoDoc | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ contratos: ContratoDoc[] }>({
    queryKey: ['/api/contratos/contratos', statusFilter, deferredSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'todos') params.set('status', statusFilter);
      if (deferredSearch) params.set('search', deferredSearch);
      const res = await fetch(`/api/contratos/contratos?${params}`);
      return res.json();
    },
  });

  const { data: contratoDetail } = useQuery<ContratoDoc>({
    queryKey: ['/api/contratos/contratos', selectedContrato?.id],
    queryFn: async () => {
      const res = await fetch(`/api/contratos/contratos/${selectedContrato?.id}`);
      return res.json();
    },
    enabled: !!selectedContrato && viewDialogOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/contratos/contratos/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Contrato excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/dashboard'] });
    },
  });

  const handleEdit = useCallback((contrato: ContratoDoc) => {
    setSelectedContrato(contrato);
    setDialogOpen(true);
  }, []);

  const handleView = useCallback((contrato: ContratoDoc) => {
    setSelectedContrato(contrato);
    setViewDialogOpen(true);
  }, []);

  const handleNew = useCallback(() => {
    setSelectedContrato(null);
    setDialogOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search-contratos"
              placeholder="Buscar por número, cliente ou responsável..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-72"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleNew} data-testid="button-novo-contrato">
          <Plus className="mr-2 h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Data Início</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.contratos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum contrato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data?.contratos.map((contrato) => (
                  <TableRow key={contrato.id} data-testid={`row-contrato-${contrato.id}`}>
                    <TableCell className="font-medium font-mono">
                      {contrato.numeroContrato}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{contrato.entidadeNome}</p>
                        {contrato.entidadeCpfCnpj && (
                          <p className="text-xs text-muted-foreground">
                            {formatCpfCnpj(contrato.entidadeCpfCnpj)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[contrato.status]}>
                        {statusLabels[contrato.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{contrato.comercialResponsavel || '-'}</TableCell>
                    <TableCell>
                      {contrato.dataInicio ? new Date(contrato.dataInicio).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleView(contrato)}
                          data-testid={`button-view-contrato-${contrato.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(contrato)}
                          data-testid={`button-edit-contrato-${contrato.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(contrato.id)}
                          data-testid={`button-delete-contrato-${contrato.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <ContratoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contrato={selectedContrato}
        onSuccess={() => {}}
      />

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Contrato</DialogTitle>
          </DialogHeader>

          {contratoDetail && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Número do Contrato</Label>
                  <p className="font-mono font-medium">{contratoDetail.numeroContrato}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={statusColors[contratoDetail.status]}>
                      {statusLabels[contratoDetail.status]}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{contratoDetail.entidadeNome}</p>
                  {contratoDetail.entidadeCpfCnpj && (
                    <p className="text-sm text-muted-foreground">
                      {formatCpfCnpj(contratoDetail.entidadeCpfCnpj)}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Comercial Responsável</Label>
                  <p>{contratoDetail.comercialResponsavel || '-'}</p>
                  {contratoDetail.comercialResponsavelEmail && (
                    <p className="text-sm text-muted-foreground">{contratoDetail.comercialResponsavelEmail}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Data de Início</Label>
                  <p>{contratoDetail.dataInicio ? new Date(contratoDetail.dataInicio).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data de Fim</Label>
                  <p>{contratoDetail.dataFim ? new Date(contratoDetail.dataFim).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ID CRM Bitrix</Label>
                  <p>{contratoDetail.idCrmBitrix || '-'}</p>
                </div>
              </div>

              {contratoDetail.servicos && contratoDetail.servicos.length > 0 && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Serviços</Label>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Serviço</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Valor Original</TableHead>
                          <TableHead className="text-right">Valor Final</TableHead>
                          <TableHead className="text-right">Desconto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contratoDetail.servicos.map((servico, index) => (
                          <TableRow key={index}>
                            <TableCell>{servico.servicoNome}</TableCell>
                            <TableCell>{servico.plano || '-'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(servico.valorOriginal)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(servico.valorFinal)}</TableCell>
                            <TableCell className="text-right text-green-500">
                              {servico.descontoPercentual.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={3} className="font-medium">Total</TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(contratoDetail.servicos.reduce((acc, s) => acc + s.valorFinal, 0))}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}

              {contratoDetail.observacoes && (
                <div>
                  <Label className="text-muted-foreground">Observações</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{contratoDetail.observacoes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ContratosModule() {
  usePageTitle("Contratos");
  useSetPageInfo("Contratos", "Gestão de entidades e contratos");

  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="p-6 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-fit" data-testid="tabs-contratos">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <FileText className="mr-2 h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="entidades" data-testid="tab-entidades">
            <Users className="mr-2 h-4 w-4" />
            Entidades
          </TabsTrigger>
          <TabsTrigger value="contratos" data-testid="tab-contratos">
            <Briefcase className="mr-2 h-4 w-4" />
            Contratos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab />
        </TabsContent>

        <TabsContent value="entidades" className="mt-6">
          <EntidadesTab />
        </TabsContent>

        <TabsContent value="contratos" className="mt-6">
          <ContratosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
