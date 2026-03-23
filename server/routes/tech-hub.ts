import type { Express } from "express";
import type { IStorage } from "../storage";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

let anthropicClient: any = null;
let openaiClient: OpenAI | null = null;

function getAIClient(): { type: 'anthropic' | 'openai'; client: any } | null {
  if (process.env.ANTHROPIC_API_KEY) {
    if (!anthropicClient) {
      try {
        const Anthropic = require("@anthropic-ai/sdk");
        anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      } catch { /* not available */ }
    }
    if (anthropicClient) return { type: 'anthropic', client: anthropicClient };
  }
  if (process.env.OPENAI_API_KEY) {
    if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { type: 'openai', client: openaiClient };
  }
  return null;
}

async function generateSummary(comments: string[], projectName: string): Promise<string> {
  const ai = getAIClient();
  if (!ai) return 'Nenhuma API de IA configurada (ANTHROPIC_API_KEY ou OPENAI_API_KEY).';

  const prompt = `Você é um gerente de projetos de tecnologia. Analise os comentários abaixo do projeto "${projectName}" e gere um resumo executivo em 2-3 frases sobre o status atual do projeto. Seja direto, objetivo e em português. Destaque bloqueios, riscos ou próximos passos se houver.\n\nComentários:\n${comments.join('\n')}`;

  if (ai.type === 'anthropic') {
    const response = await ai.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0]?.text || 'Não foi possível gerar o resumo.';
  }

  const response = await ai.client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0]?.message?.content || 'Não foi possível gerar o resumo.';
}

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

  app.get("/api/tech/projeto/:id/resumo-comentarios", async (req, res) => {
    try {
      const comments = await storage.getTechProjetoComentarios(req.params.id);
      if (!comments || comments.length === 0) {
        return res.json({ resumo: null, totalComentarios: 0, ultimoComentario: null, autores: [], alertas: [] });
      }

      // Sort by date desc (already sorted from query but ensure)
      const sorted = [...comments].sort((a: any, b: any) =>
        new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime()
      );

      // Unique authors
      const autores = Array.from(new Set(sorted.map((c: any) => c.autor).filter(Boolean))) as string[];

      // Extract alerts from tags
      const alertas: string[] = [];
      const alertSet = new Set<string>();
      for (const c of sorted.slice(0, 10)) {
        const tags = Array.isArray(c.tags_extraidas) ? c.tags_extraidas : [];
        for (const t of tags) {
          if (!alertSet.has(t)) { alertSet.add(t); alertas.push(t); }
        }
      }

      // Build summary from recent comments (last 5)
      const recentes = sorted.slice(0, 5);
      const linhas: string[] = [];
      for (const c of recentes) {
        const texto = (c.texto || '').trim();
        if (!texto) continue;
        // Truncate long comments to first sentence or 120 chars
        const firstSentence = texto.split(/[.\n]/).filter(Boolean)[0] || texto;
        const truncated = firstSentence.length > 120 ? firstSentence.slice(0, 117) + '...' : firstSentence;
        const data = c.data_criacao ? new Date(c.data_criacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
        linhas.push(`[${data}] ${c.autor}: ${truncated}`);
      }

      const ultimo = sorted[0];

      res.json({
        resumo: linhas.join('\n'),
        totalComentarios: comments.length,
        ultimoComentario: ultimo ? {
          autor: ultimo.autor,
          texto: (ultimo.texto || '').trim().slice(0, 200),
          data: ultimo.data_criacao,
        } : null,
        autores,
        alertas,
      });
    } catch (error) {
      console.error('Error building comment summary:', error);
      res.status(500).json({ error: 'Failed to build comment summary' });
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

  app.get("/api/tech/responsavel/:nome/kpis", async (req, res) => {
    try {
      const nome = decodeURIComponent(req.params.nome);

      // Get active projects for this PO
      const boardData = await storage.getTechBoard();
      const allProjects = boardData.filter((p: any) => p.responsavel === nome);

      // Get closed projects for this PO
      const closedProjects = await storage.getTechProjetosFechados(500);
      const poClosedProjects = closedProjects.filter((p: any) => p.responsavel === nome);

      // Calculate urgency for active projects
      const now = new Date();
      const projetosAtivosList = allProjects.map((p: any) => {
        const dueDate = p.data_vencimento ? new Date(p.data_vencimento) : null;
        let urgencia = "no_prazo";
        if (dueDate) {
          const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft < 0) urgencia = "atrasado";
          else if (daysLeft <= 3) urgencia = "em_risco";
        }
        return {
          taskId: p.clickup_task_id,
          taskName: p.task_name,
          statusProjeto: p.status_projeto,
          faseProjeto: p.fase_projeto || p.status_projeto,
          dataVencimento: p.data_vencimento,
          urgencia,
        };
      });

      const atrasados = projetosAtivosList.filter((p: any) => p.urgencia === "atrasado").length;
      const projetosAtivos = allProjects.length;
      const taxaNoPrazo = projetosAtivos > 0 ? Math.round(((projetosAtivos - atrasados) / projetosAtivos) * 100) : 100;

      // Load indicator
      let carga: "alta" | "media" | "ok" = "ok";
      if (projetosAtivos > 7) carga = "alta";
      else if (projetosAtivos >= 4) carga = "media";

      // Deploy time (reuse existing)
      const deployData = await storage.getTechTempoDeploy(12, nome);
      const tempoMedioDeploy = deployData.length > 0
        ? Math.round(deployData.reduce((sum: number, d: any) => sum + parseFloat(d.media_dias || 0), 0) / deployData.length)
        : 0;

      res.json({
        projetosAtivos,
        projetosConcluidos: poClosedProjects.length,
        tempoMedioDeploy,
        taxaNoPrazo,
        carga,
        projetosAtivosList,
      });
    } catch (error) {
      console.error('Error fetching responsavel KPIs:', error);
      res.status(500).json({ error: 'Failed to fetch responsavel KPIs' });
    }
  });

  app.get("/api/tech/tempo-deploy-por-tipo", async (req, res) => {
    try {
      const meses = parseInt(req.query.meses as string) || 12;
      const safeMeses = Math.max(1, Math.min(Math.floor(meses), 60));

      const result = await db.execute(sql.raw(`
        WITH deploy_times AS (
          SELECT
            p.clickup_task_id,
            p.tipo,
            p.data_entregue,
            MIN(CASE WHEN h.status_novo ILIKE '%design%' THEN h.data_transicao END) AS inicio_design
          FROM "Clickup".cup_projetos_tech_fechados p
          JOIN "Clickup".cup_status_history h ON h.clickup_task_id = p.clickup_task_id
          WHERE p.data_entregue IS NOT NULL
          AND p.data_entregue >= (CURRENT_DATE - INTERVAL '${safeMeses} months')
          GROUP BY p.clickup_task_id, p.tipo, p.data_entregue
        )
        SELECT
          COALESCE(tipo, 'Sem tipo') AS tipo,
          ROUND(AVG(EXTRACT(EPOCH FROM (data_entregue::timestamp - inicio_design)) / 86400)::numeric, 1) AS media_dias,
          COUNT(*) AS total_projetos
        FROM deploy_times
        WHERE inicio_design IS NOT NULL
        GROUP BY tipo
        ORDER BY media_dias DESC
      `));

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching tempo-deploy-por-tipo:', error);
      res.status(500).json({ error: 'Failed to fetch deploy time by type' });
    }
  });

  app.get("/api/tech/projeto/:id/resumo-ia", async (req, res) => {
    try {
      const taskId = req.params.id;
      const comments = await storage.getTechProjetoComentarios(taskId);

      if (!comments || comments.length === 0) {
        return res.json({ resumo: 'Nenhum comentário registrado para gerar resumo.' });
      }

      // Get project name from board
      const board = await storage.getTechBoard();
      const project = board.find((p: any) => p.clickup_task_id === taskId);
      const projectName = project?.task_name || 'Projeto';

      // Format comments for the AI
      const formatted = comments.slice(0, 20).map((c: any) => {
        const date = new Date(c.data).toLocaleDateString('pt-BR');
        return `[${date}] ${c.autor}: ${c.texto}`;
      });

      const resumo = await generateSummary(formatted, projectName);
      res.json({ resumo });
    } catch (error) {
      console.error('Error generating AI summary:', error);
      res.status(500).json({ error: 'Failed to generate summary' });
    }
  });
}
