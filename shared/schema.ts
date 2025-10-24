import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, date } from "drizzle-orm/pg-core";
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

export const rhPessoal = pgTable("rh_pessoal", {
  id: integer("id").primaryKey(),
  status: varchar("status", { length: 50 }),
  nome: varchar("nome", { length: 150 }).notNull(),
  cpf: varchar("cpf", { length: 14 }),
  endereco: text("endereco"),
  estado: varchar("estado", { length: 2 }),
  telefone: varchar("telefone", { length: 20 }),
  aniversario: date("aniversario"),
  admissao: date("admissao"),
  demissao: date("demissao"),
  tipoDemissao: varchar("tipo_demissao", { length: 100 }),
  motivoDemissao: text("motivo_demissao"),
  proporcional: decimal("proporcional"),
  proporcionalCaju: decimal("proporcional_caju"),
  setor: varchar("setor", { length: 100 }),
  squad: varchar("squad", { length: 100 }),
  cargo: varchar("cargo", { length: 100 }),
  nivel: varchar("nivel", { length: 50 }),
  pix: varchar("pix", { length: 200 }),
  cnpj: varchar("cnpj", { length: 18 }),
  emailTurbo: varchar("email_turbo", { length: 150 }),
  emailPessoal: varchar("email_pessoal", { length: 150 }),
  mesesDeTurbo: integer("meses_de_turbo"),
  ultimoAumento: date("ultimo_aumento"),
  mesesUltAumento: integer("meses_ult_aumento"),
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
export type Colaborador = typeof rhPessoal.$inferSelect;

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

export type Patrimonio = z.infer<typeof patrimonioSchema>;
