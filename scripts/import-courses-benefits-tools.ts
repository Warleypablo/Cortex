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

async function createEnumsAndTables() {
  console.log('Creating ENUMs and tables...');
  
  // Create ENUMs (ignore if already exist)
  try {
    await externalPool.query(`CREATE TYPE course_status AS ENUM ('ativo', 'vitalicio', 'cancelado', 'sem_status');`);
  } catch (e: any) { if (!e.message.includes('already exists')) throw e; }
  
  try {
    await externalPool.query(`CREATE TYPE benefit_segment AS ENUM ('alimentos', 'beleza_cosmeticos', 'casa_cozinha', 'tecnologia', 'pet', 'plantas_agro', 'suplementacao', 'moda');`);
  } catch (e: any) { if (!e.message.includes('already exists')) throw e; }
  
  try {
    await externalPool.query(`CREATE TYPE recorrencia AS ENUM ('Mensal', 'Anual');`);
  } catch (e: any) { if (!e.message.includes('already exists')) throw e; }

  // Create courses table
  await externalPool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome TEXT NOT NULL,
      status course_status NOT NULL DEFAULT 'sem_status',
      tema_principal TEXT NOT NULL,
      plataforma TEXT NOT NULL,
      url TEXT,
      login TEXT,
      senha TEXT,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  
  await externalPool.query(`CREATE INDEX IF NOT EXISTS courses_nome_idx ON courses(nome);`);
  await externalPool.query(`CREATE INDEX IF NOT EXISTS courses_status_idx ON courses(status);`);

  // Create benefits table
  await externalPool.query(`
    CREATE TABLE IF NOT EXISTS benefits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      empresa TEXT NOT NULL,
      cupom TEXT NOT NULL,
      desconto TEXT NOT NULL,
      site TEXT NOT NULL,
      segmento benefit_segment NOT NULL,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  
  await externalPool.query(`CREATE INDEX IF NOT EXISTS benefits_empresa_idx ON benefits(empresa);`);
  await externalPool.query(`CREATE INDEX IF NOT EXISTS benefits_segmento_idx ON benefits(segmento);`);

  // Create turbo_tools table
  await externalPool.query(`
    CREATE TABLE IF NOT EXISTS turbo_tools (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      login TEXT,
      password TEXT,
      site TEXT,
      observations TEXT,
      valor TEXT,
      recorrencia recorrencia,
      data_primeiro_pagamento TIMESTAMP,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  
  await externalPool.query(`CREATE INDEX IF NOT EXISTS turbo_tools_name_idx ON turbo_tools(name);`);
  
  console.log('ENUMs and tables created successfully!');
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

async function importCourses() {
  console.log('Importing courses...');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'courses_data_1766407251971.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  console.log(`Total course lines: ${lines.length - 1}`);
  
  let imported = 0;
  let errors = 0;
  const batchSize = 20;
  
  for (let i = 1; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, Math.min(i + batchSize, lines.length));
    
    for (const line of batch) {
      const cols = parseCSVLine(line);
      if (cols.length < 10) continue;
      
      const [id, nome, status, tema_principal, plataforma, url, login, senha, created_by, created_at, updated_at] = cols;
      
      // Map status to valid enum values
      let validStatus = status?.toLowerCase() || 'sem_status';
      if (!['ativo', 'vitalicio', 'cancelado', 'sem_status'].includes(validStatus)) {
        validStatus = 'sem_status';
      }
      
      try {
        await externalPool.query(`
          INSERT INTO courses (id, nome, status, tema_principal, plataforma, url, login, senha, created_by, created_at, updated_at)
          VALUES ($1, $2, $3::course_status, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          id || null,
          nome || '',
          validStatus,
          tema_principal || '',
          plataforma || '',
          url || null,
          login || null,
          senha || null,
          created_by || null,
          created_at || new Date().toISOString(),
          updated_at || new Date().toISOString()
        ]);
        imported++;
      } catch (err: any) {
        console.error(`Error importing course ${nome}:`, err.message);
        errors++;
      }
    }
    console.log(`Courses progress: ${Math.min(i + batchSize - 1, lines.length - 1)}/${lines.length - 1}`);
  }
  
  console.log(`Courses imported: ${imported}, Errors: ${errors}`);
}

async function importBenefits() {
  console.log('Importing benefits...');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'benefits_data_1766407229753.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  console.log(`Total benefit lines: ${lines.length - 1}`);
  
  let imported = 0;
  let errors = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 8) continue;
    
    const [id, empresa, cupom, desconto, site, segmento, created_by, created_at, updated_at] = cols;
    
    try {
      await externalPool.query(`
        INSERT INTO benefits (id, empresa, cupom, desconto, site, segmento, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::benefit_segment, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        id || null,
        empresa || '',
        cupom || '',
        desconto || '',
        site || '',
        segmento || 'moda',
        created_by || null,
        created_at || new Date().toISOString(),
        updated_at || new Date().toISOString()
      ]);
      imported++;
    } catch (err: any) {
      console.error(`Error importing benefit ${empresa}:`, err.message);
      errors++;
    }
  }
  
  console.log(`Benefits imported: ${imported}, Errors: ${errors}`);
}

async function importTurboTools() {
  console.log('Importing turbo_tools...');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'turbo_tools_data_1766407234484.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  console.log(`Total turbo_tools lines: ${lines.length - 1}`);
  
  let imported = 0;
  let errors = 0;
  const batchSize = 20;
  
  for (let i = 1; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, Math.min(i + batchSize, lines.length));
    
    for (const line of batch) {
      const cols = parseCSVLine(line);
      if (cols.length < 10) continue;
      
      const [id, name, login, password, site, observations, created_by, created_at, updated_at, valor, recorrencia_val, data_primeiro_pagamento] = cols;
      
      // Map recorrencia to valid enum values
      let validRecorrencia = recorrencia_val || null;
      if (validRecorrencia && !['Mensal', 'Anual'].includes(validRecorrencia)) {
        validRecorrencia = null;
      }
      
      try {
        await externalPool.query(`
          INSERT INTO turbo_tools (id, name, login, password, site, observations, valor, recorrencia, data_primeiro_pagamento, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::recorrencia, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          id || null,
          name || '',
          login || null,
          password || null,
          site || null,
          observations || null,
          valor || null,
          validRecorrencia,
          data_primeiro_pagamento || null,
          created_by || null,
          created_at || new Date().toISOString(),
          updated_at || new Date().toISOString()
        ]);
        imported++;
      } catch (err: any) {
        console.error(`Error importing tool ${name}:`, err.message);
        errors++;
      }
    }
    console.log(`Turbo tools progress: ${Math.min(i + batchSize - 1, lines.length - 1)}/${lines.length - 1}`);
  }
  
  console.log(`Turbo tools imported: ${imported}, Errors: ${errors}`);
}

async function main() {
  try {
    console.log('Connecting to external database (Google Cloud)...');
    await externalPool.query('SELECT 1');
    console.log('Connected successfully!');
    
    await createEnumsAndTables();
    await importCourses();
    await importBenefits();
    await importTurboTools();
    
    const courseCount = await externalPool.query('SELECT COUNT(*) FROM courses');
    const benefitCount = await externalPool.query('SELECT COUNT(*) FROM benefits');
    const toolCount = await externalPool.query('SELECT COUNT(*) FROM turbo_tools');
    
    console.log('\n=== Import Summary ===');
    console.log(`Total courses in database: ${courseCount.rows[0].count}`);
    console.log(`Total benefits in database: ${benefitCount.rows[0].count}`);
    console.log(`Total turbo_tools in database: ${toolCount.rows[0].count}`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await externalPool.end();
  }
}

main();
