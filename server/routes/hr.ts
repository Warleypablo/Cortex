import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import { insertRhCargoSchema, insertRhNivelSchema, insertRhSquadSchema, insertRhPromocaoSchema } from "@shared/schema";

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

const defaultCargos = [
  { id: 1, nome: "Gestor de Performance", descricao: null, ativo: "true" },
  { id: 2, nome: "Designer", descricao: null, ativo: "true" },
  { id: 3, nome: "Analista de Comunicação", descricao: null, ativo: "true" },
  { id: 4, nome: "CXCS", descricao: null, ativo: "true" },
  { id: 5, nome: "Desenvolvedor", descricao: null, ativo: "true" },
  { id: 6, nome: "PO", descricao: null, ativo: "true" },
  { id: 7, nome: "Copy", descricao: null, ativo: "true" },
  { id: 8, nome: "UIUX", descricao: null, ativo: "true" },
  { id: 9, nome: "Inside Sales", descricao: null, ativo: "true" },
  { id: 10, nome: "Pré-Vendas", descricao: null, ativo: "true" },
  { id: 11, nome: "Analista de Dados", descricao: null, ativo: "true" },
  { id: 12, nome: "Financeiro", descricao: null, ativo: "true" },
  { id: 13, nome: "G&G", descricao: null, ativo: "true" },
  { id: 14, nome: "C-Level", descricao: null, ativo: "true" },
  { id: 15, nome: "Videomaker", descricao: null, ativo: "true" },
  { id: 16, nome: "Líder de Squad", descricao: null, ativo: "true" },
  { id: 17, nome: "Jurídico", descricao: null, ativo: "true" },
];

const defaultNiveis = [
  { id: 1, nome: "Estágio", ordem: 1, ativo: "true" },
  { id: 2, nome: "I", ordem: 2, ativo: "true" },
  { id: 3, nome: "II", ordem: 3, ativo: "true" },
  { id: 4, nome: "III", ordem: 4, ativo: "true" },
  { id: 5, nome: "IV", ordem: 5, ativo: "true" },
  { id: 6, nome: "V", ordem: 6, ativo: "true" },
  { id: 7, nome: "VI", ordem: 7, ativo: "true" },
  { id: 8, nome: "Gerente/Supervisor", ordem: 8, ativo: "true" },
  { id: 9, nome: "Diretor", ordem: 9, ativo: "true" },
];

const defaultSquads = [
  { id: 1, nome: "💰 Vendas", descricao: null, ativo: "true" },
  { id: 2, nome: "🪖 Selva", descricao: null, ativo: "true" },
  { id: 3, nome: "⚓️ Squadra", descricao: null, ativo: "true" },
  { id: 4, nome: "💠 Pulse", descricao: null, ativo: "true" },
  { id: 5, nome: "👾 Squad X", descricao: null, ativo: "true" },
  { id: 6, nome: "🖥️ Tech", descricao: null, ativo: "true" },
  { id: 7, nome: "📊 CX&CS", descricao: null, ativo: "true" },
  { id: 8, nome: "🚀 Turbo Interno", descricao: null, ativo: "true" },
  { id: 9, nome: "⭐️ Ventures", descricao: null, ativo: "true" },
  { id: 10, nome: "🔥 Chama (OFF)", descricao: null, ativo: "true" },
  { id: 11, nome: "🏹 Hunters (OFF)", descricao: null, ativo: "true" },
  { id: 12, nome: "🧩 Fragmentados (OFF)", descricao: null, ativo: "true" },
  { id: 13, nome: "✨ Makers", descricao: null, ativo: "true" },
];

