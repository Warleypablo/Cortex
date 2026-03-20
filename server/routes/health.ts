import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/health', async (_req, res) => {
  const start = Date.now();
  const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};

  // 1. Database connection
  try {
    const t = Date.now();
    const result = await pool.query('SELECT 1 as health');
    checks.database = { ok: result.rows[0]?.health === 1, ms: Date.now() - t };
  } catch (e) {
    checks.database = { ok: false, ms: 0, error: String(e) };
  }

  // 2. Critical tables exist
  try {
    const t = Date.now();
    const tables = [
      'cortex_core.users',
      '"Clickup".cup_clientes',
      '"Clickup".cup_contratos',
    ];
    const errors: string[] = [];
    for (const table of tables) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 0`);
      } catch (e) {
        errors.push(`${table}: ${String(e)}`);
      }
    }
    checks.tables = {
      ok: errors.length === 0,
      ms: Date.now() - t,
      ...(errors.length > 0 && { error: errors.join('; ') }),
    };
  } catch (e) {
    checks.tables = { ok: false, ms: 0, error: String(e) };
  }

  // 3. Memory usage
  const mem = process.memoryUsage();
  checks.memory = {
    ok: mem.heapUsed < 500 * 1024 * 1024,
    ms: 0,
    ...(mem.heapUsed >= 500 * 1024 * 1024 && {
      error: `Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
    }),
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    total_ms: Date.now() - start,
    uptime_seconds: Math.round(process.uptime()),
    checks,
  });
});

export default router;
