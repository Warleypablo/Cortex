import { type User, type InsertUser, type Cliente, type ContaReceber, type ContaPagar, type Colaborador, type InsertColaborador, type ContratoCompleto } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export type ClienteCompleto = Cliente & {
  nomeClickup: string | null;
  squad: string | null;
  statusClickup: string | null;
  telefone: string | null;
  responsavel: string | null;
  cluster: string | null;
};

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
  getContratos(): Promise<ContratoCompleto[]>;
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

  async getContratos(): Promise<ContratoCompleto[]> {
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
        squad: sql<string>`NULL`,
        statusClickup: schema.cupClientes.status,
        telefone: schema.cupClientes.telefone,
        responsavel: schema.cupClientes.responsavel,
        cluster: schema.cupClientes.cluster,
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
        squad: sql<string>`NULL`,
        statusClickup: schema.cupClientes.status,
        telefone: schema.cupClientes.telefone,
        responsavel: schema.cupClientes.responsavel,
        cluster: schema.cupClientes.cluster,
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
    return await db.select()
      .from(schema.cazReceber)
      .where(eq(schema.cazReceber.clienteId, clienteId))
      .orderBy(desc(schema.cazReceber.dataCriacao))
      .limit(limit);
  }

  async getContasPagarByFornecedor(fornecedorId: string, limit: number = 100): Promise<ContaPagar[]> {
    return await db.select()
      .from(schema.cazPagar)
      .where(eq(schema.cazPagar.fornecedor, fornecedorId))
      .orderBy(desc(schema.cazPagar.dataCriacao))
      .limit(limit);
  }

  async getClienteRevenue(clienteId: string): Promise<{ mes: string; valor: number }[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const receitas = await db.select({
      mes: sql<string>`TO_CHAR(${schema.cazReceber.dataCriacao}, 'YYYY-MM')`,
      valor: sql<number>`COALESCE(SUM(${schema.cazReceber.pago}), 0)`
    })
    .from(schema.cazReceber)
    .where(
      and(
        eq(schema.cazReceber.clienteId, clienteId),
        gte(schema.cazReceber.dataCriacao, sixMonthsAgo)
      )
    )
    .groupBy(sql`TO_CHAR(${schema.cazReceber.dataCriacao}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${schema.cazReceber.dataCriacao}, 'YYYY-MM')`);

    return receitas;
  }

  async getColaboradores(): Promise<Colaborador[]> {
    return await db.select().from(schema.rhPessoal).orderBy(schema.rhPessoal.nome);
  }

  async createColaborador(colaborador: InsertColaborador): Promise<Colaborador> {
    const [newColaborador] = await db.insert(schema.rhPessoal).values(colaborador as any).returning();
    return newColaborador;
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
}

export const storage = new DbStorage();
