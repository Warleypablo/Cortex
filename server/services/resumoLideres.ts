// Resumo diário de métricas para líderes via WhatsApp.
// Spec: docs/superpowers/specs/2026-07-20-resumo-lideres-novo-modelo-design.md
// Modelo v3 (2026-07-20): mensagem em blocos temáticos com emojis. Três réguas
// mudaram — cross sell (MRR+Pontual) sem a amortização ÷5 do pontual; net churn
// (ajustado e bruto) subtrai só o cross sell de MRR (crossR), não o crossTotal;
// MRR Ativo passou a ser triagem + onboarding + ativo (status "ativo" isolado
// virou carteiraAtivo). Specs anteriores: 2026-07-02 (v2), 2026-07-14 (NRR Bruto).

import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  getMrrInicioMes,
  getVendasMrrBreakdown,
  getVendasNovasBreakdown,
} from "../okr2026/metricsAdapter";
import { enviarMensagemWhatsApp } from "./turbozap";

export interface MetricasResumo {
  // Novas vendas (Bitrix, aquisição pura — sem cross sell e sem upsell)
  mrrAdicionado: number;
  pontualVendido: number;
  // Carteira MRR (cup_contratos ao vivo)
  carteiraTriagemOnboarding: number; // status 'triagem' + 'onboarding'
  carteiraAtivo: number; // status 'ativo'
  carteiraEmCancelamento: number; // status 'em cancelamento'
  mrrAtivo: number; // triagem + onboarding + ativo
  mrrOperando: number; // mrrAtivo + em cancelamento
  entregaPontual: number; // valorp dos contratos que viraram 'entregue' no mês
  // Bases dos percentuais
  mrrMesAnterior: number; // 1º snapshot do mês = fechamento do mês anterior
  estoquePontualInicioMes: number; // valorp em aberto no 1º snapshot do mês
  // Churn
  churnTotal: number; // valor_r bruto de cup_churn no mês
  churnTotalPct: number; // 0-100
  churnAjustado: number; // sem os motivos operacionais
  churnAjustadoPct: number; // 0-100
  churnPontual: number; // valorp dos contratos pontuais com pedido de churn no mês
  churnPontualPct: number; // 0-100
  churnPontualAjustado: number; // idem, sem os motivos operacionais
  churnPontualAjustadoPct: number; // 0-100
  // Cross sell (valores cheios — sem amortização desde a v3)
  crossR: number;
  crossP: number;
  crossTotal: number; // crossR + crossP
  // Net churn (subtrai apenas o cross sell de MRR)
  netChurn: number; // churnAjustado - crossR
  netChurnPct: number; // 0-100
  netChurnBruto: number; // churnTotal - crossR
  netChurnBrutoPct: number; // 0-100
  // Calculado e exposto em /preview, mas não exibido no texto v3
  churnBrutoSemAbono: number;
  churnBrutoSemAbonoPct: number;
  // true quando getVendasMrrBreakdown falhou e devolveu zeros no catch — o
  // Cross Sell (e portanto o Net Churn) fica subestimado/inflado sem aviso.
  crossIndisponivel: boolean;
}

// Motivos excluídos das versões "ajustadas" (erros de venda/começo, não churn real)
const MOTIVOS_EXCLUIDOS = sql`('Erro na Venda', 'Não começou', 'Inadimplente 1º Mês')`;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
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
  if (hora < 12) return "🌞 Bom dia";
  if (hora < 18) return "☀️ Boa tarde";
  return "🌙 Boa noite";
}

