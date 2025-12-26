import { useState, useEffect, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import StatsCard from "@/components/StatsCard";
import RevenueChart from "@/components/RevenueChart";
import { ArrowLeft, DollarSign, TrendingUp, Receipt, Loader2, ExternalLink, Key, Eye, EyeOff, Copy, Building2, MapPin, Phone, User, Calendar as CalendarIcon, Briefcase, Layers, CheckCircle, FileText, ChevronUp, ChevronDown, CreditCard, Activity, Globe, Mail, Link2, ListTodo, Pencil, Crown, Check, X, MessageSquare, Scale, AlertTriangle, Clock, Flag, Send, Plus, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SiInstagram } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ContratoCompleto, TimelineEvent, ClientAlert } from "@shared/schema";

type LogActionType = 'view_password' | 'copy_password' | 'add_credential' | 'edit_credential' | 'delete_credential' | 'add_client' | 'edit_client' | 'delete_client';

interface CreateLogParams {
  action: LogActionType;
  entityType: string;
  entityId?: string;
  entityName?: string;
  clientId?: string;
  clientName?: string;
  details?: string;
}

function useCreateLog() {
  return useMutation({
    mutationFn: async (params: CreateLogParams) => {
      await apiRequest("POST", "/api/acessos/logs", params);
    },
  });
}
import { 
  CONTRACT_STATUS_OPTIONS,
  SQUAD_OPTIONS,
  ACCOUNT_STATUS_OPTIONS,
  getBusinessTypeInfo,
  getAccountStatusInfo,
  getClusterInfo,
  getSquadLabel
} from "@shared/constants";

interface CredentialGroup {
  id: string;
  name: string;
  credentials: Array<{
    id: string;
    platform: string;
    username: string;
    password: string;
    accessUrl: string;
    observations: string;
  }>;
}

interface ClienteDb {
  id: number;
  nome: string | null;
  cnpj: string | null;
  endereco: string | null;
  ativo: string | null;
  createdAt: string | null;
  empresa: string | null;
  ids: string | null;
  telefone: string | null;
  responsavel: string | null;
  responsavelGeral: string | null;
  nomeDono: string | null;
  site: string | null;
  email: string | null;
  instagram: string | null;
  linksContrato: string | null;
  linkListaClickup: string | null;
  cluster: string | null;
  servicos: string | null;
  dataInicio: Date | null;
  tipoNegocio: string | null;
  faturamentoMensal: string | null;
  investimentoAds: string | null;
  statusConta: string | null;
}

interface ContaReceber {
  id: number;
  status: string | null;
  total: string | null;
  descricao: string | null;
  dataVencimento: string | null;
  naoPago: string | null;
  pago: string | null;
  dataCriacao: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  empresa: string | null;
  urlCobranca: string | null;
}

interface RevenueData {
  mes: string;
  valor: number;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface ClienteTask {
  id: string;
  nome: string;
  status: string;
  prioridade: string;
  responsavel: string | null;
  dataLimite: string | null;
  projeto: string | null;
}

interface ClienteComunicacao {
  id: number;
  tipo: string;
  titulo: string;
  conteudo: string;
  prioridade: string;
  data: string;
  criadoPor: string | null;
}

interface SituacaoJuridica {
  hasInadimplencia: boolean;
  hasJuridico: boolean;
  inadimplencia: {
    acao: string | null;
    statusFinanceiro: string | null;
    contexto: string | null;
    valorAcordado: string | null;
  } | null;
  juridico: {
    procedimento: string | null;
    statusJuridico: string | null;
    advogadoResponsavel: string | null;
    protocoloProcesso: string | null;
  } | null;
}

export default function ClientDetail() {
  const { setPageInfo } = usePageInfo();
  const { toast } = useToast();
  const [, params] = useRoute("/cliente/:id");
  const clientId = params?.id || "";
  const [receitasCurrentPage, setReceitasCurrentPage] = useState(1);
  const [receitasItemsPerPage, setReceitasItemsPerPage] = useState(10);
  const [monthsFilter, setMonthsFilter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const createLog = useCreateLog();
  const [contratosSortConfig, setContratosSortConfig] = useState<SortConfig | null>(null);
  const [receitasSortConfig, setReceitasSortConfig] = useState<SortConfig | null>(null);
  const [isEditingDados, setIsEditingDados] = useState(false);
  const [editingContratoId, setEditingContratoId] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [openResponsavel, setOpenResponsavel] = useState(false);
  const [openResponsavelGeral, setOpenResponsavelGeral] = useState(false);
  const [openContratoResponsavel, setOpenContratoResponsavel] = useState(false);
  const [openContratoCs, setOpenContratoCs] = useState(false);
  const [notaDialogOpen, setNotaDialogOpen] = useState(false);
  const [notaText, setNotaText] = useState("");

  useEffect(() => {
    if (!editingContratoId) {
      setDatePickerOpen(false);
      setOpenContratoResponsavel(false);
      setOpenContratoCs(false);
    }
  }, [editingContratoId]);

  interface EditContratoFormData {
    servico: string;
    status: string;
    squad: string;
    responsavel: string;
    csResponsavel: string;
    dataInicio: string;
    valorr: string;
    valorp: string;
    produto: string;
  }

  interface EditFormData {
    cnpj: string;
    endereco: string;
    telefone: string;
    responsavel: string;
    responsavelGeral: string;
    nomeDono: string;
    email: string;
    site: string;
    instagram: string;
    linksContrato: string;
    linkListaClickup: string;
    cluster: string;
    statusCliente: string;
    statusConta: string;
    tipoNegocio: string;
    faturamentoMensal: string;
    investimentoAds: string;
  }

  const formatPhoneMask = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `+${digits}`;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const formatCnpjCpfMask = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 11) {
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    }
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  };

