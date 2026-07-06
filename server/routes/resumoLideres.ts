import type { Express } from "express";
import {
  calcularMetricasResumo,
  formatarMensagemResumo,
  agoraSaoPaulo,
  enviarResumoLideres,
  listarEnviosResumo,
} from "../services/resumoLideres";

export function registerResumoLideresRoutes(app: Express) {
  // GET /api/resumo-lideres/status - config do envio automático (para o badge da UI)
  app.get("/api/resumo-lideres/status", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });
      res.json({
        ativo: process.env.RESUMO_LIDERES_ATIVO === "true",
        destino: process.env.RESUMO_LIDERES_DESTINO ?? null,
        janelas: ["10h", "19h"],
        timezone: "America/Sao_Paulo",
      });
    } catch (error: any) {
      console.error("[resumo-lideres] Error status:", error);
      res.status(500).json({ message: error.message || "Erro ao ler status" });
    }
  });

  // GET /api/resumo-lideres/historico - últimos envios registrados
  app.get("/api/resumo-lideres/historico", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });
      const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 200);
      const envios = await listarEnviosResumo(limite);
      res.json({ envios });
    } catch (error: any) {
      console.error("[resumo-lideres] Error histórico:", error);
      res.status(500).json({ message: error.message || "Erro ao carregar histórico" });
    }
  });

  // GET /api/resumo-lideres/preview - mensagem formatada sem enviar
  app.get("/api/resumo-lideres/preview", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const metricas = await calcularMetricasResumo();
      const mensagem = formatarMensagemResumo(metricas, agoraSaoPaulo());
      res.json({ metricas, mensagem });
    } catch (error: any) {
      console.error("[resumo-lideres] Error preview:", error);
      res.status(500).json({ message: error.message || "Erro ao gerar preview" });
    }
  });

  // POST /api/resumo-lideres/enviar - dispara o envio agora ({ force: true } reenvia)
  app.post("/api/resumo-lideres/enviar", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const resultado = await enviarResumoLideres({ force: req.body?.force === true });
      if (!resultado.success) return res.status(500).json(resultado);
      res.json(resultado);
    } catch (error: any) {
      console.error("[resumo-lideres] Error enviar:", error);
      res.status(500).json({ message: error.message || "Erro ao enviar" });
    }
  });
}
