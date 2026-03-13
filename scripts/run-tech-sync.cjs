#!/usr/bin/env node
// One-time script to run tech sync (status history + comments) directly
require('dotenv').config();
const { Pool } = require('pg');

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const pool = new Pool({ connectionString: process.env.dbUrl });

async function fetchBulkTimeInStatus(taskIds) {
  const results = {};
  for (let i = 0; i < taskIds.length; i += 100) {
    const batch = taskIds.slice(i, i + 100);
    const queryParams = batch.map(id => `task_ids=${id}`).join('&');
    const response = await fetch(
      `https://api.clickup.com/api/v2/task/bulk_time_in_status/task_ids?${queryParams}`,
      { headers: { Authorization: CLICKUP_API_KEY } }
    );
    if (response.ok) {
      const data = await response.json();
      // API returns {taskId: {current_status, status_history}} at root level
      for (const [taskId, taskData] of Object.entries(data)) {
        if (taskData && typeof taskData === 'object' && taskData.status_history) {
          results[taskId] = taskData.status_history;
        }
      }
    } else {
      console.warn(`Batch failed (status ${response.status}), skipping ${batch.length} tasks`);
    }
    if (i + 100 < taskIds.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return results;
}

async function fetchTaskComments(taskId) {
  const comments = [];
  let startId;
  while (true) {
    let url = `https://api.clickup.com/api/v2/task/${taskId}/comment?`;
    if (startId) url += `start_id=${startId}&`;
    const response = await fetch(url, { headers: { Authorization: CLICKUP_API_KEY } });
    if (!response.ok) break;
    const data = await response.json();
    if (!data.comments || data.comments.length === 0) break;
    comments.push(...data.comments);
    if (data.comments.length < 25) break;
    startId = data.comments[data.comments.length - 1].id;
  }
  return comments;
}

function extractTags(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const tags = [];
  if (/bloqueio|bloqueado|impedimento|impedido/.test(lower)) tags.push('bloqueio');
  if (/pendência|pendencia|aguardando cliente|aguardando aprovação|aguardando aprovacao/.test(lower)) tags.push('pendencia_cliente');
  if (/atraso|risco|urgente|crítico|critico/.test(lower)) tags.push('alerta');
  return tags;
}

async function run() {
  console.log('=== Tech Hub Sync ===');

  const openResult = await pool.query('SELECT clickup_task_id, data_criada FROM "Clickup".cup_projetos_tech');
  const closedResult = await pool.query('SELECT clickup_task_id, data_criada FROM "Clickup".cup_projetos_tech_fechados');

  const openIds = openResult.rows.map(r => r.clickup_task_id);
  const closedIds = closedResult.rows.map(r => r.clickup_task_id);
  const allIds = [...openIds, ...closedIds];

  const creationDates = {};
  [...openResult.rows, ...closedResult.rows].forEach(r => {
    creationDates[r.clickup_task_id] = r.data_criada;
  });

  console.log(`Found ${openIds.length} open + ${closedIds.length} closed = ${allIds.length} total tasks`);

  // 1. Sync status history
  console.log('Fetching bulk time in status...');
  const bulkData = await fetchBulkTimeInStatus(allIds);
  console.log(`Got status data for ${Object.keys(bulkData).length} tasks`);

  await pool.query('TRUNCATE TABLE "Clickup".cup_status_history');

  let historyRows = 0;
  for (const [taskId, statusHistory] of Object.entries(bulkData)) {
    if (!statusHistory || !Array.isArray(statusHistory)) continue;

    const entries = statusHistory.map(entry => ({
      status: (entry.status || '').toLowerCase(),
      totalTimeMs: (parseInt(entry.total_time?.by_minute) || 0) * 60000,
      orderindex: parseInt(entry.orderindex) || 0,
    }));
    entries.sort((a, b) => a.orderindex - b.orderindex);

    const creationDate = creationDates[taskId];
    let cumulativeMs = 0;
    const baseTime = creationDate
      ? (creationDate instanceof Date ? creationDate.getTime() : new Date(creationDate).getTime())
      : Date.now();

    for (let i = 0; i < entries.length; i++) {
      const prev = i > 0 ? entries[i - 1].status : null;
      const curr = entries[i];
      const transicaoDate = new Date(baseTime + cumulativeMs);

      await pool.query(
        `INSERT INTO "Clickup".cup_status_history
         (clickup_task_id, status_anterior, status_novo, data_transicao, duracao_ms)
         VALUES ($1, $2, $3, $4, $5)`,
        [taskId, prev, curr.status, transicaoDate, curr.totalTimeMs]
      );
      historyRows++;
      cumulativeMs += curr.totalTimeMs;
    }
  }
  console.log(`Inserted ${historyRows} status history rows`);

  // 2. Sync comments (already done, skip if data exists)
  const existingComments = await pool.query('SELECT COUNT(*) as cnt FROM "Clickup".cup_comentarios');
  if (parseInt(existingComments.rows[0].cnt) > 0) {
    console.log(`Comments already synced (${existingComments.rows[0].cnt} rows), skipping`);
  } else {
    console.log(`Fetching comments for ${openIds.length} open tasks...`);
    let commentRows = 0;
    for (const taskId of openIds) {
      const comments = await fetchTaskComments(taskId);
      for (const comment of comments) {
        const text = Array.isArray(comment.comment_text)
          ? comment.comment_text.map(c => c.text || '').join('')
          : (comment.comment_text || '');
        const tags = extractTags(text);
        const autor = comment.user?.username || comment.user?.email || 'unknown';
        const dataCriacao = comment.date ? new Date(parseInt(comment.date)) : null;

        await pool.query(
          `INSERT INTO "Clickup".cup_comentarios
           (clickup_task_id, clickup_comment_id, autor, texto, data_criacao, tags_extraidas)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (clickup_comment_id) DO UPDATE SET
             texto = EXCLUDED.texto,
             tags_extraidas = EXCLUDED.tags_extraidas`,
          [taskId, comment.id, autor, text, dataCriacao, tags]
        );
        commentRows++;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`Upserted ${commentRows} comments`);
  }

  console.log('=== Sync complete ===');
  await pool.end();
}

run().catch(e => { console.error('FATAL:', e.message); pool.end(); process.exit(1); });
