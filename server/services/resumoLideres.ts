// Resumo diário de métricas para líderes via WhatsApp.
// Spec: docs/superpowers/specs/2026-07-02-resumo-lideres-whatsapp-design.md
// Modelo v2 (2026-07-03): MRR total×ativo, churn pontual, churn com/sem motivos
// operacionais, net churn sobre o churn ajustado. Cross R×P = campos do Bitrix.

import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  getMrrAtivo,
  getMrrInicioMes,
  getVendasMrrBreakdown,
} from "../okr2026/metricsAdapter";
import { enviarMensagemWhatsApp } from "./turbozap";

export interface MetricasResumo {
  mrrTotal: number; // ativo + onboarding + triagem (live)
  mrrAtivo: number; // só status 'ativo' (live)
  entregaPontual: number; // valorp dos contratos que viraram 'entregue' no mês
  churnPontual: number; // valorp dos contratos pontuais com pedido de churn no mês
  churnPontualAjustado: number; // idem, sem os motivos operacionais
  mrrMesAnterior: number; // snapshot do 1º do mês = fechamento do mês anterior (base dos %)
  churnTotal: number; // valor_r bruto de cup_churn no mês
  churnTotalPct: number; // 0-100
  churnAjustado: number; // sem os motivos operacionais
  churnAjustadoPct: number; // 0-100
  crossR: number;
  crossP: number;
  crossPAmortizado: number; // crossP / 5
  crossTotal: number; // crossR + crossPAmortizado
  netChurn: number; // churnAjustado - crossTotal
  netChurnPct: number; // 0-100
}

// Motivos excluídos das versões "ajustadas" (erros de venda/começo, não churn real)
const MOTIVOS_EXCLUIDOS = sql`('Erro na Venda', 'Não começou', 'Inadimplente 1º Mês')`;

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

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

function saudacao(hora: number): string {
  if (hora < 12) return "Bom DIA";
  if (hora < 18) return "Boa TARDE";
  return "Boa NOITE";
}

export function formatarMensagemResumo(
  m: MetricasResumo,
  agora: { dataFmt: string; horaFmt: string; hora: number; mes: number },
): string {
  const mes = MESES[agora.mes - 1];
  const mesAnterior = MESES[(agora.mes + 10) % 12];
  const crossRTexto = m.crossR > 0 ? formatarMoedaBR(m.crossR) : "ZERO";
  const crossPTexto =
    m.crossP > 0
      ? `${formatarMoedaBR(m.crossP)} / 5 = ${formatarMoedaBR(m.crossPAmortizado)}`
      : "ZERO";

  return `${saudacao(agora.hora)} líderes!!!
Atualizações sobre nossas métricas principais, dia *${agora.dataFmt}, ${agora.horaFmt}*.


MRR ${mes} TOTAL: ${formatarMoedaBR(m.mrrTotal)}
MRR ${mes} ATIVO: ${formatarMoedaBR(m.mrrAtivo)}
Entrega Pontual ${mes}: ${formatarMoedaBR(m.entregaPontual)}

Churn Pontual ${mes}: ${formatarMoedaBR(m.churnPontual)}
Churn Pontual ${mes} (sem erro de venda, não começou e inadimplente 1 mês): ${formatarMoedaBR(m.churnPontualAjustado)}

MRR ${mesAnterior}: ${formatarMoedaBR(m.mrrMesAnterior)}

Churn MRR TOTAL: ${formatarMoedaBR(m.churnTotal)} - *${formatarPercentBR(m.churnTotalPct)}*
Churn MRR (sem erro de venda, não começou e inadimplente 1 mês): ${formatarMoedaBR(m.churnAjustado)} - *${formatarPercentBR(m.churnAjustadoPct)}*

Cross R: ${crossRTexto}
Cross P: ${crossPTexto}
Total: ${formatarMoedaBR(m.crossTotal)}

Net Churn: ${formatarMoedaBR(m.netChurn)} - *${formatarPercentBR(m.netChurnPct)}*


estamos de 👀`;
}

export function agoraSaoPaulo(date: Date = new Date()): {
  dataRef: string;
  dataFmt: string;
  hora: number;
  horaFmt: string;
  diaSemana: number; // 0=dom ... 6=sáb
  mes: number; // 1-12
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
    mes: parseInt(get("month"), 10),
  };
}

// ============================================
// Cálculo das métricas (mês corrente em America/Sao_Paulo)
// ============================================

