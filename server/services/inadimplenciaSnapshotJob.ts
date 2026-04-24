import { db } from "../db";
import { sql } from "drizzle-orm";
import { sendAlertEmail, SendGridError } from "./sendgrid-notification";

const ALERT_EMAIL_TO = "financeiro@turbopartners.com.br";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h
const TRIGGER_HOUR = 12;

export interface InadimplenciaSnapshotRecord {
  mesReferencia: string;
  dataSnapshot: string;
  valorTotal: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
  ticketMedio: number;
}

/**
 * Retorna true se a data é o último dia do mês.
 */
export function isLastDayOfMonth(date: Date): boolean {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return next.getMonth() !== date.getMonth();
}

/**
 * Formata Date como 'YYYY-MM' no timezone local.
 */
function formatMesReferencia(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Executa o snapshot — calcula o total de inadimplência e faz upsert.
 * Propaga erros para o caller (que decide se notifica ou devolve no response).
 */
export async function runSnapshotJob(
  mesReferencia?: string,
): Promise<InadimplenciaSnapshotRecord> {
  const now = new Date();
  const mesRef = mesReferencia ?? formatMesReferencia(now);
  const dataSnapshot = now.toISOString().split("T")[0];

  // Mesma regra do getInadimplenciaResumo:
  // tipo_evento='RECEITA' AND data_vencimento < CURRENT_DATE AND nao_pago > 0
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(nao_pago::numeric), 0)::numeric AS valor_total,
      COUNT(DISTINCT id_cliente)::int              AS quantidade_clientes,
      COUNT(*)::int                                AS quantidade_parcelas
    FROM "Conta Azul".caz_parcelas
    WHERE tipo_evento = 'RECEITA'
      AND data_vencimento < CURRENT_DATE
      AND nao_pago::numeric > 0
  `);

  const row = result.rows[0] as {
    valor_total: string | number;
    quantidade_clientes: number;
    quantidade_parcelas: number;
  };

  const valorTotal = Number(row.valor_total) || 0;
  const quantidadeClientes = Number(row.quantidade_clientes) || 0;
  const quantidadeParcelas = Number(row.quantidade_parcelas) || 0;
  const ticketMedio =
    quantidadeClientes > 0 ? valorTotal / quantidadeClientes : 0;

  await db.execute(sql`
    INSERT INTO cortex_core.inadimplencia_snapshots
      (mes_referencia, data_snapshot, valor_total, quantidade_clientes,
       quantidade_parcelas, ticket_medio)
    VALUES
      (${mesRef}, ${dataSnapshot}, ${valorTotal}, ${quantidadeClientes},
       ${quantidadeParcelas}, ${ticketMedio})
    ON CONFLICT (mes_referencia) DO UPDATE SET
      data_snapshot       = EXCLUDED.data_snapshot,
      valor_total         = EXCLUDED.valor_total,
      quantidade_clientes = EXCLUDED.quantidade_clientes,
      quantidade_parcelas = EXCLUDED.quantidade_parcelas,
      ticket_medio        = EXCLUDED.ticket_medio,
      criado_em           = NOW()
  `);

  return {
    mesReferencia: mesRef,
    dataSnapshot,
    valorTotal,
    quantidadeClientes,
    quantidadeParcelas,
    ticketMedio,
  };
}

/**
 * Retorna true se já existe snapshot para o mes_referencia informado.
 */
async function snapshotExists(mesRef: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1
    FROM cortex_core.inadimplencia_snapshots
    WHERE mes_referencia = ${mesRef}
    LIMIT 1
  `);
  return result.rows.length > 0;
}

/**
 * Envia email de alerta sobre falha no job.
 * Nunca lança — falha de envio é logada mas não propagada.
 */
