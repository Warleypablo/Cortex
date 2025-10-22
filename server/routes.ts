import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/clientes", async (req, res) => {
    try {
      const clientes = await storage.getClientes();
      res.json(clientes);
    } catch (error) {
      console.error("[api] Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clientes/:cnpj", async (req, res) => {
    try {
      const cliente = await storage.getClienteByCnpj(req.params.cnpj);
      if (!cliente) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(cliente);
    } catch (error) {
      console.error("[api] Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.get("/api/clientes/:clienteId/receitas", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const receitas = await storage.getContasReceberByCliente(req.params.clienteId, limit);
      res.json(receitas);
    } catch (error) {
      console.error("[api] Error fetching receivables:", error);
      res.status(500).json({ error: "Failed to fetch receivables" });
    }
  });

  app.get("/api/clientes/:clienteId/revenue", async (req, res) => {
    try {
      const revenue = await storage.getClienteRevenue(req.params.clienteId);
      res.json(revenue);
    } catch (error) {
      console.error("[api] Error fetching revenue:", error);
      res.status(500).json({ error: "Failed to fetch revenue" });
    }
  });

  app.get("/api/fornecedores/:fornecedorId/despesas", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const despesas = await storage.getContasPagarByFornecedor(req.params.fornecedorId, limit);
      res.json(despesas);
    } catch (error) {
      console.error("[api] Error fetching payables:", error);
      res.status(500).json({ error: "Failed to fetch payables" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