async function getMrrSoAtivo(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(valorr), 0) AS mrr
    FROM "Clickup".cup_contratos
    WHERE status = 'ativo'
  `);
  return parseFloat((result.rows[0] as any)?.mrr || "0");
}

async function getChurnMes(): Promise<{ total: number; ajustado: number }> {
  // Churn BRUTO (inclui abonados) por data do pedido; "ajustado" exclui os
  // motivos operacionais (erro de venda / não começou / inadimplente 1º mês)
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(valor_r), 0) AS total,
      COALESCE(SUM(valor_r) FILTER (
        WHERE COALESCE(motivo_cancelamento, '') NOT IN ${MOTIVOS_EXCLUIDOS}
      ), 0) AS ajustado
    FROM "Clickup".cup_churn
    WHERE data_solicitacao_encerramento >= date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo'))::date
      AND data_solicitacao_encerramento < (date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 month')::date
  `);
  const row = result.rows[0] as any;
  return { total: parseFloat(row?.total || "0"), ajustado: parseFloat(row?.ajustado || "0") };
}

async function getChurnPontualMes(): Promise<{ total: number; ajustado: number }> {
  // cup_churn não tem valor_p: o valor pontual vem do contrato (join por task_id)
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(ct.valorp), 0) AS total,
      COALESCE(SUM(ct.valorp) FILTER (
        WHERE COALESCE(ch.motivo_cancelamento, '') NOT IN ${MOTIVOS_EXCLUIDOS}
      ), 0) AS ajustado
    FROM "Clickup".cup_churn ch
    JOIN "Clickup".cup_contratos ct ON ct.id_subtask = ch.task_id AND ct.valorp > 0
    WHERE ch.data_solicitacao_encerramento >= date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo'))::date
      AND ch.data_solicitacao_encerramento < (date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 month')::date
  `);
  const row = result.rows[0] as any;
  return { total: parseFloat(row?.total || "0"), ajustado: parseFloat(row?.ajustado || "0") };
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
  const [mrrTotal, mrrAtivo, mrrMesAnterior, breakdown, churn, churnPontual, entregaPontual] =
    await Promise.all([
      getMrrAtivo(), // ativo+onboarding+triagem (metricsAdapter)
      getMrrSoAtivo(),
      getMrrInicioMes(),
      getVendasMrrBreakdown(),
      getChurnMes(),
      getChurnPontualMes(),
      getEntregaPontualMes(),
    ]);

  // metricsAdapter engole erros retornando 0 — nunca enviar mensagem com métricas parciais
  if (mrrTotal <= 0 || mrrMesAnterior <= 0) {
    throw new Error(
      `Métricas base inválidas (mrrTotal=${mrrTotal}, mrrMesAnterior=${mrrMesAnterior}) — envio abortado`,
    );
  }

  const crossR = breakdown.crosssell;
  const crossP = breakdown.crosssell_pontual;
  const crossPAmortizado = crossP / 5;
  const crossTotal = crossR + crossPAmortizado;
  const netChurn = churn.ajustado - crossTotal;

  return {
    mrrTotal,
    mrrAtivo,
    entregaPontual,
    churnPontual: churnPontual.total,
    churnPontualAjustado: churnPontual.ajustado,
    mrrMesAnterior,
    churnTotal: churn.total,
    churnTotalPct: (churn.total / mrrMesAnterior) * 100,
    churnAjustado: churn.ajustado,
    churnAjustadoPct: (churn.ajustado / mrrMesAnterior) * 100,
    crossR,
    crossP,
    crossPAmortizado,
    crossTotal,
    netChurn,
    netChurnPct: (netChurn / mrrMesAnterior) * 100,
  };
}

// ============================================
// Idempotência + envio
// ============================================

export type JanelaEnvio = "10h" | "19h" | "manual";

// Janelas de envio agendado: 10h-12h e 19h-21h (retry dentro da janela)
export function janelaAtual(hora: number): "10h" | "19h" | null {
  if (hora >= 10 && hora < 12) return "10h";
  if (hora >= 19 && hora < 21) return "19h";
  return null;
}

export async function initResumoLideresTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.resumo_lideres_envios (
      id SERIAL PRIMARY KEY,
      data_ref DATE NOT NULL,
      janela TEXT,
      destino TEXT,
      mensagem TEXT,
      status TEXT NOT NULL DEFAULT 'ok',
      erro TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    ALTER TABLE cortex_core.resumo_lideres_envios ADD COLUMN IF NOT EXISTS janela TEXT
  `);
}

