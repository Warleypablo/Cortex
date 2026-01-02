import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface CSVSection {
  startLine: number;
  endLine: number;
  tableName: string;
  headers: string[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

async function importSection(lines: string[], tableName: string, headers: string[]) {
  console.log(`[import] Starting import for ${tableName} (${lines.length} records)`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const line of lines) {
    if (!line.trim()) {
      skipped++;
      continue;
    }
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) {
      console.log(`[import] Skipping line with mismatched columns: expected ${headers.length}, got ${values.length}`);
      skipped++;
      continue;
    }
    
    const record: Record<string, any> = {};
    for (let i = 0; i < headers.length; i++) {
      let value = values[i];
      
      if (value === '' || value === 'NULL' || value === null) {
        record[headers[i]] = null;
      } else if (value === '0' || value === '1') {
        if (headers[i].startsWith('eh_') || headers[i] === 'ativo') {
          record[headers[i]] = value === '1';
        } else {
          record[headers[i]] = value;
        }
      } else {
        record[headers[i]] = value;
      }
    }
    
    try {
      const columns = Object.keys(record);
      const columnsStr = columns.map(c => `"${c}"`).join(', ');
      const valuesPlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const vals = columns.map(c => record[c]);
      
      await db.execute(sql.raw(`
        INSERT INTO staging.${tableName} (${columnsStr})
        VALUES (${vals.map((v, i) => {
          if (v === null) return 'NULL';
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          if (typeof v === 'number') return v.toString();
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ')})
        ON CONFLICT (id) DO NOTHING
      `));
      imported++;
    } catch (err: any) {
      console.log(`[import] Error inserting into ${tableName}: ${err.message}`);
      skipped++;
    }
  }
  
  console.log(`[import] ${tableName}: ${imported} imported, ${skipped} skipped`);
  return { imported, skipped };
}

export async function importContratosFromCSV() {
  const csvPath = path.join(process.cwd(), 'attached_assets', 'turbop58_contratos_(2)_1767374833084.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const allLines = content.split('\n');
  
  console.log(`[import] Loaded CSV with ${allLines.length} lines`);
  
  const sections: CSVSection[] = [
    { startLine: 6862, endLine: 6888, tableName: 'servicos', headers: [] },
    { startLine: 4903, endLine: 5171, tableName: 'entidades', headers: [] },
    { startLine: 5722, endLine: 6861, tableName: 'planos_servicos', headers: [] },
    { startLine: 3353, endLine: 4475, tableName: 'contratos', headers: [] },
    { startLine: 4476, endLine: 4902, tableName: 'contratos_itens', headers: [] },
  ];
  
  const results: Record<string, { imported: number; skipped: number }> = {};
  
  for (const section of sections) {
    const headerLine = allLines[section.startLine - 1];
    section.headers = parseCSVLine(headerLine);
    
    const dataLines = allLines.slice(section.startLine, section.endLine);
    
    try {
      results[section.tableName] = await importSection(dataLines, section.tableName, section.headers);
    } catch (err: any) {
      console.error(`[import] Failed to import ${section.tableName}: ${err.message}`);
      results[section.tableName] = { imported: 0, skipped: dataLines.length };
    }
  }
  
  return results;
}

if (require.main === module) {
  importContratosFromCSV()
    .then(results => {
      console.log('[import] Import completed:', results);
      process.exit(0);
    })
    .catch(err => {
      console.error('[import] Import failed:', err);
      process.exit(1);
    });
}
