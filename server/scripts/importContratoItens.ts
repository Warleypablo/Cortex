import { db } from "../db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseValue(val: string): string | null {
  const trimmed = val.replace(/^"|"$/g, '').trim();
  if (trimmed === '' || trimmed === 'NULL' || trimmed === 'null') {
    return null;
  }
  return trimmed;
}

async function importContratoItens() {
  try {
    const csvPath = path.join(process.cwd(), 'attached_assets', 'contrato_itens_1767382256932.csv');
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    console.log(`[contrato_itens] Found ${lines.length - 1} records to import`);

    // Clear existing data
    await db.execute(sql`DELETE FROM staging.contratos_itens`);
    console.log('[contrato_itens] Cleared existing data');

    // Parse header
    const headers = parseCSVLine(lines[0]);
    console.log('[contrato_itens] Headers:', headers);

    let imported = 0;
    const batchSize = 50;
    
    for (let i = 1; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, Math.min(i + batchSize, lines.length));
      
      for (const line of batch) {
        if (!line.trim()) continue;
        
        const values = parseCSVLine(line);
        const id = parseValue(values[0]);
        const contrato_id = parseValue(values[1]);
        const plano_servico_id = parseValue(values[2]);
        const quantidade = parseValue(values[3]);
        const valor_unitario = parseValue(values[4]);
        const valor_total = parseValue(values[5]);
        const modalidade = parseValue(values[6]);
        const valor_original = parseValue(values[7]);
        const valor_negociado = parseValue(values[8]);
        const desconto_percentual = parseValue(values[9]);
        const tipo_desconto = parseValue(values[10]);
        const valor_desconto = parseValue(values[11]);
        const valor_final = parseValue(values[12]);
        const economia = parseValue(values[13]);
        const vigencia_desconto = parseValue(values[14]);
        const periodo_desconto = parseValue(values[15]);
        const apos_periodo = parseValue(values[16]);
        const forma_pagamento = parseValue(values[17]);
        const num_parcelas = parseValue(values[18]);
        const valor_parcela = parseValue(values[19]);
        const observacoes = parseValue(values[20]);

        try {
          await db.execute(sql`
            INSERT INTO staging.contratos_itens (
              id, contrato_id, plano_servico_id, quantidade, valor_unitario, valor_total,
              modalidade, valor_original, valor_negociado, desconto_percentual,
              tipo_desconto, valor_desconto, valor_final, economia, vigencia_desconto,
              periodo_desconto, apos_periodo, forma_pagamento, num_parcelas, valor_parcela, observacoes
            ) VALUES (
              ${id ? parseInt(id) : null},
              ${contrato_id ? parseInt(contrato_id) : null},
              ${plano_servico_id ? parseInt(plano_servico_id) : null},
              ${quantidade ? parseInt(quantidade) : 1},
              ${valor_unitario ? parseFloat(valor_unitario) : 0},
              ${valor_total ? parseFloat(valor_total) : 0},
              ${modalidade},
              ${valor_original ? parseFloat(valor_original) : 0},
              ${valor_negociado ? parseFloat(valor_negociado) : 0},
              ${desconto_percentual ? parseFloat(desconto_percentual) : 0},
              ${tipo_desconto},
              ${valor_desconto ? parseFloat(valor_desconto) : 0},
              ${valor_final ? parseFloat(valor_final) : 0},
              ${economia ? parseFloat(economia) : 0},
              ${vigencia_desconto},
              ${periodo_desconto ? parseInt(periodo_desconto) : null},
              ${apos_periodo},
              ${forma_pagamento},
              ${num_parcelas ? parseInt(num_parcelas) : null},
              ${valor_parcela ? parseFloat(valor_parcela) : 0},
              ${observacoes}
            )
          `);
          imported++;
        } catch (err: any) {
          console.error(`[contrato_itens] Error inserting row ${i}:`, err.message);
        }
      }
      console.log(`[contrato_itens] Imported ${imported} records...`);
    }

    // Reset sequence
    await db.execute(sql`SELECT setval('staging.contratos_itens_id_seq', (SELECT MAX(id) FROM staging.contratos_itens))`);
    
    // Verify
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM staging.contratos_itens`);
    console.log(`[contrato_itens] Total records: ${(result.rows[0] as any).count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('[contrato_itens] Error:', error);
    process.exit(1);
  }
}

importContratoItens();
