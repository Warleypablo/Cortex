import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import { isCreatorAuth, type CreatorSessionData } from "../auth/creatorAuth";
import { gerarContratoCreatorPDF } from "./creators";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".png", ".jpg", ".jpeg", ".xml"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use PDF, PNG, JPG ou XML."));
    }
  },
});

function getCreatorData(req: any): CreatorSessionData {
  return (req.session as any).creatorData;
}

export function registerPortalCreatorRoutes(app: Express) {
  // ── GET /api/portal/creator/me — Perfil do creator ──────────────────────
  app.get("/api/portal/creator/me", isCreatorAuth, async (req, res) => {
    try {
      const creator = getCreatorData(req);
      // Refresh from DB
      const result = await db.execute(sql`
        SELECT id, nome, email, cpf, cnpj, endereco, cidade, estado, cep, chave_pix, tipo_pix
        FROM cortex_core.creators
        WHERE id = ${creator.id} AND ativo = true
        LIMIT 1
      `);
      const row = (result.rows as any[])[0];
      if (!row) return res.status(404).json({ message: "Creator não encontrado" });
      res.json(row);
    } catch (error: any) {
      console.error("[portal-creator] Erro GET /me:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── PATCH /api/portal/creator/me — Editar dados do creator ──────────────
  app.patch("/api/portal/creator/me", isCreatorAuth, async (req, res) => {
    try {
      const creator = getCreatorData(req);
      const { chave_pix, tipo_pix, endereco, cidade, estado, cep } = req.body;

      await db.execute(sql`
        UPDATE cortex_core.creators SET
          chave_pix = COALESCE(${chave_pix ?? null}, chave_pix),
          tipo_pix = COALESCE(${tipo_pix ?? null}, tipo_pix),
          endereco = COALESCE(${endereco ?? null}, endereco),
          cidade = COALESCE(${cidade ?? null}, cidade),
          estado = COALESCE(${estado ?? null}, estado),
          cep = COALESCE(${cep ?? null}, cep),
          atualizado_em = NOW()
        WHERE id = ${creator.id}
      `);

      // Update session
      const updated = await db.execute(sql`
        SELECT id, nome, email, cpf, cnpj, endereco, cidade, estado, cep, chave_pix, tipo_pix
        FROM cortex_core.creators WHERE id = ${creator.id}
      `);
      const row = (updated.rows as any[])[0];
      (req.session as any).creatorData = row;

      res.json(row);
    } catch (error: any) {
      console.error("[portal-creator] Erro PATCH /me:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── GET /api/portal/creator/contratos — Contratos do creator ────────────
  app.get("/api/portal/creator/contratos", isCreatorAuth, async (req, res) => {
    try {
      const creator = getCreatorData(req);
      const result = await db.execute(sql`
        SELECT id, creator_id, cliente_nome, cargo, descricao_servicos,
               valor_remuneracao, duracao_meses, data_inicio, data_fim,
               qtd_videos, unidade_prazo, prazo_entrega_dias,
               status, etapa_pagamento, assinado_em, criado_em,
               nf_arquivo_path, nf_arquivo_nome, nf_numero, nf_valor, nf_data_emissao, nf_anexado_em
        FROM cortex_core.contratos_creators
        WHERE creator_id = ${creator.id} AND status IN ('assinado', 'enviado')
        ORDER BY criado_em DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[portal-creator] Erro GET /contratos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── GET /api/portal/creator/contratos/:id/pdf — Download PDF ────────────
  app.get("/api/portal/creator/contratos/:id/pdf", isCreatorAuth, async (req, res) => {
    try {
      const creator = getCreatorData(req);
      const contratoId = parseInt(req.params.id);
      if (isNaN(contratoId)) return res.status(400).json({ error: "ID inválido" });

      // Fetch contrato (only if belongs to this creator)
      const result = await db.execute(sql`
        SELECT c.*, cr.nome, cr.cpf, cr.cnpj, cr.email, cr.endereco, cr.cidade, cr.estado, cr.cep
        FROM cortex_core.contratos_creators c
        JOIN cortex_core.creators cr ON cr.id = c.creator_id
        WHERE c.id = ${contratoId} AND c.creator_id = ${creator.id}
        LIMIT 1
      `);
      const row = (result.rows as any[])[0];
      if (!row) return res.status(404).json({ error: "Contrato não encontrado" });

      const pdfBuffer = await gerarContratoCreatorPDF({
        creator: {
          nome: row.nome,
          cpf: row.cpf,
          cnpj: row.cnpj,
          email: row.email,
          endereco: row.endereco,
          cidade: row.cidade,
          estado: row.estado,
          cep: row.cep,
        },
        contrato: {
          cargo: row.cargo || "",
          descricao_servicos: row.descricao_servicos || "",
          valor_remuneracao: String(row.valor_remuneracao || "0"),
          duracao_meses: row.duracao_meses || 6,
          data_inicio: row.data_inicio || "",
          data_fim: row.data_fim || "",
          qtd_videos: row.qtd_videos,
          unidade_prazo: row.unidade_prazo,
          cliente_nome: row.cliente_nome,
          prazo_entrega_dias: row.prazo_entrega_dias,
        },
      });

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contrato-${contratoId}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      });
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("[portal-creator] Erro GET /contratos/:id/pdf:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── POST /api/portal/creator/contratos/:id/nf — Upload NF ──────────────
  app.post("/api/portal/creator/contratos/:id/nf", isCreatorAuth, upload.single("nf_file"), async (req, res) => {
    try {
      const creator = getCreatorData(req);
      const contratoId = parseInt(req.params.id);
      if (isNaN(contratoId)) return res.status(400).json({ error: "ID inválido" });

      // Verify contrato belongs to this creator
      const check = await db.execute(sql`
        SELECT id FROM cortex_core.contratos_creators
        WHERE id = ${contratoId} AND creator_id = ${creator.id}
        LIMIT 1
      `);
      if (!check.rows.length) return res.status(404).json({ error: "Contrato não encontrado" });

      const file = req.file;
      if (!file) return res.status(400).json({ error: "Arquivo NF é obrigatório" });

      const { nf_numero, nf_valor, nf_data_emissao } = req.body;

      // Upload to GCS
      const { objectStorageClient } = await import("../replit_integrations/object_storage");
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      const ext = path.extname(file.originalname).toLowerCase();
      const uuid = crypto.randomUUID();
      const gcsPath = `${privateDir}/nf-creators/${creator.id}/${uuid}${ext}`;

      // Parse path: /bucketName/objectName
      const parts = gcsPath.replace(/^\//, "").split("/");
      const bucketName = parts[0];
      const objectName = parts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);
      await gcsFile.save(file.buffer, {
        metadata: { contentType: file.mimetype },
      });

      // Update DB
      await db.execute(sql`
        UPDATE cortex_core.contratos_creators SET
          nf_arquivo_path = ${gcsPath},
          nf_arquivo_nome = ${file.originalname},
          nf_numero = ${nf_numero || null},
          nf_valor = ${nf_valor ? parseFloat(nf_valor) : null},
          nf_data_emissao = ${nf_data_emissao || null},
          nf_anexado_em = NOW(),
          atualizado_em = NOW()
        WHERE id = ${contratoId} AND creator_id = ${creator.id}
      `);

      res.json({ message: "NF anexada com sucesso", nome: file.originalname });
    } catch (error: any) {
      console.error("[portal-creator] Erro POST /contratos/:id/nf:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── GET /api/portal/creator/contratos/:id/nf — Download NF ──────────────
  app.get("/api/portal/creator/contratos/:id/nf", isCreatorAuth, async (req, res) => {
    try {
      const creator = getCreatorData(req);
      const contratoId = parseInt(req.params.id);
      if (isNaN(contratoId)) return res.status(400).json({ error: "ID inválido" });

      const result = await db.execute(sql`
        SELECT nf_arquivo_path, nf_arquivo_nome
        FROM cortex_core.contratos_creators
        WHERE id = ${contratoId} AND creator_id = ${creator.id}
        LIMIT 1
      `);
      const row = (result.rows as any[])[0];
      if (!row?.nf_arquivo_path) return res.status(404).json({ error: "NF não encontrada" });

      const { objectStorageClient } = await import("../replit_integrations/object_storage");
      const gcsPath = row.nf_arquivo_path as string;
      const parts = gcsPath.replace(/^\//, "").split("/");
      const bucketName = parts[0];
      const objectName = parts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);

      const [exists] = await gcsFile.exists();
      if (!exists) return res.status(404).json({ error: "Arquivo não encontrado no storage" });

      const [metadata] = await gcsFile.getMetadata();
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${row.nf_arquivo_nome || "nf.pdf"}"`,
      });
      gcsFile.createReadStream().pipe(res);
    } catch (error: any) {
      console.error("[portal-creator] Erro GET /contratos/:id/nf:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── POST /api/portal/creator/logout ─────────────────────────────────────
  app.post("/api/portal/creator/logout", (req, res) => {
    (req.session as any).creatorData = null;
    req.session.save(() => {
      res.json({ message: "Logout realizado" });
    });
  });
}
