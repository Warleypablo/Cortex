import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function check() {
  // Verificar status dos contratos
  const statusResult = await db.execute(sql`
    SELECT status, COUNT(*) as total
    FROM staging.contratos
    GROUP BY status
    ORDER BY total DESC
  `);
  
  console.log('Status dos contratos:');
  console.log(JSON.stringify(statusResult.rows, null, 2));

  // Verificar alguns contratos com entidade_id e seus CNPJs (qualquer status)
  const result = await db.execute(sql`
    SELECT c.id, c.numero_contrato, c.entidade_id, c.status, e.cpf_cnpj,
           REPLACE(REPLACE(REPLACE(e.cpf_cnpj, '.', ''), '/', ''), '-', '') as cnpj_limpo
    FROM staging.contratos c
    LEFT JOIN staging.entidades e ON c.entidade_id = e.id
    WHERE e.cpf_cnpj IS NOT NULL
    LIMIT 10
  `);
  
  console.log('\nContratos com CNPJ:');
  console.log(JSON.stringify(result.rows, null, 2));
  
  // Verificar alguns clientes
  const clientes = await db.execute(sql`
    SELECT id, cnpj
    FROM cup_clientes
    WHERE cnpj IS NOT NULL
    LIMIT 10
  `);
  
  console.log('\nClientes com CNPJ:');
  console.log(JSON.stringify(clientes.rows, null, 2));
  
  process.exit(0);
}
check();
