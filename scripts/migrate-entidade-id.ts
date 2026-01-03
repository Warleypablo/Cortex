import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

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

async function migrate() {
  const csvPath = path.join(process.cwd(), 'attached_assets', 'contratos_1767400491343.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  const headers = parseCSVLine(lines[0]);
  const idIndex = headers.findIndex(h => h.toLowerCase() === 'id');
  const clienteIdIndex = headers.findIndex(h => h.toLowerCase() === 'cliente_id');

  console.log('id index:', idIndex, 'cliente_id index:', clienteIdIndex);

  const mappings: { id: number; clienteId: number }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const id = parseInt(values[idIndex]);
    const clienteId = parseInt(values[clienteIdIndex]);
    
    if (!isNaN(id) && !isNaN(clienteId) && clienteId > 0) {
      mappings.push({ id, clienteId });
    }
  }

  console.log('Total mappings:', mappings.length);

  let success = 0;
  let errors = 0;

  for (const { id, clienteId } of mappings) {
    try {
      await db.execute(sql`
        UPDATE staging.contratos 
        SET entidade_id = ${clienteId}
        WHERE id = ${id}
      `);
      success++;
    } catch (e: any) {
      errors++;
      if (errors <= 3) console.error('Error for id', id, ':', e.message);
    }
  }

  console.log('Done:', success, 'updated,', errors, 'errors');
  process.exit(0);
}

migrate();