async function sendErrorAlert(err: unknown, mesRef: string): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? "(sem stack)" : "(sem stack)";
  const when = new Date().toISOString();

  const text = [
    `Falha no snapshot mensal de inadimplência.`,
    ``,
    `Mês de referência: ${mesRef}`,
    `Horário: ${when}`,
    `Erro: ${message}`,
    ``,
    `Stack:`,
    stack,
    ``,
    `Para recuperar manualmente:`,
    `POST /api/inadimplencia/snapshot/run  (body opcional: { "mesReferencia": "${mesRef}" })`,
  ].join("\n");

  const html = `
    <h2>Falha no snapshot mensal de inadimplência</h2>
    <p><strong>Mês de referência:</strong> ${mesRef}</p>
    <p><strong>Horário:</strong> ${when}</p>
    <p><strong>Erro:</strong> ${escapeHtml(message)}</p>
    <pre style="background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto;">${escapeHtml(stack)}</pre>
    <hr />
    <p>Para recuperar manualmente, chame:<br />
      <code>POST /api/inadimplencia/snapshot/run</code>
      (body opcional: <code>{ "mesReferencia": "${mesRef}" }</code>)
    </p>
  `;

  try {
    await sendAlertEmail({
      to: ALERT_EMAIL_TO,
      subject: `[Cortex] Falha no snapshot de inadimplência — ${mesRef}`,
      text,
      html,
    });
    console.log(`[inadimplencia-snapshot] Alerta enviado para ${ALERT_EMAIL_TO}`);
  } catch (alertErr: any) {
    const detail =
      alertErr instanceof SendGridError
        ? `SendGrid ${alertErr.status}: ${JSON.stringify(alertErr.body)}`
        : alertErr?.message ?? String(alertErr);
    console.error(
      `[inadimplencia-snapshot] FALHA AO ENVIAR ALERTA: ${detail}`,
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Executa o snapshot e, em caso de erro, dispara alerta por email.
 * Uso: agendador interno (diferente do endpoint manual, que devolve o erro ao cliente).
 */
async function runWithAlert(mesRef?: string): Promise<void> {
  try {
    const record = await runSnapshotJob(mesRef);
    console.log(
      `[inadimplencia-snapshot] Snapshot OK — ${record.mesReferencia}: ` +
        `valor=${record.valorTotal.toFixed(2)} ` +
        `clientes=${record.quantidadeClientes} ` +
        `parcelas=${record.quantidadeParcelas}`,
    );
  } catch (err) {
    console.error("[inadimplencia-snapshot] Falha ao executar:", err);
    await sendErrorAlert(err, mesRef ?? formatMesReferencia(new Date()));
  }
}

/**
 * Verifica se agora é a janela de execução (último dia do mês, hora == TRIGGER_HOUR)
 * e ainda não há snapshot para o mês.
 */
async function tick(): Promise<void> {
  const now = new Date();
  if (!isLastDayOfMonth(now)) return;
  if (now.getHours() !== TRIGGER_HOUR) return;

  const mesRef = formatMesReferencia(now);
  if (await snapshotExists(mesRef)) return;

  console.log(
    `[inadimplencia-snapshot] Janela detectada (${mesRef}, ${now.toISOString()}) — executando...`,
  );
  await runWithAlert(mesRef);
}

/**
 * Recovery de restart: se o servidor reiniciar depois das 12h do último dia do mês
 * e ainda não houver snapshot, dispara agora.
 */
async function recoverOnStartup(): Promise<void> {
  const now = new Date();
  if (!isLastDayOfMonth(now)) return;
  if (now.getHours() < TRIGGER_HOUR) return;

  const mesRef = formatMesReferencia(now);
  if (await snapshotExists(mesRef)) return;

  console.log(
    `[inadimplencia-snapshot] Recovery de startup — snapshot de ${mesRef} faltando, disparando...`,
  );
  await runWithAlert(mesRef);
}

/**
 * Setup público chamado em server/index.ts.
 */
export function setupInadimplenciaSnapshotJob(): void {
  // Recovery após 30s (mesmo delay dos outros jobs para dar tempo das conexões)
  setTimeout(() => {
    recoverOnStartup().catch((err) =>
      console.error("[inadimplencia-snapshot] recoverOnStartup erro:", err),
    );
  }, 30_000);

  // Verificação horária
  setInterval(() => {
    tick().catch((err) =>
      console.error("[inadimplencia-snapshot] tick erro:", err),
    );
  }, CHECK_INTERVAL_MS);

  console.log(
    `[inadimplencia-snapshot] Scheduled hourly check — trigger at ${TRIGGER_HOUR}:00 on last day of month`,
  );
}
