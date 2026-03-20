import { useState, useEffect, useMemo, useDeferredValue, useCallback, memo } from "react";
import { EntregaveisChecklist } from "@/components/EntregaveisChecklist";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, cn } from "@/lib/utils";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Download,
  Send,
  RefreshCw,
  Sparkles,
  Check,
  ChevronsUpDown,
  Settings,
  ChevronDown,
  ChevronRight,
  Package,
  Bookmark,
  Copy,
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

interface ColaboradorDropdownItem {
  id: number;
  nome: string;
  email_turbo: string | null;
  status: string | null;
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
  servico_id?: number | null;
  escopo?: string;
  is_personalizado?: boolean;
  data_inicio?: string | null;
  data_fim?: string | null;
  data_inicio_cobranca?: string | null;
  data_fim_cobranca?: string | null;
  forma_pagamento?: string | null;
  num_parcelas?: number | null;
  valor_parcela?: number | null;
}

interface Servico {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface PlanoServico {
  id: number;
  servico_id: number;
  nome: string;
  escopo: string | null;
  diretrizes: string | null;
  valor: number;
  periodicidade: string | null;
  ativo: boolean;
  servico_nome?: string;
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
  "enviado para assinatura": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  assinado: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  pausado: "Pausado",
  cancelado: "Cancelado",
  encerrado: "Encerrado",
  "enviado para assinatura": "Enviado para Assinatura",
  assinado: "Assinado",
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Contratos</p>
            <p className="text-2xl font-bold">{stats?.contratos.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.contratos.ativos ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Receita Ativa</p>
            <p className="text-2xl font-bold">{formatCurrency(stats?.valorTotalAtivos ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rascunhos</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.contratos.rascunhos ?? 0}</p>
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
    if (!formData.eh_cliente && !formData.eh_fornecedor) {
      toast({ title: "Selecione pelo menos um tipo: Cliente ou Fornecedor", variant: "destructive" });
      return;
    }
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
              <Label>{formData.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ'} <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-cpf-cnpj"
                value={formData.cpf_cnpj || ''}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value.replace(/\D/g, '') })}
                placeholder={formData.tipo_pessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{formData.tipo_pessoa === 'fisica' ? 'Nome Completo' : 'Razão Social'} <span className="text-destructive">*</span></Label>
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
              <Label>E-mail <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail de Cobrança <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-email-cobranca"
                type="email"
                value={formData.email_cobranca || ''}
                onChange={(e) => setFormData({ ...formData, email_cobranca: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-telefone"
                value={formData.telefone || ''}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value.replace(/\D/g, '') })}
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone de Cobrança <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-telefone-cobranca"
                value={formData.telefone_cobranca || ''}
                onChange={(e) => setFormData({ ...formData, telefone_cobranca: e.target.value.replace(/\D/g, '') })}
                placeholder="(00) 00000-0000"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>CEP <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-cep"
                value={formData.cep || ''}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value.replace(/\D/g, '') })}
                placeholder="00000-000"
                required
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Endereço <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-endereco"
                value={formData.endereco || ''}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Número <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-numero"
                value={formData.numero || ''}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Bairro <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-bairro"
                value={formData.bairro || ''}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Cidade <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-cidade"
                value={formData.cidade || ''}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Estado <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-estado"
                value={formData.estado || ''}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                maxLength={2}
                placeholder="UF"
                required
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
    <div className="space-y-6">
      {/* Barra de pesquisa e filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-entidades"
                  placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 w-80"
                />
              </div>

              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-44" data-testid="select-tipo-filter">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="cliente">Apenas Clientes</SelectItem>
                  <SelectItem value="fornecedor">Apenas Fornecedores</SelectItem>
                  <SelectItem value="ambos">Cliente e Fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleNew} data-testid="button-nova-entidade">
              <Plus className="mr-2 h-4 w-4" />
              Nova Entidade
            </Button>
          </div>
        </CardContent>
      </Card>

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
    observacoes: string;
  }>({
    numero_contrato: contrato?.numero_contrato || '',
    cliente_id: contrato?.cliente_id || null,
    comercial_nome: contrato?.comercial_nome || '',
    comercial_email: contrato?.comercial_email || '',
    id_crm: contrato?.id_crm || '',
    status: contrato?.status || 'rascunho',
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

  const { data: colaboradoresDropdown } = useQuery<ColaboradorDropdownItem[]>({
    queryKey: ['/api/colaboradores/dropdown'],
  });

  const colaboradoresAtivos = useMemo(() =>
    (colaboradoresDropdown || []).filter(c => c.status?.toLowerCase() === 'ativo'),
    [colaboradoresDropdown]
  );

  const [comercialOpen, setComercialOpen] = useState(false);

  const { data: servicosData } = useQuery<{ servicos: Servico[] }>({
    queryKey: ['/api/contratos/servicos'],
  });

  const [selectedServicoId, setSelectedServicoId] = useState<number | null>(null);

  const { data: planosData } = useQuery<{ planos: PlanoServico[] }>({
    queryKey: ['/api/contratos/planos-servicos', selectedServicoId],
    queryFn: async () => {
      const params = selectedServicoId ? `?servico_id=${selectedServicoId}` : '';
      const res = await fetch(`/api/contratos/planos-servicos${params}`);
      return res.json();
    },
    enabled: !!selectedServicoId,
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

  const revisarIAMutation = useMutation({
    mutationFn: async (observacoes: string) => {
      const res = await apiRequest('POST', '/api/contratos/revisar-observacoes', { observacoes });
      return res.json() as Promise<{ observacoesRevisadas: string }>;
    },
    onSuccess: (data) => {
      setFormData(prev => ({ ...prev, observacoes: data.observacoesRevisadas }));
      toast({ title: "Observações revisadas com sucesso", description: "O texto foi aprimorado para maior proteção jurídica." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao revisar observações", description: error.message, variant: "destructive" });
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
      servico_id: null,
      descricao: '',
      escopo: '',
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
      is_personalizado: false,
      data_inicio: null,
      data_fim: null,
      data_inicio_cobranca: null,
      data_fim_cobranca: null,
      forma_pagamento: 'Boleto',
      num_parcelas: null,
      valor_parcela: null,
    }]);
  };

  const handleServicoChange = (index: number, servicoId: number) => {
    const updated = [...itens];
    updated[index] = {
      ...updated[index],
      servico_id: servicoId,
      plano_servico_id: null,
      escopo: '',
      valor_tabela: 0,
      valor_negociado: 0,
      is_personalizado: false,
    };
    setItens(updated);
    setSelectedServicoId(servicoId);
  };

  const handlePlanoChange = (index: number, planoId: string) => {
    const updated = [...itens];
    
    if (planoId === 'personalizado') {
      updated[index] = {
        ...updated[index],
        plano_servico_id: null,
        is_personalizado: true,
        descricao: 'Plano Personalizado',
        escopo: '',
        valor_tabela: 0,
        valor_negociado: 0,
      };
    } else {
      const plano = planosData?.planos.find(p => p.id === parseInt(planoId));
      if (plano) {
        updated[index] = {
          ...updated[index],
          plano_servico_id: plano.id,
          is_personalizado: false,
          descricao: plano.nome,
          escopo: plano.escopo || '',
          valor_tabela: plano.valor,
          valor_negociado: plano.valor,
          plano_nome: plano.nome,
        };
      }
    }
    setItens(updated);
  };

  const updateItem = (index: number, field: keyof ContratoItem, value: any) => {
    const updated = [...itens];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'valor_tabela' || field === 'valor_negociado' || field === 'desconto_percentual') {
      const original = updated[index].valor_tabela || 0;
      let negociado = updated[index].valor_negociado || 0;
      
      if (field === 'desconto_percentual') {
        negociado = original * (1 - (value / 100));
        updated[index].valor_negociado = negociado;
      } else {
        const desconto = original > 0 ? ((original - negociado) / original) * 100 : 0;
        updated[index].desconto_percentual = desconto;
      }
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
              <Popover open={comercialOpen} onOpenChange={setComercialOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comercialOpen}
                    className="w-full justify-between font-normal"
                    data-testid="input-comercial-responsavel"
                  >
                    {formData.comercial_nome || "Selecione um colaborador..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar colaborador..." />
                    <CommandList>
                      <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                      <CommandGroup>
                        {colaboradoresAtivos.map((col) => (
                          <CommandItem
                            key={col.id}
                            value={col.nome}
                            onSelect={() => {
                              setFormData({
                                ...formData,
                                comercial_nome: col.nome,
                                comercial_email: col.email_turbo || '',
                              });
                              setComercialOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.comercial_nome === col.nome ? "opacity-100" : "opacity-0")} />
                            {col.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>E-mail Comercial</Label>
              <Input
                data-testid="input-comercial-email"
                type="email"
                value={formData.comercial_email}
                readOnly
                className="bg-muted"
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
              <Card key={index} className="p-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Serviço</Label>
                      <Select
                        value={item.servico_id?.toString() || ''}
                        onValueChange={(v) => handleServicoChange(index, parseInt(v))}
                      >
                        <SelectTrigger data-testid={`select-item-servico-${index}`}>
                          <SelectValue placeholder="Selecione um serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {servicosData?.servicos.map((srv) => (
                            <SelectItem key={srv.id} value={srv.id.toString()}>
                              {srv.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Plano</Label>
                      <Select
                        value={item.is_personalizado ? 'personalizado' : (item.plano_servico_id?.toString() || '')}
                        onValueChange={(v) => handlePlanoChange(index, v)}
                        disabled={!item.servico_id}
                      >
                        <SelectTrigger data-testid={`select-item-plano-${index}`}>
                          <SelectValue placeholder={item.servico_id ? "Selecione um plano" : "Selecione um serviço primeiro"} />
                        </SelectTrigger>
                        <SelectContent>
                          {planosData?.planos.filter(p => p.servico_id === item.servico_id).map((plano) => (
                            <SelectItem key={plano.id} value={plano.id.toString()}>
                              {plano.nome} - {formatCurrency(plano.valor)}
                            </SelectItem>
                          ))}
                          <SelectItem value="personalizado">
                            Personalizado
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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

                {(item.plano_servico_id || item.is_personalizado) && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {item.is_personalizado ? "Escopo Personalizado" : "Escopo do Plano"}
                      </Label>
                      <Textarea
                        data-testid={`textarea-item-escopo-${index}`}
                        value={item.escopo || ''}
                        onChange={(e) => updateItem(index, 'escopo', e.target.value)}
                        placeholder={item.is_personalizado ? "Descreva o escopo do serviço personalizado..." : "Escopo padrão do plano (editável para personalizar)"}
                        rows={3}
                        className="text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Base</Label>
                        <Input
                          data-testid={`input-item-tabela-${index}`}
                          type="number"
                          step="0.01"
                          value={item.valor_tabela || 0}
                          onChange={(e) => updateItem(index, 'valor_tabela', parseFloat(e.target.value) || 0)}
                          disabled={!item.is_personalizado}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Desconto (%)</Label>
                        <Input
                          data-testid={`input-item-desconto-${index}`}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={(Number(item.desconto_percentual) || 0).toFixed(1)}
                          onChange={(e) => updateItem(index, 'desconto_percentual', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Final</Label>
                        <Input
                          data-testid={`input-item-negociado-${index}`}
                          type="number"
                          step="0.01"
                          value={item.valor_negociado || 0}
                          onChange={(e) => updateItem(index, 'valor_negociado', parseFloat(e.target.value) || 0)}
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
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Prestação de Serviço</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Início</Label>
                          <Input
                            type="date"
                            value={item.data_inicio || ''}
                            onChange={(e) => updateItem(index, 'data_inicio', e.target.value || null)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fim</Label>
                          <Input
                            type="date"
                            value={item.data_fim || ''}
                            onChange={(e) => updateItem(index, 'data_fim', e.target.value || null)}
                          />
                        </div>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">Cobrança</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Início</Label>
                          <Input
                            type="date"
                            value={item.data_inicio_cobranca || ''}
                            onChange={(e) => updateItem(index, 'data_inicio_cobranca', e.target.value || null)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fim</Label>
                          <Input
                            type="date"
                            value={item.data_fim_cobranca || ''}
                            onChange={(e) => updateItem(index, 'data_fim_cobranca', e.target.value || null)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className={`grid ${item.modalidade === 'recorrente' ? 'grid-cols-1' : 'grid-cols-3'} gap-3`}>
                      <div className="space-y-1">
                        <Label className="text-xs">Forma de Pagamento</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={item.forma_pagamento || 'Boleto'}
                          onChange={(e) => updateItem(index, 'forma_pagamento', e.target.value)}
                        >
                          <option value="Boleto">Boleto</option>
                          <option value="PIX">PIX</option>
                          <option value="Cartão">Cartão</option>
                          <option value="Transferência">Transferência</option>
                        </select>
                      </div>
                      {item.modalidade !== 'recorrente' && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Nº Parcelas</Label>
                            <Input
                              type="number"
                              min={1}
                              value={item.num_parcelas || ''}
                              onChange={(e) => updateItem(index, 'num_parcelas', e.target.value ? Number(e.target.value) : null)}
                              placeholder="Ex: 12"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Valor Parcela</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={item.valor_parcela || ''}
                              onChange={(e) => updateItem(index, 'valor_parcela', e.target.value ? Number(e.target.value) : null)}
                              placeholder="R$ 0,00"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex justify-end gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Economia: <span className="text-green-500 dark:text-green-400 font-medium">{formatCurrency(((item.valor_tabela || 0) - (item.valor_negociado || 0)) * item.quantidade)}</span>
                      </span>
                      <span className="font-medium">
                        Subtotal: {formatCurrency((item.valor_negociado || 0) * item.quantidade)}
                      </span>
                    </div>
                  </div>
                )}
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
            <div className="flex items-center justify-between">
              <Label>Observações</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => revisarIAMutation.mutate(formData.observacoes)}
                disabled={revisarIAMutation.isPending || !formData.observacoes?.trim()}
                data-testid="button-revisar-ia-contrato"
              >
                {revisarIAMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Revisão de IA
              </Button>
            </div>
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

function ContratosTab({ onDuplicate }: { onDuplicate?: (data: NovoContratoInitialData) => void }) {
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

  const enviarAssinaturaMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/contratos/${id}/enviar-assinatura`);
      return await res.json();
    },
    onSuccess: (data: { emailEnviado?: string }) => {
      toast({
        title: "Contrato enviado para assinatura",
        description: data.emailEnviado ? `Email enviado para: ${data.emailEnviado}` : "Contrato enviado com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos'] });
      queryClient.invalidateQueries({ queryKey: ["contratos-na-rua"] });
      setViewDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao enviar para assinatura", 
        description: error.message || "Verifique se a entidade possui email de cobrança cadastrado",
        variant: "destructive"
      });
    },
  });

  const verificarStatusMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/contratos/${id}/status-assinatura`);
      return res.json();
    },
    onSuccess: (data: { status?: string; assinafyStatus?: string; mensagem?: string }) => {
      const statusLabel = data.status === 'assinado' ? 'Assinado' : 
                         data.status === 'recusado' ? 'Recusado' : 
                         data.assinafyStatus || 'Aguardando assinatura';
      toast({ 
        title: "Status atualizado", 
        description: `Status atual: ${statusLabel}`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos', selectedContrato?.id] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao verificar status", 
        description: error.message,
        variant: "destructive"
      });
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

  const handleDuplicate = async (contrato: ContratoDoc) => {
    try {
      const res = await fetch(`/api/contratos/contratos/${contrato.id}`);
      if (!res.ok) throw new Error('Erro ao buscar contrato');
      const data = await res.json();
      const full = data.contrato as ContratoDoc;
      const fullItens = (data.itens || full.itens || []) as ContratoItem[];

      onDuplicate?.({
        formData: {
          cliente_id: full.cliente_id,
          comercial_nome: full.comercial_nome || '',
          comercial_email: full.comercial_email || '',
          id_crm: full.id_crm || '',
          observacoes: full.observacoes || '',
        },
        itens: fullItens,
        source: 'duplicate',
      });
    } catch {
      toast({ title: "Erro ao duplicar contrato", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de pesquisa e filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-contratos"
                  placeholder="Buscar por número, cliente ou responsável..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 w-80"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44" data-testid="select-status-filter">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
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
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Número</TableHead>
                <TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Valor Negociado</TableHead>
                <TableHead className="font-semibold">Responsável</TableHead>
                <TableHead className="font-semibold">Data Início</TableHead>
                <TableHead className="w-28 font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!data?.contratos || data.contratos.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-lg font-medium">Nenhum contrato encontrado</p>
                    <p className="text-sm">Tente ajustar os filtros ou criar um novo contrato</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.contratos.map((contrato) => (
                  <TableRow 
                    key={contrato.id} 
                    data-testid={`row-contrato-${contrato.id}`}
                    className="hover-elevate cursor-pointer transition-colors"
                    onClick={() => handleView(contrato)}
                  >
                    <TableCell className="font-mono text-sm font-semibold">
                      {contrato.numero_contrato}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{contrato.cliente_nome || '-'}</p>
                          {contrato.cliente_cpf_cnpj && (
                            <p className="text-xs text-muted-foreground">
                              {formatCpfCnpj(contrato.cliente_cpf_cnpj)}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[contrato.status] || 'bg-gray-500/10'}>
                        {statusLabels[contrato.status] || contrato.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(Number(contrato.valor_negociado) || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{contrato.comercial_nome || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contrato.data_inicio_recorrentes ? new Date(contrato.data_inicio_recorrentes).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {(contrato.status === 'enviado para assinatura' || contrato.assinafy_document_id) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => verificarStatusMutation.mutate(contrato.id)}
                            disabled={verificarStatusMutation.isPending}
                            data-testid={`button-atualizar-status-${contrato.id}`}
                            title="Atualizar status da assinatura"
                            className="text-xs"
                          >
                            {verificarStatusMutation.isPending ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            Atualizar
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleView(contrato)}
                          data-testid={`button-view-contrato-${contrato.id}`}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(contrato)}
                          data-testid={`button-edit-contrato-${contrato.id}`}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Duplicar contrato"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(contrato);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(contrato.id)}
                          data-testid={`button-delete-contrato-${contrato.id}`}
                          title="Excluir"
                          className="text-destructive hover:text-destructive"
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {contratoDetail && (
            <>
              {/* Header */}
              <DialogHeader className="p-6 pb-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">Contrato {contratoDetail.numero_contrato}</DialogTitle>
                    {contratoDetail.id_crm && <p className="text-sm text-muted-foreground">CRM: {contratoDetail.id_crm}</p>}
                  </div>
                  <Badge
                    variant="outline"
                    className={`${statusColors[contratoDetail.status] || 'bg-gray-500/10'} text-base px-4 py-1`}
                  >
                    {statusLabels[contratoDetail.status] || contratoDetail.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/contratos/${contratoDetail.id}/gerar-pdf`, '_blank');
                    }}
                    data-testid="button-gerar-pdf"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Gerar PDF
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => enviarAssinaturaMutation.mutate(contratoDetail.id)}
                    disabled={enviarAssinaturaMutation.isPending || contratoDetail.status === 'enviado para assinatura' || contratoDetail.status === 'assinado'}
                    data-testid="button-enviar-assinatura"
                  >
                    {enviarAssinaturaMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar para Assinatura
                  </Button>
                  {(contratoDetail.status === 'enviado para assinatura' || contratoDetail.assinafy_document_id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => verificarStatusMutation.mutate(contratoDetail.id)}
                      disabled={verificarStatusMutation.isPending}
                      data-testid="button-verificar-status"
                    >
                      {verificarStatusMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Verificar Status
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => {
                    handleDuplicate(selectedContrato!);
                    setViewDialogOpen(false);
                  }}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicar
                  </Button>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-6">
                {/* Valores inline */}
                <div className="flex items-center gap-6 py-3 px-4 bg-muted/30 rounded-lg">
                  <div>
                    <span className="text-sm text-muted-foreground">Original</span>
                    <p className="font-semibold">{formatCurrency(Number(contratoDetail.valor_original) || 0)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Negociado</span>
                    <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(Number(contratoDetail.valor_negociado) || 0)}</p>
                  </div>
                  {(Number(contratoDetail.economia) || 0) > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Economia</span>
                      <p className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(Number(contratoDetail.economia) || 0)}</p>
                    </div>
                  )}
                </div>

                {/* Informações principais em duas colunas */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Cliente */}
                  <Card className="p-4">
                    <Label className="text-sm font-semibold mb-3 block">Cliente</Label>
                    <div className="space-y-2">
                      <p className="font-medium text-lg">{contratoDetail.cliente_nome || '-'}</p>
                      {contratoDetail.cliente_cpf_cnpj && (
                        <p className="text-sm text-muted-foreground font-mono">
                          {formatCpfCnpj(contratoDetail.cliente_cpf_cnpj)}
                        </p>
                      )}
                    </div>
                  </Card>

                  {/* Comercial */}
                  <Card className="p-4">
                    <Label className="text-sm font-semibold mb-3 block">Comercial Responsável</Label>
                    <div className="space-y-2">
                      <p className="font-medium text-lg">{contratoDetail.comercial_nome || '-'}</p>
                      {contratoDetail.comercial_email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {contratoDetail.comercial_email}
                        </div>
                      )}
                      {contratoDetail.comercial_telefone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contratoDetail.comercial_telefone}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Datas removidas - agora são por serviço na tabela de itens */}

                {/* Documento Assinado */}
                {contratoDetail.assinafy_document_id && (
                  <Card className="p-4 border-primary/20 bg-primary/5">
                    <a 
                      href={`/api/contratos/assinafy/download/${contratoDetail.assinafy_document_id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <FileCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Documento Assinado</p>
                          <p className="text-sm text-muted-foreground">Clique para visualizar o PDF</p>
                        </div>
                      </div>
                      <ExternalLink className="h-5 w-5 text-primary" />
                    </a>
                  </Card>
                )}

                {/* Itens do Contrato */}
                {contratoDetail.itens && contratoDetail.itens.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold mb-3 block">Itens do Contrato ({contratoDetail.itens.length})</Label>
                    <Card className="overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="font-semibold">Descrição</TableHead>
                            <TableHead className="font-semibold text-center">Qtd</TableHead>
                            <TableHead className="font-semibold text-right">Valor Tabela</TableHead>
                            <TableHead className="font-semibold text-right">Valor Negociado</TableHead>
                            <TableHead className="font-semibold text-right">Desconto</TableHead>
                            <TableHead className="font-semibold text-center">Início Serviço</TableHead>
                            <TableHead className="font-semibold text-center">Fim Serviço</TableHead>
                            <TableHead className="font-semibold text-center">Início Cobrança</TableHead>
                            <TableHead className="font-semibold text-center">Fim Cobrança</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contratoDetail.itens.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {item.servico_nome && item.plano_nome
                                  ? `${item.servico_nome} - ${item.plano_nome}`
                                  : item.servico_nome || item.plano_nome || item.descricao || '-'}
                              </TableCell>
                              <TableCell className="text-center">{item.quantidade}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(item.valor_tabela || 0)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(item.valor_negociado)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                  -{(Number(item.desconto_percentual) || 0).toFixed(1)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {item.data_inicio ? new Date(item.data_inicio).toLocaleDateString('pt-BR') : '-'}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {item.data_fim ? new Date(item.data_fim).toLocaleDateString('pt-BR') : '-'}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {item.data_inicio_cobranca ? new Date(item.data_inicio_cobranca).toLocaleDateString('pt-BR') : '-'}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {item.data_fim_cobranca ? new Date(item.data_fim_cobranca).toLocaleDateString('pt-BR') : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 border-t-2">
                            <TableCell colSpan={3} className="font-bold text-base">Total do Contrato</TableCell>
                            <TableCell className="text-right font-bold text-lg">
                              {formatCurrency(contratoDetail.itens.reduce((acc, i) => acc + (i.valor_negociado * i.quantidade), 0))}
                            </TableCell>
                            <TableCell colSpan={5}></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Card>
                  </div>
                )}

                {/* Observações */}
                {contratoDetail.observacoes && (
                  <Card className="p-4">
                    <Label className="text-sm font-semibold mb-3 block">Observações</Label>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                      {contratoDetail.observacoes}
                    </p>
                  </Card>
                )}

                {/* Entregaveis section */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-zinc-700">
                  <EntregaveisChecklist contratoId={contratoDetail.id} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface NovoContratoInitialData {
  formData?: {
    cliente_id?: number | null;
    comercial_nome?: string;
    comercial_email?: string;
    id_crm?: string;
    observacoes?: string;
  };
  itens?: ContratoItem[];
  source?: 'template' | 'duplicate';
}

const defaultFormData = {
  numero_contrato: '',
  cliente_id: null as number | null,
  comercial_nome: '',
  comercial_email: '',
  id_crm: '',
  status: 'rascunho',
  observacoes: '',
};

function NovoContratoTab({ onSuccess, initialData, onConsumeInitialData }: {
  onSuccess: () => void;
  initialData?: NovoContratoInitialData;
  onConsumeInitialData?: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState(() => ({
    ...defaultFormData,
    ...(initialData?.formData ? {
      cliente_id: initialData.formData.cliente_id ?? null,
      comercial_nome: initialData.formData.comercial_nome ?? '',
      comercial_email: initialData.formData.comercial_email ?? '',
      id_crm: initialData.formData.id_crm ?? '',
      observacoes: initialData.formData.observacoes ?? '',
    } : {}),
  }));

  const [itens, setItens] = useState<ContratoItem[]>(() => {
    if (!initialData?.itens) return [];
    return initialData.itens.map(item => ({
      ...item,
      id: undefined,
      contrato_id: undefined,
      ...(initialData.source === 'duplicate' ? { data_inicio: null, data_fim: null, data_inicio_cobranca: null, data_fim_cobranca: null } : {}),
    }));
  });
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedServicoId, setSelectedServicoId] = useState<number | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...defaultFormData,
        ...(initialData.formData ? {
          cliente_id: initialData.formData.cliente_id ?? null,
          comercial_nome: initialData.formData.comercial_nome ?? '',
          comercial_email: initialData.formData.comercial_email ?? '',
          id_crm: initialData.formData.id_crm ?? '',
          observacoes: initialData.formData.observacoes ?? '',
        } : {}),
      });
      setItens((initialData.itens || []).map(item => ({
        ...item,
        id: undefined,
        contrato_id: undefined,
        ...(initialData.source === 'duplicate' ? { data_inicio: null, data_fim: null, data_inicio_cobranca: null, data_fim_cobranca: null } : {}),
      })));
      onConsumeInitialData?.();
    }
  }, [initialData]);

  const { data: proximoNumero } = useQuery<{ proximoNumero: string }>({
    queryKey: ['/api/contratos/proximo-numero'],
  });

  const { data: entidadesData } = useQuery<{ entidades: Entidade[] }>({
    queryKey: ['/api/contratos/entidades'],
    queryFn: async () => {
      const res = await fetch('/api/contratos/entidades?ativo=true&tipo=cliente');
      return res.json();
    },
  });

  const { data: colaboradoresDropdownNovo } = useQuery<ColaboradorDropdownItem[]>({
    queryKey: ['/api/colaboradores/dropdown'],
  });

  const colaboradoresAtivosNovo = useMemo(() =>
    (colaboradoresDropdownNovo || []).filter(c => c.status?.toLowerCase() === 'ativo'),
    [colaboradoresDropdownNovo]
  );

  const [clienteOpenNovo, setClienteOpenNovo] = useState(false);
  const [comercialOpenNovo, setComercialOpenNovo] = useState(false);

  const { data: servicosData } = useQuery<{ servicos: Servico[] }>({
    queryKey: ['/api/contratos/servicos'],
  });

  const { data: planosData } = useQuery<{ planos: PlanoServico[] }>({
    queryKey: ['/api/contratos/planos-servicos', selectedServicoId],
    queryFn: async () => {
      const params = selectedServicoId ? `?servico_id=${selectedServicoId}` : '';
      const res = await fetch(`/api/contratos/planos-servicos${params}`);
      return res.json();
    },
    enabled: !!selectedServicoId,
  });

  const { data: templatesData } = useQuery<{ templates: Array<{ id: number; nome: string; descricao: string | null; itens_template: ContratoItem[] }> }>({
    queryKey: ['/api/contratos/templates'],
  });

  const [templateSelected, setTemplateSelected] = useState(!!initialData);

  const createMutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...formData,
        numero_contrato: formData.numero_contrato || proximoNumero?.proximoNumero,
      };
      const res = await apiRequest('POST', '/api/contratos/contratos', { contrato: data, itens });
      return res;
    },
    onSuccess: () => {
      toast({ title: "Contrato criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/proximo-numero'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar contrato", description: error.message, variant: "destructive" });
    },
  });

  const revisarIAMutation = useMutation({
    mutationFn: async (observacoes: string) => {
      const res = await apiRequest('POST', '/api/contratos/revisar-observacoes', { observacoes });
      return res.json() as Promise<{ observacoesRevisadas: string }>;
    },
    onSuccess: (data) => {
      setFormData(prev => ({ ...prev, observacoes: data.observacoesRevisadas }));
      toast({ title: "Observações revisadas com sucesso", description: "O texto foi aprimorado para maior proteção jurídica." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao revisar observações", description: error.message, variant: "destructive" });
    },
  });

  const addItem = () => {
    setShowAddItem(true);
    setItens([...itens, {
      plano_servico_id: null,
      servico_id: null,
      descricao: '',
      escopo: '',
      valor_tabela: 0,
      valor_unitario: 0,
      valor_total: 0,
      valor_original: 0,
      valor_negociado: 0,
      valor_final: 0,
      economia: 0,
      desconto_percentual: 0,
      quantidade: 1,
      modalidade: 'recorrente',
      observacoes: null,
      is_personalizado: false,
      data_inicio: null,
      data_fim: null,
      data_inicio_cobranca: null,
      data_fim_cobranca: null,
      forma_pagamento: 'Boleto',
      num_parcelas: null,
      valor_parcela: null,
    }]);
  };

  const handleServicoChange = (index: number, servicoId: number) => {
    const servico = servicosData?.servicos.find(s => s.id === servicoId);
    const updated = [...itens];
    updated[index] = {
      ...updated[index],
      servico_id: servicoId,
      servico_nome: servico?.nome,
      plano_servico_id: null,
      escopo: '',
      valor_tabela: 0,
      valor_negociado: 0,
      is_personalizado: false,
    };
    setItens(updated);
    setSelectedServicoId(servicoId);
  };

  const handlePlanoChange = (index: number, planoId: string) => {
    const updated = [...itens];
    if (planoId === 'personalizado') {
      updated[index] = {
        ...updated[index],
        plano_servico_id: null,
        is_personalizado: true,
        descricao: 'Plano Personalizado',
        plano_nome: 'Personalizado',
        escopo: '',
        valor_tabela: 0,
        valor_negociado: 0,
      };
    } else {
      const plano = planosData?.planos.find(p => p.id === parseInt(planoId));
      if (plano) {
        updated[index] = {
          ...updated[index],
          plano_servico_id: plano.id,
          is_personalizado: false,
          descricao: plano.nome,
          plano_nome: plano.nome,
          escopo: plano.escopo || '',
          valor_tabela: plano.valor,
          valor_negociado: plano.valor,
        };
      }
    }
    setItens(updated);
  };

  const updateItem = (index: number, field: keyof ContratoItem, value: any) => {
    const updated = [...itens];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'valor_tabela' || field === 'valor_negociado') {
      const original = updated[index].valor_tabela || 0;
      const negociado = updated[index].valor_negociado || 0;
      const desconto = original > 0 ? ((original - negociado) / original) * 100 : 0;
      updated[index].desconto_percentual = desconto;
    }
    setItens(updated);
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const totalRecorrente = itens.filter(i => i.modalidade === 'recorrente').reduce((sum, i) => sum + (i.valor_negociado || 0), 0);
  const totalPontual = itens.filter(i => i.modalidade === 'pontual').reduce((sum, i) => sum + (i.valor_negociado || 0), 0);

  const [reviewOpen, setReviewOpen] = useState(false);

  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: { nome: string; descricao: string | null; itens_template: any[] }) => {
      const res = await apiRequest('POST', '/api/contratos/templates', data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/templates'] });
      toast({ title: "Template salvo com sucesso!" });
      setSaveAsTemplateOpen(false);
      setTemplateName('');
      setTemplateDesc('');
    },
    onError: () => {
      toast({ title: "Erro ao salvar template", variant: "destructive" });
    },
  });

  const clienteSelecionado = entidadesData?.entidades.find(e => e.id === formData.cliente_id);

  const formatDate = (d: string) => {
    if (!d) return '-';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-6">
      {!templateSelected ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Como deseja começar?</h2>
            <p className="text-sm text-muted-foreground">Escolha um template ou comece do zero</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Card "Em branco" - always first */}
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setTemplateSelected(true)}
            >
              <CardContent className="pt-6 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium">Em branco</p>
                <p className="text-xs text-muted-foreground mt-1">Começar do zero</p>
              </CardContent>
            </Card>

            {/* Template cards */}
            {templatesData?.templates?.map(template => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setItens(template.itens_template.map(item => ({
                    ...item,
                    id: undefined,
                    contrato_id: undefined,
                  })));
                  setTemplateSelected(true);
                }}
              >
                <CardContent className="pt-6 text-center">
                  <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium">{template.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {template.descricao || `${template.itens_template?.length || 0} serviço(s)`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
      <>
      {/* Dialog de Revisão */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-orange-500" />
              Revisão do Contrato
            </DialogTitle>
            <DialogDescription>
              Confira todos os dados antes de criar o contrato
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Dados Básicos */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do Contrato</h4>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Número:</span>{' '}
                    <span className="font-medium font-mono">{formData.numero_contrato || proximoNumero?.proximoNumero || 'AUTO'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ID CRM:</span>{' '}
                    <span className="font-medium">{formData.id_crm || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Cliente:</span>{' '}
                    <span className="font-medium">{clienteSelecionado?.nome || '-'}</span>
                    {clienteSelecionado?.cpf_cnpj && <span className="text-muted-foreground ml-2">({clienteSelecionado.cpf_cnpj})</span>}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Comercial:</span>{' '}
                    <span className="font-medium">{formData.comercial_nome || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>{' '}
                    <span className="font-medium">{formData.comercial_email || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Serviços */}
            {itens.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Serviços ({itens.length})</h4>
                <div className="rounded-lg border divide-y">
                  {itens.map((item, idx) => (
                    <div key={idx} className="p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            {item.modalidade === 'recorrente' ? 'Rec' : 'Pont'}
                          </Badge>
                          <div>
                            <p className="font-medium">{item.servico_nome || item.descricao || item.plano_nome || 'Serviço'}</p>
                            {item.plano_nome && item.servico_nome && (
                              <p className="text-xs text-muted-foreground">{item.plano_nome}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(item.valor_negociado || item.valor_final || 0)}</p>
                          {item.valor_tabela && item.valor_tabela > 0 && item.valor_tabela !== item.valor_negociado && (
                            <p className="text-xs text-muted-foreground line-through">{formatCurrency(item.valor_tabela)}</p>
                          )}
                        </div>
                      </div>
                      {(item.data_inicio || item.data_fim || item.data_inicio_cobranca || item.data_fim_cobranca) && (
                        <div className="flex gap-6 text-xs text-muted-foreground pl-10">
                          {(item.data_inicio || item.data_fim) && (
                            <span>Serviço: {item.data_inicio ? formatDate(item.data_inicio) : '?'} → {item.data_fim ? formatDate(item.data_fim) : '?'}</span>
                          )}
                          {(item.data_inicio_cobranca || item.data_fim_cobranca) && (
                            <span>Cobrança: {item.data_inicio_cobranca ? formatDate(item.data_inicio_cobranca) : '?'} → {item.data_fim_cobranca ? formatDate(item.data_fim_cobranca) : '?'}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Valores Totais */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Valores</h4>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recorrente (mensal)</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(totalRecorrente)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pontual (único)</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400">{formatCurrency(totalPontual)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total Geral</span>
                  <span className="text-orange-600 dark:text-orange-400">{formatCurrency(totalRecorrente + totalPontual)}</span>
                </div>
              </div>
            </div>

            {/* Observações */}
            {formData.observacoes?.trim() && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Observações</h4>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm whitespace-pre-wrap">{formData.observacoes}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Voltar e Editar
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch('/api/contratos/preview-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      contrato: {
                        ...formData,
                        numero_contrato: formData.numero_contrato || proximoNumero?.proximoNumero,
                      },
                      itens,
                    }),
                  });
                  if (!res.ok) {
                    const errBody = await res.text();
                    console.error('[preview-pdf] POST falhou:', res.status, errBody);
                    throw new Error('Erro ao preparar PDF');
                  }
                  const data = await res.json();
                  console.log('[preview-pdf] Token recebido:', data.token);
                  window.open(`/api/contratos/preview-pdf/${data.token}`, '_blank');
                } catch (err) {
                  console.error('[preview-pdf] Erro:', err);
                  toast({ title: 'Erro ao gerar preview do PDF', variant: 'destructive' });
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Ver PDF
            </Button>
            <Button
              onClick={() => { setReviewOpen(false); createMutation.mutate(); }}
              disabled={createMutation.isPending || !formData.cliente_id}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
              Confirmar e Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Salvar como Template */}
      <Dialog open={saveAsTemplateOpen} onOpenChange={setSaveAsTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar como Template</DialogTitle>
            <DialogDescription>Os serviços atuais serão salvos como template reutilizável.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Template</Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Ex: Social Media Básico"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={templateDesc}
                onChange={e => setTemplateDesc(e.target.value)}
                placeholder="Breve descrição"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveAsTemplateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                saveTemplateMutation.mutate({
                  nome: templateName,
                  descricao: templateDesc || null,
                  itens_template: itens.map(({ id, contrato_id, ...rest }) => rest),
                });
              }}
              disabled={!templateName.trim() || saveTemplateMutation.isPending}
            >
              {saveTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <Card className="border-orange-500/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <Plus className="h-7 w-7 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Novo Contrato</h2>
              <p className="text-muted-foreground">Preencha os dados para criar um novo contrato</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulário */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados Básicos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                Dados do Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número do Contrato</Label>
                  <Input
                    data-testid="input-numero-novo"
                    value={formData.numero_contrato || proximoNumero?.proximoNumero || ''}
                    onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
                    placeholder="AUTO"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID CRM</Label>
                  <Input
                    data-testid="input-crm-novo"
                    value={formData.id_crm}
                    onChange={(e) => setFormData({ ...formData, id_crm: e.target.value })}
                    placeholder="ID do deal no CRM"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Popover open={clienteOpenNovo} onOpenChange={setClienteOpenNovo}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clienteOpenNovo}
                      className="w-full justify-between font-normal"
                      data-testid="select-cliente-novo"
                    >
                      <span className="flex items-center gap-2 truncate">
                        {formData.cliente_id ? (
                          <>
                            <Building2 className="h-4 w-4 shrink-0" />
                            {entidadesData?.entidades.find(e => e.id === formData.cliente_id)?.nome || "Selecione o cliente"}
                          </>
                        ) : "Selecione o cliente"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {entidadesData?.entidades.map((e) => (
                            <CommandItem
                              key={e.id}
                              value={e.nome}
                              onSelect={() => {
                                setFormData({ ...formData, cliente_id: e.id });
                                setClienteOpenNovo(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", formData.cliente_id === e.id ? "opacity-100" : "opacity-0")} />
                              <Building2 className="h-4 w-4 mr-2" />
                              {e.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Comercial Responsável</Label>
                  <Popover open={comercialOpenNovo} onOpenChange={setComercialOpenNovo}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comercialOpenNovo}
                        className="w-full justify-between font-normal"
                        data-testid="input-comercial-novo"
                      >
                        {formData.comercial_nome || "Selecione um colaborador..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar colaborador..." />
                        <CommandList>
                          <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                          <CommandGroup>
                            {colaboradoresAtivosNovo.map((col) => (
                              <CommandItem
                                key={col.id}
                                value={col.nome}
                                onSelect={() => {
                                  setFormData({
                                    ...formData,
                                    comercial_nome: col.nome,
                                    comercial_email: col.email_turbo || '',
                                  });
                                  setComercialOpenNovo(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.comercial_nome === col.nome ? "opacity-100" : "opacity-0")} />
                                {col.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>E-mail do Comercial</Label>
                  <Input
                    data-testid="input-email-comercial-novo"
                    type="email"
                    value={formData.comercial_email}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Serviços */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-purple-500" />
                Serviços Contratados
              </CardTitle>
              <Button onClick={addItem} size="sm" data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Serviço
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {itens.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum serviço adicionado</p>
                  <p className="text-sm">Clique em "Adicionar Serviço" para começar</p>
                </div>
              ) : (
                itens.map((item, index) => (
                  <Card key={index} className="p-4 bg-muted/30">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{item.modalidade === 'recorrente' ? 'Recorrente' : 'Pontual'}</Badge>
                        <Button size="icon" variant="ghost" onClick={() => removeItem(index)} data-testid={`button-remove-item-${index}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Modalidade</Label>
                          <Select value={item.modalidade || 'recorrente'} onValueChange={(v) => updateItem(index, 'modalidade', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="recorrente">Recorrente</SelectItem>
                              <SelectItem value="pontual">Pontual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Serviço</Label>
                          <Select value={item.servico_id?.toString() || ''} onValueChange={(v) => handleServicoChange(index, parseInt(v))}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {servicosData?.servicos.filter(s => s.ativo).map((s) => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Plano</Label>
                          <Select value={item.is_personalizado ? 'personalizado' : item.plano_servico_id?.toString() || ''} onValueChange={(v) => handlePlanoChange(index, v)} disabled={!item.servico_id}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="personalizado">Personalizado</SelectItem>
                              {planosData?.planos.filter(p => p.ativo && p.servico_id === item.servico_id).map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.nome} - {formatCurrency(p.valor)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {(item.plano_servico_id || item.is_personalizado || item.escopo) && (
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500 dark:text-zinc-400">
                            {item.is_personalizado ? "Escopo Personalizado" : "Escopo do Plano"}
                          </Label>
                          <Textarea
                            value={item.escopo || ''}
                            onChange={(e) => updateItem(index, 'escopo', e.target.value)}
                            rows={3}
                            placeholder={item.is_personalizado ? "Descreva o escopo do serviço personalizado..." : "Escopo padrão do plano (editável para personalizar)"}
                            className="text-sm"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Valor Tabela</Label>
                          <Input type="number" value={item.valor_tabela || ''} onChange={(e) => updateItem(index, 'valor_tabela', parseFloat(e.target.value) || 0)} disabled={!item.is_personalizado} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Valor Negociado</Label>
                          <Input type="number" value={item.valor_negociado || ''} onChange={(e) => updateItem(index, 'valor_negociado', parseFloat(e.target.value) || 0)} className="border-green-500/50 focus:border-green-500" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Prestação de Serviço</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Início</Label>
                            <Input type="date" value={item.data_inicio || ''} onChange={(e) => updateItem(index, 'data_inicio', e.target.value || null)} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Fim</Label>
                            <Input type="date" value={item.data_fim || ''} onChange={(e) => updateItem(index, 'data_fim', e.target.value || null)} />
                          </div>
                        </div>
                        <p className="text-xs font-medium text-muted-foreground">Cobrança</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Início</Label>
                            <Input type="date" value={item.data_inicio_cobranca || ''} onChange={(e) => updateItem(index, 'data_inicio_cobranca', e.target.value || null)} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Fim</Label>
                            <Input type="date" value={item.data_fim_cobranca || ''} onChange={(e) => updateItem(index, 'data_fim_cobranca', e.target.value || null)} />
                          </div>
                        </div>
                      </div>
                      <div className={`grid ${item.modalidade === 'recorrente' ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                        <div className="space-y-2">
                          <Label className="text-xs">Forma de Pagamento</Label>
                          <select
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                            value={item.forma_pagamento || 'Boleto'}
                            onChange={(e) => updateItem(index, 'forma_pagamento', e.target.value)}
                          >
                            <option value="Boleto">Boleto</option>
                            <option value="PIX">PIX</option>
                            <option value="Cartão">Cartão</option>
                            <option value="Transferência">Transferência</option>
                          </select>
                        </div>
                        {item.modalidade !== 'recorrente' && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-xs">Nº Parcelas</Label>
                              <Input type="number" min={1} value={item.num_parcelas || ''} onChange={(e) => updateItem(index, 'num_parcelas', e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 12" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Valor Parcela</Label>
                              <Input type="number" step="0.01" min={0} value={item.valor_parcela || ''} onChange={(e) => updateItem(index, 'valor_parcela', e.target.value ? Number(e.target.value) : null)} placeholder="R$ 0,00" />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Observações</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => revisarIAMutation.mutate(formData.observacoes)}
                  disabled={revisarIAMutation.isPending || !formData.observacoes?.trim()}
                  data-testid="button-revisar-ia-novo"
                >
                  {revisarIAMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Revisão de IA
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={4} placeholder="Observações adicionais sobre o contrato..." data-testid="textarea-obs-novo" />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Resumo */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Resumo do Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                <p className="text-xs text-muted-foreground mb-1">Recorrente (mensal)</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalRecorrente)}</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                <p className="text-xs text-muted-foreground mb-1">Pontual (único)</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(totalPontual)}</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <p className="text-xs text-muted-foreground mb-1">Total Geral</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalRecorrente + totalPontual)}</p>
              </div>

              <div className="pt-4 space-y-2">
                <p className="text-sm text-muted-foreground">{itens.length} serviço(s) adicionado(s)</p>
                <Button className="w-full" size="lg" onClick={() => setReviewOpen(true)} disabled={!formData.cliente_id} data-testid="button-revisar-contrato">
                  <Eye className="h-4 w-4 mr-2" />
                  Revisar Contrato
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setSaveAsTemplateOpen(true)}
                  disabled={itens.length === 0}
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  Salvar como Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

// ============================================================================
// SERVIÇOS TAB
// ============================================================================

function ServicosTab() {
  const { toast } = useToast();
  const [expandedServico, setExpandedServico] = useState<number | null>(null);
  const [servicoDialog, setServicoDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; data?: Servico }>({ open: false, mode: 'create' });
  const [planoDialog, setPlanoDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; servicoId?: number; data?: PlanoServico }>({ open: false, mode: 'create' });
  const [servicoForm, setServicoForm] = useState({ nome: '', descricao: '' });
  const [planoForm, setPlanoForm] = useState({ nome: '', escopo: '', diretrizes: '', valor: '', periodicidade: 'mensal' });

  const { data: servicosData, isLoading: loadingServicos } = useQuery<{ servicos: Servico[] }>({
    queryKey: ['/api/contratos/servicos'],
  });

  const { data: planosData } = useQuery<{ planos: PlanoServico[] }>({
    queryKey: ['/api/contratos/planos-servicos'],
  });

  const createServico = useMutation({
    mutationFn: (data: { nome: string; descricao: string }) =>
      apiRequest('POST', '/api/contratos/servicos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/servicos'] });
      setServicoDialog({ open: false, mode: 'create' });
      toast({ title: "Serviço criado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao criar serviço", variant: "destructive" }),
  });

  const updateServico = useMutation({
    mutationFn: ({ id, ...data }: { id: number; nome: string; descricao: string }) =>
      apiRequest('PUT', `/api/contratos/servicos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/servicos'] });
      setServicoDialog({ open: false, mode: 'create' });
      toast({ title: "Serviço atualizado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao atualizar serviço", variant: "destructive" }),
  });

  const deleteServico = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/contratos/servicos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/servicos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/planos-servicos'] });
      toast({ title: "Serviço excluído com sucesso" });
    },
    onError: () => toast({ title: "Erro ao excluir serviço", variant: "destructive" }),
  });

  const createPlano = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/contratos/planos-servicos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/planos-servicos'] });
      setPlanoDialog({ open: false, mode: 'create' });
      toast({ title: "Plano criado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao criar plano", variant: "destructive" }),
  });

  const updatePlano = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      apiRequest('PUT', `/api/contratos/planos-servicos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/planos-servicos'] });
      setPlanoDialog({ open: false, mode: 'create' });
      toast({ title: "Plano atualizado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao atualizar plano", variant: "destructive" }),
  });

  const deletePlano = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/contratos/planos-servicos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/planos-servicos'] });
      toast({ title: "Plano excluído com sucesso" });
    },
    onError: () => toast({ title: "Erro ao excluir plano", variant: "destructive" }),
  });

  const servicos: Servico[] = servicosData?.servicos || [];
  const planos: PlanoServico[] = planosData?.planos || [];

  // Templates
  const { data: templatesResp } = useQuery<{ templates: any[] }>({
    queryKey: ['/api/contratos/templates'],
  });
  const templates = templatesResp?.templates || [];

  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; data?: any }>({ open: false, mode: 'create' });
  const [templateFormData, setTemplateFormData] = useState({ nome: '', descricao: '' });
  const [templateItens, setTemplateItens] = useState<ContratoItem[]>([]);

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('POST', '/api/contratos/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/templates'] });
      toast({ title: "Template criado!" });
      setTemplateDialog({ open: false, mode: 'create' });
    },
    onError: () => toast({ title: "Erro ao criar template", variant: "destructive" }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      apiRequest('PUT', `/api/contratos/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/templates'] });
      toast({ title: "Template atualizado!" });
      setTemplateDialog({ open: false, mode: 'create' });
    },
    onError: () => toast({ title: "Erro ao atualizar template", variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest('DELETE', `/api/contratos/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/templates'] });
      toast({ title: "Template removido" });
    },
    onError: () => toast({ title: "Erro ao remover template", variant: "destructive" }),
  });

  const openCreateServico = () => {
    setServicoForm({ nome: '', descricao: '' });
    setServicoDialog({ open: true, mode: 'create' });
  };

  const openEditServico = (s: Servico) => {
    setServicoForm({ nome: s.nome, descricao: s.descricao || '' });
    setServicoDialog({ open: true, mode: 'edit', data: s });
  };

  const openCreatePlano = (servicoId: number) => {
    setPlanoForm({ nome: '', escopo: '', diretrizes: '', valor: '', periodicidade: 'mensal' });
    setPlanoDialog({ open: true, mode: 'create', servicoId });
  };

  const openEditPlano = (p: PlanoServico) => {
    setPlanoForm({
      nome: p.nome,
      escopo: p.escopo || '',
      diretrizes: p.diretrizes || '',
      valor: String(p.valor || ''),
      periodicidade: p.periodicidade || 'mensal',
    });
    setPlanoDialog({ open: true, mode: 'edit', data: p });
  };

  const handleServicoSubmit = () => {
    if (!servicoForm.nome.trim()) return;
    if (servicoDialog.mode === 'edit' && servicoDialog.data) {
      updateServico.mutate({ id: servicoDialog.data.id, ...servicoForm });
    } else {
      createServico.mutate(servicoForm);
    }
  };

  const handlePlanoSubmit = () => {
    if (!planoForm.nome.trim()) return;
    const payload = {
      ...planoForm,
      valor: parseFloat(planoForm.valor) || 0,
    };
    if (planoDialog.mode === 'edit' && planoDialog.data) {
      updatePlano.mutate({ id: planoDialog.data.id, ...payload });
    } else {
      createPlano.mutate({ ...payload, servico_id: planoDialog.servicoId });
    }
  };

  if (loadingServicos) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Serviços e Planos</h2>
        <Button onClick={openCreateServico}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      {servicos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum serviço cadastrado. Clique em "Novo Serviço" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {servicos.map((servico) => {
            const servicoPlanos = planos.filter((p) => p.servico_id === servico.id);
            const isExpanded = expandedServico === servico.id;

            return (
              <Card key={servico.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedServico(isExpanded ? null : servico.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <h3 className="font-semibold">{servico.nome}</h3>
                      {servico.descricao && (
                        <p className="text-sm text-muted-foreground mt-0.5">{servico.descricao}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {servicoPlanos.length} {servicoPlanos.length === 1 ? 'plano' : 'planos'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEditServico(servico)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Excluir o serviço "${servico.nome}" e todos os seus planos?`)) {
                          deleteServico.mutate(servico.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-5 py-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">Planos deste serviço</span>
                      <Button size="sm" variant="outline" onClick={() => openCreatePlano(servico.id)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Novo Plano
                      </Button>
                    </div>

                    {servicoPlanos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum plano cadastrado para este serviço.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Periodicidade</TableHead>
                            <TableHead>Escopo</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {servicoPlanos.map((plano) => (
                            <TableRow key={plano.id}>
                              <TableCell className="font-medium">{plano.nome}</TableCell>
                              <TableCell>{formatCurrency(plano.valor)}</TableCell>
                              <TableCell className="capitalize">{plano.periodicidade || '—'}</TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                {plano.escopo || '—'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditPlano(plano)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      if (confirm(`Excluir o plano "${plano.nome}"?`)) {
                                        deletePlano.mutate(plano.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Seção de Templates */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Templates de Contrato</h3>
          <Button size="sm" onClick={() => {
            setTemplateFormData({ nome: '', descricao: '' });
            setTemplateItens([]);
            setTemplateDialog({ open: true, mode: 'create' });
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum template criado</p>
              <p className="text-sm">Templates ajudam o comercial a criar contratos mais rápido</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{t.descricao || '-'}</TableCell>
                    <TableCell>{t.itens_template?.length || 0} serviço(s)</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => {
                          setTemplateFormData({ nome: t.nome, descricao: t.descricao || '' });
                          setTemplateItens(t.itens_template || []);
                          setTemplateDialog({ open: true, mode: 'edit', data: t });
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteTemplateMutation.mutate(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Template Dialog */}
      <Dialog open={templateDialog.open} onOpenChange={(open) => { if (!open) setTemplateDialog({ open: false, mode: 'create' }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{templateDialog.mode === 'edit' ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            <DialogDescription>
              {templateDialog.mode === 'edit' ? 'Atualize os dados do template' : 'Crie um template reutilizável para novos contratos'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Template</Label>
              <Input
                value={templateFormData.nome}
                onChange={e => setTemplateFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Social Media Básico"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={templateFormData.descricao}
                onChange={e => setTemplateFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Breve descrição do que este template inclui"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog({ open: false, mode: 'create' })}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const payload = {
                  nome: templateFormData.nome,
                  descricao: templateFormData.descricao || null,
                  itens_template: templateItens,
                };
                if (templateDialog.mode === 'edit' && templateDialog.data) {
                  updateTemplateMutation.mutate({ id: templateDialog.data.id, ...payload });
                } else {
                  createTemplateMutation.mutate(payload);
                }
              }}
              disabled={!templateFormData.nome.trim()}
            >
              {templateDialog.mode === 'edit' ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Serviço */}
      <Dialog open={servicoDialog.open} onOpenChange={(open) => !open && setServicoDialog({ open: false, mode: 'create' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{servicoDialog.mode === 'edit' ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={servicoForm.nome}
                onChange={(e) => setServicoForm({ ...servicoForm, nome: e.target.value })}
                placeholder="Ex: Gestão de Redes Sociais"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={servicoForm.descricao}
                onChange={(e) => setServicoForm({ ...servicoForm, descricao: e.target.value })}
                placeholder="Descrição do serviço"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServicoDialog({ open: false, mode: 'create' })}>
              Cancelar
            </Button>
            <Button onClick={handleServicoSubmit} disabled={createServico.isPending || updateServico.isPending}>
              {(createServico.isPending || updateServico.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {servicoDialog.mode === 'edit' ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Plano */}
      <Dialog open={planoDialog.open} onOpenChange={(open) => !open && setPlanoDialog({ open: false, mode: 'create' })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{planoDialog.mode === 'edit' ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Plano</Label>
              <Input
                value={planoForm.nome}
                onChange={(e) => setPlanoForm({ ...planoForm, nome: e.target.value })}
                placeholder="Ex: Plano Básico"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={planoForm.valor}
                  onChange={(e) => setPlanoForm({ ...planoForm, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Periodicidade</Label>
                <Select value={planoForm.periodicidade} onValueChange={(v) => setPlanoForm({ ...planoForm, periodicidade: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="pontual">Pontual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Escopo</Label>
              <Textarea
                value={planoForm.escopo}
                onChange={(e) => setPlanoForm({ ...planoForm, escopo: e.target.value })}
                placeholder="Descreva o escopo do plano..."
                rows={4}
              />
            </div>
            <div>
              <Label>Diretrizes</Label>
              <Textarea
                value={planoForm.diretrizes}
                onChange={(e) => setPlanoForm({ ...planoForm, diretrizes: e.target.value })}
                placeholder="Diretrizes e regras do plano..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanoDialog({ open: false, mode: 'create' })}>
              Cancelar
            </Button>
            <Button onClick={handlePlanoSubmit} disabled={createPlano.isPending || updatePlano.isPending}>
              {(createPlano.isPending || updatePlano.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {planoDialog.mode === 'edit' ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ContratosModule() {
  usePageTitle("Contratos");
  useSetPageInfo("Contratos", "Gestão de entidades e contratos");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [novoContratoInitialData, setNovoContratoInitialData] = useState<NovoContratoInitialData>();

  return (
    <div className="p-6 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Card className="mb-6 bg-muted/30 border-muted/50">
          <CardContent className="p-2">
            <TabsList className="grid w-full grid-cols-5 bg-transparent p-0 h-auto border-b" data-testid="tabs-contratos">
              <TabsTrigger
                value="dashboard"
                data-testid="tab-dashboard"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="font-medium text-sm">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger
                value="entidades"
                data-testid="tab-entidades"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="font-medium text-sm">Entidades</span>
              </TabsTrigger>
              <TabsTrigger
                value="contratos"
                data-testid="tab-contratos"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                <span className="font-medium text-sm">Contratos</span>
              </TabsTrigger>
              <TabsTrigger
                value="novo"
                data-testid="tab-novo-contrato"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="font-medium text-sm">Novo Contrato</span>
              </TabsTrigger>
              <TabsTrigger
                value="servicos"
                data-testid="tab-servicos"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                <Settings className="h-4 w-4 mr-2" />
                <span className="font-medium text-sm">Serviços</span>
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

        <TabsContent value="dashboard" className="mt-0">
          <DashboardTab />
        </TabsContent>

        <TabsContent value="entidades" className="mt-0">
          <EntidadesTab />
        </TabsContent>

        <TabsContent value="contratos" className="mt-0">
          <ContratosTab
            onDuplicate={(data) => {
              setNovoContratoInitialData(data);
              setActiveTab("novo");
            }}
          />
        </TabsContent>

        <TabsContent value="novo" className="mt-0">
          <NovoContratoTab
            onSuccess={() => setActiveTab("contratos")}
            initialData={novoContratoInitialData}
            onConsumeInitialData={() => setNovoContratoInitialData(undefined)}
          />
        </TabsContent>

        <TabsContent value="servicos" className="mt-0">
          <ServicosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
