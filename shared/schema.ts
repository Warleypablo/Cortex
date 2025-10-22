import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const cazClientes = pgTable("caz_clientes", {
  id: integer("id").primaryKey(),
  nome: text("nome"),
  cnpj: text("cnpj"),
  endereco: text("endereco"),
  ativo: text("ativo"),
  createdAt: timestamp("created_at"),
  empresa: text("empresa"),
  ids: text("ids"),
});

export const cazReceber = pgTable("caz_receber", {
  id: integer("id").primaryKey(),
  status: text("status"),
  total: decimal("total"),
  descricao: text("descricao"),
  dataVencimento: timestamp("data_vencimento"),
  naoPago: decimal("nao_pago"),
  pago: decimal("pago"),
  dataCriacao: timestamp("data_criacao"),
  dataAlteracao: timestamp("data_alteracao"),
  clienteId: text("cliente_id"),
  clienteNome: text("cliente_nome"),
  empresa: text("empresa"),
});

export const cazPagar = pgTable("caz_pagar", {
  id: integer("id").primaryKey(),
  status: text("status"),
  total: decimal("total"),
  descricao: text("descricao"),
  dataVencimento: timestamp("data_vencimento"),
  naoPago: decimal("nao_pago"),
  pago: decimal("pago"),
  dataCriacao: timestamp("data_criacao"),
  dataAlteracao: timestamp("data_alteracao"),
  fornecedor: text("fornecedor"),
  nome: text("nome"),
  empresa: text("empresa"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Cliente = typeof cazClientes.$inferSelect;
export type ContaReceber = typeof cazReceber.$inferSelect;
export type ContaPagar = typeof cazPagar.$inferSelect;

// Schemas for mock data (not yet in database)
export const colaboradorSchema = z.object({
  id: z.string(),
  nome: z.string(),
  cargo: z.string(),
  squad: z.enum(["Performance", "Comunicação", "Tech"]),
  email: z.string().email(),
  telefone: z.string().optional(),
  status: z.enum(["Ativo", "Inativo"]),
  foto: z.string().optional(),
  dataAdmissao: z.string(),
});

export const patrimonioSchema = z.object({
  id: z.string(),
  tipo: z.string(),
  nome: z.string(),
  categoria: z.enum(["Equipamentos", "Móveis", "Veículos", "Imóveis"]),
  valor: z.number(),
  responsavel: z.string(),
  status: z.enum(["Ativo", "Manutenção", "Inativo"]),
  dataAquisicao: z.string(),
  descricao: z.string().optional(),
});

export type Colaborador = z.infer<typeof colaboradorSchema>;
export type Patrimonio = z.infer<typeof patrimonioSchema>;