export interface EnvioResumo {
  id: number;
  data_ref: string;
  janela: string | null;
  destino: string | null;
  mensagem: string | null;
  status: string;
  erro: string | null;
  criado_em: string;
}

// Histórico de envios (mais recentes primeiro) para a interface de resumo dos líderes.
export async function listarEnviosResumo(limite = 50): Promise<EnvioResumo[]> {
  const result = await db.execute(sql`
    SELECT id, data_ref, janela, destino, mensagem, status, erro, criado_em
    FROM cortex_core.resumo_lideres_envios
    ORDER BY criado_em DESC
    LIMIT ${limite}
  `);
  return (result.rows ?? []) as unknown as EnvioResumo[];
}

async function jaEnviadoNaJanela(dataRef: string, janela: JanelaEnvio): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM cortex_core.resumo_lideres_envios
    WHERE data_ref = ${dataRef} AND janela = ${janela} AND status = 'ok'
    LIMIT 1
  `);
  return result.rows.length > 0;
}

async function registrarEnvio(
  dataRef: string,
  janela: JanelaEnvio,
  destino: string,
  mensagem: string,
  status: "ok" | "erro",
  erro?: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.resumo_lideres_envios (data_ref, janela, destino, mensagem, status, erro)
    VALUES (${dataRef}, ${janela}, ${destino}, ${mensagem}, ${status}, ${erro ?? null})
  `);
}

// Envio via Evolution API. Com RESUMO_LIDERES_EVOLUTION_INSTANCE/TOKEN definidos
// usa a instância dedicada do resumo (ex: glauber2); senão cai nas instâncias do
// TurboZap (financeiro/juridico). Aceita número ou JID de grupo (...@g.us).
async function enviarViaEvolution(
  numero: string,
  texto: string,
): Promise<{ success: boolean; error?: string }> {
  const serverUrl = process.env.EVOLUTION_SERVER_URL;
  const instancia = process.env.RESUMO_LIDERES_EVOLUTION_INSTANCE;
  const token = process.env.RESUMO_LIDERES_EVOLUTION_TOKEN;

  if (serverUrl && instancia && token) {
    try {
      const response = await fetch(`https://${serverUrl}/message/sendText/${instancia}`, {
        method: "POST",
        headers: { apikey: token, "Content-Type": "application/json" },
        body: JSON.stringify({
          number: numero,
          options: { delay: 100, presence: "composing" },
          text: texto,
        }),
      });
      if (response.status === 200 || response.status === 201) return { success: true };
      return { success: false, error: `HTTP ${response.status}: ${await response.text()}` };
    } catch (error: any) {
      return { success: false, error: error.message || "Erro de conexão" };
    }
  }

  const instanciaTz: "financeiro" | "juridico" =
    process.env.RESUMO_LIDERES_INSTANCIA === "juridico" ? "juridico" : "financeiro";
  return enviarMensagemWhatsApp(numero, texto, instanciaTz);
}

export async function enviarResumoLideres(
  opts: { force?: boolean; janela?: JanelaEnvio } = {},
): Promise<{ success: boolean; skipped?: boolean; mensagem?: string; error?: string }> {
  const destino = process.env.RESUMO_LIDERES_DESTINO;
  if (!destino) {
    return { success: false, error: "RESUMO_LIDERES_DESTINO não configurado" };
  }

  const sp = agoraSaoPaulo();
  const janela: JanelaEnvio = opts.janela ?? janelaAtual(sp.hora) ?? "manual";
  if (!opts.force && janela !== "manual" && (await jaEnviadoNaJanela(sp.dataRef, janela))) {
    return { success: true, skipped: true };
  }

  let mensagem: string;
  try {
    const metricas = await calcularMetricasResumo();
    mensagem = formatarMensagemResumo(metricas, sp);
  } catch (err: any) {
    // Registra a falha de cálculo no histórico (status 'erro') para dar visibilidade na UI.
    // Como jaEnviadoNaJanela só considera status='ok', o retry da janela segue livre.
    console.error("[resumo-lideres] Falha ao calcular métricas:", err.message);
    await registrarEnvio(sp.dataRef, janela, destino, "", "erro", `Cálculo: ${err.message}`);
    return { success: false, error: err.message };
  }

  const resultado = await enviarViaEvolution(destino, mensagem);

  await registrarEnvio(
    sp.dataRef,
    janela,
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
