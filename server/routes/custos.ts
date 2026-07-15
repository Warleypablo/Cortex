import type { Express } from "express";
import { sql } from "drizzle-orm";
import { consolidarMes, evolucao } from "../services/custos/consolidacao";
import { upsertTaxaMes, mesAtualBR } from "../services/custos/cambio";
import { syncGcpBilling } from "../services/custos/gcpBillingSync";
import { syncAnthropicCost } from "../services/custos/anthropicCostSync";

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

export function registerCustosRoutes(app: Express, db: any) {
  // Consolidado de um mês
  app.get("/api/custos/consolidado", async (req, res) => {
    try {
      const mes = (req.query.mes as string) || mesAtualBR();
      res.json(await consolidarMes(db, mes));
    } catch (error) {
      console.error("[custos] consolidado:", error);
      res.status(500).json({ error: "Failed to build consolidado" });
    }
  });

  // Evolução mês a mês (default: últimos 6 meses até o mês atual)
  app.get("/api/custos/evolucao", async (req, res) => {
    try {
      const ate = (req.query.ate as string) || mesAtualBR();
      let de = req.query.de as string;
      if (!de) {
        const [y, m] = ate.split("-").map(Number);
        const d = new Date(Date.UTC(y, m - 1 - 5, 1));
        de = d.toISOString().slice(0, 7);
      }
      res.json(await evolucao(db, de, ate));
    } catch (error) {
      console.error("[custos] evolucao:", error);
      res.status(500).json({ error: "Failed to build evolucao" });
    }
  });

  // Câmbio: lista
  app.get("/api/custos/cambio", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT ano_mes, taxa_usd_brl, fonte, updated_at
        FROM cortex_core.custo_cambio_mensal ORDER BY ano_mes DESC
      `);
      res.json(r.rows.map((row: any) => ({
        anoMes: row.ano_mes, taxa: parseFloat(row.taxa_usd_brl), fonte: row.fonte, updatedAt: row.updated_at,
      })));
    } catch (error) {
      console.error("[custos] cambio list:", error);
      res.status(500).json({ error: "Failed to list cambio" });
    }
  });

  // Câmbio: override manual
  app.put("/api/custos/cambio/:anoMes", isAdmin, async (req, res) => {
    try {
      const { anoMes } = req.params;
      const taxa = parseFloat(req.body?.taxa);
      if (!taxa || Number.isNaN(taxa)) return res.status(400).json({ error: "taxa inválida" });
      await upsertTaxaMes(db, anoMes, taxa, "manual");
      res.json({ anoMes, taxa, fonte: "manual" });
    } catch (error) {
      console.error("[custos] cambio put:", error);
      res.status(500).json({ error: "Failed to set cambio" });
    }
  });

  // Pessoas do RH (para o multi-select de usuários das assinaturas)
  app.get("/api/custos/pessoas", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT id, nome FROM "Inhire".rh_pessoal
        WHERE LOWER(status) = 'ativo' ORDER BY nome
      `);
      res.json(r.rows.map((row: any) => ({ id: row.id, nome: row.nome })));
    } catch (error) {
      console.error("[custos] pessoas:", error);
      res.status(500).json({ error: "Failed to list pessoas" });
    }
  });

  // ---- Assinaturas ----
  app.get("/api/custos/assinaturas", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT a.*, COALESCE(
          json_agg(json_build_object('id', p.id, 'nome', p.nome)) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS usuarios
        FROM cortex_core.custo_assinaturas a
        LEFT JOIN cortex_core.custo_assinatura_usuarios au ON au.assinatura_id = a.id
        LEFT JOIN "Inhire".rh_pessoal p ON p.id = au.pessoa_id
        GROUP BY a.id
        ORDER BY a.status ASC, a.fornecedor ASC, a.plano ASC
      `);
      res.json(r.rows.map((row: any) => ({
        id: row.id,
        fornecedor: row.fornecedor,
        plano: row.plano,
        valor: parseFloat(row.valor) || 0,
        moeda: row.moeda,
        ciclo: row.ciclo,
        dataAssinatura: row.data_assinatura,
        dataCancelamento: row.data_cancelamento,
        status: row.status,
        responsavelPessoaId: row.responsavel_pessoa_id,
        projeto: row.projeto,
        observacoes: row.observacoes,
        usuarios: row.usuarios,
      })));
    } catch (error) {
      console.error("[custos] assinaturas list:", error);
      res.status(500).json({ error: "Failed to list assinaturas" });
    }
  });

  app.post("/api/custos/assinaturas", isAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.fornecedor || !b.plano || !b.dataAssinatura) {
        return res.status(400).json({ error: "fornecedor, plano e dataAssinatura são obrigatórios" });
      }
      const result = await db.execute(sql`
        INSERT INTO cortex_core.custo_assinaturas
          (fornecedor, plano, valor, moeda, ciclo, data_assinatura, data_cancelamento, status, responsavel_pessoa_id, projeto, observacoes)
        VALUES
          (${b.fornecedor}, ${b.plano}, ${b.valor || 0}, ${b.moeda || "USD"}, ${b.ciclo || "mensal"},
           ${b.dataAssinatura}, ${b.dataCancelamento || null}, ${b.status || "ativo"},
           ${b.responsavelPessoaId || null}, ${b.projeto || "Geral"}, ${b.observacoes || null})
        RETURNING id
      `);
      const id = (result.rows[0] as any).id;
      const usuarios: number[] = Array.isArray(b.usuarios) ? b.usuarios : [];
      for (const pid of usuarios) {
        await db.execute(sql`
          INSERT INTO cortex_core.custo_assinatura_usuarios (assinatura_id, pessoa_id)
          VALUES (${id}, ${pid}) ON CONFLICT DO NOTHING
        `);
      }
      res.status(201).json({ id });
    } catch (error) {
      console.error("[custos] assinatura create:", error);
      res.status(500).json({ error: "Failed to create assinatura" });
    }
  });

  app.put("/api/custos/assinaturas/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const b = req.body || {};
      const result = await db.execute(sql`
        UPDATE cortex_core.custo_assinaturas SET
          fornecedor = COALESCE(${b.fornecedor}, fornecedor),
          plano = COALESCE(${b.plano}, plano),
          valor = COALESCE(${b.valor}, valor),
          moeda = COALESCE(${b.moeda}, moeda),
          ciclo = COALESCE(${b.ciclo}, ciclo),
          data_assinatura = COALESCE(${b.dataAssinatura}, data_assinatura),
          data_cancelamento = ${b.dataCancelamento === undefined ? sql`data_cancelamento` : b.dataCancelamento},
          status = COALESCE(${b.status}, status),
          responsavel_pessoa_id = ${b.responsavelPessoaId === undefined ? sql`responsavel_pessoa_id` : b.responsavelPessoaId},
          projeto = COALESCE(${b.projeto}, projeto),
          observacoes = ${b.observacoes === undefined ? sql`observacoes` : b.observacoes},
          updated_at = NOW()
        WHERE id = ${id} RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Assinatura not found" });
      res.json({ id });
    } catch (error) {
      console.error("[custos] assinatura update:", error);
      res.status(500).json({ error: "Failed to update assinatura" });
    }
  });

  app.delete("/api/custos/assinaturas/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await db.execute(sql`
        DELETE FROM cortex_core.custo_assinaturas WHERE id = ${id} RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Assinatura not found" });
      res.status(204).send();
    } catch (error) {
      console.error("[custos] assinatura delete:", error);
      res.status(500).json({ error: "Failed to delete assinatura" });
    }
  });

  // Substitui a lista de usuários (pessoas do RH) de uma assinatura
  app.put("/api/custos/assinaturas/:id/usuarios", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const usuarios: number[] = Array.isArray(req.body?.usuarios) ? req.body.usuarios : [];
      await db.execute(sql`DELETE FROM cortex_core.custo_assinatura_usuarios WHERE assinatura_id = ${id}`);
      for (const pid of usuarios) {
        await db.execute(sql`
          INSERT INTO cortex_core.custo_assinatura_usuarios (assinatura_id, pessoa_id)
          VALUES (${id}, ${pid}) ON CONFLICT DO NOTHING
        `);
      }
      res.json({ id, usuarios });
    } catch (error) {
      console.error("[custos] assinatura usuarios:", error);
      res.status(500).json({ error: "Failed to set usuarios" });
    }
  });

  // ---- Itens manuais / ferramentas ----
  app.get("/api/custos/itens", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT * FROM cortex_core.custo_itens_manuais
        ORDER BY status ASC, projeto ASC, descricao ASC
      `);
      res.json(r.rows.map((row: any) => ({
        id: row.id,
        descricao: row.descricao,
        fornecedor: row.fornecedor,
        categoria: row.categoria,
        valor: parseFloat(row.valor) || 0,
        moeda: row.moeda,
        ciclo: row.ciclo,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim,
        status: row.status,
        projeto: row.projeto,
        responsavelPessoaId: row.responsavel_pessoa_id,
        observacoes: row.observacoes,
      })));
    } catch (error) {
      console.error("[custos] itens list:", error);
      res.status(500).json({ error: "Failed to list itens" });
    }
  });

  app.post("/api/custos/itens", isAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.descricao || !b.dataInicio) {
        return res.status(400).json({ error: "descricao e dataInicio são obrigatórios" });
      }
      const result = await db.execute(sql`
        INSERT INTO cortex_core.custo_itens_manuais
          (descricao, fornecedor, categoria, valor, moeda, ciclo, data_inicio, data_fim, status, projeto, responsavel_pessoa_id, observacoes)
        VALUES
          (${b.descricao}, ${b.fornecedor || null}, ${b.categoria || null}, ${b.valor || 0}, ${b.moeda || "USD"},
           ${b.ciclo || "mensal"}, ${b.dataInicio}, ${b.dataFim || null}, ${b.status || "ativo"},
           ${b.projeto || "Geral"}, ${b.responsavelPessoaId || null}, ${b.observacoes || null})
        RETURNING id
      `);
      res.status(201).json({ id: (result.rows[0] as any).id });
    } catch (error) {
      console.error("[custos] item create:", error);
      res.status(500).json({ error: "Failed to create item" });
    }
  });

  app.put("/api/custos/itens/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const b = req.body || {};
      const result = await db.execute(sql`
        UPDATE cortex_core.custo_itens_manuais SET
          descricao = COALESCE(${b.descricao}, descricao),
          fornecedor = ${b.fornecedor === undefined ? sql`fornecedor` : b.fornecedor},
          categoria = ${b.categoria === undefined ? sql`categoria` : b.categoria},
          valor = COALESCE(${b.valor}, valor),
          moeda = COALESCE(${b.moeda}, moeda),
          ciclo = COALESCE(${b.ciclo}, ciclo),
          data_inicio = COALESCE(${b.dataInicio}, data_inicio),
          data_fim = ${b.dataFim === undefined ? sql`data_fim` : b.dataFim},
          status = COALESCE(${b.status}, status),
          projeto = COALESCE(${b.projeto}, projeto),
          responsavel_pessoa_id = ${b.responsavelPessoaId === undefined ? sql`responsavel_pessoa_id` : b.responsavelPessoaId},
          observacoes = ${b.observacoes === undefined ? sql`observacoes` : b.observacoes},
          updated_at = NOW()
        WHERE id = ${id} RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
      res.json({ id });
    } catch (error) {
      console.error("[custos] item update:", error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  app.delete("/api/custos/itens/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await db.execute(sql`
        DELETE FROM cortex_core.custo_itens_manuais WHERE id = ${id} RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
      res.status(204).send();
    } catch (error) {
      console.error("[custos] item delete:", error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // ---- GCP ----
  app.get("/api/custos/gcp", async (req, res) => {
    try {
      const mes = (req.query.mes as string) || mesAtualBR();
      const r = await db.execute(sql`
        SELECT id, data, gcp_project_id, projeto_interno, servico, custo, moeda
        FROM cortex_core.custo_gcp_diario
        WHERE to_char(data, 'YYYY-MM') = ${mes}
        ORDER BY data DESC, custo DESC
      `);
      res.json(r.rows.map((row: any) => ({
        id: row.id,
        data: row.data,
        gcpProjectId: row.gcp_project_id,
        projetoInterno: row.projeto_interno,
        servico: row.servico,
        custo: parseFloat(row.custo) || 0,
        moeda: row.moeda,
      })));
    } catch (error) {
      console.error("[custos] gcp detail:", error);
      res.status(500).json({ error: "Failed to fetch gcp detail" });
    }
  });

  // Lançamento manual de custo GCP (enquanto o sync automático não está ligado)
  app.post("/api/custos/gcp", isAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const mes = (b.mes as string) || mesAtualBR();
      const data = b.data || `${mes}-01`;
      if (!b.servico || b.custo === undefined || b.custo === null) {
        return res.status(400).json({ error: "servico e custo são obrigatórios" });
      }
      const result = await db.execute(sql`
        INSERT INTO cortex_core.custo_gcp_diario (data, gcp_project_id, servico, custo, moeda, projeto_interno, synced_at)
        VALUES (${data}, ${b.gcpProjectId || "(manual)"}, ${b.servico}, ${b.custo || 0}, ${b.moeda || "USD"}, ${b.projetoInterno || "Geral"}, NOW())
        ON CONFLICT (data, gcp_project_id, servico) DO UPDATE SET
          custo = EXCLUDED.custo, moeda = EXCLUDED.moeda, projeto_interno = EXCLUDED.projeto_interno, synced_at = NOW()
        RETURNING id
      `);
      res.status(201).json({ id: (result.rows[0] as any).id });
    } catch (error) {
      console.error("[custos] gcp manual create:", error);
      res.status(500).json({ error: "Failed to create gcp entry" });
    }
  });

  app.delete("/api/custos/gcp/:id", isAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`DELETE FROM cortex_core.custo_gcp_diario WHERE id = ${parseInt(req.params.id)} RETURNING id`);
      if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.status(204).send();
    } catch (error) {
      console.error("[custos] gcp delete:", error);
      res.status(500).json({ error: "Failed to delete gcp entry" });
    }
  });

  app.post("/api/custos/gcp/sync", isAdmin, async (req, res) => {
    try {
      const dias = req.body?.dias ? parseInt(req.body.dias) : undefined;
      const out = await syncGcpBilling(db, dias);
      res.json({ ok: true, ...out });
    } catch (error: any) {
      console.error("[custos] gcp sync:", error);
      res.status(500).json({ error: error.message || "Failed to sync gcp" });
    }
  });

  app.get("/api/custos/gcp/mapa", async (_req, res) => {
    try {
      const r = await db.execute(sql`SELECT gcp_project_id, projeto_interno FROM cortex_core.custo_gcp_projeto_map ORDER BY gcp_project_id`);
      res.json(r.rows.map((row: any) => ({ gcpProjectId: row.gcp_project_id, projetoInterno: row.projeto_interno })));
    } catch (error) {
      console.error("[custos] gcp mapa list:", error);
      res.status(500).json({ error: "Failed to list mapa" });
    }
  });

  app.put("/api/custos/gcp/mapa/:projectId", isAdmin, async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const projetoInterno = req.body?.projetoInterno || "Geral";
      await db.execute(sql`
        INSERT INTO cortex_core.custo_gcp_projeto_map (gcp_project_id, projeto_interno)
        VALUES (${projectId}, ${projetoInterno})
        ON CONFLICT (gcp_project_id) DO UPDATE SET projeto_interno = EXCLUDED.projeto_interno
      `);
      // Reatribui as linhas já sincronizadas desse projeto
      await db.execute(sql`
        UPDATE cortex_core.custo_gcp_diario SET projeto_interno = ${projetoInterno} WHERE gcp_project_id = ${projectId}
      `);
      res.json({ gcpProjectId: projectId, projetoInterno });
    } catch (error) {
      console.error("[custos] gcp mapa put:", error);
      res.status(500).json({ error: "Failed to set mapa" });
    }
  });

  // ---- Anthropic API ----
  app.get("/api/custos/anthropic", async (req, res) => {
    try {
      const mes = (req.query.mes as string) || mesAtualBR();
      const r = await db.execute(sql`
        SELECT id, data, workspace, projeto_interno, custo_usd,
               COALESCE(tokens_input,0) AS tokens_input, COALESCE(tokens_output,0) AS tokens_output
        FROM cortex_core.custo_anthropic_diario
        WHERE to_char(data, 'YYYY-MM') = ${mes}
        ORDER BY data DESC, custo_usd DESC
      `);
      res.json(r.rows.map((row: any) => ({
        id: row.id,
        data: row.data,
        workspace: row.workspace,
        projetoInterno: row.projeto_interno,
        custoUsd: parseFloat(row.custo_usd) || 0,
        tokensInput: parseInt(row.tokens_input) || 0,
        tokensOutput: parseInt(row.tokens_output) || 0,
      })));
    } catch (error) {
      console.error("[custos] anthropic detail:", error);
      res.status(500).json({ error: "Failed to fetch anthropic detail" });
    }
  });

  // Lançamento manual de custo da API Anthropic (enquanto o sync automático não está ligado)
  app.post("/api/custos/anthropic", isAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const mes = (b.mes as string) || mesAtualBR();
      const data = b.data || `${mes}-01`;
      if (b.custoUsd === undefined || b.custoUsd === null) {
        return res.status(400).json({ error: "custoUsd é obrigatório" });
      }
      const result = await db.execute(sql`
        INSERT INTO cortex_core.custo_anthropic_diario (data, workspace, modelo, custo_usd, projeto_interno, synced_at)
        VALUES (${data}, ${b.workspace || "(manual)"}, '', ${b.custoUsd || 0}, ${b.projetoInterno || "Geral"}, NOW())
        ON CONFLICT (data, workspace, modelo) DO UPDATE SET
          custo_usd = EXCLUDED.custo_usd, projeto_interno = EXCLUDED.projeto_interno, synced_at = NOW()
        RETURNING id
      `);
      res.status(201).json({ id: (result.rows[0] as any).id });
    } catch (error) {
      console.error("[custos] anthropic manual create:", error);
      res.status(500).json({ error: "Failed to create anthropic entry" });
    }
  });

  app.delete("/api/custos/anthropic/:id", isAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`DELETE FROM cortex_core.custo_anthropic_diario WHERE id = ${parseInt(req.params.id)} RETURNING id`);
      if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.status(204).send();
    } catch (error) {
      console.error("[custos] anthropic delete:", error);
      res.status(500).json({ error: "Failed to delete anthropic entry" });
    }
  });

  app.post("/api/custos/anthropic/sync", isAdmin, async (req, res) => {
    try {
      const dias = req.body?.dias ? parseInt(req.body.dias) : undefined;
      const out = await syncAnthropicCost(db, dias);
      res.json({ ok: true, ...out });
    } catch (error: any) {
      console.error("[custos] anthropic sync:", error);
      res.status(500).json({ error: error.message || "Failed to sync anthropic" });
    }
  });
}
