import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('[database] Unexpected error on idle client', err);
});

export const db = drizzle(pool, { schema });
export { schema };

export async function initializeNotificationsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.notifications (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_id TEXT,
        entity_type TEXT,
        read BOOLEAN DEFAULT false,
        dismissed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        unique_key TEXT UNIQUE
      )
    `);
    console.log('[database] Notifications table initialized');
  } catch (error) {
    console.error('[database] Error initializing notifications table:', error);
  }
}

export async function initializeSystemFieldOptionsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_field_options (
        id SERIAL PRIMARY KEY,
        field_type TEXT NOT NULL,
        value TEXT NOT NULL,
        label TEXT NOT NULL,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(field_type, value)
      )
    `);
    console.log('[database] System field options table initialized');
  } catch (error) {
    console.error('[database] Error initializing system field options table:', error);
  }
}
