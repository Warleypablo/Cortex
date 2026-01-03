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
  Download,
  Send,
  RefreshCw,
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
  servico_id?: number | null;
  escopo?: string;
  is_personalizado?: boolean;
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
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statusData = [
    { key: 'ativos', label: 'Ativos', count: stats.contratos.ativos, color: 'bg-green-500', textColor: 'text-green-500' },
    { key: 'rascunhos', label: 'Rascunhos', count: stats.contratos.rascunhos, color: 'bg-gray-500', textColor: 'text-gray-500' },
    { key: 'aguardando', label: 'Aguardando', count: stats.contratos.aguardando, color: 'bg-yellow-500', textColor: 'text-yellow-500' },
    { key: 'encerrados', label: 'Encerrados', count: stats.contratos.encerrados, color: 'bg-blue-500', textColor: 'text-blue-500' },
    { key: 'cancelados', label: 'Cancelados', count: stats.contratos.cancelados, color: 'bg-red-500', textColor: 'text-red-500' },
  ];

  const maxCount = Math.max(...statusData.map(s => s.count), 1);

  return (
    <div className="space-y-6">
      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entidades */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-bl-full" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Entidades Ativas</p>
                <p className="text-4xl font-bold tracking-tight">{stats.entidades.total}</p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-muted-foreground">{stats.entidades.clientes} clientes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="text-xs text-muted-foreground">{stats.entidades.fornecedores} forn.</span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Users className="h-7 w-7 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contratos Ativos */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-500/20 to-transparent rounded-bl-full" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Contratos Ativos</p>
                <p className="text-4xl font-bold tracking-tight text-green-600">{stats.contratos.ativos}</p>
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${(stats.contratos.ativos / stats.contratos.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{stats.contratos.total} total</span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <FileCheck className="h-7 w-7 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor Total */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-orange-500/20 to-transparent rounded-bl-full" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Valor Total Ativos</p>
                <p className="text-3xl font-bold tracking-tight text-orange-600">{formatCurrency(stats.valorTotalAtivos)}</p>
                <p className="text-xs text-muted-foreground pt-2">
                  Soma de todos os contratos ativos
                </p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                <DollarSign className="h-7 w-7 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rascunhos */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-gray-500/20 to-transparent rounded-bl-full" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Rascunhos</p>
                <p className="text-4xl font-bold tracking-tight">{stats.contratos.rascunhos}</p>
                <p className="text-xs text-muted-foreground pt-2">
                  Pendentes de assinatura
                </p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-gray-500/10 flex items-center justify-center">
                <FileText className="h-7 w-7 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segunda linha - Status e Entidades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status dos Contratos com barras visuais */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Status dos Contratos</CardTitle>
              <Badge variant="outline" className="text-xs">
                {stats.contratos.total} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusData.map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className={`text-lg font-bold ${item.textColor}`}>{item.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${(item.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tipos de Entidades */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Tipos de Entidades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Clientes */}
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <span className="font-medium">Clientes</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{stats.entidades.clientes}</span>
              </div>
              <div className="h-1.5 bg-blue-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(stats.entidades.clientes / stats.entidades.total) * 100}%` }}
                />
              </div>
            </div>

            {/* Fornecedores */}
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-purple-500" />
                  </div>
                  <span className="font-medium">Fornecedores</span>
                </div>
                <span className="text-2xl font-bold text-purple-600">{stats.entidades.fornecedores}</span>
              </div>
              <div className="h-1.5 bg-purple-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${(stats.entidades.fornecedores / stats.entidades.total) * 100}%` }}
                />
              </div>
            </div>

            {/* Ambos */}
            <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-cyan-500" />
                  </div>
                  <span className="font-medium">Ambos</span>
                </div>
                <span className="text-2xl font-bold text-cyan-600">{stats.entidades.ambos}</span>
              </div>
              <div className="h-1.5 bg-cyan-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 rounded-full"
                  style={{ width: `${(stats.entidades.ambos / stats.entidades.total) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Faturados</p>
            <p className="text-2xl font-bold text-green-600">{stats.contratos.faturados}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Pend. Faturamento</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.contratos.pendentesFaturamento}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Encerrados</p>
            <p className="text-2xl font-bold text-blue-600">{stats.contratos.encerrados}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Cancelados</p>
            <p className="text-2xl font-bold text-red-600">{stats.contratos.cancelados}</p>
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

  // Stats
  const entidades = data?.entidades || [];
  const totalClientes = entidades.filter(e => e.eh_cliente).length;
  const totalFornecedores = entidades.filter(e => e.eh_fornecedor).length;

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{entidades.length}</p>
              <p className="text-xs text-muted-foreground">Total de Entidades</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{totalClientes}</p>
              <p className="text-xs text-muted-foreground">Clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{totalFornecedores}</p>
              <p className="text-xs text-muted-foreground">Fornecedores</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed border-2">
          <CardContent className="p-0 h-full">
            <Button 
              variant="ghost" 
              className="w-full h-full flex items-center justify-center gap-3 min-h-[80px] rounded-lg"
              onClick={handleNew}
              data-testid="button-nova-entidade-card"
            >
              <Plus className="h-6 w-6 text-muted-foreground" />
              <span className="font-medium">Nova Entidade</span>
            </Button>
          </CardContent>
        </Card>
      </div>

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
                    {item.escopo && !item.is_personalizado && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <Label className="text-xs text-muted-foreground">Escopo do Plano</Label>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{item.escopo}</p>
                      </div>
                    )}

                    {item.is_personalizado && (
                      <div className="space-y-1">
                        <Label className="text-xs">Escopo Personalizado</Label>
                        <Textarea
                          data-testid={`textarea-item-escopo-${index}`}
                          value={item.escopo || ''}
                          onChange={(e) => updateItem(index, 'escopo', e.target.value)}
                          placeholder="Descreva o escopo do serviço personalizado..."
                          rows={3}
                        />
                      </div>
                    )}

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

                    <div className="flex justify-end gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Economia: <span className="text-green-500 font-medium">{formatCurrency(((item.valor_tabela || 0) - (item.valor_negociado || 0)) * item.quantidade)}</span>
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

  const enviarAssinaturaMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/contratos/${id}/enviar-assinatura`);
    },
    onSuccess: (data: { emailEnviado?: string }) => {
      toast({ 
        title: "Contrato enviado para assinatura", 
        description: data.emailEnviado ? `Email enviado para: ${data.emailEnviado}` : "Contrato enviado com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos'] });
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

  // Stats
  const contratos = data?.contratos || [];
  const totalAtivos = contratos.filter(c => c.status === 'ativo').length;
  const totalRascunhos = contratos.filter(c => c.status === 'rascunho').length;
  const totalValor = contratos.filter(c => c.status === 'ativo').reduce((sum, c) => sum + (Number(c.valor_negociado) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Cards estatísticos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <FileCheck className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{totalAtivos}</p>
              <p className="text-xs text-muted-foreground">Contratos Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <FileText className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{totalRascunhos}</p>
              <p className="text-xs text-muted-foreground">Rascunhos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(totalValor)}</p>
              <p className="text-xs text-muted-foreground">Receita Ativa (mensal)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{contratos.length}</p>
              <p className="text-xs text-muted-foreground">Total de Contratos</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                      <span className="font-semibold text-green-600">
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
              {/* Header com gradiente */}
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center">
                      <FileCheck className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contrato</p>
                      <h2 className="text-2xl font-bold font-mono">{contratoDetail.numero_contrato}</h2>
                      {contratoDetail.id_crm && (
                        <p className="text-sm text-muted-foreground">CRM: {contratoDetail.id_crm}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
                    <Badge 
                      variant="outline" 
                      className={`${statusColors[contratoDetail.status] || 'bg-gray-500/10'} text-base px-4 py-1`}
                    >
                      {statusLabels[contratoDetail.status] || contratoDetail.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Cards de Valores */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor Original</p>
                        <p className="text-lg font-bold">{formatCurrency(Number(contratoDetail.valor_original) || 0)}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-green-500/5 border-green-500/20">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor Negociado</p>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(Number(contratoDetail.valor_negociado) || 0)}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Economia</p>
                        <p className="text-lg font-bold text-orange-600">
                          {formatCurrency(Number(contratoDetail.economia) || 0)}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Informações principais em duas colunas */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Cliente */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-semibold">Cliente</Label>
                    </div>
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
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-semibold">Comercial Responsável</Label>
                    </div>
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

                {/* Datas */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">Datas do Contrato</Label>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Início Recorrentes</p>
                      <p className="font-medium">
                        {contratoDetail.data_inicio_recorrentes 
                          ? new Date(contratoDetail.data_inicio_recorrentes).toLocaleDateString('pt-BR') 
                          : '-'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Cobrança Recorrentes</p>
                      <p className="font-medium">
                        {contratoDetail.data_inicio_cobranca_recorrentes 
                          ? new Date(contratoDetail.data_inicio_cobranca_recorrentes).toLocaleDateString('pt-BR') 
                          : '-'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Início Pontuais</p>
                      <p className="font-medium">
                        {contratoDetail.data_inicio_pontuais 
                          ? new Date(contratoDetail.data_inicio_pontuais).toLocaleDateString('pt-BR') 
                          : '-'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Cobrança Pontuais</p>
                      <p className="font-medium">
                        {contratoDetail.data_inicio_cobranca_pontuais 
                          ? new Date(contratoDetail.data_inicio_cobranca_pontuais).toLocaleDateString('pt-BR') 
                          : '-'}
                      </p>
                    </div>
                  </div>
                </Card>

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
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-semibold">Itens do Contrato ({contratoDetail.itens.length})</Label>
                    </div>
                    <Card className="overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="font-semibold">Descrição</TableHead>
                            <TableHead className="font-semibold text-center">Qtd</TableHead>
                            <TableHead className="font-semibold text-right">Valor Tabela</TableHead>
                            <TableHead className="font-semibold text-right">Valor Negociado</TableHead>
                            <TableHead className="font-semibold text-right">Desconto</TableHead>
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
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 border-t-2">
                            <TableCell colSpan={3} className="font-bold text-base">Total do Contrato</TableCell>
                            <TableCell className="text-right font-bold text-lg">
                              {formatCurrency(contratoDetail.itens.reduce((acc, i) => acc + (i.valor_negociado * i.quantidade), 0))}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Card>
                  </div>
                )}

                {/* Observações */}
                {contratoDetail.observacoes && (
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-semibold">Observações</Label>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                      {contratoDetail.observacoes}
                    </p>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NovoContratoTab({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    numero_contrato: '',
    cliente_id: null as number | null,
    comercial_nome: '',
    comercial_email: '',
    id_crm: '',
    status: 'rascunho',
    data_inicio_recorrentes: '',
    data_inicio_cobranca_recorrentes: '',
    data_inicio_pontuais: '',
    data_inicio_cobranca_pontuais: '',
    observacoes: '',
  });

  const [itens, setItens] = useState<ContratoItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedServicoId, setSelectedServicoId] = useState<number | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-transparent">
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
                <Select value={formData.cliente_id?.toString() || ''} onValueChange={(v) => setFormData({ ...formData, cliente_id: parseInt(v) })}>
                  <SelectTrigger data-testid="select-cliente-novo">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {entidadesData?.entidades.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {e.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Comercial Responsável</Label>
                  <Input
                    data-testid="input-comercial-novo"
                    value={formData.comercial_nome}
                    onChange={(e) => setFormData({ ...formData, comercial_nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail do Comercial</Label>
                  <Input
                    data-testid="input-email-comercial-novo"
                    type="email"
                    value={formData.comercial_email}
                    onChange={(e) => setFormData({ ...formData, comercial_email: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Datas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-blue-500" />
                Datas e Vigência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4 p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                  <p className="font-medium text-green-600 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    Serviços Recorrentes
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs">Início do Serviço</Label>
                    <Input type="date" value={formData.data_inicio_recorrentes} onChange={(e) => setFormData({ ...formData, data_inicio_recorrentes: e.target.value })} data-testid="input-data-inicio-rec" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Início da Cobrança</Label>
                    <Input type="date" value={formData.data_inicio_cobranca_recorrentes} onChange={(e) => setFormData({ ...formData, data_inicio_cobranca_recorrentes: e.target.value })} data-testid="input-data-cobranca-rec" />
                  </div>
                </div>
                <div className="space-y-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="font-medium text-purple-600 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    Serviços Pontuais
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs">Início do Serviço</Label>
                    <Input type="date" value={formData.data_inicio_pontuais} onChange={(e) => setFormData({ ...formData, data_inicio_pontuais: e.target.value })} data-testid="input-data-inicio-pont" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Início da Cobrança</Label>
                    <Input type="date" value={formData.data_inicio_cobranca_pontuais} onChange={(e) => setFormData({ ...formData, data_inicio_cobranca_pontuais: e.target.value })} data-testid="input-data-cobranca-pont" />
                  </div>
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
                      {item.is_personalizado && (
                        <div className="space-y-2">
                          <Label className="text-xs">Escopo do Serviço</Label>
                          <Textarea value={item.escopo || ''} onChange={(e) => updateItem(index, 'escopo', e.target.value)} rows={3} placeholder="Descreva o escopo do serviço personalizado..." />
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Valor Tabela</Label>
                          <Input type="number" value={item.valor_tabela || ''} onChange={(e) => updateItem(index, 'valor_tabela', parseFloat(e.target.value) || 0)} disabled={!item.is_personalizado} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Valor Negociado</Label>
                          <Input type="number" value={item.valor_negociado || ''} onChange={(e) => updateItem(index, 'valor_negociado', parseFloat(e.target.value) || 0)} className="border-green-500/50 focus:border-green-500" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Desconto</Label>
                          <div className="flex items-center h-9 px-3 rounded-md bg-muted">
                            <span className="text-green-600 font-medium">{(item.desconto_percentual || 0).toFixed(1)}%</span>
                          </div>
                        </div>
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
              <CardTitle className="text-lg">Observações</CardTitle>
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
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRecorrente)}</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                <p className="text-xs text-muted-foreground mb-1">Pontual (único)</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalPontual)}</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <p className="text-xs text-muted-foreground mb-1">Total Geral</p>
                <p className="text-3xl font-bold text-orange-600">{formatCurrency(totalRecorrente + totalPontual)}</p>
              </div>

              <div className="pt-4 space-y-2">
                <p className="text-sm text-muted-foreground">{itens.length} serviço(s) adicionado(s)</p>
                <Button className="w-full" size="lg" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !formData.cliente_id} data-testid="button-criar-contrato">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
                  Criar Contrato
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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
        <Card className="mb-6 bg-gradient-to-r from-background via-muted/30 to-background border-muted/50">
          <CardContent className="p-2">
            <TabsList className="w-full grid grid-cols-4 gap-2 bg-transparent h-auto p-0" data-testid="tabs-contratos">
              <TabsTrigger 
                value="dashboard" 
                data-testid="tab-dashboard"
                className="flex flex-col items-center gap-2 py-4 px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-200"
              >
                <div className="h-10 w-10 rounded-xl bg-current/10 flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <span className="font-medium text-sm">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="entidades" 
                data-testid="tab-entidades"
                className="flex flex-col items-center gap-2 py-4 px-6 rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <div className="h-10 w-10 rounded-xl bg-current/10 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <span className="font-medium text-sm">Entidades</span>
              </TabsTrigger>
              <TabsTrigger 
                value="contratos" 
                data-testid="tab-contratos"
                className="flex flex-col items-center gap-2 py-4 px-6 rounded-xl data-[state=active]:bg-green-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <div className="h-10 w-10 rounded-xl bg-current/10 flex items-center justify-center">
                  <Briefcase className="h-5 w-5" />
                </div>
                <span className="font-medium text-sm">Contratos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="novo" 
                data-testid="tab-novo-contrato"
                className="flex flex-col items-center gap-2 py-4 px-6 rounded-xl data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <div className="h-10 w-10 rounded-xl bg-current/10 flex items-center justify-center">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="font-medium text-sm">Novo Contrato</span>
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
          <ContratosTab />
        </TabsContent>

        <TabsContent value="novo" className="mt-0">
          <NovoContratoTab onSuccess={() => setActiveTab("contratos")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
