import type { Express } from "express";
import {
  initTurboZapTables,
  previewCobrancas,
  executarCobrancas,
  previewPorData,
  executarEnvioMassa,
  getHistorico,
  getStats,
  getConfiguracoes,
  updateConfiguracao,
  getPipelineJuridico,
  updatePipelineJuridico,
  getTemplates,
  createTemplate,
  deleteTemplate,
  getNiveisDesativados,
  toggleNivel,
} from "../services/turbozap";

export function registerTurboZapRoutes(app: Express) {
  // GET /api/turbozap/stats - KPIs para dashboard
  app.get("/api/turbozap/stats", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const stats = await getStats();
      res.json(stats);
    } catch (error) {
      console.error("[turbozap] Error fetching stats:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  // GET /api/turbozap/preview - Clientes que receberiam mensagem hoje
  app.get("/api/turbozap/preview", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const preview = await previewCobrancas();
      res.json(preview);
    } catch (error) {
      console.error("[turbozap] Error fetching preview:", error);
      res.status(500).json({ message: "Erro ao buscar preview de cobranças" });
    }
  });

  // POST /api/turbozap/executar - Executa envio
  app.post("/api/turbozap/executar", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const user = req.user as any;
      const executadoPor = user?.email || user?.name || "sistema";

      const resultado = await executarCobrancas(executadoPor);
      res.json(resultado);
    } catch (error) {
      console.error("[turbozap] Error executing cobrancas:", error);
      res.status(500).json({ message: "Erro ao executar cobranças" });
    }
  });

  // GET /api/turbozap/preview-por-data - Preview de clientes por data de vencimento
  app.get("/api/turbozap/preview-por-data", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const data = req.query.data as string;
      if (!data) {
        return res.status(400).json({ message: "Parâmetro 'data' é obrigatório (YYYY-MM-DD)" });
      }

      const preview = await previewPorData(data);
      res.json(preview);
    } catch (error) {
      console.error("[turbozap] Error fetching preview por data:", error);
      res.status(500).json({ message: "Erro ao buscar preview por data" });
    }
  });

  // POST /api/turbozap/executar-massa - Executa envio em massa por data
  app.post("/api/turbozap/executar-massa", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const user = req.user as any;
      const executadoPor = user?.email || user?.name || "sistema";
      const { data, template } = req.body;

      if (!data || !template) {
        return res.status(400).json({ message: "Campos 'data' e 'template' são obrigatórios" });
      }

      const resultado = await executarEnvioMassa(data, template, executadoPor);
      res.json(resultado);
    } catch (error: any) {
      console.error("[turbozap] Error executing envio massa:", error);
      res.status(500).json({ message: error.message || "Erro ao executar envio em massa" });
    }
  });

  // GET /api/turbozap/historico - Histórico com filtros
  app.get("/api/turbozap/historico", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { data_inicio, data_fim, tipo_cobranca, status, busca } = req.query;

      const historico = await getHistorico({
        data_inicio: data_inicio as string | undefined,
        data_fim: data_fim as string | undefined,
        tipo_cobranca: tipo_cobranca as string | undefined,
        status: status as string | undefined,
        busca: busca as string | undefined,
      });
      res.json(historico);
    } catch (error) {
      console.error("[turbozap] Error fetching historico:", error);
      res.status(500).json({ message: "Erro ao buscar histórico" });
    }
  });

  // GET /api/turbozap/configuracoes - Configurações atuais
  app.get("/api/turbozap/configuracoes", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const configs = await getConfiguracoes();
      res.json(configs);
    } catch (error) {
      console.error("[turbozap] Error fetching configuracoes:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  // PUT /api/turbozap/configuracoes - Atualizar configuração
  app.put("/api/turbozap/configuracoes", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const user = req.user as any;
      const { chave, valor } = req.body;

      if (!chave || valor === undefined) {
        return res.status(400).json({ message: "Campos 'chave' e 'valor' são obrigatórios" });
      }

      const updated = await updateConfiguracao(
        chave,
        valor,
        user?.email || user?.name || "sistema",
      );
      res.json(updated);
    } catch (error: any) {
      console.error("[turbozap] Error updating configuracao:", error);
      res.status(500).json({ message: error.message || "Erro ao atualizar configuração" });
    }
  });

  // GET /api/turbozap/pipeline-juridico - Lista pipeline jurídico
  app.get("/api/turbozap/pipeline-juridico", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const pipeline = await getPipelineJuridico();
      res.json(pipeline);
    } catch (error) {
      console.error("[turbozap] Error fetching pipeline juridico:", error);
      res.status(500).json({ message: "Erro ao buscar pipeline jurídico" });
    }
  });

  // PUT /api/turbozap/pipeline-juridico/:id - Atualizar registro do pipeline
  app.put("/api/turbozap/pipeline-juridico/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const user = req.user as any;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      const { etapa, protesto_efetivado, negativacao_efetivada, observacoes } = req.body;

      const updated = await updatePipelineJuridico(
        id,
        { etapa, protesto_efetivado, negativacao_efetivada, observacoes },
        user?.email || user?.name || "sistema",
      );
      res.json(updated);
    } catch (error: any) {
      console.error("[turbozap] Error updating pipeline juridico:", error);
      res.status(500).json({ message: error.message || "Erro ao atualizar pipeline" });
    }
  });

  // GET /api/turbozap/templates - Lista biblioteca de templates
  app.get("/api/turbozap/templates", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });
      const templates = await getTemplates();
      res.json(templates);
    } catch (error) {
      console.error("[turbozap] Error fetching templates:", error);
      res.status(500).json({ message: "Erro ao buscar templates" });
    }
  });

  // POST /api/turbozap/templates - Cria template na biblioteca
  app.post("/api/turbozap/templates", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const { nome, conteudo, nivel } = req.body;
      if (!nome?.trim() || !conteudo?.trim()) {
        return res.status(400).json({ message: "Campos 'nome' e 'conteudo' são obrigatórios" });
      }
      if (nome.trim().length > 100) {
        return res.status(400).json({ message: "Nome do template deve ter no máximo 100 caracteres" });
      }
      const template = await createTemplate(
        nome.trim(),
        conteudo.trim(),
        user?.email || user?.name || "sistema",
        nivel ?? null,
      );
      res.status(201).json(template);
    } catch (error) {
      console.error("[turbozap] Error creating template:", error);
      res.status(500).json({ message: "Erro ao criar template" });
    }
  });

  // DELETE /api/turbozap/templates/:id - Remove template da biblioteca
  app.delete("/api/turbozap/templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      await deleteTemplate(id);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[turbozap] Error deleting template:", error);
      const status = error.message?.includes("não encontrado") ? 404 : 500;
      res.status(status).json({ message: error.message || "Erro ao deletar template" });
    }
  });

  // GET /api/turbozap/niveis - Lista níveis com estado ativo/desativado
  app.get("/api/turbozap/niveis", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const desativados = await getNiveisDesativados();
      const NIVEIS_LABELS: Record<string, string> = {
        "D-3": "D-3 (Lembrete)",
        "D+0": "D+0 (Vencimento)",
        "D+3": "D+3 (3 dias)",
        "D+7": "D+7 (Suspensão)",
        "D+10": "D+10 (Rescisão)",
        "D+14": "D+14 (Cancelamento)",
        "D+15": "D+15 (Encerramento)",
        "D+20": "D+20 (Cancelado)",
        "D+30": "D+30 (Formalização Jurídica)",
        "D+40": "D+40 (Comunicação Protesto)",
        "D+45": "D+45 (Protesto Efetivado)",
        "D+50": "D+50 (Aviso Negativação)",
        "D+55": "D+55 (Negativação Efetivada)",
      };
      const TODOS_TIPOS = ["D-3","D+0","D+3","D+7","D+10","D+14","D+15","D+20","D+30","D+40","D+45","D+50","D+55"];
      const niveis = TODOS_TIPOS.map((tipo) => ({
        tipo,
        label: NIVEIS_LABELS[tipo] ?? tipo,
        ativo: !desativados.includes(tipo),
      }));
      res.json(niveis);
    } catch (error) {
      console.error("[turbozap] Error fetching niveis:", error);
      res.status(500).json({ message: "Erro ao buscar níveis" });
    }
  });

  // PUT /api/turbozap/niveis/toggle - Ativa/desativa um nível
  app.put("/api/turbozap/niveis/toggle", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const user = req.user as any;
      const { tipo, ativo } = req.body;

      if (!tipo || typeof ativo !== "boolean") {
        return res.status(400).json({ message: "Campos 'tipo' (string) e 'ativo' (boolean) são obrigatórios" });
      }

      const updated = await toggleNivel(
        tipo,
        ativo,
        user?.email || user?.name || "sistema",
      );
      res.json({ niveis_desativados: updated });
    } catch (error: any) {
      console.error("[turbozap] Error toggling nivel:", error);
      res.status(500).json({ message: error.message || "Erro ao alterar nível" });
    }
  });
}

export { initTurboZapTables };
