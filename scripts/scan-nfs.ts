/**
 * Standalone NF scanner - processes PDFs from attached_assets/2026/
 * Usage: npx tsx scripts/scan-nfs.ts
 */
import path from "path";
import fs from "fs/promises";
import { Pool } from "pg";
import { config } from 'dotenv';
config({ path: '.env' });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} is required. Check your .env file.`);
  return val;
}

const pool = new Pool({
  host: requireEnv("DATABASE_HOST"),
  port: 5432,
  database: process.env.DATABASE_NAME || "dados_turbo",
  user: process.env.DATABASE_USER || "postgres",
  password: requireEnv("DATABASE_PASSWORD"),
  ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === "false" ? false : { rejectUnauthorized: false },
});

async function main() {
  const { extractTextFromPDF, extractValueFromText, extractPrestadorFromFilename } = await import("../server/services/nfExtractor");

  const baseDir = path.join(process.cwd(), "attached_assets", "2026");
  const monthDirs = (await fs.readdir(baseDir, { withFileTypes: true }))
    .filter(d => d.isDirectory() && /^\d{2}\s*-\s*/.test(d.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  let totalProcessed = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  for (const monthDir of monthDirs) {
    const mesNum = parseInt(monthDir.name.substring(0, 2));
    console.log(`\n📂 ${monthDir.name}`);
    const monthPath = path.join(baseDir, monthDir.name);
    const catDirs = (await fs.readdir(monthPath, { withFileTypes: true }))
      .filter(d => d.isDirectory());

    for (const catDir of catDirs) {
      const catPath = path.join(monthPath, catDir.name);
      const files = (await fs.readdir(catPath))
        .filter(f => f.toLowerCase().endsWith(".pdf"));

      if (files.length === 0) continue;
      console.log(`  📁 ${catDir.name}: ${files.length} PDFs`);

      for (const filename of files) {
        const filePath = path.join(catPath, filename);
        try {
          const buffer = await fs.readFile(filePath);
          const { text, status: pdfStatus } = await extractTextFromPDF(buffer);

          let valor: number | null = null;
          let moeda = "";
          let padrao = "";
          let status = pdfStatus;

          if (pdfStatus === "OK") {
            const extracted = extractValueFromText(text);
            valor = extracted.valor;
            moeda = extracted.moeda;
            padrao = extracted.padrao;
            if (valor === null) status = "VALOR NÃO ENCONTRADO";
          }

          const prestador = extractPrestadorFromFilename(filename);

          await pool.query(
            `INSERT INTO cortex_core.notas_fiscais (mes, mes_num, ano, categoria, arquivo, prestador, valor_brl, moeda_original, padrao_usado, status)
             VALUES ($1, $2, 2026, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (ano, mes_num, categoria, arquivo) DO UPDATE SET
               valor_brl = EXCLUDED.valor_brl, moeda_original = EXCLUDED.moeda_original,
               padrao_usado = EXCLUDED.padrao_usado, status = EXCLUDED.status, prestador = EXCLUDED.prestador,
               created_at = NOW()`,
            [monthDir.name, mesNum, catDir.name, filename, prestador, valor, moeda, padrao, status]
          );

          if (status === "OK") {
            totalProcessed++;
          } else {
            totalErrors++;
            if (status !== "VALOR NÃO ENCONTRADO") {
              console.log(`    ⚠️  ${filename}: ${status}`);
            }
          }
        } catch (err: any) {
          totalSkipped++;
          console.log(`    ❌ ${filename}: ${err.message?.substring(0, 80)}`);
        }
      }
    }
  }

  console.log(`\n✅ Scan completo:`);
  console.log(`   Processados com sucesso: ${totalProcessed}`);
  console.log(`   Erros de extração: ${totalErrors}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log(`   Total: ${totalProcessed + totalErrors + totalSkipped}`);

  // Show summary by month
  const result = await pool.query(`
    SELECT mes, count(*) as total,
           count(CASE WHEN status = 'OK' THEN 1 END) as ok,
           sum(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END) as valor_total
    FROM cortex_core.notas_fiscais WHERE ano = 2026
    GROUP BY mes, mes_num ORDER BY mes_num
  `);

  console.log(`\n📊 Resumo por mês:`);
  for (const row of result.rows) {
    console.log(`   ${row.mes}: ${row.ok}/${row.total} NFs — R$ ${Number(row.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  }

  await pool.end();
}

main().catch(console.error);
