/**
 * Regras de cadência e fadiga de base.
 *
 * Fonte: dashboard-broadcast (estagiário, mai/2026), arquivo regrasCalendario.js.
 * Fonte primária: doc interno `04_calendario_rotacao.md`.
 *
 * Regra crítica Turbo: mesma base só pode ser disparada 1× por semana.
 */

import type { Alerta, PadraoKey, ResultadoValidacao, StatusMensagem, StatusValidacao } from "./types";

// ── LIMITES MENSAIS POR BASE ───────────────────────────────────────────────

export const LIMITES_MENSAIS: Record<string, number> = {
  // Premium (queimam rápido)
  Clientes: 2,
  "Creators - MQLs": 3,
  // Principais (volume médio)
  "Geral - MQLs": 4,
  "CRM - MQLs": 4,
  "Creators - Entre 30k a 100k": 3,
  "Geral - Entre 30k a 100k": 3,
  "Contatos Espírito Santo": 2,
  // Reativação (alta sensibilidade)
  Congelados: 2,
  // Amplas
  "Geral - Todos": 2,
  "CRM - Todos": 2,
  "Creators - Todos": 3,
  // Nutrição (sem oferta direta — toleram mais)
  "Geral - Abaixo de 30k": 4,
  "Creators - Abaixo de 30k": 4,
};

const DEFAULT_LIMITE_MENSAL = 3;

export function limiteMensal(base: string): number {
  return LIMITES_MENSAIS[base] ?? DEFAULT_LIMITE_MENSAL;
}

// ── DISPARO HISTÓRICO (formato esperado) ───────────────────────────────────

export interface DisparoHistorico {
  base: string;
  /** YYYY-MM-DD */
  data: string;
  status: StatusMensagem;
  padrao?: PadraoKey;
  /** Quando true, disparo conta como 1 unidade (não viola janela 7d entre convite e lembrete). */
  isCampanhaEvento?: boolean;
}

// ── REGRA DE 7 DIAS (a mais rígida) ────────────────────────────────────────

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const STATUS_CONTAM = new Set<StatusMensagem>(["agendada", "enviada"]);

export interface JanelaCheck {
  violado: boolean;
  ultimoDisparo?: DisparoHistorico | null;
}

export function verificaJanela7Dias(
  base: string,
  dataAlvo: string,
  disparosHistoricos: DisparoHistorico[],
): JanelaCheck {
  const alvo = new Date(dataAlvo).getTime();
  const recentes = disparosHistoricos
    .filter((d) => d.base === base)
    .filter((d) => STATUS_CONTAM.has(d.status))
    .filter((d) => !d.isCampanhaEvento)
    .filter((d) => Math.abs(alvo - new Date(d.data).getTime()) < SETE_DIAS_MS)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return { violado: recentes.length > 0, ultimoDisparo: recentes[0] || null };
}

// ── REGRA DE 14 DIAS POR PADRÃO ────────────────────────────────────────────

const CATORZE_DIAS_MS = 14 * 24 * 60 * 60 * 1000;

export function verificaJanela14DiasPadrao(
  base: string,
  padrao: PadraoKey,
  dataAlvo: string,
  disparosHistoricos: DisparoHistorico[],
): JanelaCheck {
  const alvo = new Date(dataAlvo).getTime();
  const recentes = disparosHistoricos
    .filter((d) => d.base === base && d.padrao === padrao)
    .filter((d) => STATUS_CONTAM.has(d.status))
    .filter((d) => Math.abs(alvo - new Date(d.data).getTime()) < CATORZE_DIAS_MS)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return { violado: recentes.length > 0, ultimoDisparo: recentes[0] || null };
}

// ── LIMITE MENSAL ──────────────────────────────────────────────────────────

export function disparosNoMes(
  base: string,
  dataReferencia: string,
  disparosHistoricos: DisparoHistorico[],
): number {
  const ref = new Date(dataReferencia);
  const ano = ref.getFullYear();
  const mes = ref.getMonth();

  return disparosHistoricos.filter((d) => {
    if (d.base !== base) return false;
    if (!STATUS_CONTAM.has(d.status)) return false;
    const dt = new Date(d.data);
    return dt.getFullYear() === ano && dt.getMonth() === mes;
  }).length;
}

export interface LimiteMensalCheck {
  violado: boolean;
  atual: number;
  limite: number;
}

export function verificaLimiteMensal(
  base: string,
  dataAlvo: string,
  disparosHistoricos: DisparoHistorico[],
): LimiteMensalCheck {
  const limite = limiteMensal(base);
  const atual = disparosNoMes(base, dataAlvo, disparosHistoricos);
  return { violado: atual >= limite, atual, limite };
}

// ── VALIDAÇÃO COMBINADA ────────────────────────────────────────────────────

export interface ContextoCadencia {
  base: string;
  padrao?: PadraoKey;
  data: string;
  disparosHistoricos: DisparoHistorico[];
  isCampanhaEvento?: boolean;
}

export function validarCadencia(ctx: ContextoCadencia): ResultadoValidacao {
  const { base, padrao, data, disparosHistoricos } = ctx;
  const alertas: Alerta[] = [];
  const sugestoes: string[] = [];

  // 1. Janela 7 dias (BLOCK)
  const j7 = verificaJanela7Dias(base, data, disparosHistoricos);
  if (j7.violado && j7.ultimoDisparo) {
    const diasAtras = Math.floor(
      (new Date(data).getTime() - new Date(j7.ultimoDisparo.data).getTime()) / (1000 * 60 * 60 * 24),
    );
    alertas.push({
      tipo: "cadencia",
      nivel: "block",
      chave: "janela_7_dias",
      mensagem: `Base "${base}" já foi disparada há ${diasAtras} dia(s) (em ${j7.ultimoDisparo.data}). Mesma base não pode receber 2 broadcasts na mesma semana.`,
    });
  }

  // 2. Janela 14 dias por padrão (BLOCK)
  if (padrao) {
    const j14 = verificaJanela14DiasPadrao(base, padrao, data, disparosHistoricos);
    if (j14.violado && j14.ultimoDisparo) {
      const diasAtras = Math.floor(
        (new Date(data).getTime() - new Date(j14.ultimoDisparo.data).getTime()) / (1000 * 60 * 60 * 24),
      );
      alertas.push({
        tipo: "cadencia",
        nivel: "block",
        chave: "padrao_14_dias",
        mensagem: `Mesma combinação base+padrão (${base} × ${padrao}) já foi usada há ${diasAtras} dia(s). Padrão satura em menos de 14 dias.`,
      });
    }
  }

  // 3. Limite mensal
  const lim = verificaLimiteMensal(base, data, disparosHistoricos);
  if (lim.violado) {
    alertas.push({
      tipo: "cadencia",
      nivel: "block",
      chave: "limite_mensal",
      mensagem: `Base "${base}" já recebeu ${lim.atual}/${lim.limite} disparos neste mês. Limite atingido.`,
    });
  } else if (lim.atual === lim.limite - 1) {
    alertas.push({
      tipo: "cadencia",
      nivel: "warn",
      chave: "limite_mensal_proximo",
      mensagem: `Esse será o último disparo permitido pra "${base}" neste mês (${lim.atual + 1}/${lim.limite}).`,
    });
  }

  let status: StatusValidacao = "ok";
  if (alertas.some((a) => a.nivel === "block")) status = "block";
  else if (alertas.some((a) => a.nivel === "warn")) status = "warn";

  return { status, alertas, sugestoes };
}
