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
}

export { initTurboZapTables };
