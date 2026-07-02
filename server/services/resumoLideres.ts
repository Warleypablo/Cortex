// Resumo diário de métricas para líderes via WhatsApp.
// Spec: docs/superpowers/specs/2026-07-02-resumo-lideres-whatsapp-design.md

import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  getMrrAtivo,
  getMrrInicioMes,
  getVendasMrrBreakdown,
} from "../okr2026/metricsAdapter";
import { enviarMensagemWhatsApp } from "./turbozap";

export interface MetricasResumo {
  mrrAtivo: number;
  entregaPontual: number;
  churn: number;
  churnPct: number; // 0-100
  emCancelamento: number;
  crossR: number;
  crossP: number; // pontual bruto
  crossPAmortizado: number; // crossP / 5
  crossTotal: number; // crossR + crossPAmortizado
  netChurn: number; // churn - crossTotal
  netChurnPct: number; // 0-100
  mrrInicioMes: number;
}

export function formatarMoedaBR(valor: number): string {
  return (
    "R$ " +
    valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function formatarPercentBR(valor: number): string {
  return (
    valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
  );
}

export function formatarMensagemResumo(
  m: MetricasResumo,
  agora: { dataFmt: string; horaFmt: string },
): string {
  return `Bom dia líderes!!!
Atualizações sobre nossas métricas principais, dia ${agora.dataFmt}, ${agora.horaFmt}.

MRR: ${formatarMoedaBR(m.mrrAtivo)}
Entrega Pontual: ${formatarMoedaBR(m.entregaPontual)}

Churn: ${formatarMoedaBR(m.churn)} - *${formatarPercentBR(m.churnPct)}*
Em cancelamento: ${formatarMoedaBR(m.emCancelamento)}

Cross R: ${formatarMoedaBR(m.crossR)}
Cross P: ${formatarMoedaBR(m.crossP)} / 5 = ${formatarMoedaBR(m.crossPAmortizado)}
Total: ${formatarMoedaBR(m.crossR)} + ${formatarMoedaBR(m.crossPAmortizado)} = ${formatarMoedaBR(m.crossTotal)}

Net Churn: ${formatarMoedaBR(m.netChurn)} - *${formatarPercentBR(m.netChurnPct)}*

*OBS 1: Bora buscar mais cross*
*OBS 2: Bora reter*
*OBS 3: Não sai mais ninguém*`;
}

export function agoraSaoPaulo(date: Date = new Date()): {
  dataRef: string;
  dataFmt: string;
  hora: number;
  horaFmt: string;
  diaSemana: number; // 0=dom ... 6=sáb
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hora = parseInt(get("hour"), 10) % 24; // hour12:false pode devolver "24" à meia-noite
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(date);
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    dataRef: `${get("year")}-${get("month")}-${get("day")}`,
    dataFmt: `${get("day")}/${get("month")}`,
    hora,
    horaFmt: `${hora}h`,
    diaSemana: weekdayMap[weekday] ?? 0,
  };
}

// ============================================
// Cálculo das métricas (mês corrente em America/Sao_Paulo)
// ============================================

async function getChurnMesBruto(): Promise<number> {
  // Churn BRUTO (inclui abonados) — alinhado ao card do ClickUp
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(valor_r), 0) AS churn
    FROM "Clickup".cup_churn
    WHERE data_solicitacao_encerramento >= date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo'))::date
      AND data_solicitacao_encerramento < (date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 month')::date
  `);
  return parseFloat((result.rows[0] as any)?.churn || "0");
}

async function getEmCancelamento(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(valorr), 0) AS total
    FROM "Clickup".cup_contratos
    WHERE status = 'em cancelamento' AND valorr > 0
  `);
  return parseFloat((result.rows[0] as any)?.total || "0");
}

async function getEntregaPontualMes(): Promise<number> {
  // Contratos que PASSARAM a 'entregue' no mês: live = 'entregue' e no snapshot
  // do dia 1º não era 'entregue' (ou nem existia — criado e entregue no mês).
  const result = await db.execute(sql`
    WITH primeiro_snapshot AS (
      SELECT MIN(data_snapshot) AS d
      FROM "Clickup".cup_data_hist
      WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')
    )
    SELECT COALESCE(SUM(c.valorp), 0) AS total
    FROM "Clickup".cup_contratos c
    LEFT JOIN "Clickup".cup_data_hist h
      ON h.id_subtask = c.id_subtask
     AND h.data_snapshot = (SELECT d FROM primeiro_snapshot)
    WHERE c.status = 'entregue'
      AND c.valorp > 0
      AND (h.id_subtask IS NULL OR h.status <> 'entregue')
  `);
  return parseFloat((result.rows[0] as any)?.total || "0");
}

