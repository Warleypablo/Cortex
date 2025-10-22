import { type User, type InsertUser, type Cliente, type ContaReceber, type ContaPagar } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getClientes(): Promise<Cliente[]>;
  getClienteById(id: string): Promise<Cliente | undefined>;
  getClienteByCnpj(cnpj: string): Promise<Cliente | undefined>;
  getContasReceberByCliente(clienteId: string, limit?: number): Promise<ContaReceber[]>;
  getContasPagarByFornecedor(fornecedorId: string, limit?: number): Promise<ContaPagar[]>;
  getClienteRevenue(clienteId: string): Promise<{ mes: string; valor: number }[]>;
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

  async getClientes(): Promise<Cliente[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getClienteById(id: string): Promise<Cliente | undefined> {
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

  async getClientes(): Promise<Cliente[]> {
    return await db.select().from(schema.cazClientes).orderBy(schema.cazClientes.nome);
  }

  async getClienteById(id: string): Promise<Cliente | undefined> {
    const clientes = await db.select()
      .from(schema.cazClientes)
      .where(
        sql`${schema.cazClientes.ids} = ${id} OR ${schema.cazClientes.id}::text = ${id}`
      )
      .limit(1);
    return clientes[0];
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
}

export const storage = new DbStorage();
