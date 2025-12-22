import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const externalPool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  console.log('Creating tables if not exist...');
  
  await externalPool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      cnpj TEXT,
      additional_info TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  
  await externalPool.query(`
    CREATE TABLE IF NOT EXISTS credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT,
      access_url TEXT,
      observations TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  
  await externalPool.query(`
    CREATE INDEX IF NOT EXISTS idx_credentials_client_id ON credentials(client_id);
  `);
  
  console.log('Tables created successfully!');
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

async function importCredentialsBatch() {
  console.log('Importing credentials in batch...');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'credentials_data_1766406231114.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  console.log(`Total credential lines to process: ${lines.length - 1}`);
  
  let imported = 0;
  let errors = 0;
  const batchSize = 50;
  
  for (let i = 1; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, Math.min(i + batchSize, lines.length));
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    for (const line of batch) {
      const cols = parseCSVLine(line);
      if (cols.length < 9) continue;
      
      const [id, client_id, platform, username, observations, created_by, created_at, updated_at, password, access_url] = cols;
      
      values.push(
        id || null,
        client_id || null,
        platform || '',
        username || '',
        password || null,
        access_url || null,
        observations || null,
        created_by || null,
        created_at || new Date().toISOString(),
        updated_at || new Date().toISOString()
      );
      
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
    }
    
    if (placeholders.length > 0) {
      try {
        await externalPool.query(`
          INSERT INTO credentials (id, client_id, platform, username, password, access_url, observations, created_by, created_at, updated_at)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (id) DO NOTHING
        `, values);
        imported += placeholders.length;
        console.log(`Imported batch: ${imported}/${lines.length - 1}`);
      } catch (err: any) {
        console.error(`Batch error:`, err.message);
        errors += placeholders.length;
      }
    }
  }
  
  console.log(`Credentials imported: ${imported}, Errors: ${errors}`);
}

async function main() {
  try {
    console.log('Connecting to external database...');
    await externalPool.query('SELECT 1');
    console.log('Connected successfully!');
    
    await createTables();
    await importCredentialsBatch();
    
    const clientCount = await externalPool.query('SELECT COUNT(*) FROM clients');
    const credentialCount = await externalPool.query('SELECT COUNT(*) FROM credentials');
    
    console.log('\n=== Import Summary ===');
    console.log(`Total clients in database: ${clientCount.rows[0].count}`);
    console.log(`Total credentials in database: ${credentialCount.rows[0].count}`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await externalPool.end();
  }
}

main();