export async function calcularMetricasResumo(): Promise<MetricasResumo> {
  const [mrrAtivo, mrrInicioMes, breakdown, churn, emCancelamento, entregaPontual] =
    await Promise.all([
      getMrrAtivo(),
      getMrrInicioMes(),
      getVendasMrrBreakdown(),
      getChurnMesBruto(),
      getEmCancelamento(),
      getEntregaPontualMes(),
    ]);

  // metricsAdapter engole erros retornando 0 — nunca enviar mensagem com métricas parciais
  if (mrrAtivo <= 0 || mrrInicioMes <= 0) {
    throw new Error(
      `Métricas base inválidas (mrrAtivo=${mrrAtivo}, mrrInicioMes=${mrrInicioMes}) — envio abortado`,
    );
  }

  const crossR = breakdown.crosssell;
  const crossP = breakdown.crosssell_pontual;
  const crossPAmortizado = crossP / 5;
  const crossTotal = crossR + crossPAmortizado;
  const netChurn = churn - crossTotal;

  return {
    mrrAtivo,
    entregaPontual,
    churn,
    churnPct: (churn / mrrInicioMes) * 100,
    emCancelamento,
    crossR,
    crossP,
    crossPAmortizado,
    crossTotal,
    netChurn,
    netChurnPct: (netChurn / mrrInicioMes) * 100,
    mrrInicioMes,
  };
}

// ============================================
// Idempotência + envio
// ============================================

export async function initResumoLideresTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.resumo_lideres_envios (
      id SERIAL PRIMARY KEY,
      data_ref DATE NOT NULL,
      destino TEXT,
      mensagem TEXT,
      status TEXT NOT NULL DEFAULT 'ok',
      erro TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function jaEnviadoHoje(dataRef: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM cortex_core.resumo_lideres_envios
    WHERE data_ref = ${dataRef} AND status = 'ok'
    LIMIT 1
  `);
  return result.rows.length > 0;
}

async function registrarEnvio(
  dataRef: string,
  destino: string,
  mensagem: string,
  status: "ok" | "erro",
  erro?: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.resumo_lideres_envios (data_ref, destino, mensagem, status, erro)
    VALUES (${dataRef}, ${destino}, ${mensagem}, ${status}, ${erro ?? null})
  `);
}

export async function enviarResumoLideres(
  opts: { force?: boolean } = {},
): Promise<{ success: boolean; skipped?: boolean; mensagem?: string; error?: string }> {
  const destino = process.env.RESUMO_LIDERES_DESTINO;
  if (!destino) {
    return { success: false, error: "RESUMO_LIDERES_DESTINO não configurado" };
  }

  const sp = agoraSaoPaulo();
  if (!opts.force && (await jaEnviadoHoje(sp.dataRef))) {
    return { success: true, skipped: true };
  }

  let mensagem: string;
  try {
    const metricas = await calcularMetricasResumo();
    mensagem = formatarMensagemResumo(metricas, sp);
  } catch (err: any) {
    // Falha de cálculo não registra na tabela — sem envio, o retry fica livre
    console.error("[resumo-lideres] Falha ao calcular métricas:", err.message);
    return { success: false, error: err.message };
  }

  const instancia: "financeiro" | "juridico" =
    process.env.RESUMO_LIDERES_INSTANCIA === "juridico" ? "juridico" : "financeiro";
  const resultado = await enviarMensagemWhatsApp(destino, mensagem, instancia);

  await registrarEnvio(
    sp.dataRef,
    destino,
    mensagem,
    resultado.success ? "ok" : "erro",
    resultado.error,
  );

  if (!resultado.success) {
    console.error("[resumo-lideres] Falha no envio:", resultado.error);
    return { success: false, error: resultado.error, mensagem };
  }
  return { success: true, mensagem };
}