export function formatarMensagemResumo(
  m: MetricasResumo,
  agora: { dataFmt: string; horaFmt: string; hora: number; mes: number },
): string {
  const mes = MESES[agora.mes - 1];
  const mesAnterior = MESES[(agora.mes + 10) % 12];

  return `${saudacao(agora.hora)}, líderes!

Atualização das principais métricas
${agora.dataFmt} • ${agora.horaFmt}

━━━━━━━━━━━━━━━

💰 Receita (${mes})

Novas Vendas
📈 MRR Adicionado: ${formatarMoedaBR(m.mrrAdicionado)}
📦 Pontual Vendido: ${formatarMoedaBR(m.pontualVendido)}

📌 Considera apenas vendas novas (sem Cross Sell e Upsell).

Carteira MRR
🟡 Triagem / Onboarding: ${formatarMoedaBR(m.carteiraTriagemOnboarding)}
🟢 Ativo: ${formatarMoedaBR(m.carteiraAtivo)}
🟠 Em Cancelamento: ${formatarMoedaBR(m.carteiraEmCancelamento)}

📌 MRR Ativo: ${formatarMoedaBR(m.mrrAtivo)}
🚀 MRR Operando: ${formatarMoedaBR(m.mrrOperando)}

📦 Entrega Pontual: ${formatarMoedaBR(m.entregaPontual)}

📌 MRR Base ${mesAnterior}: ${formatarMoedaBR(m.mrrMesAnterior)}

💡 Legenda
• MRR Ativo: Triagem + Onboarding + Ativo.
• MRR Operando: Triagem + Onboarding + Ativo + Em Cancelamento.

━━━━━━━━━━━━━━━

📉 Churn

💰 MRR
🔴 Total: ${formatarMoedaBR(m.churnTotal)} (${formatarPercentBR(m.churnTotalPct)})
🟢 Ajustado: ${formatarMoedaBR(m.churnAjustado)} (${formatarPercentBR(m.churnAjustadoPct)})

📦 Pontual
🔴 Total: ${formatarMoedaBR(m.churnPontual)} (${formatarPercentBR(m.churnPontualPct)})
🟢 Ajustado: ${formatarMoedaBR(m.churnPontualAjustado)} (${formatarPercentBR(m.churnPontualAjustadoPct)})

━━━━━━━━━━━━━━━

🔄 Cross Sell

💰 MRR: ${formatarMoedaBR(m.crossR)}
📦 Pontual: ${formatarMoedaBR(m.crossP)}

🏆 Total: ${formatarMoedaBR(m.crossTotal)}

━━━━━━━━━━━━━━━

🎯 Net Churn (MRR)

🟢 Ajustado

Churn Ajustado: ${formatarMoedaBR(m.churnAjustado)}
➖ Cross Sell: ${formatarMoedaBR(m.crossR)}
🟰 ${formatarMoedaBR(m.netChurn)} (${formatarPercentBR(m.netChurnPct)})

🔴 Bruto

Churn Total: ${formatarMoedaBR(m.churnTotal)}
➖ Cross Sell: ${formatarMoedaBR(m.crossR)}
🟰 ${formatarMoedaBR(m.netChurnBruto)} (${formatarPercentBR(m.netChurnBrutoPct)})

━━━━━━━━━━━━━━━

💡 Disclaimers

• MRR Adicionado e Pontual Vendido consideram apenas vendas novas, sem Cross Sell e Upsell.
• Churn Ajustado desconsidera erro de venda, clientes que não iniciaram e inadimplência de até 1 mês.
• O percentual do Churn Pontual é calculado sobre o estoque pontual em aberto no início do mês (${formatarMoedaBR(m.estoquePontualInicioMes)}).
• Net Churn = Churn − Cross Sell de MRR.
• MRR Ativo = Triagem + Onboarding + Ativo.
• MRR Operando = Triagem + Onboarding + Ativo + Em Cancelamento.

${m.crossIndisponivel ? "⚠️ Cross Sell indisponível nesta apuração — o Net Churn está superestimado.\n\n" : ""}👀 Seguimos acompanhando diariamente os indicadores e atuando rapidamente sobre os principais desvios.`;
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

interface CarteiraMrr {
  ativo: number;              // status 'ativo'
  triagemOnboarding: number;  // status 'triagem' + 'onboarding'
  emCancelamento: number;     // status 'em cancelamento'
  mrrAtivo: number;           // triagem + onboarding + ativo
  mrrOperando: number;        // mrrAtivo + em cancelamento
}

/**
 * Carteira MRR ao vivo, nos quatro recortes do modelo v3, em uma query só.
 * 'pausado', 'entregue', 'excluído', 'não usar' e 'cancelado/inativo' ficam
 * fora de todos os recortes — ver spec 2026-07-20.
 */
async function getCarteiraMrr(): Promise<CarteiraMrr> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(valorr) FILTER (WHERE status = 'ativo'), 0) AS ativo,
      COALESCE(SUM(valorr) FILTER (WHERE status IN ('triagem', 'onboarding')), 0) AS triagem_onboarding,
      COALESCE(SUM(valorr) FILTER (WHERE status = 'em cancelamento'), 0) AS em_cancelamento
    FROM "Clickup".cup_contratos
  `);
  const row = result.rows[0] as any;
  const ativo = parseFloat(row?.ativo || "0");
  const triagemOnboarding = parseFloat(row?.triagem_onboarding || "0");
  const emCancelamento = parseFloat(row?.em_cancelamento || "0");
  const mrrAtivo = ativo + triagemOnboarding;
  return {
    ativo,
    triagemOnboarding,
    emCancelamento,
    mrrAtivo,
    mrrOperando: mrrAtivo + emCancelamento,
  };
}

async function getChurnMes(): Promise<{ total: number; ajustado: number; brutoSemAbono: number }> {
  // Churn BRUTO (inclui abonados) por data do pedido; "ajustado" exclui os
  // motivos operacionais (erro de venda / não começou / inadimplente 1º mês);
  // "brutoSemAbono" mantém todos os motivos mas exclui os abonados (abonar_churn='Sim').
  // Abono e os 3 motivos NÃO são o mesmo conjunto — ver spec 2026-07-14.
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(valor_r), 0) AS total,
      COALESCE(SUM(valor_r) FILTER (
        WHERE COALESCE(motivo_cancelamento, '') NOT IN ${MOTIVOS_EXCLUIDOS}
      ), 0) AS ajustado,
      COALESCE(SUM(valor_r) FILTER (
        WHERE COALESCE(abonar_churn, '') <> 'Sim'
      ), 0) AS bruto_sem_abono
    FROM "Clickup".cup_churn
    WHERE data_solicitacao_encerramento >= date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo'))::date
      AND data_solicitacao_encerramento < (date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 month')::date
  `);
  const row = result.rows[0] as any;
  return {
    total: parseFloat(row?.total || "0"),
    ajustado: parseFloat(row?.ajustado || "0"),
    brutoSemAbono: parseFloat(row?.bruto_sem_abono || "0"),
  };
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