export function registerHRRoutes(app: Express, db: any, storage: IStorage) {
  // ============ Telefones (Linhas Telefônicas) Endpoints ============
  app.get("/api/telefones", async (req, res) => {
    try {
      const telefones = await storage.getTelefones();
      res.json(telefones);
    } catch (error) {
      console.error("[api] Error fetching telefones:", error);
      res.status(500).json({ error: "Failed to fetch telefones" });
    }
  });

  app.get("/api/telefones/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid telefone ID" });
      }
      const telefone = await storage.getTelefoneById(id);
      if (!telefone) {
        return res.status(404).json({ error: "Telefone not found" });
      }
      res.json(telefone);
    } catch (error) {
      console.error("[api] Error fetching telefone by id:", error);
      res.status(500).json({ error: "Failed to fetch telefone" });
    }
  });

  app.patch("/api/telefones/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid telefone ID" });
      }
      
      const { responsavelNome, responsavelId, ultimaRecarga, status } = req.body;
      
      const updateData: Record<string, string | number | null> = {};
      if (responsavelNome !== undefined) updateData.responsavelNome = responsavelNome || null;
      if (responsavelId !== undefined) updateData.responsavelId = responsavelId || null;
      if (ultimaRecarga !== undefined) updateData.ultimaRecarga = ultimaRecarga || null;
      if (status !== undefined) updateData.status = status || null;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }
      
      const telefone = await storage.updateTelefone(id, updateData);
      res.json(telefone);
    } catch (error) {
      console.error("[api] Error updating telefone:", error);
      res.status(500).json({ error: "Failed to update telefone" });
    }
  });

  // ============ RH Cargos Endpoints ============
  app.get("/api/rh/cargos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, descricao, ativo, criado_em as "criadoEm"
        FROM rh_cargos 
        WHERE ativo = 'true' 
        ORDER BY nome
      `);
      if (result.rows.length === 0) {
        return res.json(defaultCargos);
      }
      res.json(result.rows);
    } catch (error: any) {
      if (error?.code === '42P01') {
        return res.json(defaultCargos);
      }
      console.error("[api] Error fetching cargos:", error);
      res.status(500).json({ error: "Failed to fetch cargos" });
    }
  });

  app.post("/api/rh/cargos", isAdmin, async (req, res) => {
    try {
      const validation = insertRhCargoSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { nome, descricao, ativo } = validation.data;
      const result = await db.execute(sql`
        INSERT INTO rh_cargos (nome, descricao, ativo)
        VALUES (${nome}, ${descricao || null}, ${ativo || 'true'})
        RETURNING id, nome, descricao, ativo, criado_em as "criadoEm"
      `);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating cargo:", error);
      res.status(500).json({ error: "Failed to create cargo" });
    }
  });

  app.delete("/api/rh/cargos/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid cargo ID" });
      }
      await db.execute(sql`
        UPDATE rh_cargos SET ativo = 'false' WHERE id = ${id}
      `);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting cargo:", error);
      res.status(500).json({ error: "Failed to delete cargo" });
    }
  });

  // ============ RH Níveis Endpoints ============
  app.get("/api/rh/niveis", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, ordem, ativo, criado_em as "criadoEm"
        FROM rh_niveis 
        WHERE ativo = 'true' 
        ORDER BY ordem, nome
      `);
      if (result.rows.length === 0) {
        return res.json(defaultNiveis);
      }
      res.json(result.rows);
    } catch (error: any) {
      if (error?.code === '42P01') {
        return res.json(defaultNiveis);
      }
      console.error("[api] Error fetching niveis:", error);
      res.status(500).json({ error: "Failed to fetch niveis" });
    }
  });

  app.post("/api/rh/niveis", isAdmin, async (req, res) => {
    try {
      const validation = insertRhNivelSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { nome, ordem, ativo } = validation.data;
      const result = await db.execute(sql`
        INSERT INTO rh_niveis (nome, ordem, ativo)
        VALUES (${nome}, ${ordem || 0}, ${ativo || 'true'})
        RETURNING id, nome, ordem, ativo, criado_em as "criadoEm"
      `);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating nivel:", error);
      res.status(500).json({ error: "Failed to create nivel" });
    }
  });

  app.delete("/api/rh/niveis/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid nivel ID" });
      }
      await db.execute(sql`
        UPDATE rh_niveis SET ativo = 'false' WHERE id = ${id}
      `);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting nivel:", error);
      res.status(500).json({ error: "Failed to delete nivel" });
    }
  });

  // ============ RH Squads Endpoints ============
  app.get("/api/rh/squads", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, descricao, ativo, criado_em as "criadoEm"
        FROM rh_squads 
        WHERE ativo = 'true' 
        ORDER BY nome
      `);
      if (result.rows.length === 0) {
        return res.json(defaultSquads);
      }
      res.json(result.rows);
    } catch (error: any) {
      if (error?.code === '42P01') {
        return res.json(defaultSquads);
      }
      console.error("[api] Error fetching squads:", error);
      res.status(500).json({ error: "Failed to fetch squads" });
    }
  });

  app.post("/api/rh/squads", isAdmin, async (req, res) => {
    try {
      const validation = insertRhSquadSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { nome, descricao, ativo } = validation.data;
      const result = await db.execute(sql`
        INSERT INTO rh_squads (nome, descricao, ativo)
        VALUES (${nome}, ${descricao || null}, ${ativo || 'true'})
        RETURNING id, nome, descricao, ativo, criado_em as "criadoEm"
      `);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating squad:", error);
      res.status(500).json({ error: "Failed to create squad" });
    }
  });

  app.delete("/api/rh/squads/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid squad ID" });
      }
      await db.execute(sql`
        UPDATE rh_squads SET ativo = 'false' WHERE id = ${id}
      `);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting squad:", error);
      res.status(500).json({ error: "Failed to delete squad" });
    }
  });

  // ============ Promoções Endpoints ============
  app.get("/api/colaboradores/:id/promocoes", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const result = await db.execute(sql`
        SELECT 
          id, 
          colaborador_id as "colaboradorId",
          data_promocao as "dataPromocao",
          cargo_anterior as "cargoAnterior",
          cargo_novo as "cargoNovo",
          nivel_anterior as "nivelAnterior",
          nivel_novo as "nivelNovo",
          salario_anterior as "salarioAnterior",
          salario_novo as "salarioNovo",
          observacoes,
          criado_em as "criadoEm",
          criado_por as "criadoPor"
        FROM rh_promocoes 
        WHERE colaborador_id = ${id}
        ORDER BY data_promocao DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching promocoes:", error);
      res.status(500).json({ error: "Failed to fetch promocoes" });
    }
  });

  app.post("/api/colaboradores/:id/promocoes", async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.id);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const validation = insertRhPromocaoSchema.safeParse({ ...req.body, colaboradorId });
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { dataPromocao, cargoAnterior, cargoNovo, nivelAnterior, nivelNovo, salarioAnterior, salarioNovo, observacoes, criadoPor } = validation.data;
      
      const result = await db.execute(sql`
        INSERT INTO rh_promocoes (colaborador_id, data_promocao, cargo_anterior, cargo_novo, nivel_anterior, nivel_novo, salario_anterior, salario_novo, observacoes, criado_por)
        VALUES (${colaboradorId}, ${dataPromocao}, ${cargoAnterior || null}, ${cargoNovo || null}, ${nivelAnterior || null}, ${nivelNovo || null}, ${salarioAnterior || null}, ${salarioNovo || null}, ${observacoes || null}, ${criadoPor || null})
        RETURNING 
          id, 
          colaborador_id as "colaboradorId",
          data_promocao as "dataPromocao",
          cargo_anterior as "cargoAnterior",
          cargo_novo as "cargoNovo",
          nivel_anterior as "nivelAnterior",
          nivel_novo as "nivelNovo",
          salario_anterior as "salarioAnterior",
          salario_novo as "salarioNovo",
          observacoes,
          criado_em as "criadoEm",
          criado_por as "criadoPor"
      `);
      
      try {
        await db.execute(sql`
          UPDATE rh_pessoal 
          SET 
            cargo = COALESCE(${cargoNovo || null}, cargo),
            nivel = COALESCE(${nivelNovo || null}, nivel),
            salario = COALESCE(${salarioNovo || null}, salario),
            ultimo_aumento = ${dataPromocao}
          WHERE id = ${colaboradorId}
        `);
      } catch (updateError) {
        console.error("[api] Error updating colaborador after promotion:", updateError);
      }
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating promocao:", error);
      res.status(500).json({ error: "Failed to create promocao" });
    }
  });

  // ============ 1x1 (One-on-One) Endpoints ============
  app.get("/api/colaboradores/:id/one-on-one", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const meetings = await storage.getOneOnOneMeetings(id);
      res.json(meetings);
    } catch (error) {
      console.error("[api] Error fetching one-on-one meetings:", error);
      res.status(500).json({ error: "Failed to fetch one-on-one meetings" });
    }
  });

  app.post("/api/colaboradores/:id/one-on-one", async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.id);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const meeting = await storage.createOneOnOneMeeting({ ...req.body, colaboradorId });
      res.status(201).json(meeting);
    } catch (error) {
      console.error("[api] Error creating one-on-one meeting:", error);
      res.status(500).json({ error: "Failed to create one-on-one meeting" });
    }
  });

  app.put("/api/one-on-one/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid meeting ID" });
      }
      const meeting = await storage.updateOneOnOneMeeting(id, req.body);
      res.json(meeting);
    } catch (error) {
      console.error("[api] Error updating one-on-one meeting:", error);
      res.status(500).json({ error: "Failed to update one-on-one meeting" });
    }
  });

  app.delete("/api/one-on-one/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid meeting ID" });
      }
      await storage.deleteOneOnOneMeeting(id);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting one-on-one meeting:", error);
      res.status(500).json({ error: "Failed to delete one-on-one meeting" });
    }
  });

  app.get("/api/one-on-one/:id/acoes", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid meeting ID" });
      }
      const acoes = await storage.getOneOnOneAcoes(id);
      res.json(acoes);
    } catch (error) {
      console.error("[api] Error fetching one-on-one acoes:", error);
      res.status(500).json({ error: "Failed to fetch one-on-one acoes" });
    }
  });

  app.post("/api/one-on-one/:id/acoes", async (req, res) => {
    try {
      const oneOnOneId = parseInt(req.params.id);
      if (isNaN(oneOnOneId)) {
        return res.status(400).json({ error: "Invalid meeting ID" });
      }
      const acao = await storage.createOneOnOneAcao({ ...req.body, oneOnOneId });
      res.status(201).json(acao);
    } catch (error) {
      console.error("[api] Error creating one-on-one acao:", error);
      res.status(500).json({ error: "Failed to create one-on-one acao" });
    }
  });

  app.patch("/api/one-on-one/acoes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid acao ID" });
      }
      const acao = await storage.updateOneOnOneAcao(id, { status: req.body.status });
      res.json(acao);
    } catch (error) {
      console.error("[api] Error updating one-on-one acao:", error);
      res.status(500).json({ error: "Failed to update one-on-one acao" });
    }
  });

  // ============ E-NPS Endpoints ============
  app.get("/api/colaboradores/:id/enps", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const responses = await storage.getEnpsResponses(id);
      res.json(responses);
    } catch (error) {
      console.error("[api] Error fetching E-NPS responses:", error);
      res.status(500).json({ error: "Failed to fetch E-NPS responses" });
    }
  });

  app.post("/api/colaboradores/:id/enps", async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.id);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const response = await storage.createEnpsResponse({ ...req.body, colaboradorId });
      res.status(201).json(response);
    } catch (error) {
      console.error("[api] Error creating E-NPS response:", error);
      res.status(500).json({ error: "Failed to create E-NPS response" });
    }
  });

  // ============ PDI (Plano de Desenvolvimento Individual) Endpoints ============
  app.get("/api/colaboradores/:id/pdi", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const goals = await storage.getPdiGoals(id);
      res.json(goals);
    } catch (error) {
      console.error("[api] Error fetching PDI goals:", error);
      res.status(500).json({ error: "Failed to fetch PDI goals" });
    }
  });

  app.post("/api/colaboradores/:id/pdi", async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.id);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const goal = await storage.createPdiGoal({ ...req.body, colaboradorId });
      res.status(201).json(goal);
    } catch (error) {
      console.error("[api] Error creating PDI goal:", error);
      res.status(500).json({ error: "Failed to create PDI goal" });
    }
  });

  app.put("/api/pdi/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid PDI goal ID" });
      }
      const goal = await storage.updatePdiGoal(id, req.body);
      res.json(goal);
    } catch (error) {
      console.error("[api] Error updating PDI goal:", error);
      res.status(500).json({ error: "Failed to update PDI goal" });
    }
  });

  app.delete("/api/pdi/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid PDI goal ID" });
      }
      await storage.deletePdiGoal(id);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting PDI goal:", error);
      res.status(500).json({ error: "Failed to delete PDI goal" });
    }
  });

  // ============ PDI Checkpoints Endpoints ============
  app.get("/api/pdi/:pdiId/checkpoints", async (req, res) => {
    try {
      const pdiId = parseInt(req.params.pdiId);
      if (isNaN(pdiId)) {
        return res.status(400).json({ error: "Invalid PDI ID" });
      }
      const checkpoints = await storage.getPdiCheckpoints(pdiId);
      res.json(checkpoints);
    } catch (error) {
      console.error("[api] Error fetching PDI checkpoints:", error);
      res.status(500).json({ error: "Failed to fetch checkpoints" });
    }
  });

  app.post("/api/pdi/:pdiId/checkpoints", async (req, res) => {
    try {
      const pdiId = parseInt(req.params.pdiId);
      if (isNaN(pdiId)) {
        return res.status(400).json({ error: "Invalid PDI ID" });
      }
      const checkpoint = await storage.createPdiCheckpoint({ ...req.body, pdiId });
      res.status(201).json(checkpoint);
    } catch (error) {
      console.error("[api] Error creating PDI checkpoint:", error);
      res.status(500).json({ error: "Failed to create checkpoint" });
    }
  });

  app.put("/api/pdi/checkpoints/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid checkpoint ID" });
      }
      const checkpoint = await storage.updatePdiCheckpoint(id, req.body);
      res.json(checkpoint);
    } catch (error) {
      console.error("[api] Error updating PDI checkpoint:", error);
      res.status(500).json({ error: "Failed to update checkpoint" });
    }
  });

  app.delete("/api/pdi/checkpoints/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid checkpoint ID" });
      }
      await storage.deletePdiCheckpoint(id);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting PDI checkpoint:", error);
      res.status(500).json({ error: "Failed to delete checkpoint" });
    }
  });
}
