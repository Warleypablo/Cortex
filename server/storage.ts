import { type User, type InsertUser, type Cliente, type ContaReceber, type ContaPagar, type Colaborador, type InsertColaborador, type ContratoCompleto, type Patrimonio, type InsertPatrimonio, type FluxoCaixaItem, type FluxoCaixaDiarioItem, type SaldoBancos, type TransacaoDiaItem, type DfcResponse, type DfcHierarchicalResponse, type DfcItem, type DfcNode, type DfcParcela, type InhireMetrics, type InhireStatusDistribution, type InhireStageDistribution, type InhireSourceDistribution, type InhireFunnel, type InhireVagaComCandidaturas, type MetaOverview, type CampaignPerformance, type AdsetPerformance, type AdPerformance, type CreativePerformance, type ConversionFunnel, type ContaBanco, type FluxoCaixaDiarioCompleto, type FluxoCaixaInsights } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { eq, desc, and, or, gte, lte, sql, inArray, isNull } from "drizzle-orm";

export type ClienteCompleto = Cliente & {
  nomeClickup: string | null;
  statusClickup: string | null;
  telefone: string | null;
  responsavel: string | null;
  cluster: string | null;
  cnpjCliente: string | null;
  servicos: string | null;
  dataInicio: Date | null;
  ltMeses: number | null;
  ltDias: number | null;
  totalRecorrente: number | null;
  totalPontual: number | null;
};

export interface AniversariantesMes {
  id: number;
  nome: string;
  aniversario: string;
  cargo: string | null;
  squad: string | null;
  diasAteAniversario: number;
}

export interface AniversarioEmpresaMes {
  id: number;
  nome: string;
  admissao: string;
  cargo: string | null;
  squad: string | null;
  anosDeEmpresa: number;
  diasAteAniversarioEmpresa: number;
}

export interface UltimaPromocao {
  id: number;
  nome: string;
  cargo: string | null;
  squad: string | null;
  ultimoAumento: string | null;
  mesesDesdeAumento: number | null;
}

export interface TempoMedioPromocao {
  tempoMedioMeses: number;
  totalColaboradores: number;
}

export interface TempoPermanencia {
  tempoPermanenciaAtivos: number;
  totalAtivos: number;
  tempoPermanenciaDesligados: number;
  totalDesligados: number;
}

export interface PatrimonioComResponsavel extends Patrimonio {
  colaborador?: Colaborador;
}

export interface DashboardAnaliseData {
  aniversariantesMes: AniversariantesMes[];
  aniversarioEmpresaMes: AniversarioEmpresaMes[];
  ultimasPromocoes: UltimaPromocao[];
  tempoMedioPromocao: TempoMedioPromocao;
  tempoPermanencia: TempoPermanencia;
}

export interface ClienteContratoDetail {
  clienteId: string;
  nomeCliente: string;
  servico: string;
  squad: string;
  valorr: number;
  dataInicio: Date;
  dataEncerramento: Date | null;
}

export interface CohortRetentionRow {
  cohortMonth: string;
  cohortLabel: string;
  totalClients: number;
  totalValue: number;
  totalContracts: number;
  clientesContratos: ClienteContratoDetail[];
  retentionByMonth: {
    [monthOffset: number]: {
      activeClients: number;
      retentionRate: number;
      activeValue: number;
      valueRetentionRate: number;
      activeContracts: number;
      contractRetentionRate: number;
    };
  };
}

export interface CohortRetentionData {
  cohorts: CohortRetentionRow[];
  maxMonthOffset: number;
  filters: {
    squad?: string;
    servico?: string;
  };
  availableServicos: string[];
  availableSquads: string[];
}

