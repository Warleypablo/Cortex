import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import { insertRhCargoSchema, insertRhNivelSchema, insertRhSquadSchema, insertRhPromocaoSchema, insertOnboardingTemplateSchema, insertOnboardingEtapaSchema, insertOnboardingColaboradorSchema, insertOnboardingProgressoSchema, insertTelefoneSchema } from "@shared/schema";

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

  app.post("/api/telefones", async (req, res) => {
    try {
      const validation = insertTelefoneSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const novoTelefone = await storage.createTelefone(validation.data);
      res.status(201).json(novoTelefone);
    } catch (error) {
      console.error("[api] Error creating telefone:", error);
      res.status(500).json({ error: "Failed to create telefone" });
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

  // ============ Onboarding Templates Endpoints ============
  app.get("/api/rh/onboarding/templates", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, descricao, ativo, created_at as "createdAt"
        FROM onboarding_templates
        WHERE ativo = true
        ORDER BY nome
      `);
      res.json(result.rows);
    } catch (error: any) {
      if (error?.code === '42P01') {
        return res.json([]);
      }
      console.error("[api] Error fetching onboarding templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/rh/onboarding/templates", isAdmin, async (req, res) => {
    try {
      const validation = insertOnboardingTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { nome, descricao, ativo } = validation.data;
      const result = await db.execute(sql`
        INSERT INTO onboarding_templates (nome, descricao, ativo)
        VALUES (${nome}, ${descricao || null}, ${ativo ?? true})
        RETURNING id, nome, descricao, ativo, created_at as "createdAt"
      `);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating onboarding template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.delete("/api/rh/onboarding/templates/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      await db.execute(sql`UPDATE onboarding_templates SET ativo = false WHERE id = ${id}`);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting onboarding template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // ============ Onboarding Etapas Endpoints ============
  app.get("/api/rh/onboarding/templates/:id/etapas", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      const result = await db.execute(sql`
        SELECT id, template_id as "templateId", ordem, titulo, descricao, 
               responsavel_padrao as "responsavelPadrao", prazo_dias as "prazoDias"
        FROM onboarding_etapas
        WHERE template_id = ${templateId}
        ORDER BY ordem
      `);
      res.json(result.rows);
    } catch (error: any) {
      if (error?.code === '42P01') {
        return res.json([]);
      }
      console.error("[api] Error fetching onboarding etapas:", error);
      res.status(500).json({ error: "Failed to fetch etapas" });
    }
  });

  app.post("/api/rh/onboarding/templates/:id/etapas", isAdmin, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      const validation = insertOnboardingEtapaSchema.safeParse({ ...req.body, templateId });
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { ordem, titulo, descricao, responsavelPadrao, prazoDias } = validation.data;
      const result = await db.execute(sql`
        INSERT INTO onboarding_etapas (template_id, ordem, titulo, descricao, responsavel_padrao, prazo_dias)
        VALUES (${templateId}, ${ordem}, ${titulo}, ${descricao || null}, ${responsavelPadrao || null}, ${prazoDias || null})
        RETURNING id, template_id as "templateId", ordem, titulo, descricao, 
                  responsavel_padrao as "responsavelPadrao", prazo_dias as "prazoDias"
      `);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating onboarding etapa:", error);
      res.status(500).json({ error: "Failed to create etapa" });
    }
  });

  app.delete("/api/rh/onboarding/etapas/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid etapa ID" });
      }
      await db.execute(sql`DELETE FROM onboarding_etapas WHERE id = ${id}`);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting onboarding etapa:", error);
      res.status(500).json({ error: "Failed to delete etapa" });
    }
  });

  // ============ Onboarding Iniciar (Start for Colaborador) ============
  app.post("/api/rh/onboarding/iniciar", async (req, res) => {
    try {
      const { colaboradorId, templateId, dataInicio } = req.body;
      if (!colaboradorId || !templateId || !dataInicio) {
        return res.status(400).json({ error: "colaboradorId, templateId, and dataInicio are required" });
      }
      
      const colabId = parseInt(String(colaboradorId));
      const templId = parseInt(String(templateId));
      
      if (isNaN(colabId) || isNaN(templId)) {
        return res.status(400).json({ error: "Invalid colaboradorId or templateId - must be numbers" });
      }
      
      const onboardingResult = await db.execute(sql`
        INSERT INTO onboarding_colaborador (colaborador_id, template_id, data_inicio, status)
        VALUES (${colabId}, ${templId}, ${dataInicio}, 'in_progress')
        RETURNING id, colaborador_id as "colaboradorId", template_id as "templateId", 
                  data_inicio as "dataInicio", status, created_at as "createdAt"
      `);
      const onboarding = onboardingResult.rows[0] as any;
      const etapasResult = await db.execute(sql`
        SELECT id, ordem, titulo, responsavel_padrao as "responsavelPadrao"
        FROM onboarding_etapas
        WHERE template_id = ${templId}
        ORDER BY ordem
      `);
      for (const etapa of etapasResult.rows as any[]) {
        await db.execute(sql`
          INSERT INTO onboarding_progresso (onboarding_colaborador_id, etapa_id, status)
          VALUES (${onboarding.id}, ${etapa.id}, 'pending')
        `);
      }
      res.status(201).json(onboarding);
    } catch (error) {
      console.error("[api] Error starting onboarding:", error);
      res.status(500).json({ error: "Failed to start onboarding" });
    }
  });

  // ============ Get Onboarding Status for Colaborador ============
  app.get("/api/rh/onboarding/:colaboradorId", async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.colaboradorId);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const onboardingResult = await db.execute(sql`
        SELECT oc.id, oc.colaborador_id as "colaboradorId", oc.template_id as "templateId",
               oc.data_inicio as "dataInicio", oc.status, oc.created_at as "createdAt",
               ot.nome as "templateNome",
               c.nome as "colaboradorNome"
        FROM onboarding_colaborador oc
        JOIN onboarding_templates ot ON oc.template_id = ot.id
        JOIN rh_pessoal c ON oc.colaborador_id = c.id
        WHERE oc.colaborador_id = ${colaboradorId}
        ORDER BY oc.created_at DESC
        LIMIT 1
      `);
      if (onboardingResult.rows.length === 0) {
        return res.json(null);
      }
      const onboarding = onboardingResult.rows[0] as any;
      const progressoResult = await db.execute(sql`
        SELECT op.id, op.etapa_id as "etapaId", op.status, 
               op.responsavel_id as "responsavelId", op.data_conclusao as "dataConclusao",
               op.observacoes, oe.titulo, oe.descricao, oe.ordem, oe.prazo_dias as "prazoDias",
               r.nome as "responsavelNome"
        FROM onboarding_progresso op
        JOIN onboarding_etapas oe ON op.etapa_id = oe.id
        LEFT JOIN rh_pessoal r ON op.responsavel_id = r.id
        WHERE op.onboarding_colaborador_id = ${onboarding.id}
        ORDER BY oe.ordem
      `);
      res.json({ ...onboarding, etapas: progressoResult.rows });
    } catch (error: any) {
      if (error?.code === '42P01') {
        return res.json(null);
      }
      console.error("[api] Error fetching onboarding status:", error);
      res.status(500).json({ error: "Failed to fetch onboarding status" });
    }
  });

  // ============ Get All Active Onboardings ============
  app.get("/api/rh/onboarding", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT oc.id, oc.colaborador_id as "colaboradorId", oc.template_id as "templateId",
               oc.data_inicio as "dataInicio", oc.status, oc.created_at as "createdAt",
               ot.nome as "templateNome",
               c.nome as "colaboradorNome", c.cargo, c.squad,
               (SELECT COUNT(*) FROM onboarding_progresso op WHERE op.onboarding_colaborador_id = oc.id) as "totalEtapas",
               (SELECT COUNT(*) FROM onboarding_progresso op WHERE op.onboarding_colaborador_id = oc.id AND op.status = 'completed') as "etapasConcluidas"
        FROM onboarding_colaborador oc
        JOIN onboarding_templates ot ON oc.template_id = ot.id
        JOIN rh_pessoal c ON oc.colaborador_id = c.id
        ORDER BY oc.created_at DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      if (error?.code === '42P01') {
        return res.json([]);
      }
      console.error("[api] Error fetching all onboardings:", error);
      res.status(500).json({ error: "Failed to fetch onboardings" });
    }
  });

  // ============ Update Onboarding Progress ============
  app.patch("/api/rh/onboarding/progresso/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid progresso ID" });
      }
      const { status, responsavelId, observacoes } = req.body;
      const dataConclusao = status === 'completed' ? new Date().toISOString() : null;
      const result = await db.execute(sql`
        UPDATE onboarding_progresso
        SET status = COALESCE(${status}, status),
            responsavel_id = COALESCE(${responsavelId || null}, responsavel_id),
            observacoes = COALESCE(${observacoes || null}, observacoes),
            data_conclusao = ${dataConclusao}
        WHERE id = ${id}
        RETURNING id, onboarding_colaborador_id as "onboardingColaboradorId", 
                  etapa_id as "etapaId", status, responsavel_id as "responsavelId",
                  data_conclusao as "dataConclusao", observacoes
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Progress record not found" });
      }
      const progresso = result.rows[0] as any;
      const checkResult = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM onboarding_progresso WHERE onboarding_colaborador_id = ${progresso.onboardingColaboradorId}) as total,
          (SELECT COUNT(*) FROM onboarding_progresso WHERE onboarding_colaborador_id = ${progresso.onboardingColaboradorId} AND status = 'completed') as completed
      `);
      const counts = checkResult.rows[0] as any;
      if (counts.total === counts.completed) {
        await db.execute(sql`
          UPDATE onboarding_colaborador SET status = 'completed' WHERE id = ${progresso.onboardingColaboradorId}
        `);
      } else if (counts.completed > 0) {
        await db.execute(sql`
          UPDATE onboarding_colaborador SET status = 'in_progress' WHERE id = ${progresso.onboardingColaboradorId}
        `);
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating onboarding progress:", error);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });
}
