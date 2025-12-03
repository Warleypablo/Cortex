import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { db } from "../db";
import { sql } from "drizzle-orm";

interface WonDeal {
  id: number;
  title: string;
  closerName: string;
  opportunity: number;
  stageName: string;
  dateWon: string;
  contractType: string;
}

const clients = new Set<WebSocket>();
let lastCheckedId: number | null = null;
let pollInterval: NodeJS.Timeout | null = null;

export function setupDealNotifications(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/deals" });

  wss.on("connection", (ws) => {
    console.log("[WebSocket] Client connected to deal notifications");
    clients.add(ws);

    ws.on("close", () => {
      console.log("[WebSocket] Client disconnected");
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("[WebSocket] Error:", error);
      clients.delete(ws);
    });
  });

  initializeLastCheckedId().then(() => {
    startPolling();
  });

  console.log("[WebSocket] Deal notifications service initialized");
}

async function initializeLastCheckedId() {
  try {
    const result = await db.execute(sql`
      SELECT MAX(id) as max_id 
      FROM crm_deal 
      WHERE stage_name = 'Negócio Ganho'
    `);
    
    const row = result.rows[0] as any;
    lastCheckedId = row?.max_id || 0;
    console.log("[DealNotifications] Initialized with last ID:", lastCheckedId);
  } catch (error) {
    console.error("[DealNotifications] Error initializing:", error);
    lastCheckedId = 0;
  }
}

function startPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  pollInterval = setInterval(async () => {
    await checkForNewDeals();
  }, 5000);

  console.log("[DealNotifications] Polling started (every 5 seconds)");
}

async function checkForNewDeals() {
  try {
    const result = await db.execute(sql`
      SELECT 
        d.id,
        d.title,
        d.valor_recorrente,
        d.stage_name,
        d.data_fechamento,
        d.category_name,
        d.assigned_by_name as closer_name
      FROM crm_deal d
      WHERE d.stage_name = 'Negócio Ganho'
        AND d.id > ${lastCheckedId}
        AND d.category_name = 'Recorrente'
      ORDER BY d.id ASC
    `);

    if (result.rows.length > 0) {
      console.log(`[DealNotifications] Found ${result.rows.length} new won deals!`);

      for (const row of result.rows as any[]) {
        const deal: WonDeal = {
          id: row.id,
          title: row.title || "Novo Contrato",
          closerName: row.closer_name || "Closer",
          opportunity: parseFloat(row.valor_recorrente) || 0,
          stageName: row.stage_name,
          dateWon: row.data_fechamento,
          contractType: row.category_name || "Recorrente"
        };

        // Always update lastCheckedId to avoid missing deals
        lastCheckedId = Math.max(lastCheckedId || 0, row.id);

        // Only broadcast if there are connected clients
        if (clients.size > 0) {
          broadcastNewDeal(deal);
        } else {
          console.log(`[DealNotifications] No clients connected, skipping broadcast for deal ${deal.id}`);
        }
      }
    }
  } catch (error) {
    console.error("[DealNotifications] Error checking for new deals:", error);
  }
}

function broadcastNewDeal(deal: WonDeal) {
  const message = JSON.stringify({
    type: "NEW_DEAL_WON",
    data: deal,
    timestamp: new Date().toISOString()
  });

  console.log(`[DealNotifications] Broadcasting new deal: ${deal.title} - R$ ${deal.opportunity}`);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function triggerTestNotification() {
  const testDeal: WonDeal = {
    id: Date.now(),
    title: "Teste - Novo Contrato Recorrente",
    closerName: "João Silva",
    opportunity: 5000,
    stageName: "Negócio Ganho",
    dateWon: new Date().toISOString(),
    contractType: "Recorrente"
  };

  broadcastNewDeal(testDeal);
  return testDeal;
}
