import { z } from 'zod';

// ========== Auth ==========

export const externalLoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export const clientLoginSchema = z.object({
  cnpj: z.string().min(1, 'CNPJ obrigatório'),
  password: z.string().min(1, 'Senha obrigatória'),
});

// ========== User Management ==========

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(200),
  email: z.string().email('Email inválido'),
  role: z.enum(['admin', 'user']).default('user'),
  allowedRoutes: z.array(z.string()).optional().default([]),
});

export const updatePermissionsSchema = z.object({
  allowedRoutes: z.array(z.string()),
});

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'user']),
});

// ========== Client ==========

export const updateClienteSchema = z.object({
  cnpj: z.string().optional(),
  telefone: z.string().max(50).optional(),
  responsavel: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  site: z.string().max(500).optional(),
  segmento: z.string().max(200).optional(),
  tipo_negocio: z.string().max(100).optional(),
  status_conta: z.string().max(100).optional(),
  cluster: z.string().max(50).optional(),
  notas: z.string().max(5000).optional(),
}).passthrough(); // Allow additional fields we haven't mapped yet

export const updateStatusContaSchema = z.object({
  status: z.string().min(1).max(100),
}).passthrough();

// ========== Inadimplência ==========

export const upsertInadimplenciaContextoSchema = z.object({
  contexto: z.string().max(5000).optional(),
  evidencias: z.string().max(5000).optional(),
  acao: z.string().max(2000).optional(),
  statusFinanceiro: z.string().max(200).optional(),
  detalheFinanceiro: z.string().max(5000).optional(),
});

export const upsertContextoJuridicoSchema = z.object({
  contextoJuridico: z.string().max(5000).optional(),
  procedimentoJuridico: z.string().max(2000).optional(),
  statusJuridico: z.string().max(200).optional(),
  valorAcordado: z.number().nullable().optional(),
  tipoInadimplencia: z.string().max(200).optional(),
});

// ========== System Settings ==========

export const updateSystemSettingSchema = z.object({
  value: z.unknown(),
});

// ========== Chamados ==========

export const createChamadoSchema = z.object({
  titulo: z.string().min(1, 'Título obrigatório').max(500),
  descricao: z.string().max(10000).optional().default(''),
  area: z.string().min(1).max(100),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']).default('media'),
  cliente_nome: z.string().max(500).optional(),
  cliente_cnpj: z.string().max(50).optional(),
}).passthrough();

export const updateChamadoSchema = z.object({
  status: z.string().max(100).optional(),
  responsavel_id: z.union([z.string(), z.number()]).optional(),
  responsavel_nome: z.string().max(200).optional(),
  responsavel_email: z.string().email().optional().or(z.literal('')),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
}).passthrough();

// ========== Notification Rules ==========

export const createNotificationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  metricKey: z.string().min(1).max(100),
  condition: z.enum(['above', 'below', 'equals', 'between']),
  threshold: z.number(),
  thresholdMax: z.number().optional(),
  recipients: z.array(z.string().email()).min(1),
  active: z.boolean().default(true),
}).passthrough();
