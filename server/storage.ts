import { type User, type InsertUser, type Cliente, type ContaReceber, type ContaPagar, type Colaborador, type InsertColaborador, type ContratoCompleto, type Patrimonio, type InsertPatrimonio, type FluxoCaixaItem, type FluxoCaixaDiarioItem, type SaldoBancos, type TransacaoDiaItem, type DfcResponse, type DfcHierarchicalResponse, type DfcItem, type DfcNode, type DfcParcela, type InhireMetrics, type InhireStatusDistribution, type InhireStageDistribution, type InhireSourceDistribution, type InhireFunnel, type InhireVagaComCandidaturas, type MetaOverview, type CampaignPerformance, type AdsetPerformance, type AdPerformance, type CreativePerformance, type ConversionFunnel } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";

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
  createColaborador(colaborador: InsertColaborador): Promise<Colaborador>;
  updateColaborador(id: number, colaborador: Partial<InsertColaborador>): Promise<Colaborador>;
  deleteColaborador(id: number): Promise<void>;
  getContratos(): Promise<ContratoCompleto[]>;
  getContratosPorCliente(clienteId: string): Promise<ContratoCompleto[]>;
  getPatrimonios(): Promise<Patrimonio[]>;
  getPatrimonioById(id: number): Promise<PatrimonioComResponsavel | undefined>;
  createPatrimonio(patrimonio: InsertPatrimonio): Promise<Patrimonio>;
  getColaboradoresAnalise(): Promise<DashboardAnaliseData>;
  getSaldoAtualBancos(): Promise<SaldoBancos>;
  getFluxoCaixa(): Promise<FluxoCaixaItem[]>;
  getFluxoCaixaDiario(ano: number, mes: number): Promise<FluxoCaixaDiarioItem[]>;
  getTransacoesDia(ano: number, mes: number, dia: number): Promise<TransacaoDiaItem[]>;
  getCohortRetention(filters?: { squad?: string; servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<CohortRetentionData>;
  getVisaoGeralMetricas(mesAno: string): Promise<VisaoGeralMetricas>;
  getMrrEvolucaoMensal(mesAnoFim: string): Promise<import("@shared/schema").MrrEvolucaoMensal[]>;
  getChurnPorServico(filters?: { servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorServico[]>;
  getChurnPorResponsavel(filters?: { servicos?: string[]; squads?: string[]; colaboradores?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorResponsavel[]>;
  getDfc(mesInicio?: string, mesFim?: string): Promise<DfcHierarchicalResponse>;
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
  getTopResponsaveis(limit?: number, mesAno?: string): Promise<{ nome: string; mrr: number; posicao: number }[]>;
  getTopSquads(limit?: number, mesAno?: string): Promise<{ squad: string; mrr: number; posicao: number }[]>;
  getInhireMetrics(): Promise<InhireMetrics>;
  getInhireStatusDistribution(): Promise<InhireStatusDistribution[]>;
  getInhireStageDistribution(): Promise<InhireStageDistribution[]>;
  getInhireSourceDistribution(): Promise<InhireSourceDistribution[]>;
  getInhireFunnel(): Promise<InhireFunnel[]>;
  getInhireVagasComCandidaturas(limit?: number): Promise<InhireVagaComCandidaturas[]>;
  getMetaOverview(startDate?: string, endDate?: string): Promise<MetaOverview>;
  getCampaignPerformance(startDate?: string, endDate?: string): Promise<CampaignPerformance[]>;
  getAdsetPerformance(startDate?: string, endDate?: string): Promise<AdsetPerformance[]>;
  getAdPerformance(startDate?: string, endDate?: string): Promise<AdPerformance[]>;
  getCreativePerformance(startDate?: string, endDate?: string): Promise<CreativePerformance[]>;
  getConversionFunnel(startDate?: string, endDate?: string): Promise<ConversionFunnel>;
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

  async getDfc(mesInicio?: string, mesFim?: string): Promise<DfcHierarchicalResponse> {
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

  async getMetaOverview(startDate?: string, endDate?: string): Promise<MetaOverview> {
    throw new Error("Not implemented in MemStorage");
  }

  async getCampaignPerformance(startDate?: string, endDate?: string): Promise<CampaignPerformance[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getAdsetPerformance(startDate?: string, endDate?: string): Promise<AdsetPerformance[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getAdPerformance(startDate?: string, endDate?: string): Promise<AdPerformance[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getCreativePerformance(startDate?: string, endDate?: string): Promise<CreativePerformance[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getConversionFunnel(startDate?: string, endDate?: string): Promise<ConversionFunnel> {
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
        valorPago: schema.rhPatrimonio.valorPago,
        valorMercado: schema.rhPatrimonio.valorMercado,
        valorVenda: schema.rhPatrimonio.valorVenda,
        descricao: schema.rhPatrimonio.descricao,
        colaborador: schema.rhPessoal,
      })
      .from(schema.rhPatrimonio)
      .leftJoin(
        schema.rhPessoal,
        eq(schema.rhPatrimonio.responsavelAtual, schema.rhPessoal.nome)
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
    
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(data_vencimento, 'DD/MM/YYYY') as dia,
        data_vencimento,
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_bruto::numeric ELSE 0 END), 0) as receitas,
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_bruto::numeric ELSE 0 END), 0) as despesas
      FROM ${schema.cazParcelas}
      WHERE tipo_evento IN ('RECEITA', 'DESPESA')
        AND data_vencimento IS NOT NULL
        AND EXTRACT(YEAR FROM data_vencimento) = ${ano}
        AND EXTRACT(MONTH FROM data_vencimento) = ${mes}
      GROUP BY data_vencimento
      ORDER BY data_vencimento ASC
    `);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const transacoesPassadas = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_bruto::numeric ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_bruto::numeric ELSE 0 END), 0) as fluxo_passado
      FROM ${schema.cazParcelas}
      WHERE tipo_evento IN ('RECEITA', 'DESPESA')
        AND data_vencimento IS NOT NULL
        AND data_vencimento < ${hoje.toISOString()}
    `);
    
    const fluxoPassado = parseFloat((transacoesPassadas.rows[0] as any)?.fluxo_passado || '0');
    const saldoInicial = saldoAtual.saldoTotal - fluxoPassado;
    
    let saldoAcumulado = saldoInicial;
    
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
      whereConditions.push(sql`servico IN (${servicosPlaceholders})`);
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
          servico,
          TO_CHAR(data_encerramento, 'YYYY-MM') as mes,
          COUNT(*) as quantidade_churn,
          COALESCE(SUM(valorr::numeric), 0) as valor_churn,
          data_encerramento
        FROM cup_contratos
        WHERE ${whereClause}
        GROUP BY servico, TO_CHAR(data_encerramento, 'YYYY-MM'), data_encerramento
      ),
      ativos_por_mes AS (
        SELECT 
          servico,
          cd.mes,
          COUNT(*) as total_ativos,
          COALESCE(SUM(valorr::numeric), 0) as valor_total_ativo
        FROM cup_contratos c
        CROSS JOIN (SELECT DISTINCT mes, MIN(data_encerramento) as data_ref FROM churn_data GROUP BY mes) cd
        WHERE c.data_inicio <= cd.data_ref
          AND (c.data_encerramento IS NULL OR c.data_encerramento >= cd.data_ref)
        GROUP BY servico, cd.mes
      )
      SELECT 
        cd.servico,
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
      LEFT JOIN ativos_por_mes apm ON cd.servico = apm.servico AND cd.mes = apm.mes
      GROUP BY cd.servico, cd.mes, apm.total_ativos, apm.valor_total_ativo
      ORDER BY cd.servico, cd.mes
    `);
    
    return resultados.rows.map((row: any) => ({
      servico: row.servico,
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

  async getDfc(mesInicio?: string, mesFim?: string): Promise<DfcHierarchicalResponse> {
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
    
    if (mesInicio) {
      const [ano, mes] = mesInicio.split('-').map(Number);
      const dataInicio = new Date(ano, mes - 1, 1);
      whereClauses.push(`data_quitacao >= '${dataInicio.toISOString()}'`);
    }
    
    if (mesFim) {
      const [ano, mes] = mesFim.split('-').map(Number);
      const dataFim = new Date(ano, mes, 0, 23, 59, 59);
      whereClauses.push(`data_quitacao <= '${dataFim.toISOString()}'`);
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
      FROM ${schema.rhVagas} v
      LEFT JOIN ${schema.rhCandidaturas} c ON c.job_id_hash = v.id
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

  async getMetaOverview(startDate?: string, endDate?: string): Promise<MetaOverview> {
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

  async getCampaignPerformance(startDate?: string, endDate?: string): Promise<CampaignPerformance[]> {
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

  async getAdsetPerformance(startDate?: string, endDate?: string): Promise<AdsetPerformance[]> {
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

  async getAdPerformance(startDate?: string, endDate?: string): Promise<AdPerformance[]> {
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

  async getConversionFunnel(startDate?: string, endDate?: string): Promise<ConversionFunnel> {
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
          ) as leads,
          (
            SELECT COUNT(*)
            FROM ${schema.crmDeal}
            WHERE utm_campaign IS NOT NULL
              AND stage_name = 'Negócio Ganho'
              ${startDate ? sql`AND date_create >= ${startDate}::timestamp` : sql``}
              ${endDate ? sql`AND date_create <= ${endDate}::timestamp` : sql``}
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
}

export const storage = new DbStorage();