  const formatCurrencyMask = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const floatVal = parseFloat(digits) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(floatVal);
  };

  const editForm = useForm<EditFormData>({
    defaultValues: {
      cnpj: "",
      endereco: "",
      telefone: "",
      responsavel: "",
      responsavelGeral: "",
      nomeDono: "",
      email: "",
      site: "",
      instagram: "",
      linksContrato: "",
      linkListaClickup: "",
      cluster: "",
      statusCliente: "",
      statusConta: "",
      tipoNegocio: "",
      faturamentoMensal: "",
      investimentoAds: "",
    },
  });

  const contratoEditForm = useForm<EditContratoFormData>({
    defaultValues: {
      servico: "",
      status: "",
      squad: "",
      responsavel: "",
      csResponsavel: "",
      dataInicio: "",
      valorr: "",
      valorp: "",
      produto: "",
    },
  });

  const { data: cliente, isLoading: isLoadingCliente, error: clienteError } = useQuery<ClienteDb>({
    queryKey: ["/api/cliente", clientId],
    enabled: !!clientId,
  });

  const { data: receitas, isLoading: isLoadingReceitas } = useQuery<ContaReceber[]>({
    queryKey: ["/api/cliente", clientId, "receitas"],
    enabled: !!clientId && !!cliente,
  });

  const { data: revenueHistory, isLoading: isLoadingRevenue } = useQuery<RevenueData[]>({
    queryKey: ["/api/cliente", clientId, "revenue"],
    enabled: !!clientId && !!cliente,
  });

  const { data: contratos, isLoading: isLoadingContratos } = useQuery<ContratoCompleto[]>({
    queryKey: ["/api/cliente", clientId, "contratos"],
    enabled: !!clientId && !!cliente,
  });

  const { data: credenciais, isLoading: isLoadingCredenciais } = useQuery<CredentialGroup[]>({
    queryKey: ["/api/acessos/credentials-by-cnpj", cliente?.cnpj],
    queryFn: async () => {
      if (!cliente?.cnpj) return [];
      const encodedCnpj = encodeURIComponent(cliente.cnpj);
      const response = await fetch(`/api/acessos/credentials-by-cnpj/${encodedCnpj}`);
      if (!response.ok) throw new Error("Failed to fetch credentials");
      return response.json();
    },
    enabled: !!cliente?.cnpj,
  });

  const { data: colaboradoresDropdown } = useQuery<{ id: number; nome: string; status: string | null }[]>({
    queryKey: ["/api/colaboradores/dropdown"],
    enabled: !!editingContratoId || isEditingDados,
  });

  const { data: tasks, isLoading: isLoadingTasks } = useQuery<ClienteTask[]>({
    queryKey: ["/api/cliente", cliente?.cnpj, "tasks"],
    enabled: !!cliente?.cnpj,
    retry: false,
  });

  const { data: comunicacoes, isLoading: isLoadingComunicacoes } = useQuery<ClienteComunicacao[]>({
    queryKey: ["/api/cliente", cliente?.cnpj, "comunicacoes"],
    enabled: !!cliente?.cnpj,
    retry: false,
  });

  const { data: situacaoJuridica, isLoading: isLoadingSituacao } = useQuery<SituacaoJuridica>({
    queryKey: ["/api/cliente", cliente?.cnpj, "situacao-juridica"],
    enabled: !!cliente?.cnpj,
    retry: false,
  });

  const { data: timeline, isLoading: isLoadingTimeline } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/clientes", cliente?.cnpj, "timeline"],
    enabled: !!cliente?.cnpj,
    retry: false,
  });

  const { data: alertas } = useQuery<ClientAlert[]>({
    queryKey: ["/api/clientes", cliente?.cnpj, "alertas"],
    enabled: !!cliente?.cnpj,
    retry: false,
  });

  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const [newComunicacao, setNewComunicacao] = useState({
    tipo: "",
    titulo: "",
    conteudo: "",
    prioridade: "normal",
  });

  const createComunicacaoMutation = useMutation({
    mutationFn: async (data: typeof newComunicacao) => {
      const response = await apiRequest("POST", `/api/cliente/${cliente?.cnpj}/comunicacoes`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cliente", cliente?.cnpj, "comunicacoes"] });
      setNewComunicacao({ tipo: "", titulo: "", conteudo: "", prioridade: "normal" });
      toast({
        title: "Sucesso!",
        description: "Comunicação criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar comunicação",
        description: error.message || "Não foi possível criar a comunicação.",
        variant: "destructive",
      });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: { tipo: string; titulo: string; descricao?: string; dadosExtras?: string }) => {
      const response = await apiRequest("POST", `/api/clientes/${cliente?.cnpj}/eventos`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clientes", cliente?.cnpj, "timeline"] });
      toast({ title: "Evento registrado", description: "O evento foi adicionado à timeline." });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar evento",
        description: error.message || "Não foi possível registrar o evento.",
        variant: "destructive",
      });
    },
  });

  const updateContratoMutation = useMutation({
    mutationFn: async (data: EditContratoFormData & { idSubtask: string }) => {
      const { idSubtask, ...updateData } = data;
      const response = await apiRequest("PATCH", `/api/contratos/${idSubtask}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cliente", clientId, "contratos"] });
      setEditingContratoId(null);
      setDatePickerOpen(false);
      contratoEditForm.reset();
      toast({
        title: "Sucesso!",
        description: "Contrato atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o contrato.",
        variant: "destructive",
      });
    },
  });

  const updateClienteMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      const response = await apiRequest("PATCH", `/api/cliente/${clientId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cliente", clientId] });
      setIsEditingDados(false);
      toast({
        title: "Sucesso!",
        description: "Dados do cliente atualizados com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar os dados do cliente.",
        variant: "destructive",
      });
    },
  });

  const updateStatusContaMutation = useMutation({
    mutationFn: async (statusConta: string | null) => {
      const cnpj = cliente?.cnpj;
      if (!cnpj) throw new Error("CNPJ do cliente não encontrado");
      const response = await apiRequest("PATCH", `/api/clientes/${encodeURIComponent(cnpj)}/status-conta`, { statusConta });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cliente", clientId] });
      toast({
        title: "Sucesso!",
        description: "Status da conta atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o status da conta.",
        variant: "destructive",
      });
    },
  });

  const mapClusterNameToCode = (name: string): string => {
    switch (name) {
      case "NFNC": return "0";
      case "Regulares": return "1";
      case "Chaves": return "2";
      case "Imperdíveis": return "3";
      default: return name;
    }
  };

  const handleToggleEdit = () => {
    if (!isEditingDados && cliente) {
      const formatStoredCurrency = (val: string | null) => {
        if (!val) return "";
        const num = parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (isNaN(num)) return val;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
      };
      editForm.reset({
        cnpj: cliente.cnpj || "",
        endereco: cliente.endereco || "",
        telefone: formatPhoneMask(cliente.telefone || ""),
        responsavel: cliente.responsavel || "",
        responsavelGeral: cliente.responsavelGeral || "",
        nomeDono: cliente.nomeDono || "",
        email: cliente.email || "",
        site: cliente.site || "",
        instagram: cliente.instagram || "",
        linksContrato: cliente.linksContrato || "",
        linkListaClickup: cliente.linkListaClickup || "",
        cluster: cliente.cluster || "",
        statusCliente: cliente.ativo || "",
        statusConta: cliente.statusConta || "",
        tipoNegocio: cliente.tipoNegocio || "",
        faturamentoMensal: formatStoredCurrency(cliente.faturamentoMensal),
        investimentoAds: formatStoredCurrency(cliente.investimentoAds),
      });
    }
    setIsEditingDados(!isEditingDados);
  };

  const normalizeLink = (link: string | null | undefined): string | null => {
    if (!link) return null;
    const trimmed = link.trim();
    return trimmed === '' ? null : trimmed;
  };

  const onSubmitEdit = (data: EditFormData) => {
    const parseCurrencyToFloat = (val: string): string | null => {
      if (!val) return null;
      const cleaned = val.replace(/[R$\s.]/g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num.toString();
    };
    const normalizedData = {
      ...data,
      cnpj: data.cnpj || null,
      telefone: data.telefone.replace(/\D/g, '') || null,
      linksContrato: normalizeLink(data.linksContrato),
      linkListaClickup: normalizeLink(data.linkListaClickup),
      site: normalizeLink(data.site),
      instagram: normalizeLink(data.instagram),
      email: normalizeLink(data.email),
      statusCliente: data.statusCliente || null,
      statusConta: data.statusConta === "__none__" ? null : (data.statusConta || null),
      tipoNegocio: data.tipoNegocio === "__none__" ? null : (data.tipoNegocio || null),
      faturamentoMensal: parseCurrencyToFloat(data.faturamentoMensal),
      investimentoAds: parseCurrencyToFloat(data.investimentoAds),
    };
    updateClienteMutation.mutate(normalizedData as any);
  };

  const mapSquadNameToCode = (name: string): string => {
    switch (name) {
      case "Supreme": return "0";
      case "Forja": return "1";
      case "Squadra": return "2";
      case "Chama": return "3";
      default: return name;
    }
  };

  const handleStartEditContrato = (contrato: ContratoCompleto) => {
    setEditingContratoId(contrato.idSubtask);
    
    // Format values for the form (currency with mask)
    const formatCurrency = (val: string | null) => {
      if (!val) return "";
      const floatVal = parseFloat(val);
      if (isNaN(floatVal)) return "";
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(floatVal);
    };

    contratoEditForm.reset({
      servico: contrato.servico || "",
      status: contrato.status || "",
      squad: contrato.squad || "",
      responsavel: contrato.responsavel || "",
      csResponsavel: contrato.csResponsavel || "",
      dataInicio: contrato.dataInicio ? new Date(contrato.dataInicio).toISOString().split('T')[0] : "",
      valorr: formatCurrency(contrato.valorr),
      valorp: formatCurrency(contrato.valorp),
      produto: contrato.plano || contrato.produto || "",
    });
  };

  const handleCancelEditContrato = () => {
    setEditingContratoId(null);
    setDatePickerOpen(false);
    contratoEditForm.reset();
  };

  const handleSaveContrato = () => {
    if (!editingContratoId) return;
    const data = contratoEditForm.getValues();
    
    // Formatting logic
    const formattedData = {
      ...data,
      idSubtask: editingContratoId,
      // 1. Currency fields (valorr, valorp)
      valorr: data.valorr ? data.valorr.toString().replace(/[R$\s.]/g, '').replace(',', '.') : null,
      valorp: data.valorp ? data.valorp.toString().replace(/[R$\s.]/g, '').replace(',', '.') : null,
      // 2. Date field (dataInicio) - handle Date object or dd/MM/yyyy string
      dataInicio: (() => {
        if (!data.dataInicio) return null;
        if (data.dataInicio.includes('/')) {
          const [day, month, year] = data.dataInicio.split('/');
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return data.dataInicio; // Already YYYY-MM-DD from state
      })(),
      // 3. Empty strings to null
      responsavel: data.responsavel || null,
      csResponsavel: data.csResponsavel || null,
      produto: data.produto || null,
      status: data.status || null,
      squad: data.squad || null,
      servico: data.servico || null,
    };

    updateContratoMutation.mutate(formattedData as any);
  };

  const servicosDisponiveis = useMemo(() => {
    const servicos = new Set<string>();
    contratos?.forEach(c => {
      if (c.servico) servicos.add(c.servico);
    });
    ["Performance", "Comunicação", "Tech", "Estratégia", "Mídia", "CRM", "SEO", "Branding", "Social Media"].forEach(s => servicos.add(s));
    return Array.from(servicos).sort();
  }, [contratos]);


  const handleContratoSort = (key: string) => {
    setContratosSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleReceitaSort = (key: string) => {
    setReceitasSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const togglePasswordVisibility = (credentialId: string, platform?: string, groupName?: string) => {
    const isCurrentlyVisible = visiblePasswords.has(credentialId);
    
    if (!isCurrentlyVisible && platform) {
      createLog.mutate({
        action: "view_password",
        entityType: "credential",
        entityId: credentialId,
        entityName: platform,
        clientId: clientId,
        clientName: groupName || cliente?.nome || undefined,
      });
    }
    
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(credentialId)) {
        newSet.delete(credentialId);
      } else {
        newSet.add(credentialId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, type: string, credentialId?: string, platform?: string, groupName?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      
      if (type === "Senha" && credentialId && platform) {
        createLog.mutate({
          action: "copy_password",
          entityType: "credential",
          entityId: credentialId,
          entityName: platform,
          clientId: clientId,
          clientName: groupName || cliente?.nome || undefined,
        });
      }
      
      toast({
        title: "Copiado!",
        description: `${type} copiado para a área de transferência.`,
      });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o texto.",
        variant: "destructive",
      });
    }
  };


  const formatCurrency = (value: string | null): string => {
    if (!value) return "Não informado";
    const num = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const sortedContratos = useMemo(() => {
    if (!contratos) return [];
    if (!contratosSortConfig) return contratos;

    return [...contratos].sort((a, b) => {
      const { key, direction } = contratosSortConfig;
      const multiplier = direction === 'asc' ? 1 : -1;

      switch (key) {
        case 'servico':
          return multiplier * (a.servico || '').localeCompare(b.servico || '');
        case 'status':
          return multiplier * (a.status || '').localeCompare(b.status || '');
        case 'squad':
          return multiplier * getSquadLabel(a.squad).localeCompare(getSquadLabel(b.squad));
        case 'dataInicio':
          const dateA = a.dataInicio ? new Date(a.dataInicio).getTime() : 0;
          const dateB = b.dataInicio ? new Date(b.dataInicio).getTime() : 0;
          return multiplier * (dateA - dateB);
        case 'valorr':
          return multiplier * (parseFloat(a.valorr || '0') - parseFloat(b.valorr || '0'));
        case 'valorp':
          return multiplier * (parseFloat(a.valorp || '0') - parseFloat(b.valorp || '0'));
        default:
          return 0;
      }
    });
  }, [contratos, contratosSortConfig]);

  const sortedReceitas = useMemo(() => {
    if (!receitas) return [];
    
    const sorted = [...receitas];
    
    if (receitasSortConfig) {
      const { key, direction } = receitasSortConfig;
      const multiplier = direction === 'asc' ? 1 : -1;

      sorted.sort((a, b) => {
        switch (key) {
          case 'descricao':
            return multiplier * (a.descricao || '').localeCompare(b.descricao || '');
          case 'status':
            return multiplier * (a.status || '').localeCompare(b.status || '');
          case 'dataVencimento':
            const dateA = a.dataVencimento ? new Date(a.dataVencimento).getTime() : 0;
            const dateB = b.dataVencimento ? new Date(b.dataVencimento).getTime() : 0;
            return multiplier * (dateA - dateB);
          case 'total':
            return multiplier * (parseFloat(a.total || '0') - parseFloat(b.total || '0'));
          case 'pago':
            return multiplier * (parseFloat(a.pago || '0') - parseFloat(b.pago || '0'));
          case 'naoPago':
            return multiplier * (parseFloat(a.naoPago || '0') - parseFloat(b.naoPago || '0'));
          default:
            return 0;
        }
      });
    } else {
      sorted.sort((a, b) => {
        const dateA = a.dataVencimento ? new Date(a.dataVencimento).getTime() : 0;
        const dateB = b.dataVencimento ? new Date(b.dataVencimento).getTime() : 0;
        return dateB - dateA;
      });
    }
    
    return sorted;
  }, [receitas, receitasSortConfig]);

  const filteredReceitas = useMemo(() => {
    if (!selectedMonth) return sortedReceitas;
    
    return sortedReceitas.filter(r => {
      const dataParaUsar = r.dataVencimento || r.dataCriacao;
      if (!dataParaUsar) return false;
      
      const data = new Date(dataParaUsar);
      if (isNaN(data.getTime())) return false;
      
      const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      return mesAno === selectedMonth;
    });
  }, [sortedReceitas, selectedMonth]);

  const lt = useMemo(() => {
    if (!sortedReceitas || sortedReceitas.length === 0) return 0;
    
    const mesesUnicos = new Set<string>();
    
    sortedReceitas.forEach(r => {
      const statusUpper = r.status?.toUpperCase();
      if (statusUpper === "PAGO" || statusUpper === "ACQUITTED") {
        const dataParaUsar = r.dataVencimento || r.dataCriacao;
        if (dataParaUsar) {
          const data = new Date(dataParaUsar);
          if (!isNaN(data.getTime())) {
            const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            mesesUnicos.add(mesAno);
          }
        }
      }
    });
    
    return mesesUnicos.size;
  }, [sortedReceitas]);

  const totalReceitas = sortedReceitas?.reduce((sum, r) => sum + parseFloat(r.pago || "0"), 0) || 0;
  const ticketMedio = lt > 0 ? totalReceitas / lt : 0;
  
  const temContratoAtivo = contratos?.some(c => {
    const statusLower = c.status?.toLowerCase() || "";
    if (statusLower.includes("inativo") || statusLower.includes("inactive") || 
        statusLower.includes("cancelado") || statusLower.includes("canceled")) {
      return false;
    }
    return statusLower.includes("ativo") || statusLower.includes("active");
  }) || false;
  
  const temInadimplencia = sortedReceitas?.some(r => {
    if (!r.dataVencimento || r.status?.toUpperCase() === "PAGO") return false;
    const vencimento = new Date(r.dataVencimento);
    const hoje = new Date();
    const valorPendente = parseFloat(r.naoPago || "0");
    return vencimento < hoje && valorPendente > 0;
  }) || false;

  const statusFinanceiro = useMemo(() => {
    if (!sortedReceitas || sortedReceitas.length === 0) return { status: 'em_dia', diasAtraso: 0 };
    
    let maxDiasAtraso = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    sortedReceitas.forEach(r => {
      const statusUpper = r.status?.toUpperCase();
      if (statusUpper === "PAGO" || statusUpper === "ACQUITTED") return;
      if (!r.dataVencimento) return;
      
      const valorPendente = parseFloat(r.naoPago || "0");
      if (valorPendente <= 0) return;
      
      const vencimento = new Date(r.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      
      if (vencimento < hoje) {
        const diffTime = hoje.getTime() - vencimento.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > maxDiasAtraso) {
          maxDiasAtraso = diffDays;
        }
      }
    });
    
    if (maxDiasAtraso === 0) {
      return { status: 'em_dia', diasAtraso: 0 };
    } else if (maxDiasAtraso <= 7) {
      return { status: 'atrasado', diasAtraso: maxDiasAtraso };
    } else {
      return { status: 'inadimplente', diasAtraso: maxDiasAtraso };
    }
  }, [sortedReceitas]);

  const handleBarClick = (month: string) => {
    setSelectedMonth(prevMonth => prevMonth === month ? null : month);
    setReceitasCurrentPage(1);
  };

  const receitasStartIndex = (receitasCurrentPage - 1) * receitasItemsPerPage;
  const receitasEndIndex = receitasStartIndex + receitasItemsPerPage;
  const paginatedReceitas = filteredReceitas?.slice(receitasStartIndex, receitasEndIndex) || [];

  const chartData = useMemo(() => {
    if (!revenueHistory || revenueHistory.length === 0) return [];
    
    const allData = revenueHistory.map((item) => ({
      month: item.mes,
      revenue: item.valor,
    })).sort((a, b) => a.month.localeCompare(b.month));
    
    if (monthsFilter === "all") {
      return allData;
    }
    
    const numMonths = parseInt(monthsFilter);
    return allData.slice(-numMonths);
  }, [revenueHistory, monthsFilter]);

  const receitasTotalPages = Math.ceil((filteredReceitas?.length || 0) / receitasItemsPerPage);
  
  useEffect(() => {
    if (receitasTotalPages > 0 && receitasCurrentPage > receitasTotalPages) {
      setReceitasCurrentPage(receitasTotalPages);
    }
  }, [receitasTotalPages, receitasCurrentPage]);

  useEffect(() => {
    if (cliente?.nome) {
      setPageInfo(cliente.nome, `CNPJ: ${cliente.cnpj || "N/A"}`);
    } else {
      setPageInfo("Detalhes do Cliente", "Carregando...");
    }
  }, [cliente, setPageInfo]);

  const servicosAtivos = useMemo(() => {
    if (!contratos) return [];
    return contratos
      .filter(c => {
        const statusLower = c.status?.toLowerCase() || "";
        return statusLower.includes("ativo") || statusLower.includes("active");
      })
      .map(c => c.servico)
      .filter((s): s is string => !!s);
  }, [contratos]);

  const isLoading = isLoadingCliente;

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (clienteError || !cliente) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="p-8">
            <div className="text-center">
              <p className="text-destructive font-semibold mb-2">Cliente não encontrado</p>
              <p className="text-sm text-muted-foreground">
                {clienteError instanceof Error ? clienteError.message : "O cliente solicitado não existe"}
              </p>
              <Link href="/">
                <Button variant="default" className="mt-4">
                  Voltar para lista de clientes
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string | null, dataVencimento?: string | Date | null, naoPago?: string | null) => {
    const normalizedStatus = status?.toUpperCase();
    
    // Check if the invoice is overdue (past due date and has pending amount)
    if (dataVencimento && normalizedStatus !== "PAGO" && normalizedStatus !== "ACQUITTED") {
      const vencimento = new Date(dataVencimento);
      const hoje = new Date();
      vencimento.setHours(0, 0, 0, 0);
      hoje.setHours(0, 0, 0, 0);
      const valorPendente = parseFloat(naoPago || "0");
      
      if (vencimento < hoje && valorPendente > 0) {
        return <Badge variant="default" className="bg-amber-700 text-white" data-testid="badge-atrasado">Atrasado</Badge>;
      }
    }
    
    switch (normalizedStatus) {
      case "PAGO":
      case "ACQUITTED":
        return <Badge variant="default" className="bg-green-600" data-testid="badge-pago">Quitado</Badge>;
      case "PENDENTE":
      case "PENDING":
        return <Badge variant="secondary" data-testid="badge-pendente">Pendente</Badge>;
      case "EM ABERTO":
        return <Badge variant="default" className="bg-amber-500 text-white" data-testid="badge-em-aberto">Em Aberto</Badge>;
      case "PREVISTA":
        return <Badge variant="outline" className="border-blue-400 text-blue-600 dark:text-blue-400" data-testid="badge-prevista">Prevista</Badge>;
      case "VENCIDO":
      case "OVERDUE":
        return <Badge variant="destructive" data-testid="badge-vencido">Vencido</Badge>;
      case "CANCELED":
      case "CANCELADO":
      case "CANCELLED":
        return <Badge variant="destructive" data-testid="badge-cancelado">Cancelado</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status">{status || "N/A"}</Badge>;
    }
  };

  const getContractStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("cancelado") || statusLower.includes("inativo")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700";
    } else if (statusLower.includes("entregue") || statusLower.includes("concluído") || statusLower.includes("finalizado")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700";
    } else if (statusLower.includes("ativo") || statusLower.includes("active")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700";
    } else if (statusLower.includes("onboard") || statusLower.includes("início")) {
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-300 dark:border-sky-700";
    } else if (statusLower.includes("triagem") || statusLower.includes("análise")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700";
    } else if (statusLower.includes("cancelamento") || statusLower.includes("pausa")) {
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-300 dark:border-gray-700";
  };

  const getSquadColorForContract = (squad: string) => {
    switch (squad) {
      case "Supreme":
      case "Performance":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "Forja":
      case "Comunicação":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "Squadra":
      case "Tech":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
      case "Chama":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const calcularLTContrato = (contrato: { status: string | null; dataInicio: Date | null; dataSolicitacaoEncerramento: Date | null; dataEncerramento: Date | null }) => {
    if (!contrato.dataInicio) return '-';
    
    const dataInicio = new Date(contrato.dataInicio);
    const statusLower = (contrato.status || '').toLowerCase();
    
    const statusAtivos = ['triagem', 'onboarding', 'ativo', 'em cancelamento', 'cancelamento'];
    const isStatusAtivo = statusAtivos.some(s => statusLower.includes(s));
    
    let dataFim: Date;
    
    if (statusLower.includes('entregue') || statusLower.includes('concluído') || statusLower.includes('finalizado')) {
      if (contrato.dataEncerramento) {
        dataFim = new Date(contrato.dataEncerramento);
      } else {
        return '-';
      }
    } else if (statusLower.includes('cancelado') || statusLower.includes('inativo')) {
      if (contrato.dataSolicitacaoEncerramento) {
        dataFim = new Date(contrato.dataSolicitacaoEncerramento);
      } else {
        return '-';
      }
    } else if (isStatusAtivo) {
      dataFim = new Date();
    } else {
      return '-';
    }
    
    const diffMs = dataFim.getTime() - dataInicio.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    
    return months > 0 ? `${months}m` : `${diffDays}d`;
  };

  const SortIndicator = ({ sortKey, config }: { sortKey: string; config: SortConfig | null }) => {
    if (config?.key !== sortKey) return null;
    return config.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="bg-background">
      <div className="w-full px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="hover-elevate -ml-2" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para clientes
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              {temInadimplencia && (
                <Badge variant="destructive" data-testid="badge-inadimplente">
                  Inadimplente
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Client Alerts Section */}
        {alertas && alertas.length > 0 && (
          <div className="mb-6" data-testid="alerts-container">
            <div className="flex flex-wrap gap-4">
              {(showAllAlerts ? alertas : alertas.slice(0, 3)).map((alert) => {
                const getAlertStyles = () => {
                  switch (alert.severity) {
                    case 'critical':
                      return 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20';
                    case 'warning':
                      return 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20';
                    case 'info':
                    default:
                      return 'border-l-4 border-l-gray-400 bg-gray-50 dark:bg-gray-800/50';
                  }
                };
                const getIconColor = () => {
                  switch (alert.severity) {
                    case 'critical':
                      return 'text-red-500';
                    case 'warning':
                      return 'text-amber-500';
                    case 'info':
                    default:
                      return 'text-gray-500';
                  }
                };
                const getIcon = () => {
                  switch (alert.type) {
                    case 'inadimplencia':
                      return <AlertTriangle className={`w-5 h-5 ${getIconColor()}`} />;
                    case 'vencimento_proximo':
                      return <Clock className={`w-5 h-5 ${getIconColor()}`} />;
                    case 'contrato_expirando':
                      return <CalendarIcon className={`w-5 h-5 ${getIconColor()}`} />;
                    case 'cliente_inativo':
                      return <AlertTriangle className={`w-5 h-5 ${getIconColor()}`} />;
                    default:
                      return <AlertTriangle className={`w-5 h-5 ${getIconColor()}`} />;
                  }
                };
                return (
                  <Card
                    key={alert.id}
                    className={`flex items-center gap-3 p-3 min-w-[280px] flex-1 max-w-md ${getAlertStyles()}`}
                    data-testid={`alert-${alert.type}`}
                  >
                    {getIcon()}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
            {alertas.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setShowAllAlerts(!showAllAlerts)}
                data-testid="button-toggle-alerts"
              >
                {showAllAlerts ? 'Mostrar menos' : `Ver todos os alertas (${alertas.length})`}
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6" data-testid="stats-grid">
          <StatsCard
            title="Receita Total"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0
            }).format(totalReceitas)}
            icon={DollarSign}
            variant="success"
            subtitle="Soma de todos os pagamentos recebidos deste cliente"
          />
          <StatsCard
            title="Ticket Médio"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0
            }).format(ticketMedio)}
            icon={TrendingUp}
            variant="info"
            subtitle="Valor médio por pagamento recebido"
          />
          <StatsCard
            title="LT"
            value={`${lt} meses`}
            icon={Receipt}
            variant="default"
            subtitle="Lifetime - quantidade de meses com pagamento"
            tooltipType="help"
          />
          <StatsCard
            title="Status"
            value={temContratoAtivo ? "Ativo" : "Inativo"}
            icon={Activity}
            variant="status"
            statusActive={temContratoAtivo}
            subtitle={temContratoAtivo ? "Cliente possui contratos ativos" : "Nenhum contrato ativo no momento"}
          />
          <StatsCard
            title="Financeiro"
            value={statusFinanceiro.status === 'em_dia' ? 'Em dia' : statusFinanceiro.status === 'atrasado' ? 'Atrasado' : 'Inadimplente'}
            icon={CreditCard}
            variant={statusFinanceiro.status === 'em_dia' ? 'success' : statusFinanceiro.status === 'atrasado' ? 'warning' : 'error'}
            subtitle={statusFinanceiro.diasAtraso > 0 ? `${statusFinanceiro.diasAtraso} dias em atraso` : 'Sem faturas pendentes vencidas'}
          />
        </div>

        {/* Quick Actions Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-2" data-testid="quick-actions-bar">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            disabled={!cliente.telefone}
            onClick={() => {
              if (cliente.telefone) {
                let phoneDigits = cliente.telefone.replace(/\D/g, '');
                if (phoneDigits.length <= 11 && !phoneDigits.startsWith('55')) {
                  phoneDigits = '55' + phoneDigits;
                }
                window.open(`https://wa.me/${phoneDigits}`, '_blank');
                createEventMutation.mutate({
                  tipo: "whatsapp",
                  titulo: "WhatsApp enviado",
                  descricao: `Contato via WhatsApp para ${cliente?.nome}`
                });
              }
            }}
            data-testid="quick-action-whatsapp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            disabled={!cliente.email}
            onClick={() => {
              if (cliente.email) {
                window.location.href = `mailto:${cliente.email}`;
                createEventMutation.mutate({
                  tipo: "email",
                  titulo: "Email enviado",
                  descricao: `Email enviado para ${cliente?.email}`
                });
              }
            }}
            data-testid="quick-action-email"
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            disabled={!cliente.linkListaClickup}
            onClick={() => {
              if (cliente.linkListaClickup) {
                window.open(cliente.linkListaClickup, '_blank');
              }
            }}
            data-testid="quick-action-clickup"
          >
            <ListTodo className="w-3.5 h-3.5" />
            ClickUp
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            onClick={() => {
              createEventMutation.mutate({
                tipo: "contrato",
                titulo: "Contrato visualizado/adicionado",
                descricao: `Ação de contrato para ${cliente?.nome}`
              });
              toast({
                title: "Novo Contrato",
                description: "Funcionalidade em desenvolvimento.",
              });
            }}
            data-testid="quick-action-novo-contrato"
          >
            <Plus className="w-3.5 h-3.5" />
            Contrato
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            onClick={() => setNotaDialogOpen(true)}
            data-testid="quick-action-adicionar-nota"
          >
            <FileText className="w-3.5 h-3.5" />
            Nota
          </Button>
        </div>

        {/* Timeline de Eventos */}
        <Card className="mb-6 p-4" data-testid="timeline-section">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold">Timeline de Eventos</h2>
          </div>
          
          {isLoadingTimeline ? (
            <div className="flex items-center justify-center py-6" data-testid="timeline-loading">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !timeline || timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground" data-testid="timeline-empty">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <CalendarIcon className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-medium">Nenhum evento registrado</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Os eventos aparecerão aqui conforme forem registrados</p>
            </div>
          ) : (
            <div className="relative" data-testid="timeline-container">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-4">
                {(showAllTimeline ? timeline : timeline.slice(0, 10)).map((event) => {
                  const getEventIcon = () => {
                    switch (event.type) {
                      case 'payment_received':
                        return <Check className="w-4 h-4" />;
                      case 'payment_due':
                        return <CalendarIcon className="w-4 h-4" />;
                      case 'payment_overdue':
                        return <AlertTriangle className="w-4 h-4" />;
                      case 'contract_started':
                      case 'contract_ended':
                      case 'contract_cancelled':
                        return <FileText className="w-4 h-4" />;
                      default:
                        return <Clock className="w-4 h-4" />;
                    }
                  };

                  const getEventColor = () => {
                    switch (event.type) {
                      case 'payment_received':
                        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
                      case 'payment_overdue':
                        return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
                      case 'contract_started':
                        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
                      case 'contract_ended':
                        return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
                      case 'contract_cancelled':
                        return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
                      case 'payment_due':
                      default:
                        return 'bg-muted text-muted-foreground';
                    }
                  };

                  const eventDate = new Date(event.date);
                  const formattedDate = format(eventDate, "dd 'de' MMM, yyyy", { locale: ptBR });

                  return (
                    <div key={event.id} className="relative flex items-start gap-4 pl-8" data-testid={`timeline-event-${event.id}`}>
                      <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${getEventColor()}`}>
                        {getEventIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-medium" data-testid={`timeline-event-title-${event.id}`}>
                            {event.title}
                          </span>
                          {event.amount !== undefined && event.amount > 0 && (
                            <Badge variant="outline" className="text-xs" data-testid={`timeline-event-amount-${event.id}`}>
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.amount)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`timeline-event-description-${event.id}`}>
                          {event.description}
                        </p>
                        <span className="text-xs text-muted-foreground" data-testid={`timeline-event-date-${event.id}`}>
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {timeline.length > 10 && (
                <div className="mt-4 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTimeline(!showAllTimeline)}
                    data-testid="button-toggle-timeline"
                  >
                    {showAllTimeline ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Ver menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Ver mais ({timeline.length - 10} eventos)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>

        <Tabs defaultValue="dados-cadastrais" className="w-full" data-testid="client-detail-tabs">
          <TabsList className="grid w-full grid-cols-4 mb-4 h-11 p-1 bg-muted/60" data-testid="tabs-list">
            <TabsTrigger value="dados-cadastrais" className="text-sm font-medium gap-1.5" data-testid="tab-dados-cadastrais">
              <Building2 className="w-3.5 h-3.5" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="text-sm font-medium gap-1.5" data-testid="tab-tarefas">
              <ListTodo className="w-3.5 h-3.5" />
              Tarefas
            </TabsTrigger>
            <TabsTrigger value="comunicacao" className="text-sm font-medium gap-1.5" data-testid="tab-comunicacao">
              <MessageSquare className="w-3.5 h-3.5" />
              Comunicação
            </TabsTrigger>
            <TabsTrigger value="situacao-financeira" className="text-sm font-medium gap-1.5" data-testid="tab-situacao-financeira">
              <Scale className="w-3.5 h-3.5" />
              Financeiro
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados-cadastrais" className="mt-0" data-testid="tabcontent-dados-cadastrais">
        <div className="mb-6">
          <Card className="p-0" data-testid="card-client-info">
            <Accordion type="single" collapsible defaultValue="dados-cadastrais">
              <AccordionItem value="dados-cadastrais" className="border-none">
                <div className="flex items-center justify-between gap-4 px-4 pt-3">
                  <AccordionTrigger className="py-0 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-primary" />
                      <h2 className="text-lg font-semibold">Dados Cadastrais</h2>
                    </div>
                  </AccordionTrigger>
                  <Button
                    variant={isEditingDados ? "default" : "outline"}
                    size="sm"
                    onClick={handleToggleEdit}
                    data-testid="button-edit-client"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    {isEditingDados ? "Cancelar" : "Editar"}
                  </Button>
                </div>
                <AccordionContent className="px-4 pb-4 pt-3">
            {isEditingDados ? (
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <FormField
                      control={editForm.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ/CPF</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="XX.XXX.XXX/XXXX-XX" 
                              value={field.value}
                              onChange={(e) => {
                                const formatted = formatCnpjCpfMask(e.target.value);
                                field.onChange(formatted);
                              }}
                              data-testid="input-cnpj"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="endereco"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endereço</FormLabel>
                          <FormControl>
                            <Input placeholder="Endereço completo" {...field} data-testid="input-endereco" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="+55 XX XXXXX-XXXX" 
                              value={field.value}
                              onChange={(e) => {
                                const formatted = formatPhoneMask(e.target.value);
                                field.onChange(formatted);
                              }}
                              data-testid="input-telefone" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="responsavel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Responsável (CS)</FormLabel>
                          <Popover open={openResponsavel} onOpenChange={setOpenResponsavel}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={openResponsavel}
                                  className="w-full justify-between font-normal"
                                  data-testid="select-responsavel"
                                >
                                  {field.value || "Selecione o CS"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar colaborador..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="__none__"
                                      onSelect={() => {
                                        field.onChange("");
                                        setOpenResponsavel(false);
                                      }}
                                    >
                                      <Check className={`mr-2 h-4 w-4 ${!field.value ? "opacity-100" : "opacity-0"}`} />
                                      Nenhum
                                    </CommandItem>
                                    {colaboradoresDropdown?.filter(c => c.status === "Ativo").map((c) => (
                                      <CommandItem
                                        key={c.id}
                                        value={c.nome}
                                        onSelect={() => {
                                          field.onChange(c.nome);
                                          setOpenResponsavel(false);
                                        }}
                                      >
                                        <Check className={`mr-2 h-4 w-4 ${field.value === c.nome ? "opacity-100" : "opacity-0"}`} />
                                        {c.nome}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="responsavelGeral"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Responsável</FormLabel>
                          <Popover open={openResponsavelGeral} onOpenChange={setOpenResponsavelGeral}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={openResponsavelGeral}
                                  className="w-full justify-between font-normal"
                                  data-testid="select-responsavel-geral"
                                >
                                  {field.value || "Selecione o responsável"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar colaborador..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="__none__"
                                      onSelect={() => {
                                        field.onChange("");
                                        setOpenResponsavelGeral(false);
                                      }}
                                    >
                                      <Check className={`mr-2 h-4 w-4 ${!field.value ? "opacity-100" : "opacity-0"}`} />
                                      Nenhum
                                    </CommandItem>
                                    {colaboradoresDropdown?.filter(c => c.status === "Ativo").map((c) => (
                                      <CommandItem
                                        key={c.id}
                                        value={c.nome}
                                        onSelect={() => {
                                          field.onChange(c.nome);
                                          setOpenResponsavelGeral(false);
                                        }}
                                      >
                                        <Check className={`mr-2 h-4 w-4 ${field.value === c.nome ? "opacity-100" : "opacity-0"}`} />
                                        {c.nome}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="nomeDono"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Dono</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do proprietário do negócio" {...field} data-testid="input-nome-dono" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@exemplo.com" {...field} data-testid="input-email" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="site"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site</FormLabel>
                          <FormControl>
                            <Input placeholder="https://exemplo.com" {...field} data-testid="input-site" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="instagram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instagram</FormLabel>
                          <FormControl>
                            <Input placeholder="@usuario" {...field} data-testid="input-instagram" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="linkListaClickup"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link Lista ClickUp</FormLabel>
                          <FormControl>
                            <Input placeholder="https://app.clickup.com/..." {...field} data-testid="input-link-clickup" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="cluster"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cluster</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-cluster">
                                <SelectValue placeholder="Selecione o cluster" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">NFNC</SelectItem>
                              <SelectItem value="1">Regulares</SelectItem>
                              <SelectItem value="2">Chaves</SelectItem>
                              <SelectItem value="3">Imperdíveis</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="statusCliente"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status do Cliente</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "__none__"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status-cliente">
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhum</SelectItem>
                              <SelectItem value="triagem">Triagem</SelectItem>
                              <SelectItem value="onboarding">Onboarding</SelectItem>
                              <SelectItem value="ativo">Ativo</SelectItem>
                              <SelectItem value="em cancelamento">Em Cancelamento</SelectItem>
                              <SelectItem value="pausado">Pausado</SelectItem>
                              <SelectItem value="cancelado/inativo">Cancelado/Inativo</SelectItem>
                              <SelectItem value="entregue">Entregue</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="statusConta"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status da Conta</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "__none__"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status-conta-edit">
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Não definido</SelectItem>
                              <SelectItem value="saudavel">Saudável</SelectItem>
                              <SelectItem value="requer_atencao">Requer Atenção</SelectItem>
                              <SelectItem value="insatisfeito">Insatisfeito</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="tipoNegocio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Negócio</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "__none__"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tipo-negocio">
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Não definido</SelectItem>
                              <SelectItem value="ecommerce">Ecommerce</SelectItem>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="faturamentoMensal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Faturamento Mensal</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="R$ 0,00" 
                              value={field.value}
                              onChange={(e) => {
                                const formatted = formatCurrencyMask(e.target.value);
                                field.onChange(formatted);
                              }}
                              data-testid="input-faturamento-mensal"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="investimentoAds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Investimento em Ads</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="R$ 0,00" 
                              value={field.value}
                              onChange={(e) => {
                                const formatted = formatCurrencyMask(e.target.value);
                                field.onChange(formatted);
                              }}
                              data-testid="input-investimento-ads"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={editForm.control}
                    name="linksContrato"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Links Contrato</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Links dos contratos (um por linha)" 
                            className="min-h-[80px]"
                            {...field} 
                            data-testid="textarea-links-contrato" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditingDados(false)}
                      data-testid="button-cancel-edit"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateClienteMutation.isPending}
                      data-testid="button-save-edit"
                    >
                      {updateClienteMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-start gap-2.5" data-testid="info-cnpj">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CNPJ</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold" data-testid="text-cnpj">{cliente.cnpj || <span className="text-muted-foreground/60 font-normal">Não informado</span>}</p>
                    {cliente.cnpj && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(cliente.cnpj!, "CNPJ")}
                        data-testid="button-copy-cnpj"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-endereco">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Endereço</p>
                  <p className="text-sm font-semibold" data-testid="text-endereco">{cliente.endereco || <span className="text-muted-foreground/60 font-normal">Não informado</span>}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-telefone">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Telefone</p>
                  <p className="text-sm font-semibold" data-testid="text-telefone">{cliente.telefone ? formatPhoneMask(cliente.telefone) : <span className="text-muted-foreground/60 font-normal">Não informado</span>}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-responsavel">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Responsável</p>
                  <p className="text-sm font-semibold" data-testid="text-responsavel">{cliente.responsavel || <span className="text-muted-foreground/60 font-normal">Não informado</span>}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-responsavel-geral">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nome Responsável</p>
                  <p className="text-sm font-semibold" data-testid="text-responsavel-geral">{cliente.responsavelGeral || <span className="text-muted-foreground/60 font-normal">Não informado</span>}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-nome-dono">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Crown className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nome do Dono</p>
                  <p className="text-sm font-semibold" data-testid="text-nome-dono">{cliente.nomeDono || <span className="text-muted-foreground/60 font-normal">Não informado</span>}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-email">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
                  {cliente.email ? (
                    <a href={`mailto:${cliente.email}`} className="text-sm font-semibold text-primary hover:underline" data-testid="text-email">{cliente.email}</a>
                  ) : (
                    <p className="text-sm text-muted-foreground/60" data-testid="text-email">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-site">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Site</p>
                  {cliente.site ? (
                    <a href={cliente.site.startsWith('http') ? cliente.site : `https://${cliente.site}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1" data-testid="text-site">
                      {cliente.site}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground/60" data-testid="text-site">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-instagram">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <SiInstagram className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Instagram</p>
                  {cliente.instagram ? (
                    <a href={cliente.instagram.startsWith('http') ? cliente.instagram : `https://instagram.com/${cliente.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1" data-testid="text-instagram">
                      {cliente.instagram}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground/60" data-testid="text-instagram">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-data-cadastro">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Data de Cadastro</p>
                  <p className="text-sm font-semibold" data-testid="text-data-cadastro">
                    {cliente.createdAt 
                      ? new Date(cliente.createdAt).toLocaleDateString('pt-BR')
                      : cliente.dataInicio 
                        ? new Date(cliente.dataInicio).toLocaleDateString('pt-BR')
                        : <span className="text-muted-foreground/60 font-normal">Não informado</span>
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-status">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                  <Badge variant={temContratoAtivo ? "default" : "secondary"} className="text-xs" data-testid="badge-status-cliente">
                    {temContratoAtivo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="field-status-conta">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status da Conta</p>
                  <Select
                    value={cliente.statusConta || ""}
                    onValueChange={(value) => {
                      const newValue = value === "__none__" ? null : value;
                      updateStatusContaMutation.mutate(newValue);
                    }}
                    disabled={updateStatusContaMutation.isPending}
                  >
                    <SelectTrigger 
                      className="w-auto h-auto p-0 border-0 shadow-none bg-transparent [&>span]:flex [&>span]:items-center [&>span]:gap-1.5"
                      data-testid="select-status-conta"
                    >
                      <SelectValue>
                        {(() => {
                          const statusInfo = getAccountStatusInfo(cliente.statusConta);
                          return (
                            <Badge className={statusInfo.color} variant="outline">
                              {statusInfo.label}
                            </Badge>
                          );
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <Badge className="bg-muted text-muted-foreground" variant="outline">Não definido</Badge>
                      </SelectItem>
                      <SelectItem value="saudavel">
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" variant="outline">Saudável</Badge>
                      </SelectItem>
                      <SelectItem value="requer_atencao">
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" variant="outline">Requer Atenção</Badge>
                      </SelectItem>
                      <SelectItem value="insatisfeito">
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" variant="outline">Insatisfeito</Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-cluster">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cluster</p>
                  <Badge className={`text-xs ${getClusterInfo(cliente.cluster).color}`} variant="outline" data-testid="badge-cluster">
                    {getClusterInfo(cliente.cluster).label}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-tipo-negocio">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo de Negócio</p>
                  {(() => {
                    const badge = getBusinessTypeInfo(cliente.tipoNegocio);
                    return (
                      <Badge className={`text-xs ${badge.color}`} variant="outline" data-testid="badge-tipo-negocio">
                        {badge.label}
                      </Badge>
                    );
                  })()}
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-faturamento-mensal">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Faturamento Mensal</p>
                  <p className="text-sm font-semibold" data-testid="text-faturamento-mensal">
                    {formatCurrency(cliente.faturamentoMensal) || <span className="text-muted-foreground/60 font-normal">Não informado</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-investimento-ads">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Investimento em Ads</p>
                  <p className="text-sm font-semibold" data-testid="text-investimento-ads">
                    {formatCurrency(cliente.investimentoAds) || <span className="text-muted-foreground/60 font-normal">Não informado</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-link-clickup">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <ListTodo className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Link Lista ClickUp</p>
                  {cliente.linkListaClickup ? (
                    <a href={cliente.linkListaClickup} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1" data-testid="text-link-clickup">
                      Abrir no ClickUp
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground/60" data-testid="text-link-clickup">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5" data-testid="info-links-contrato">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Links Contrato</p>
                  {cliente.linksContrato ? (
                    <div className="flex flex-col gap-0.5" data-testid="list-links-contrato">
                      {cliente.linksContrato.split(/[,\n]/).filter(link => link.trim()).map((link, idx) => (
                        <a key={idx} href={link.trim().startsWith('http') ? link.trim() : `https://${link.trim()}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1" data-testid={`link-contrato-${idx}`}>
                          Contrato {idx + 1}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground/60" data-testid="text-no-links-contrato">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5 lg:col-span-3" data-testid="info-servicos">
                <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Serviços Ativos</p>
                  {servicosAtivos.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5" data-testid="list-servicos">
                      {servicosAtivos.map((servico, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="text-xs bg-primary/10"
                          data-testid={`badge-servico-${idx}`}
                        >
                          {servico}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground/60" data-testid="text-no-servicos">Nenhum serviço ativo</p>
                  )}
                </div>
              </div>
            </div>
              )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </div>

        {isLoadingRevenue ? (
          <div className="mb-8 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="mb-8">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-xl font-semibold">Histórico de Faturamento</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Período:</span>
                    <Select
                      value={monthsFilter}
                      onValueChange={setMonthsFilter}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-months-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 meses</SelectItem>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                        <SelectItem value="all">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <RevenueChart 
                  data={chartData} 
                  onBarClick={handleBarClick}
                  selectedMonth={selectedMonth}
                />
              </div>
            </Card>
          </div>
        ) : null}

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Contratos</h2>
          </div>
          <Card className="overflow-hidden">
            {isLoadingContratos ? (
              <div className="flex items-center justify-center py-8" data-testid="loading-contratos">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-sm">
                    <TableRow className="bg-muted/30 border-b">
                      <TableHead 
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('servico')}
                        data-testid="header-sort-service"
                      >
                        <div className="flex items-center gap-1">
                          Serviço
                          <SortIndicator sortKey="servico" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('status')}
                        data-testid="header-sort-status"
                      >
                        <div className="flex items-center gap-1">
                          Status
                          <SortIndicator sortKey="status" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('squad')}
                        data-testid="header-sort-squad"
                      >
                        <div className="flex items-center gap-1">
                          Squad
                          <SortIndicator sortKey="squad" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-responsavel">Responsável</TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-cs">CS</TableHead>
                      <TableHead 
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('dataInicio')}
                        data-testid="header-sort-date"
                      >
                        <div className="flex items-center gap-1">
                          Data Início
                          <SortIndicator sortKey="dataInicio" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-right bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('valorr')}
                        data-testid="header-sort-recurring"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Valor Recorrente
                          <SortIndicator sortKey="valorr" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-right bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('valorp')}
                        data-testid="header-sort-onetime"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Valor Pontual
                          <SortIndicator sortKey="valorp" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-plano">
                        Plano
                      </TableHead>
                      <TableHead className="bg-muted/30 text-center" data-testid="header-lt">
                        LT
                      </TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-solic-cancel">
                        Solic. Cancel.
                      </TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-data-entrega">
                        Data Entrega
                      </TableHead>
                      <TableHead className="bg-muted/30 text-center" data-testid="header-acoes">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedContratos && sortedContratos.length > 0 ? (
                      sortedContratos.map((contrato) => {
                        const isEditing = editingContratoId === contrato.idSubtask;
                        
                        if (isEditing) {
                          return (
                            <TableRow key={contrato.idSubtask} className="bg-muted/20" data-testid={`contract-row-editing-${contrato.idSubtask}`}>
                              <TableCell>
                                <Select
                                  value={contratoEditForm.watch("servico")}
                                  onValueChange={(val) => contratoEditForm.setValue("servico", val)}
                                >
                                  <SelectTrigger className="w-[140px]" data-testid={`select-servico-${contrato.idSubtask}`}>
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {servicosDisponiveis.map((s) => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={contratoEditForm.watch("status")}
                                  onValueChange={(val) => contratoEditForm.setValue("status", val)}
                                >
                                  <SelectTrigger className="w-[140px]" data-testid={`select-status-${contrato.idSubtask}`}>
                                    <SelectValue placeholder="Status..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CONTRACT_STATUS_OPTIONS.map((s) => (
                                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={contratoEditForm.watch("squad")}
                                  onValueChange={(val) => contratoEditForm.setValue("squad", val)}
                                >
                                  <SelectTrigger className="w-[120px]" data-testid={`select-squad-${contrato.idSubtask}`}>
                                    <SelectValue placeholder="Squad..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SQUAD_OPTIONS.map((s) => (
                                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Popover open={openContratoResponsavel} onOpenChange={setOpenContratoResponsavel}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={openContratoResponsavel}
                                      className="w-[160px] justify-between font-normal"
                                      data-testid={`select-responsavel-${contrato.idSubtask}`}
                                    >
                                      <span className="truncate">
                                        {contratoEditForm.watch("responsavel") || "Responsável..."}
                                      </span>
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[250px] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Buscar colaborador..." />
                                      <CommandList>
                                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                                        <CommandGroup>
                                          <CommandItem
                                            value="__none__"
                                            onSelect={() => {
                                              contratoEditForm.setValue("responsavel", "");
                                              setOpenContratoResponsavel(false);
                                            }}
                                          >
                                            <Check className={`mr-2 h-4 w-4 ${!contratoEditForm.watch("responsavel") ? "opacity-100" : "opacity-0"}`} />
                                            Nenhum
                                          </CommandItem>
                                          {colaboradoresDropdown?.filter(c => c.status === "Ativo").map((c) => (
                                            <CommandItem
                                              key={c.id}
                                              value={c.nome}
                                              onSelect={() => {
                                                contratoEditForm.setValue("responsavel", c.nome);
                                                setOpenContratoResponsavel(false);
                                              }}
                                            >
                                              <Check className={`mr-2 h-4 w-4 ${contratoEditForm.watch("responsavel") === c.nome ? "opacity-100" : "opacity-0"}`} />
                                              {c.nome}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell>
                                <Popover open={openContratoCs} onOpenChange={setOpenContratoCs}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={openContratoCs}
                                      className="w-[160px] justify-between font-normal"
                                      data-testid={`select-cs-${contrato.idSubtask}`}
                                    >
                                      <span className="truncate">
                                        {contratoEditForm.watch("csResponsavel") || "CS..."}
                                      </span>
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[250px] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Buscar colaborador..." />
                                      <CommandList>
                                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                                        <CommandGroup>
                                          <CommandItem
                                            value="__none__"
                                            onSelect={() => {
                                              contratoEditForm.setValue("csResponsavel", "");
                                              setOpenContratoCs(false);
                                            }}
                                          >
                                            <Check className={`mr-2 h-4 w-4 ${!contratoEditForm.watch("csResponsavel") ? "opacity-100" : "opacity-0"}`} />
                                            Nenhum
                                          </CommandItem>
                                          {colaboradoresDropdown?.filter(c => c.status === "Ativo").map((c) => (
                                            <CommandItem
                                              key={c.id}
                                              value={c.nome}
                                              onSelect={() => {
                                                contratoEditForm.setValue("csResponsavel", c.nome);
                                                setOpenContratoCs(false);
                                              }}
                                            >
                                              <Check className={`mr-2 h-4 w-4 ${contratoEditForm.watch("csResponsavel") === c.nome ? "opacity-100" : "opacity-0"}`} />
                                              {c.nome}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell>
                                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="w-[130px] justify-start text-left font-normal"
                                      data-testid={`date-picker-${contrato.idSubtask}`}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {contratoEditForm.watch("dataInicio") 
                                        ? format(new Date(contratoEditForm.watch("dataInicio")), "dd/MM/yyyy", { locale: ptBR })
                                        : "Selecione..."
                                      }
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={contratoEditForm.watch("dataInicio") ? new Date(contratoEditForm.watch("dataInicio")) : undefined}
                                      onSelect={(date) => {
                                        if (date) {
                                          contratoEditForm.setValue("dataInicio", date.toISOString().split('T')[0]);
                                          setDatePickerOpen(false);
                                        }
                                      }}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  className="w-[100px] text-right"
                                  placeholder="R$ 0,00"
                                  value={contratoEditForm.watch("valorr")}
                                  onChange={(e) => {
                                    let val = e.target.value.replace(/\D/g, "");
                                    if (val) {
                                      const floatVal = parseFloat(val) / 100;
                                      const formatted = new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                      }).format(floatVal);
                                      contratoEditForm.setValue("valorr", formatted);
                                    } else {
                                      contratoEditForm.setValue("valorr", "");
                                    }
                                  }}
                                  data-testid={`input-valorr-${contrato.idSubtask}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  className="w-[100px] text-right"
                                  placeholder="R$ 0,00"
                                  value={contratoEditForm.watch("valorp")}
                                  onChange={(e) => {
                                    let val = e.target.value.replace(/\D/g, "");
                                    if (val) {
                                      const floatVal = parseFloat(val) / 100;
                                      const formatted = new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                      }).format(floatVal);
                                      contratoEditForm.setValue("valorp", formatted);
                                    } else {
                                      contratoEditForm.setValue("valorp", "");
                                    }
                                  }}
                                  data-testid={`input-valorp-${contrato.idSubtask}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  className="w-[100px]"
                                  placeholder="Plano..."
                                  value={contratoEditForm.watch("produto")}
                                  onChange={(e) => contratoEditForm.setValue("produto", e.target.value)}
                                  data-testid={`input-produto-${contrato.idSubtask}`}
                                />
                              </TableCell>
                              <TableCell className="text-center font-medium" data-testid={`text-lt-${contrato.idSubtask}`}>
                                {calcularLTContrato(contrato)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {contrato.dataSolicitacaoEncerramento ? new Date(contrato.dataSolicitacaoEncerramento).toLocaleDateString('pt-BR') : '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {contrato.dataEncerramento ? new Date(contrato.dataEncerramento).toLocaleDateString('pt-BR') : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={handleSaveContrato}
                                    disabled={updateContratoMutation.isPending}
                                    data-testid={`button-save-${contrato.idSubtask}`}
                                  >
                                    {updateContratoMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4 text-green-600" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={handleCancelEditContrato}
                                    disabled={updateContratoMutation.isPending}
                                    data-testid={`button-cancel-${contrato.idSubtask}`}
                                  >
                                    <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        return (
                          <TableRow key={contrato.idSubtask} className="hover-elevate" data-testid={`contract-row-${contrato.idSubtask}`}>
                            <TableCell className="font-medium" data-testid={`text-service-${contrato.idSubtask}`}>
                              {contrato.servico || "Sem serviço"}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={getContractStatusColor(contrato.status || "")} 
                                variant="outline"
                                data-testid={`badge-status-${contrato.idSubtask}`}
                              >
                                {contrato.status || "Desconhecido"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={getSquadColorForContract(getSquadLabel(contrato.squad))} 
                                variant="outline"
                                data-testid={`badge-squad-${contrato.idSubtask}`}
                              >
                                {getSquadLabel(contrato.squad)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground" data-testid={`text-responsavel-${contrato.idSubtask}`}>
                              {contrato.responsavel || '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground" data-testid={`text-cs-${contrato.idSubtask}`}>
                              {contrato.csResponsavel || '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground" data-testid={`text-date-${contrato.idSubtask}`}>
                              {contrato.dataInicio ? new Date(contrato.dataInicio).toLocaleDateString('pt-BR') : '-'}
                            </TableCell>
                            <TableCell className="text-right font-semibold" data-testid={`text-recurring-${contrato.idSubtask}`}>
                              {contrato.valorr && parseFloat(contrato.valorr) > 0
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(contrato.valorr))
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-right font-semibold" data-testid={`text-onetime-${contrato.idSubtask}`}>
                              {contrato.valorp && parseFloat(contrato.valorp) > 0
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(contrato.valorp))
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-muted-foreground" data-testid={`text-plano-${contrato.idSubtask}`}>
                              {contrato.plano || '-'}
                            </TableCell>
                            <TableCell className="text-center font-medium" data-testid={`text-lt-${contrato.idSubtask}`}>
                              {calcularLTContrato(contrato)}
                            </TableCell>
                            <TableCell className="text-muted-foreground" data-testid={`text-solic-cancel-${contrato.idSubtask}`}>
                              {contrato.dataSolicitacaoEncerramento ? new Date(contrato.dataSolicitacaoEncerramento).toLocaleDateString('pt-BR') : '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground" data-testid={`text-data-entrega-${contrato.idSubtask}`}>
                              {contrato.dataEncerramento ? new Date(contrato.dataEncerramento).toLocaleDateString('pt-BR') : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEditContrato(contrato)}
                                disabled={!!editingContratoId}
                                data-testid={`button-edit-${contrato.idSubtask}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center text-muted-foreground py-8" data-testid="text-no-contracts">
                          Nenhum contrato encontrado para este cliente
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Contas a Receber</h2>
            </div>
            {selectedMonth && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="badge-month-filter">
                  Filtrado por: {selectedMonth}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedMonth(null)}
                  data-testid="button-clear-month-filter"
                >
                  Limpar filtro
                </Button>
              </div>
            )}
          </div>
          <Card className="overflow-hidden">
            {isLoadingReceitas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 shadow-sm">
                      <TableRow className="bg-muted/30 border-b">
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('descricao')}
                          data-testid="header-sort-descricao"
                        >
                          <div className="flex items-center gap-1">
                            Descrição
                            <SortIndicator sortKey="descricao" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('status')}
                          data-testid="header-sort-receita-status"
                        >
                          <div className="flex items-center gap-1">
                            Status
                            <SortIndicator sortKey="status" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('dataVencimento')}
                          data-testid="header-sort-vencimento"
                        >
                          <div className="flex items-center gap-1">
                            Vencimento
                            <SortIndicator sortKey="dataVencimento" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('total')}
                          data-testid="header-sort-total"
                        >
                          <div className="flex items-center gap-1">
                            Valor Total
                            <SortIndicator sortKey="total" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('pago')}
                          data-testid="header-sort-pago"
                        >
                          <div className="flex items-center gap-1">
                            Pago
                            <SortIndicator sortKey="pago" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('naoPago')}
                          data-testid="header-sort-pendente"
                        >
                          <div className="flex items-center gap-1">
                            Pendente
                            <SortIndicator sortKey="naoPago" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead className="bg-muted/30">Link Cobrança</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReceitas.length > 0 ? (
                        paginatedReceitas.map((receita, idx) => (
                          <TableRow key={`receita-${receita.id}-${idx}`} className="hover-elevate">
                            <TableCell className="font-medium">
                              {receita.descricao || "Sem descrição"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(receita.status, receita.dataVencimento, receita.naoPago)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {receita.dataVencimento 
                                ? new Date(receita.dataVencimento).toLocaleDateString('pt-BR')
                                : "N/A"
                              }
                            </TableCell>
                            <TableCell className="font-semibold">
                              {new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              }).format(parseFloat(receita.total || "0"))}
                            </TableCell>
                            <TableCell className="text-green-600">
                              {new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              }).format(parseFloat(receita.pago || "0"))}
                            </TableCell>
                            <TableCell className="text-orange-600">
                              {new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              }).format(parseFloat(receita.naoPago || "0"))}
                            </TableCell>
                            <TableCell>
                              {receita.urlCobranca ? (
                                <a 
                                  href={receita.urlCobranca} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                  data-testid={`link-cobranca-${receita.id}`}
                                >
                                  Acessar
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm" data-testid={`text-no-link-${receita.id}`}>-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhuma conta a receber encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {receitasTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Itens por página:</span>
                      <Select
                        value={receitasItemsPerPage.toString()}
                        onValueChange={(value) => {
                          setReceitasItemsPerPage(Number(value));
                          setReceitasCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[100px]" data-testid="select-receitas-items-per-page">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Página {receitasCurrentPage} de {receitasTotalPages}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(1)}
                          disabled={receitasCurrentPage === 1}
                          data-testid="button-receitas-first-page"
                        >
                          Primeira
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(receitasCurrentPage - 1)}
                          disabled={receitasCurrentPage === 1}
                          data-testid="button-receitas-prev-page"
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(receitasCurrentPage + 1)}
                          disabled={receitasCurrentPage === receitasTotalPages}
                          data-testid="button-receitas-next-page"
                        >
                          Próxima
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(receitasTotalPages)}
                          disabled={receitasCurrentPage === receitasTotalPages}
                          data-testid="button-receitas-last-page"
                        >
                          Última
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Credenciais de Acesso</h2>
          </div>
          <Card className="overflow-hidden">
            {isLoadingCredenciais ? (
              <div className="flex items-center justify-center py-8" data-testid="loading-credenciais">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : credenciais && credenciais.length > 0 && credenciais.some(g => g.credentials.length > 0) ? (
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-sm">
                    <TableRow className="bg-muted/30 border-b">
                      <TableHead className="bg-muted/30">Plataforma</TableHead>
                      <TableHead className="bg-muted/30">Login</TableHead>
                      <TableHead className="bg-muted/30">Senha</TableHead>
                      <TableHead className="bg-muted/30">URL</TableHead>
                      <TableHead className="bg-muted/30">Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credenciais.flatMap((group) => 
                      group.credentials.map((cred) => (
                        <TableRow key={cred.id} className="hover-elevate" data-testid={`credential-row-${cred.id}`}>
                          <TableCell className="font-medium" data-testid={`text-platform-${cred.id}`}>
                            {cred.platform || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span data-testid={`text-username-${cred.id}`}>{cred.username || "-"}</span>
                              {cred.username && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyToClipboard(cred.username, "Login")}
                                  data-testid={`button-copy-username-${cred.id}`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span 
                                className="font-mono" 
                                data-testid={`text-password-${cred.id}`}
                              >
                                {visiblePasswords.has(cred.id) 
                                  ? (cred.password || "-")
                                  : cred.password ? "••••••••" : "-"
                                }
                              </span>
                              {cred.password && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => togglePasswordVisibility(cred.id, cred.platform, group.name)}
                                    data-testid={`button-toggle-password-${cred.id}`}
                                  >
                                    {visiblePasswords.has(cred.id) ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copyToClipboard(cred.password, "Senha", cred.id, cred.platform, group.name)}
                                    data-testid={`button-copy-password-${cred.id}`}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {cred.accessUrl ? (
                              <a
                                href={cred.accessUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                data-testid={`link-url-${cred.id}`}
                              >
                                Acessar
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm" data-testid={`text-no-url-${cred.id}`}>-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate" data-testid={`text-observations-${cred.id}`}>
                            {cred.observations || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="no-credentials">
                <Key className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhuma credencial vinculada a este cliente</p>
              </div>
            )}
          </Card>
        </div>
          </TabsContent>

          <TabsContent value="tarefas" data-testid="tabcontent-tarefas">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <ListTodo className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Tarefas do Cliente</h2>
              </div>
              {isLoadingTasks ? (
                <div className="flex items-center justify-center py-8" data-testid="loading-tasks">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : tasks && tasks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-b">
                      <TableHead className="bg-muted/30" data-testid="header-task-nome">Nome</TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-task-status">Status</TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-task-prioridade">Prioridade</TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-task-responsavel">Responsável</TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-task-data">Data Limite</TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-task-projeto">Projeto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id} className="hover-elevate" data-testid={`task-row-${task.id}`}>
                        <TableCell className="font-medium" data-testid={`task-nome-${task.id}`}>
                          {task.nome}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              task.status?.toLowerCase() === 'done' || task.status?.toLowerCase() === 'concluído' || task.status?.toLowerCase() === 'complete'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : task.status?.toLowerCase() === 'in progress' || task.status?.toLowerCase() === 'em progresso' || task.status?.toLowerCase() === 'em andamento'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                            }
                            variant="outline"
                            data-testid={`task-status-${task.id}`}
                          >
                            {task.status || 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              task.prioridade?.toLowerCase() === 'alta' || task.prioridade?.toLowerCase() === 'urgent' || task.prioridade?.toLowerCase() === 'high'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                : task.prioridade?.toLowerCase() === 'média' || task.prioridade?.toLowerCase() === 'normal' || task.prioridade?.toLowerCase() === 'medium'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                            }
                            variant="outline"
                            data-testid={`task-prioridade-${task.id}`}
                          >
                            <Flag className="w-3 h-3 mr-1" />
                            {task.prioridade || 'Baixa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`task-responsavel-${task.id}`}>
                          {task.responsavel || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`task-data-${task.id}`}>
                          {task.dataLimite ? new Date(task.dataLimite).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`task-projeto-${task.id}`}>
                          {task.projeto || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="no-tasks">
                  <ListTodo className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-lg">Nenhuma tarefa encontrada</p>
                  <p className="text-muted-foreground text-sm mt-1">As tarefas do ClickUp aparecerão aqui quando disponíveis</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="comunicacao" data-testid="tabcontent-comunicacao">
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Plus className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Nova Comunicação</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tipo</label>
                    <Select
                      value={newComunicacao.tipo}
                      onValueChange={(val) => setNewComunicacao(prev => ({ ...prev, tipo: val }))}
                    >
                      <SelectTrigger data-testid="select-comunicacao-tipo">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="reuniao">Reunião</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="nota">Nota Interna</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Prioridade</label>
                    <Select
                      value={newComunicacao.prioridade}
                      onValueChange={(val) => setNewComunicacao(prev => ({ ...prev, prioridade: val }))}
                    >
                      <SelectTrigger data-testid="select-comunicacao-prioridade">
                        <SelectValue placeholder="Selecione a prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Título</label>
                  <Input
                    placeholder="Título da comunicação"
                    value={newComunicacao.titulo}
                    onChange={(e) => setNewComunicacao(prev => ({ ...prev, titulo: e.target.value }))}
                    data-testid="input-comunicacao-titulo"
                  />
                </div>
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Conteúdo</label>
                  <Textarea
                    placeholder="Descreva a comunicação..."
                    className="min-h-[100px]"
                    value={newComunicacao.conteudo}
                    onChange={(e) => setNewComunicacao(prev => ({ ...prev, conteudo: e.target.value }))}
                    data-testid="textarea-comunicacao-conteudo"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => createComunicacaoMutation.mutate(newComunicacao)}
                    disabled={!newComunicacao.tipo || !newComunicacao.titulo || createComunicacaoMutation.isPending}
                    data-testid="button-criar-comunicacao"
                  >
                    {createComunicacaoMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Criar Comunicação
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Histórico de Comunicações</h2>
                </div>
                {isLoadingComunicacoes ? (
                  <div className="flex items-center justify-center py-8" data-testid="loading-comunicacoes">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : comunicacoes && comunicacoes.length > 0 ? (
                  <div className="space-y-4">
                    {comunicacoes.map((com) => (
                      <div 
                        key={com.id} 
                        className="border rounded-md p-4 hover-elevate"
                        data-testid={`comunicacao-item-${com.id}`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            <Badge 
                              className={
                                com.tipo === 'email' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                com.tipo === 'telefone' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                com.tipo === 'reuniao' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                com.tipo === 'whatsapp' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                              }
                              variant="outline"
                              data-testid={`comunicacao-tipo-${com.id}`}
                            >
                              {com.tipo}
                            </Badge>
                            <Badge 
                              className={
                                com.prioridade === 'urgente' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                com.prioridade === 'alta' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                                com.prioridade === 'media' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                              }
                              variant="outline"
                              data-testid={`comunicacao-prioridade-${com.id}`}
                            >
                              {com.prioridade}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span data-testid={`comunicacao-data-${com.id}`}>
                              {new Date(com.data).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        <h3 className="font-semibold mb-1" data-testid={`comunicacao-titulo-${com.id}`}>
                          {com.titulo}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2" data-testid={`comunicacao-conteudo-${com.id}`}>
                          {com.conteudo}
                        </p>
                        {com.criadoPor && (
                          <p className="text-xs text-muted-foreground mt-2" data-testid={`comunicacao-criador-${com.id}`}>
                            Criado por: {com.criadoPor}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="no-comunicacoes">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-lg">Nenhuma comunicação registrada</p>
                    <p className="text-muted-foreground text-sm mt-1">Crie uma nova comunicação usando o formulário acima</p>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="situacao-financeira" data-testid="tabcontent-situacao-financeira">
            {isLoadingSituacao ? (
              <div className="flex items-center justify-center py-8" data-testid="loading-situacao">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6" data-testid="card-inadimplencia">
                  <div className="flex items-center gap-3 mb-6">
                    <AlertTriangle className={`w-5 h-5 ${situacaoJuridica?.hasInadimplencia ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <h2 className="text-lg font-semibold">Inadimplência</h2>
                  </div>
                  {situacaoJuridica?.hasInadimplencia && situacaoJuridica.inadimplencia ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ação</p>
                        <Badge 
                          className={
                            situacaoJuridica.inadimplencia.acao?.toLowerCase().includes('resolvido') || 
                            situacaoJuridica.inadimplencia.acao?.toLowerCase().includes('quitado')
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }
                          variant="outline"
                          data-testid="inadimplencia-acao"
                        >
                          {situacaoJuridica.inadimplencia.acao || 'Não definido'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status Financeiro</p>
                        <p className="font-medium" data-testid="inadimplencia-status">
                          {situacaoJuridica.inadimplencia.statusFinanceiro || 'Não informado'}
                        </p>
                      </div>
                      {situacaoJuridica.inadimplencia.contexto && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Contexto</p>
                          <p className="text-sm text-muted-foreground" data-testid="inadimplencia-contexto">
                            {situacaoJuridica.inadimplencia.contexto}
                          </p>
                        </div>
                      )}
                      {situacaoJuridica.inadimplencia.valorAcordado && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Valor Acordado</p>
                          <p className="font-semibold text-green-600" data-testid="inadimplencia-valor">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(situacaoJuridica.inadimplencia.valorAcordado))}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="no-inadimplencia">
                      <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                      <p className="text-muted-foreground">Nenhum registro de inadimplência</p>
                    </div>
                  )}
                </Card>

                <Card className="p-6" data-testid="card-juridico">
                  <div className="flex items-center gap-3 mb-6">
                    <Scale className={`w-5 h-5 ${situacaoJuridica?.hasJuridico ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <h2 className="text-lg font-semibold">Jurídico</h2>
                  </div>
                  {situacaoJuridica?.hasJuridico && situacaoJuridica.juridico ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Procedimento</p>
                        <Badge 
                          className={
                            situacaoJuridica.juridico.statusJuridico?.toLowerCase().includes('encerrado') || 
                            situacaoJuridica.juridico.statusJuridico?.toLowerCase().includes('arquivado')
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }
                          variant="outline"
                          data-testid="juridico-procedimento"
                        >
                          {situacaoJuridica.juridico.procedimento || 'Não definido'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status Jurídico</p>
                        <p className="font-medium" data-testid="juridico-status">
                          {situacaoJuridica.juridico.statusJuridico || 'Não informado'}
                        </p>
                      </div>
                      {situacaoJuridica.juridico.advogadoResponsavel && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Advogado Responsável</p>
                          <p className="font-medium" data-testid="juridico-advogado">
                            {situacaoJuridica.juridico.advogadoResponsavel}
                          </p>
                        </div>
                      )}
                      {situacaoJuridica.juridico.protocoloProcesso && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Protocolo do Processo</p>
                          <p className="font-mono text-sm" data-testid="juridico-protocolo">
                            {situacaoJuridica.juridico.protocoloProcesso}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="no-juridico">
                      <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                      <p className="text-muted-foreground">Nenhum registro jurídico</p>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog para adicionar nota */}
        <Dialog open={notaDialogOpen} onOpenChange={setNotaDialogOpen}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-nota">
            <DialogHeader>
              <DialogTitle>Adicionar Nota</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Digite sua nota aqui..."
                value={notaText}
                onChange={(e) => setNotaText(e.target.value)}
                className="min-h-[120px]"
                data-testid="input-nota-text"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setNotaDialogOpen(false);
                  setNotaText("");
                }}
                data-testid="button-nota-cancel"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (notaText.trim()) {
                    createEventMutation.mutate({
                      tipo: "nota",
                      titulo: "Nota adicionada",
                      descricao: notaText.trim()
                    });
                    setNotaDialogOpen(false);
                    setNotaText("");
                  } else {
                    toast({
                      title: "Erro",
                      description: "A nota não pode estar vazia.",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={createEventMutation.isPending}
                data-testid="button-nota-submit"
              >
                {createEventMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Salvar Nota
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
