// scripts/auditoria/lib/render-csv.ts
import { stringify } from 'csv-stringify/sync';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export function writeCsv(filePath: string, rows: Record<string, unknown>[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  if (rows.length === 0) {
    writeFileSync(filePath, '', 'utf-8');
    return;
  }
  const csv = stringify(rows, { header: true, columns: Object.keys(rows[0]) });
  writeFileSync(filePath, csv, 'utf-8');
}