async function getEstoquePontualInicioMes(): Promise<number> {
  // Estoque pontual em aberto no 1º snapshot do mês (= fechamento do mês anterior).
  // Base do % de churn pontual, análogo ao mrrMesAnterior usado no churn recorrente.
  // Régua canônica de estoque pontual: valorp > 0 e status "em aberto" (exclui
  // entregue / cancelado/inativo / não usar — 'cancelado/inativo' é um único valor).
  const result = await db.execute(sql`
    WITH primeiro_snapshot AS (
      SELECT MIN(data_snapshot) AS d
      FROM "Clickup".cup_data_hist
      WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')
    )
    SELECT COALESCE(SUM(valorp), 0) AS total
    FROM "Clickup".cup_data_hist
    WHERE data_snapshot = (SELECT d FROM primeiro_snapshot)
      AND valorp > 0
      AND status NOT IN ('entregue', 'cancelado/inativo', 'não usar')
  `);
  return parseFloat((result.rows[0] as any)?.total || "0");
}

/**
 * Deriva as métricas expostas na mensagem a partir das entradas cruas das 6
 * queries de `calcularMetricasResumo`. Pura (sem I/O) para poder testar as
 * fórmulas — cross sell sem amortização, net churn sobre o cross de MRR,
 * carteiraAtivo vs mrrAtivo — sem precisar mockar o banco.
 */
