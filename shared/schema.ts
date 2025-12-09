import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, date } from "drizzle-orm/pg-core";
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
});

export type AuthUser = typeof authUsers.$inferSelect;
export type InsertAuthUser = typeof authUsers.$inferInsert;

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
