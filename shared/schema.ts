import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, date, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const authUsers = pgTable("auth_users", {
  id: varchar("id", { length: 100 }).primaryKey(),
  googleId: varchar("google_id", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  picture: text("picture"),
  createdAt: timestamp("created_at").defaultNow(),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  allowedRoutes: text("allowed_routes").array(),
  department: varchar("department", { length: 50 }),
});

export type AuthUser = typeof authUsers.$inferSelect;
export type InsertAuthUser = typeof authUsers.$inferInsert;

export const cazClientes = pgTable("caz_clientes", {
  id: integer("id").primaryKey(),
  nome: text("nome"),
  cnpj: text("cnpj"),
  email: text("email"),
  telefone: text("telefone"),
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
  dataQuitacao: timestamp("data_quitacao"),
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
  categoriaId: text("categoria_id"),
  categoriaNome: text("categoria_nome"),
  valorCategoria: text("valor_categoria"),
});

export const cazCategorias = pgTable("caz_categorias", {
  id: text("id").primaryKey(),
  nome: text("nome"),
  tipo: text("tipo"),
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
  site: text("site"),
  email: text("email"),
  instagram: text("instagram"),
  linksContrato: text("links_contrato"),
  linkListaClickup: text("link_lista_clickup"),
  nomeDono: text("nome_dono"),
  tipoNegocio: text("tipo_negocio"),
  faturamentoMensal: text("faturamento_mensal"),
  investimentoAds: text("investimento_ads"),
  statusConta: text("status_conta"),
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
  dataPausa: timestamp("data_pausa"),
  squad: text("squad"),
  produto: text("produto"),
  dataSolicitacaoEncerramento: timestamp("data_solicitacao_encerramento"),
  responsavel: text("responsavel"),
  csResponsavel: text("cs_responsavel"),
  vendedor: text("vendedor"),
});

export const cupDataHist = pgTable("cup_data_hist", {
  id: integer("id").primaryKey(),
  dataSnapshot: timestamp("data_snapshot"),
  servico: text("servico"),
  status: text("status"),
  valorr: decimal("valorr"),
  valorp: decimal("valorp"),
  idTask: text("id_task"),
  idSubtask: text("id_subtask"),
  dataInicio: timestamp("data_inicio"),
  dataEncerramento: timestamp("data_encerramento"),
  dataPausa: timestamp("data_pausa"),
  squad: text("squad"),
  produto: text("produto"),
  responsavel: text("responsavel"),
  csResponsavel: text("cs_responsavel"),
  vendedor: text("vendedor"),
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
  salario: decimal("salario"),
  userId: varchar("user_id", { length: 100 }),
});

// Tabela de cargos disponíveis
export const rhCargos = pgTable("rh_cargos", {
  id: integer("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  descricao: text("descricao"),
  ativo: text("ativo").default("true"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

// Tabela de níveis disponíveis
export const rhNiveis = pgTable("rh_niveis", {
  id: integer("id").primaryKey(),
  nome: varchar("nome", { length: 50 }).notNull(),
  ordem: integer("ordem").default(0),
  ativo: text("ativo").default("true"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

// Tabela de squads disponíveis
export const rhSquads = pgTable("rh_squads", {
  id: integer("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  descricao: text("descricao"),
  ativo: text("ativo").default("true"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

// Tabela de histórico de promoções
export const rhPromocoes = pgTable("rh_promocoes", {
  id: integer("id").primaryKey(),
  colaboradorId: integer("colaborador_id").notNull(),
  dataPromocao: date("data_promocao").notNull(),
  cargoAnterior: varchar("cargo_anterior", { length: 100 }),
  cargoNovo: varchar("cargo_novo", { length: 100 }),
  nivelAnterior: varchar("nivel_anterior", { length: 50 }),
  nivelNovo: varchar("nivel_novo", { length: 50 }),
  salarioAnterior: decimal("salario_anterior"),
  salarioNovo: decimal("salario_novo"),
  observacoes: text("observacoes"),
  criadoEm: timestamp("criado_em").defaultNow(),
  criadoPor: varchar("criado_por", { length: 100 }),
});

export const insertRhCargoSchema = createInsertSchema(rhCargos).omit({ id: true, criadoEm: true }).partial({ descricao: true, ativo: true });
export const insertRhNivelSchema = createInsertSchema(rhNiveis).omit({ id: true, criadoEm: true }).partial({ ordem: true, ativo: true });
export const insertRhSquadSchema = createInsertSchema(rhSquads).omit({ id: true, criadoEm: true }).partial({ descricao: true, ativo: true });
export const insertRhPromocaoSchema = createInsertSchema(rhPromocoes).omit({ id: true, criadoEm: true });

export type RhCargo = typeof rhCargos.$inferSelect;
export type InsertRhCargo = z.infer<typeof insertRhCargoSchema>;
export type RhNivel = typeof rhNiveis.$inferSelect;
export type InsertRhNivel = z.infer<typeof insertRhNivelSchema>;
export type RhSquad = typeof rhSquads.$inferSelect;
export type InsertRhSquad = z.infer<typeof insertRhSquadSchema>;
export type RhPromocao = typeof rhPromocoes.$inferSelect;
export type InsertRhPromocao = z.infer<typeof insertRhPromocaoSchema>;

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
export type ContratoHistorico = typeof cupDataHist.$inferSelect;

export type ContratoCompleto = {
  idSubtask: string | null;
  servico: string | null;
  produto: string | null;
  status: string | null;
  valorr: string | null;
  valorp: string | null;
  dataInicio: Date | null;
  dataEncerramento: Date | null;
  dataSolicitacaoEncerramento: Date | null;
  squad: string | null;
  idTask: string | null;
  nomeCliente: string | null;
  cnpjCliente: string | null;
  idCliente: string | null;
  responsavel: string | null;
  csResponsavel: string | null;
  responsavelCliente: string | null;
  responsavelGeral: string | null;
};

export const updateContratoSchema = z.object({
  servico: z.string().optional(),
  produto: z.string().optional(),
  status: z.string().optional(),
  valorr: z.string().optional(),
  valorp: z.string().optional(),
  dataInicio: z.string().optional(),
  dataEncerramento: z.string().optional(),
  dataSolicitacaoEncerramento: z.string().optional(),
  squad: z.string().optional(),
  responsavel: z.string().optional(),
  csResponsavel: z.string().optional(),
});

export type UpdateContrato = z.infer<typeof updateContratoSchema>;

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
  responsavelId: integer("responsavel_id"),
  valorPago: decimal("valor_pago"),
  valorMercado: decimal("valor_mercado"),
  valorVenda: decimal("valor_venda"),
  descricao: text("descricao"),
  senhaAtivo: varchar("senha_ativo", { length: 200 }),
});

export const insertPatrimonioSchema = createInsertSchema(rhPatrimonio).partial({
  id: true,
});

export type InsertPatrimonio = z.infer<typeof insertPatrimonioSchema>;
export type Patrimonio = typeof rhPatrimonio.$inferSelect;

export type PatrimonioHistorico = {
  id: number;
  patrimonioId: number;
  acao: string;
  usuario: string;
  data: Date;
};

export type InsertPatrimonioHistorico = {
  patrimonioId: number;
  acao: string;
  usuario: string;
  data: Date;
};

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

export type ContaBanco = {
  id: string;
  nome: string;
  saldo: number;
  empresa: string;
};

export type FluxoCaixaDiarioCompleto = {
  data: string;
  entradas: number;
  saidas: number;
  saldoDia: number;
  saldoAcumulado: number;
  entradasPagas: number;
  saidasPagas: number;
  entradasPrevistas: number;
  saidasPrevistas: number;
};

export type FluxoCaixaInsights = {
  saldoHoje: number;
  saldoFuturo30Dias: number;
  entradasPrevistas30Dias: number;
  saidasPrevistas30Dias: number;
  entradasVencidas: number;
  saidasVencidas: number;
  diasAteNegatvo: number | null;
  maiorEntradaPrevista: { valor: number; descricao: string; data: string } | null;
  maiorSaidaPrevista: { valor: number; descricao: string; data: string } | null;
};

export type FluxoCaixaInsightsPeriodo = {
  saldoAtual: number;
  saldoFinalPeriodo: number;
  entradasPeriodo: number;
  saidasPeriodo: number;
  entradasVencidas: number;
  saidasVencidas: number;
  maiorEntrada: { valor: number; descricao: string; data: string; empresa: string } | null;
  maiorSaida: { valor: number; descricao: string; data: string; empresa: string } | null;
  topEntradas: { valor: number; descricao: string; data: string; empresa: string }[];
  topSaidas: { valor: number; descricao: string; data: string; empresa: string }[];
  transacoesPorCategoria: { categoria: string; tipo: 'RECEITA' | 'DESPESA'; valor: number }[];
};

export type ChurnPorServico = {
  servico: string;
  mes: string;
  quantidade: number;
  valorTotal: number;
  percentualChurn: number;
  valorAtivoMes: number;
};

export type ChurnPorResponsavel = {
  responsavel: string;
  quantidadeContratos: number;
  valorTotal: number;
  percentualChurn: number;
  valorAtivoTotal: number;
};

export type DfcItem = {
  categoriaId: string;
  categoriaNome: string;
  mes: string;
  valorTotal: number;
};

export type DfcResponse = {
  items: DfcItem[];
  meses: string[];
};

export type DfcParcela = {
  id: number;
  descricao: string;
  valorBruto: number;
  dataQuitacao: string;
  mes: string;
  tipoEvento: string;
};

export type DfcNode = {
  categoriaId: string;
  categoriaNome: string;
  nivel: number;
  parentId: string | null;
  children: string[];
  valuesByMonth: Record<string, number>;
  isLeaf: boolean;
  parcelas?: DfcParcela[];
};

export type DfcHierarchicalResponse = {
  nodes: DfcNode[];
  meses: string[];
  rootIds: string[];
};

export type MrrEvolucaoMensal = {
  mes: string;
  mrr: number;
};

export const rhCandidaturas = pgTable("rh_candidaturas", {
  id: integer("id").primaryKey(),
  talentStatus: text("talent_status"),
  stageName: text("stage_name"),
  source: text("source"),
  jobIdHash: text("job_id_hash"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const rhVagas = pgTable("rh_vagas", {
  id: text("id").primaryKey(),
  nome: text("nome"),
  status: text("status"),
  atualizacao: timestamp("atualizacao"),
});

export const rhTalentos = pgTable("rh_talentos", {
  id: integer("id").primaryKey(),
  nome: text("nome"),
  email: text("email"),
  telefone: text("telefone"),
  createdAt: timestamp("created_at"),
});

export type InhireCandidatura = typeof rhCandidaturas.$inferSelect;
export type InhireVaga = typeof rhVagas.$inferSelect;
export type InhireTalento = typeof rhTalentos.$inferSelect;

export type InhireStatusDistribution = {
  talentStatus: string;
  total: number;
  percentual: number;
};

export type InhireStageDistribution = {
  stageName: string;
  total: number;
  percentual: number;
};

export type InhireSourceDistribution = {
  source: string;
  total: number;
  percentual: number;
};

export type InhireFunnel = {
  stageName: string;
  total: number;
  percentual: number;
  ordem: number;
};

export type InhireVagaComCandidaturas = {
  vagaId: string;
  vagaNome: string;
  vagaStatus: string;
  totalCandidaturas: number;
  candidatosPorStatus: {
    status: string;
    total: number;
  }[];
};

export type InhireMetrics = {
  totalCandidaturas: number;
  candidatosAtivos: number;
  totalVagas: number;
  vagasAbertas: number;
  taxaConversao: number;
  tempoMedioContratacao: number;
};

// Meta Ads tables
export const metaAccounts = pgTable("meta_accounts", {
  accountId: varchar("account_id", { length: 50 }).primaryKey(),
  accountName: varchar("account_name", { length: 255 }),
  businessId: varchar("business_id", { length: 50 }),
  currency: varchar("currency", { length: 10 }),
  timezoneName: varchar("timezone_name", { length: 100 }),
  accountStatus: varchar("account_status", { length: 50 }),
  createdTime: timestamp("created_time"),
  updatedTime: timestamp("updated_time"),
  dataImportacao: timestamp("data_importacao"),
  ativo: varchar("ativo", { length: 10 }),
});

export const metaCampaigns = pgTable("meta_campaigns", {
  campaignId: varchar("campaign_id", { length: 50 }).primaryKey(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  campaignName: varchar("campaign_name", { length: 255 }).notNull(),
  objective: varchar("objective", { length: 100 }),
  status: varchar("status", { length: 50 }),
  configuredStatus: varchar("configured_status", { length: 50 }),
  effectiveStatus: varchar("effective_status", { length: 50 }),
  buyingType: varchar("buying_type", { length: 50 }),
  dailyBudget: decimal("daily_budget", { precision: 15, scale: 4 }),
  lifetimeBudget: decimal("lifetime_budget", { precision: 15, scale: 4 }),
  budgetRemaining: decimal("budget_remaining", { precision: 15, scale: 4 }),
  spendCap: decimal("spend_cap", { precision: 15, scale: 4 }),
  createdTime: timestamp("created_time"),
  updatedTime: timestamp("updated_time"),
  startTime: timestamp("start_time"),
  stopTime: timestamp("stop_time"),
  bidStrategy: varchar("bid_strategy", { length: 100 }),
  dataImportacao: timestamp("data_importacao"),
  dataAtualizacao: timestamp("data_atualizacao"),
  ativo: varchar("ativo", { length: 10 }),
});

export const metaAdsets = pgTable("meta_adsets", {
  adsetId: varchar("adset_id", { length: 50 }).primaryKey(),
  campaignId: varchar("campaign_id", { length: 50 }).notNull(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  adsetName: varchar("adset_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }),
  configuredStatus: varchar("configured_status", { length: 50 }),
  effectiveStatus: varchar("effective_status", { length: 50 }),
  dailyBudget: decimal("daily_budget", { precision: 15, scale: 4 }),
  lifetimeBudget: decimal("lifetime_budget", { precision: 15, scale: 4 }),
  budgetRemaining: decimal("budget_remaining", { precision: 15, scale: 4 }),
  bidAmount: decimal("bid_amount", { precision: 15, scale: 4 }),
  bidStrategy: varchar("bid_strategy", { length: 100 }),
  optimizationGoal: varchar("optimization_goal", { length: 100 }),
  billingEvent: varchar("billing_event", { length: 100 }),
  createdTime: timestamp("created_time"),
  updatedTime: timestamp("updated_time"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  targetingAgeMin: integer("targeting_age_min"),
  targetingAgeMax: integer("targeting_age_max"),
  learningStageStatus: varchar("learning_stage_status", { length: 100 }),
  learningStageConversions: integer("learning_stage_conversions"),
  dataImportacao: timestamp("data_importacao"),
  dataAtualizacao: timestamp("data_atualizacao"),
  ativo: varchar("ativo", { length: 10 }),
});

export const metaAds = pgTable("meta_ads", {
  adId: varchar("ad_id", { length: 50 }).primaryKey(),
  adsetId: varchar("adset_id", { length: 50 }).notNull(),
  campaignId: varchar("campaign_id", { length: 50 }).notNull(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  adName: varchar("ad_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }),
  configuredStatus: varchar("configured_status", { length: 50 }),
  effectiveStatus: varchar("effective_status", { length: 50 }),
  bidType: varchar("bid_type", { length: 50 }),
  bidAmount: decimal("bid_amount", { precision: 15, scale: 4 }),
  creativeId: varchar("creative_id", { length: 50 }),
  createdTime: timestamp("created_time"),
  updatedTime: timestamp("updated_time"),
  demolinkHash: varchar("demolink_hash", { length: 255 }),
  previewShareableLink: text("preview_shareable_link"),
  dataImportacao: timestamp("data_importacao"),
  dataAtualizacao: timestamp("data_atualizacao"),
  ativo: varchar("ativo", { length: 10 }),
});

export const metaCreatives = pgTable("meta_creatives", {
  creativeId: varchar("creative_id", { length: 50 }).primaryKey(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  creativeName: varchar("creative_name", { length: 255 }),
  objectType: varchar("object_type", { length: 50 }),
  status: varchar("status", { length: 50 }),
  title: varchar("title", { length: 500 }),
  body: text("body"),
  callToActionType: varchar("call_to_action_type", { length: 100 }),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  createdTime: timestamp("created_time"),
  updatedTime: timestamp("updated_time"),
  dataImportacao: timestamp("data_importacao"),
  ativo: varchar("ativo", { length: 10 }),
});

export const metaInsightsDaily = pgTable("meta_insights_daily", {
  id: integer("id").primaryKey(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  campaignId: varchar("campaign_id", { length: 50 }),
  adsetId: varchar("adset_id", { length: 50 }),
  adId: varchar("ad_id", { length: 50 }),
  dateStart: date("date_start").notNull(),
  dateStop: date("date_stop").notNull(),
  impressions: integer("impressions"),
  clicks: integer("clicks"),
  spend: decimal("spend", { precision: 15, scale: 4 }),
  reach: integer("reach"),
  frequency: decimal("frequency", { precision: 10, scale: 4 }),
  cpm: decimal("cpm", { precision: 10, scale: 4 }),
  cpc: decimal("cpc", { precision: 10, scale: 4 }),
  ctr: decimal("ctr", { precision: 10, scale: 6 }),
  cpp: decimal("cpp", { precision: 10, scale: 4 }),
  inlineLinkClicks: integer("inline_link_clicks"),
  inlineLinkClickCtr: decimal("inline_link_click_ctr", { precision: 10, scale: 6 }),
  outboundClicks: integer("outbound_clicks"),
  outboundClicksCtr: decimal("outbound_clicks_ctr", { precision: 10, scale: 6 }),
  uniqueClicks: integer("unique_clicks"),
  uniqueCtr: decimal("unique_ctr", { precision: 10, scale: 6 }),
  uniqueInlineLinkClicks: integer("unique_inline_link_clicks"),
  uniqueInlineLinkClickCtr: decimal("unique_inline_link_click_ctr", { precision: 10, scale: 6 }),
  conversions: integer("conversions"),
  conversionRate: decimal("conversion_rate", { precision: 10, scale: 6 }),
  costPerConversion: decimal("cost_per_conversion", { precision: 10, scale: 4 }),
  videoPlayActions: integer("video_play_actions"),
  videoP25WatchedActions: integer("video_p25_watched_actions"),
  videoP50WatchedActions: integer("video_p50_watched_actions"),
  videoP75WatchedActions: integer("video_p75_watched_actions"),
  videoP100WatchedActions: integer("video_p100_watched_actions"),
  videoAvgTimeWatchedActions: decimal("video_avg_time_watched_actions", { precision: 10, scale: 2 }),
  purchaseRoas: decimal("purchase_roas", { precision: 10, scale: 4 }),
  websitePurchaseRoas: decimal("website_purchase_roas", { precision: 10, scale: 4 }),
  qualityRanking: varchar("quality_ranking", { length: 50 }),
  engagementRateRanking: varchar("engagement_rate_ranking", { length: 50 }),
  conversionRateRanking: varchar("conversion_rate_ranking", { length: 50 }),
  dataImportacao: timestamp("data_importacao"),
  hashDados: varchar("hash_dados", { length: 64 }),
});

// CRM Deal table
export const crmDeal = pgTable("crm_deal", {
  id: integer("id").primaryKey(),
  dateCreate: timestamp("date_create"),
  dateModify: timestamp("date_modify"),
  createdById: integer("created_by_id"),
  createdByName: text("created_by_name"),
  createdBy: text("created_by"),
  modifyById: integer("modify_by_id"),
  modifiedByName: text("modified_by_name"),
  modifiedBy: text("modified_by"),
  assignedById: integer("assigned_by_id"),
  assignedBy: text("assigned_by"),
  companyId: integer("company_id"),
  companyName: text("company_name"),
  company: text("company"),
  contactId: integer("contact_id"),
  contactName: text("contact_name"),
  contact: text("contact"),
  title: text("title"),
  categoryId: integer("category_id"),
  categoryName: text("category_name"),
  category: text("category"),
  stageId: integer("stage_id"),
  stageName: text("stage_name"),
  stage: text("stage"),
  stageSemantic: text("stage_semantic"),
  comments: text("comments"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  assignedByName: text("assigned_by_name"),
  closer: text("closer"),
  sdr: text("sdr"),
  funil: varchar("funil", { length: 255 }),
  dataReuniaoRealizada: date("data_reuniao_realizada"),
  faturamentoMensal: varchar("faturamento_mensal", { length: 255 }),
  lpDaConversao: varchar("lp_da_conversao", { length: 255 }),
  fonte: varchar("fonte", { length: 255 }),
  valorPontual: decimal("valor_pontual", { precision: 15, scale: 2 }),
  valorRecorrente: decimal("valor_recorrente", { precision: 15, scale: 2 }),
  segmento: varchar("segmento", { length: 255 }),
  lpConversao: text("lp_conversao"),
  mql: text("mql"),
  dataFechamento: date("data_fechamento"),
  source: varchar("source", { length: 255 }),
  empresa: varchar("empresa", { length: 255 }),
  utmSource: varchar("utm_source", { length: 255 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  utmTerm: varchar("utm_term", { length: 255 }),
  utmContent: varchar("utm_content", { length: 255 }),
  fnlNgc: text("fnl_ngc"),
});

// Meta Ads + CRM types
export type MetaAccount = typeof metaAccounts.$inferSelect;
export type MetaCampaign = typeof metaCampaigns.$inferSelect;
export type MetaAdset = typeof metaAdsets.$inferSelect;
export type MetaAd = typeof metaAds.$inferSelect;
export type MetaCreative = typeof metaCreatives.$inferSelect;
export type MetaInsight = typeof metaInsightsDaily.$inferSelect;
export type CrmDeal = typeof crmDeal.$inferSelect;

// Meta Ads Analytics types
export type MetaOverview = {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  avgCtr: number;
  avgCpc: number;
  avgCpm: number;
  totalLeads: number;
  totalWon: number;
  totalWonValue: number;
  roas: number;
  costPerLead: number;
  cac: number;
  conversionRate: number;
};

export type CampaignPerformance = {
  campaignId: string;
  campaignName: string;
  objective: string | null;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  won: number;
  wonValue: number;
  roas: number;
  conversionRate: number;
};

export type AdsetPerformance = {
  adsetId: string;
  adsetName: string;
  campaignName: string;
  status: string | null;
  optimizationGoal: string | null;
  targetingAgeMin: number | null;
  targetingAgeMax: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  won: number;
  wonValue: number;
  roas: number;
  conversionRate: number;
};

export type AdPerformance = {
  adId: string;
  adName: string;
  campaignName: string;
  adsetName: string;
  status: string | null;
  creativeId: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  won: number;
  wonValue: number;
  roas: number;
  conversionRate: number;
};

export type CreativePerformance = {
  creativeId: string;
  creativeName: string | null;
  objectType: string | null;
  title: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  totalAds: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP100: number;
  leads: number;
  won: number;
  wonValue: number;
  roas: number;
};

export type ConversionFunnel = {
  impressions: number;
  clicks: number;
  leads: number;
  won: number;
  clickRate: number;
  leadRate: number;
  wonRate: number;
};

// Auditoria de Sistemas - Comparação ClickUp vs Conta Azul
export type AuditoriaSistemas = {
  cnpj: string;
  nomeCliente: string;
  valorClickUp: number;
  valorContaAzul: number;
  diferenca: number;
  percentualDivergencia: number;
  status: 'ok' | 'alerta' | 'critico';
  quantidadeContratosClickUp: number;
  quantidadeTitulosContaAzul: number;
};

// Meta Ads - Filtros de Leads
export type MetaLeadFilters = {
  categories: string[];
  stages: string[];
  utmSources: string[];
  utmCampaigns: Array<{ id: string; name: string }>;
  utmTerms: Array<{ id: string; name: string }>;
};

export type MetaLeadFilterParams = {
  categoryNames?: string[];
  stageNames?: string[];
  utmSources?: string[];
  utmCampaigns?: string[];
  utmTerms?: string[];
};

export type FinanceiroResumo = {
  receitaTotal: number;
  despesaTotal: number;
  resultado: number;
  margemOperacional: number;
  receitaMesAnterior: number;
  despesaMesAnterior: number;
  variacaoReceita: number;
  variacaoDespesa: number;
  totalParcelas: number;
  parcelasPagas: number;
  parcelasPendentes: number;
};

export type FinanceiroEvolucaoMensal = {
  mes: string;
  mesLabel: string;
  receita: number;
  despesa: number;
  resultado: number;
  margemPercentual: number;
};

export type FinanceiroCategoria = {
  categoriaId: string;
  categoriaNome: string;
  tipo: 'RECEITA' | 'DESPESA';
  valor: number;
  percentual: number;
  quantidade: number;
};

export type FinanceiroTopCliente = {
  clienteId: string;
  clienteNome: string;
  receitaTotal: number;
  quantidadeTitulos: number;
  ticketMedio: number;
  ultimoPagamento: string | null;
};

export type FinanceiroMetodoPagamento = {
  metodo: string;
  valor: number;
  quantidade: number;
  percentual: number;
};

export type FinanceiroContaBancaria = {
  id: string;
  nome: string;
  saldo: number;
  empresa: string;
};

// Recruitment Analytics Types (Power BI style G&G Dashboard)
export type RecrutamentoKPIs = {
  totalCandidaturas: number;
  candidatosAtivos: number;
  candidatosRejeitados: number;
  candidatosDeclinados: number;
  vagasAbertas: number;
  vagasPausadas: number;
  vagasCanceladas: number;
  taxaConversaoGeral: number;
  tempoMedioContratacao: number;
  huntingTotal: number;
  passivoTotal: number;
};

export type RecrutamentoFunilEtapa = {
  etapa: string;
  ordem: number;
  total: number;
  percentual: number;
  conversaoAnterior: number;
};

export type RecrutamentoFonteDistribuicao = {
  fonte: string;
  total: number;
  percentual: number;
  ativos: number;
  rejeitados: number;
  declinados: number;
};

export type RecrutamentoEvolucaoMensal = {
  mes: string;
  mesLabel: string;
  totalCandidaturas: number;
  hunting: number;
  passivo: number;
  aprovados: number;
  rejeitados: number;
};

export type RecrutamentoVagaDetalhe = {
  vagaId: number;
  vagaNome: string;
  area: string | null;
  seniority: string | null;
  status: string;
  totalCandidatos: number;
  candidatosAtivos: number;
  etapas: {
    etapa: string;
    total: number;
    percentual: number;
  }[];
  fontes: {
    fonte: string;
    total: number;
  }[];
  conversaoOferta: number;
};

export type RecrutamentoAreaDistribuicao = {
  area: string;
  totalVagas: number;
  vagasAbertas: number;
  totalCandidatos: number;
  conversaoMedia: number;
};

export type RecrutamentoFiltros = {
  areas: string[];
  seniorities: string[];
  fontes: string[];
  statusVagas: string[];
  etapas: string[];
};

export type RecrutamentoConversaoPorVaga = {
  vagaId: number;
  vagaNome: string;
  area: string | null;
  inscricao: number;
  triagem: number;
  entrevistaRS: number;
  entrevistaTecnica: number;
  entrevistaFinal: number;
  oferta: number;
  taxaConversao: number;
};

export type RecrutamentoTempoMedioPorEtapa = {
  etapa: string;
  tempoMedioDias: number;
  totalCandidatos: number;
  ordem: number;
};

export type RecrutamentoEntrevistasRealizadas = {
  totalEntrevistas: number;
  entrevistaRS: number;
  entrevistaTecnica: number;
  entrevistaFinal: number;
  mediaEntrevistasPorVaga: number;
};

export type RecrutamentoEntrevistasPorCargo = {
  cargo: string;
  area: string | null;
  totalEntrevistas: number;
  entrevistaRS: number;
  entrevistaTecnica: number;
  entrevistaFinal: number;
  percentual: number;
};

export type RecrutamentoCandidaturasPorArea = {
  area: string;
  totalCandidaturas: number;
  candidatosAtivos: number;
  candidatosRejeitados: number;
  percentual: number;
  vagasAbertas: number;
};

// Tabela para contextos de inadimplência (CS/CX workflow)
export const inadimplenciaContextos = pgTable("inadimplencia_contextos", {
  clienteId: text("cliente_id").primaryKey(),
  contexto: text("contexto"),
  evidencias: text("evidencias"),
  acao: varchar("acao", { length: 20 }), // 'cobrar' | 'aguardar' | 'abonar'
  statusFinanceiro: varchar("status_financeiro", { length: 30 }), // 'cobrado' | 'acordo_realizado' | 'juridico'
  detalheFinanceiro: text("detalhe_financeiro"),
  atualizadoPor: varchar("atualizado_por", { length: 100 }),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
  valorAcordado: decimal("valor_acordado", { precision: 15, scale: 2 }),
  dataAcordo: date("data_acordo"),
});

export const insertInadimplenciaContextoSchema = createInsertSchema(inadimplenciaContextos);
export type InadimplenciaContexto = typeof inadimplenciaContextos.$inferSelect;
export type InsertInadimplenciaContexto = z.infer<typeof insertInadimplenciaContextoSchema>;

// Metric Formatting Rules - Conditional coloring system
export const metricRulesets = pgTable("metric_rulesets", {
  id: integer("id").primaryKey(),
  metricKey: varchar("metric_key", { length: 50 }).notNull().unique(),
  displayLabel: varchar("display_label", { length: 100 }).notNull(),
  defaultColor: varchar("default_color", { length: 20 }).default("default"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by", { length: 100 }),
});

export const metricThresholds = pgTable("metric_thresholds", {
  id: integer("id").primaryKey(),
  rulesetId: integer("ruleset_id").notNull(),
  minValue: decimal("min_value", { precision: 15, scale: 4 }),
  maxValue: decimal("max_value", { precision: 15, scale: 4 }),
  color: varchar("color", { length: 20 }).notNull(),
  label: varchar("label", { length: 100 }),
  sortOrder: integer("sort_order").default(0),
});

export const insertMetricRulesetSchema = createInsertSchema(metricRulesets).omit({ id: true });
export const insertMetricThresholdSchema = createInsertSchema(metricThresholds).omit({ id: true });

export type MetricRuleset = typeof metricRulesets.$inferSelect;
export type InsertMetricRuleset = z.infer<typeof insertMetricRulesetSchema>;
export type MetricThreshold = typeof metricThresholds.$inferSelect;
export type InsertMetricThreshold = z.infer<typeof insertMetricThresholdSchema>;

export type MetricRulesetWithThresholds = MetricRuleset & {
  thresholds: MetricThreshold[];
};

// Tabela para controle jurídico de inadimplência
export const juridicoClientes = pgTable("juridico_clientes", {
  id: integer("id").primaryKey(),
  clienteId: text("cliente_id").notNull().unique(),
  procedimento: varchar("procedimento", { length: 50 }), // 'notificacao' | 'protesto' | 'acao_judicial' | 'acordo' | 'baixa'
  statusJuridico: varchar("status_juridico", { length: 50 }), // 'aguardando_documentos' | 'em_andamento' | 'finalizado' | 'suspenso'
  observacoes: text("observacoes"),
  valorAcordado: decimal("valor_acordado", { precision: 15, scale: 2 }),
  dataAcordo: date("data_acordo"),
  numeroParcelas: integer("numero_parcelas"),
  protocoloProcesso: varchar("protocolo_processo", { length: 100 }),
  advogadoResponsavel: varchar("advogado_responsavel", { length: 100 }),
  dataCriacao: timestamp("data_criacao").defaultNow(),
  dataAtualizacao: timestamp("data_atualizacao").defaultNow(),
  atualizadoPor: varchar("atualizado_por", { length: 100 }),
});

export const insertJuridicoClienteSchema = createInsertSchema(juridicoClientes).omit({ id: true });
export type JuridicoCliente = typeof juridicoClientes.$inferSelect;
export type InsertJuridicoCliente = z.infer<typeof insertJuridicoClienteSchema>;

// Tabela para comunicações/avisos internos sobre clientes
export const clienteComunicacoes = pgTable("cliente_comunicacoes", {
  id: serial("id").primaryKey(),
  clienteId: text("cliente_id").notNull(),
  tipo: varchar("tipo", { length: 30 }).notNull(), // 'aviso' | 'reuniao' | 'alerta' | 'atualizacao' | 'interno'
  titulo: varchar("titulo", { length: 200 }).notNull(),
  conteudo: text("conteudo"),
  prioridade: varchar("prioridade", { length: 20 }).default("normal"), // 'baixa' | 'normal' | 'alta' | 'urgente'
  status: varchar("status", { length: 20 }).default("ativo"), // 'ativo' | 'arquivado'
  criadoPor: varchar("criado_por", { length: 100 }).notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export const insertClienteComunicacaoSchema = createInsertSchema(clienteComunicacoes).omit({ id: true, criadoEm: true, atualizadoEm: true });
export type ClienteComunicacao = typeof clienteComunicacoes.$inferSelect;
export type InsertClienteComunicacao = z.infer<typeof insertClienteComunicacaoSchema>;

// Global Search Types
export type SearchEntityType = 'cliente' | 'colaborador' | 'contrato' | 'cobranca' | 'projeto' | 'acesso' | 'credencial' | 'conhecimento' | 'ferramenta' | 'patrimonio' | 'beneficio';

export interface SearchResult {
  id: string;
  entity: SearchEntityType;
  label: string;
  description?: string;
  route: string;
  meta?: {
    status?: string;
    value?: number;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
}

// Unified Assistant Types
export type AssistantContext = 'geral' | 'financeiro' | 'cases' | 'clientes' | 'auto';

export interface UnifiedAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface UnifiedAssistantRequest {
  message: string;
  context: AssistantContext;
  historico?: { role: 'user' | 'assistant'; content: string }[];
  metadata?: {
    dataInicio?: string;
    dataFim?: string;
    pageContext?: string;
  };
}

export interface UnifiedAssistantResponse {
  resposta: string;
  context: AssistantContext;
  dadosReferenciados?: any;
}

// System Logs Tables
export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  endpoint: text("endpoint").notNull(),
  statusCode: integer("status_code"),
  responseTimeMs: integer("response_time_ms"),
  userId: varchar("user_id", { length: 100 }),
  userEmail: varchar("user_email", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
});

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = typeof systemLogs.$inferInsert;

export const authLogs = pgTable("auth_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id", { length: 100 }),
  userEmail: varchar("user_email", { length: 255 }),
  userName: varchar("user_name", { length: 255 }),
  action: varchar("action", { length: 20 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  success: text("success").default("true"),
});

export type AuthLog = typeof authLogs.$inferSelect;
export type InsertAuthLog = typeof authLogs.$inferInsert;

// Sync Logs - Tracking integration synchronizations
export const syncLogs = pgTable("sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  integration: varchar("integration", { length: 50 }).notNull(), // conta_azul, clickup, bitrix, meta_ads, google_ads
  operation: varchar("operation", { length: 50 }).notNull(), // full_sync, incremental, manual
  status: varchar("status", { length: 20 }).notNull(), // running, success, failed, partial
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  recordsProcessed: integer("records_processed").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsFailed: integer("records_failed").default(0),
  errorMessage: text("error_message"),
  errorDetails: text("error_details"),
  triggeredBy: varchar("triggered_by", { length: 100 }), // system, user_email, scheduler
  durationMs: integer("duration_ms"),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;

// Data Reconciliation - Tracking discrepancies between systems
export const dataReconciliation = pgTable("data_reconciliation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // cliente, contrato, cobranca, parcela
  sourceSystem: varchar("source_system", { length: 50 }).notNull(), // conta_azul, clickup, cortex
  targetSystem: varchar("target_system", { length: 50 }).notNull(),
  discrepancyType: varchar("discrepancy_type", { length: 50 }).notNull(), // missing, value_mismatch, status_mismatch
  sourceId: varchar("source_id", { length: 100 }),
  targetId: varchar("target_id", { length: 100 }),
  entityName: text("entity_name"),
  fieldName: varchar("field_name", { length: 100 }),
  sourceValue: text("source_value"),
  targetValue: text("target_value"),
  severity: varchar("severity", { length: 20 }).notNull().default("medium"), // low, medium, high, critical
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, resolved, ignored
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 255 }),
  notes: text("notes"),
});

export type DataReconciliation = typeof dataReconciliation.$inferSelect;
export type InsertDataReconciliation = typeof dataReconciliation.$inferInsert;

// Integration Health - Track health metrics over time
export const integrationHealth = pgTable("integration_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  integration: varchar("integration", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(), // healthy, degraded, down
  lastSuccessfulSync: timestamp("last_successful_sync"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  avgSyncDurationMs: integer("avg_sync_duration_ms"),
  totalRecordsToday: integer("total_records_today").default(0),
  errorRatePercent: decimal("error_rate_percent"),
});

export type IntegrationHealth = typeof integrationHealth.$inferSelect;
export type InsertIntegrationHealth = typeof integrationHealth.$inferInsert;

// ============================================
// Acessos Module - Clients & Credentials
// ============================================

export const clientStatusEnum = ['ativo', 'cancelado'] as const;
export type ClientStatus = typeof clientStatusEnum[number];

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cnpj: text("cnpj"),
  status: text("status").$type<ClientStatus>().default('ativo'),
  additionalInfo: text("additional_info"),
  linkedClientCnpj: text("linked_client_cnpj"),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export const credentials = pgTable("credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 100 }).notNull(),
  platform: text("platform").notNull(),
  username: text("username"),
  password: text("password"),
  accessUrl: text("access_url"),
  observations: text("observations"),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCredentialSchema = createInsertSchema(credentials).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type Credential = typeof credentials.$inferSelect;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;

// ============================================
// Conhecimentos Module - Courses
// ============================================

export const courseStatusEnum = ['ativo', 'vitalicio', 'cancelado', 'sem_status'] as const;
export type CourseStatus = typeof courseStatusEnum[number];

export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  status: text("status").$type<CourseStatus>().default('sem_status'),
  temaPrincipal: text("tema_principal"),
  plataforma: text("plataforma"),
  url: text("url"),
  login: text("login"),
  senha: text("senha"),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCourseSchema = createInsertSchema(courses).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;

// ============================================
// Benefícios Module - Benefits
// ============================================

export const benefitSegmentEnum = ['alimentos', 'beleza_cosmeticos', 'casa_cozinha', 'tecnologia', 'pet', 'plantas_agro', 'suplementacao', 'moda'] as const;
export type BenefitSegment = typeof benefitSegmentEnum[number];

export const benefits = pgTable("benefits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresa: text("empresa").notNull(),
  cupom: text("cupom"),
  desconto: text("desconto"),
  site: text("site"),
  segmento: text("segmento").$type<BenefitSegment>(),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBenefitSchema = createInsertSchema(benefits).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type Benefit = typeof benefits.$inferSelect;
export type InsertBenefit = z.infer<typeof insertBenefitSchema>;

// ============================================
// Ferramentas Module - Turbo Tools
// ============================================

export const recorrenciaEnum = ['Mensal', 'Anual'] as const;
export type Recorrencia = typeof recorrenciaEnum[number];

export const turboTools = pgTable("turbo_tools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  login: text("login"),
  password: text("password"),
  site: text("site"),
  observations: text("observations"),
  valor: decimal("valor"),
  recorrencia: text("recorrencia").$type<Recorrencia>(),
  dataPrimeiroPagamento: date("data_primeiro_pagamento"),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTurboToolSchema = createInsertSchema(turboTools).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type TurboTool = typeof turboTools.$inferSelect;
export type InsertTurboTool = z.infer<typeof insertTurboToolSchema>;

// ============================================
// Access Logs Module - Audit Trail
// ============================================

export const accessLogActionEnum = ['view_password', 'copy_password', 'add_credential', 'edit_credential', 'delete_credential', 'add_client', 'edit_client', 'delete_client'] as const;
export type AccessLogAction = typeof accessLogActionEnum[number];

export const accessLogs = pgTable("access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").$type<AccessLogAction>().notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }),
  entityName: text("entity_name"),
  clientId: varchar("client_id", { length: 100 }),
  clientName: text("client_name"),
  details: text("details"),
  userEmail: varchar("user_email", { length: 255 }),
  userName: varchar("user_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAccessLogSchema = createInsertSchema(accessLogs).omit({ 
  id: true, 
  createdAt: true 
});

export type AccessLog = typeof accessLogs.$inferSelect;
export type InsertAccessLog = z.infer<typeof insertAccessLogSchema>;

// ============================================
// Telefones Module - Linhas Telefônicas
// ============================================

export const rhTelefones = pgTable("rh_telefones", {
  id: integer("id").primaryKey(),
  conta: varchar("conta", { length: 50 }),
  planoOperadora: varchar("plano_operadora", { length: 50 }),
  telefone: varchar("telefone", { length: 20 }),
  responsavelNome: varchar("responsavel_nome", { length: 150 }),
  responsavelId: integer("responsavel_id"),
  setor: varchar("setor", { length: 100 }),
  ultimaRecarga: date("ultima_recarga"),
  status: varchar("status", { length: 20 }),
});

export const insertTelefoneSchema = createInsertSchema(rhTelefones).omit({ 
  id: true 
});

export type Telefone = typeof rhTelefones.$inferSelect;
export type InsertTelefone = z.infer<typeof insertTelefoneSchema>;

// ============================================
// Notifications Module - System Notifications
// ============================================

export const notifications = pgTable("staging.notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityId: text("entity_id"),
  entityType: text("entity_type"),
  priority: text("priority").default("medium"),
  read: boolean("read").default(false),
  dismissed: boolean("dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  uniqueKey: text("unique_key").unique(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type NotificationPriority = "high" | "medium" | "low";

export interface NotificationRuleConfig {
  inadimplencia?: {
    diasAtraso: number;
    valorMinimo: number;
    priority: NotificationPriority;
  };
  contrato_vencendo?: {
    diasAntecedencia: number;
    priority: NotificationPriority;
  };
  aniversario?: {
    diasAntecedencia: number;
    priority: NotificationPriority;
  };
}

// ============================================
// Atendimento Module - WhatsApp Group Chat Management
// ============================================

export const canalAtendimentoEnum = ['operacao', 'cxcs', 'financeiro'] as const;
export type CanalAtendimento = typeof canalAtendimentoEnum[number];

export const atendimentoCanais = pgTable("atendimento_canais", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codigo: varchar("codigo", { length: 20 }).notNull().unique(),
  nome: varchar("nome", { length: 100 }).notNull(),
  whatsappNumero: varchar("whatsapp_numero", { length: 20 }),
  descricao: text("descricao"),
  icone: varchar("icone", { length: 50 }),
  cor: varchar("cor", { length: 20 }),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAtendimentoCanalSchema = createInsertSchema(atendimentoCanais).omit({ 
  id: true, 
  createdAt: true 
});
export type AtendimentoCanal = typeof atendimentoCanais.$inferSelect;
export type InsertAtendimentoCanal = z.infer<typeof insertAtendimentoCanalSchema>;

export const atendimentoConversas = pgTable("atendimento_conversas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  canalId: varchar("canal_id", { length: 100 }).notNull(),
  clienteId: integer("cliente_id"),
  clienteNome: varchar("cliente_nome", { length: 255 }),
  clienteCnpj: varchar("cliente_cnpj", { length: 20 }),
  clienteSquad: varchar("cliente_squad", { length: 100 }),
  clienteResponsavel: varchar("cliente_responsavel", { length: 255 }),
  whatsappGrupoId: varchar("whatsapp_grupo_id", { length: 100 }),
  whatsappGrupoNome: varchar("whatsapp_grupo_nome", { length: 255 }),
  ultimaMensagem: text("ultima_mensagem"),
  ultimaMensagemData: timestamp("ultima_mensagem_data"),
  ultimaMensagemRemetente: varchar("ultima_mensagem_remetente", { length: 255 }),
  naoLidas: integer("nao_lidas").default(0),
  status: varchar("status", { length: 20 }).default("aberta"),
  atribuidoA: varchar("atribuido_a", { length: 255 }),
  vinculadoEm: timestamp("vinculado_em"),
  vinculadoPor: varchar("vinculado_por", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAtendimentoConversaSchema = createInsertSchema(atendimentoConversas).omit({ 
  id: true, 
  createdAt: true 
});
export type AtendimentoConversa = typeof atendimentoConversas.$inferSelect;
export type InsertAtendimentoConversa = z.infer<typeof insertAtendimentoConversaSchema>;

export const atendimentoMensagens = pgTable("atendimento_mensagens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversaId: varchar("conversa_id", { length: 100 }).notNull(),
  whatsappMessageId: varchar("whatsapp_message_id", { length: 100 }),
  remetente: varchar("remetente", { length: 255 }).notNull(),
  remetenteTelefone: varchar("remetente_telefone", { length: 20 }),
  remetenteTipo: varchar("remetente_tipo", { length: 20 }).notNull(),
  conteudo: text("conteudo").notNull(),
  tipo: varchar("tipo", { length: 20 }).default("text"),
  anexoUrl: text("anexo_url"),
  anexoNome: varchar("anexo_nome", { length: 255 }),
  lida: boolean("lida").default(false),
  messageTimestamp: timestamp("message_timestamp"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAtendimentoMensagemSchema = createInsertSchema(atendimentoMensagens).omit({ 
  id: true, 
  createdAt: true 
});
export type AtendimentoMensagem = typeof atendimentoMensagens.$inferSelect;
export type InsertAtendimentoMensagem = z.infer<typeof insertAtendimentoMensagemSchema>;

export type TimelineEventType = 'payment_received' | 'payment_due' | 'payment_overdue' | 'contract_started' | 'contract_ended' | 'contract_cancelled';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  title: string;
  description: string;
  amount?: number;
  metadata?: Record<string, any>;
}

export type ClientAlertType = 'inadimplencia' | 'vencimento_proximo' | 'contrato_expirando' | 'cliente_inativo';
export type ClientAlertSeverity = 'critical' | 'warning' | 'info';

export interface ClientAlert {
  id: string;
  type: ClientAlertType;
  severity: ClientAlertSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

// ==================== COHORT TYPES ====================

export type CohortMetricType = 'logo_retention' | 'revenue_retention' | 'nrr';
export type CohortViewMode = 'percentage' | 'absolute';

export interface CohortCell {
  value: number;
  percentage: number;
  clientCount: number;
  color: 'green' | 'yellow' | 'red' | 'neutral';
}

export interface CohortRow {
  cohortMonth: string;
  cohortLabel: string;
  baselineClients: number;
  baselineRevenue: number;
  cells: Record<number, CohortCell>;
}

export interface CohortData {
  rows: CohortRow[];
  maxMonthOffset: number;
  filters: CohortFilters;
  summary: {
    totalCohorts: number;
    avgRetentionM1: number;
    avgRetentionM3: number;
    avgRetentionM6: number;
    avgRetentionM12: number;
  };
}

export interface CohortFilters {
  startDate?: string;
  endDate?: string;
  produto?: string;
  squad?: string;
  metricType: CohortMetricType;
}

export const cohortFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  produto: z.string().optional(),
  squad: z.string().optional(),
  metricType: z.enum(['logo_retention', 'revenue_retention', 'nrr']).default('revenue_retention'),
});

// ==================== SYSTEM FIELD OPTIONS ====================

export const systemFieldOptions = pgTable("system_field_options", {
  id: serial("id").primaryKey(),
  fieldType: text("field_type").notNull(),
  value: text("value").notNull(),
  label: text("label").notNull(),
  color: text("color"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSystemFieldOptionSchema = createInsertSchema(systemFieldOptions).omit({
  id: true,
  createdAt: true,
});

export type SystemFieldOption = typeof systemFieldOptions.$inferSelect;
export type InsertSystemFieldOption = z.infer<typeof insertSystemFieldOptionSchema>;

// ==================== NOTIFICATION RULES ====================

export const notificationRules = pgTable("notification_rules", {
  id: serial("id").primaryKey(),
  ruleType: text("rule_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isEnabled: boolean("is_enabled").default(true),
  config: text("config"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNotificationRuleSchema = createInsertSchema(notificationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateNotificationRuleSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
  config: z.string().optional(),
});

export type NotificationRule = typeof notificationRules.$inferSelect;
export type InsertNotificationRule = z.infer<typeof insertNotificationRuleSchema>;
export type UpdateNotificationRule = z.infer<typeof updateNotificationRuleSchema>;

// ==================== 1x1 (ONE-ON-ONE) ====================

export const oneOnOne = pgTable("rh_one_on_one", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaborador_id").notNull(),
  gestorId: integer("gestor_id"),
  data: date("data").notNull(),
  pauta: text("pauta"),
  notas: text("notas"),
  criadoEm: timestamp("criado_em").defaultNow(),
  criadoPor: text("criado_por"),
});

export const oneOnOneAcoes = pgTable("rh_one_on_one_acoes", {
  id: serial("id").primaryKey(),
  oneOnOneId: integer("one_on_one_id").notNull(),
  descricao: text("descricao").notNull(),
  responsavel: text("responsavel"),
  prazo: date("prazo"),
  status: text("status").default("pendente"),
  concluidaEm: timestamp("concluida_em"),
});

export const insertOneOnOneSchema = createInsertSchema(oneOnOne).omit({ id: true, criadoEm: true });
export const insertOneOnOneAcaoSchema = createInsertSchema(oneOnOneAcoes).omit({ id: true });

export type OneOnOne = typeof oneOnOne.$inferSelect;
export type InsertOneOnOne = z.infer<typeof insertOneOnOneSchema>;
export type OneOnOneAcao = typeof oneOnOneAcoes.$inferSelect;
export type InsertOneOnOneAcao = z.infer<typeof insertOneOnOneAcaoSchema>;

// ==================== E-NPS ====================

export const enpsResponses = pgTable("rh_enps", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaborador_id").notNull(),
  score: integer("score").notNull(),
  comentario: text("comentario"),
  data: date("data").notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
  criadoPor: text("criado_por"),
});

export const insertEnpsSchema = createInsertSchema(enpsResponses).omit({ id: true, criadoEm: true });
export type EnpsResponse = typeof enpsResponses.$inferSelect;
export type InsertEnps = z.infer<typeof insertEnpsSchema>;

// ==================== PDI (PLANO DE DESENVOLVIMENTO INDIVIDUAL) ====================

export const pdiGoals = pgTable("rh_pdi", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaborador_id").notNull(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  competencia: text("competencia"),
  categoria: text("categoria"),
  recursos: text("recursos"),
  prazo: date("prazo"),
  progresso: integer("progresso").default(0),
  status: text("status").default("em_andamento"),
  criadoEm: timestamp("criado_em").defaultNow(),
  criadoPor: text("criado_por"),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export const pdiCheckpoints = pgTable("rh_pdi_checkpoints", {
  id: serial("id").primaryKey(),
  pdiId: integer("pdi_id").notNull(),
  descricao: text("descricao").notNull(),
  dataAlvo: date("data_alvo"),
  concluido: text("concluido").default("false"),
  concluidoEm: timestamp("concluido_em"),
  ordem: integer("ordem").default(0),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export const insertPdiSchema = createInsertSchema(pdiGoals).omit({ id: true, criadoEm: true, atualizadoEm: true });
export const insertPdiCheckpointSchema = createInsertSchema(pdiCheckpoints).omit({ id: true, criadoEm: true, concluidoEm: true });
export type PdiGoal = typeof pdiGoals.$inferSelect;
export type InsertPdi = z.infer<typeof insertPdiSchema>;
export type PdiCheckpoint = typeof pdiCheckpoints.$inferSelect;
export type InsertPdiCheckpoint = z.infer<typeof insertPdiCheckpointSchema>;

// ==================== TURBO CALENDAR ====================

export const turboEventos = pgTable("turbo_eventos", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  tipo: text("tipo").notNull(), // 'confraternizacao', 'reuniao_resultado', 'workshop', 'outro'
  dataInicio: timestamp("data_inicio").notNull(),
  dataFim: timestamp("data_fim"),
  local: text("local"),
  organizadorId: integer("organizador_id"),
  organizadorNome: text("organizador_nome"),
  cor: text("cor").default("#f97316"), // Orange as default (Turbo brand)
  criadoEm: timestamp("criado_em").defaultNow(),
  criadoPor: text("criado_por"),
});

export const insertTurboEventoSchema = createInsertSchema(turboEventos).omit({ id: true, criadoEm: true });
export type TurboEvento = typeof turboEventos.$inferSelect;
export type InsertTurboEvento = z.infer<typeof insertTurboEventoSchema>;

// ==================== METAS POR SQUAD ====================

export const squadMetas = pgTable("squad_metas", {
  id: serial("id").primaryKey(),
  squad: varchar("squad", { length: 100 }).notNull(),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(),
  metaMrr: decimal("meta_mrr"),
  metaNovosClientes: integer("meta_novos_clientes"),
  metaRetencao: decimal("meta_retencao"),
  metaTicketMedio: decimal("meta_ticket_medio"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
  criadoPor: text("criado_por"),
});

export const insertSquadMetaSchema = createInsertSchema(squadMetas).omit({ id: true, criadoEm: true, atualizadoEm: true });
export type SquadMeta = typeof squadMetas.$inferSelect;
export type InsertSquadMeta = z.infer<typeof insertSquadMetaSchema>;

// ==================== USER NOTIFICATIONS ====================

export const userNotifications = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  entityId: text("entity_id"),
  entityType: text("entity_type"),
  priority: text("priority").default("medium"),
  read: boolean("read").default(false),
  dismissed: boolean("dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({ id: true, createdAt: true });
export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;

// ==================== JURÍDICO - REGRAS DE ESCALONAMENTO ====================

export const juridicoRegrasEscalonamento = pgTable("juridico_regras_escalonamento", {
  id: serial("id").primaryKey(),
  diasAtrasoMin: integer("dias_atraso_min").notNull(),
  diasAtrasoMax: integer("dias_atraso_max"),
  procedimentoSugerido: text("procedimento_sugerido").notNull(),
  prioridade: integer("prioridade").notNull().default(1),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJuridicoRegraSchema = createInsertSchema(juridicoRegrasEscalonamento).omit({ id: true, createdAt: true });
export type JuridicoRegraEscalonamento = typeof juridicoRegrasEscalonamento.$inferSelect;
export type InsertJuridicoRegraEscalonamento = z.infer<typeof insertJuridicoRegraSchema>;

// ==================== ONBOARDING RH ====================

export const onboardingTemplates = pgTable("onboarding_templates", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 200 }).notNull(),
  descricao: text("descricao"),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const onboardingEtapas = pgTable("onboarding_etapas", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull(),
  ordem: integer("ordem").notNull(),
  titulo: varchar("titulo", { length: 200 }).notNull(),
  descricao: text("descricao"),
  responsavelPadrao: varchar("responsavel_padrao", { length: 100 }),
  prazoDias: integer("prazo_dias"),
});

export const onboardingColaborador = pgTable("onboarding_colaborador", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaborador_id").notNull(),
  templateId: integer("template_id").notNull(),
  dataInicio: date("data_inicio").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const onboardingProgresso = pgTable("onboarding_progresso", {
  id: serial("id").primaryKey(),
  onboardingColaboradorId: integer("onboarding_colaborador_id").notNull(),
  etapaId: integer("etapa_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  responsavelId: integer("responsavel_id"),
  dataConclusao: timestamp("data_conclusao"),
  observacoes: text("observacoes"),
});

export const insertOnboardingTemplateSchema = createInsertSchema(onboardingTemplates).omit({ id: true, createdAt: true });
export const insertOnboardingEtapaSchema = createInsertSchema(onboardingEtapas).omit({ id: true });
export const insertOnboardingColaboradorSchema = createInsertSchema(onboardingColaborador).omit({ id: true, createdAt: true });
export const insertOnboardingProgressoSchema = createInsertSchema(onboardingProgresso).omit({ id: true });

export type OnboardingTemplate = typeof onboardingTemplates.$inferSelect;
export type InsertOnboardingTemplate = z.infer<typeof insertOnboardingTemplateSchema>;
export type OnboardingEtapa = typeof onboardingEtapas.$inferSelect;
export type InsertOnboardingEtapa = z.infer<typeof insertOnboardingEtapaSchema>;
export type OnboardingColaborador = typeof onboardingColaborador.$inferSelect;
export type InsertOnboardingColaborador = z.infer<typeof insertOnboardingColaboradorSchema>;
export type OnboardingProgresso = typeof onboardingProgresso.$inferSelect;
export type InsertOnboardingProgresso = z.infer<typeof insertOnboardingProgressoSchema>;

// ==================== CLIENTE EVENTOS (TIMELINE) ====================

export const clienteEventos = pgTable("cliente_eventos", {
  id: serial("id").primaryKey(),
  clienteCnpj: text("cliente_cnpj").notNull(),
  tipo: text("tipo").notNull(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  usuarioId: text("usuario_id"),
  usuarioNome: text("usuario_nome"),
  dadosExtras: text("dados_extras"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClienteEventoSchema = createInsertSchema(clienteEventos).omit({ id: true, createdAt: true });
export type InsertClienteEvento = z.infer<typeof insertClienteEventoSchema>;
export type ClienteEvento = typeof clienteEventos.$inferSelect;
