import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface ImportResult {
  table: string;
  imported: number;
  skipped: number;
  errors: string[];
}

function escapeSQL(val: any, colName?: string): string {
  if (val === null || val === undefined || val === '' || val === 'NULL') return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val.toString();
  
  const strVal = String(val).trim();
  
  // Handle invalid dates
  if (strVal === '0000-00-00' || strVal === '0000-00-00 00:00:00') return 'NULL';
  
  return "'" + strVal.replace(/'/g, "''").replace(/\r/g, '').replace(/\n/g, ' ') + "'";
}

async function importTable(
  content: string,
  startLine: number,
  endLine: number,
  tableName: string,
  booleanColumns: string[] = []
): Promise<ImportResult> {
  const lines = content.split('\n');
  const headerLine = lines[startLine - 1];
  
  let dataContent = '';
  let currentLine = startLine;
  let quoteCount = 0;
  
  while (currentLine < endLine && currentLine < lines.length) {
    const line = lines[currentLine];
    dataContent += (dataContent && quoteCount % 2 !== 0 ? '\n' : (dataContent ? '\n' : '')) + line;
    quoteCount += (line.match(/"/g) || []).length;
    
    if (currentLine + 1 < lines.length && lines[currentLine + 1].startsWith('"id",')) {
      break;
    }
    currentLine++;
  }
  
  const csvContent = headerLine + '\n' + dataContent;
  
  let records: any[];
  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    });
  } catch (err: any) {
    console.error(`[import] Failed to parse ${tableName}: ${err.message}`);
    return { table: tableName, imported: 0, skipped: 0, errors: [err.message] };
  }
  
  console.log(`[import] Parsed ${records.length} records for ${tableName}`);
  
  if (records.length === 0) {
    return { table: tableName, imported: 0, skipped: 0, errors: [] };
  }
  
  const errors: string[] = [];
  const BATCH_SIZE = 50;
  let imported = 0;
  
  const columns = Object.keys(records[0]);
  const columnsStr = columns.map(c => `"${c}"`).join(', ');
  
  for (let batchStart = 0; batchStart < records.length; batchStart += BATCH_SIZE) {
    const batch = records.slice(batchStart, batchStart + BATCH_SIZE);
    
    const valuesClauses: string[] = [];
    for (const record of batch) {
      const values = columns.map(col => {
        let val = record[col];
        if (booleanColumns.includes(col)) {
          return val === '1' || val === 'true' || val === true ? 'TRUE' : 'FALSE';
        }
        return escapeSQL(val);
      });
      valuesClauses.push(`(${values.join(', ')})`);
    }
    
    try {
      await db.execute(sql.raw(`
        INSERT INTO staging.${tableName} (${columnsStr})
        VALUES ${valuesClauses.join(',\n')}
        ON CONFLICT (id) DO NOTHING
      `));
      imported += batch.length;
      console.log(`[import] ${tableName}: ${imported}/${records.length} imported...`);
    } catch (err: any) {
      if (errors.length < 10) {
        errors.push(`Batch ${batchStart}: ${err.message}`);
      }
      console.error(`[import] ${tableName} batch error:`, err.message);
    }
  }
  
  console.log(`[import] ${tableName}: ${imported} imported`);
  if (errors.length > 0) {
    console.log(`[import] ${tableName} errors:`, errors.slice(0, 3));
  }
  return { table: tableName, imported, skipped: records.length - imported, errors };
}

export async function runImport(): Promise<ImportResult[]> {
  const csvPath = path.join(process.cwd(), 'attached_assets', 'turbop58_contratos_(2)_1767374833084.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.log('[import] CSV file not found, skipping import');
    return [];
  }
  
  try {
    const existingCount = await db.execute(sql`SELECT COUNT(*) as count FROM staging.contratos`);
    const count = parseInt((existingCount.rows[0] as any).count);
    
    if (count > 0) {
      console.log(`[import] Table staging.contratos already has ${count} records, skipping import`);
      return [];
    }
  } catch (e) {
    console.log('[import] Could not check existing count, proceeding with import');
  }
  
  console.log('[import] Starting CSV import...');
  const content = fs.readFileSync(csvPath, 'utf-8');
  
  const results: ImportResult[] = [];
  
  try {
    results.push(await importTable(content, 6862, 6888, 'servicos', ['ativo']));
  } catch (e: any) {
    console.error('[import] servicos failed:', e.message);
  }
  
  try {
    results.push(await importTable(content, 4903, 5171, 'entidades', ['eh_cliente', 'eh_fornecedor']));
  } catch (e: any) {
    console.error('[import] entidades failed:', e.message);
  }
  
  try {
    results.push(await importTable(content, 5722, 6861, 'planos_servicos', ['ativo']));
  } catch (e: any) {
    console.error('[import] planos_servicos failed:', e.message);
  }
  
  try {
    results.push(await importTable(content, 3353, 4475, 'contratos', []));
  } catch (e: any) {
    console.error('[import] contratos failed:', e.message);
  }
  
  try {
    results.push(await importTable(content, 4476, 4902, 'contratos_itens', []));
  } catch (e: any) {
    console.error('[import] contratos_itens failed:', e.message);
  }
  
  console.log('[import] Import completed');
  return results;
}
