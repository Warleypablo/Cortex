import type { Express } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import { triagemAnalises } from "../../shared/schema";
import { buscarTranscricao, analisarTranscricao, initTriagemTable } from "../services/triagem";

export function registerTriagemRoutes(app: Express, db: any) {
  initTriagemTable().catch((err) =>
    console.error("[triagem] Error initializing table:", err)
  );

  // GET /api/triagem — List all analyses with optional filters
  app.get("/api/triagem", async (req, res) => {
    try {
      const { status, score, squad } = req.query;

      let conditions: any[] = [];
      if (status && status !== "todos") conditions.push(eq(triagemAnalises.status, String(status)));
      if (score && score !== "todos") conditions.push(eq(triagemAnalises.score, String(score)));
      if (squad && squad !== "todos") conditions.push(eq(triagemAnalises.squad, String(squad)));

      const results = await db
        .select()
        .from(triagemAnalises)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(triagemAnalises.criadoEm));

      res.json(results);
    } catch (error) {
      console.error("[api] Error fetching triagem list:", error);
      res.status(500).json({ error: "Failed to fetch triagem list" });
    }
  });

  // GET /api/triagem/:id — Get single analysis detail
  app.get("/api/triagem/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [analysis] = await db
        .select()
        .from(triagemAnalises)
        .where(eq(triagemAnalises.id, parseInt(id)));

      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("[api] Error fetching triagem detail:", error);
      res.status(500).json({ error: "Failed to fetch triagem detail" });
    }
  });

  // POST /api/triagem/analisar — Create new analysis for a client
  app.post("/api/triagem/analisar", async (req, res) => {
    try {
      const { clienteNome, clienteId, squad, vendedor, produto, valorContrato, transcricaoManual } = req.body;

      if (!clienteNome) {
        return res.status(400).json({ error: "clienteNome is required" });
      }

      let transcricao = transcricaoManual || null;
      let transcricaoUrl = null;

      if (!transcricao) {
        const driveResult = await buscarTranscricao(clienteNome);
        if (driveResult) {
          transcricao = driveResult.texto;
          transcricaoUrl = driveResult.url;
        }
      }

      if (!transcricao) {
        return res.status(404).json({
          error: "Transcrição não encontrada no Drive. Forneça o texto manualmente via campo 'transcricaoManual'.",
        });
      }

      const analise = await analisarTranscricao(transcricao);

      const [created] = await db
        .insert(triagemAnalises)
        .values({
          clienteId: clienteId || null,
          clienteNome,
          squad: squad || null,
          vendedor: vendedor || null,
          produto: produto || null,
          valorContrato: valorContrato ? String(valorContrato) : null,
          transcricaoUrl,
          transcricaoTexto: transcricao,
          score: analise.score,
          scoreNumerico: analise.score_numerico,
          analiseJson: analise,
          status: "pendente",
        })
        .returning();

      res.json(created);
    } catch (error) {
      console.error("[api] Error creating triagem analysis:", error);
      res.status(500).json({ error: "Failed to create analysis" });
    }
  });

  // PUT /api/triagem/:id/decidir — Record decision on an analysis
  app.put("/api/triagem/:id/decidir", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, decisaoPor, observacoes } = req.body;

      if (!status || !["aprovado", "rejeitado", "escalado"].includes(status)) {
        return res.status(400).json({ error: "Status must be: aprovado, rejeitado, or escalado" });
      }

      const [updated] = await db
        .update(triagemAnalises)
        .set({
          status,
          decisaoPor: decisaoPor || null,
          decisaoObservacoes: observacoes || null,
          atualizadoEm: new Date(),
        })
        .where(eq(triagemAnalises.id, parseInt(id)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("[api] Error updating triagem decision:", error);
      res.status(500).json({ error: "Failed to update decision" });
    }
  });
}
