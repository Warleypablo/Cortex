import { type User, type InsertUser, type Cliente, type ContaReceber, type ContaPagar, type Colaborador, type InsertColaborador, type ContratoCompleto, type Patrimonio, type InsertPatrimonio, type FluxoCaixaItem, type FluxoCaixaDiarioItem, type SaldoBancos, type TransacaoDiaItem, type DfcResponse, type DfcHierarchicalResponse, type DfcItem, type DfcNode, type DfcParcela } from "@shared/schema";
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
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<import("@shared/schema").AuthUser[]>;
  deleteUser(id: string): Promise<void>;
  updateUserPermissions(userId: string, permissions: string[]): Promise<void>;
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
  getChurnPorServico(filters?: { servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorServico[]>;
  getChurnPorResponsavel(filters?: { servicos?: string[]; squads?: string[]; colaboradores?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorResponsavel[]>;
  getDfc(mesInicio?: string, mesFim?: string): Promise<DfcHierarchicalResponse>;
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

  async getChurnPorServico(filters?: { servicos?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorServico[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getChurnPorResponsavel(filters?: { servicos?: string[]; squads?: string[]; colaboradores?: string[]; mesInicio?: string; mesFim?: string }): Promise<import("@shared/schema").ChurnPorResponsavel[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getDfc(mesInicio?: string, mesFim?: string): Promise<DfcHierarchicalResponse> {
    throw new Error("Not implemented in MemStorage");
  }
}

function normalizeCode(code: string): string {
  const parts = code.split('.');
  return parts.map(part => part.padStart(2, '0')).join('.');
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

function buildHierarchy(items: DfcItem[], meses: string[], parcelasByCategory?: Map<string, DfcParcela[]>): DfcHierarchicalResponse {
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
  
  for (const item of items) {
    const normalizedId = normalizeCode(item.categoriaId);
    
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
      nodeMap.set(normalizedId, {
        categoriaId: normalizedId,
        categoriaNome: data.nome,
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
        
        const parentName = `${parentNormalizedId.replace(/\./g, '.')}`;
        
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

  async getUsers(): Promise<import("@shared/schema").AuthUser[]> {
    const users = await db
      .select()
      .from(schema.authUsers)
      .orderBy(schema.authUsers.createdAt);
    return users;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(schema.authUsers).where(eq(schema.authUsers.id, id));
  }

  async updateUserPermissions(userId: string, permissions: string[]): Promise<void> {
    await db.delete(schema.userPermissions).where(eq(schema.userPermissions.userId, userId));
    
    if (permissions.length > 0) {
      const permissionRecords = permissions.map((pageName) => ({
        userId,
        pageName,
        canAccess: 1,
      }));
      
      await db.insert(schema.userPermissions).values(permissionRecords);
    }
  }

  async getClientes(): Promise<ClienteCompleto[]> {
    const result = await db
      .select({
        id: schema.cazClientes.id,
        nome: schema.cazClientes.nome,
        cnpj: schema.cazClientes.cnpj,
        endereco: schema.cazClientes.endereco,
        ativo: schema.cazClientes.ativo,
        createdAt: schema.cazClientes.createdAt,
        empresa: schema.cazClientes.empresa,
        ids: schema.cazClientes.ids,
        nomeClickup: schema.cupClientes.nome,
        statusClickup: schema.cupClientes.status,
        telefone: schema.cupClientes.telefone,
        responsavel: schema.cupClientes.responsavel,
        cluster: schema.cupClientes.cluster,
        cnpjCliente: schema.cupClientes.cnpj,
        servicos: sql<string>`(
          SELECT string_agg(DISTINCT servico, ', ')
          FROM ${schema.cupContratos}
          WHERE ${schema.cupContratos.idTask} = ${schema.cupClientes.taskId}
        )`,
        dataInicio: sql<Date>`(
          SELECT MIN(data_inicio)
          FROM ${schema.cupContratos}
          WHERE ${schema.cupContratos.idTask} = ${schema.cupClientes.taskId}
        )`,
      })
      .from(schema.cazClientes)
      .leftJoin(
        schema.cupClientes,
        eq(schema.cazClientes.cnpj, schema.cupClientes.cnpj)
      )
      .orderBy(schema.cupClientes.nome);

    return result;
  }

  async getClienteById(id: string): Promise<ClienteCompleto | undefined> {
    const result = await db
      .select({
        id: schema.cazClientes.id,
        nome: schema.cazClientes.nome,
        cnpj: schema.cazClientes.cnpj,
        endereco: schema.cazClientes.endereco,
        ativo: schema.cazClientes.ativo,
        createdAt: schema.cazClientes.createdAt,
        empresa: schema.cazClientes.empresa,
        ids: schema.cazClientes.ids,
        nomeClickup: schema.cupClientes.nome,
        statusClickup: schema.cupClientes.status,
        telefone: schema.cupClientes.telefone,
        responsavel: schema.cupClientes.responsavel,
        cluster: schema.cupClientes.cluster,
        cnpjCliente: schema.cupClientes.cnpj,
        servicos: sql<string>`(
          SELECT string_agg(DISTINCT servico, ', ')
          FROM ${schema.cupContratos}
          WHERE ${schema.cupContratos.idTask} = ${schema.cupClientes.taskId}
        )`,
        dataInicio: sql<Date>`(
          SELECT MIN(data_inicio)
          FROM ${schema.cupContratos}
          WHERE ${schema.cupContratos.idTask} = ${schema.cupClientes.taskId}
        )`,
      })
      .from(schema.cazClientes)
      .leftJoin(
        schema.cupClientes,
        eq(schema.cazClientes.cnpj, schema.cupClientes.cnpj)
      )
      .where(
        sql`${schema.cazClientes.ids} = ${id} OR ${schema.cazClientes.id}::text = ${id}`
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
    return await db.select().from(schema.rhPessoal).orderBy(schema.rhPessoal.nome);
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
    const result = await db
      .select({
        idSubtask: schema.cupContratos.idSubtask,
        servico: schema.cupContratos.servico,
        status: schema.cupContratos.status,
        valorr: schema.cupContratos.valorr,
        valorp: schema.cupContratos.valorp,
        dataInicio: schema.cupContratos.dataInicio,
        dataEncerramento: schema.cupContratos.dataEncerramento,
        squad: schema.cupContratos.squad,
        idTask: schema.cupContratos.idTask,
        nomeCliente: sql<string>`COALESCE(${schema.cupClientes.nome}, ${schema.cazClientes.nome})`,
        cnpjCliente: schema.cupClientes.cnpj,
        idCliente: schema.cazClientes.ids,
        responsavel: schema.cupClientes.responsavel,
        responsavelGeral: schema.cupClientes.responsavelGeral,
      })
      .from(schema.cupContratos)
      .leftJoin(
        schema.cupClientes,
        eq(schema.cupContratos.idTask, schema.cupClientes.taskId)
      )
      .leftJoin(
        schema.cazClientes,
        eq(schema.cupClientes.cnpj, schema.cazClientes.cnpj)
      )
      .orderBy(desc(schema.cupContratos.dataInicio));

    return result;
  }

  async getContratosPorCliente(clienteId: string): Promise<ContratoCompleto[]> {
    const result = await db
      .select({
        idSubtask: schema.cupContratos.idSubtask,
        servico: schema.cupContratos.servico,
        status: schema.cupContratos.status,
        valorr: schema.cupContratos.valorr,
        valorp: schema.cupContratos.valorp,
        dataInicio: schema.cupContratos.dataInicio,
        dataEncerramento: schema.cupContratos.dataEncerramento,
        squad: schema.cupContratos.squad,
        idTask: schema.cupContratos.idTask,
        nomeCliente: sql<string>`COALESCE(${schema.cupClientes.nome}, ${schema.cazClientes.nome})`,
        cnpjCliente: schema.cupClientes.cnpj,
        idCliente: schema.cazClientes.ids,
        responsavel: schema.cupClientes.responsavel,
        responsavelGeral: schema.cupClientes.responsavelGeral,
      })
      .from(schema.cupContratos)
      .leftJoin(
        schema.cupClientes,
        eq(schema.cupContratos.idTask, schema.cupClientes.taskId)
      )
      .leftJoin(
        schema.cazClientes,
        eq(schema.cupClientes.cnpj, schema.cazClientes.cnpj)
      )
      .where(eq(schema.cazClientes.ids, clienteId))
      .orderBy(desc(schema.cupContratos.dataInicio));

    return result;
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

    const resultados = await db.execute(sql`
      WITH contratos_periodo AS (
        SELECT 
          valorr::numeric,
          valorp::numeric,
          data_inicio,
          data_encerramento
        FROM ${schema.cupContratos}
      )
      SELECT 
        -- MRR: contratos ativos no mês (sem data_encerramento ou encerrados no/após o mês)
        COALESCE(SUM(
          CASE 
            WHEN (data_encerramento IS NULL OR 
                  (data_encerramento >= ${inicioMes} AND data_encerramento <= ${fimMes}))
            THEN valorr 
            ELSE 0 
          END
        ), 0)::numeric as mrr,
        
        -- Aquisição MRR: contratos criados no período
        COALESCE(SUM(
          CASE 
            WHEN data_inicio >= ${inicioMes} AND data_inicio <= ${fimMes}
            THEN valorr 
            ELSE 0 
          END
        ), 0)::numeric as aquisicao_mrr,
        
        -- Aquisição Pontual: valor_p dos contratos criados no período
        COALESCE(SUM(
          CASE 
            WHEN data_inicio >= ${inicioMes} AND data_inicio <= ${fimMes}
            THEN valorp 
            ELSE 0 
          END
        ), 0)::numeric as aquisicao_pontual,
        
        -- Churn: contratos encerrados no período
        COALESCE(SUM(
          CASE 
            WHEN data_encerramento >= ${inicioMes} AND data_encerramento <= ${fimMes}
            THEN valorr 
            ELSE 0 
          END
        ), 0)::numeric as churn
      FROM contratos_periodo
    `);

    const row = resultados.rows[0] as any;
    const mrr = parseFloat(row.mrr || '0');
    const aquisicaoMrr = parseFloat(row.aquisicao_mrr || '0');
    const aquisicaoPontual = parseFloat(row.aquisicao_pontual || '0');
    const churn = parseFloat(row.churn || '0');

    return {
      receitaTotal: mrr + aquisicaoPontual,
      mrr,
      aquisicaoMrr,
      aquisicaoPontual,
      cac: 0,
      churn,
    };
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
        valor_bruto,
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
      
      if (categoriaNomes.length === 0) continue;

      const dataQuitacao = new Date(row.data_quitacao as string);
      const mes = dataQuitacao.toISOString().substring(0, 7);
      mesesSet.add(mes);

      for (let i = 0; i < categoriaNomes.length; i++) {
        const fullCategoriaNome = categoriaNomes[i];
        const valor = parseFloat(valorCategorias[i] || '0');

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

    return buildHierarchy(items, meses, parcelasByCategory);
  }
}

export const storage = new DbStorage();
