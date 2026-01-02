import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../auth/middleware";
import { stagingEntidades, stagingContratos, stagingContratoServicos, insertEntidadeSchema, insertContratoDocSchema, insertContratoServicoSchema } from "@shared/schema";

export function registerContratosRoutes(app: Express) {
  // ============================================================================
  // ENTIDADES ROUTES
  // ============================================================================

  app.get("/api/contratos/entidades", isAuthenticated, async (req, res) => {
    try {
      const { tipo, search, ativo } = req.query;
      
      let query = sql`
        SELECT * FROM staging.entidades 
        WHERE 1=1
      `;
      
      if (tipo && tipo !== 'todos') {
        query = sql`${query} AND tipo_entidade = ${tipo}`;
      }
      
      if (ativo === 'true') {
        query = sql`${query} AND ativo = true`;
      } else if (ativo === 'false') {
        query = sql`${query} AND ativo = false`;
      }
      
      if (search) {
        query = sql`${query} AND (
          nome_razao_social ILIKE ${'%' + search + '%'} OR 
          cpf_cnpj ILIKE ${'%' + search + '%'} OR
          email_principal ILIKE ${'%' + search + '%'}
        )`;
      }
      
      query = sql`${query} ORDER BY nome_razao_social ASC`;
      
      const result = await db.execute(query);
      
      const entidades = result.rows.map((row: any) => ({
        id: row.id,
        tipoPessoa: row.tipo_pessoa,
        cpfCnpj: row.cpf_cnpj,
        nomeRazaoSocial: row.nome_razao_social,
        emailPrincipal: row.email_principal,
        emailCobranca: row.email_cobranca,
        telefonePrincipal: row.telefone_principal,
        telefoneCobranca: row.telefone_cobranca,
        cep: row.cep,
        numero: row.numero,
        logradouro: row.logradouro,
        bairro: row.bairro,
        complemento: row.complemento,
        cidade: row.cidade,
        estado: row.estado,
        tipoEntidade: row.tipo_entidade,
        observacoes: row.observacoes,
        ativo: row.ativo,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
      }));
      
      res.json({ entidades });
    } catch (error) {
      console.error("Error fetching entidades:", error);
      res.status(500).json({ error: "Failed to fetch entidades" });
    }
  });

  app.get("/api/contratos/entidades/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await db.execute(sql`
        SELECT * FROM staging.entidades WHERE id = ${parseInt(id)}
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Entidade não encontrada" });
      }
      
      const row = result.rows[0] as any;
      const entidade = {
        id: row.id,
        tipoPessoa: row.tipo_pessoa,
        cpfCnpj: row.cpf_cnpj,
        nomeRazaoSocial: row.nome_razao_social,
        emailPrincipal: row.email_principal,
        emailCobranca: row.email_cobranca,
        telefonePrincipal: row.telefone_principal,
        telefoneCobranca: row.telefone_cobranca,
        cep: row.cep,
        numero: row.numero,
        logradouro: row.logradouro,
        bairro: row.bairro,
        complemento: row.complemento,
        cidade: row.cidade,
        estado: row.estado,
        tipoEntidade: row.tipo_entidade,
        observacoes: row.observacoes,
        ativo: row.ativo,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
      };
      
      res.json(entidade);
    } catch (error) {
      console.error("Error fetching entidade:", error);
      res.status(500).json({ error: "Failed to fetch entidade" });
    }
  });

  app.post("/api/contratos/entidades", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertEntidadeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.errors });
      }
      
      const data = parsed.data;
      
      const result = await db.execute(sql`
        INSERT INTO staging.entidades (
          tipo_pessoa, cpf_cnpj, nome_razao_social, email_principal, email_cobranca,
          telefone_principal, telefone_cobranca, cep, numero, logradouro, bairro,
          complemento, cidade, estado, tipo_entidade, observacoes, ativo
        ) VALUES (
          ${data.tipoPessoa}, ${data.cpfCnpj}, ${data.nomeRazaoSocial}, ${data.emailPrincipal || null},
          ${data.emailCobranca || null}, ${data.telefonePrincipal || null}, ${data.telefoneCobranca || null},
          ${data.cep || null}, ${data.numero || null}, ${data.logradouro || null}, ${data.bairro || null},
          ${data.complemento || null}, ${data.cidade || null}, ${data.estado || null},
          ${data.tipoEntidade}, ${data.observacoes || null}, ${data.ativo ?? true}
        ) RETURNING id
      `);
      
      const newId = (result.rows[0] as any).id;
      res.status(201).json({ id: newId, message: "Entidade criada com sucesso" });
    } catch (error: any) {
      console.error("Error creating entidade:", error);
      if (error.code === '23505') {
        return res.status(400).json({ error: "CPF/CNPJ já cadastrado" });
      }
      res.status(500).json({ error: "Failed to create entidade" });
    }
  });

  app.put("/api/contratos/entidades/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      await db.execute(sql`
        UPDATE staging.entidades SET
          tipo_pessoa = ${data.tipoPessoa},
          cpf_cnpj = ${data.cpfCnpj},
          nome_razao_social = ${data.nomeRazaoSocial},
          email_principal = ${data.emailPrincipal || null},
          email_cobranca = ${data.emailCobranca || null},
          telefone_principal = ${data.telefonePrincipal || null},
          telefone_cobranca = ${data.telefoneCobranca || null},
          cep = ${data.cep || null},
          numero = ${data.numero || null},
          logradouro = ${data.logradouro || null},
          bairro = ${data.bairro || null},
          complemento = ${data.complemento || null},
          cidade = ${data.cidade || null},
          estado = ${data.estado || null},
          tipo_entidade = ${data.tipoEntidade},
          observacoes = ${data.observacoes || null},
          ativo = ${data.ativo ?? true},
          atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
      `);
      
      res.json({ message: "Entidade atualizada com sucesso" });
    } catch (error: any) {
      console.error("Error updating entidade:", error);
      if (error.code === '23505') {
        return res.status(400).json({ error: "CPF/CNPJ já cadastrado" });
      }
      res.status(500).json({ error: "Failed to update entidade" });
    }
  });

  app.delete("/api/contratos/entidades/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.execute(sql`
        UPDATE staging.entidades SET ativo = false, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
      `);
      
      res.json({ message: "Entidade desativada com sucesso" });
    } catch (error) {
      console.error("Error deleting entidade:", error);
      res.status(500).json({ error: "Failed to delete entidade" });
    }
  });

  // ============================================================================
  // CONTRATOS ROUTES
  // ============================================================================

  app.get("/api/contratos/contratos", isAuthenticated, async (req, res) => {
    try {
      const { status, search } = req.query;
      
      let query = sql`
        SELECT c.*, e.nome_razao_social as entidade_nome, e.cpf_cnpj as entidade_cpf_cnpj
        FROM staging.contratos c
        LEFT JOIN staging.entidades e ON c.entidade_id = e.id
        WHERE 1=1
      `;
      
      if (status && status !== 'todos') {
        query = sql`${query} AND c.status = ${status}`;
      }
      
      if (search) {
        query = sql`${query} AND (
          c.numero_contrato ILIKE ${'%' + search + '%'} OR 
          e.nome_razao_social ILIKE ${'%' + search + '%'} OR
          c.comercial_responsavel ILIKE ${'%' + search + '%'}
        )`;
      }
      
      query = sql`${query} ORDER BY c.criado_em DESC`;
      
      const result = await db.execute(query);
      
      const contratos = result.rows.map((row: any) => ({
        id: row.id,
        numeroContrato: row.numero_contrato,
        entidadeId: row.entidade_id,
        entidadeNome: row.entidade_nome,
        entidadeCpfCnpj: row.entidade_cpf_cnpj,
        comercialResponsavel: row.comercial_responsavel,
        comercialResponsavelEmail: row.comercial_responsavel_email,
        idCrmBitrix: row.id_crm_bitrix,
        status: row.status,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim,
        observacoes: row.observacoes,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
      }));
      
      res.json({ contratos });
    } catch (error) {
      console.error("Error fetching contratos:", error);
      res.status(500).json({ error: "Failed to fetch contratos" });
    }
  });

  app.get("/api/contratos/contratos/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      const contratoResult = await db.execute(sql`
        SELECT c.*, e.nome_razao_social as entidade_nome, e.cpf_cnpj as entidade_cpf_cnpj
        FROM staging.contratos c
        LEFT JOIN staging.entidades e ON c.entidade_id = e.id
        WHERE c.id = ${parseInt(id)}
      `);
      
      if (contratoResult.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }
      
      const row = contratoResult.rows[0] as any;
      
      const servicosResult = await db.execute(sql`
        SELECT * FROM staging.contrato_servicos WHERE contrato_id = ${parseInt(id)}
      `);
      
      const contrato = {
        id: row.id,
        numeroContrato: row.numero_contrato,
        entidadeId: row.entidade_id,
        entidadeNome: row.entidade_nome,
        entidadeCpfCnpj: row.entidade_cpf_cnpj,
        comercialResponsavel: row.comercial_responsavel,
        comercialResponsavelEmail: row.comercial_responsavel_email,
        idCrmBitrix: row.id_crm_bitrix,
        status: row.status,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim,
        observacoes: row.observacoes,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
        servicos: servicosResult.rows.map((s: any) => ({
          id: s.id,
          contratoId: s.contrato_id,
          servicoNome: s.servico_nome,
          plano: s.plano,
          valorOriginal: parseFloat(s.valor_original) || 0,
          valorNegociado: parseFloat(s.valor_negociado) || 0,
          descontoPercentual: parseFloat(s.desconto_percentual) || 0,
          valorFinal: parseFloat(s.valor_final) || 0,
          economia: parseFloat(s.economia) || 0,
          modalidade: s.modalidade,
          criadoEm: s.criado_em,
        })),
      };
      
      res.json(contrato);
    } catch (error) {
      console.error("Error fetching contrato:", error);
      res.status(500).json({ error: "Failed to fetch contrato" });
    }
  });

  app.get("/api/contratos/proximo-numero", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT numero_contrato FROM staging.contratos 
        WHERE numero_contrato LIKE 'CT-%'
        ORDER BY numero_contrato DESC 
        LIMIT 1
      `);
      
      let proximoNumero = "CT-000001";
      if (result.rows.length > 0) {
        const ultimoNumero = (result.rows[0] as any).numero_contrato;
        const numero = parseInt(ultimoNumero.replace('CT-', '')) + 1;
        proximoNumero = `CT-${numero.toString().padStart(6, '0')}`;
      }
      
      res.json({ proximoNumero });
    } catch (error) {
      console.error("Error getting proximo numero:", error);
      res.status(500).json({ error: "Failed to get proximo numero" });
    }
  });

  app.post("/api/contratos/contratos", isAuthenticated, async (req, res) => {
    try {
      const { contrato, servicos } = req.body;
      
      const contratoResult = await db.execute(sql`
        INSERT INTO staging.contratos (
          numero_contrato, entidade_id, comercial_responsavel, comercial_responsavel_email,
          id_crm_bitrix, status, data_inicio, data_fim, observacoes
        ) VALUES (
          ${contrato.numeroContrato}, ${contrato.entidadeId}, ${contrato.comercialResponsavel || null},
          ${contrato.comercialResponsavelEmail || null}, ${contrato.idCrmBitrix || null},
          ${contrato.status || 'rascunho'}, ${contrato.dataInicio || null}, ${contrato.dataFim || null},
          ${contrato.observacoes || null}
        ) RETURNING id
      `);
      
      const contratoId = (contratoResult.rows[0] as any).id;
      
      if (servicos && servicos.length > 0) {
        for (const servico of servicos) {
          await db.execute(sql`
            INSERT INTO staging.contrato_servicos (
              contrato_id, servico_nome, plano, valor_original, valor_negociado,
              desconto_percentual, valor_final, economia, modalidade
            ) VALUES (
              ${contratoId}, ${servico.servicoNome}, ${servico.plano || null},
              ${servico.valorOriginal || 0}, ${servico.valorNegociado || 0},
              ${servico.descontoPercentual || 0}, ${servico.valorFinal || 0},
              ${servico.economia || 0}, ${servico.modalidade || null}
            )
          `);
        }
      }
      
      res.status(201).json({ id: contratoId, message: "Contrato criado com sucesso" });
    } catch (error: any) {
      console.error("Error creating contrato:", error);
      if (error.code === '23505') {
        return res.status(400).json({ error: "Número de contrato já existe" });
      }
      res.status(500).json({ error: "Failed to create contrato" });
    }
  });

  app.put("/api/contratos/contratos/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { contrato, servicos } = req.body;
      
      await db.execute(sql`
        UPDATE staging.contratos SET
          numero_contrato = ${contrato.numeroContrato},
          entidade_id = ${contrato.entidadeId},
          comercial_responsavel = ${contrato.comercialResponsavel || null},
          comercial_responsavel_email = ${contrato.comercialResponsavelEmail || null},
          id_crm_bitrix = ${contrato.idCrmBitrix || null},
          status = ${contrato.status || 'rascunho'},
          data_inicio = ${contrato.dataInicio || null},
          data_fim = ${contrato.dataFim || null},
          observacoes = ${contrato.observacoes || null},
          atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
      `);
      
      await db.execute(sql`DELETE FROM staging.contrato_servicos WHERE contrato_id = ${parseInt(id)}`);
      
      if (servicos && servicos.length > 0) {
        for (const servico of servicos) {
          await db.execute(sql`
            INSERT INTO staging.contrato_servicos (
              contrato_id, servico_nome, plano, valor_original, valor_negociado,
              desconto_percentual, valor_final, economia, modalidade
            ) VALUES (
              ${parseInt(id)}, ${servico.servicoNome}, ${servico.plano || null},
              ${servico.valorOriginal || 0}, ${servico.valorNegociado || 0},
              ${servico.descontoPercentual || 0}, ${servico.valorFinal || 0},
              ${servico.economia || 0}, ${servico.modalidade || null}
            )
          `);
        }
      }
      
      res.json({ message: "Contrato atualizado com sucesso" });
    } catch (error: any) {
      console.error("Error updating contrato:", error);
      if (error.code === '23505') {
        return res.status(400).json({ error: "Número de contrato já existe" });
      }
      res.status(500).json({ error: "Failed to update contrato" });
    }
  });

  app.delete("/api/contratos/contratos/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.execute(sql`DELETE FROM staging.contrato_servicos WHERE contrato_id = ${parseInt(id)}`);
      await db.execute(sql`DELETE FROM staging.contratos WHERE id = ${parseInt(id)}`);
      
      res.json({ message: "Contrato excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting contrato:", error);
      res.status(500).json({ error: "Failed to delete contrato" });
    }
  });

  // ============================================================================
  // DASHBOARD STATS
  // ============================================================================

  app.get("/api/contratos/dashboard", isAuthenticated, async (req, res) => {
    try {
      const entidadesResult = await db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE ativo = true) as total_ativas,
          COUNT(*) FILTER (WHERE tipo_entidade = 'cliente') as clientes,
          COUNT(*) FILTER (WHERE tipo_entidade = 'fornecedor') as fornecedores,
          COUNT(*) FILTER (WHERE tipo_entidade = 'ambos') as ambos
        FROM staging.entidades
      `);
      
      const contratosResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'rascunho') as rascunhos,
          COUNT(*) FILTER (WHERE status = 'ativo') as ativos,
          COUNT(*) FILTER (WHERE status = 'pausado') as pausados,
          COUNT(*) FILTER (WHERE status = 'cancelado') as cancelados,
          COUNT(*) FILTER (WHERE status = 'encerrado') as encerrados
        FROM staging.contratos
      `);
      
      const valorResult = await db.execute(sql`
        SELECT COALESCE(SUM(cs.valor_final), 0) as valor_total
        FROM staging.contrato_servicos cs
        JOIN staging.contratos c ON cs.contrato_id = c.id
        WHERE c.status = 'ativo'
      `);
      
      const entidadeStats = entidadesResult.rows[0] as any;
      const contratoStats = contratosResult.rows[0] as any;
      const valorTotal = parseFloat((valorResult.rows[0] as any).valor_total) || 0;
      
      res.json({
        entidades: {
          totalAtivas: parseInt(entidadeStats.total_ativas) || 0,
          clientes: parseInt(entidadeStats.clientes) || 0,
          fornecedores: parseInt(entidadeStats.fornecedores) || 0,
          ambos: parseInt(entidadeStats.ambos) || 0,
        },
        contratos: {
          total: parseInt(contratoStats.total) || 0,
          rascunhos: parseInt(contratoStats.rascunhos) || 0,
          ativos: parseInt(contratoStats.ativos) || 0,
          pausados: parseInt(contratoStats.pausados) || 0,
          cancelados: parseInt(contratoStats.cancelados) || 0,
          encerrados: parseInt(contratoStats.encerrados) || 0,
        },
        valorTotalAtivos: valorTotal,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });
}