export function derivarMetricas(entrada: {
  carteira: CarteiraMrr;
  mrrMesAnterior: number;
  estoquePontualInicioMes: number;
  entregaPontual: number;
  vendasNovas: { mrr: number; pontual: number };
  breakdown: { crosssell: number; crosssell_pontual: number; erro?: boolean };
  churn: { total: number; ajustado: number; brutoSemAbono: number };
  churnPontual: { total: number; ajustado: number };
}): MetricasResumo {
  const { carteira, mrrMesAnterior, estoquePontualInicioMes, entregaPontual, vendasNovas, breakdown, churn, churnPontual } =
    entrada;

  const crossR = breakdown.crosssell;
  const crossP = breakdown.crosssell_pontual;
  const crossTotal = crossR + crossP;
  const netChurn = churn.ajustado - crossR;
  const netChurnBruto = churn.total - crossR;

  return {
    mrrAdicionado: vendasNovas.mrr,
    pontualVendido: vendasNovas.pontual,
    carteiraTriagemOnboarding: carteira.triagemOnboarding,
    carteiraAtivo: carteira.ativo,
    carteiraEmCancelamento: carteira.emCancelamento,
    mrrAtivo: carteira.mrrAtivo,
    mrrOperando: carteira.mrrOperando,
    entregaPontual,
    mrrMesAnterior,
    estoquePontualInicioMes,
    churnTotal: churn.total,
    churnTotalPct: (churn.total / mrrMesAnterior) * 100,
    churnAjustado: churn.ajustado,
    churnAjustadoPct: (churn.ajustado / mrrMesAnterior) * 100,
    churnPontual: churnPontual.total,
    churnPontualPct: estoquePontualInicioMes > 0 ? (churnPontual.total / estoquePontualInicioMes) * 100 : 0,
    churnPontualAjustado: churnPontual.ajustado,
    churnPontualAjustadoPct: estoquePontualInicioMes > 0 ? (churnPontual.ajustado / estoquePontualInicioMes) * 100 : 0,
    crossR,
    crossP,
    crossTotal,
    netChurn,
    netChurnPct: (netChurn / mrrMesAnterior) * 100,
    netChurnBruto,
    netChurnBrutoPct: (netChurnBruto / mrrMesAnterior) * 100,
    churnBrutoSemAbono: churn.brutoSemAbono,
    churnBrutoSemAbonoPct: (churn.brutoSemAbono / mrrMesAnterior) * 100,
    crossIndisponivel: breakdown.erro === true,
  };
}

export async function calcularMetricasResumo(): Promise<MetricasResumo> {
  const [carteira, mrrMesAnterior, vendasNovas, breakdown, churn, churnPontual, entregaPontual, estoquePontualInicioMes] =
    await Promise.all([
      getCarteiraMrr(),
      getMrrInicioMes(),
      getVendasNovasBreakdown(),
      getVendasMrrBreakdown(),
      getChurnMes(),
      getChurnPontualMes(),
      getEntregaPontualMes(),
      getEstoquePontualInicioMes(),
    ]);

  // getMrrInicioMes (metricsAdapter) engole erros retornando 0; sem base de MRR a
  // mensagem seria enganosa, então abortamos. As métricas de venda podem ser
  // legitimamente zero.
  if (carteira.mrrAtivo <= 0 || mrrMesAnterior <= 0) {
    throw new Error(
      `Métricas de MRR inválidas (mrrAtivo=${carteira.mrrAtivo}, mrrMesAnterior=${mrrMesAnterior}) — envio abortado`,
    );
  }

  return derivarMetricas({
    carteira,
    mrrMesAnterior,
    estoquePontualInicioMes,
    entregaPontual,
    vendasNovas,
    breakdown,
    churn,
    churnPontual,
  });
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
