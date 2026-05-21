/**
 * Cria a tabela cortex_core.creatives_library (Biblioteca de Criativos da Turbo)
 * e faz backfill da planilha "Criativos" usada hoje.
 *
 * Uso:
 *   npx tsx scripts/create-creatives-library-table.ts                 # migration + backfill
 *   npx tsx scripts/create-creatives-library-table.ts --skip-backfill # só DDL
 *
 * Idempotente: pode ser re-executado. Dedup do backfill por drive_file_id (preferido)
 * e nome_drive (fallback).
 */

import "dotenv/config";
import { pool } from "../server/db";
import { getSheetsClient } from "../server/autoreport/credentials";

const SHEET_ID = "1VEuqJyDHduCL-0iAweJ9NZJ09zjJwRFYjLR0n8Ouiwc";
const TAB_NAME = "Criativos";
const BATCH_SIZE = 200;

interface SheetRow {
  tpId: string | null;
  nomeDrive: string;
  linkDrive: string | null;
  driveFileId: string | null;
  angulo: string | null;
  hook: string | null;
  corpo: string | null;
  cta: string | null;
  etapaFunil: string | null;
  dataPostagem: string | null; // ISO date or null
  produto: string | null;
  plataforma: string | null;
  personagem: string | null;
  formato: string | null;
  tipoAd: string | null;
  idCopy: string | null;
  observacao: string | null;
  nomeFinal: string;
  adValidado: boolean;
}

function extractFileIdFromDriveLink(link: string): string | null {
  const m1 = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

function parseBrDate(s: string): string | null {
  if (!s) return null;
  // Aceita "DD/MM/YY", "DD.MM.YY", "DD-MM-YY" (e variantes com 4 dígitos no ano)
  const m = s.trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = `20${y}`;
  // Se o "mês" for >12, provavelmente o usuário inverteu (US: MM/DD). Tenta swap.
  let dayN = parseInt(d, 10);
  let moN = parseInt(mo, 10);
  if (moN > 12 && dayN <= 12) {
    [dayN, moN] = [moN, dayN];
  }
  // Valida e descarta data inválida em vez de quebrar o import inteiro
  if (moN < 1 || moN > 12 || dayN < 1 || dayN > 31) return null;
  const iso = `${y}-${String(moN).padStart(2, "0")}-${String(dayN).padStart(2, "0")}`;
  return iso;
}

function normalizeBool(s: string): boolean {
  const v = s.trim().toLowerCase();
  return v === "sim" || v === "true" || v === "1" || v === "yes" || v === "y" || v === "ok";
}

async function readSheet(): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A1:Z5000`,
  });
  const rows = r.data.values || [];
  if (rows.length < 2) throw new Error(`Aba "${TAB_NAME}" vazia`);

  const headers = (rows[0] || []).map((h) => String(h || "").trim());
  const idx = (label: string) =>
    headers.findIndex((h) => h.toLowerCase() === label.toLowerCase());

  const colMap = {
    id: idx("ID"),
    nomeDrive: idx("Nome Drive"),
    angulo: idx("Angulo"),
    hook: idx("Hook"),
    corpo: idx("Corpo"),
    cta: idx("CTA"),
    etapaFunil: idx("Etapa do Funil"),
    dataPostagem: idx("Data Postagem"),
    produto: idx("Produto"),
    plataforma: idx("Plataforma"),
    personagem: idx("Personagem"),
    formato: idx("Formato"),
    tipoAd: idx("Tipo de AD"),
    idCopy: idx("ID Copy"),
    observacao: idx("Observação"),
    linkDrive: idx("Link do Drive"),
    nomeFinal: idx("Nome Final"),
    adValidado: idx("Ad validado?"),
  };

  if (colMap.nomeDrive < 0) throw new Error('Coluna "Nome Drive" não encontrada');
  if (colMap.nomeFinal < 0) throw new Error('Coluna "Nome Final" não encontrada');

  const get = (r: any[], i: number): string =>
    i >= 0 ? String(r[i] ?? "").trim() : "";

  const out: SheetRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const nomeDrive = get(r, colMap.nomeDrive);
    if (!nomeDrive) continue;
    const linkDrive = get(r, colMap.linkDrive);
    const driveFileId = linkDrive ? extractFileIdFromDriveLink(linkDrive) : null;
    out.push({
      tpId: get(r, colMap.id) || null,
      nomeDrive,
      linkDrive: linkDrive || null,
      driveFileId,
      angulo: get(r, colMap.angulo) || null,
      hook: get(r, colMap.hook) || null,
      corpo: get(r, colMap.corpo) || null,
      cta: get(r, colMap.cta) || null,
      etapaFunil: get(r, colMap.etapaFunil) || null,
      dataPostagem: parseBrDate(get(r, colMap.dataPostagem)),
      produto: get(r, colMap.produto) || null,
      plataforma: get(r, colMap.plataforma) || null,
      personagem: get(r, colMap.personagem) || null,
      formato: get(r, colMap.formato) || null,
      tipoAd: get(r, colMap.tipoAd) || null,
      idCopy: get(r, colMap.idCopy) || null,
      observacao: get(r, colMap.observacao) || null,
      nomeFinal: get(r, colMap.nomeFinal) || `${get(r, colMap.id) || ""} - ${nomeDrive}`,
      adValidado: normalizeBool(get(r, colMap.adValidado)),
    });
  }
  return out;
}

async function ensureSchema(client: any) {
  // Schema cortex_core já existe (criado por scripts anteriores).
  // Pulamos CREATE SCHEMA porque o usuário do app não tem privilégio CREATE no DB.

  await client.query(`
    CREATE TABLE IF NOT EXISTS cortex_core.creatives_library (
      id              SERIAL PRIMARY KEY,
      tp_id           VARCHAR(16) NOT NULL UNIQUE,
      nome_drive      TEXT NOT NULL,
      link_drive      TEXT,
      drive_file_id   VARCHAR(64),
      angulo          TEXT,
      hook            TEXT,
      corpo           TEXT,
      cta             TEXT,
      etapa_funil     VARCHAR(32),
      data_postagem   DATE,
      produto         VARCHAR(64),
      plataforma      VARCHAR(32),
      personagem      VARCHAR(64),
      formato         VARCHAR(16),
      tipo_ad         VARCHAR(32),
      id_copy         VARCHAR(32),
      observacao      TEXT,
      nome_final      TEXT NOT NULL,
      ad_validado     BOOLEAN DEFAULT false,
      created_by      VARCHAR(255),
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW(),
      deleted_at      TIMESTAMP
    )
  `);

  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_creatives_library_tp_id ON cortex_core.creatives_library (tp_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_creatives_library_drive_file_id ON cortex_core.creatives_library (drive_file_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_creatives_library_nome_drive ON cortex_core.creatives_library (nome_drive)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_creatives_library_deleted_at ON cortex_core.creatives_library (deleted_at)`,
  );
}

