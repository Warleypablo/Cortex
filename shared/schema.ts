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

export const cazParcelas = pgTable("caz_parcelas", {
  id: integer("id").primaryKey(),
  status: text("status"),
  valorPago: decimal("valor_pago"),
  perda: decimal("perda"),
  naoPago: decimal("nao_pago"),
  dataVencimento: timestamp("data_vencimento"),
  descricao: text("descricao"),
  metodoPagamento: text("metodo_pagamento"),
  valorBruto: decimal("valor_bruto"),
  valorLiquido: decimal("valor_liquido"),
  idEvento: text("id_evento"),
  tipoEvento: text("tipo_evento"),
  idContaFinanceira: text("id_conta_financeira"),
  nomeContaFinanceira: text("nome_conta_financeira"),
  idCliente: text("id_cliente"),
  urlCobranca: text("url_cobranca"),
  empresa: text("empresa"),
});

export const cazBancos = pgTable("caz_bancos", {
  id: integer("id").primaryKey(),
  nome: text("nome"),
  balance: decimal("balance"),
  empresa: text("empresa"),
  ativo: text("ativo"),
});

export const cupClientes = pgTable("cup_clientes", {
  nome: text("nome"),
  cnpj: text("cnpj").primaryKey(),
  status: text("status"),
  telefone: text("telefone"),
  responsavel: text("responsavel"),
  cluster: text("cluster"),
  taskId: text("task_id"),
  responsavelGeral: text("responsavel_geral"),
});

export const cupContratos = pgTable("cup_contratos", {
  servico: text("servico"),
  status: text("status"),
  valorr: decimal("valorr"),
  valorp: decimal("valorp"),
  idTask: text("id_task"),
  idSubtask: text("id_subtask").primaryKey(),
  dataInicio: timestamp("data_inicio"),
  dataEncerramento: timestamp("data_encerramento"),
  squad: text("squad"),
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

export const insertColaboradorSchema = createInsertSchema(rhPessoal).partial({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertColaborador = z.infer<typeof insertColaboradorSchema>;
export type User = typeof users.$inferSelect;
export type Cliente = typeof cazClientes.$inferSelect;
export type ContaReceber = typeof cazReceber.$inferSelect & {
  urlCobranca?: string | null;
};
export type ContaPagar = typeof cazPagar.$inferSelect;
export type Colaborador = typeof rhPessoal.$inferSelect;
export type Parcela = typeof cazParcelas.$inferSelect;
export type ClienteClickup = typeof cupClientes.$inferSelect;
export type Contrato = typeof cupContratos.$inferSelect;

export type ContratoCompleto = {
  idSubtask: string | null;
  servico: string | null;
  status: string | null;
  valorr: string | null;
  valorp: string | null;
  dataInicio: Date | null;
  dataEncerramento: Date | null;
  squad: string | null;
  idTask: string | null;
  nomeCliente: string | null;
  cnpjCliente: string | null;
  idCliente: string | null;
  responsavel: string | null;
  responsavelGeral: string | null;
};

export type ClienteContratoDetail = {
  clienteId: string;
  nomeCliente: string;
  servico: string;
  squad: string;
  valorr: number;
  dataInicio: Date;
  dataEncerramento: Date | null;
};

export const rhPatrimonio = pgTable("rh_patrimonio", {
  id: integer("id").primaryKey(),
  numeroAtivo: varchar("numero_ativo", { length: 100 }),
  ativo: varchar("ativo", { length: 200 }),
  marca: varchar("marca", { length: 150 }),
  estadoConservacao: varchar("estado_conservacao", { length: 100 }),
  responsavelAtual: varchar("responsavel_atual", { length: 200 }),
  valorPago: decimal("valor_pago"),
  valorMercado: decimal("valor_mercado"),
  valorVenda: decimal("valor_venda"),
  descricao: text("descricao"),
});

export const insertPatrimonioSchema = createInsertSchema(rhPatrimonio).partial({
  id: true,
});

export type InsertPatrimonio = z.infer<typeof insertPatrimonioSchema>;
export type Patrimonio = typeof rhPatrimonio.$inferSelect;

export type FluxoCaixaItem = {
  dataVencimento: Date;
  tipoEvento: string;
  valorBruto: number;
};

export type FluxoCaixaDiarioItem = {
  dia: string;
  receitas: number;
  despesas: number;
  saldoAcumulado: number;
};

export type TransacaoDiaItem = {
  id: number;
  descricao: string | null;
  valorBruto: number;
  tipoEvento: string | null;
  empresa: string | null;
  dataVencimento: Date;
};

export type SaldoBancos = {
  saldoTotal: number;
};

export type ChurnPorServico = {
  servico: string;
  mes: string;
  quantidade: number;
  valorTotal: number;
  percentualChurn: number;
  valorAtivoMes: number;
};
