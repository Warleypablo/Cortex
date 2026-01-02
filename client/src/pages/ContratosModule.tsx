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
  ExternalLink,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Entidade {
  id: number;
  nome: string;
  tipo_pessoa: 'fisica' | 'juridica';
  cpf_cnpj: string | null;
  nome_socio: string | null;
  cpf_socio: string | null;
  email: string | null;
  telefone: string | null;
  email_cobranca: string | null;
  telefone_cobranca: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  eh_cliente: boolean;
  eh_fornecedor: boolean;
  observacoes: string | null;
  data_cadastro: string;
  data_atualizacao: string;
}

interface ContratoItem {
  id?: number;
  contrato_id?: number;
  plano_servico_id: number | null;
  plano_nome?: string;
  servico_nome?: string;
  descricao?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  valor_tabela?: number;
  modalidade: string | null;
  valor_original: number;
  valor_negociado: number;
  desconto_percentual: number;
  valor_final: number;
  economia: number;
  observacoes: string | null;
}

interface ContratoDoc {
  id: number;
  numero_contrato: string;
  id_crm: string | null;
  cliente_id: number | null;
  cliente_nome?: string;
  cliente_cpf_cnpj?: string;
  fornecedor_id: number | null;
  descricao: string | null;
  valor_total: number | null;
  data_inicio_recorrentes: string | null;
  data_inicio_cobranca_recorrentes: string | null;
  data_inicio_pontuais: string | null;
  data_inicio_cobranca_pontuais: string | null;
  status: string;
  observacoes: string | null;
  valor_original: number;
  valor_negociado: number;
  economia: number;
  desconto_percentual: number;
  comercial_nome: string | null;
  comercial_email: string | null;
  comercial_telefone: string | null;
  comercial_cargo: string | null;
  comercial_empresa: string | null;
  status_faturamento: string | null;
  assinafy_signed_document_url: string | null;
  assinafy_document_id: string | null;
  itens?: ContratoItem[];
  data_cadastro: string;
  data_atualizacao: string;
}