async function getMaxTpSequence(client: any): Promise<number> {
  const r = await client.query(`
    SELECT MAX(CAST(SUBSTRING(tp_id FROM '^TP(\\d+)$') AS INTEGER)) AS max_seq
    FROM cortex_core.creatives_library
    WHERE tp_id ~ '^TP\\d+$'
  `);
  return Number(r.rows[0]?.max_seq) || 0;
}

function makeTpId(seq: number): string {
  return `TP${String(seq).padStart(2, "0")}`;
}

async function backfill(client: any) {
  console.log(`📥 Lendo Sheet "${TAB_NAME}"...`);
  const rows = await readSheet();
  console.log(`   ${rows.length} linhas com Nome Drive preenchido`);

  let nextSeq = (await getMaxTpSequence(client)) + 1;
  const usedTpIds = new Set<string>();

  // Pré-carrega TP IDs e drive_file_ids existentes pra dedup rápido
  const existing = await client.query(`
    SELECT tp_id, drive_file_id, nome_drive FROM cortex_core.creatives_library
  `);
  const existingTpIds = new Set<string>(existing.rows.map((r: any) => r.tp_id));
  const existingFileIds = new Set<string>(
    existing.rows.filter((r: any) => r.drive_file_id).map((r: any) => r.drive_file_id),
  );
  const existingNomes = new Set<string>(
    existing.rows.map((r: any) => String(r.nome_drive).toLowerCase()),
  );

  let processed = 0;
  let batchValues: any[] = [];
  let batchPlaceholders: string[] = [];
  let paramIdx = 1;

  const flush = async () => {
    if (!batchValues.length) return;
    // Upsert com COALESCE: insere se novo, e em conflitos só preenche campos
    // que estão NULL/'' no banco. Nunca sobrescreve valor já cadastrado pelo usuário.
    const sql = `
      INSERT INTO cortex_core.creatives_library
        (tp_id, nome_drive, link_drive, drive_file_id, angulo, hook, corpo, cta,
         etapa_funil, data_postagem, produto, plataforma, personagem, formato,
         tipo_ad, id_copy, observacao, nome_final, ad_validado, created_by)
      VALUES ${batchPlaceholders.join(", ")}
      ON CONFLICT (tp_id) DO UPDATE SET
        link_drive    = COALESCE(cortex_core.creatives_library.link_drive,    EXCLUDED.link_drive),
        drive_file_id = COALESCE(cortex_core.creatives_library.drive_file_id, EXCLUDED.drive_file_id),
        angulo        = COALESCE(cortex_core.creatives_library.angulo,        EXCLUDED.angulo),
        hook          = COALESCE(cortex_core.creatives_library.hook,          EXCLUDED.hook),
        corpo         = COALESCE(cortex_core.creatives_library.corpo,         EXCLUDED.corpo),
        cta           = COALESCE(cortex_core.creatives_library.cta,           EXCLUDED.cta),
        etapa_funil   = COALESCE(cortex_core.creatives_library.etapa_funil,   EXCLUDED.etapa_funil),
        data_postagem = COALESCE(cortex_core.creatives_library.data_postagem, EXCLUDED.data_postagem),
        produto       = COALESCE(cortex_core.creatives_library.produto,       EXCLUDED.produto),
        plataforma    = COALESCE(cortex_core.creatives_library.plataforma,    EXCLUDED.plataforma),
        personagem    = COALESCE(cortex_core.creatives_library.personagem,    EXCLUDED.personagem),
        formato       = COALESCE(cortex_core.creatives_library.formato,       EXCLUDED.formato),
        tipo_ad       = COALESCE(cortex_core.creatives_library.tipo_ad,       EXCLUDED.tipo_ad),
        id_copy       = COALESCE(cortex_core.creatives_library.id_copy,       EXCLUDED.id_copy),
        observacao    = COALESCE(cortex_core.creatives_library.observacao,    EXCLUDED.observacao),
        updated_at    = NOW()
    `;
    await client.query(sql, batchValues);
    batchValues = [];
    batchPlaceholders = [];
    paramIdx = 1;
  };

  for (const row of rows) {
    // tpId: usa o do Sheet se válido; se não, gera um novo sequencial
    // (a unicidade é garantida pelo ON CONFLICT do upsert)
    let tpId = row.tpId && /^TP\d+$/i.test(row.tpId) ? row.tpId.toUpperCase() : "";
    if (!tpId || usedTpIds.has(tpId)) {
      while (true) {
        const candidate = makeTpId(nextSeq++);
        if (!existingTpIds.has(candidate) && !usedTpIds.has(candidate)) {
          tpId = candidate;
          break;
        }
      }
    }
    usedTpIds.add(tpId);

    // Atualiza sequence pra acompanhar IDs já tirados do Sheet
    const seqMatch = tpId.match(/^TP(\d+)$/);
    if (seqMatch) {
      const n = parseInt(seqMatch[1], 10);
      if (n >= nextSeq) nextSeq = n + 1;
    }

    const placeholders = Array.from({ length: 20 }, () => `$${paramIdx++}`).join(", ");
    batchPlaceholders.push(`(${placeholders})`);
    batchValues.push(
      tpId,
      row.nomeDrive,
      row.linkDrive,
      row.driveFileId,
      row.angulo,
      row.hook,
      row.corpo,
      row.cta,
      row.etapaFunil,
      row.dataPostagem,
      row.produto,
      row.plataforma,
      row.personagem,
      row.formato,
      row.tipoAd,
      row.idCopy,
      row.observacao,
      row.nomeFinal,
      row.adValidado,
      "backfill@sheet",
    );

    processed++;
    if (batchPlaceholders.length >= BATCH_SIZE) {
      await flush();
      process.stdout.write(`   processados: ${processed}\r`);
    }
  }
  await flush();

  console.log(`\n✅ Backfill: ${processed} rows processadas (insert ou upsert preenchendo campos vazios).`);

  const finalCount = await client.query(
    `SELECT COUNT(*) AS n FROM cortex_core.creatives_library`,
  );
  const finalMaxSeq = await client.query(`
    SELECT MAX(CAST(SUBSTRING(tp_id FROM '^TP(\\d+)$') AS INTEGER)) AS max_seq
    FROM cortex_core.creatives_library
    WHERE tp_id ~ '^TP\\d+$'
  `);
  console.log(`   total na tabela: ${finalCount.rows[0].n}`);
  console.log(`   maior tpId numérico: TP${finalMaxSeq.rows[0].max_seq}`);
}

async function run() {
  const skipBackfill = process.argv.includes("--skip-backfill");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureSchema(client);
    await client.query("COMMIT");
    console.log("✅ Tabela cortex_core.creatives_library e índices garantidos.");

    if (!skipBackfill) {
      await backfill(client);
    } else {
      console.log("⏭  Backfill pulado (--skip-backfill).");
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Erro:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
