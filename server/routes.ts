import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertColaboradorSchema, insertPatrimonioSchema } from "@shared/schema";

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

  app.get("/api/cliente/:id", async (req, res) => {
    try {
      const cliente = await storage.getClienteById(req.params.id);
      if (!cliente) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(cliente);
    } catch (error) {
      console.error("[api] Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.get("/api/cliente/:clienteId/receitas", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const receitas = await storage.getContasReceberByCliente(req.params.clienteId, limit);
      res.json(receitas);
    } catch (error) {
      console.error("[api] Error fetching receivables:", error);
      res.status(500).json({ error: "Failed to fetch receivables" });
    }
  });

  app.get("/api/cliente/:clienteId/revenue", async (req, res) => {
    try {
      const revenue = await storage.getClienteRevenue(req.params.clienteId);
      res.json(revenue);
    } catch (error) {
      console.error("[api] Error fetching revenue:", error);
      res.status(500).json({ error: "Failed to fetch revenue" });
    }
  });

  app.get("/api/cliente/:clienteId/contratos", async (req, res) => {
    try {
      const contratos = await storage.getContratosPorCliente(req.params.clienteId);
      res.json(contratos);
    } catch (error) {
      console.error("[api] Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
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

  app.get("/api/colaboradores", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores();
      res.json(colaboradores);
    } catch (error) {
      console.error("[api] Error fetching colaboradores:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
    }
  });

  app.post("/api/colaboradores", async (req, res) => {
    try {
      const validation = insertColaboradorSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const novoColaborador = await storage.createColaborador(validation.data);
      res.status(201).json(novoColaborador);
    } catch (error) {
      console.error("[api] Error creating colaborador:", error);
      res.status(500).json({ error: "Failed to create colaborador" });
    }
  });

  app.patch("/api/colaboradores/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      const validation = insertColaboradorSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const colaboradorAtualizado = await storage.updateColaborador(id, validation.data);
      res.json(colaboradorAtualizado);
    } catch (error) {
      console.error("[api] Error updating colaborador:", error);
      res.status(500).json({ error: "Failed to update colaborador" });
    }
  });

  app.delete("/api/colaboradores/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      await storage.deleteColaborador(id);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting colaborador:", error);
      res.status(500).json({ error: "Failed to delete colaborador" });
    }
  });

  app.get("/api/colaboradores/analise", async (req, res) => {
    try {
      const analiseData = await storage.getColaboradoresAnalise();
      res.json(analiseData);
    } catch (error) {
      console.error("[api] Error fetching colaboradores analise:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores analise" });
    }
  });

  app.get("/api/contratos", async (req, res) => {
    try {
      const contratos = await storage.getContratos();
      res.json(contratos);
    } catch (error) {
      console.error("[api] Error fetching contratos:", error);
      res.status(500).json({ error: "Failed to fetch contratos" });
    }
  });

  app.get("/api/patrimonio", async (req, res) => {
    try {
      const patrimonios = await storage.getPatrimonios();
      res.json(patrimonios);
    } catch (error) {
      console.error("[api] Error fetching patrimonio:", error);
      res.status(500).json({ error: "Failed to fetch patrimonio" });
    }
  });

  app.post("/api/patrimonio", async (req, res) => {
    try {
      const validation = insertPatrimonioSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const novoPatrimonio = await storage.createPatrimonio(validation.data);
      res.status(201).json(novoPatrimonio);
    } catch (error) {
      console.error("[api] Error creating patrimonio:", error);
      res.status(500).json({ error: "Failed to create patrimonio" });
    }
  });

  app.get("/api/dashboard/saldo-atual", async (req, res) => {
    try {
      const saldo = await storage.getSaldoAtualBancos();
      res.json(saldo);
    } catch (error) {
      console.error("[api] Error fetching saldo atual:", error);
      res.status(500).json({ error: "Failed to fetch saldo atual" });
    }
  });

  app.get("/api/dashboard/fluxo-caixa", async (req, res) => {
    try {
      const fluxoCaixa = await storage.getFluxoCaixa();
      res.json(fluxoCaixa);
    } catch (error) {
      console.error("[api] Error fetching fluxo de caixa:", error);
      res.status(500).json({ error: "Failed to fetch fluxo de caixa" });
    }
  });

  app.get("/api/dashboard/fluxo-caixa-diario", async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string);
      const mes = parseInt(req.query.mes as string);
      
      if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ error: "Invalid ano or mes parameter" });
      }

      const fluxoCaixaDiario = await storage.getFluxoCaixaDiario(ano, mes);
      res.json(fluxoCaixaDiario);
    } catch (error) {
      console.error("[api] Error fetching fluxo de caixa diario:", error);
      res.status(500).json({ error: "Failed to fetch fluxo de caixa diario" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