export interface VisaoGeralMetricas {
  receitaTotal: number;
  mrr: number;
  aquisicaoMrr: number;
  aquisicaoPontual: number;
  cac: number;
  churn: number;
  pausados: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getClientes(): Promise<ClienteCompleto[]>;
  getClienteById(id: string): Promise<ClienteCompleto | undefined>;
  getClienteByCnpj(cnpj: string): Promise<Cliente | undefined>;
  getContasReceberByCliente(clienteId: string, limit?: number): Promise<ContaReceber[]>;
  getContasPagarByFornecedor(fornecedorId: string, limit?: number): Promise<ContaPagar[]>;
  getClienteRevenue(clienteId: string): Promise<{ mes: string; valor: number }[]>;
  getColaboradores(): Promise<Colaborador[]>;
  getColaboradoresComPatrimonios(): Promise<(Colaborador & { patrimonios: { id: number; descricao: string | null }[] })[]>;
  createColaborador(colaborador: InsertColaborador): Promise<Colaborador>;
  updateColaborador(id: number, colaborador: Partial<InsertColaborador>): Promise<Colaborador>;
  deleteColaborador(id: number): Promise<void>;
  getContratos(): Promise<ContratoCompleto[]>;
  getContratosPorCliente(clienteId: string): Promise<ContratoCompleto[]>;
  getPatrimonios(): Promise<Patrimonio[]>;
  getPatrimonioById(id: number): Promise<PatrimonioComResponsavel | undefined>;
  createPatrimonio(patrimonio: InsertPatrimonio): Promise<Patrimonio>;
  getColaboradoresDropdown(): Promise<{ id: number; nome: string }[]>;
  updatePatrimonioResponsavel(id: number, responsavelNome: string | null): Promise<Patrimonio>;
  getColaboradoresAnalise(): Promise<DashboardAnaliseData>;
  getSaldoAtualBancos(): Promise<SaldoBancos>;
  getFluxoCaixa(): Promise<FluxoCaixaItem[]>;
  getFluxoCaixaDiario(ano: number, mes: number): Promise<FluxoCaixaDiarioItem[]>;
  getTransacoesDia(ano: number, mes: number, dia: number): Promise<TransacaoDiaItem[]>;
  getContasBancos(): Promise<ContaBanco[]>;
  getFluxoCaixaDiarioCompleto(dataInicio: string, dataFim: string): Promise<FluxoCaixaDiarioCompleto[]>;
  getFluxoCaixaInsights(): Promise<FluxoCaixaInsights>;
  getCohortRetention(filters?: { squad?: string; servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<CohortRetentionData>;
  getVisaoGeralMetricas(mesAno: string): Promise<VisaoGeralMetricas>;
  getMrrEvolucaoMensal(mesAnoFim: string): Promise<import("@shared/schema").MrrEvolucaoMensal[]>;
  getChurnPorServico(filters?: { servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorServico[]>;
  getChurnPorResponsavel(filters?: { servicos?: string[]; squads?: string[]; colaboradores?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorResponsavel[]>;
  getDfc(dataInicio?: string, dataFim?: string): Promise<DfcHierarchicalResponse>;
  getGegMetricas(periodo: string, squad: string, setor: string): Promise<any>;
  getGegEvolucaoHeadcount(periodo: string, squad: string, setor: string): Promise<any>;
  getGegAdmissoesDemissoes(periodo: string, squad: string, setor: string): Promise<any>;
  getGegTempoPromocao(squad: string, setor: string): Promise<any>;
  getGegAniversariantesMes(squad: string, setor: string): Promise<any>;
  getGegAniversariosEmpresa(squad: string, setor: string): Promise<any>;
  getGegFiltros(): Promise<any>;
  getGegValorMedioSalario(squad: string, setor: string): Promise<{ valorMedio: number; totalColaboradores: number }>;
  getGegPatrimonioResumo(): Promise<{ totalAtivos: number; valorTotalPago: number; valorTotalMercado: number; porTipo: { tipo: string; quantidade: number }[] }>;
  getGegUltimasPromocoes(squad: string, setor: string, limit?: number): Promise<any[]>;
  getGegTempoPermanencia(squad: string, setor: string): Promise<{ tempoMedioAtivos: number; tempoMedioDesligados: number }>;
  getGegMasContratacoes(squad: string, setor: string): Promise<GegMasContratacoes>;
  getGegPessoasPorSetor(squad: string, setor: string): Promise<GegPessoasPorSetor[]>;
  getGegDemissoesPorTipo(squad: string, setor: string): Promise<GegDemissoesPorTipo[]>;
  getGegHeadcountPorTenure(squad: string, setor: string): Promise<GegHeadcountPorTenure[]>;
  getTopResponsaveis(limit?: number, mesAno?: string): Promise<{ nome: string; mrr: number; posicao: number }[]>;
  getTopSquads(limit?: number, mesAno?: string): Promise<{ squad: string; mrr: number; posicao: number }[]>;
  getInhireMetrics(): Promise<InhireMetrics>;
  getInhireStatusDistribution(): Promise<InhireStatusDistribution[]>;
  getInhireStageDistribution(): Promise<InhireStageDistribution[]>;
  getInhireSourceDistribution(): Promise<InhireSourceDistribution[]>;
  getInhireFunnel(): Promise<InhireFunnel[]>;
  getInhireVagasComCandidaturas(limit?: number): Promise<InhireVagaComCandidaturas[]>;
  getMetaDateRange(): Promise<{ minDate: string; maxDate: string }>;
  getMetaLeadFilters(): Promise<import("@shared/schema").MetaLeadFilters>;
  getMetaOverview(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams): Promise<MetaOverview>;
  getCampaignPerformance(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams): Promise<CampaignPerformance[]>;
  getAdsetPerformance(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams, campaignId?: string): Promise<AdsetPerformance[]>;
  getAdPerformance(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams, adsetId?: string): Promise<AdPerformance[]>;
  getCreativePerformance(startDate?: string, endDate?: string): Promise<CreativePerformance[]>;
  getConversionFunnel(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams): Promise<ConversionFunnel>;
  getAuditoriaSistemas(filters?: { mesAno?: string; dataInicio?: string; dataFim?: string; squad?: string; apenasDivergentes?: boolean; statusFiltro?: string; threshold?: number }): Promise<import("@shared/schema").AuditoriaSistemas[]>;
  getRecrutamentoKPIs(): Promise<import("@shared/schema").RecrutamentoKPIs>;
  getRecrutamentoFunil(): Promise<import("@shared/schema").RecrutamentoFunilEtapa[]>;
  getRecrutamentoFontes(): Promise<import("@shared/schema").RecrutamentoFonteDistribuicao[]>;
  getRecrutamentoEvolucao(meses?: number): Promise<import("@shared/schema").RecrutamentoEvolucaoMensal[]>;
  getRecrutamentoVagas(filters?: { area?: string; status?: string }): Promise<import("@shared/schema").RecrutamentoVagaDetalhe[]>;
  getRecrutamentoAreas(): Promise<import("@shared/schema").RecrutamentoAreaDistribuicao[]>;
  getRecrutamentoFiltros(): Promise<import("@shared/schema").RecrutamentoFiltros>;
  getRecrutamentoConversaoPorVaga(limit?: number): Promise<import("@shared/schema").RecrutamentoConversaoPorVaga[]>;
  getRecrutamentoTempoMedioPorEtapa(): Promise<import("@shared/schema").RecrutamentoTempoMedioPorEtapa[]>;
  getRecrutamentoEntrevistasRealizadas(): Promise<import("@shared/schema").RecrutamentoEntrevistasRealizadas>;
  getRecrutamentoEntrevistasPorCargo(): Promise<import("@shared/schema").RecrutamentoEntrevistasPorCargo[]>;
  getRecrutamentoCandidaturasPorArea(): Promise<import("@shared/schema").RecrutamentoCandidaturasPorArea[]>;
  
  // Tech Dashboard
  getTechMetricas(): Promise<TechMetricas>;
  getTechProjetosPorStatus(): Promise<TechProjetoStatus[]>;
  getTechProjetosPorResponsavel(): Promise<TechProjetoResponsavel[]>;
  getTechProjetosPorTipo(): Promise<TechProjetoTipo[]>;
  getTechProjetosEmAndamento(): Promise<TechProjetoDetalhe[]>;
  getTechProjetosFechados(limit?: number): Promise<TechProjetoDetalhe[]>;
  getTechTasksPorStatus(): Promise<TechTaskStatus[]>;
  getTechVelocidade(): Promise<TechVelocidade>;
}

// GEG Dashboard Extended Types
export interface GegMaContratacao {
  id: number;
  nome: string;
  setor: string | null;
  squad: string | null;
  admissao: string;
  demissao: string;
  diasAteDesligamento: number;
}

export interface GegMasContratacoes {
  total: number;
  colaboradores: GegMaContratacao[];
}

export interface GegPessoasPorSetor {
  setor: string;
  total: number;
}

export interface GegDemissoesPorTipo {
  tipo: string;
  total: number;
  percentual: number;
}

export interface GegHeadcountPorTenure {
  faixa: string;
  total: number;
  ordem: number;
}

// Tech Dashboard Types
export interface TechMetricas {
  projetosEmAndamento: number;
  projetosFechados: number;
  totalTasks: number;
  valorTotalProjetos: number;
  valorMedioProjeto: number;
  tempoMedioEntrega: number;
}

export interface TechProjetoStatus {
  status: string;
  quantidade: number;
  percentual: number;
}

export interface TechProjetoResponsavel {
  responsavel: string;
  projetosAtivos: number;
  projetosFechados: number;
  valorTotal: number;
}

export interface TechProjetoTipo {
  tipo: string;
  quantidade: number;
  valorTotal: number;
}

export interface TechProjetoDetalhe {
  clickupTaskId: string;
  taskName: string;
  statusProjeto: string;
  responsavel: string | null;
  faseProjeto: string | null;
  tipo: string | null;
  tipoProjeto: string | null;
  valorP: number | null;
  dataVencimento: string | null;
  lancamento: string | null;
  dataCriada: string | null;
}

export interface TechTaskStatus {
  status: string;
  quantidade: number;
}

export interface TechVelocidade {
  projetosEntreguesMes: number;
  tempoMedioEntrega: number;
  taxaCumprimentoPrazo: number;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getClientes(): Promise<ClienteCompleto[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getClienteById(id: string): Promise<ClienteCompleto | undefined> {
    throw new Error("Not implemented in MemStorage");
  }

  async getClienteByCnpj(cnpj: string): Promise<Cliente | undefined> {
    throw new Error("Not implemented in MemStorage");
  }

  async getContasReceberByCliente(clienteId: string, limit?: number): Promise<ContaReceber[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getContasPagarByFornecedor(fornecedorId: string, limit?: number): Promise<ContaPagar[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getClienteRevenue(clienteId: string): Promise<{ mes: string; valor: number }[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getColaboradores(): Promise<Colaborador[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getColaboradoresComPatrimonios(): Promise<(Colaborador & { patrimonios: { id: number; descricao: string | null }[] })[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async createColaborador(colaborador: InsertColaborador): Promise<Colaborador> {
    throw new Error("Not implemented in MemStorage");
  }

  async updateColaborador(id: number, colaborador: Partial<InsertColaborador>): Promise<Colaborador> {
    throw new Error("Not implemented in MemStorage");
  }

  async deleteColaborador(id: number): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }

  async getContratos(): Promise<ContratoCompleto[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getContratosPorCliente(clienteId: string): Promise<ContratoCompleto[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getPatrimonios(): Promise<Patrimonio[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getPatrimonioById(id: number): Promise<PatrimonioComResponsavel | undefined> {
    throw new Error("Not implemented in MemStorage");
  }

  async createPatrimonio(patrimonio: InsertPatrimonio): Promise<Patrimonio> {
    throw new Error("Not implemented in MemStorage");
  }

  async getColaboradoresDropdown(): Promise<{ id: number; nome: string }[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async updatePatrimonioResponsavel(id: number, responsavelNome: string | null): Promise<Patrimonio> {
    throw new Error("Not implemented in MemStorage");
  }

  async getColaboradoresAnalise(): Promise<DashboardAnaliseData> {
    throw new Error("Not implemented in MemStorage");
  }

  async getSaldoAtualBancos(): Promise<SaldoBancos> {
    throw new Error("Not implemented in MemStorage");
  }

  async getFluxoCaixa(): Promise<FluxoCaixaItem[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getFluxoCaixaDiario(ano: number, mes: number): Promise<FluxoCaixaDiarioItem[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTransacoesDia(ano: number, mes: number, dia: number): Promise<TransacaoDiaItem[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getContasBancos(): Promise<ContaBanco[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getFluxoCaixaDiarioCompleto(dataInicio: string, dataFim: string): Promise<FluxoCaixaDiarioCompleto[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getFluxoCaixaInsights(): Promise<FluxoCaixaInsights> {
    throw new Error("Not implemented in MemStorage");
  }

  async getCohortRetention(filters?: { squad?: string; servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<CohortRetentionData> {
    throw new Error("Not implemented in MemStorage");
  }

  async getVisaoGeralMetricas(mesAno: string): Promise<VisaoGeralMetricas> {
    throw new Error("Not implemented in MemStorage");
  }

  async getMrrEvolucaoMensal(mesAnoFim: string): Promise<import("@shared/schema").MrrEvolucaoMensal[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getChurnPorServico(filters?: { servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorServico[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getChurnPorResponsavel(filters?: { servicos?: string[]; squads?: string[]; colaboradores?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorResponsavel[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getDfc(dataInicio?: string, dataFim?: string): Promise<DfcHierarchicalResponse> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegMetricas(periodo: string, squad: string, setor: string): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegEvolucaoHeadcount(periodo: string, squad: string, setor: string): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegAdmissoesDemissoes(periodo: string, squad: string, setor: string): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegTempoPromocao(squad: string, setor: string): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegAniversariantesMes(squad: string, setor: string): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegAniversariosEmpresa(squad: string, setor: string): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegFiltros(): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegValorMedioSalario(squad: string, setor: string): Promise<{ valorMedio: number; totalColaboradores: number }> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegPatrimonioResumo(): Promise<{ totalAtivos: number; valorTotalPago: number; valorTotalMercado: number; porTipo: { tipo: string; quantidade: number }[] }> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegUltimasPromocoes(squad: string, setor: string, limit?: number): Promise<any[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegTempoPermanencia(squad: string, setor: string): Promise<{ tempoMedioAtivos: number; tempoMedioDesligados: number }> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegMasContratacoes(squad: string, setor: string): Promise<GegMasContratacoes> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegPessoasPorSetor(squad: string, setor: string): Promise<GegPessoasPorSetor[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegDemissoesPorTipo(squad: string, setor: string): Promise<GegDemissoesPorTipo[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getGegHeadcountPorTenure(squad: string, setor: string): Promise<GegHeadcountPorTenure[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTopResponsaveis(limit?: number): Promise<{ nome: string; mrr: number; posicao: number }[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getInhireMetrics(): Promise<InhireMetrics> {
    throw new Error("Not implemented in MemStorage");
  }

  async getInhireStatusDistribution(): Promise<InhireStatusDistribution[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getInhireStageDistribution(): Promise<InhireStageDistribution[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getInhireSourceDistribution(): Promise<InhireSourceDistribution[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getInhireFunnel(): Promise<InhireFunnel[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getInhireVagasComCandidaturas(limit?: number): Promise<InhireVagaComCandidaturas[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTopSquads(limit?: number, mesAno?: string): Promise<{ squad: string; mrr: number; posicao: number }[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getMetaDateRange(): Promise<{ minDate: string; maxDate: string }> {
    throw new Error("Not implemented in MemStorage");
  }

  async getMetaLeadFilters(): Promise<import("@shared/schema").MetaLeadFilters> {
    throw new Error("Not implemented in MemStorage");
  }

  async getMetaOverview(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams): Promise<MetaOverview> {
    throw new Error("Not implemented in MemStorage");
  }

  async getCampaignPerformance(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams): Promise<CampaignPerformance[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getAdsetPerformance(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams, campaignId?: string): Promise<AdsetPerformance[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getAdPerformance(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams, adsetId?: string): Promise<AdPerformance[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getCreativePerformance(startDate?: string, endDate?: string): Promise<CreativePerformance[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getConversionFunnel(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams): Promise<ConversionFunnel> {
    throw new Error("Not implemented in MemStorage");
  }

  async getAuditoriaSistemas(filters?: { mesAno?: string; dataInicio?: string; dataFim?: string; squad?: string; apenasDivergentes?: boolean; statusFiltro?: string; threshold?: number }): Promise<import("@shared/schema").AuditoriaSistemas[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoKPIs(): Promise<import("@shared/schema").RecrutamentoKPIs> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoFunil(): Promise<import("@shared/schema").RecrutamentoFunilEtapa[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoFontes(): Promise<import("@shared/schema").RecrutamentoFonteDistribuicao[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoEvolucao(meses?: number): Promise<import("@shared/schema").RecrutamentoEvolucaoMensal[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoVagas(filters?: { area?: string; status?: string }): Promise<import("@shared/schema").RecrutamentoVagaDetalhe[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoAreas(): Promise<import("@shared/schema").RecrutamentoAreaDistribuicao[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoFiltros(): Promise<import("@shared/schema").RecrutamentoFiltros> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoConversaoPorVaga(limit?: number): Promise<import("@shared/schema").RecrutamentoConversaoPorVaga[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoTempoMedioPorEtapa(): Promise<import("@shared/schema").RecrutamentoTempoMedioPorEtapa[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoEntrevistasRealizadas(): Promise<import("@shared/schema").RecrutamentoEntrevistasRealizadas> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoEntrevistasPorCargo(): Promise<import("@shared/schema").RecrutamentoEntrevistasPorCargo[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getRecrutamentoCandidaturasPorArea(): Promise<import("@shared/schema").RecrutamentoCandidaturasPorArea[]> {
    throw new Error("Not implemented in MemStorage");
  }

  // Tech Dashboard MemStorage implementations
  async getTechMetricas(): Promise<TechMetricas> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTechProjetosPorStatus(): Promise<TechProjetoStatus[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTechProjetosPorResponsavel(): Promise<TechProjetoResponsavel[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTechProjetosPorTipo(): Promise<TechProjetoTipo[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTechProjetosEmAndamento(): Promise<TechProjetoDetalhe[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTechProjetosFechados(limit?: number): Promise<TechProjetoDetalhe[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTechTasksPorStatus(): Promise<TechTaskStatus[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getTechVelocidade(): Promise<TechVelocidade> {
    throw new Error("Not implemented in MemStorage");
  }
}

function normalizeCode(code: string): string {
  const parts = code.split('.');
  return parts.map(part => part.padStart(2, '0')).join('.');
}

const CATEGORIA_NOMES_PADRAO: Record<string, string> = {
  // Nível 1
  '03': 'Receitas',
  '04': 'Outras Receitas',
  '05': 'Custos',
  '06': 'Despesas Operacionais',
  '07': 'Despesas Financeiras',
  '08': 'Outras Despesas',
  
  // Nível 2 - Receitas
  '03.01': 'Receitas de Serviços',
  '03.02': 'Receitas de Vendas',
  '03.03': 'Receitas Recorrentes',
  '03.04': 'Receitas Não Recorrentes',
  '03.05': 'Outras Receitas Operacionais',
  
  // Nível 2 - Custos
  '05.01': 'Custos de Produção',
  '05.02': 'Custos de Serviços',
  '05.03': 'Custos de Materiais',
  '05.04': 'Custos de Pessoal',
  '05.05': 'Custos Variáveis',
  '05.06': 'Custos Fixos',
  '05.07': 'Custos Diretos',
  '05.08': 'Custos Indiretos',
  
  // Nível 2 - Despesas Operacionais
  '06.01': 'Despesas Administrativas',
  '06.02': 'Despesas Comerciais',
  '06.03': 'Despesas com Pessoal',
  '06.04': 'Despesas Tributárias',
  '06.05': 'Despesas com Serviços',
  '06.06': 'Despesas com Marketing',
  '06.07': 'Despesas com Tecnologia',
  '06.08': 'Despesas com Infraestrutura',
  '06.09': 'Despesas com Manutenção',
  '06.10': 'Despesas com Viagens',
  '06.11': 'Despesas com Treinamento',
  '06.12': 'Despesas Diversas',
};

function getCategoriaName(code: string): string {
  return CATEGORIA_NOMES_PADRAO[code] || code;
}

/**
 * Infere nomes de categorias intermediárias a partir das categorias filhas.
 * Ex: "06.11.01 Computadores e periféricos" → "06.11" recebe "Computadores"
 */
function inferIntermediateNames(items: DfcItem[]): Map<string, string> {
  const inferredNames = new Map<string, string>();
  
  // Agrupa categorias por prefixo pai
  const childrenByParent = new Map<string, { code: string; name: string }[]>();
  
  for (const item of items) {
    const normalizedId = normalizeCode(item.categoriaId);
    const parts = normalizedId.split('.');
    
    // Para cada nível de hierarquia
    for (let i = 1; i < parts.length; i++) {
      const parentCode = parts.slice(0, i).join('.');
      const childInfo = { code: normalizedId, name: item.categoriaNome };
      
      if (!childrenByParent.has(parentCode)) {
        childrenByParent.set(parentCode, []);
      }
      childrenByParent.get(parentCode)!.push(childInfo);
    }
  }
  
  // Para cada categoria pai, tenta inferir um nome
  for (const [parentCode, children] of Array.from(childrenByParent.entries())) {
    // Se já temos nome no mapeamento padrão, pula
    if (CATEGORIA_NOMES_PADRAO[parentCode]) {
      continue;
    }
    
    // Tenta encontrar um prefixo comum nos nomes dos filhos
    if (children.length > 0) {
      const firstChildName = children[0].name;
      
      // Estratégia 1: Usar a primeira palavra do nome do filho
      const firstWord = firstChildName.split(/[\s-]/)[0];
      if (firstWord && firstWord.length > 3) {
        inferredNames.set(parentCode, firstWord);
        continue;
      }
      
      // Estratégia 2: Se todos os filhos começam com o mesmo prefixo, usa esse prefixo
      const commonPrefix = findCommonPrefix(children.map((c: { code: string; name: string }) => c.name));
      if (commonPrefix && commonPrefix.length > 3) {
        inferredNames.set(parentCode, commonPrefix.trim());
      }
    }
  }
  
  return inferredNames;
}

/**
 * Encontra o prefixo comum em um array de strings
 */
function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];
  
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (strings[i].indexOf(prefix) !== 0) {
      prefix = prefix.substring(0, prefix.length - 1);
      if (prefix === '') return '';
    }
  }
  
  // Remove palavras incompletas no final
  const lastSpaceIndex = prefix.lastIndexOf(' ');
  if (lastSpaceIndex > 0) {
    prefix = prefix.substring(0, lastSpaceIndex);
  }
  
  return prefix;
}

function determineLevel(categoriaId: string): number {
  const parts = categoriaId.split('.');
  return parts.length;
}

function determineParent(categoriaId: string): string {
  if (categoriaId.includes('.')) {
    const parts = categoriaId.split('.');
    parts.pop();
    return normalizeCode(parts.join('.'));
  }
  
  const twoDigitPrefix = categoriaId.substring(0, 2);
  return (twoDigitPrefix === '03' || twoDigitPrefix === '04') ? 'RECEITAS' : 'DESPESAS';
}

function buildHierarchy(items: DfcItem[], meses: string[], parcelasByCategory?: Map<string, DfcParcela[]>, categoriaNamesMap?: Map<string, string>): DfcHierarchicalResponse {
  const nodeMap = new Map<string, DfcNode>();
  
  nodeMap.set('RECEITAS', {
    categoriaId: 'RECEITAS',
    categoriaNome: 'Receitas',
    nivel: 0,
    parentId: null,
    children: [],
    valuesByMonth: {},
    isLeaf: false,
  });
  
  nodeMap.set('DESPESAS', {
    categoriaId: 'DESPESAS',
    categoriaNome: 'Despesas',
    nivel: 0,
    parentId: null,
    children: [],
    valuesByMonth: {},
    isLeaf: false,
  });
  
  const categoriasByNormalizedId = new Map<string, { nome: string; items: DfcItem[]; originalKey?: string }>();
  const realCategoryNames = new Map<string, string>();
  
  // Infere nomes de categorias intermediárias a partir dos filhos
  const inferredNames = inferIntermediateNames(items);
  
  for (const item of items) {
    const normalizedId = normalizeCode(item.categoriaId);
    
    // Armazena o nome real da categoria vindo do banco
    if (!realCategoryNames.has(normalizedId)) {
      realCategoryNames.set(normalizedId, item.categoriaNome);
    }
    
    if (!categoriasByNormalizedId.has(normalizedId)) {
      categoriasByNormalizedId.set(normalizedId, {
        nome: item.categoriaNome,
        items: [],
        originalKey: `${item.categoriaId}|${item.categoriaNome}`
      });
    }
    categoriasByNormalizedId.get(normalizedId)!.items.push(item);
  }
  
  for (const [normalizedId, data] of Array.from(categoriasByNormalizedId.entries())) {
    const nivel = determineLevel(normalizedId);
    const parentId = determineParent(normalizedId);
    
    if (!nodeMap.has(normalizedId)) {
      // Estratégia híbrida de nomes (em ordem de prioridade):
      // 1. Nome da tabela caz_categorias (fonte oficial do Conta Azul)
      // 2. Nome real do banco de parcelas (categoria existe diretamente)
      // 3. Nome inferido dos filhos
      // 4. Nome do mapeamento padrão (DEPRECATED - apenas fallback)
      // 5. Código (fallback final)
      const categoriaNome = 
        (categoriaNamesMap && categoriaNamesMap.get(normalizedId)) ||
        data.nome ||
        inferredNames.get(normalizedId) ||
        getCategoriaName(normalizedId);
      
      nodeMap.set(normalizedId, {
        categoriaId: normalizedId,
        categoriaNome,
        nivel,
        parentId,
        children: [],
        valuesByMonth: {},
        isLeaf: true,
      });
    }
    
    const node = nodeMap.get(normalizedId)!;
    
    for (const item of data.items) {
      const currentValue = node.valuesByMonth[item.mes] || 0;
      node.valuesByMonth[item.mes] = currentValue + item.valorTotal;
    }

    if (parcelasByCategory && data.originalKey) {
      const parcelas = parcelasByCategory.get(data.originalKey);
      if (parcelas) {
        node.parcelas = parcelas;
      }
    }
  }
  
  const allNormalizedIds = new Set(categoriasByNormalizedId.keys());
  for (const normalizedId of Array.from(allNormalizedIds)) {
    let currentId = normalizedId;
    
    while (currentId.includes('.')) {
      const parts = currentId.split('.');
      parts.pop();
      const parentNormalizedId = parts.join('.');
      
      if (!nodeMap.has(parentNormalizedId)) {
        const parentLevel = determineLevel(parentNormalizedId);
        const parentParentId = determineParent(parentNormalizedId);
        
        // Estratégia híbrida de nomes (em ordem de prioridade):
        // 1. Nome da tabela caz_categorias (fonte oficial)
        // 2. Nome real do banco de parcelas (categoria existe diretamente)
        // 3. Nome inferido dos filhos
        // 4. Nome do mapeamento padrão (DEPRECATED - apenas fallback)
        // 5. Código (fallback final)
        const parentName = 
          (categoriaNamesMap && categoriaNamesMap.get(parentNormalizedId)) ||
          realCategoryNames.get(parentNormalizedId) || 
          inferredNames.get(parentNormalizedId) || 
          getCategoriaName(parentNormalizedId);
        
        nodeMap.set(parentNormalizedId, {
          categoriaId: parentNormalizedId,
          categoriaNome: parentName,
          nivel: parentLevel,
          parentId: parentParentId,
          children: [],
          valuesByMonth: {},
          isLeaf: false,
        });
      }
      
      currentId = parentNormalizedId;
    }
  }
  
  for (const [id, node] of Array.from(nodeMap.entries())) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      if (!parent.children.includes(id)) {
        parent.children.push(id);
      }
    }
  }
  
  for (const node of Array.from(nodeMap.values())) {
    if (node.children.length > 0) {
      node.isLeaf = false;
      node.children.sort();
    }
  }
  
  function aggregateValues(nodeId: string): void {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    
    if (node.children.length > 0) {
      for (const childId of node.children) {
        aggregateValues(childId);
      }
      
      for (const mes of meses) {
        let total = 0;
        for (const childId of node.children) {
          const child = nodeMap.get(childId);
          if (child) {
            total += child.valuesByMonth[mes] || 0;
          }
        }
        node.valuesByMonth[mes] = total;
      }
    }
  }
  
  aggregateValues('RECEITAS');
  aggregateValues('DESPESAS');
  
  return {
    nodes: Array.from(nodeMap.values()),
    meses,
    rootIds: ['RECEITAS', 'DESPESAS'],
  };
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  async getClientes(): Promise<ClienteCompleto[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (cc.task_id)
        COALESCE(caz.id, ('x' || substr(md5(cc.task_id), 1, 8))::bit(32)::int) as id,
        caz.nome,
        caz.cnpj,
        caz.endereco,
        caz.ativo,
        caz.created_at as "createdAt",
        caz.empresa,
        COALESCE(caz.ids, COALESCE(caz.id, ('x' || substr(md5(cc.task_id), 1, 8))::bit(32)::int)::text) as ids,
        cc.nome as "nomeClickup",
        cc.status as "statusClickup",
        cc.telefone,
        cc.responsavel,
        cc.cluster,
        cc.cnpj as "cnpjCliente",
        (
          SELECT string_agg(DISTINCT produto, ', ')
          FROM cup_contratos
          WHERE id_task = cc.task_id
        ) as servicos,
        (
          SELECT MIN(data_inicio)
          FROM cup_contratos
          WHERE id_task = cc.task_id
        ) as "dataInicio",
        COALESCE((
          SELECT COUNT(DISTINCT TO_CHAR(
            COALESCE(cr.data_vencimento, cr.data_criacao), 
            'YYYY-MM'
          ))::double precision
          FROM caz_receber cr
          WHERE cr.cliente_id = caz.ids
            AND UPPER(cr.status) IN ('PAGO', 'ACQUITTED')
            AND COALESCE(cr.data_vencimento, cr.data_criacao) IS NOT NULL
        ), 0) as "ltMeses",
        COALESCE((
          SELECT ROUND(
            EXTRACT(EPOCH FROM (
              MAX(COALESCE(data_encerramento, NOW())) - MIN(data_inicio)
            )) / 86400
          )::double precision
          FROM cup_contratos
          WHERE id_task = cc.task_id
          AND data_inicio IS NOT NULL
        ), 0) as "ltDias",
        COALESCE((
          SELECT SUM(valorr::double precision)
          FROM cup_contratos
          WHERE id_task = cc.task_id
            AND LOWER(status) IN ('ativo', 'onboarding', 'triagem')
            AND valorr IS NOT NULL
        ), 0) as "totalRecorrente",
        COALESCE((
          SELECT SUM(valorp::double precision)
          FROM cup_contratos
          WHERE id_task = cc.task_id
            AND LOWER(status) IN ('ativo', 'onboarding', 'triagem')
            AND valorp IS NOT NULL
        ), 0) as "totalPontual"
      FROM cup_clientes cc
      LEFT JOIN caz_clientes caz ON cc.cnpj = caz.cnpj
      ORDER BY cc.task_id, caz.id DESC NULLS LAST, cc.nome
    `);

    return result.rows as ClienteCompleto[];
  }

  async getClienteById(id: string): Promise<ClienteCompleto | undefined> {
    const result = await db
      .select({
        id: sql<number>`COALESCE(${schema.cazClientes.id}, ('x' || substr(md5(${schema.cupClientes.taskId}), 1, 8))::bit(32)::int)`,
        nome: schema.cazClientes.nome,
        cnpj: schema.cazClientes.cnpj,
        endereco: schema.cazClientes.endereco,
        ativo: schema.cazClientes.ativo,
        createdAt: schema.cazClientes.createdAt,
        empresa: schema.cazClientes.empresa,
        ids: sql<string>`COALESCE(${schema.cazClientes.ids}, COALESCE(${schema.cazClientes.id}, ('x' || substr(md5(${schema.cupClientes.taskId}), 1, 8))::bit(32)::int)::text)`,
        nomeClickup: schema.cupClientes.nome,
        statusClickup: schema.cupClientes.status,
        telefone: schema.cupClientes.telefone,
        responsavel: schema.cupClientes.responsavel,
        cluster: schema.cupClientes.cluster,
        cnpjCliente: schema.cupClientes.cnpj,
        servicos: sql<string>`(
          SELECT string_agg(DISTINCT produto, ', ')
          FROM ${schema.cupContratos}
          WHERE ${schema.cupContratos.idTask} = ${schema.cupClientes.taskId}
        )`,
        dataInicio: sql<Date>`(
          SELECT MIN(data_inicio)
          FROM ${schema.cupContratos}
          WHERE ${schema.cupContratos.idTask} = ${schema.cupClientes.taskId}
        )`,
        ltMeses: sql<number>`COALESCE((
          SELECT COUNT(DISTINCT TO_CHAR(
            COALESCE(${schema.cazReceber.dataVencimento}, ${schema.cazReceber.dataCriacao}), 
            'YYYY-MM'
          ))::double precision
          FROM ${schema.cazReceber}
          WHERE ${schema.cazReceber.clienteId} = ${schema.cazClientes.ids}
            AND UPPER(${schema.cazReceber.status}) IN ('PAGO', 'ACQUITTED')
            AND COALESCE(${schema.cazReceber.dataVencimento}, ${schema.cazReceber.dataCriacao}) IS NOT NULL
        ), 0)`,
        ltDias: sql<number>`COALESCE((
          SELECT ROUND(
            EXTRACT(EPOCH FROM (
              MAX(COALESCE(data_encerramento, NOW())) - MIN(data_inicio)
            )) / 86400
          )::double precision
          FROM ${schema.cupContratos}
          WHERE ${schema.cupContratos.idTask} = ${schema.cupClientes.taskId}
          AND data_inicio IS NOT NULL
        ), 0)`,
        totalRecorrente: sql<number>`COALESCE((
          SELECT SUM(valorr::double precision)
          FROM ${schema.cupContratos}
          WHERE ${schema.cupContratos.idTask} = ${schema.cupClientes.taskId}
            AND LOWER(status) IN ('ativo', 'onboarding', 'triagem')
            AND valorr IS NOT NULL
        ), 0)`,
        totalPontual: sql<number>`COALESCE((
          SELECT SUM(valorp::double precision)
          FROM ${schema.cupContratos}
          WHERE ${schema.cupContratos.idTask} = ${schema.cupClientes.taskId}
            AND LOWER(status) IN ('ativo', 'onboarding', 'triagem')
            AND valorp IS NOT NULL
        ), 0)`,
      })
      .from(schema.cupClientes)
      .leftJoin(
        schema.cazClientes,
        eq(schema.cupClientes.cnpj, schema.cazClientes.cnpj)
      )
      .where(
        sql`
          COALESCE(${schema.cazClientes.id}, ('x' || substr(md5(${schema.cupClientes.taskId}), 1, 8))::bit(32)::int)::text = ${id}
          OR ${schema.cazClientes.ids} = ${id} 
          OR ${schema.cupClientes.taskId} = ${id}
        `
      )
      .limit(1);

    return result[0];
  }

  async getClienteByCnpj(cnpj: string): Promise<Cliente | undefined> {
    const [cliente] = await db.select().from(schema.cazClientes).where(eq(schema.cazClientes.cnpj, cnpj));
    return cliente;
  }

  async getContasReceberByCliente(clienteId: string, limit: number = 100): Promise<ContaReceber[]> {
    const result = await db.select({
      id: schema.cazReceber.id,
      status: schema.cazReceber.status,
      total: schema.cazReceber.total,
      descricao: schema.cazReceber.descricao,
      dataVencimento: sql<Date>`COALESCE(${schema.cazReceber.dataVencimento}, ${schema.cazParcelas.dataVencimento})`.as('data_vencimento'),
      naoPago: schema.cazReceber.naoPago,
      pago: schema.cazReceber.pago,
      dataCriacao: schema.cazReceber.dataCriacao,
      dataAlteracao: schema.cazReceber.dataAlteracao,
      clienteId: schema.cazReceber.clienteId,
      clienteNome: schema.cazReceber.clienteNome,
      empresa: schema.cazReceber.empresa,
      urlCobranca: schema.cazParcelas.urlCobranca,
    })
      .from(schema.cazReceber)
      .leftJoin(
        schema.cazParcelas, 
        sql`${schema.cazReceber.id}::varchar = ${schema.cazParcelas.id}::varchar`
      )
      .where(eq(schema.cazReceber.clienteId, clienteId))
      .orderBy(desc(schema.cazReceber.dataCriacao))
      .limit(limit);
    
    return result;
  }

  async getContasPagarByFornecedor(fornecedorId: string, limit: number = 100): Promise<ContaPagar[]> {
    return await db.select()
      .from(schema.cazPagar)
      .where(eq(schema.cazPagar.fornecedor, fornecedorId))
      .orderBy(desc(schema.cazPagar.dataCriacao))
      .limit(limit);
  }

  async getClienteRevenue(clienteId: string): Promise<{ mes: string; valor: number }[]> {
    const receitas = await db.select({
      mes: sql<string>`TO_CHAR(
        COALESCE(${schema.cazReceber.dataVencimento}, ${schema.cazReceber.dataCriacao}), 
        'YYYY-MM'
      )`,
      valor: sql<string>`COALESCE(
        SUM(CAST(${schema.cazReceber.pago} AS DECIMAL)), 
        0
      )`
    })
    .from(schema.cazReceber)
    .where(
      and(
        eq(schema.cazReceber.clienteId, clienteId),
        sql`UPPER(${schema.cazReceber.status}) IN ('PAGO', 'ACQUITTED')`,
        sql`COALESCE(${schema.cazReceber.dataVencimento}, ${schema.cazReceber.dataCriacao}) IS NOT NULL`
      )
    )
    .groupBy(sql`TO_CHAR(
      COALESCE(${schema.cazReceber.dataVencimento}, ${schema.cazReceber.dataCriacao}), 
      'YYYY-MM'
    )`)
    .orderBy(sql`TO_CHAR(
      COALESCE(${schema.cazReceber.dataVencimento}, ${schema.cazReceber.dataCriacao}), 
      'YYYY-MM'
    )`);

    return receitas.map(r => ({
      mes: r.mes,
      valor: Number(r.valor ?? 0) || 0
    }));
  }

  async getColaboradores(): Promise<Colaborador[]> {
    const result = await db.select().from(schema.rhPessoal).orderBy(schema.rhPessoal.nome);
    console.log(`[STORAGE DEBUG] getColaboradores retornou ${result.length} registros do Google Cloud SQL`);
    if (result.length > 0) {
      console.log(`[STORAGE DEBUG] Primeiro colaborador: ${result[0].nome}, status: ${result[0].status}`);
      const ativos = result.filter(c => c.status === 'ativo').length;
      console.log(`[STORAGE DEBUG] Total ativos: ${ativos}`);
    }
    return result;
  }

  async getColaboradoresComPatrimonios(): Promise<(Colaborador & { patrimonios: { id: number; numeroAtivo: string | null; descricao: string | null }[] })[]> {
    const colaboradores = await db.select().from(schema.rhPessoal).orderBy(schema.rhPessoal.nome);
    
    const patrimonios = await db
      .select({
        id: schema.rhPatrimonio.id,
        numeroAtivo: schema.rhPatrimonio.numeroAtivo,
        descricao: schema.rhPatrimonio.descricao,
        responsavelAtual: schema.rhPatrimonio.responsavelAtual,
        responsavelId: schema.rhPatrimonio.responsavelId,
      })
      .from(schema.rhPatrimonio)
      .where(sql`(${schema.rhPatrimonio.responsavelId} IS NOT NULL) OR (${schema.rhPatrimonio.responsavelAtual} IS NOT NULL AND ${schema.rhPatrimonio.responsavelAtual} != '')`);
    
    const patrimoniosPorId = new Map<number, { id: number; numeroAtivo: string | null; descricao: string | null }[]>();
    const patrimoniosPorNome = new Map<string, { id: number; numeroAtivo: string | null; descricao: string | null }[]>();
    
    for (const p of patrimonios) {
      const patrimonioData = { id: p.id, numeroAtivo: p.numeroAtivo, descricao: p.descricao };
      
      if (p.responsavelId) {
        const existing = patrimoniosPorId.get(p.responsavelId) || [];
        existing.push(patrimonioData);
        patrimoniosPorId.set(p.responsavelId, existing);
      } else if (p.responsavelAtual) {
        const trimmedName = p.responsavelAtual.trim();
        const existing = patrimoniosPorNome.get(trimmedName) || [];
        existing.push(patrimonioData);
        patrimoniosPorNome.set(trimmedName, existing);
      }
    }
    
    return colaboradores.map(col => {
      const byId = patrimoniosPorId.get(col.id) || [];
      if (byId.length > 0) {
        return { ...col, patrimonios: byId };
      }
      const colName = (col.nome || '').trim();
      const byName = patrimoniosPorNome.get(colName) || [];
      return { ...col, patrimonios: byName };
    });
  }

  async createColaborador(colaborador: InsertColaborador): Promise<Colaborador> {
    const [newColaborador] = await db.insert(schema.rhPessoal).values(colaborador as any).returning();
    return newColaborador;
  }

  async updateColaborador(id: number, colaborador: Partial<InsertColaborador>): Promise<Colaborador> {
    const [updatedColaborador] = await db.update(schema.rhPessoal)
      .set(colaborador as any)
      .where(eq(schema.rhPessoal.id, id))
      .returning();
    return updatedColaborador;
  }

  async deleteColaborador(id: number): Promise<void> {
    await db.delete(schema.rhPessoal).where(eq(schema.rhPessoal.id, id));
  }

  async getContratos(): Promise<ContratoCompleto[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (ct.id_subtask)
        ct.id_subtask as "idSubtask",
        ct.servico,
        ct.produto,
        ct.status,
        ct.valorr,
        ct.valorp,
        ct.data_inicio as "dataInicio",
        ct.data_encerramento as "dataEncerramento",
        ct.squad,
        ct.id_task as "idTask",
        COALESCE(cc.nome, caz.nome) as "nomeCliente",
        cc.cnpj as "cnpjCliente",
        caz.ids as "idCliente",
        ct.responsavel,
        ct.cs_responsavel as "csResponsavel",
        cc.responsavel as "responsavelCliente",
        cc.responsavel_geral as "responsavelGeral"
      FROM cup_contratos ct
      LEFT JOIN cup_clientes cc ON ct.id_task = cc.task_id
      LEFT JOIN caz_clientes caz ON cc.cnpj = caz.cnpj
      ORDER BY ct.id_subtask, caz.id DESC NULLS LAST, ct.data_inicio DESC
    `);

    return result.rows as ContratoCompleto[];
  }

  async getContratosPorCliente(clienteId: string): Promise<ContratoCompleto[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (ct.id_subtask)
        ct.id_subtask as "idSubtask",
        ct.servico,
        ct.produto,
        ct.status,
        ct.valorr,
        ct.valorp,
        ct.data_inicio as "dataInicio",
        ct.data_encerramento as "dataEncerramento",
        ct.squad,
        ct.id_task as "idTask",
        COALESCE(cc.nome, caz.nome) as "nomeCliente",
        cc.cnpj as "cnpjCliente",
        caz.ids as "idCliente",
        ct.responsavel,
        ct.cs_responsavel as "csResponsavel",
        cc.responsavel as "responsavelCliente",
        cc.responsavel_geral as "responsavelGeral"
      FROM cup_contratos ct
      LEFT JOIN cup_clientes cc ON ct.id_task = cc.task_id
      LEFT JOIN caz_clientes caz ON cc.cnpj = caz.cnpj
      WHERE caz.ids = ${clienteId}
      ORDER BY ct.id_subtask, caz.id DESC NULLS LAST, ct.data_inicio DESC
    `);

    return result.rows as ContratoCompleto[];
  }

  async getPatrimonios(): Promise<Patrimonio[]> {
    return await db.select().from(schema.rhPatrimonio).orderBy(schema.rhPatrimonio.numeroAtivo);
  }

  async getPatrimonioById(id: number): Promise<PatrimonioComResponsavel | undefined> {
    const result = await db
      .select({
        id: schema.rhPatrimonio.id,
        numeroAtivo: schema.rhPatrimonio.numeroAtivo,
        ativo: schema.rhPatrimonio.ativo,
        marca: schema.rhPatrimonio.marca,
        estadoConservacao: schema.rhPatrimonio.estadoConservacao,
        responsavelAtual: schema.rhPatrimonio.responsavelAtual,
        responsavelId: schema.rhPatrimonio.responsavelId,
        valorPago: schema.rhPatrimonio.valorPago,
        valorMercado: schema.rhPatrimonio.valorMercado,
        valorVenda: schema.rhPatrimonio.valorVenda,
        descricao: schema.rhPatrimonio.descricao,
        colaborador: schema.rhPessoal,
      })
      .from(schema.rhPatrimonio)
      .leftJoin(
        schema.rhPessoal,
        or(
          eq(schema.rhPatrimonio.responsavelId, schema.rhPessoal.id),
          and(
            isNull(schema.rhPatrimonio.responsavelId),
            eq(schema.rhPatrimonio.responsavelAtual, schema.rhPessoal.nome)
          )
        )
      )
      .where(eq(schema.rhPatrimonio.id, id))
      .limit(1);
    
    if (result.length === 0) {
      return undefined;
    }
    
    const row = result[0];
    return {
      id: row.id,
      numeroAtivo: row.numeroAtivo,
      ativo: row.ativo,
      marca: row.marca,
      estadoConservacao: row.estadoConservacao,
      responsavelAtual: row.responsavelAtual,
      responsavelId: row.responsavelId,
      valorPago: row.valorPago,
      valorMercado: row.valorMercado,
      valorVenda: row.valorVenda,
      descricao: row.descricao,
      colaborador: row.colaborador || undefined,
    };
  }

  async createPatrimonio(patrimonio: InsertPatrimonio): Promise<Patrimonio> {
    const [newPatrimonio] = await db.insert(schema.rhPatrimonio).values(patrimonio as any).returning();
    return newPatrimonio;
  }

  async getColaboradoresDropdown(): Promise<{ id: number; nome: string }[]> {
    const result = await db
      .select({
        id: schema.rhPessoal.id,
        nome: schema.rhPessoal.nome,
      })
      .from(schema.rhPessoal)
      .where(eq(schema.rhPessoal.status, 'Ativo'))
      .orderBy(schema.rhPessoal.nome);
    
    return result;
  }

  async updatePatrimonioResponsavel(id: number, responsavelNome: string | null): Promise<Patrimonio> {
    const [updated] = await db
      .update(schema.rhPatrimonio)
      .set({ responsavelAtual: responsavelNome })
      .where(eq(schema.rhPatrimonio.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Patrimônio não encontrado");
    }
    
    return updated;
  }

  async getColaboradoresAnalise(): Promise<DashboardAnaliseData> {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const aniversariantesResult = await db.execute(sql`
      SELECT 
        id,
        nome,
        aniversario::text,
        cargo,
        squad,
        (
          CASE
            WHEN EXTRACT(MONTH FROM aniversario) = 2 AND EXTRACT(DAY FROM aniversario) = 29 
                 AND NOT (
                   (EXTRACT(YEAR FROM CURRENT_DATE)::int % 4 = 0 AND EXTRACT(YEAR FROM CURRENT_DATE)::int % 100 != 0)
                   OR EXTRACT(YEAR FROM CURRENT_DATE)::int % 400 = 0
                 ) THEN
              MAKE_DATE(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                2,
                28
              )
            ELSE
              MAKE_DATE(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM aniversario)::int,
                EXTRACT(DAY FROM aniversario)::int
              )
          END - CURRENT_DATE
        )::int as dias_ate_aniversario
      FROM ${schema.rhPessoal}
      WHERE EXTRACT(MONTH FROM aniversario) = ${currentMonth}
        AND status = 'Ativo'
      ORDER BY EXTRACT(DAY FROM aniversario)
    `);

    const aniversarioEmpresaResult = await db.execute(sql`
      SELECT 
        id,
        nome,
        admissao::text,
        cargo,
        squad,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao))::int as anos_de_empresa,
        (
          CASE
            WHEN EXTRACT(MONTH FROM admissao) = 2 AND EXTRACT(DAY FROM admissao) = 29 
                 AND NOT (
                   (EXTRACT(YEAR FROM CURRENT_DATE)::int % 4 = 0 AND EXTRACT(YEAR FROM CURRENT_DATE)::int % 100 != 0)
                   OR EXTRACT(YEAR FROM CURRENT_DATE)::int % 400 = 0
                 ) THEN
              MAKE_DATE(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                2,
                28
              )
            ELSE
              MAKE_DATE(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM admissao)::int,
                EXTRACT(DAY FROM admissao)::int
              )
          END - CURRENT_DATE
        )::int as dias_ate_aniversario_empresa
      FROM ${schema.rhPessoal}
      WHERE EXTRACT(MONTH FROM admissao) = ${currentMonth}
        AND status = 'Ativo'
        AND admissao IS NOT NULL
      ORDER BY EXTRACT(DAY FROM admissao)
    `);

    const ultimasPromocoesResult = await db.execute(sql`
      SELECT 
        id,
        nome,
        cargo,
        squad,
        ultimo_aumento::text as ultimo_aumento,
        meses_ult_aumento as meses_desde_aumento
      FROM ${schema.rhPessoal}
      WHERE status = 'Ativo'
        AND ultimo_aumento IS NOT NULL
      ORDER BY meses_ult_aumento DESC NULLS LAST
      LIMIT 50
    `);

    const tempoMedioPromocaoResult = await db.execute(sql`
      SELECT 
        COALESCE(AVG(meses_ult_aumento), 0)::numeric(10,2) as tempo_medio_meses,
        COUNT(*) as total_colaboradores
      FROM ${schema.rhPessoal}
      WHERE status = 'Ativo'
        AND meses_ult_aumento IS NOT NULL
    `);

    const tempoPermanenciaResult = await db.execute(sql`
      SELECT 
        COALESCE(AVG(CASE WHEN status = 'Ativo' THEN meses_de_turbo END), 0)::numeric(10,2) as tempo_permanencia_ativos,
        COUNT(CASE WHEN status = 'Ativo' THEN 1 END) as total_ativos,
        COALESCE(AVG(CASE WHEN status != 'Ativo' AND demissao IS NOT NULL THEN 
          EXTRACT(YEAR FROM AGE(demissao, admissao))::int * 12 + 
          EXTRACT(MONTH FROM AGE(demissao, admissao))::int
        END), 0)::numeric(10,2) as tempo_permanencia_desligados,
        COUNT(CASE WHEN status != 'Ativo' AND demissao IS NOT NULL THEN 1 END) as total_desligados
      FROM ${schema.rhPessoal}
    `);

    const aniversariantesMes: AniversariantesMes[] = (aniversariantesResult.rows as any[]).map((row: any) => ({
      id: row.id,
      nome: row.nome,
      aniversario: row.aniversario,
      cargo: row.cargo,
      squad: row.squad,
      diasAteAniversario: row.dias_ate_aniversario || 0,
    }));

    const aniversarioEmpresaMes: AniversarioEmpresaMes[] = (aniversarioEmpresaResult.rows as any[]).map((row: any) => ({
      id: row.id,
      nome: row.nome,
      admissao: row.admissao,
      cargo: row.cargo,
      squad: row.squad,
      anosDeEmpresa: row.anos_de_empresa || 0,
      diasAteAniversarioEmpresa: row.dias_ate_aniversario_empresa || 0,
    }));

    const ultimasPromocoes: UltimaPromocao[] = (ultimasPromocoesResult.rows as any[]).map((row: any) => ({
      id: row.id,
      nome: row.nome,
      cargo: row.cargo,
      squad: row.squad,
      ultimoAumento: row.ultimo_aumento,
      mesesDesdeAumento: row.meses_desde_aumento,
    }));

    const tempoMedioRow = tempoMedioPromocaoResult.rows[0] as any;
    const tempoMedioPromocao: TempoMedioPromocao = {
      tempoMedioMeses: parseFloat(tempoMedioRow?.tempo_medio_meses || '0'),
      totalColaboradores: tempoMedioRow?.total_colaboradores || 0,
    };

    const tempoPermanenciaRow = tempoPermanenciaResult.rows[0] as any;
    const tempoPermanencia: TempoPermanencia = {
      tempoPermanenciaAtivos: parseFloat(tempoPermanenciaRow?.tempo_permanencia_ativos || '0'),
      totalAtivos: tempoPermanenciaRow?.total_ativos || 0,
      tempoPermanenciaDesligados: parseFloat(tempoPermanenciaRow?.tempo_permanencia_desligados || '0'),
      totalDesligados: tempoPermanenciaRow?.total_desligados || 0,
    };

    return {
      aniversariantesMes,
      aniversarioEmpresaMes,
      ultimasPromocoes,
      tempoMedioPromocao,
      tempoPermanencia,
    };
  }

  async getSaldoAtualBancos(): Promise<SaldoBancos> {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(balance::numeric), 0) as saldo_total
      FROM ${schema.cazBancos}
    `);
    
    const row = result.rows[0] as any;
    return {
      saldoTotal: parseFloat(row?.saldo_total || '0'),
    };
  }

  async getFluxoCaixa(): Promise<FluxoCaixaItem[]> {
    const result = await db.execute(sql`
      SELECT 
        data_vencimento,
        tipo_evento,
        COALESCE(SUM(valor_bruto::numeric), 0) as valor_bruto
      FROM ${schema.cazParcelas}
      WHERE tipo_evento IN ('RECEITA', 'DESPESA')
        AND data_vencimento IS NOT NULL
      GROUP BY data_vencimento, tipo_evento
      ORDER BY data_vencimento DESC
    `);
    
    return (result.rows as any[]).map((row: any) => ({
      dataVencimento: new Date(row.data_vencimento),
      tipoEvento: row.tipo_evento,
      valorBruto: parseFloat(row.valor_bruto || '0'),
    }));
  }

  async getFluxoCaixaDiario(ano: number, mes: number): Promise<FluxoCaixaDiarioItem[]> {
    const saldoAtual = await this.getSaldoAtualBancos();
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const primeiroDiaMes = new Date(ano, mes - 1, 1);
    
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(data_vencimento, 'DD/MM/YYYY') as dia,
        data_vencimento,
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' AND status NOT IN ('QUITADO', 'PERDIDO') THEN valor_bruto::numeric ELSE 0 END), 0) as receitas,
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' AND status NOT IN ('QUITADO', 'PERDIDO') THEN valor_bruto::numeric ELSE 0 END), 0) as despesas
      FROM ${schema.cazParcelas}
      WHERE tipo_evento IN ('RECEITA', 'DESPESA')
        AND data_vencimento IS NOT NULL
        AND EXTRACT(YEAR FROM data_vencimento) = ${ano}
        AND EXTRACT(MONTH FROM data_vencimento) = ${mes}
      GROUP BY data_vencimento
      ORDER BY data_vencimento ASC
    `);
    
    // Calcular provisões entre hoje e o primeiro dia do mês selecionado
    const provisoesAntesMes = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_bruto::numeric ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_bruto::numeric ELSE 0 END), 0) as fluxo_provisoes
      FROM ${schema.cazParcelas}
      WHERE tipo_evento IN ('RECEITA', 'DESPESA')
        AND status NOT IN ('QUITADO', 'PERDIDO')
        AND data_vencimento IS NOT NULL
        AND data_vencimento >= CURRENT_DATE
        AND data_vencimento < ${primeiroDiaMes.toISOString()}::date
    `);
    
    const fluxoProvisoesAntesMes = parseFloat((provisoesAntesMes.rows[0] as any)?.fluxo_provisoes || '0');
    
    // Saldo inicial: saldo atual + provisões até o início do mês
    let saldoAcumulado = saldoAtual.saldoTotal + fluxoProvisoesAntesMes;
    
    return (result.rows as any[]).map((row: any) => {
      const receitas = parseFloat(row.receitas || '0');
      const despesas = parseFloat(row.despesas || '0');
      saldoAcumulado += receitas - despesas;
      
      return {
        dia: row.dia,
        receitas,
        despesas,
        saldoAcumulado,
      };
    });
  }

  async getTransacoesDia(ano: number, mes: number, dia: number): Promise<TransacaoDiaItem[]> {
    const result = await db.execute(sql`
      SELECT 
        id,
        descricao,
        valor_bruto,
        tipo_evento,
        empresa,
        data_vencimento
      FROM ${schema.cazParcelas}
      WHERE tipo_evento IN ('RECEITA', 'DESPESA')
        AND data_vencimento IS NOT NULL
        AND EXTRACT(YEAR FROM data_vencimento) = ${ano}
        AND EXTRACT(MONTH FROM data_vencimento) = ${mes}
        AND EXTRACT(DAY FROM data_vencimento) = ${dia}
      ORDER BY tipo_evento DESC, valor_bruto DESC
    `);
    
    return (result.rows as any[]).map((row: any) => ({
      id: row.id,
      descricao: row.descricao,
      valorBruto: parseFloat(row.valor_bruto || '0'),
      tipoEvento: row.tipo_evento,
      empresa: row.empresa,
      dataVencimento: new Date(row.data_vencimento),
    }));
  }

  async getContasBancos(): Promise<ContaBanco[]> {
    const result = await db.execute(sql`
      SELECT 
        id,
        nome,
        balance as saldo,
        empresa
      FROM caz_bancos
      WHERE ativo = 'true' OR ativo = 't' OR ativo IS NULL
      ORDER BY balance::numeric DESC
    `);
    
    return (result.rows as any[]).map((row: any) => ({
      id: String(row.id || ''),
      nome: row.nome || 'Conta Desconhecida',
      saldo: parseFloat(row.saldo || '0'),
      empresa: row.empresa || '',
    }));
  }

  async getFluxoCaixaDiarioCompleto(dataInicio: string, dataFim: string): Promise<FluxoCaixaDiarioCompleto[]> {
    const saldoAtual = await this.getSaldoAtualBancos();
    
    const result = await db.execute(sql`
      WITH dates AS (
        SELECT generate_series(
          ${dataInicio}::date,
          ${dataFim}::date,
          '1 day'::interval
        )::date as data
      ),
      daily_transactions AS (
        SELECT 
          data_vencimento::date as data,
          SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_bruto::numeric ELSE 0 END) as entradas_previstas,
          SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_bruto::numeric ELSE 0 END) as saidas_previstas
        FROM caz_parcelas
        WHERE tipo_evento IN ('RECEITA', 'DESPESA')
          AND status NOT IN ('QUITADO', 'PERDIDO')
          AND data_vencimento::date BETWEEN ${dataInicio}::date AND ${dataFim}::date
        GROUP BY data_vencimento::date
      )
      SELECT 
        TO_CHAR(d.data, 'YYYY-MM-DD') as data,
        COALESCE(dt.entradas_previstas, 0) as entradas_previstas,
        COALESCE(dt.saidas_previstas, 0) as saidas_previstas
      FROM dates d
      LEFT JOIN daily_transactions dt ON d.data = dt.data
      ORDER BY d.data
    `);
    
    // Saldo inicial = saldo atual dos bancos (R$ 784k)
    let saldoAcumulado = saldoAtual.saldoTotal;
    
    return (result.rows as any[]).map((row: any) => {
      const entradasPrevistas = parseFloat(row.entradas_previstas || '0');
      const saidasPrevistas = parseFloat(row.saidas_previstas || '0');
      
      const entradas = entradasPrevistas;
      const saidas = saidasPrevistas;
      const saldoDia = entradas - saidas;
      saldoAcumulado += saldoDia;
      
      return {
        data: row.data,
        entradas,
        saidas,
        saldoDia,
        saldoAcumulado,
        entradasPagas: 0,
        saidasPagas: 0,
        entradasPrevistas,
        saidasPrevistas,
      };
    });
  }

  async getFluxoCaixaInsights(): Promise<FluxoCaixaInsights> {
    const hoje = new Date().toISOString().split('T')[0];
    
    const result = await db.execute(sql`
      WITH saldo_bancos AS (
        SELECT COALESCE(SUM(balance::numeric), 0) as saldo_total
        FROM caz_bancos
        WHERE ativo = true
      ),
      proximos_30_dias AS (
        SELECT 
          SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_bruto::numeric ELSE 0 END) as entradas_previstas,
          SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_bruto::numeric ELSE 0 END) as saidas_previstas
        FROM caz_parcelas
        WHERE status NOT IN ('QUITADO', 'PERDIDO')
          AND data_vencimento >= CURRENT_DATE
          AND data_vencimento <= CURRENT_DATE + INTERVAL '30 days'
      ),
      vencidos AS (
        SELECT 
          SUM(CASE WHEN tipo_evento = 'RECEITA' AND status = 'ATRASADO' THEN valor_bruto::numeric ELSE 0 END) as entradas_vencidas,
          SUM(CASE WHEN tipo_evento = 'DESPESA' AND status NOT IN ('QUITADO', 'PERDIDO') THEN valor_bruto::numeric ELSE 0 END) as saidas_vencidas
        FROM caz_parcelas
        WHERE data_vencimento < CURRENT_DATE
      ),
      maior_entrada AS (
        SELECT 
          valor_bruto::numeric as valor,
          COALESCE(descricao, 'Sem descrição') as descricao,
          TO_CHAR(data_vencimento, 'YYYY-MM-DD') as data
        FROM caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND status NOT IN ('QUITADO', 'PERDIDO')
          AND data_vencimento >= CURRENT_DATE
          AND data_vencimento <= CURRENT_DATE + INTERVAL '30 days'
        ORDER BY valor_bruto::numeric DESC
        LIMIT 1
      ),
      maior_saida AS (
        SELECT 
          valor_bruto::numeric as valor,
          COALESCE(descricao, 'Sem descrição') as descricao,
          TO_CHAR(data_vencimento, 'YYYY-MM-DD') as data
        FROM caz_parcelas
        WHERE tipo_evento = 'DESPESA'
          AND status NOT IN ('QUITADO', 'PERDIDO')
          AND data_vencimento >= CURRENT_DATE
          AND data_vencimento <= CURRENT_DATE + INTERVAL '30 days'
        ORDER BY valor_bruto::numeric DESC
        LIMIT 1
      )
      SELECT 
        sb.saldo_total,
        COALESCE(p30.entradas_previstas, 0) as entradas_previstas_30,
        COALESCE(p30.saidas_previstas, 0) as saidas_previstas_30,
        COALESCE(v.entradas_vencidas, 0) as entradas_vencidas,
        COALESCE(v.saidas_vencidas, 0) as saidas_vencidas,
        me.valor as maior_entrada_valor,
        me.descricao as maior_entrada_descricao,
        me.data as maior_entrada_data,
        ms.valor as maior_saida_valor,
        ms.descricao as maior_saida_descricao,
        ms.data as maior_saida_data
      FROM saldo_bancos sb
      CROSS JOIN proximos_30_dias p30
      CROSS JOIN vencidos v
      LEFT JOIN maior_entrada me ON true
      LEFT JOIN maior_saida ms ON true
    `);
    
    const row = result.rows[0] as any;
    const saldoHoje = parseFloat(row?.saldo_total || '0');
    const entradasPrevistas30Dias = parseFloat(row?.entradas_previstas_30 || '0');
    const saidasPrevistas30Dias = parseFloat(row?.saidas_previstas_30 || '0');
    const saldoFuturo30Dias = saldoHoje + entradasPrevistas30Dias - saidasPrevistas30Dias;
    
    return {
      saldoHoje,
      saldoFuturo30Dias,
      entradasPrevistas30Dias,
      saidasPrevistas30Dias,
      entradasVencidas: parseFloat(row?.entradas_vencidas || '0'),
      saidasVencidas: parseFloat(row?.saidas_vencidas || '0'),
      diasAteNegatvo: null,
      maiorEntradaPrevista: row?.maior_entrada_valor ? {
        valor: parseFloat(row.maior_entrada_valor),
        descricao: row.maior_entrada_descricao || 'Sem descrição',
        data: row.maior_entrada_data,
      } : null,
      maiorSaidaPrevista: row?.maior_saida_valor ? {
        valor: parseFloat(row.maior_saida_valor),
        descricao: row.maior_saida_descricao || 'Sem descrição',
        data: row.maior_saida_data,
      } : null,
    };
  }

  async getCohortRetention(filters?: { squad?: string; servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<CohortRetentionData> {
    const result = await db.execute(sql`
      SELECT 
        c.id_task,
        c.servico,
        c.squad,
        c.data_inicio,
        c.data_encerramento,
        c.valorr,
        cl.nome as nome_cliente
      FROM ${schema.cupContratos} c
      LEFT JOIN ${schema.cupClientes} cl ON c.id_task = cl.task_id
      WHERE c.data_inicio IS NOT NULL
    `);

    const contratos = (result.rows as any[]).map((row: any) => {
      const valorr = parseFloat(row.valorr || '0');
      return {
        idTask: row.id_task,
        nomeCliente: row.nome_cliente || row.id_task,
        servico: row.servico,
        squad: row.squad,
        dataInicio: row.data_inicio ? new Date(row.data_inicio) : null,
        dataEncerramento: row.data_encerramento ? new Date(row.data_encerramento) : null,
        valorr: isNaN(valorr) ? 0 : valorr,
      };
    });

    let filteredContratos = contratos.filter(c => c.dataInicio && !isNaN(c.dataInicio.getTime()));

    const availableServicos = Array.from(new Set(contratos.filter(c => c.dataInicio && !isNaN(c.dataInicio.getTime())).map(c => c.servico).filter(Boolean) as string[])).sort();
    const availableSquads = Array.from(new Set(contratos.filter(c => c.dataInicio && !isNaN(c.dataInicio.getTime())).map(c => c.squad).filter(Boolean) as string[])).sort();

    if (filters?.squad) {
      filteredContratos = filteredContratos.filter(c => c.squad === filters.squad);
    }
    if (filters?.servicos && filters.servicos.length > 0) {
      filteredContratos = filteredContratos.filter(c => c.servico && filters.servicos!.includes(c.servico));
    }

    const clientContractMap = new Map<string, Array<{
      nomeCliente: string;
      servico: string;
      squad: string;
      dataInicio: Date;
      dataEncerramento: Date | null;
      valorr: number;
    }>>();

    filteredContratos.forEach(contrato => {
      if (!contrato.idTask) return;
      
      if (!clientContractMap.has(contrato.idTask)) {
        clientContractMap.set(contrato.idTask, []);
      }
      
      clientContractMap.get(contrato.idTask)!.push({
        nomeCliente: contrato.nomeCliente,
        servico: contrato.servico || '',
        squad: contrato.squad || '',
        dataInicio: contrato.dataInicio!,
        dataEncerramento: contrato.dataEncerramento,
        valorr: contrato.valorr,
      });
    });

    const clientCohortMap = new Map<string, { cohortMonth: string; firstDate: Date }>();

    clientContractMap.forEach((contracts, clientId) => {
      const contractsWithValue = contracts.filter(c => !isNaN(c.valorr) && c.valorr > 0);
      
      if (contractsWithValue.length === 0) return;
      
      contractsWithValue.sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime());
      const firstDate = contractsWithValue[0].dataInicio;
      const cohortKey = `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, '0')}`;
      
      clientCohortMap.set(clientId, { cohortMonth: cohortKey, firstDate });
    });

    const cohortMap = new Map<string, {
      clients: Set<string>;
      allClientContracts: Map<string, Array<{
        nomeCliente: string;
        servico: string;
        squad: string;
        dataInicio: Date;
        dataEncerramento: Date | null;
        valorr: number;
      }>>;
    }>();

    clientCohortMap.forEach(({ cohortMonth }, clientId) => {
      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, { 
          clients: new Set(), 
          allClientContracts: new Map() 
        });
      }
      
      const cohort = cohortMap.get(cohortMonth)!;
      cohort.clients.add(clientId);
      cohort.allClientContracts.set(clientId, clientContractMap.get(clientId)!);
    });

    let sortedCohorts = Array.from(cohortMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    if (filters?.mesInicio) {
      sortedCohorts = sortedCohorts.filter(([cohortMonth]) => cohortMonth >= filters.mesInicio!);
    }
    
    if (filters?.mesFim) {
      sortedCohorts = sortedCohorts.filter(([cohortMonth]) => cohortMonth <= filters.mesFim!);
    }

    let maxMonthOffset = 0;
    const cohortRows: CohortRetentionRow[] = sortedCohorts.map(([cohortMonth, cohortData]) => {
      const [year, month] = cohortMonth.split('-').map(Number);
      const cohortDate = new Date(year, month - 1, 1);
      
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const cohortLabel = `${monthNames[month - 1]}/${year}`;
      
      const totalClients = cohortData.clients.size;
      
      let totalValue = 0;
      let totalContracts = 0;
      cohortData.allClientContracts.forEach(contracts => {
        contracts.forEach(contract => {
          if (!isNaN(contract.valorr) && contract.valorr > 0) {
            totalValue += contract.valorr;
            totalContracts++;
          }
        });
      });
      
      const retentionByMonth: { [key: number]: { activeClients: number; retentionRate: number; activeValue: number; valueRetentionRate: number; activeContracts: number; contractRetentionRate: number } } = {};

      const now = new Date();
      const monthsSinceCohort = (now.getFullYear() - year) * 12 + (now.getMonth() - (month - 1));

      for (let offset = 0; offset <= monthsSinceCohort; offset++) {
        const checkDate = new Date(year, month - 1 + offset, 1);
        const checkEndDate = new Date(year, month - 1 + offset + 1, 0, 23, 59, 59);
        
        const activeClientsSet = new Set<string>();
        let activeValue = 0;
        let activeContracts = 0;
        
        cohortData.allClientContracts.forEach((contracts, clientId) => {
          const hasActiveValueContract = contracts.some(contract => {
            const isActive = !contract.dataEncerramento || new Date(contract.dataEncerramento) > checkEndDate;
            return isActive && !isNaN(contract.valorr) && contract.valorr > 0;
          });
          
          if (hasActiveValueContract) {
            activeClientsSet.add(clientId);
            
            contracts.forEach(contract => {
              const isActive = !contract.dataEncerramento || new Date(contract.dataEncerramento) > checkEndDate;
              if (isActive && !isNaN(contract.valorr) && contract.valorr > 0) {
                activeValue += contract.valorr;
                activeContracts++;
              }
            });
          }
        });
        
        const activeClients = activeClientsSet.size;
        const retentionRate = totalClients > 0 ? (activeClients / totalClients) * 100 : 0;
        const valueRetentionRate = totalValue > 0 ? (activeValue / totalValue) * 100 : 0;
        const contractRetentionRate = totalContracts > 0 ? (activeContracts / totalContracts) * 100 : 0;
        
        retentionByMonth[offset] = {
          activeClients,
          retentionRate,
          activeValue,
          valueRetentionRate,
          activeContracts,
          contractRetentionRate,
        };
        
        if (offset > maxMonthOffset) {
          maxMonthOffset = offset;
        }
      }

      const clientesContratos: ClienteContratoDetail[] = [];
      cohortData.allClientContracts.forEach((contracts, clientId) => {
        contracts.forEach(contract => {
          if (!isNaN(contract.valorr) && contract.valorr > 0) {
            clientesContratos.push({
              clienteId: clientId,
              nomeCliente: contract.nomeCliente,
              servico: contract.servico || '',
              squad: contract.squad || '',
              valorr: contract.valorr,
              dataInicio: contract.dataInicio,
              dataEncerramento: contract.dataEncerramento,
            });
          }
        });
      });

      return {
        cohortMonth,
        cohortLabel,
        totalClients,
        totalValue,
        totalContracts,
        clientesContratos,
        retentionByMonth,
      };
    });

    return {
      cohorts: cohortRows,
      maxMonthOffset,
      filters: filters || {},
      availableServicos,
      availableSquads,
    };
  }

  async getVisaoGeralMetricas(mesAno: string): Promise<VisaoGeralMetricas> {
    const [ano, mes] = mesAno.split('-').map(Number);
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0, 23, 59, 59);

    // Buscar último snapshot do mês filtrado
    const ultimoSnapshotQuery = await db.execute(sql`
      SELECT MAX(data_snapshot) as data_ultimo_snapshot
      FROM ${schema.cupDataHist}
      WHERE data_snapshot >= ${inicioMes}::timestamp
        AND data_snapshot <= ${fimMes}::timestamp
    `);

    const dataUltimoSnapshot = (ultimoSnapshotQuery.rows[0] as any)?.data_ultimo_snapshot;

    if (!dataUltimoSnapshot) {
      return {
        receitaTotal: 0,
        mrr: 0,
        aquisicaoMrr: 0,
        aquisicaoPontual: 0,
        cac: 0,
        churn: 0,
        pausados: 0,
      };
    }

    // Buscar MRR do snapshot (estado atual)
    const mrrQuery = await db.execute(sql`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN status IN ('ativo', 'onboarding', 'triagem')
              AND valorr IS NOT NULL
              AND valorr > 0
            THEN valorr::numeric
            ELSE 0 
          END
        ), 0) as mrr
      FROM ${schema.cupDataHist}
      WHERE data_snapshot = ${dataUltimoSnapshot}::timestamp
    `);
    
    // Buscar métricas de transição da tabela cup_contratos (eventos, não estado)
    // Estas representam mudanças que ocorreram no período, não estado em um ponto no tempo
    const transicoesQuery = await db.execute(sql`
      SELECT 
        -- Aquisição MRR: contratos criados no período
        COALESCE(SUM(
          CASE 
            WHEN data_inicio >= ${inicioMes}
              AND data_inicio <= ${fimMes}
              AND valorr IS NOT NULL
              AND valorr > 0
            THEN valorr::numeric
            ELSE 0 
          END
        ), 0) as aquisicao_mrr,
        
        -- Aquisição Pontual: valor_p dos contratos criados no período
        COALESCE(SUM(
          CASE 
            WHEN data_inicio >= ${inicioMes}
              AND data_inicio <= ${fimMes}
              AND valorp IS NOT NULL
              AND valorp > 0
            THEN valorp::numeric
            ELSE 0 
          END
        ), 0) as aquisicao_pontual,
        
        -- Churn: contratos encerrados no período
        COALESCE(SUM(
          CASE 
            WHEN data_encerramento >= ${inicioMes}
              AND data_encerramento <= ${fimMes}
              AND valorr IS NOT NULL
              AND valorr > 0
            THEN valorr::numeric
            ELSE 0 
          END
        ), 0) as churn,
        
        -- Pausados: contratos pausados no mês
        COALESCE(SUM(
          CASE 
            WHEN status = 'pausado'
              AND data_pausa >= ${inicioMes}
              AND data_pausa <= ${fimMes}
              AND valorr IS NOT NULL
              AND valorr > 0
            THEN valorr::numeric
            ELSE 0 
          END
        ), 0) as pausados
      FROM ${schema.cupContratos}
    `);

    const mrrRow = mrrQuery.rows[0] as any;
    const transRow = transicoesQuery.rows[0] as any;

    const mrr = parseFloat(mrrRow.mrr || '0');
    const aquisicaoMrr = parseFloat(transRow.aquisicao_mrr || '0');
    const aquisicaoPontual = parseFloat(transRow.aquisicao_pontual || '0');
    const churn = parseFloat(transRow.churn || '0');
    const pausados = parseFloat(transRow.pausados || '0');

    return {
      receitaTotal: mrr + aquisicaoPontual,
      mrr,
      aquisicaoMrr,
      aquisicaoPontual,
      cac: 0,
      churn,
      pausados,
    };
  }

  async getMrrEvolucaoMensal(mesAnoFim: string): Promise<import("@shared/schema").MrrEvolucaoMensal[]> {
    const [anoFim, mesFim] = mesAnoFim.split('-').map(Number);
    
    // Gerar lista de meses desde novembro/2025 até mesAnoFim
    const meses: string[] = [];
    const mesInicio = new Date(2025, 10, 1); // Novembro 2025 (mês 10 = novembro)
    const mesFimDate = new Date(anoFim, mesFim - 1, 1);
    
    let mesAtual = new Date(mesInicio);
    while (mesAtual <= mesFimDate) {
      const ano = mesAtual.getFullYear();
      const mes = mesAtual.getMonth() + 1;
      meses.push(`${ano}-${String(mes).padStart(2, '0')}`);
      mesAtual = new Date(ano, mes, 1);
    }

    // Para cada mês, buscar MRR do último snapshot disponível daquele mês
    const resultado: import("@shared/schema").MrrEvolucaoMensal[] = [];
    
    for (const mes of meses) {
      const [ano, mesNum] = mes.split('-').map(Number);
      const inicioMes = new Date(ano, mesNum - 1, 1);
      const fimMes = new Date(ano, mesNum, 0, 23, 59, 59);

      // Buscar o último snapshot do mês e somar valor_r dos contratos ativos
      const query = await db.execute(sql`
        WITH ultimo_snapshot AS (
          SELECT MAX(data_snapshot) as data_ultimo_snapshot
          FROM ${schema.cupDataHist}
          WHERE data_snapshot >= ${inicioMes}::timestamp
            AND data_snapshot <= ${fimMes}::timestamp
        )
        SELECT 
          us.data_ultimo_snapshot,
          COALESCE(SUM(h.valorr::numeric), 0) as mrr
        FROM ultimo_snapshot us
        LEFT JOIN ${schema.cupDataHist} h 
          ON h.data_snapshot = us.data_ultimo_snapshot
          AND h.status IN ('ativo', 'onboarding', 'triagem')
        GROUP BY us.data_ultimo_snapshot
      `);

      const row = query.rows[0] as any;
      
      // Só adiciona o mês se houver snapshot disponível (data_ultimo_snapshot não é NULL)
      if (row?.data_ultimo_snapshot) {
        const mrr = parseFloat(row.mrr || '0');
        resultado.push({
          mes,
          mrr,
        });
      }
    }

    return resultado;
  }

  async getChurnPorServico(filters?: { servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorServico[]> {
    // Build filter conditions using SQL fragments
    const whereConditions: any[] = [sql`data_encerramento IS NOT NULL`];
    
    if (filters?.servicos && filters.servicos.length > 0) {
      const servicosPlaceholders = sql.join(filters.servicos.map(s => sql`${s}`), sql`, `);
      whereConditions.push(sql`produto IN (${servicosPlaceholders})`);
    }
    
    if (filters?.mesInicio) {
      const [ano, mes] = filters.mesInicio.split('-').map(Number);
      const dataInicio = new Date(ano, mes - 1, 1);
      whereConditions.push(sql`data_encerramento >= ${dataInicio.toISOString()}`);
    }
    
    if (filters?.mesFim) {
      const [ano, mes] = filters.mesFim.split('-').map(Number);
      const dataFim = new Date(ano, mes, 0, 23, 59, 59);
      whereConditions.push(sql`data_encerramento <= ${dataFim.toISOString()}`);
    }
    
    const whereClause = sql.join(whereConditions, sql` AND `);
    
    const resultados = await db.execute(sql`
      WITH churn_data AS (
        SELECT 
          produto,
          TO_CHAR(data_encerramento, 'YYYY-MM') as mes,
          COUNT(*) as quantidade_churn,
          COALESCE(SUM(valorr::numeric), 0) as valor_churn,
          data_encerramento
        FROM cup_contratos
        WHERE ${whereClause}
        GROUP BY produto, TO_CHAR(data_encerramento, 'YYYY-MM'), data_encerramento
      ),
      ativos_por_mes AS (
        SELECT 
          produto,
          cd.mes,
          COUNT(*) as total_ativos,
          COALESCE(SUM(valorr::numeric), 0) as valor_total_ativo
        FROM cup_contratos c
        CROSS JOIN (SELECT DISTINCT mes, MIN(data_encerramento) as data_ref FROM churn_data GROUP BY mes) cd
        WHERE c.data_inicio <= cd.data_ref
          AND (c.data_encerramento IS NULL OR c.data_encerramento >= cd.data_ref)
        GROUP BY produto, cd.mes
      )
      SELECT 
        cd.produto,
        cd.mes,
        SUM(cd.quantidade_churn)::integer as quantidade,
        SUM(cd.valor_churn)::numeric as valor_total,
        COALESCE(apm.valor_total_ativo, 0)::numeric as valor_ativo_mes,
        CASE 
          WHEN COALESCE(apm.total_ativos, 0) > 0 
          THEN (SUM(cd.quantidade_churn)::numeric / apm.total_ativos::numeric * 100)
          ELSE 0 
        END as percentual_churn
      FROM churn_data cd
      LEFT JOIN ativos_por_mes apm ON cd.produto = apm.produto AND cd.mes = apm.mes
      GROUP BY cd.produto, cd.mes, apm.total_ativos, apm.valor_total_ativo
      ORDER BY cd.produto, cd.mes
    `);
    
    return resultados.rows.map((row: any) => ({
      servico: row.produto,
      mes: row.mes,
      quantidade: parseInt(row.quantidade || '0'),
      valorTotal: parseFloat(row.valor_total || '0'),
      percentualChurn: parseFloat(row.percentual_churn || '0'),
      valorAtivoMes: parseFloat(row.valor_ativo_mes || '0'),
    }));
  }

  async getChurnPorResponsavel(filters?: { servicos?: string[]; squads?: string[]; colaboradores?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorResponsavel[]> {
    // Build filter conditions using SQL fragments
    const whereConditions: any[] = [sql`con.data_encerramento IS NOT NULL`];
    
    if (filters?.servicos && filters.servicos.length > 0) {
      const servicosPlaceholders = sql.join(filters.servicos.map(s => sql`${s}`), sql`, `);
      whereConditions.push(sql`con.servico IN (${servicosPlaceholders})`);
    }
    
    if (filters?.squads && filters.squads.length > 0) {
      const squadsPlaceholders = sql.join(filters.squads.map(s => sql`${s}`), sql`, `);
      whereConditions.push(sql`con.squad IN (${squadsPlaceholders})`);
    }
    
    if (filters?.colaboradores && filters.colaboradores.length > 0) {
      const colaboradoresPlaceholders = sql.join(filters.colaboradores.map(c => sql`${c}`), sql`, `);
      whereConditions.push(sql`cli.responsavel IN (${colaboradoresPlaceholders})`);
    }
    
    if (filters?.mesInicio) {
      const [ano, mes] = filters.mesInicio.split('-').map(Number);
      const dataInicio = new Date(ano, mes - 1, 1);
      whereConditions.push(sql`con.data_encerramento >= ${dataInicio.toISOString()}`);
    }
    
    if (filters?.mesFim) {
      const [ano, mes] = filters.mesFim.split('-').map(Number);
      const dataFim = new Date(ano, mes, 0, 23, 59, 59);
      whereConditions.push(sql`con.data_encerramento <= ${dataFim.toISOString()}`);
    }
    
    const whereClause = sql.join(whereConditions, sql` AND `);
    
    // Build filter conditions for active contracts
    const ativosConditions: any[] = [sql`con.data_encerramento IS NULL`];
    
    if (filters?.servicos && filters.servicos.length > 0) {
      const servicosPlaceholders = sql.join(filters.servicos.map(s => sql`${s}`), sql`, `);
      ativosConditions.push(sql`con.servico IN (${servicosPlaceholders})`);
    }
    if (filters?.squads && filters.squads.length > 0) {
      const squadsPlaceholders = sql.join(filters.squads.map(s => sql`${s}`), sql`, `);
      ativosConditions.push(sql`con.squad IN (${squadsPlaceholders})`);
    }
    if (filters?.colaboradores && filters.colaboradores.length > 0) {
      const colaboradoresPlaceholders = sql.join(filters.colaboradores.map(c => sql`${c}`), sql`, `);
      ativosConditions.push(sql`cli.responsavel IN (${colaboradoresPlaceholders})`);
    }
    
    const ativosWhereClause = sql.join(ativosConditions, sql` AND `);
    
    const resultados = await db.execute(sql`
      WITH contratos_filtrados AS (
        SELECT 
          con.*,
          cli.responsavel
        FROM cup_contratos con
        LEFT JOIN cup_clientes cli ON con.id_task = cli.task_id
        WHERE ${whereClause}
      ),
      churn_por_responsavel AS (
        SELECT 
          COALESCE(responsavel, 'Sem responsável') as responsavel,
          COUNT(*) as quantidade_contratos,
          COALESCE(SUM(valorr::numeric), 0) as valor_total_churn
        FROM contratos_filtrados
        GROUP BY responsavel
      ),
      total_ativos_por_responsavel AS (
        SELECT 
          COALESCE(cli.responsavel, 'Sem responsável') as responsavel,
          COUNT(*) as total_contratos_ativos,
          COALESCE(SUM(con.valorr::numeric), 0) as valor_total_ativo
        FROM cup_contratos con
        LEFT JOIN cup_clientes cli ON con.id_task = cli.task_id
        WHERE ${ativosWhereClause}
        GROUP BY cli.responsavel
      )
      SELECT 
        c.responsavel,
        c.quantidade_contratos::integer,
        c.valor_total_churn::numeric as valor_total,
        COALESCE(a.valor_total_ativo, 0)::numeric as valor_ativo_total,
        CASE 
          WHEN COALESCE(a.total_contratos_ativos, 0) > 0 
          THEN (c.quantidade_contratos::numeric / (a.total_contratos_ativos::numeric + c.quantidade_contratos::numeric) * 100)
          ELSE 0 
        END as percentual_churn
      FROM churn_por_responsavel c
      LEFT JOIN total_ativos_por_responsavel a ON c.responsavel = a.responsavel
      ORDER BY c.valor_total_churn DESC
    `);
    
    return resultados.rows.map((row: any) => ({
      responsavel: row.responsavel,
      quantidadeContratos: parseInt(row.quantidade_contratos || '0'),
      valorTotal: parseFloat(row.valor_total || '0'),
      percentualChurn: parseFloat(row.percentual_churn || '0'),
      valorAtivoTotal: parseFloat(row.valor_ativo_total || '0'),
    }));
  }

  async getDfc(dataInicio?: string, dataFim?: string): Promise<DfcHierarchicalResponse> {
    // Buscar nomes reais das categorias da tabela caz_categorias
    // IMPORTANTE: O campo 'nome' contém CÓDIGO + DESCRIÇÃO juntos, ex: "06.10 Despesas Administrativas"
    const categoriasReais = await db.execute(sql.raw(`
      SELECT nome 
      FROM caz_categorias 
      WHERE nome IS NOT NULL
    `));
    
    const categoriaNamesMap = new Map<string, string>();
    for (const row of categoriasReais.rows) {
      const fullName = (row.nome as string) || '';
      
      // Parsear o campo nome que tem formato "CODIGO DESCRICAO" ou "CODIGO\tDESCRICAO"
      // Dividir no primeiro espaço/tab e pegar todo o resto como descrição
      const match = fullName.match(/^([^\s\t]+)[\s\t]+(.+)$/);
      if (match) {
        const codigo = match[1]; // Ex: "06.10"
        const descricao = match[2]; // Ex: "Despesas Administrativas" (nome completo!)
        
        // Normalizar o código (sem pontos, sem zeros à esquerda)
        const categoriaId = normalizeCode(codigo);
        categoriaNamesMap.set(categoriaId, descricao);
      }
    }
    
    console.log(`[DFC] Carregadas ${categoriaNamesMap.size} categorias da tabela caz_categorias`);
    
    const whereClauses: string[] = ['categoria_id IS NOT NULL', "categoria_id != ''", "status = 'QUITADO'"];
    
    // Sempre filtrar a partir de janeiro de 2025 (mínimo)
    const dataMinima = '2025-01-01';
    
    // Filtrar por data de vencimento E data de quitação (ambas devem ser >= 2025)
    if (dataInicio && dataInicio >= dataMinima) {
      whereClauses.push(`data_vencimento >= '${dataInicio}'`);
      whereClauses.push(`data_quitacao >= '${dataInicio}'`);
    } else {
      whereClauses.push(`data_vencimento >= '${dataMinima}'`);
      whereClauses.push(`data_quitacao >= '${dataMinima}'`);
    }
    
    if (dataFim) {
      whereClauses.push(`data_vencimento <= '${dataFim}'`);
      whereClauses.push(`data_quitacao <= '${dataFim}'`);
    }
    
    const whereClause = whereClauses.join(' AND ');
    
    const parcelas = await db.execute(sql.raw(`
      SELECT 
        id,
        descricao,
        valor_pago,
        categoria_id,
        categoria_nome,
        valor_categoria,
        data_quitacao,
        tipo_evento
      FROM caz_parcelas
      WHERE ${whereClause}
      ORDER BY data_quitacao
    `));

    const dfcMap = new Map<string, Map<string, number>>();
    const parcelasByCategory = new Map<string, DfcParcela[]>();
    const mesesSet = new Set<string>();
    const parcelaIdsProcessadas = new Set<number>();
    let totalValorProcessado = 0;

    console.log(`[DFC DEBUG] Total parcelas retornadas da query: ${parcelas.rows.length}`);

    for (const row of parcelas.rows) {
      parcelaIdsProcessadas.add(row.id as number);
      const categoriaNomes = (row.categoria_nome as string || '').split(';').map(s => s.trim()).filter(Boolean);
      const valorCategorias = (row.valor_categoria as string || '').split(';').map(s => s.trim()).filter(Boolean);
      const tipoEvento = row.tipo_evento as string || '';
      const valorPago = parseFloat(row.valor_pago as string || '0');
      
      if (categoriaNomes.length === 0) continue;

      const dataQuitacao = new Date(row.data_quitacao as string);
      const mes = dataQuitacao.toISOString().substring(0, 7);
      mesesSet.add(mes);

      // Calcular a soma total dos valores de categoria para rateio proporcional
      const somaValorCategorias = valorCategorias.reduce((acc, v) => acc + parseFloat(v || '0'), 0);

      for (let i = 0; i < categoriaNomes.length; i++) {
        const fullCategoriaNome = categoriaNomes[i];
        
        // Usar valor_pago da parcela, rateado proporcionalmente se houver múltiplas categorias
        let valor: number;
        if (categoriaNomes.length === 1) {
          // Se há apenas uma categoria, usar o valor_pago total
          valor = valorPago;
        } else {
          // Se há múltiplas categorias, ratear proporcionalmente baseado em valor_categoria
          const valorCategoriaAtual = parseFloat(valorCategorias[i] || '0');
          if (somaValorCategorias > 0) {
            const proporcao = valorCategoriaAtual / somaValorCategorias;
            valor = valorPago * proporcao;
          } else {
            // Se não houver soma de categorias, dividir igualmente
            valor = valorPago / categoriaNomes.length;
          }
        }

        const codeMatch = fullCategoriaNome.match(/^([\d.]+)\s+(.+)$/);
        if (!codeMatch) {
          console.warn(`[DFC] Skipping invalid categoria_nome format: ${fullCategoriaNome} (expected format: "CODE NAME")`);
          continue;
        }

        const categoriaId = codeMatch[1];
        const categoriaNome = codeMatch[2];
        
        const tipoEventoNormalized = (tipoEvento || '').toUpperCase().trim();
        const twoDigitPrefix = categoriaId.substring(0, 2);
        const isCategoriaReceita = (twoDigitPrefix === '03' || twoDigitPrefix === '04');
        const isCategoriaDespesa = (twoDigitPrefix === '05' || twoDigitPrefix === '06' || twoDigitPrefix === '07' || twoDigitPrefix === '08');
        
        const hasMismatch = 
          (isCategoriaReceita && tipoEventoNormalized === 'DESPESA') ||
          (isCategoriaDespesa && tipoEventoNormalized === 'RECEITA');
        
        if (hasMismatch) {
          continue;
        }

        const key = `${categoriaId}|${categoriaNome}`;
        
        if (!dfcMap.has(key)) {
          dfcMap.set(key, new Map());
        }
        
        const categoriaMap = dfcMap.get(key)!;
        const currentValue = categoriaMap.get(mes) || 0;
        categoriaMap.set(mes, currentValue + valor);
        totalValorProcessado += valor;

        if (!parcelasByCategory.has(key)) {
          parcelasByCategory.set(key, []);
        }
        
        parcelasByCategory.get(key)!.push({
          id: row.id as number,
          descricao: row.descricao as string || '',
          valorBruto: valor,
          dataQuitacao: dataQuitacao.toISOString(),
          mes: mes,
          tipoEvento: tipoEvento,
        });
      }
    }

    const items: DfcItem[] = [];
    for (const [key, mesesMap] of Array.from(dfcMap.entries())) {
      const [categoriaId, categoriaNome] = key.split('|');
      for (const [mes, valorTotal] of Array.from(mesesMap.entries())) {
        items.push({
          categoriaId,
          categoriaNome,
          mes,
          valorTotal,
        });
      }
    }

    const meses = Array.from(mesesSet).sort();

    console.log(`[DFC DEBUG] Parcelas únicas processadas: ${parcelaIdsProcessadas.size}`);
    console.log(`[DFC DEBUG] Total valor processado (soma de valor_categoria): ${totalValorProcessado.toFixed(2)}`);

    return buildHierarchy(items, meses, parcelasByCategory, categoriaNamesMap);
  }

  async getGegMetricas(periodo: string, squad: string, setor: string): Promise<any> {
    const { dataInicio, dataFim } = this.calcularPeriodo(periodo);
    
    let whereCurrentConditions = [sql`status = 'Ativo'`];
    if (squad !== 'todos') {
      whereCurrentConditions.push(sql`squad = ${squad}`);
    }
    if (setor !== 'todos') {
      whereCurrentConditions.push(sql`setor = ${setor}`);
    }

    const headcountResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM rh_pessoal
      WHERE ${sql.join(whereCurrentConditions, sql` AND `)}
    `);
    
    const headcount = parseInt(headcountResult.rows[0]?.total as string || '0');

    let whereAdmissoesConditions = [
      sql`admissao >= ${dataInicio}`,
      sql`admissao <= ${dataFim}`
    ];
    let whereDemissoesConditions = [
      sql`demissao >= ${dataInicio}`,
      sql`demissao <= ${dataFim}`,
      sql`demissao IS NOT NULL`
    ];
    
    if (squad !== 'todos') {
      whereAdmissoesConditions.push(sql`squad = ${squad}`);
      whereDemissoesConditions.push(sql`squad = ${squad}`);
    }
    if (setor !== 'todos') {
      whereAdmissoesConditions.push(sql`setor = ${setor}`);
      whereDemissoesConditions.push(sql`setor = ${setor}`);
    }

    const admissoesResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM rh_pessoal
      WHERE ${sql.join(whereAdmissoesConditions, sql` AND `)}
    `);
    
    const demissoesResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM rh_pessoal
      WHERE ${sql.join(whereDemissoesConditions, sql` AND `)}
    `);

    const admissoes = parseInt(admissoesResult.rows[0]?.total as string || '0');
    const demissoes = parseInt(demissoesResult.rows[0]?.total as string || '0');

    let whereHeadcountInicio = [
      sql`admissao < ${dataInicio}`,
      sql.raw(`(demissao IS NULL OR demissao >= '${dataInicio}')`)
    ];
    if (squad !== 'todos') {
      whereHeadcountInicio.push(sql`squad = ${squad}`);
    }
    if (setor !== 'todos') {
      whereHeadcountInicio.push(sql`setor = ${setor}`);
    }

    const headcountInicioResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM rh_pessoal
      WHERE ${sql.join(whereHeadcountInicio, sql` AND `)}
    `);

    const headcountInicio = parseInt(headcountInicioResult.rows[0]?.total as string || '0');
    const headcountMedio = (headcountInicio + headcount) / 2;
    const turnover = headcountMedio > 0 ? (demissoes / headcountMedio) * 100 : 0;

    const tempoMedioResult = await db.execute(sql`
      SELECT AVG(meses_de_turbo) as tempo_medio
      FROM rh_pessoal
      WHERE ${sql.join(whereCurrentConditions, sql` AND `)}
        AND meses_de_turbo IS NOT NULL
    `);

    const tempoMedioAtivo = parseFloat(tempoMedioResult.rows[0]?.tempo_medio as string || '0');

    return {
      headcount,
      turnover: parseFloat(turnover.toFixed(1)),
      admissoes,
      demissoes,
      tempoMedioAtivo: parseFloat(tempoMedioAtivo.toFixed(1)),
    };
  }

  async getGegEvolucaoHeadcount(periodo: string, squad: string, setor: string): Promise<any> {
    const { dataInicio } = this.calcularPeriodo(periodo);
    
    const result = await db.execute(sql.raw(`
      WITH meses AS (
        SELECT generate_series(
          date_trunc('month', '${dataInicio}'::date),
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        )::date AS mes
      ),
      dados_mensais AS (
        SELECT 
          TO_CHAR(m.mes, 'YYYY-MM') as mes,
          COUNT(DISTINCT CASE 
            WHEN r.admissao <= CASE 
              WHEN m.mes = date_trunc('month', CURRENT_DATE) THEN CURRENT_DATE
              ELSE m.mes
            END
              AND (r.demissao IS NULL OR r.demissao > CASE 
                WHEN m.mes = date_trunc('month', CURRENT_DATE) THEN CURRENT_DATE
                ELSE m.mes
              END)
            THEN r.id 
          END) as headcount,
          COUNT(DISTINCT CASE 
            WHEN date_trunc('month', r.admissao) = m.mes
            THEN r.id 
          END) as admissoes,
          COUNT(DISTINCT CASE 
            WHEN date_trunc('month', r.demissao) = m.mes
            THEN r.id 
          END) as demissoes
        FROM meses m
        LEFT JOIN rh_pessoal r ON 1=1
          ${squad !== 'todos' ? `AND r.squad = '${squad}'` : ''}
          ${setor !== 'todos' ? `AND r.setor = '${setor}'` : ''}
        GROUP BY m.mes
        ORDER BY m.mes
      )
      SELECT * FROM dados_mensais
    `));

    return result.rows.map(row => ({
      mes: row.mes as string,
      headcount: parseInt(row.headcount as string),
      admissoes: parseInt(row.admissoes as string),
      demissoes: parseInt(row.demissoes as string),
    }));
  }

  async getGegAdmissoesDemissoes(periodo: string, squad: string, setor: string): Promise<any> {
    const { dataInicio } = this.calcularPeriodo(periodo);
    
    const result = await db.execute(sql.raw(`
      WITH meses AS (
        SELECT generate_series(
          date_trunc('month', '${dataInicio}'::date),
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        )::date AS mes
      )
      SELECT 
        TO_CHAR(m.mes, 'YYYY-MM') as mes,
        COUNT(DISTINCT CASE 
          WHEN date_trunc('month', r.admissao) = m.mes
          THEN r.id 
        END) as admissoes,
        COUNT(DISTINCT CASE 
          WHEN date_trunc('month', r.demissao) = m.mes
          THEN r.id 
        END) as demissoes
      FROM meses m
      LEFT JOIN rh_pessoal r ON 1=1
        ${squad !== 'todos' ? `AND r.squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND r.setor = '${setor}'` : ''}
      GROUP BY m.mes
      ORDER BY m.mes
    `));

    return result.rows.map(row => ({
      mes: row.mes as string,
      admissoes: parseInt(row.admissoes as string),
      demissoes: parseInt(row.demissoes as string),
    }));
  }

  async getGegTempoPromocao(squad: string, setor: string): Promise<any> {
    const result = await db.execute(sql.raw(`
      SELECT 
        COALESCE(r.squad, 'Sem Squad') as squad,
        AVG(r.meses_ult_aumento) as tempo_medio_meses,
        COUNT(*) as total_colaboradores
      FROM rh_pessoal r
      WHERE r.status = 'Ativo'
        AND r.meses_ult_aumento IS NOT NULL
        ${squad !== 'todos' ? `AND r.squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND r.setor = '${setor}'` : ''}
      GROUP BY r.squad
      ORDER BY tempo_medio_meses DESC
    `));

    return result.rows.map(row => ({
      squad: row.squad as string,
      tempoMedioMeses: parseFloat((row.tempo_medio_meses as string) || '0'),
      totalColaboradores: parseInt(row.total_colaboradores as string),
    }));
  }

  async getGegAniversariantesMes(squad: string, setor: string): Promise<any> {
    const mesAtual = new Date().getMonth() + 1;
    
    const result = await db.execute(sql.raw(`
      SELECT 
        id,
        nome,
        aniversario,
        cargo,
        squad,
        EXTRACT(DAY FROM aniversario) as dia_aniversario,
        EXTRACT(DAY FROM CURRENT_DATE) as dia_atual
      FROM rh_pessoal
      WHERE status = 'Ativo'
        AND EXTRACT(MONTH FROM aniversario) = ${mesAtual}
        ${squad !== 'todos' ? `AND squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND setor = '${setor}'` : ''}
      ORDER BY EXTRACT(DAY FROM aniversario)
    `));

    return result.rows.map(row => ({
      id: row.id as number,
      nome: row.nome as string,
      aniversario: row.aniversario as string,
      cargo: row.cargo as string || null,
      squad: row.squad as string || null,
      diaAniversario: parseInt(row.dia_aniversario as string),
    }));
  }

  async getGegAniversariosEmpresa(squad: string, setor: string): Promise<any> {
    const result = await db.execute(sql.raw(`
      WITH aniversarios AS (
        SELECT 
          id,
          nome,
          admissao,
          cargo,
          squad,
          meses_de_turbo,
          EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) as anos_completos,
          MAKE_DATE(
            EXTRACT(YEAR FROM CURRENT_DATE)::int,
            EXTRACT(MONTH FROM admissao)::int,
            EXTRACT(DAY FROM admissao)::int
          ) as aniversario_ano_atual,
          MAKE_DATE(
            EXTRACT(YEAR FROM CURRENT_DATE)::int + 1,
            EXTRACT(MONTH FROM admissao)::int,
            EXTRACT(DAY FROM admissao)::int
          ) as aniversario_ano_proximo
        FROM rh_pessoal
        WHERE status = 'Ativo'
          ${squad !== 'todos' ? `AND squad = '${squad}'` : ''}
          ${setor !== 'todos' ? `AND setor = '${setor}'` : ''}
          AND admissao IS NOT NULL
      )
      SELECT 
        id,
        nome,
        admissao,
        cargo,
        squad,
        anos_completos,
        CASE 
          WHEN aniversario_ano_atual >= CURRENT_DATE 
          THEN (aniversario_ano_atual - CURRENT_DATE)
          ELSE (aniversario_ano_proximo - CURRENT_DATE)
        END as dias_ate_aniversario
      FROM aniversarios
      ORDER BY dias_ate_aniversario
      LIMIT 10
    `));

    return result.rows.map(row => ({
      id: row.id as number,
      nome: row.nome as string,
      admissao: row.admissao as string,
      cargo: row.cargo as string || null,
      squad: row.squad as string || null,
      anosDeEmpresa: parseInt(row.anos_completos as string) + 1,
      diasAteAniversario: parseInt(row.dias_ate_aniversario as string),
    }));
  }

  async getGegFiltros(): Promise<any> {
    const squadResult = await db.execute(sql`
      SELECT DISTINCT squad
      FROM rh_pessoal
      WHERE squad IS NOT NULL AND squad != ''
      ORDER BY squad
    `);

    const setorResult = await db.execute(sql`
      SELECT DISTINCT setor
      FROM rh_pessoal
      WHERE setor IS NOT NULL AND setor != ''
      ORDER BY setor
    `);

    return {
      squads: squadResult.rows.map(row => row.squad as string),
      setores: setorResult.rows.map(row => row.setor as string),
    };
  }

  async getGegValorMedioSalario(squad: string, setor: string): Promise<{ valorMedio: number; totalColaboradores: number }> {
    const result = await db.execute(sql.raw(`
      SELECT 
        AVG(proporcional) as valor_medio,
        COUNT(*) as total_colaboradores
      FROM rh_pessoal
      WHERE status = 'Ativo'
        AND proporcional IS NOT NULL
        AND proporcional > 0
        ${squad !== 'todos' ? `AND squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND setor = '${setor}'` : ''}
    `));

    const row = result.rows[0] as any;
    return {
      valorMedio: parseFloat(row.valor_medio || '0'),
      totalColaboradores: parseInt(row.total_colaboradores || '0'),
    };
  }

  async getGegPatrimonioResumo(): Promise<{ totalAtivos: number; valorTotalPago: number; valorTotalMercado: number; porTipo: { tipo: string; quantidade: number }[] }> {
    const resumoResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_ativos,
        COALESCE(SUM(valor_pago), 0) as valor_total_pago,
        COALESCE(SUM(valor_mercado), 0) as valor_total_mercado
      FROM rh_patrimonio
    `);

    const porTipoResult = await db.execute(sql`
      SELECT 
        ativo as tipo,
        COUNT(*) as quantidade
      FROM rh_patrimonio
      WHERE ativo IS NOT NULL AND ativo != ''
      GROUP BY ativo
      ORDER BY quantidade DESC
    `);

    const resumo = resumoResult.rows[0] as any;
    
    return {
      totalAtivos: parseInt(resumo.total_ativos || '0'),
      valorTotalPago: parseFloat(resumo.valor_total_pago || '0'),
      valorTotalMercado: parseFloat(resumo.valor_total_mercado || '0'),
      porTipo: porTipoResult.rows.map(row => ({
        tipo: row.tipo as string,
        quantidade: parseInt(row.quantidade as string),
      })),
    };
  }

  async getGegUltimasPromocoes(squad: string, setor: string, limit: number = 10): Promise<any[]> {
    const result = await db.execute(sql.raw(`
      SELECT 
        id,
        nome,
        cargo,
        nivel,
        squad,
        setor,
        ultimo_aumento,
        meses_ult_aumento
      FROM rh_pessoal
      WHERE status = 'Ativo'
        AND ultimo_aumento IS NOT NULL
        ${squad !== 'todos' ? `AND squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND setor = '${setor}'` : ''}
      ORDER BY ultimo_aumento DESC
      LIMIT ${limit}
    `));

    return result.rows.map(row => ({
      id: row.id as number,
      nome: row.nome as string,
      cargo: row.cargo as string || null,
      nivel: row.nivel as string || null,
      squad: row.squad as string || null,
      setor: row.setor as string || null,
      ultimoAumento: row.ultimo_aumento as string,
      mesesUltAumento: parseInt((row.meses_ult_aumento as string) || '0'),
    }));
  }

  async getGegTempoPermanencia(squad: string, setor: string): Promise<{ tempoMedioAtivos: number; tempoMedioDesligados: number }> {
    const result = await db.execute(sql.raw(`
      SELECT 
        AVG(CASE WHEN status = 'Ativo' THEN 
          EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + 
          EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao))
        END) as tempo_medio_ativos,
        AVG(CASE WHEN status = 'Dispensado' AND demissao IS NOT NULL THEN 
          EXTRACT(YEAR FROM AGE(demissao, admissao)) * 12 + 
          EXTRACT(MONTH FROM AGE(demissao, admissao))
        END) as tempo_medio_desligados
      FROM rh_pessoal
      WHERE admissao IS NOT NULL
        ${squad !== 'todos' ? `AND squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND setor = '${setor}'` : ''}
    `));

    const row = result.rows[0] as any;
    return {
      tempoMedioAtivos: parseFloat(row.tempo_medio_ativos || '0'),
      tempoMedioDesligados: parseFloat(row.tempo_medio_desligados || '0'),
    };
  }

  async getGegMasContratacoes(squad: string, setor: string): Promise<GegMasContratacoes> {
    const result = await db.execute(sql.raw(`
      SELECT 
        id,
        nome,
        setor,
        squad,
        TO_CHAR(admissao, 'YYYY-MM-DD') as admissao,
        TO_CHAR(demissao, 'YYYY-MM-DD') as demissao,
        (demissao::date - admissao::date) as dias_ate_desligamento
      FROM rh_pessoal
      WHERE admissao IS NOT NULL
        AND demissao IS NOT NULL
        AND (demissao::date - admissao::date) <= 90
        AND (demissao::date - admissao::date) >= 0
        ${squad !== 'todos' ? `AND squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND setor = '${setor}'` : ''}
      ORDER BY demissao DESC
    `));

    const colaboradores = result.rows.map(row => ({
      id: row.id as number,
      nome: row.nome as string,
      setor: row.setor as string || null,
      squad: row.squad as string || null,
      admissao: row.admissao as string,
      demissao: row.demissao as string,
      diasAteDesligamento: parseInt(row.dias_ate_desligamento as string || '0'),
    }));

    return {
      total: colaboradores.length,
      colaboradores,
    };
  }

  async getGegPessoasPorSetor(squad: string, setor: string): Promise<GegPessoasPorSetor[]> {
    const result = await db.execute(sql.raw(`
      SELECT 
        COALESCE(setor, 'Não informado') as setor,
        COUNT(*) as total
      FROM rh_pessoal
      WHERE status = 'Ativo'
        ${squad !== 'todos' ? `AND squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND setor = '${setor}'` : ''}
      GROUP BY COALESCE(setor, 'Não informado')
      ORDER BY total DESC
    `));

    return result.rows.map(row => ({
      setor: row.setor as string,
      total: parseInt(row.total as string || '0'),
    }));
  }

  async getGegDemissoesPorTipo(squad: string, setor: string): Promise<GegDemissoesPorTipo[]> {
    const result = await db.execute(sql.raw(`
      SELECT 
        COALESCE(tipo_demissao, 'Não informado') as tipo,
        COUNT(*) as total
      FROM rh_pessoal
      WHERE LOWER(status) IN ('inativo', 'em desligamento', 'dispensado')
        ${squad !== 'todos' ? `AND squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND setor = '${setor}'` : ''}
      GROUP BY COALESCE(tipo_demissao, 'Não informado')
      ORDER BY total DESC
    `));

    const totalGeral = result.rows.reduce((acc, row) => acc + parseInt(row.total as string || '0'), 0);

    return result.rows.map(row => {
      const total = parseInt(row.total as string || '0');
      return {
        tipo: row.tipo as string,
        total,
        percentual: totalGeral > 0 ? Math.round((total / totalGeral) * 100) : 0,
      };
    });
  }

  async getGegHeadcountPorTenure(squad: string, setor: string): Promise<GegHeadcountPorTenure[]> {
    const result = await db.execute(sql.raw(`
      SELECT 
        CASE 
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 3 THEN 'Menos de 3 meses'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 6 THEN '3 a 6 meses'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 12 THEN '6 a 12 meses'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 2 THEN '1 a 2 anos'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 3 THEN '2 a 3 anos'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 5 THEN '3 a 5 anos'
          ELSE 'Mais de 5 anos'
        END as faixa,
        CASE 
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 3 THEN 1
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 6 THEN 2
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 12 THEN 3
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 2 THEN 4
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 3 THEN 5
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 5 THEN 6
          ELSE 7
        END as ordem,
        COUNT(*) as total
      FROM rh_pessoal
      WHERE status = 'Ativo'
        AND admissao IS NOT NULL
        ${squad !== 'todos' ? `AND squad = '${squad}'` : ''}
        ${setor !== 'todos' ? `AND setor = '${setor}'` : ''}
      GROUP BY 
        CASE 
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 3 THEN 'Menos de 3 meses'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 6 THEN '3 a 6 meses'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 12 THEN '6 a 12 meses'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 2 THEN '1 a 2 anos'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 3 THEN '2 a 3 anos'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 5 THEN '3 a 5 anos'
          ELSE 'Mais de 5 anos'
        END,
        CASE 
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 3 THEN 1
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 6 THEN 2
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) < 12 THEN 3
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 2 THEN 4
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 3 THEN 5
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) < 5 THEN 6
          ELSE 7
        END
      ORDER BY ordem
    `));

    return result.rows.map(row => ({
      faixa: row.faixa as string,
      total: parseInt(row.total as string || '0'),
      ordem: parseInt(row.ordem as string || '0'),
    }));
  }

  async getTopResponsaveis(limit: number = 5, mesAno?: string): Promise<{ nome: string; mrr: number; posicao: number }[]> {
    let dataUltimoSnapshot: any = null;

    if (mesAno) {
      const [ano, mes] = mesAno.split('-').map(Number);
      const inicioMes = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 0, 23, 59, 59);

      const ultimoSnapshotQuery = await db.execute(sql`
        SELECT MAX(data_snapshot) as data_ultimo_snapshot
        FROM ${schema.cupDataHist}
        WHERE data_snapshot >= ${inicioMes}::timestamp
          AND data_snapshot <= ${fimMes}::timestamp
      `);

      dataUltimoSnapshot = (ultimoSnapshotQuery.rows[0] as any)?.data_ultimo_snapshot;
    } else {
      const ultimoSnapshotQuery = await db.execute(sql`
        SELECT MAX(data_snapshot) as data_ultimo_snapshot
        FROM ${schema.cupDataHist}
      `);

      dataUltimoSnapshot = (ultimoSnapshotQuery.rows[0] as any)?.data_ultimo_snapshot;
    }

    if (!dataUltimoSnapshot) {
      return [];
    }

    const resultados = await db.execute(sql`
      SELECT 
        responsavel as nome,
        COALESCE(SUM(valorr::numeric), 0) as mrr
      FROM ${schema.cupDataHist}
      WHERE data_snapshot = ${dataUltimoSnapshot}::timestamp
        AND responsavel IS NOT NULL 
        AND responsavel != ''
        AND valorr IS NOT NULL
        AND valorr > 0
        AND status IN ('ativo', 'onboarding', 'triagem')
      GROUP BY responsavel
      HAVING COALESCE(SUM(valorr::numeric), 0) > 0
      ORDER BY mrr DESC
      LIMIT ${limit}
    `);

    return resultados.rows.map((row, index) => ({
      nome: row.nome as string,
      mrr: parseFloat(row.mrr as string || '0'),
      posicao: index + 1,
    }));
  }

  async getTopSquads(limit: number = 4, mesAno?: string): Promise<{ squad: string; mrr: number; posicao: number }[]> {
    let dataUltimoSnapshot: any = null;

    if (mesAno) {
      const [ano, mes] = mesAno.split('-').map(Number);
      const inicioMes = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 0, 23, 59, 59);

      const ultimoSnapshotQuery = await db.execute(sql`
        SELECT MAX(data_snapshot) as data_ultimo_snapshot
        FROM ${schema.cupDataHist}
        WHERE data_snapshot >= ${inicioMes}::timestamp
          AND data_snapshot <= ${fimMes}::timestamp
      `);

      dataUltimoSnapshot = (ultimoSnapshotQuery.rows[0] as any)?.data_ultimo_snapshot;
    } else {
      const ultimoSnapshotQuery = await db.execute(sql`
        SELECT MAX(data_snapshot) as data_ultimo_snapshot
        FROM ${schema.cupDataHist}
      `);

      dataUltimoSnapshot = (ultimoSnapshotQuery.rows[0] as any)?.data_ultimo_snapshot;
    }

    if (!dataUltimoSnapshot) {
      return [];
    }

    const resultados = await db.execute(sql`
      SELECT 
        squad,
        COALESCE(SUM(valorr::numeric), 0) as mrr
      FROM ${schema.cupDataHist}
      WHERE data_snapshot = ${dataUltimoSnapshot}::timestamp
        AND squad IS NOT NULL 
        AND squad != ''
        AND valorr IS NOT NULL
        AND valorr > 0
        AND status IN ('ativo', 'onboarding', 'triagem')
      GROUP BY squad
      HAVING COALESCE(SUM(valorr::numeric), 0) > 0
      ORDER BY mrr DESC
      LIMIT ${limit}
    `);

    return resultados.rows.map((row, index) => ({
      squad: row.squad as string,
      mrr: parseFloat(row.mrr as string || '0'),
      posicao: index + 1,
    }));
  }

  async getInhireMetrics(): Promise<InhireMetrics> {
    const [candidaturasResult, vagasResult, ativosResult, vagasAbertasResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as total FROM ${schema.rhCandidaturas}`),
      db.execute(sql`SELECT COUNT(*) as total FROM ${schema.rhVagas}`),
      db.execute(sql`SELECT COUNT(*) as total FROM ${schema.rhCandidaturas} WHERE talent_status = 'active'`),
      db.execute(sql`SELECT COUNT(*) as total FROM ${schema.rhVagas} WHERE status NOT IN ('closed', 'cancelada', 'preenchida')`)
    ]);

    const totalCandidaturas = parseInt((candidaturasResult.rows[0] as any).total || '0');
    const totalVagas = parseInt((vagasResult.rows[0] as any).total || '0');
    const candidatosAtivos = parseInt((ativosResult.rows[0] as any).total || '0');
    const vagasAbertas = parseInt((vagasAbertasResult.rows[0] as any).total || '0');

    const taxaConversao = totalCandidaturas > 0 ? (candidatosAtivos / totalCandidaturas) * 100 : 0;

    return {
      totalCandidaturas,
      candidatosAtivos,
      totalVagas,
      vagasAbertas,
      taxaConversao: parseFloat(taxaConversao.toFixed(2)),
      tempoMedioContratacao: 0
    };
  }

  async getInhireStatusDistribution(): Promise<InhireStatusDistribution[]> {
    const result = await db.execute(sql`
      SELECT 
        talent_status as "talentStatus",
        COUNT(*)::int as total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentual
      FROM ${schema.rhCandidaturas}
      WHERE talent_status IS NOT NULL
      GROUP BY talent_status
      ORDER BY total DESC
    `);

    return result.rows.map((row: any) => ({
      talentStatus: row.talentStatus || 'Não informado',
      total: parseInt(row.total || '0'),
      percentual: parseFloat(row.percentual || '0')
    }));
  }

  async getInhireStageDistribution(): Promise<InhireStageDistribution[]> {
    const result = await db.execute(sql`
      SELECT 
        stage_name as "stageName",
        COUNT(*)::int as total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentual
      FROM ${schema.rhCandidaturas}
      WHERE stage_name IS NOT NULL
      GROUP BY stage_name
      ORDER BY total DESC
    `);

    return result.rows.map((row: any) => ({
      stageName: row.stageName || 'Não informado',
      total: parseInt(row.total || '0'),
      percentual: parseFloat(row.percentual || '0')
    }));
  }

  async getInhireSourceDistribution(): Promise<InhireSourceDistribution[]> {
    const result = await db.execute(sql`
      SELECT 
        source,
        COUNT(*)::int as total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentual
      FROM ${schema.rhCandidaturas}
      WHERE source IS NOT NULL
      GROUP BY source
      ORDER BY total DESC
    `);

    return result.rows.map((row: any) => ({
      source: row.source || 'Não informado',
      total: parseInt(row.total || '0'),
      percentual: parseFloat(row.percentual || '0')
    }));
  }

  async getInhireFunnel(): Promise<InhireFunnel[]> {
    const stageOrder: Record<string, number> = {
      'Candidatura Recebida': 1,
      'Triagem': 2,
      'Entrevista Inicial': 3,
      'Teste Técnico': 4,
      'Entrevista Final': 5,
      'Proposta Enviada': 6,
      'Contratado': 7,
      'Recusado': 8,
      'Desistiu': 9
    };

    const result = await db.execute(sql`
      SELECT 
        stage_name as "stageName",
        COUNT(*)::int as total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentual
      FROM ${schema.rhCandidaturas}
      WHERE stage_name IS NOT NULL
      GROUP BY stage_name
      ORDER BY total DESC
    `);

    return result.rows.map((row: any) => ({
      stageName: row.stageName || 'Não informado',
      total: parseInt(row.total || '0'),
      percentual: parseFloat(row.percentual || '0'),
      ordem: stageOrder[row.stageName] || 99
    })).sort((a, b) => a.ordem - b.ordem);
  }

  async getInhireVagasComCandidaturas(limit: number = 10): Promise<InhireVagaComCandidaturas[]> {
    const result = await db.execute(sql`
      SELECT 
        v.id as "vagaId",
        v.nome as "vagaNome",
        v.status as "vagaStatus",
        COUNT(c.id)::int as "totalCandidaturas",
        json_agg(
          json_build_object(
            'status', c.talent_status,
            'total', 1
          )
        ) as "candidatosPorStatus"
      FROM rh_vagas v
      LEFT JOIN rh_candidaturas c ON c.job_id_hash::bigint = v.id
      GROUP BY v.id, v.nome, v.status
      ORDER BY "totalCandidaturas" DESC
      LIMIT ${limit}
    `);

    return result.rows.map((row: any) => {
      const statusMap = new Map<string, number>();
      if (row.candidatosPorStatus) {
        const statuses = Array.isArray(row.candidatosPorStatus) ? row.candidatosPorStatus : [];
        statuses.forEach((item: any) => {
          if (item.status) {
            statusMap.set(item.status, (statusMap.get(item.status) || 0) + 1);
          }
        });
      }

      return {
        vagaId: row.vagaId,
        vagaNome: row.vagaNome || 'Vaga sem nome',
        vagaStatus: row.vagaStatus || 'Não informado',
        totalCandidaturas: parseInt(row.totalCandidaturas || '0'),
        candidatosPorStatus: Array.from(statusMap.entries()).map(([status, total]) => ({
          status,
          total
        }))
      };
    });
  }

  async getMetaDateRange(): Promise<{ minDate: string; maxDate: string }> {
    const result = await db.execute(sql`
      SELECT 
        MIN(date_start)::text as "minDate",
        MAX(date_stop)::text as "maxDate"
      FROM ${schema.metaInsightsDaily}
    `);
    
    const row = result.rows[0] as any;
    return {
      minDate: row.minDate || '',
      maxDate: row.maxDate || ''
    };
  }

  async getMetaLeadFilters(): Promise<import("@shared/schema").MetaLeadFilters> {
    // Get distinct categories
    const categoriesResult = await db.execute(sql`
      SELECT DISTINCT category_name
      FROM ${schema.crmDeal}
      WHERE category_name IS NOT NULL
      ORDER BY category_name
    `);

    // Get distinct stages
    const stagesResult = await db.execute(sql`
      SELECT DISTINCT stage_name
      FROM ${schema.crmDeal}
      WHERE stage_name IS NOT NULL
      ORDER BY stage_name
    `);

    // Get distinct UTM sources
    const utmSourcesResult = await db.execute(sql`
      SELECT DISTINCT utm_source
      FROM ${schema.crmDeal}
      WHERE utm_source IS NOT NULL
      ORDER BY utm_source
    `);

    // Get distinct UTM campaigns with names from meta_campaigns
    const utmCampaignsResult = await db.execute(sql`
      SELECT DISTINCT 
        d.utm_campaign as id,
        COALESCE(c.campaign_name, d.utm_campaign) as name
      FROM ${schema.crmDeal} d
      LEFT JOIN ${schema.metaCampaigns} c ON d.utm_campaign = c.campaign_id
      WHERE d.utm_campaign IS NOT NULL
      ORDER BY name
    `);

    // Get distinct UTM terms (adset IDs) with names from meta_adsets
    const utmTermsResult = await db.execute(sql`
      SELECT DISTINCT 
        d.utm_term as id,
        COALESCE(a.adset_name, d.utm_term) as name
      FROM ${schema.crmDeal} d
      LEFT JOIN ${schema.metaAdsets} a ON d.utm_term = a.adset_id
      WHERE d.utm_term IS NOT NULL
      ORDER BY name
    `);

    return {
      categories: categoriesResult.rows.map((r: any) => r.category_name),
      stages: stagesResult.rows.map((r: any) => r.stage_name),
      utmSources: utmSourcesResult.rows.map((r: any) => r.utm_source),
      utmCampaigns: utmCampaignsResult.rows.map((r: any) => ({
        id: r.id,
        name: r.name
      })),
      utmTerms: utmTermsResult.rows.map((r: any) => ({
        id: r.id,
        name: r.name
      }))
    };
  }

  async getMetaOverview(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams): Promise<MetaOverview> {
    const result = await db.execute(sql`
      WITH meta_metrics AS (
        SELECT 
          COALESCE(SUM(spend), 0) as total_spend,
          COALESCE(SUM(impressions), 0) as total_impressions,
          COALESCE(SUM(clicks), 0) as total_clicks,
          COALESCE(SUM(reach), 0) as total_reach
        FROM ${schema.metaInsightsDaily}
        WHERE 1=1
          ${startDate ? sql`AND date_start >= ${startDate}::date` : sql``}
          ${endDate ? sql`AND date_stop <= ${endDate}::date` : sql``}
      ),
      crm_metrics AS (
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 END) as total_won,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) END), 0) as total_won_value
        FROM ${schema.crmDeal}
        WHERE utm_campaign IS NOT NULL
          ${startDate ? sql`AND date_create >= ${startDate}::timestamp` : sql``}
          ${endDate ? sql`AND date_create <= ${endDate}::timestamp` : sql``}
          ${leadFilters?.categoryNames?.length ? sql`AND category_name = ANY(${leadFilters.categoryNames})` : sql``}
          ${leadFilters?.stageNames?.length ? sql`AND stage_name = ANY(${leadFilters.stageNames})` : sql``}
          ${leadFilters?.utmSources?.length ? sql`AND utm_source = ANY(${leadFilters.utmSources})` : sql``}
          ${leadFilters?.utmCampaigns?.length ? sql`AND utm_campaign = ANY(${leadFilters.utmCampaigns})` : sql``}
          ${leadFilters?.utmTerms?.length ? sql`AND utm_term = ANY(${leadFilters.utmTerms})` : sql``}
      )
      SELECT 
        mm.total_spend::numeric as "totalSpend",
        mm.total_impressions::bigint as "totalImpressions",
        mm.total_clicks::bigint as "totalClicks",
        mm.total_reach::bigint as "totalReach",
        CASE 
          WHEN mm.total_impressions > 0 THEN (mm.total_clicks::numeric / mm.total_impressions::numeric * 100)
          ELSE 0 
        END as "avgCtr",
        CASE 
          WHEN mm.total_clicks > 0 THEN (mm.total_spend::numeric / mm.total_clicks::numeric)
          ELSE 0 
        END as "avgCpc",
        CASE 
          WHEN mm.total_impressions > 0 THEN (mm.total_spend::numeric / mm.total_impressions::numeric * 1000)
          ELSE 0 
        END as "avgCpm",
        cm.total_leads::bigint as "totalLeads",
        cm.total_won::bigint as "totalWon",
        cm.total_won_value::numeric as "totalWonValue",
        CASE 
          WHEN mm.total_spend > 0 THEN (cm.total_won_value::numeric / mm.total_spend::numeric)
          ELSE 0 
        END as "roas",
        CASE 
          WHEN cm.total_leads > 0 THEN (mm.total_spend::numeric / cm.total_leads::numeric)
          ELSE 0 
        END as "costPerLead",
        CASE 
          WHEN cm.total_won > 0 THEN (mm.total_spend::numeric / cm.total_won::numeric)
          ELSE 0 
        END as "cac",
        CASE 
          WHEN cm.total_leads > 0 THEN (cm.total_won::numeric / cm.total_leads::numeric * 100)
          ELSE 0 
        END as "conversionRate"
      FROM meta_metrics mm, crm_metrics cm
    `);

    const row = result.rows[0] as any;
    return {
      totalSpend: parseFloat(row.totalSpend || '0'),
      totalImpressions: parseInt(row.totalImpressions || '0'),
      totalClicks: parseInt(row.totalClicks || '0'),
      totalReach: parseInt(row.totalReach || '0'),
      avgCtr: parseFloat(row.avgCtr || '0'),
      avgCpc: parseFloat(row.avgCpc || '0'),
      avgCpm: parseFloat(row.avgCpm || '0'),
      totalLeads: parseInt(row.totalLeads || '0'),
      totalWon: parseInt(row.totalWon || '0'),
      totalWonValue: parseFloat(row.totalWonValue || '0'),
      roas: parseFloat(row.roas || '0'),
      costPerLead: parseFloat(row.costPerLead || '0'),
      cac: parseFloat(row.cac || '0'),
      conversionRate: parseFloat(row.conversionRate || '0')
    };
  }

  async getCampaignPerformance(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams): Promise<CampaignPerformance[]> {
    const result = await db.execute(sql`
      WITH campaign_metrics AS (
        SELECT 
          c.campaign_id,
          c.campaign_name,
          c.objective,
          c.status,
          COALESCE(SUM(mi.spend), 0) as spend,
          COALESCE(SUM(mi.impressions), 0) as impressions,
          COALESCE(SUM(mi.clicks), 0) as clicks
        FROM ${schema.metaCampaigns} c
        LEFT JOIN ${schema.metaInsightsDaily} mi ON c.campaign_id = mi.campaign_id
        WHERE 1=1
          ${startDate ? sql`AND mi.date_start >= ${startDate}::date` : sql``}
          ${endDate ? sql`AND mi.date_stop <= ${endDate}::date` : sql``}
        GROUP BY c.campaign_id, c.campaign_name, c.objective, c.status
      ),
      campaign_crm AS (
        SELECT 
          utm_campaign as campaign_id,
          COUNT(*) as leads,
          COUNT(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 END) as won,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) END), 0) as won_value
        FROM ${schema.crmDeal}
        WHERE utm_campaign IS NOT NULL
          ${startDate ? sql`AND date_create >= ${startDate}::timestamp` : sql``}
          ${endDate ? sql`AND date_create <= ${endDate}::timestamp` : sql``}
          ${leadFilters?.categoryNames?.length ? sql`AND category_name = ANY(${leadFilters.categoryNames})` : sql``}
          ${leadFilters?.stageNames?.length ? sql`AND stage_name = ANY(${leadFilters.stageNames})` : sql``}
          ${leadFilters?.utmSources?.length ? sql`AND utm_source = ANY(${leadFilters.utmSources})` : sql``}
          ${leadFilters?.utmCampaigns?.length ? sql`AND utm_campaign = ANY(${leadFilters.utmCampaigns})` : sql``}
          ${leadFilters?.utmTerms?.length ? sql`AND utm_term = ANY(${leadFilters.utmTerms})` : sql``}
        GROUP BY utm_campaign
      )
      SELECT 
        cm.campaign_id as "campaignId",
        cm.campaign_name as "campaignName",
        cm.objective,
        cm.status,
        cm.spend::numeric,
        cm.impressions::bigint,
        cm.clicks::bigint,
        CASE 
          WHEN cm.impressions > 0 THEN (cm.clicks::numeric / cm.impressions::numeric * 100)
          ELSE 0 
        END as ctr,
        CASE 
          WHEN cm.clicks > 0 THEN (cm.spend::numeric / cm.clicks::numeric)
          ELSE 0 
        END as cpc,
        COALESCE(cc.leads, 0)::bigint as leads,
        COALESCE(cc.won, 0)::bigint as won,
        COALESCE(cc.won_value, 0)::numeric as "wonValue",
        CASE 
          WHEN cm.spend > 0 THEN (COALESCE(cc.won_value, 0)::numeric / cm.spend::numeric)
          ELSE 0 
        END as roas,
        CASE 
          WHEN COALESCE(cc.leads, 0) > 0 THEN (COALESCE(cc.won, 0)::numeric / COALESCE(cc.leads, 1)::numeric * 100)
          ELSE 0 
        END as "conversionRate"
      FROM campaign_metrics cm
      LEFT JOIN campaign_crm cc ON cm.campaign_id = cc.campaign_id
      WHERE cm.spend > 0 OR cm.impressions > 0
      ORDER BY cm.spend DESC
    `);

    return result.rows.map((row: any) => ({
      campaignId: row.campaignId,
      campaignName: row.campaignName || 'Sem nome',
      objective: row.objective,
      status: row.status,
      spend: parseFloat(row.spend || '0'),
      impressions: parseInt(row.impressions || '0'),
      clicks: parseInt(row.clicks || '0'),
      ctr: parseFloat(row.ctr || '0'),
      cpc: parseFloat(row.cpc || '0'),
      leads: parseInt(row.leads || '0'),
      won: parseInt(row.won || '0'),
      wonValue: parseFloat(row.wonValue || '0'),
      roas: parseFloat(row.roas || '0'),
      conversionRate: parseFloat(row.conversionRate || '0')
    }));
  }

  async getAdsetPerformance(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams, campaignId?: string): Promise<AdsetPerformance[]> {
    const result = await db.execute(sql`
      WITH adset_metrics AS (
        SELECT 
          a.adset_id,
          a.adset_name,
          a.status,
          a.optimization_goal,
          a.targeting_age_min,
          a.targeting_age_max,
          c.campaign_name,
          COALESCE(SUM(mi.spend), 0) as spend,
          COALESCE(SUM(mi.impressions), 0) as impressions,
          COALESCE(SUM(mi.clicks), 0) as clicks
        FROM ${schema.metaAdsets} a
        LEFT JOIN ${schema.metaCampaigns} c ON a.campaign_id = c.campaign_id
        LEFT JOIN ${schema.metaInsightsDaily} mi ON a.adset_id = mi.adset_id
        WHERE 1=1
          ${campaignId ? sql`AND a.campaign_id = ${campaignId}` : sql``}
          ${startDate ? sql`AND mi.date_start >= ${startDate}::date` : sql``}
          ${endDate ? sql`AND mi.date_stop <= ${endDate}::date` : sql``}
        GROUP BY a.adset_id, a.adset_name, a.status, a.optimization_goal, a.targeting_age_min, a.targeting_age_max, c.campaign_name
      ),
      adset_crm AS (
        SELECT 
          utm_term as adset_id,
          COUNT(*) as leads,
          COUNT(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 END) as won,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) END), 0) as won_value
        FROM ${schema.crmDeal}
        WHERE utm_term IS NOT NULL
          ${startDate ? sql`AND date_create >= ${startDate}::timestamp` : sql``}
          ${endDate ? sql`AND date_create <= ${endDate}::timestamp` : sql``}
          ${leadFilters?.categoryNames?.length ? sql`AND category_name = ANY(${leadFilters.categoryNames})` : sql``}
          ${leadFilters?.stageNames?.length ? sql`AND stage_name = ANY(${leadFilters.stageNames})` : sql``}
          ${leadFilters?.utmSources?.length ? sql`AND utm_source = ANY(${leadFilters.utmSources})` : sql``}
          ${leadFilters?.utmCampaigns?.length ? sql`AND utm_campaign = ANY(${leadFilters.utmCampaigns})` : sql``}
          ${leadFilters?.utmTerms?.length ? sql`AND utm_term = ANY(${leadFilters.utmTerms})` : sql``}
        GROUP BY utm_term
      )
      SELECT 
        am.adset_id as "adsetId",
        am.adset_name as "adsetName",
        am.campaign_name as "campaignName",
        am.status,
        am.optimization_goal as "optimizationGoal",
        am.targeting_age_min as "targetingAgeMin",
        am.targeting_age_max as "targetingAgeMax",
        am.spend::numeric,
        am.impressions::bigint,
        am.clicks::bigint,
        CASE 
          WHEN am.impressions > 0 THEN (am.clicks::numeric / am.impressions::numeric * 100)
          ELSE 0 
        END as ctr,
        CASE 
          WHEN am.clicks > 0 THEN (am.spend::numeric / am.clicks::numeric)
          ELSE 0 
        END as cpc,
        COALESCE(ac.leads, 0)::bigint as leads,
        COALESCE(ac.won, 0)::bigint as won,
        COALESCE(ac.won_value, 0)::numeric as "wonValue",
        CASE 
          WHEN am.spend > 0 THEN (COALESCE(ac.won_value, 0)::numeric / am.spend::numeric)
          ELSE 0 
        END as roas,
        CASE 
          WHEN COALESCE(ac.leads, 0) > 0 THEN (COALESCE(ac.won, 0)::numeric / COALESCE(ac.leads, 1)::numeric * 100)
          ELSE 0 
        END as "conversionRate"
      FROM adset_metrics am
      LEFT JOIN adset_crm ac ON am.adset_id = ac.adset_id
      WHERE am.spend > 0 OR am.impressions > 0
      ORDER BY am.spend DESC
    `);

    return result.rows.map((row: any) => ({
      adsetId: row.adsetId,
      adsetName: row.adsetName || 'Sem nome',
      campaignName: row.campaignName || 'Sem campanha',
      status: row.status,
      optimizationGoal: row.optimizationGoal,
      targetingAgeMin: row.targetingAgeMin ? parseInt(row.targetingAgeMin) : null,
      targetingAgeMax: row.targetingAgeMax ? parseInt(row.targetingAgeMax) : null,
      spend: parseFloat(row.spend || '0'),
      impressions: parseInt(row.impressions || '0'),
      clicks: parseInt(row.clicks || '0'),
      ctr: parseFloat(row.ctr || '0'),
      cpc: parseFloat(row.cpc || '0'),
      leads: parseInt(row.leads || '0'),
      won: parseInt(row.won || '0'),
      wonValue: parseFloat(row.wonValue || '0'),
      roas: parseFloat(row.roas || '0'),
      conversionRate: parseFloat(row.conversionRate || '0')
    }));
  }

  async getAdPerformance(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams, adsetId?: string): Promise<AdPerformance[]> {
    // NOTE: Ad-level CRM conversions are intentionally zeroed because crm_deal table
    // lacks utm_content field (ad_id tracking). Only campaign/adset-level conversions
    // are tracked via utm_campaign and utm_term respectively.
    const result = await db.execute(sql`
      SELECT 
        a.ad_id as "adId",
        a.ad_name as "adName",
        c.campaign_name as "campaignName",
        ads.adset_name as "adsetName",
        a.status,
        a.creative_id as "creativeId",
        COALESCE(SUM(mi.spend), 0)::numeric as spend,
        COALESCE(SUM(mi.impressions), 0)::bigint as impressions,
        COALESCE(SUM(mi.clicks), 0)::bigint as clicks,
        CASE 
          WHEN COALESCE(SUM(mi.impressions), 0) > 0 THEN (COALESCE(SUM(mi.clicks), 0)::numeric / COALESCE(SUM(mi.impressions), 1)::numeric * 100)
          ELSE 0 
        END as ctr,
        CASE 
          WHEN COALESCE(SUM(mi.clicks), 0) > 0 THEN (COALESCE(SUM(mi.spend), 0)::numeric / COALESCE(SUM(mi.clicks), 1)::numeric)
          ELSE 0 
        END as cpc,
        0::bigint as leads,
        0::bigint as won,
        0::numeric as "wonValue",
        0::numeric as roas,
        0::numeric as "conversionRate"
      FROM ${schema.metaAds} a
      LEFT JOIN ${schema.metaCampaigns} c ON a.campaign_id = c.campaign_id
      LEFT JOIN ${schema.metaAdsets} ads ON a.adset_id = ads.adset_id
      LEFT JOIN ${schema.metaInsightsDaily} mi ON a.ad_id = mi.ad_id
      WHERE 1=1
        ${adsetId ? sql`AND a.adset_id = ${adsetId}` : sql``}
        ${startDate ? sql`AND mi.date_start >= ${startDate}::date` : sql``}
        ${endDate ? sql`AND mi.date_stop <= ${endDate}::date` : sql``}
      GROUP BY a.ad_id, a.ad_name, a.status, a.creative_id, c.campaign_name, ads.adset_name
      HAVING COALESCE(SUM(mi.spend), 0) > 0 OR COALESCE(SUM(mi.impressions), 0) > 0
      ORDER BY COALESCE(SUM(mi.spend), 0) DESC
    `);

    return result.rows.map((row: any) => ({
      adId: row.adId,
      adName: row.adName || 'Sem nome',
      campaignName: row.campaignName || 'Sem campanha',
      adsetName: row.adsetName || 'Sem adset',
      status: row.status,
      creativeId: row.creativeId,
      spend: parseFloat(row.spend || '0'),
      impressions: parseInt(row.impressions || '0'),
      clicks: parseInt(row.clicks || '0'),
      ctr: parseFloat(row.ctr || '0'),
      cpc: parseFloat(row.cpc || '0'),
      leads: parseInt(row.leads || '0'),
      won: parseInt(row.won || '0'),
      wonValue: parseFloat(row.wonValue || '0'),
      roas: parseFloat(row.roas || '0'),
      conversionRate: parseFloat(row.conversionRate || '0')
    }));
  }

  async getCreativePerformance(startDate?: string, endDate?: string): Promise<CreativePerformance[]> {
    // NOTE: Creative-level CRM conversions are intentionally zeroed because crm_deal table
    // lacks utm_content field (ad_id tracking). Only campaign/adset-level conversions
    // are tracked via utm_campaign and utm_term respectively.
    const result = await db.execute(sql`
      SELECT 
        cr.creative_id as "creativeId",
        cr.creative_name as "creativeName",
        cr.object_type as "objectType",
        cr.title,
        cr.image_url as "imageUrl",
        cr.video_url as "videoUrl",
        COUNT(DISTINCT a.ad_id)::bigint as "totalAds",
        COALESCE(SUM(mi.spend), 0)::numeric as spend,
        COALESCE(SUM(mi.impressions), 0)::bigint as impressions,
        COALESCE(SUM(mi.clicks), 0)::bigint as clicks,
        CASE 
          WHEN COALESCE(SUM(mi.impressions), 0) > 0 THEN (COALESCE(SUM(mi.clicks), 0)::numeric / COALESCE(SUM(mi.impressions), 1)::numeric * 100)
          ELSE 0 
        END as ctr,
        COALESCE(SUM(mi.video_p25_watched_actions), 0)::bigint as "videoP25",
        COALESCE(SUM(mi.video_p50_watched_actions), 0)::bigint as "videoP50",
        COALESCE(SUM(mi.video_p75_watched_actions), 0)::bigint as "videoP75",
        COALESCE(SUM(mi.video_p100_watched_actions), 0)::bigint as "videoP100",
        0::bigint as leads,
        0::bigint as won,
        0::numeric as "wonValue",
        0::numeric as roas
      FROM ${schema.metaCreatives} cr
      LEFT JOIN ${schema.metaAds} a ON cr.creative_id = a.creative_id
      LEFT JOIN ${schema.metaInsightsDaily} mi ON a.ad_id = mi.ad_id
      WHERE 1=1
        ${startDate ? sql`AND mi.date_start >= ${startDate}::date` : sql``}
        ${endDate ? sql`AND mi.date_stop <= ${endDate}::date` : sql``}
      GROUP BY cr.creative_id, cr.creative_name, cr.object_type, cr.title, cr.image_url, cr.video_url
      HAVING COALESCE(SUM(mi.spend), 0) > 0 OR COALESCE(SUM(mi.impressions), 0) > 0
      ORDER BY COALESCE(SUM(mi.spend), 0) DESC
    `);

    return result.rows.map((row: any) => ({
      creativeId: row.creativeId,
      creativeName: row.creativeName,
      objectType: row.objectType,
      title: row.title,
      imageUrl: row.imageUrl,
      videoUrl: row.videoUrl,
      totalAds: parseInt(row.totalAds || '0'),
      spend: parseFloat(row.spend || '0'),
      impressions: parseInt(row.impressions || '0'),
      clicks: parseInt(row.clicks || '0'),
      ctr: parseFloat(row.ctr || '0'),
      videoP25: parseInt(row.videoP25 || '0'),
      videoP50: parseInt(row.videoP50 || '0'),
      videoP75: parseInt(row.videoP75 || '0'),
      videoP100: parseInt(row.videoP100 || '0'),
      leads: parseInt(row.leads || '0'),
      won: parseInt(row.won || '0'),
      wonValue: parseFloat(row.wonValue || '0'),
      roas: parseFloat(row.roas || '0')
    }));
  }

  async getConversionFunnel(startDate?: string, endDate?: string, leadFilters?: import("@shared/schema").MetaLeadFilterParams): Promise<ConversionFunnel> {
    const result = await db.execute(sql`
      WITH funnel_data AS (
        SELECT 
          COALESCE(SUM(mi.impressions), 0) as impressions,
          COALESCE(SUM(mi.clicks), 0) as clicks,
          (
            SELECT COUNT(*)
            FROM ${schema.crmDeal}
            WHERE utm_campaign IS NOT NULL
              ${startDate ? sql`AND date_create >= ${startDate}::timestamp` : sql``}
              ${endDate ? sql`AND date_create <= ${endDate}::timestamp` : sql``}
              ${leadFilters?.categoryNames?.length ? sql`AND category_name = ANY(${leadFilters.categoryNames})` : sql``}
              ${leadFilters?.stageNames?.length ? sql`AND stage_name = ANY(${leadFilters.stageNames})` : sql``}
              ${leadFilters?.utmSources?.length ? sql`AND utm_source = ANY(${leadFilters.utmSources})` : sql``}
              ${leadFilters?.utmCampaigns?.length ? sql`AND utm_campaign = ANY(${leadFilters.utmCampaigns})` : sql``}
              ${leadFilters?.utmTerms?.length ? sql`AND utm_term = ANY(${leadFilters.utmTerms})` : sql``}
          ) as leads,
          (
            SELECT COUNT(*)
            FROM ${schema.crmDeal}
            WHERE utm_campaign IS NOT NULL
              AND stage_name = 'Negócio Ganho'
              ${startDate ? sql`AND date_create >= ${startDate}::timestamp` : sql``}
              ${endDate ? sql`AND date_create <= ${endDate}::timestamp` : sql``}
              ${leadFilters?.categoryNames?.length ? sql`AND category_name = ANY(${leadFilters.categoryNames})` : sql``}
              ${leadFilters?.stageNames?.length ? sql`AND stage_name = ANY(${leadFilters.stageNames})` : sql``}
              ${leadFilters?.utmSources?.length ? sql`AND utm_source = ANY(${leadFilters.utmSources})` : sql``}
              ${leadFilters?.utmCampaigns?.length ? sql`AND utm_campaign = ANY(${leadFilters.utmCampaigns})` : sql``}
              ${leadFilters?.utmTerms?.length ? sql`AND utm_term = ANY(${leadFilters.utmTerms})` : sql``}
          ) as won
        FROM ${schema.metaInsightsDaily} mi
        WHERE 1=1
          ${startDate ? sql`AND mi.date_start >= ${startDate}::date` : sql``}
          ${endDate ? sql`AND mi.date_stop <= ${endDate}::date` : sql``}
      )
      SELECT 
        impressions::bigint,
        clicks::bigint,
        leads::bigint,
        won::bigint,
        CASE 
          WHEN impressions > 0 THEN (clicks::numeric / impressions::numeric * 100)
          ELSE 0 
        END as "clickRate",
        CASE 
          WHEN clicks > 0 THEN (leads::numeric / clicks::numeric * 100)
          ELSE 0 
        END as "leadRate",
        CASE 
          WHEN leads > 0 THEN (won::numeric / leads::numeric * 100)
          ELSE 0 
        END as "wonRate"
      FROM funnel_data
    `);

    const row = result.rows[0] as any;
    return {
      impressions: parseInt(row.impressions || '0'),
      clicks: parseInt(row.clicks || '0'),
      leads: parseInt(row.leads || '0'),
      won: parseInt(row.won || '0'),
      clickRate: parseFloat(row.clickRate || '0'),
      leadRate: parseFloat(row.leadRate || '0'),
      wonRate: parseFloat(row.wonRate || '0')
    };
  }

  async getAuditoriaSistemas(filters?: { mesAno?: string; dataInicio?: string; dataFim?: string; squad?: string; apenasDivergentes?: boolean; statusFiltro?: string; threshold?: number }): Promise<import("@shared/schema").AuditoriaSistemas[]> {
    const threshold = filters?.threshold || 5; // 5% padrão
    
    // Determinar período de filtro - processa cada limite independentemente
    let dataInicio: Date | null = null;
    let dataFim: Date | null = null;
    
    if (filters?.mesAno) {
      // Filtro por mês específico: define ambos limites
      const [ano, mes] = filters.mesAno.split('-').map(Number);
      dataInicio = new Date(ano, mes - 1, 1);
      dataFim = new Date(ano, mes, 0, 23, 59, 59);
    } else {
      // Filtros explícitos: aceita um ou ambos
      if (filters?.dataInicio) {
        dataInicio = new Date(filters.dataInicio);
      }
      if (filters?.dataFim) {
        dataFim = new Date(filters.dataFim);
      }
    }
    
    // Conta Azul: filtra data_vencimento
    const whereDataInicioCaz = dataInicio ? sql`caz.data_vencimento >= ${dataInicio.toISOString()}` : sql`1=1`;
    const whereDataFimCaz = dataFim ? sql`caz.data_vencimento <= ${dataFim.toISOString()}` : sql`1=1`;
    
    // ClickUp: contrato está ativo no período se:
    // - data_inicio <= fim do período (ou sem limite superior se dataFim não definido)
    // - data_encerramento IS NULL OU data_encerramento >= início do período (ou sem limite inferior se dataInicio não definido)
    const whereDataInicioCup = dataFim ? sql`cup.data_inicio <= ${dataFim.toISOString()}` : sql`1=1`;
    const whereDataFimCup = dataInicio ? sql`(cup.data_encerramento IS NULL OR cup.data_encerramento >= ${dataInicio.toISOString()})` : sql`1=1`;
    
    // Filtro de squad (ClickUp)
    const whereSquad = filters?.squad ? sql`cup.squad = ${filters.squad}` : sql`1=1`;
    
    const result = await db.execute(sql`
      WITH clickup_agg AS (
        SELECT 
          CASE 
            WHEN REGEXP_REPLACE(COALESCE(cli.cnpj, ''), '[^0-9]', '', 'g') = '' THEN 'SEM_CNPJ'
            ELSE REGEXP_REPLACE(COALESCE(cli.cnpj, ''), '[^0-9]', '', 'g')
          END as cnpj,
          COALESCE(cli.nome, 'Cliente ClickUp') as nome_cliente,
          COUNT(cup.id_subtask)::integer as quantidade_contratos,
          COALESCE(SUM((COALESCE(cup.valorr, 0) + COALESCE(cup.valorp, 0))::numeric), 0) as valor_total
        FROM ${schema.cupContratos} cup
        LEFT JOIN ${schema.cupClientes} cli ON cup.id_task = cli.task_id
        WHERE cup.status IN ('ativo', 'onboarding')
          AND ${whereSquad}
          AND ${whereDataInicioCup}
          AND ${whereDataFimCup}
        GROUP BY 
          CASE 
            WHEN REGEXP_REPLACE(COALESCE(cli.cnpj, ''), '[^0-9]', '', 'g') = '' THEN 'SEM_CNPJ'
            ELSE REGEXP_REPLACE(COALESCE(cli.cnpj, ''), '[^0-9]', '', 'g')
          END,
          cli.nome
      ),
      contaazul_agg AS (
        SELECT 
          CASE 
            WHEN REGEXP_REPLACE(COALESCE(cli.cnpj, ''), '[^0-9]', '', 'g') = '' THEN 'SEM_CNPJ'
            ELSE REGEXP_REPLACE(COALESCE(cli.cnpj, ''), '[^0-9]', '', 'g')
          END as cnpj,
          COALESCE(cli.nome, 'Cliente Conta Azul') as nome_cliente,
          COUNT(caz.id)::integer as quantidade_titulos,
          COALESCE(SUM(caz.total::numeric), 0) as valor_total
        FROM ${schema.cazReceber} caz
        LEFT JOIN ${schema.cazClientes} cli ON caz.cliente_id = cli.ids
        WHERE ${whereDataInicioCaz}
          AND ${whereDataFimCaz}
          AND UPPER(caz.status) IN ('PAGO', 'ACQUITTED', 'PENDING', 'OPEN', 'OVERDUE')
        GROUP BY 
          CASE 
            WHEN REGEXP_REPLACE(COALESCE(cli.cnpj, ''), '[^0-9]', '', 'g') = '' THEN 'SEM_CNPJ'
            ELSE REGEXP_REPLACE(COALESCE(cli.cnpj, ''), '[^0-9]', '', 'g')
          END,
          cli.nome
      ),
      combined AS (
        SELECT 
          COALESCE(cup.cnpj, caz.cnpj, 'SEM_CNPJ') as cnpj,
          COALESCE(cup.nome_cliente, caz.nome_cliente, 'Cliente Desconhecido') as nome_cliente,
          COALESCE(cup.valor_total, 0) as valor_clickup,
          COALESCE(caz.valor_total, 0) as valor_contaazul,
          COALESCE(cup.quantidade_contratos, 0) as quantidade_contratos,
          COALESCE(caz.quantidade_titulos, 0) as quantidade_titulos
        FROM clickup_agg cup
        FULL OUTER JOIN contaazul_agg caz ON cup.cnpj = caz.cnpj
      ),
      calculated AS (
        SELECT 
          cnpj,
          nome_cliente,
          valor_clickup,
          valor_contaazul,
          (valor_contaazul - valor_clickup) as diferenca,
          CASE 
            WHEN valor_clickup > 0 THEN 
              ABS((valor_contaazul - valor_clickup) / valor_clickup * 100)
            WHEN valor_contaazul > 0 AND valor_clickup = 0 THEN 
              ABS((valor_contaazul - valor_clickup) / valor_contaazul * 100)
            ELSE 
              0 
          END as percentual_divergencia,
          quantidade_contratos,
          quantidade_titulos
        FROM combined
      )
      SELECT 
        cnpj,
        nome_cliente,
        valor_clickup,
        valor_contaazul,
        diferenca,
        percentual_divergencia,
        CASE 
          WHEN percentual_divergencia <= ${threshold} THEN 'ok'
          WHEN percentual_divergencia <= 20 THEN 'alerta'
          ELSE 'critico'
        END as status,
        quantidade_contratos,
        quantidade_titulos
      FROM calculated
      WHERE 1=1
        ${filters?.apenasDivergentes 
          ? sql`AND percentual_divergencia > ${threshold}` 
          : sql``
        }
        ${filters?.statusFiltro === 'ok'
          ? sql`AND percentual_divergencia <= ${threshold}`
          : filters?.statusFiltro === 'alerta'
          ? sql`AND percentual_divergencia > ${threshold} AND percentual_divergencia <= 20`
          : filters?.statusFiltro === 'critico'
          ? sql`AND percentual_divergencia > 20`
          : sql``
        }
      ORDER BY percentual_divergencia DESC
    `);
    
    return result.rows.map((row: any) => ({
      cnpj: row.cnpj || '',
      nomeCliente: row.nome_cliente || 'Cliente Desconhecido',
      valorClickUp: parseFloat(row.valor_clickup || '0'),
      valorContaAzul: parseFloat(row.valor_contaazul || '0'),
      diferenca: parseFloat(row.diferenca || '0'),
      percentualDivergencia: parseFloat(row.percentual_divergencia || '0'),
      status: row.status || 'critico',
      quantidadeContratosClickUp: parseInt(row.quantidade_contratos || '0'),
      quantidadeTitulosContaAzul: parseInt(row.quantidade_titulos || '0'),
    }));
  }

  private calcularPeriodo(periodo: string): { dataInicio: string; dataFim: string } {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    
    let dataInicio: Date;
    let dataFim: Date = hoje;

    switch(periodo) {
      case 'mes':
        dataInicio = new Date(ano, mes, 1);
        break;
      case 'trimestre':
        dataInicio = new Date(ano, mes - 3, 1);
        break;
      case 'semestre':
        dataInicio = new Date(ano, mes - 6, 1);
        break;
      case 'ano':
        dataInicio = new Date(ano, 0, 1);
        break;
      default:
        dataInicio = new Date(ano, mes - 3, 1);
    }

    return {
      dataInicio: dataInicio.toISOString().split('T')[0],
      dataFim: dataFim.toISOString().split('T')[0],
    };
  }

  async getFinanceiroResumo(mesAno?: string): Promise<any> {
    const hoje = new Date();
    let mesAtual: string;
    let mesAnterior: string;
    
    if (mesAno) {
      mesAtual = mesAno;
      const [ano, mes] = mesAno.split('-').map(Number);
      const dataAnterior = new Date(ano, mes - 2, 1);
      mesAnterior = `${dataAnterior.getFullYear()}-${String(dataAnterior.getMonth() + 1).padStart(2, '0')}`;
    } else {
      mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const dataAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      mesAnterior = `${dataAnterior.getFullYear()}-${String(dataAnterior.getMonth() + 1).padStart(2, '0')}`;
    }

    const result = await db.execute(sql`
      WITH mes_atual AS (
        SELECT 
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as receita,
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as despesa,
          COUNT(*) as total_parcelas,
          COUNT(CASE WHEN status = 'QUITADO' THEN 1 END) as parcelas_pagas,
          COUNT(CASE WHEN status != 'QUITADO' THEN 1 END) as parcelas_pendentes
        FROM caz_parcelas
        WHERE TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') = ${mesAtual}
          AND tipo_evento IN ('RECEITA', 'DESPESA')
      ),
      mes_anterior AS (
        SELECT 
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as receita,
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as despesa
        FROM caz_parcelas
        WHERE TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') = ${mesAnterior}
          AND tipo_evento IN ('RECEITA', 'DESPESA')
          AND status = 'QUITADO'
      )
      SELECT 
        ma.receita as receita_atual,
        ma.despesa as despesa_atual,
        ma.total_parcelas,
        ma.parcelas_pagas,
        ma.parcelas_pendentes,
        ant.receita as receita_anterior,
        ant.despesa as despesa_anterior
      FROM mes_atual ma, mes_anterior ant
    `);

    const row = result.rows[0] as any;
    const receitaAtual = parseFloat(row?.receita_atual || '0');
    const despesaAtual = parseFloat(row?.despesa_atual || '0');
    const receitaAnterior = parseFloat(row?.receita_anterior || '0');
    const despesaAnterior = parseFloat(row?.despesa_anterior || '0');
    
    return {
      receitaTotal: receitaAtual,
      despesaTotal: despesaAtual,
      resultado: receitaAtual - despesaAtual,
      margemOperacional: receitaAtual > 0 ? ((receitaAtual - despesaAtual) / receitaAtual) * 100 : 0,
      receitaMesAnterior: receitaAnterior,
      despesaMesAnterior: despesaAnterior,
      variacaoReceita: receitaAnterior > 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0,
      variacaoDespesa: despesaAnterior > 0 ? ((despesaAtual - despesaAnterior) / despesaAnterior) * 100 : 0,
      totalParcelas: parseInt(row?.total_parcelas || '0'),
      parcelasPagas: parseInt(row?.parcelas_pagas || '0'),
      parcelasPendentes: parseInt(row?.parcelas_pendentes || '0'),
    };
  }

  async getFinanceiroEvolucaoMensal(meses: number = 12): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as mes,
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as receita,
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as despesa
      FROM caz_parcelas
      WHERE COALESCE(data_quitacao, data_vencimento) >= NOW() - INTERVAL '1 month' * ${meses}
        AND tipo_evento IN ('RECEITA', 'DESPESA')
        AND status = 'QUITADO'
      GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
      ORDER BY mes
    `);

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    return (result.rows as any[]).map(row => {
      const receita = parseFloat(row.receita || '0');
      const despesa = parseFloat(row.despesa || '0');
      const [ano, mes] = (row.mes || '').split('-');
      const mesIndex = parseInt(mes) - 1;
      
      return {
        mes: row.mes,
        mesLabel: `${mesesNomes[mesIndex] || mes}/${ano?.slice(2)}`,
        receita,
        despesa,
        resultado: receita - despesa,
        margemPercentual: receita > 0 ? ((receita - despesa) / receita) * 100 : 0,
      };
    });
  }

  async getFinanceiroCategorias(tipo: 'RECEITA' | 'DESPESA' | 'AMBOS' = 'AMBOS', meses: number = 6): Promise<any[]> {
    const tipoFilter = tipo === 'AMBOS' 
      ? sql`tipo_evento IN ('RECEITA', 'DESPESA')` 
      : sql`tipo_evento = ${tipo}`;

    const result = await db.execute(sql`
      SELECT 
        categoria_id,
        categoria_nome,
        tipo_evento,
        COALESCE(SUM(valor_pago::numeric), 0) as valor,
        COUNT(*) as quantidade
      FROM caz_parcelas
      WHERE COALESCE(data_quitacao, data_vencimento) >= NOW() - INTERVAL '1 month' * ${meses}
        AND ${tipoFilter}
        AND status = 'QUITADO'
        AND categoria_id IS NOT NULL
        AND categoria_id != ''
      GROUP BY categoria_id, categoria_nome, tipo_evento
      ORDER BY valor DESC
      LIMIT 20
    `);

    const totalReceita = (result.rows as any[])
      .filter(r => r.tipo_evento === 'RECEITA')
      .reduce((sum, r) => sum + parseFloat(r.valor || '0'), 0);
    const totalDespesa = (result.rows as any[])
      .filter(r => r.tipo_evento === 'DESPESA')
      .reduce((sum, r) => sum + parseFloat(r.valor || '0'), 0);

    return (result.rows as any[]).map(row => {
      const valor = parseFloat(row.valor || '0');
      const total = row.tipo_evento === 'RECEITA' ? totalReceita : totalDespesa;
      
      return {
        categoriaId: row.categoria_id || '',
        categoriaNome: row.categoria_nome || 'Sem categoria',
        tipo: row.tipo_evento,
        valor,
        percentual: total > 0 ? (valor / total) * 100 : 0,
        quantidade: parseInt(row.quantidade || '0'),
      };
    });
  }

  async getFinanceiroTopClientes(limite: number = 10, meses: number = 12): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        cliente_id,
        cliente_nome,
        COALESCE(SUM(pago::numeric), 0) as receita_total,
        COUNT(*) as quantidade_titulos,
        MAX(data_vencimento) as ultimo_pagamento
      FROM caz_receber
      WHERE UPPER(status) IN ('PAGO', 'ACQUITTED')
        AND cliente_id IS NOT NULL
        AND data_vencimento >= NOW() - INTERVAL '1 month' * ${meses}
      GROUP BY cliente_id, cliente_nome
      ORDER BY receita_total DESC
      LIMIT ${limite}
    `);

    return (result.rows as any[]).map(row => {
      const receitaTotal = parseFloat(row.receita_total || '0');
      const quantidade = parseInt(row.quantidade_titulos || '1');
      
      return {
        clienteId: row.cliente_id || '',
        clienteNome: row.cliente_nome || 'Cliente Desconhecido',
        receitaTotal,
        quantidadeTitulos: quantidade,
        ticketMedio: quantidade > 0 ? receitaTotal / quantidade : 0,
        ultimoPagamento: row.ultimo_pagamento ? new Date(row.ultimo_pagamento).toISOString().split('T')[0] : null,
      };
    });
  }

  async getFinanceiroMetodosPagamento(meses: number = 6): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(metodo_pagamento, 'Não informado') as metodo,
        COALESCE(SUM(valor_pago::numeric), 0) as valor,
        COUNT(*) as quantidade
      FROM caz_parcelas
      WHERE COALESCE(data_quitacao, data_vencimento) >= NOW() - INTERVAL '1 month' * ${meses}
        AND status = 'QUITADO'
        AND tipo_evento = 'RECEITA'
      GROUP BY metodo_pagamento
      ORDER BY valor DESC
    `);

    const total = (result.rows as any[]).reduce((sum, r) => sum + parseFloat(r.valor || '0'), 0);

    return (result.rows as any[]).map(row => {
      const valor = parseFloat(row.valor || '0');
      return {
        metodo: row.metodo || 'Não informado',
        valor,
        quantidade: parseInt(row.quantidade || '0'),
        percentual: total > 0 ? (valor / total) * 100 : 0,
      };
    });
  }

  async getFinanceiroContasBancarias(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        uuid::text as id,
        nmbanco as nome,
        COALESCE(balance::numeric, 0) as saldo,
        empresa
      FROM caz_bancos
      WHERE ativo = true
      ORDER BY balance::numeric DESC
    `);

    return (result.rows as any[]).map(row => ({
      id: row.id || '',
      nome: row.nome || 'Conta Desconhecida',
      saldo: parseFloat(row.saldo || '0'),
      empresa: row.empresa || '',
    }));
  }

  async getFinanceiroKPIsCompletos(): Promise<any> {
    const result = await db.execute(sql`
      WITH saldo_bancos AS (
        SELECT COALESCE(SUM(balance::numeric), 0) as saldo_total
        FROM caz_bancos
        WHERE ativo = true
      ),
      a_receber AS (
        SELECT 
          COALESCE(SUM(nao_pago::numeric), 0) as total_aberto,
          COUNT(*) as qtd_titulos,
          COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as qtd_vencidos,
          COALESCE(SUM(CASE WHEN status = 'OVERDUE' THEN nao_pago::numeric ELSE 0 END), 0) as valor_vencido
        FROM caz_receber
        WHERE status != 'ACQUITTED' AND nao_pago::numeric > 0
      ),
      a_pagar AS (
        SELECT 
          COALESCE(SUM(nao_pago::numeric), 0) as total_aberto,
          COUNT(*) as qtd_titulos,
          COUNT(CASE WHEN data_vencimento < CURRENT_DATE THEN 1 END) as qtd_vencidos,
          COALESCE(SUM(CASE WHEN data_vencimento < CURRENT_DATE THEN nao_pago::numeric ELSE 0 END), 0) as valor_vencido
        FROM caz_pagar
        WHERE status != 'ACQUITTED' AND nao_pago::numeric > 0
      ),
      fluxo_mes_atual AS (
        SELECT 
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as despesas
        FROM caz_parcelas
        WHERE TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
          AND status = 'QUITADO'
      ),
      fluxo_mes_anterior AS (
        SELECT 
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as despesas
        FROM caz_parcelas
        WHERE TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') = TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM')
          AND status = 'QUITADO'
      )
      SELECT 
        sb.saldo_total,
        ar.total_aberto as a_receber_total,
        ar.qtd_titulos as a_receber_qtd,
        ar.qtd_vencidos as a_receber_vencidos_qtd,
        ar.valor_vencido as a_receber_vencido_valor,
        ap.total_aberto as a_pagar_total,
        ap.qtd_titulos as a_pagar_qtd,
        ap.qtd_vencidos as a_pagar_vencidos_qtd,
        ap.valor_vencido as a_pagar_vencido_valor,
        fma.receitas as receita_mes_atual,
        fma.despesas as despesa_mes_atual,
        fmant.receitas as receita_mes_anterior,
        fmant.despesas as despesa_mes_anterior
      FROM saldo_bancos sb, a_receber ar, a_pagar ap, fluxo_mes_atual fma, fluxo_mes_anterior fmant
    `);

    const row = result.rows[0] as any;
    const saldoTotal = parseFloat(row?.saldo_total || '0');
    const aReceberTotal = parseFloat(row?.a_receber_total || '0');
    const aPagarTotal = parseFloat(row?.a_pagar_total || '0');
    const receitaMesAtual = parseFloat(row?.receita_mes_atual || '0');
    const despesaMesAtual = parseFloat(row?.despesa_mes_atual || '0');
    const receitaMesAnterior = parseFloat(row?.receita_mes_anterior || '0');
    const despesaMesAnterior = parseFloat(row?.despesa_mes_anterior || '0');
    
    const variacaoReceita = receitaMesAnterior > 0 
      ? ((receitaMesAtual - receitaMesAnterior) / receitaMesAnterior) * 100 
      : (receitaMesAtual > 0 ? 100 : 0);
    const variacaoDespesa = despesaMesAnterior > 0 
      ? ((despesaMesAtual - despesaMesAnterior) / despesaMesAnterior) * 100 
      : (despesaMesAtual > 0 ? 100 : 0);
    
    return {
      saldoTotal,
      aReceberTotal,
      aReceberQtd: parseInt(row?.a_receber_qtd || '0'),
      aReceberVencidoValor: parseFloat(row?.a_receber_vencido_valor || '0'),
      aReceberVencidoQtd: parseInt(row?.a_receber_vencidos_qtd || '0'),
      aPagarTotal,
      aPagarQtd: parseInt(row?.a_pagar_qtd || '0'),
      aPagarVencidoValor: parseFloat(row?.a_pagar_vencido_valor || '0'),
      aPagarVencidoQtd: parseInt(row?.a_pagar_vencidos_qtd || '0'),
      receitaMesAtual,
      despesaMesAtual,
      resultadoMesAtual: receitaMesAtual - despesaMesAtual,
      margemMesAtual: receitaMesAtual > 0 ? ((receitaMesAtual - despesaMesAtual) / receitaMesAtual) * 100 : 0,
      receitaMesAnterior,
      despesaMesAnterior,
      variacaoReceita,
      variacaoDespesa,
      saldoProjetado: saldoTotal + aReceberTotal - aPagarTotal,
      taxaInadimplencia: aReceberTotal > 0 ? (parseFloat(row?.a_receber_vencido_valor || '0') / aReceberTotal) * 100 : 0,
    };
  }

  async getFinanceiroFluxoProximosDias(dias: number = 30): Promise<any[]> {
    const result = await db.execute(sql`
      WITH receber AS (
        SELECT 
          data_vencimento::date as data,
          'RECEITA' as tipo,
          COALESCE(SUM(nao_pago::numeric), 0) as valor
        FROM caz_receber
        WHERE status != 'ACQUITTED' 
          AND nao_pago::numeric > 0
          AND data_vencimento >= CURRENT_DATE
          AND data_vencimento <= CURRENT_DATE + (${dias}::integer || ' days')::interval
        GROUP BY data_vencimento::date
      ),
      pagar AS (
        SELECT 
          data_vencimento::date as data,
          'DESPESA' as tipo,
          COALESCE(SUM(nao_pago::numeric), 0) as valor
        FROM caz_pagar
        WHERE status != 'ACQUITTED' 
          AND nao_pago::numeric > 0
          AND data_vencimento >= CURRENT_DATE
          AND data_vencimento <= CURRENT_DATE + (${dias}::integer || ' days')::interval
        GROUP BY data_vencimento::date
      )
      SELECT * FROM receber
      UNION ALL
      SELECT * FROM pagar
      ORDER BY data, tipo
    `);

    return (result.rows as any[]).map(row => ({
      data: row.data,
      tipo: row.tipo,
      valor: parseFloat(row.valor || '0'),
    }));
  }

  async getRecrutamentoKPIs(): Promise<import("@shared/schema").RecrutamentoKPIs> {
    const result = await db.execute(sql`
      WITH candidaturas_stats AS (
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN talent_status = 'active' THEN 1 END) as ativos,
          COUNT(CASE WHEN talent_status = 'rejected' THEN 1 END) as rejeitados,
          COUNT(CASE WHEN talent_status = 'declined' THEN 1 END) as declinados,
          COUNT(CASE WHEN source = 'manual' THEN 1 END) as hunting,
          COUNT(CASE WHEN source != 'manual' THEN 1 END) as passivo,
          COUNT(CASE WHEN stage_name = 'Oferta' THEN 1 END) as ofertas
        FROM rh_candidaturas
      ),
      vagas_stats AS (
        SELECT
          COUNT(CASE WHEN status = 'open' THEN 1 END) as abertas,
          COUNT(CASE WHEN status = 'paused' THEN 1 END) as pausadas,
          COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceladas
        FROM rh_vagas
      )
      SELECT 
        cs.total::int as "totalCandidaturas",
        cs.ativos::int as "candidatosAtivos",
        cs.rejeitados::int as "candidatosRejeitados",
        cs.declinados::int as "candidatosDeclinados",
        vs.abertas::int as "vagasAbertas",
        vs.pausadas::int as "vagasPausadas",
        vs.canceladas::int as "vagasCanceladas",
        CASE WHEN cs.total > 0 THEN (cs.ofertas::float / cs.total::float * 100) ELSE 0 END as "taxaConversaoGeral",
        0 as "tempoMedioContratacao",
        cs.hunting::int as "huntingTotal",
        cs.passivo::int as "passivoTotal"
      FROM candidaturas_stats cs, vagas_stats vs
    `);

    const row = result.rows[0] as any;
    return {
      totalCandidaturas: parseInt(row.totalCandidaturas || '0'),
      candidatosAtivos: parseInt(row.candidatosAtivos || '0'),
      candidatosRejeitados: parseInt(row.candidatosRejeitados || '0'),
      candidatosDeclinados: parseInt(row.candidatosDeclinados || '0'),
      vagasAbertas: parseInt(row.vagasAbertas || '0'),
      vagasPausadas: parseInt(row.vagasPausadas || '0'),
      vagasCanceladas: parseInt(row.vagasCanceladas || '0'),
      taxaConversaoGeral: parseFloat(row.taxaConversaoGeral || '0'),
      tempoMedioContratacao: parseFloat(row.tempoMedioContratacao || '0'),
      huntingTotal: parseInt(row.huntingTotal || '0'),
      passivoTotal: parseInt(row.passivoTotal || '0'),
    };
  }

  async getRecrutamentoFunil(): Promise<import("@shared/schema").RecrutamentoFunilEtapa[]> {
    const etapasOrdem: Record<string, number> = {
      'Inscrição': 1,
      'Triagem': 2,
      'Entrevista R&S': 3,
      'Teste tecnico': 4,
      'Entrevista técnica': 5,
      'Entrevista final': 6,
      'Oferta': 7,
    };

    const result = await db.execute(sql`
      SELECT 
        stage_name as etapa,
        COUNT(*) as total
      FROM rh_candidaturas
      WHERE stage_name IS NOT NULL
      GROUP BY stage_name
      ORDER BY COUNT(*) DESC
    `);

    const rows = result.rows as any[];
    const totalGeral = rows.reduce((sum, r) => sum + parseInt(r.total || '0'), 0);
    
    const sortedRows = rows
      .map(row => ({
        etapa: row.etapa,
        ordem: etapasOrdem[row.etapa] || 99,
        total: parseInt(row.total || '0'),
      }))
      .sort((a, b) => a.ordem - b.ordem);

    return sortedRows.map((row, index) => {
      const anteriorTotal = index > 0 ? sortedRows[index - 1].total : totalGeral;
      return {
        etapa: row.etapa,
        ordem: row.ordem,
        total: row.total,
        percentual: totalGeral > 0 ? (row.total / totalGeral) * 100 : 0,
        conversaoAnterior: anteriorTotal > 0 ? (row.total / anteriorTotal) * 100 : 0,
      };
    });
  }

  async getRecrutamentoFontes(): Promise<import("@shared/schema").RecrutamentoFonteDistribuicao[]> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(source, 'Não informado') as fonte,
        COUNT(*) as total,
        COUNT(CASE WHEN talent_status = 'active' THEN 1 END) as ativos,
        COUNT(CASE WHEN talent_status = 'rejected' THEN 1 END) as rejeitados,
        COUNT(CASE WHEN talent_status = 'declined' THEN 1 END) as declinados
      FROM rh_candidaturas
      GROUP BY source
      ORDER BY total DESC
    `);

    const rows = result.rows as any[];
    const totalGeral = rows.reduce((sum, r) => sum + parseInt(r.total || '0'), 0);

    return rows.map(row => ({
      fonte: row.fonte || 'Não informado',
      total: parseInt(row.total || '0'),
      percentual: totalGeral > 0 ? (parseInt(row.total || '0') / totalGeral) * 100 : 0,
      ativos: parseInt(row.ativos || '0'),
      rejeitados: parseInt(row.rejeitados || '0'),
      declinados: parseInt(row.declinados || '0'),
    }));
  }

  async getRecrutamentoEvolucao(meses: number = 6): Promise<import("@shared/schema").RecrutamentoEvolucaoMensal[]> {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(inserted_at, 'YYYY-MM') as mes,
        COUNT(*) as total,
        COUNT(CASE WHEN source = 'manual' THEN 1 END) as hunting,
        COUNT(CASE WHEN source != 'manual' THEN 1 END) as passivo,
        COUNT(CASE WHEN stage_name = 'Oferta' THEN 1 END) as aprovados,
        COUNT(CASE WHEN talent_status = 'rejected' THEN 1 END) as rejeitados
      FROM rh_candidaturas
      WHERE inserted_at >= NOW() - INTERVAL '1 month' * ${meses}
      GROUP BY TO_CHAR(inserted_at, 'YYYY-MM')
      ORDER BY mes
    `);

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return (result.rows as any[]).map(row => {
      const [ano, mesNum] = row.mes.split('-');
      return {
        mes: row.mes,
        mesLabel: `${mesesNomes[parseInt(mesNum) - 1]}/${ano.slice(2)}`,
        totalCandidaturas: parseInt(row.total || '0'),
        hunting: parseInt(row.hunting || '0'),
        passivo: parseInt(row.passivo || '0'),
        aprovados: parseInt(row.aprovados || '0'),
        rejeitados: parseInt(row.rejeitados || '0'),
      };
    });
  }

  async getRecrutamentoVagas(filters?: { area?: string; status?: string }): Promise<import("@shared/schema").RecrutamentoVagaDetalhe[]> {
    const result = await db.execute(sql`
      SELECT 
        v.id as vaga_id,
        v.nome as vaga_nome,
        v.area,
        v.seniority,
        v.status,
        COUNT(c.id) as total_candidatos,
        COUNT(CASE WHEN c.talent_status = 'active' THEN 1 END) as candidatos_ativos,
        COUNT(CASE WHEN c.stage_name = 'Inscrição' THEN 1 END) as inscricao,
        COUNT(CASE WHEN c.stage_name = 'Triagem' THEN 1 END) as triagem,
        COUNT(CASE WHEN c.stage_name = 'Entrevista R&S' THEN 1 END) as entrevista_rs,
        COUNT(CASE WHEN c.stage_name = 'Entrevista técnica' THEN 1 END) as entrevista_tecnica,
        COUNT(CASE WHEN c.stage_name = 'Entrevista final' THEN 1 END) as entrevista_final,
        COUNT(CASE WHEN c.stage_name = 'Oferta' THEN 1 END) as oferta,
        json_agg(DISTINCT c.source) FILTER (WHERE c.source IS NOT NULL) as fontes
      FROM rh_vagas v
      LEFT JOIN rh_candidaturas c ON c.job_id_hash::bigint = v.id
      WHERE 1=1
        ${filters?.area && filters.area !== 'todos' ? sql`AND v.area = ${filters.area}` : sql``}
        ${filters?.status && filters.status !== 'todos' ? sql`AND v.status = ${filters.status}` : sql``}
      GROUP BY v.id, v.nome, v.area, v.seniority, v.status
      ORDER BY total_candidatos DESC
    `);

    return (result.rows as any[]).map(row => {
      const total = parseInt(row.total_candidatos || '0');
      const oferta = parseInt(row.oferta || '0');
      const inscricao = parseInt(row.inscricao || '0');
      const triagem = parseInt(row.triagem || '0');
      const entrevistaRS = parseInt(row.entrevista_rs || '0');
      const entrevistaTecnica = parseInt(row.entrevista_tecnica || '0');
      const entrevistaFinal = parseInt(row.entrevista_final || '0');

      const etapas = [
        { etapa: 'Inscrição', total: inscricao, percentual: total > 0 ? (inscricao / total) * 100 : 0 },
        { etapa: 'Triagem', total: triagem, percentual: total > 0 ? (triagem / total) * 100 : 0 },
        { etapa: 'Entrevista R&S', total: entrevistaRS, percentual: total > 0 ? (entrevistaRS / total) * 100 : 0 },
        { etapa: 'Entrevista técnica', total: entrevistaTecnica, percentual: total > 0 ? (entrevistaTecnica / total) * 100 : 0 },
        { etapa: 'Entrevista final', total: entrevistaFinal, percentual: total > 0 ? (entrevistaFinal / total) * 100 : 0 },
        { etapa: 'Oferta', total: oferta, percentual: total > 0 ? (oferta / total) * 100 : 0 },
      ];

      const fontesArray = row.fontes || [];
      const fontes = Array.isArray(fontesArray) 
        ? fontesArray.filter((f: any) => f).map((f: any) => ({ fonte: f, total: 1 }))
        : [];

      return {
        vagaId: parseInt(row.vaga_id),
        vagaNome: row.vaga_nome || 'Vaga sem nome',
        area: row.area,
        seniority: row.seniority,
        status: row.status || 'unknown',
        totalCandidatos: total,
        candidatosAtivos: parseInt(row.candidatos_ativos || '0'),
        etapas,
        fontes,
        conversaoOferta: total > 0 ? (oferta / total) * 100 : 0,
      };
    });
  }

  async getRecrutamentoAreas(): Promise<import("@shared/schema").RecrutamentoAreaDistribuicao[]> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(v.area, 'Não informada') as area,
        COUNT(DISTINCT v.id) as total_vagas,
        COUNT(DISTINCT CASE WHEN v.status = 'open' THEN v.id END) as vagas_abertas,
        COUNT(c.id) as total_candidatos,
        CASE 
          WHEN COUNT(c.id) > 0 THEN 
            (COUNT(CASE WHEN c.stage_name = 'Oferta' THEN 1 END)::float / COUNT(c.id)::float * 100)
          ELSE 0 
        END as conversao_media
      FROM rh_vagas v
      LEFT JOIN rh_candidaturas c ON c.job_id_hash::bigint = v.id
      GROUP BY v.area
      ORDER BY total_candidatos DESC
    `);

    return (result.rows as any[]).map(row => ({
      area: row.area || 'Não informada',
      totalVagas: parseInt(row.total_vagas || '0'),
      vagasAbertas: parseInt(row.vagas_abertas || '0'),
      totalCandidatos: parseInt(row.total_candidatos || '0'),
      conversaoMedia: parseFloat(row.conversao_media || '0'),
    }));
  }

  async getRecrutamentoFiltros(): Promise<import("@shared/schema").RecrutamentoFiltros> {
    const areasResult = await db.execute(sql`
      SELECT DISTINCT area FROM rh_vagas WHERE area IS NOT NULL ORDER BY area
    `);
    const senioritiesResult = await db.execute(sql`
      SELECT DISTINCT seniority FROM rh_vagas WHERE seniority IS NOT NULL ORDER BY seniority
    `);
    const fontesResult = await db.execute(sql`
      SELECT DISTINCT source FROM rh_candidaturas WHERE source IS NOT NULL ORDER BY source
    `);
    const statusResult = await db.execute(sql`
      SELECT DISTINCT status FROM rh_vagas WHERE status IS NOT NULL ORDER BY status
    `);
    const etapasResult = await db.execute(sql`
      SELECT DISTINCT stage_name FROM rh_candidaturas WHERE stage_name IS NOT NULL ORDER BY stage_name
    `);

    return {
      areas: (areasResult.rows as any[]).map(r => r.area),
      seniorities: (senioritiesResult.rows as any[]).map(r => r.seniority),
      fontes: (fontesResult.rows as any[]).map(r => r.source),
      statusVagas: (statusResult.rows as any[]).map(r => r.status),
      etapas: (etapasResult.rows as any[]).map(r => r.stage_name),
    };
  }

  async getRecrutamentoConversaoPorVaga(limit: number = 10): Promise<import("@shared/schema").RecrutamentoConversaoPorVaga[]> {
    const result = await db.execute(sql`
      SELECT 
        v.id as vaga_id,
        v.nome as vaga_nome,
        v.area,
        COUNT(CASE WHEN c.stage_name = 'Inscrição' THEN 1 END) as inscricao,
        COUNT(CASE WHEN c.stage_name = 'Triagem' THEN 1 END) as triagem,
        COUNT(CASE WHEN c.stage_name = 'Entrevista R&S' THEN 1 END) as entrevista_rs,
        COUNT(CASE WHEN c.stage_name = 'Entrevista técnica' THEN 1 END) as entrevista_tecnica,
        COUNT(CASE WHEN c.stage_name = 'Entrevista final' THEN 1 END) as entrevista_final,
        COUNT(CASE WHEN c.stage_name = 'Oferta' THEN 1 END) as oferta,
        COUNT(c.id) as total
      FROM rh_vagas v
      LEFT JOIN rh_candidaturas c ON c.job_id_hash::bigint = v.id
      GROUP BY v.id, v.nome, v.area
      HAVING COUNT(c.id) > 0
      ORDER BY total DESC
      LIMIT ${limit}
    `);

    return (result.rows as any[]).map(row => {
      const total = parseInt(row.total || '0');
      const oferta = parseInt(row.oferta || '0');
      return {
        vagaId: parseInt(row.vaga_id),
        vagaNome: row.vaga_nome || 'Vaga sem nome',
        area: row.area,
        inscricao: parseInt(row.inscricao || '0'),
        triagem: parseInt(row.triagem || '0'),
        entrevistaRS: parseInt(row.entrevista_rs || '0'),
        entrevistaTecnica: parseInt(row.entrevista_tecnica || '0'),
        entrevistaFinal: parseInt(row.entrevista_final || '0'),
        oferta,
        taxaConversao: total > 0 ? (oferta / total) * 100 : 0,
      };
    });
  }

  async getRecrutamentoTempoMedioPorEtapa(): Promise<import("@shared/schema").RecrutamentoTempoMedioPorEtapa[]> {
    const etapasOrdem: Record<string, number> = {
      'Inscrição': 1,
      'Triagem': 2,
      'Entrevista R&S': 3,
      'Teste tecnico': 4,
      'Entrevista técnica': 5,
      'Entrevista final': 6,
      'Oferta': 7,
    };

    const result = await db.execute(sql`
      SELECT 
        stage_name as etapa,
        AVG(EXTRACT(EPOCH FROM (updated_at - inserted_at)) / 86400) as tempo_medio_dias,
        COUNT(*) as total_candidatos
      FROM rh_candidaturas
      WHERE stage_name IS NOT NULL
        AND inserted_at IS NOT NULL
        AND updated_at IS NOT NULL
        AND updated_at > inserted_at
      GROUP BY stage_name
      ORDER BY tempo_medio_dias DESC
    `);

    return (result.rows as any[]).map(row => ({
      etapa: row.etapa || 'Não informado',
      tempoMedioDias: parseFloat(row.tempo_medio_dias || '0'),
      totalCandidatos: parseInt(row.total_candidatos || '0'),
      ordem: etapasOrdem[row.etapa] || 99,
    })).sort((a, b) => a.ordem - b.ordem);
  }

  async getRecrutamentoEntrevistasRealizadas(): Promise<import("@shared/schema").RecrutamentoEntrevistasRealizadas> {
    const result = await db.execute(sql`
      WITH entrevistas AS (
        SELECT 
          COUNT(CASE WHEN stage_name = 'Entrevista R&S' THEN 1 END) as entrevista_rs,
          COUNT(CASE WHEN stage_name = 'Entrevista técnica' THEN 1 END) as entrevista_tecnica,
          COUNT(CASE WHEN stage_name = 'Entrevista final' THEN 1 END) as entrevista_final
        FROM rh_candidaturas
        WHERE stage_name IN ('Entrevista R&S', 'Entrevista técnica', 'Entrevista final')
      ),
      vagas_com_entrevistas AS (
        SELECT COUNT(DISTINCT v.id) as total_vagas
        FROM rh_vagas v
        INNER JOIN rh_candidaturas c ON c.job_id_hash::bigint = v.id
        WHERE c.stage_name IN ('Entrevista R&S', 'Entrevista técnica', 'Entrevista final')
      )
      SELECT 
        e.entrevista_rs,
        e.entrevista_tecnica,
        e.entrevista_final,
        (e.entrevista_rs + e.entrevista_tecnica + e.entrevista_final) as total_entrevistas,
        vce.total_vagas
      FROM entrevistas e, vagas_com_entrevistas vce
    `);

    const row = result.rows[0] as any;
    const totalEntrevistas = parseInt(row.total_entrevistas || '0');
    const totalVagas = parseInt(row.total_vagas || '1');

    return {
      totalEntrevistas,
      entrevistaRS: parseInt(row.entrevista_rs || '0'),
      entrevistaTecnica: parseInt(row.entrevista_tecnica || '0'),
      entrevistaFinal: parseInt(row.entrevista_final || '0'),
      mediaEntrevistasPorVaga: totalVagas > 0 ? totalEntrevistas / totalVagas : 0,
    };
  }

  async getRecrutamentoEntrevistasPorCargo(): Promise<import("@shared/schema").RecrutamentoEntrevistasPorCargo[]> {
    const result = await db.execute(sql`
      WITH entrevistas_por_cargo AS (
        SELECT 
          v.nome as cargo,
          v.area,
          COUNT(CASE WHEN c.stage_name = 'Entrevista R&S' THEN 1 END) as entrevista_rs,
          COUNT(CASE WHEN c.stage_name = 'Entrevista técnica' THEN 1 END) as entrevista_tecnica,
          COUNT(CASE WHEN c.stage_name = 'Entrevista final' THEN 1 END) as entrevista_final
        FROM rh_vagas v
        INNER JOIN rh_candidaturas c ON c.job_id_hash::bigint = v.id
        WHERE c.stage_name IN ('Entrevista R&S', 'Entrevista técnica', 'Entrevista final')
        GROUP BY v.nome, v.area
      )
      SELECT 
        cargo,
        area,
        entrevista_rs,
        entrevista_tecnica,
        entrevista_final,
        (entrevista_rs + entrevista_tecnica + entrevista_final) as total_entrevistas
      FROM entrevistas_por_cargo
      ORDER BY total_entrevistas DESC
    `);

    const rows = result.rows as any[];
    const totalGeral = rows.reduce((sum, r) => sum + parseInt(r.total_entrevistas || '0'), 0);

    return rows.map(row => ({
      cargo: row.cargo || 'Cargo não informado',
      area: row.area,
      totalEntrevistas: parseInt(row.total_entrevistas || '0'),
      entrevistaRS: parseInt(row.entrevista_rs || '0'),
      entrevistaTecnica: parseInt(row.entrevista_tecnica || '0'),
      entrevistaFinal: parseInt(row.entrevista_final || '0'),
      percentual: totalGeral > 0 ? (parseInt(row.total_entrevistas || '0') / totalGeral) * 100 : 0,
    }));
  }

  async getRecrutamentoCandidaturasPorArea(): Promise<import("@shared/schema").RecrutamentoCandidaturasPorArea[]> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(v.area, 'Área não informada') as area,
        COUNT(c.id) as total_candidaturas,
        COUNT(CASE WHEN c.talent_status = 'active' THEN 1 END) as candidatos_ativos,
        COUNT(CASE WHEN c.talent_status = 'rejected' THEN 1 END) as candidatos_rejeitados,
        COUNT(DISTINCT CASE WHEN v.status = 'open' THEN v.id END) as vagas_abertas
      FROM rh_vagas v
      LEFT JOIN rh_candidaturas c ON c.job_id_hash::bigint = v.id
      GROUP BY v.area
      ORDER BY total_candidaturas DESC
    `);

    const rows = result.rows as any[];
    const totalGeral = rows.reduce((sum, r) => sum + parseInt(r.total_candidaturas || '0'), 0);

    return rows.map(row => ({
      area: row.area || 'Área não informada',
      totalCandidaturas: parseInt(row.total_candidaturas || '0'),
      candidatosAtivos: parseInt(row.candidatos_ativos || '0'),
      candidatosRejeitados: parseInt(row.candidatos_rejeitados || '0'),
      percentual: totalGeral > 0 ? (parseInt(row.total_candidaturas || '0') / totalGeral) * 100 : 0,
      vagasAbertas: parseInt(row.vagas_abertas || '0'),
    }));
  }

  // Tech Dashboard - DatabaseStorage implementations
  async getTechMetricas(): Promise<TechMetricas> {
    const [projetosAtivos, projetosFechados, tasks] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count, COALESCE(SUM(valor_p), 0) as valor_total FROM staging.cup_projetos_tech`),
      db.execute(sql`SELECT COUNT(*) as count, COALESCE(SUM(valor_p), 0) as valor_total FROM staging.cup_projetos_tech_fechados`),
      db.execute(sql`SELECT COUNT(*) as count FROM staging.cup_tech_tasks`)
    ]);

    const projetosEmAndamento = parseInt((projetosAtivos.rows[0] as any).count || '0');
    const totalFechados = parseInt((projetosFechados.rows[0] as any).count || '0');
    const valorAtivos = parseFloat((projetosAtivos.rows[0] as any).valor_total || '0');
    const valorFechados = parseFloat((projetosFechados.rows[0] as any).valor_total || '0');
    const totalTasks = parseInt((tasks.rows[0] as any).count || '0');
    const valorTotal = valorAtivos + valorFechados;
    const totalProjetos = projetosEmAndamento + totalFechados;

    // Calcular tempo médio de entrega (diferença entre lancamento e data_criada para projetos fechados)
    const tempoMedioResult = await db.execute(sql`
      SELECT AVG(
        CASE 
          WHEN lancamento IS NOT NULL AND data_criada IS NOT NULL 
          THEN EXTRACT(DAY FROM (lancamento::date - data_criada::date))
          ELSE NULL 
        END
      ) as tempo_medio
      FROM staging.cup_projetos_tech_fechados
      WHERE lancamento IS NOT NULL AND data_criada IS NOT NULL
    `);
    const tempoMedioEntrega = parseFloat((tempoMedioResult.rows[0] as any).tempo_medio || '0');

    return {
      projetosEmAndamento,
      projetosFechados: totalFechados,
      totalTasks,
      valorTotalProjetos: valorTotal,
      valorMedioProjeto: totalProjetos > 0 ? valorTotal / totalProjetos : 0,
      tempoMedioEntrega,
    };
  }

  async getTechProjetosPorStatus(): Promise<TechProjetoStatus[]> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(status_projeto, 'Não definido') as status,
        COUNT(*) as quantidade
      FROM staging.cup_projetos_tech
      GROUP BY status_projeto
      ORDER BY quantidade DESC
    `);

    const total = (result.rows as any[]).reduce((acc, row) => acc + parseInt(row.quantidade), 0);
    
    return (result.rows as any[]).map(row => ({
      status: row.status,
      quantidade: parseInt(row.quantidade),
      percentual: total > 0 ? (parseInt(row.quantidade) / total) * 100 : 0,
    }));
  }

  async getTechProjetosPorResponsavel(): Promise<TechProjetoResponsavel[]> {
    const result = await db.execute(sql`
      WITH ativos AS (
        SELECT 
          COALESCE(responsavel, 'Não atribuído') as responsavel,
          COUNT(*) as projetos_ativos,
          COALESCE(SUM(valor_p), 0) as valor_ativos
        FROM staging.cup_projetos_tech
        GROUP BY responsavel
      ),
      fechados AS (
        SELECT 
          COALESCE(responsavel, 'Não atribuído') as responsavel,
          COUNT(*) as projetos_fechados,
          COALESCE(SUM(valor_p), 0) as valor_fechados
        FROM staging.cup_projetos_tech_fechados
        GROUP BY responsavel
      )
      SELECT 
        COALESCE(a.responsavel, f.responsavel) as responsavel,
        COALESCE(a.projetos_ativos, 0) as projetos_ativos,
        COALESCE(f.projetos_fechados, 0) as projetos_fechados,
        COALESCE(a.valor_ativos, 0) + COALESCE(f.valor_fechados, 0) as valor_total
      FROM ativos a
      FULL OUTER JOIN fechados f ON a.responsavel = f.responsavel
      ORDER BY projetos_ativos DESC, projetos_fechados DESC
    `);

    return (result.rows as any[]).map(row => ({
      responsavel: row.responsavel,
      projetosAtivos: parseInt(row.projetos_ativos || '0'),
      projetosFechados: parseInt(row.projetos_fechados || '0'),
      valorTotal: parseFloat(row.valor_total || '0'),
    }));
  }

  async getTechProjetosPorTipo(): Promise<TechProjetoTipo[]> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(tipo, 'Não definido') as tipo,
        COUNT(*) as quantidade,
        COALESCE(SUM(valor_p), 0) as valor_total
      FROM (
        SELECT tipo, valor_p FROM staging.cup_projetos_tech
        UNION ALL
        SELECT tipo, valor_p FROM staging.cup_projetos_tech_fechados
      ) combined
      GROUP BY tipo
      ORDER BY quantidade DESC
    `);

    return (result.rows as any[]).map(row => ({
      tipo: row.tipo,
      quantidade: parseInt(row.quantidade),
      valorTotal: parseFloat(row.valor_total || '0'),
    }));
  }

  async getTechProjetosEmAndamento(): Promise<TechProjetoDetalhe[]> {
    const result = await db.execute(sql`
      SELECT 
        clickup_task_id,
        task_name,
        status_projeto,
        responsavel,
        fase_projeto,
        tipo,
        tipo_projeto,
        valor_p,
        data_vencimento,
        lancamento,
        data_criada
      FROM staging.cup_projetos_tech
      ORDER BY data_criada DESC
    `);

    return (result.rows as any[]).map(row => ({
      clickupTaskId: row.clickup_task_id,
      taskName: row.task_name,
      statusProjeto: row.status_projeto,
      responsavel: row.responsavel,
      faseProjeto: row.fase_projeto,
      tipo: row.tipo,
      tipoProjeto: row.tipo_projeto,
      valorP: row.valor_p ? parseFloat(row.valor_p) : null,
      dataVencimento: row.data_vencimento,
      lancamento: row.lancamento,
      dataCriada: row.data_criada,
    }));
  }

  async getTechProjetosFechados(limit: number = 20): Promise<TechProjetoDetalhe[]> {
    const result = await db.execute(sql`
      SELECT 
        clickup_task_id,
        task_name,
        status_projeto,
        responsavel,
        fase_projeto,
        tipo,
        tipo_projeto,
        valor_p,
        data_vencimento,
        lancamento,
        data_criada
      FROM staging.cup_projetos_tech_fechados
      ORDER BY lancamento DESC NULLS LAST
      LIMIT ${limit}
    `);

    return (result.rows as any[]).map(row => ({
      clickupTaskId: row.clickup_task_id,
      taskName: row.task_name,
      statusProjeto: row.status_projeto,
      responsavel: row.responsavel,
      faseProjeto: row.fase_projeto,
      tipo: row.tipo,
      tipoProjeto: row.tipo_projeto,
      valorP: row.valor_p ? parseFloat(row.valor_p) : null,
      dataVencimento: row.data_vencimento,
      lancamento: row.lancamento,
      dataCriada: row.data_criada,
    }));
  }

  async getTechTasksPorStatus(): Promise<TechTaskStatus[]> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(status_projeto, 'Não definido') as status,
        COUNT(*) as quantidade
      FROM staging.cup_tech_tasks
      GROUP BY status_projeto
      ORDER BY quantidade DESC
    `);

    return (result.rows as any[]).map(row => ({
      status: row.status,
      quantidade: parseInt(row.quantidade),
    }));
  }

  async getTechVelocidade(): Promise<TechVelocidade> {
    // Projetos entregues no mês atual
    const mesAtual = new Date();
    const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
    
    const entreguesMesResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM staging.cup_projetos_tech_fechados
      WHERE lancamento >= ${inicioMes.toISOString().split('T')[0]}
    `);
    const projetosEntreguesMes = parseInt((entreguesMesResult.rows[0] as any).count || '0');

    // Tempo médio de entrega
    const tempoMedioResult = await db.execute(sql`
      SELECT AVG(
        CASE 
          WHEN lancamento IS NOT NULL AND data_criada IS NOT NULL 
          THEN EXTRACT(DAY FROM (lancamento::date - data_criada::date))
          ELSE NULL 
        END
      ) as tempo_medio
      FROM staging.cup_projetos_tech_fechados
      WHERE lancamento IS NOT NULL AND data_criada IS NOT NULL
    `);
    const tempoMedioEntrega = parseFloat((tempoMedioResult.rows[0] as any).tempo_medio || '0');

    // Taxa de cumprimento de prazo
    const taxaPrazoResult = await db.execute(sql`
      SELECT 
        COUNT(CASE WHEN lancamento <= data_vencimento THEN 1 END) as no_prazo,
        COUNT(*) as total
      FROM staging.cup_projetos_tech_fechados
      WHERE lancamento IS NOT NULL AND data_vencimento IS NOT NULL
    `);
    const noPrazo = parseInt((taxaPrazoResult.rows[0] as any).no_prazo || '0');
    const total = parseInt((taxaPrazoResult.rows[0] as any).total || '0');
    const taxaCumprimentoPrazo = total > 0 ? (noPrazo / total) * 100 : 0;

    return {
      projetosEntreguesMes,
      tempoMedioEntrega,
      taxaCumprimentoPrazo,
    };
  }

  // ============== INADIMPLÊNCIA ==============
  
  async getInadimplenciaResumo(dataInicio?: string, dataFim?: string): Promise<{
    totalInadimplente: number;
    quantidadeClientes: number;
    quantidadeParcelas: number;
    ticketMedio: number;
    valorUltimos45Dias: number;
    quantidadeUltimos45Dias: number;
    faixas: {
      ate30dias: { valor: number; quantidade: number; percentual: number };
      de31a60dias: { valor: number; quantidade: number; percentual: number };
      de61a90dias: { valor: number; quantidade: number; percentual: number };
      acima90dias: { valor: number; quantidade: number; percentual: number };
    };
    evolucaoMensal: { mes: string; mesLabel: string; valor: number; quantidade: number }[];
  }> {
    const hoje = new Date();
    const dataHoje = hoje.toISOString().split('T')[0];
    const data45DiasAtras = new Date(hoje.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Filtros de data
    let whereDataInicio = '';
    let whereDataFim = '';
    if (dataInicio) {
      whereDataInicio = ` AND data_vencimento >= '${dataInicio}'`;
    }
    if (dataFim) {
      whereDataFim = ` AND data_vencimento <= '${dataFim}'`;
    }
    
    // Resumo geral
    const resumoResult = await db.execute(sql.raw(`
      SELECT 
        COALESCE(SUM(nao_pago::numeric), 0) as total_inadimplente,
        COUNT(DISTINCT id_cliente) as quantidade_clientes,
        COUNT(*) as quantidade_parcelas
      FROM caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND data_vencimento < '${dataHoje}'
        AND nao_pago::numeric > 0
        ${whereDataInicio}
        ${whereDataFim}
    `));
    
    const totalInadimplente = parseFloat((resumoResult.rows[0] as any)?.total_inadimplente || '0');
    const quantidadeClientes = parseInt((resumoResult.rows[0] as any)?.quantidade_clientes || '0');
    const quantidadeParcelas = parseInt((resumoResult.rows[0] as any)?.quantidade_parcelas || '0');
    const ticketMedio = quantidadeClientes > 0 ? totalInadimplente / quantidadeClientes : 0;
    
    // Valor últimos 45 dias
    const ultimos45Result = await db.execute(sql.raw(`
      SELECT 
        COALESCE(SUM(nao_pago::numeric), 0) as valor,
        COUNT(*) as quantidade
      FROM caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND data_vencimento < '${dataHoje}'
        AND data_vencimento >= '${data45DiasAtras}'
        AND nao_pago::numeric > 0
        ${whereDataInicio}
        ${whereDataFim}
    `));
    
    const valorUltimos45Dias = parseFloat((ultimos45Result.rows[0] as any)?.valor || '0');
    const quantidadeUltimos45Dias = parseInt((ultimos45Result.rows[0] as any)?.quantidade || '0');
    
    // Faixas de atraso
    const faixasResult = await db.execute(sql.raw(`
      SELECT 
        CASE 
          WHEN ('${dataHoje}'::date - data_vencimento::date) BETWEEN 1 AND 30 THEN 'ate30dias'
          WHEN ('${dataHoje}'::date - data_vencimento::date) BETWEEN 31 AND 60 THEN 'de31a60dias'
          WHEN ('${dataHoje}'::date - data_vencimento::date) BETWEEN 61 AND 90 THEN 'de61a90dias'
          ELSE 'acima90dias'
        END as faixa,
        COALESCE(SUM(nao_pago::numeric), 0) as valor,
        COUNT(*) as quantidade
      FROM caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND data_vencimento < '${dataHoje}'
        AND nao_pago::numeric > 0
        ${whereDataInicio}
        ${whereDataFim}
      GROUP BY 
        CASE 
          WHEN ('${dataHoje}'::date - data_vencimento::date) BETWEEN 1 AND 30 THEN 'ate30dias'
          WHEN ('${dataHoje}'::date - data_vencimento::date) BETWEEN 31 AND 60 THEN 'de31a60dias'
          WHEN ('${dataHoje}'::date - data_vencimento::date) BETWEEN 61 AND 90 THEN 'de61a90dias'
          ELSE 'acima90dias'
        END
    `));
    
    const faixasMap: Record<string, { valor: number; quantidade: number }> = {
      ate30dias: { valor: 0, quantidade: 0 },
      de31a60dias: { valor: 0, quantidade: 0 },
      de61a90dias: { valor: 0, quantidade: 0 },
      acima90dias: { valor: 0, quantidade: 0 },
    };
    
    for (const row of faixasResult.rows as any[]) {
      const faixa = row.faixa as string;
      if (faixasMap[faixa]) {
        faixasMap[faixa].valor = parseFloat(row.valor || '0');
        faixasMap[faixa].quantidade = parseInt(row.quantidade || '0');
      }
    }
    
    const faixas = {
      ate30dias: { ...faixasMap.ate30dias, percentual: totalInadimplente > 0 ? (faixasMap.ate30dias.valor / totalInadimplente) * 100 : 0 },
      de31a60dias: { ...faixasMap.de31a60dias, percentual: totalInadimplente > 0 ? (faixasMap.de31a60dias.valor / totalInadimplente) * 100 : 0 },
      de61a90dias: { ...faixasMap.de61a90dias, percentual: totalInadimplente > 0 ? (faixasMap.de61a90dias.valor / totalInadimplente) * 100 : 0 },
      acima90dias: { ...faixasMap.acima90dias, percentual: totalInadimplente > 0 ? (faixasMap.acima90dias.valor / totalInadimplente) * 100 : 0 },
    };
    
    // Evolução mensal (últimos 12 meses)
    const evolucaoResult = await db.execute(sql.raw(`
      SELECT 
        TO_CHAR(data_vencimento, 'YYYY-MM') as mes,
        COALESCE(SUM(nao_pago::numeric), 0) as valor,
        COUNT(*) as quantidade
      FROM caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND data_vencimento < '${dataHoje}'
        AND data_vencimento >= '${dataHoje}'::date - INTERVAL '12 months'
        AND nao_pago::numeric > 0
        ${whereDataInicio}
        ${whereDataFim}
      GROUP BY TO_CHAR(data_vencimento, 'YYYY-MM')
      ORDER BY mes
    `));
    
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const evolucaoMensal = (evolucaoResult.rows as any[]).map(row => {
      const [ano, mes] = (row.mes || '').split('-');
      const mesIndex = parseInt(mes) - 1;
      return {
        mes: row.mes,
        mesLabel: `${mesesNomes[mesIndex] || mes}/${ano?.slice(2)}`,
        valor: parseFloat(row.valor || '0'),
        quantidade: parseInt(row.quantidade || '0'),
      };
    });
    
    return {
      totalInadimplente,
      quantidadeClientes,
      quantidadeParcelas,
      ticketMedio,
      valorUltimos45Dias,
      quantidadeUltimos45Dias,
      faixas,
      evolucaoMensal,
    };
  }

  async getInadimplenciaClientes(dataInicio?: string, dataFim?: string, ordenarPor: 'valor' | 'diasAtraso' | 'nome' = 'valor', limite: number = 100): Promise<{
    clientes: {
      idCliente: string;
      nomeCliente: string;
      valorTotal: number;
      quantidadeParcelas: number;
      parcelaMaisAntiga: Date;
      diasAtrasoMax: number;
      empresa: string;
      cnpj: string | null;
      statusClickup: string | null;
      responsavel: string | null;
      cluster: string | null;
      servicos: string | null;
    }[];
  }> {
    const hoje = new Date();
    const dataHoje = hoje.toISOString().split('T')[0];
    
    let whereDataInicio = '';
    let whereDataFim = '';
    if (dataInicio) {
      whereDataInicio = ` AND cp.data_vencimento >= '${dataInicio}'`;
    }
    if (dataFim) {
      whereDataFim = ` AND cp.data_vencimento <= '${dataFim}'`;
    }
    
    let orderByClause = 'valor_total DESC';
    if (ordenarPor === 'diasAtraso') {
      orderByClause = 'dias_atraso_max DESC';
    } else if (ordenarPor === 'nome') {
      orderByClause = 'nome_cliente ASC';
    }
    
    const result = await db.execute(sql.raw(`
      WITH inadimplencia AS (
        SELECT 
          cp.id_cliente,
          MAX(cp.descricao) as nome_cliente,
          COALESCE(SUM(cp.nao_pago::numeric), 0) as valor_total,
          COUNT(*) as quantidade_parcelas,
          MIN(cp.data_vencimento) as parcela_mais_antiga,
          MAX('${dataHoje}'::date - cp.data_vencimento::date) as dias_atraso_max,
          MAX(cp.empresa) as empresa
        FROM caz_parcelas cp
        WHERE cp.tipo_evento = 'RECEITA'
          AND cp.data_vencimento < '${dataHoje}'
          AND cp.nao_pago::numeric > 0
          AND cp.id_cliente IS NOT NULL
          AND cp.id_cliente != ''
          ${whereDataInicio}
          ${whereDataFim}
        GROUP BY cp.id_cliente
        HAVING COALESCE(SUM(cp.nao_pago::numeric), 0) > 0
      )
      SELECT 
        i.id_cliente,
        COALESCE(cc.nome, i.nome_cliente) as nome_cliente,
        i.valor_total,
        i.quantidade_parcelas,
        i.parcela_mais_antiga,
        i.dias_atraso_max,
        i.empresa,
        caz.cnpj,
        cc.status as status_clickup,
        cc.responsavel,
        cc.cluster,
        (
          SELECT string_agg(DISTINCT servico, ', ')
          FROM cup_contratos
          WHERE id_task = cc.task_id AND cc.task_id IS NOT NULL AND cc.task_id != ''
        ) as servicos
      FROM inadimplencia i
      LEFT JOIN caz_clientes caz ON caz.ids::text = i.id_cliente::text 
        AND COALESCE(caz.ids, '') != '' 
        AND LENGTH(caz.ids) > 0
      LEFT JOIN cup_clientes cc ON TRIM(cc.cnpj) = TRIM(caz.cnpj) 
        AND COALESCE(caz.cnpj, '') != '' 
        AND LENGTH(TRIM(caz.cnpj)) > 0
      ORDER BY ${orderByClause}
      LIMIT ${limite}
    `));
    
    const clientes = (result.rows as any[]).map(row => ({
      idCliente: row.id_cliente || '',
      nomeCliente: row.nome_cliente || 'Cliente Desconhecido',
      valorTotal: parseFloat(row.valor_total || '0'),
      quantidadeParcelas: parseInt(row.quantidade_parcelas || '0'),
      parcelaMaisAntiga: new Date(row.parcela_mais_antiga),
      diasAtrasoMax: parseInt(row.dias_atraso_max || '0'),
      empresa: row.empresa || '',
      cnpj: row.cnpj || null,
      statusClickup: row.status_clickup || null,
      responsavel: row.responsavel || null,
      cluster: row.cluster || null,
      servicos: row.servicos || null,
    }));
    
    return { clientes };
  }

  async getInadimplenciaDetalheParcelas(idCliente: string, dataInicio?: string, dataFim?: string): Promise<{
    parcelas: {
      id: number;
      descricao: string;
      valorBruto: number;
      naoPago: number;
      dataVencimento: Date;
      diasAtraso: number;
      empresa: string;
      status: string;
    }[];
  }> {
    const hoje = new Date();
    const dataHoje = hoje.toISOString().split('T')[0];
    
    let whereDataInicio = '';
    let whereDataFim = '';
    if (dataInicio) {
      whereDataInicio = ` AND data_vencimento >= '${dataInicio}'`;
    }
    if (dataFim) {
      whereDataFim = ` AND data_vencimento <= '${dataFim}'`;
    }
    
    const result = await db.execute(sql.raw(`
      SELECT 
        id,
        descricao,
        valor_bruto,
        nao_pago,
        data_vencimento,
        ('${dataHoje}'::date - data_vencimento::date) as dias_atraso,
        empresa,
        status
      FROM caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND data_vencimento < '${dataHoje}'
        AND nao_pago::numeric > 0
        AND id_cliente = '${idCliente}'
        ${whereDataInicio}
        ${whereDataFim}
      ORDER BY data_vencimento ASC
    `));
    
    const parcelas = (result.rows as any[]).map(row => ({
      id: parseInt(row.id),
      descricao: row.descricao || '',
      valorBruto: parseFloat(row.valor_bruto || '0'),
      naoPago: parseFloat(row.nao_pago || '0'),
      dataVencimento: new Date(row.data_vencimento),
      diasAtraso: parseInt(row.dias_atraso || '0'),
      empresa: row.empresa || '',
      status: row.status || '',
    }));
    
    return { parcelas };
  }

  async getInadimplenciaPorEmpresa(dataInicio?: string, dataFim?: string): Promise<{
    empresas: {
      empresa: string;
      valorTotal: number;
      quantidadeClientes: number;
      quantidadeParcelas: number;
      percentual: number;
    }[];
  }> {
    const hoje = new Date();
    const dataHoje = hoje.toISOString().split('T')[0];
    
    let whereDataInicio = '';
    let whereDataFim = '';
    if (dataInicio) {
      whereDataInicio = ` AND data_vencimento >= '${dataInicio}'`;
    }
    if (dataFim) {
      whereDataFim = ` AND data_vencimento <= '${dataFim}'`;
    }
    
    const result = await db.execute(sql.raw(`
      SELECT 
        COALESCE(empresa, 'Não Definida') as empresa,
        COALESCE(SUM(nao_pago::numeric), 0) as valor_total,
        COUNT(DISTINCT id_cliente) as quantidade_clientes,
        COUNT(*) as quantidade_parcelas
      FROM caz_parcelas
      WHERE tipo_evento = 'RECEITA'
        AND data_vencimento < '${dataHoje}'
        AND nao_pago::numeric > 0
        ${whereDataInicio}
        ${whereDataFim}
      GROUP BY COALESCE(empresa, 'Não Definida')
      ORDER BY valor_total DESC
    `));
    
    const totalGeral = (result.rows as any[]).reduce((sum, row) => sum + parseFloat(row.valor_total || '0'), 0);
    
    const empresas = (result.rows as any[]).map(row => ({
      empresa: row.empresa,
      valorTotal: parseFloat(row.valor_total || '0'),
      quantidadeClientes: parseInt(row.quantidade_clientes || '0'),
      quantidadeParcelas: parseInt(row.quantidade_parcelas || '0'),
      percentual: totalGeral > 0 ? (parseFloat(row.valor_total || '0') / totalGeral) * 100 : 0,
    }));
    
    return { empresas };
  }
}

export const storage = new DbStorage();
