import { db } from "../db";
import { sql } from "drizzle-orm";
import { sendAlertEmail, SendGridError } from "./sendgrid-notification";

const ALERT_EMAIL_TO = "financeiro@turbopartners.com.br";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h
const TRIGGER_HOUR = 18;

export interface SaldoDiarioSnapshotRecord {
  data: string;
  saldoTotal: number;
  criadoEm: string;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function snapshotExists(date: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM cortex_core.saldo_diario_snapshots
    WHERE data = ${date}::date
    LIMIT 1
  `);
  return result.rows.length > 0;
}

export async function runSnapshotJob(
  date?: string,
): Promise<SaldoDiarioSnapshotRecord> {
  const targetDate = date ?? formatDate(new Date());

  const result = await db.execute(sql`
    SELECT COALESCE(SUM(balance::numeric), 0) AS saldo_total
    FROM "Conta Azul".caz_bancos
    WHERE ativo = true
  `);

  const row = result.rows[0] as { saldo_total: string | number };
  const saldoTotal = Number(row.saldo_total) || 0;

  await db.execute(sql`
    INSERT INTO cortex_core.saldo_diario_snapshots (data, saldo_total)
    VALUES (${targetDate}::date, ${saldoTotal})
    ON CONFLICT (data) DO UPDATE SET
      saldo_total = EXCLUDED.saldo_total,
      criado_em   = NOW()
  `);

  return { data: targetDate, saldoTotal, criadoEm: new Date().toISOString() };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendErrorAlert(err: unknown, date: string): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? "(sem stack)" : "(sem stack)";
  const when = new Date().toISOString();

  const text = [
    `Falha no snapshot diário de saldo bancário.`,
    ``,
    `Data: ${date}`,
    `Horário: ${when}`,
    `Erro: ${message}`,
    ``,
    `Stack:`,
    stack,
    ``,
    `Para recuperar manualmente:`,
    `POST /api/admin/saldo-diario/snapshot/run  (body opcional: { "data": "${date}" })`,
  ].join("\n");

  const html = `
    <h2>Falha no snapshot diário de saldo bancário</h2>
    <p><strong>Data:</strong> ${date}</p>
    <p><strong>Horário:</strong> ${when}</p>
    <p><strong>Erro:</strong> ${escapeHtml(message)}</p>
    <pre style="background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto;">${escapeHtml(stack)}</pre>
    <hr />
    <p>Para recuperar manualmente:<br />
      <code>POST /api/admin/saldo-diario/snapshot/run</code>
      (body opcional: <code>{ "data": "${date}" }</code>)
    </p>
  `;

  try {
    await sendAlertEmail({
      to: ALERT_EMAIL_TO,
      subject: `[Cortex] Falha no snapshot de saldo diário — ${date}`,
      text,
      html,
    });
    console.log(`[saldo-diario-snapshot] Alerta enviado para ${ALERT_EMAIL_TO}`);
  } catch (alertErr: any) {
    const detail =
      alertErr instanceof SendGridError
        ? `SendGrid ${alertErr.status}: ${JSON.stringify(alertErr.body)}`
        : alertErr?.message ?? String(alertErr);
    console.error(
      `[saldo-diario-snapshot] FALHA AO ENVIAR ALERTA: ${detail}`,
    );
  }
}

async function runWithAlert(date?: string): Promise<void> {
  try {
    const record = await runSnapshotJob(date);
    console.log(
      `[saldo-diario-snapshot] Snapshot OK — ${record.data}: saldo=${record.saldoTotal.toFixed(2)}`,
    );
  } catch (err) {
    console.error("[saldo-diario-snapshot] Falha ao executar:", err);
    await sendErrorAlert(err, date ?? formatDate(new Date()));
  }
}

export async function tick(): Promise<void> {
  const now = new Date();
  if (now.getHours() !== TRIGGER_HOUR) return;

  const today = formatDate(now);
  if (await snapshotExists(today)) return;

  console.log(
    `[saldo-diario-snapshot] Janela detectada (${today}, ${now.toISOString()}) — executando...`,
  );
  await runWithAlert(today);
}

export async function recoverOnStartup(): Promise<void> {
  const now = new Date();
  if (now.getHours() < TRIGGER_HOUR) return;

  const today = formatDate(now);
  if (await snapshotExists(today)) return;

  console.log(
    `[saldo-diario-snapshot] Recovery de startup — snapshot de ${today} faltando, disparando...`,
  );
  await runWithAlert(today);
}

export function setupSaldoDiarioSnapshotJob(): void {
  setTimeout(() => {
    recoverOnStartup().catch((err) =>
      console.error("[saldo-diario-snapshot] recoverOnStartup erro:", err),
    );
  }, 30_000);

  setInterval(() => {
    tick().catch((err) =>
      console.error("[saldo-diario-snapshot] tick erro:", err),
    );
  }, CHECK_INTERVAL_MS);

  console.log(
    `[saldo-diario-snapshot] Scheduled hourly check — trigger at ${TRIGGER_HOUR}:00 daily`,
  );
}
