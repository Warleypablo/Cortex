import type { Express } from "express";
import type { IStorage } from "../storage";

export function registerTechHubRoutes(app: Express, db: any, storage: IStorage) {

  app.get("/api/tech/board", async (req, res) => {
    try {
      const { status, tipo, prioridade } = req.query;
      const data = await storage.getTechBoard(
        status as string, tipo as string, prioridade as string
      );

      // Group by responsavel
      const grouped: Record<string, any[]> = {};
      for (const row of data) {
        const resp = row.responsavel || 'Sem responsável';
        if (!grouped[resp]) grouped[resp] = [];
        grouped[resp].push(row);
      }

      res.json(Object.entries(grouped).map(([responsavel, projetos]) => ({
        responsavel,
        projetos,
        total: projetos.length,
      })));
    } catch (error) {
      console.error('Error fetching board:', error);
      res.status(500).json({ error: 'Failed to fetch board data' });
    }
  });

  app.get("/api/tech/projeto/:id/historico", async (req, res) => {
    try {
      const { tipo } = req.query;
      const data = await storage.getTechProjetoHistorico(req.params.id, tipo as string);
      res.json(data);
    } catch (error) {
      console.error('Error fetching historico:', error);
      res.status(500).json({ error: 'Failed to fetch project history' });
    }
  });

  app.get("/api/tech/projeto/:id/comentarios", async (req, res) => {
    try {
      const data = await storage.getTechProjetoComentarios(req.params.id);
      res.json(data);
    } catch (error) {
      console.error('Error fetching comentarios:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  app.get("/api/tech/prazo-por-status", async (req, res) => {
    try {
      const { responsavel } = req.query;
      const data = await storage.getTechPrazoPorStatus(responsavel as string);
      res.json(data);
    } catch (error) {
      console.error('Error fetching prazo-por-status:', error);
      res.status(500).json({ error: 'Failed to fetch status timing' });
    }
  });

  app.get("/api/tech/entregas-trimestre", async (req, res) => {
    try {
      const meses = parseInt(req.query.meses as string) || 12;
      const data = await storage.getTechEntregasTrimestre(meses);
      res.json(data);
    } catch (error) {
      console.error('Error fetching entregas-trimestre:', error);
      res.status(500).json({ error: 'Failed to fetch quarterly deliveries' });
    }
  });

  app.get("/api/tech/tempo-deploy", async (req, res) => {
    try {
      const meses = parseInt(req.query.meses as string) || 12;
      const { responsavel } = req.query;
      const data = await storage.getTechTempoDeploy(meses, responsavel as string);
      res.json(data);
    } catch (error) {
      console.error('Error fetching tempo-deploy:', error);
      res.status(500).json({ error: 'Failed to fetch deploy time' });
    }
  });
}