interface DashboardStats {
  entidades: {
    total: number;
    clientes: number;
    fornecedores: number;
    ambos: number;
  };
  contratos: {
    total: number;
    rascunhos: number;
    ativos: number;
    aguardando: number;
    cancelados: number;
    encerrados: number;
    faturados: number;
    pendentesFaturamento: number;
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
                <p className="text-3xl font-bold">{stats.entidades.total}</p>
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
    tipo_pessoa: 'juridica',
    eh_cliente: true,
    eh_fornecedor: false,
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
                value={formData.tipo_pessoa}
                onValueChange={(v) => setFormData({ ...formData, tipo_pessoa: v as 'fisica' | 'juridica' })}
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
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.eh_cliente || false}
                    onChange={(e) => setFormData({ ...formData, eh_cliente: e.target.checked })}
                  />
                  Cliente
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.eh_fornecedor || false}
                    onChange={(e) => setFormData({ ...formData, eh_fornecedor: e.target.checked })}
                  />
                  Fornecedor
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{formData.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ'}</Label>
              <Input
                data-testid="input-cpf-cnpj"
                value={formData.cpf_cnpj || ''}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value.replace(/\D/g, '') })}
                placeholder={formData.tipo_pessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
              />
            </div>

            <div className="space-y-2">
              <Label>{formData.tipo_pessoa === 'fisica' ? 'Nome Completo' : 'Razão Social'}</Label>
              <Input
                data-testid="input-nome-razao"
                value={formData.nome || ''}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                data-testid="input-email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail de Cobrança</Label>
              <Input
                data-testid="input-email-cobranca"
                type="email"
                value={formData.email_cobranca || ''}
                onChange={(e) => setFormData({ ...formData, email_cobranca: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                data-testid="input-telefone"
                value={formData.telefone || ''}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value.replace(/\D/g, '') })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone de Cobrança</Label>
              <Input
                data-testid="input-telefone-cobranca"
                value={formData.telefone_cobranca || ''}
                onChange={(e) => setFormData({ ...formData, telefone_cobranca: e.target.value.replace(/\D/g, '') })}
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
              <Label>Endereço</Label>
              <Input
                data-testid="input-endereco"
                value={formData.endereco || ''}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
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
              {(!data?.entidades || data.entidades.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma entidade encontrada
                  </TableCell>
                </TableRow>
              ) : (
                data.entidades.map((entidade) => (
                  <TableRow key={entidade.id} data-testid={`row-entidade-${entidade.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {entidade.tipo_pessoa === 'juridica' ? (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        {entidade.nome}
                      </div>
                    </TableCell>
                    <TableCell>{entidade.cpf_cnpj ? formatCpfCnpj(entidade.cpf_cnpj) : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {entidade.eh_cliente && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                            Cliente
                          </Badge>
                        )}
                        {entidade.eh_fornecedor && (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                            Fornecedor
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entidade.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{entidade.email}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {entidade.telefone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{formatPhone(entidade.telefone)}</span>
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
    numero_contrato: string;
    cliente_id: number | null;
    comercial_nome: string;
    comercial_email: string;
    id_crm: string;
    status: string;
    data_inicio_recorrentes: string;
    observacoes: string;
  }>({
    numero_contrato: contrato?.numero_contrato || '',
    cliente_id: contrato?.cliente_id || null,
    comercial_nome: contrato?.comercial_nome || '',
    comercial_email: contrato?.comercial_email || '',
    id_crm: contrato?.id_crm || '',
    status: contrato?.status || 'rascunho',
    data_inicio_recorrentes: contrato?.data_inicio_recorrentes ? contrato.data_inicio_recorrentes.split('T')[0] : '',
    observacoes: contrato?.observacoes || '',
  });

  const [itens, setItens] = useState<ContratoItem[]>(contrato?.itens || []);

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
      setFormData(prev => ({ ...prev, numero_contrato: proximoNumero.proximoNumero }));
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contratos/contratos', { contrato: formData, itens });
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
      const res = await apiRequest('PUT', `/api/contratos/contratos/${contrato?.id}`, { contrato: formData, itens });
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

  const addItem = () => {
    setItens([...itens, {
      id: 0,
      contrato_id: contrato?.id || 0,
      plano_servico_id: null,
      descricao: '',
      valor_tabela: 0,
      valor_unitario: 0,
      valor_total: 0,
      valor_original: 0,
      valor_negociado: 0,
      valor_final: 0,
      economia: 0,
      desconto_percentual: 0,
      quantidade: 1,
      modalidade: null,
      observacoes: null,
    }]);
  };

  const updateItem = (index: number, field: keyof ContratoItem, value: any) => {
    const updated = [...itens];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'valor_tabela' || field === 'valor_negociado') {
      const original = field === 'valor_tabela' ? value : updated[index].valor_tabela;
      const negociado = field === 'valor_negociado' ? value : updated[index].valor_negociado;
      const desconto = original > 0 ? ((original - negociado) / original) * 100 : 0;
      updated[index].desconto_percentual = desconto;
    }

    setItens(updated);
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
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
                value={formData.numero_contrato || proximoNumero?.proximoNumero || ''}
                onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
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
                value={formData.cliente_id?.toString() || ''}
                onValueChange={(v) => setFormData({ ...formData, cliente_id: parseInt(v) })}
              >
                <SelectTrigger data-testid="select-entidade-contrato">
                  <SelectValue placeholder="Selecione uma entidade" />
                </SelectTrigger>
                <SelectContent>
                  {entidadesData?.entidades.map((ent) => (
                    <SelectItem key={ent.id} value={ent.id.toString()}>
                      {ent.nome}
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
                value={formData.comercial_nome}
                onChange={(e) => setFormData({ ...formData, comercial_nome: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail Comercial</Label>
              <Input
                data-testid="input-comercial-email"
                type="email"
                value={formData.comercial_email}
                onChange={(e) => setFormData({ ...formData, comercial_email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ID CRM</Label>
              <Input
                data-testid="input-crm-bitrix"
                value={formData.id_crm}
                onChange={(e) => setFormData({ ...formData, id_crm: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Início Recorrentes</Label>
              <Input
                data-testid="input-data-inicio"
                type="date"
                value={formData.data_inicio_recorrentes}
                onChange={(e) => setFormData({ ...formData, data_inicio_recorrentes: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Itens do Contrato</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Item
              </Button>
            </div>

            {itens.map((item, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Descrição</Label>
                      <Input
                        data-testid={`input-item-descricao-${index}`}
                        value={item.descricao || ''}
                        onChange={(e) => updateItem(index, 'descricao', e.target.value)}
                        placeholder="Descrição do item"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade</Label>
                      <Input
                        data-testid={`input-item-quantidade-${index}`}
                        type="number"
                        value={item.quantidade}
                        onChange={(e) => updateItem(index, 'quantidade', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor Tabela</Label>
                      <Input
                        data-testid={`input-item-tabela-${index}`}
                        type="number"
                        step="0.01"
                        value={item.valor_tabela}
                        onChange={(e) => updateItem(index, 'valor_tabela', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor Negociado</Label>
                      <Input
                        data-testid={`input-item-negociado-${index}`}
                        type="number"
                        step="0.01"
                        value={item.valor_negociado}
                        onChange={(e) => updateItem(index, 'valor_negociado', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-sm">
                    <span className="text-muted-foreground">
                      Desconto: {(Number(item.desconto_percentual) || 0).toFixed(1)}%
                    </span>
                    <span className="text-green-500 font-medium">
                      Economia: {formatCurrency(((item.valor_tabela || 0) - item.valor_negociado) * item.quantidade)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeItem(index)}
                    data-testid={`button-remove-item-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}

            {itens.length > 0 && (
              <div className="flex justify-end text-sm">
                <span className="font-medium">
                  Total: {formatCurrency(itens.reduce((acc, i) => acc + (i.valor_negociado * i.quantidade), 0))}
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
      const data = await res.json();
      // Backend returns { contrato, itens }, merge them
      return { ...data.contrato, itens: data.itens };
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
              {(!data?.contratos || data.contratos.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum contrato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data.contratos.map((contrato) => (
                  <TableRow key={contrato.id} data-testid={`row-contrato-${contrato.id}`}>
                    <TableCell className="font-medium font-mono">
                      {contrato.numero_contrato}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{contrato.cliente_nome || '-'}</p>
                        {contrato.cliente_cpf_cnpj && (
                          <p className="text-xs text-muted-foreground">
                            {formatCpfCnpj(contrato.cliente_cpf_cnpj)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[contrato.status] || 'bg-gray-500/10'}>
                        {statusLabels[contrato.status] || contrato.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{contrato.comercial_nome || '-'}</TableCell>
                    <TableCell>
                      {contrato.data_inicio_recorrentes ? new Date(contrato.data_inicio_recorrentes).toLocaleDateString('pt-BR') : '-'}
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
                  <p className="font-mono font-medium">{contratoDetail.numero_contrato}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={statusColors[contratoDetail.status] || 'bg-gray-500/10'}>
                      {statusLabels[contratoDetail.status] || contratoDetail.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{contratoDetail.cliente_nome || '-'}</p>
                  {contratoDetail.cliente_cpf_cnpj && (
                    <p className="text-sm text-muted-foreground">
                      {formatCpfCnpj(contratoDetail.cliente_cpf_cnpj)}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Comercial Responsável</Label>
                  <p>{contratoDetail.comercial_nome || '-'}</p>
                  {contratoDetail.comercial_email && (
                    <p className="text-sm text-muted-foreground">{contratoDetail.comercial_email}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">ID CRM</Label>
                  <p>{contratoDetail.id_crm || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor Original</Label>
                  <p className="font-medium">{formatCurrency(Number(contratoDetail.valor_original) || 0)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor Negociado</Label>
                  <p className="font-medium text-green-500">{formatCurrency(Number(contratoDetail.valor_negociado) || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Data Início Recorrentes</Label>
                  <p>{contratoDetail.data_inicio_recorrentes ? new Date(contratoDetail.data_inicio_recorrentes).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data Cobrança Recorrentes</Label>
                  <p>{contratoDetail.data_inicio_cobranca_recorrentes ? new Date(contratoDetail.data_inicio_cobranca_recorrentes).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data Início Pontuais</Label>
                  <p>{contratoDetail.data_inicio_pontuais ? new Date(contratoDetail.data_inicio_pontuais).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data Cobrança Pontuais</Label>
                  <p>{contratoDetail.data_inicio_cobranca_pontuais ? new Date(contratoDetail.data_inicio_cobranca_pontuais).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
              </div>

              {contratoDetail.assinafy_document_id && (
                <div>
                  <Label className="text-muted-foreground">Documento Assinado</Label>
                  <a 
                    href={`/api/contratos/assinafy/download/${contratoDetail.assinafy_document_id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver documento assinado
                  </a>
                </div>
              )}

              {contratoDetail.itens && contratoDetail.itens.length > 0 && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Itens do Contrato</Label>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead className="text-right">Valor Tabela</TableHead>
                          <TableHead className="text-right">Valor Negociado</TableHead>
                          <TableHead className="text-right">Desconto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contratoDetail.itens.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.descricao || '-'}</TableCell>
                            <TableCell>{item.quantidade}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.valor_tabela || 0)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(item.valor_negociado)}</TableCell>
                            <TableCell className="text-right text-green-500">
                              {(Number(item.desconto_percentual) || 0).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={3} className="font-medium">Total</TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(contratoDetail.itens.reduce((acc, i) => acc + (i.valor_negociado * i.quantidade), 0))}
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
