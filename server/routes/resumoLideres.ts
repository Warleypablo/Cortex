import type { Express } from "express";
import {
  calcularMetricasResumo,
  formatarMensagemResumo,
  agoraSaoPaulo,
  enviarResumoLideres,
} from "../services/resumoLideres";

export function registerResumoLideresRoutes(app: Express) {
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
