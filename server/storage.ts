import { type User, type InsertUser, type Cliente, type ContaReceber, type ContaPagar, type Colaborador, type InsertColaborador, type ContratoCompleto, type Patrimonio, type InsertPatrimonio, type FluxoCaixaItem, type FluxoCaixaDiarioItem, type SaldoBancos, type TransacaoDiaItem } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

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

export interface CohortRetentionRow {
  cohortMonth: string;
  cohortLabel: string;
  totalClients: number;
  totalValue: number;
  retentionByMonth: {
    [monthOffset: number]: {
      activeClients: number;
      retentionRate: number;
      activeValue: number;
      valueRetentionRate: number;
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
  getCohortRetention(filters?: { squad?: string; servico?: string; mesInicio?: string; mesFim?: string }): Promise<CohortRetentionData>;
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

  async getCohortRetention(filters?: { squad?: string; servico?: string; mesInicio?: string; mesFim?: string }): Promise<CohortRetentionData> {
    throw new Error("Not implemented in MemStorage");
  }
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

  async getCohortRetention(filters?: { squad?: string; servico?: string; mesInicio?: string; mesFim?: string }): Promise<CohortRetentionData> {
    const result = await db.execute(sql`
      SELECT 
        id_task,
        servico,
        squad,
        data_inicio,
        data_encerramento
      FROM ${schema.cupContratos}
      WHERE data_inicio IS NOT NULL
    `);

    const contratos = (result.rows as any[]).map((row: any) => ({
      idTask: row.id_task,
      servico: row.servico,
      squad: row.squad,
      dataInicio: row.data_inicio ? new Date(row.data_inicio) : null,
      dataEncerramento: row.data_encerramento ? new Date(row.data_encerramento) : null,
    }));

    let filteredContratos = contratos.filter(c => c.dataInicio && !isNaN(c.dataInicio.getTime()));

    if (filters?.squad) {
      filteredContratos = filteredContratos.filter(c => c.squad === filters.squad);
    }
    if (filters?.servico) {
      filteredContratos = filteredContratos.filter(c => c.servico === filters.servico);
    }

    const cohortMap = new Map<string, {
      clients: Set<string>;
      contracts: Array<{
        idTask: string;
        dataInicio: Date;
        dataEncerramento: Date | null;
      }>;
    }>();

    filteredContratos.forEach(contrato => {
      if (!contrato.dataInicio) return;
      
      const dataInicio = contrato.dataInicio;
      const cohortKey = `${dataInicio.getFullYear()}-${String(dataInicio.getMonth() + 1).padStart(2, '0')}`;
      
      if (!cohortMap.has(cohortKey)) {
        cohortMap.set(cohortKey, { clients: new Set(), contracts: [] });
      }
      
      const cohort = cohortMap.get(cohortKey)!;
      if (contrato.idTask) {
        cohort.clients.add(contrato.idTask);
      }
      cohort.contracts.push({
        idTask: contrato.idTask || '',
        dataInicio: contrato.dataInicio,
        dataEncerramento: contrato.dataEncerramento,
      });
    });

    const availableServicos = Array.from(new Set(filteredContratos.map(c => c.servico).filter(Boolean) as string[])).sort();
    const availableSquads = Array.from(new Set(filteredContratos.map(c => c.squad).filter(Boolean) as string[])).sort();

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
      const retentionByMonth: { [key: number]: { activeClients: number; retentionRate: number } } = {};

      const now = new Date();
      const monthsSinceCohort = (now.getFullYear() - year) * 12 + (now.getMonth() - (month - 1));

      for (let offset = 0; offset <= monthsSinceCohort; offset++) {
        const checkDate = new Date(year, month - 1 + offset, 1);
        const checkEndDate = new Date(year, month - 1 + offset + 1, 0, 23, 59, 59);
        
        const activeClientsSet = new Set<string>();
        
        cohortData.contracts.forEach(contract => {
          if (!contract.dataEncerramento || new Date(contract.dataEncerramento) > checkEndDate) {
            if (contract.idTask) {
              activeClientsSet.add(contract.idTask);
            }
          }
        });
        
        const activeClients = activeClientsSet.size;
        const retentionRate = totalClients > 0 ? (activeClients / totalClients) * 100 : 0;
        
        retentionByMonth[offset] = {
          activeClients,
          retentionRate,
        };
        
        if (offset > maxMonthOffset) {
          maxMonthOffset = offset;
        }
      }

      return {
        cohortMonth,
        cohortLabel,
        totalClients,
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
}

export const storage = new DbStorage();
