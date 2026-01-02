import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../auth/middleware";

let tablesInitialized = false;

async function ensureContratosTablesExist() {
  if (tablesInitialized) return;
  
  try {
    // Migrate entidades table structure if needed
    try {
      const result = await db.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'staging' AND table_name = 'entidades' AND column_name = 'eh_cliente'
      `);
      
      if (result.rows.length === 0) {
        // Need to migrate old structure to new structure
        console.log("[contratos] Migrating entidades table structure...");
        
        // Add new columns if they don't exist
        await db.execute(sql`
          ALTER TABLE staging.entidades 
          ADD COLUMN IF NOT EXISTS nome VARCHAR(255),
          ADD COLUMN IF NOT EXISTS nome_socio VARCHAR(255),
          ADD COLUMN IF NOT EXISTS cpf_socio VARCHAR(20),
          ADD COLUMN IF NOT EXISTS eh_cliente BOOLEAN DEFAULT true,
          ADD COLUMN IF NOT EXISTS eh_fornecedor BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS endereco VARCHAR(255),
          ADD COLUMN IF NOT EXISTS data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS telefone VARCHAR(50),
          ADD COLUMN IF NOT EXISTS email VARCHAR(255)
        `);
        
        // Migrate data from old columns to new columns
        await db.execute(sql`
          UPDATE staging.entidades 
          SET 
            nome = COALESCE(nome, nome_razao_social),
            eh_cliente = CASE WHEN tipo_entidade = 'cliente' OR tipo_entidade = 'ambos' THEN true ELSE false END,
            eh_fornecedor = CASE WHEN tipo_entidade = 'fornecedor' OR tipo_entidade = 'ambos' THEN true ELSE false END,
            endereco = COALESCE(endereco, logradouro),
            email = COALESCE(email, email_principal),
            telefone = COALESCE(telefone, telefone_principal)
          WHERE nome IS NULL OR eh_cliente IS NULL
        `);
        
        console.log("[contratos] Entidades table migration completed");
      }
    } catch (migrationError) {
      console.log("[contratos] Entidades migration skipped or table doesn't exist:", migrationError);
    }

    // Migrate contratos table structure - always add missing columns
    try {
      console.log("[contratos] Checking and adding missing columns to contratos table...");
      
      await db.execute(sql`
        ALTER TABLE staging.contratos 
        ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS id_crm VARCHAR(50),
        ADD COLUMN IF NOT EXISTS cliente_id INTEGER,
        ADD COLUMN IF NOT EXISTS fornecedor_id INTEGER,
        ADD COLUMN IF NOT EXISTS descricao TEXT,
        ADD COLUMN IF NOT EXISTS valor_total DECIMAL(12, 2),
        ADD COLUMN IF NOT EXISTS data_inicio_recorrentes DATE,
        ADD COLUMN IF NOT EXISTS data_inicio_cobranca_recorrentes DATE,
        ADD COLUMN IF NOT EXISTS data_inicio_pontuais DATE,
        ADD COLUMN IF NOT EXISTS data_inicio_cobranca_pontuais DATE,
        ADD COLUMN IF NOT EXISTS hash_documento VARCHAR(255),
        ADD COLUMN IF NOT EXISTS url_assinatura TEXT,
        ADD COLUMN IF NOT EXISTS documento_assinado BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS observacoes TEXT,
        ADD COLUMN IF NOT EXISTS usuario_criacao INTEGER,
        ADD COLUMN IF NOT EXISTS usuario_atualizacao INTEGER,
        ADD COLUMN IF NOT EXISTS valor_original DECIMAL(12, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS valor_negociado DECIMAL(12, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS economia DECIMAL(12, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS desconto_percentual DECIMAL(5, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS signature_provider VARCHAR(50),
        ADD COLUMN IF NOT EXISTS signature_external_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS assinafy_document_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS assinafy_status VARCHAR(50),
        ADD COLUMN IF NOT EXISTS assinafy_upload_url TEXT,
        ADD COLUMN IF NOT EXISTS assinafy_signing_url TEXT,
        ADD COLUMN IF NOT EXISTS assinafy_signed_document_url TEXT,
        ADD COLUMN IF NOT EXISTS assinafy_last_sync TIMESTAMP,
        ADD COLUMN IF NOT EXISTS signature_sent_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS signature_completed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS usuario_responsavel_id INTEGER,
        ADD COLUMN IF NOT EXISTS status_faturamento VARCHAR(50) DEFAULT 'pendente',
        ADD COLUMN IF NOT EXISTS data_ultima_fatura DATE,
        ADD COLUMN IF NOT EXISTS usuario_fatura INTEGER,
        ADD COLUMN IF NOT EXISTS comercial_nome VARCHAR(255),
        ADD COLUMN IF NOT EXISTS comercial_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS comercial_telefone VARCHAR(50),
        ADD COLUMN IF NOT EXISTS comercial_cargo VARCHAR(100),
        ADD COLUMN IF NOT EXISTS comercial_empresa VARCHAR(255),
        ADD COLUMN IF NOT EXISTS data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS met_cob_recorrente VARCHAR(50),
        ADD COLUMN IF NOT EXISTS met_cob_pontual VARCHAR(50)
      `);
      
      console.log("[contratos] Contratos table columns ensured");
    } catch (migrationError) {
      console.log("[contratos] Contratos migration skipped or table doesn't exist:", migrationError);
    }
    
    // Fix contratos_itens - change vigencia_desconto from DATE to TEXT if needed
    try {
      await db.execute(sql`
        ALTER TABLE staging.contratos_itens 
        ALTER COLUMN vigencia_desconto TYPE TEXT USING vigencia_desconto::text
      `);
      console.log("[contratos] contratos_itens.vigencia_desconto changed to TEXT");
    } catch (e) {
      // Column might already be TEXT or table doesn't exist
    }
    
    // Fix entidades - allow NULL on nome_razao_social if it exists
    try {
      await db.execute(sql`
        ALTER TABLE staging.entidades 
        ALTER COLUMN nome_razao_social DROP NOT NULL
      `);
      console.log("[contratos] entidades.nome_razao_social constraint removed");
    } catch (e) {
      // Column might not exist or already nullable
    }

    // Serviços - catálogo de serviços oferecidos
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.servicos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        ativo BOOLEAN DEFAULT true,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Planos de Serviços - variações e preços de cada serviço
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.planos_servicos (
        id SERIAL PRIMARY KEY,
        servico_id INTEGER REFERENCES staging.servicos(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        escopo TEXT,
        diretrizes TEXT,
        valor DECIMAL(12, 2) DEFAULT 0,
        periodicidade VARCHAR(50),
        ativo BOOLEAN DEFAULT true,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Entidades - clientes e fornecedores
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.entidades (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        tipo_pessoa VARCHAR(20) NOT NULL DEFAULT 'juridica',
        cpf_cnpj VARCHAR(20) UNIQUE,
        nome_socio VARCHAR(255),
        cpf_socio VARCHAR(20),
        email VARCHAR(255),
        telefone VARCHAR(50),
        email_cobranca VARCHAR(255),
        telefone_cobranca VARCHAR(50),
        endereco VARCHAR(255),
        numero VARCHAR(20),
        complemento VARCHAR(100),
        bairro VARCHAR(100),
        cidade VARCHAR(100),
        estado VARCHAR(2),
        cep VARCHAR(15),
        eh_cliente BOOLEAN DEFAULT true,
        eh_fornecedor BOOLEAN DEFAULT false,
        observacoes TEXT,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Configurações de faturamento por cliente
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.clientes_faturamento (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES staging.entidades(id) ON DELETE CASCADE,
        ciclo_faturamento VARCHAR(50),
        dia_vencimento INTEGER,
        dias_antecedencia_cobranca INTEGER DEFAULT 5,
        dias_lembrete_apos_vencimento INTEGER DEFAULT 3,
        email_cobranca VARCHAR(255),
        telefone_whatsapp VARCHAR(50),
        observacoes_fatura TEXT,
        ativo BOOLEAN DEFAULT true,
        modalidade_recorrente VARCHAR(50),
        modalidade_pontual VARCHAR(50),
        data_inicio_cobranca_recorrente DATE,
        data_inicio_cobranca_pontual DATE,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Contratos principais
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.contratos (
        id SERIAL PRIMARY KEY,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        numero_contrato VARCHAR(50) NOT NULL UNIQUE,
        id_crm VARCHAR(50),
        cliente_id INTEGER REFERENCES staging.entidades(id),
        fornecedor_id INTEGER REFERENCES staging.entidades(id),
        descricao TEXT,
        valor_total DECIMAL(12, 2),
        data_inicio_recorrentes DATE,
        data_inicio_cobranca_recorrentes DATE,
        data_inicio_pontuais DATE,
        data_inicio_cobranca_pontuais DATE,
        status VARCHAR(50) DEFAULT 'rascunho',
        hash_documento VARCHAR(255),
        url_assinatura TEXT,
        documento_assinado BOOLEAN DEFAULT false,
        observacoes TEXT,
        usuario_criacao INTEGER,
        usuario_atualizacao INTEGER,
        valor_original DECIMAL(12, 2) DEFAULT 0,
        valor_negociado DECIMAL(12, 2) DEFAULT 0,
        economia DECIMAL(12, 2) DEFAULT 0,
        desconto_percentual DECIMAL(5, 2) DEFAULT 0,
        signature_provider VARCHAR(50),
        signature_external_id VARCHAR(255),
        assinafy_document_id VARCHAR(255),
        assinafy_status VARCHAR(50),
        assinafy_upload_url TEXT,
        assinafy_signing_url TEXT,
        assinafy_signed_document_url TEXT,
        assinafy_last_sync TIMESTAMP,
        signature_sent_at TIMESTAMP,
        signature_completed_at TIMESTAMP,
        usuario_responsavel_id INTEGER,
        comercial_nome VARCHAR(255),
        comercial_email VARCHAR(255),
        comercial_telefone VARCHAR(50),
        comercial_cargo VARCHAR(100),
        comercial_empresa VARCHAR(255),
        status_faturamento VARCHAR(50) DEFAULT 'pendente',
        data_ultima_fatura DATE,
        usuario_fatura INTEGER,
        met_cob_recorrente VARCHAR(50),
        met_cob_pontual VARCHAR(50),
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Itens de contratos (serviços contratados)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.contratos_itens (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER REFERENCES staging.contratos(id) ON DELETE CASCADE,
        plano_servico_id INTEGER REFERENCES staging.planos_servicos(id),
        quantidade INTEGER DEFAULT 1,
        valor_unitario DECIMAL(12, 2) DEFAULT 0,
        valor_total DECIMAL(12, 2) DEFAULT 0,
        modalidade VARCHAR(50),
        valor_original DECIMAL(12, 2) DEFAULT 0,
        valor_negociado DECIMAL(12, 2) DEFAULT 0,
        desconto_percentual DECIMAL(5, 2) DEFAULT 0,
        tipo_desconto VARCHAR(20),
        valor_desconto DECIMAL(12, 2) DEFAULT 0,
        valor_final DECIMAL(12, 2) DEFAULT 0,
        economia DECIMAL(12, 2) DEFAULT 0,
        vigencia_desconto DATE,
        periodo_desconto VARCHAR(50),
        apos_periodo VARCHAR(50),
        forma_pagamento VARCHAR(50),
        num_parcelas INTEGER,
        valor_parcela DECIMAL(12, 2),
        observacoes TEXT
      )
    `);

    // Aditivos de contratos
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.aditivos (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER REFERENCES staging.contratos(id) ON DELETE CASCADE,
        numero_aditivo VARCHAR(20),
        tipo_aditivo VARCHAR(50),
        descricao TEXT,
        valor_anterior DECIMAL(12, 2),
        valor_novo DECIMAL(12, 2),
        data_inicio_vigencia DATE,
        status VARCHAR(30) DEFAULT 'rascunho',
        url_assinatura TEXT,
        documento_assinado BOOLEAN DEFAULT false,
        observacoes TEXT,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Serviços dos aditivos
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.aditivo_servicos (
        id SERIAL PRIMARY KEY,
        aditivo_id INTEGER REFERENCES staging.aditivos(id) ON DELETE CASCADE,
        plano_servico_id INTEGER REFERENCES staging.planos_servicos(id),
        tipo_operacao VARCHAR(50),
        quantidade INTEGER DEFAULT 1,
        valor_unitario DECIMAL(12, 2) DEFAULT 0,
        valor_total DECIMAL(12, 2) DEFAULT 0,
        observacoes TEXT
      )
    `);

    // Faturas
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.faturas (
        id SERIAL PRIMARY KEY,
        numero_fatura VARCHAR(50) NOT NULL,
        cliente_id INTEGER REFERENCES staging.entidades(id),
        contrato_id INTEGER REFERENCES staging.contratos(id),
        valor_total DECIMAL(12, 2) DEFAULT 0,
        valor_desconto DECIMAL(12, 2) DEFAULT 0,
        valor_liquido DECIMAL(12, 2) DEFAULT 0,
        data_emissao DATE,
        data_vencimento DATE,
        data_pagamento DATE,
        status VARCHAR(30) DEFAULT 'pendente',
        forma_pagamento VARCHAR(50),
        observacoes TEXT,
        conta_azul_id VARCHAR(100),
        conta_azul_status VARCHAR(50),
        conta_azul_sync_date TIMESTAMP,
        url_boleto TEXT,
        url_pix TEXT,
        usuario_criacao INTEGER,
        modalidade VARCHAR(50),
        status_geracao VARCHAR(50),
        proximo_vencimento DATE,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Itens de faturas
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.faturas_itens (
        id SERIAL PRIMARY KEY,
        fatura_id INTEGER REFERENCES staging.faturas(id) ON DELETE CASCADE,
        contrato_item_id INTEGER REFERENCES staging.contratos_itens(id),
        descricao TEXT,
        quantidade INTEGER DEFAULT 1,
        valor_unitario DECIMAL(12, 2) DEFAULT 0,
        valor_total DECIMAL(12, 2) DEFAULT 0,
        periodo_inicio DATE,
        periodo_fim DATE,
        modalidade_servico VARCHAR(50)
      )
    `);

    // Histórico de status de contratos
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.contract_status_history (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER REFERENCES staging.contratos(id) ON DELETE CASCADE,
        status_anterior VARCHAR(50),
        status_novo VARCHAR(50),
        user_id INTEGER,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(50),
        user_agent TEXT,
        observacoes TEXT
      )
    `);

    // Anexos de contratos
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.contract_attachments (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER REFERENCES staging.contratos(id) ON DELETE CASCADE,
        filename VARCHAR(255),
        file_path TEXT,
        file_size INTEGER,
        file_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // PDFs de contratos
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.pdfs_contratos (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER REFERENCES staging.contratos(id) ON DELETE CASCADE,
        filename VARCHAR(255),
        original_filename VARCHAR(255),
        file_path TEXT,
        file_size INTEGER,
        file_hash VARCHAR(255),
        download_url TEXT,
        is_signed BOOLEAN DEFAULT false,
        signature_metadata JSONB,
        download_count INTEGER DEFAULT 0,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Assinaturas de contratos
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.contract_signatures (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER REFERENCES staging.contratos(id) ON DELETE CASCADE,
        external_id VARCHAR(255),
        provider VARCHAR(50),
        signature_url TEXT,
        status VARCHAR(50),
        signer_name VARCHAR(255),
        signer_email VARCHAR(255),
        signer_role VARCHAR(100),
        signed_at TIMESTAMP,
        expires_at TIMESTAMP,
        error_message TEXT,
        webhook_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Configuração Assinafy
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.assinafy_config (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(255),
        api_key VARCHAR(255),
        api_url VARCHAR(255),
        webhook_url VARCHAR(255),
        webhook_secret VARCHAR(255),
        ativo BOOLEAN DEFAULT true,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Log de mudança de status de documentos
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.document_status_changes (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER REFERENCES staging.contratos(id) ON DELETE CASCADE,
        document_id VARCHAR(255),
        status_anterior VARCHAR(50),
        status_novo VARCHAR(50),
        webhook_data JSONB,
        data_mudanca TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Audit log
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.audit_log (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        modulo VARCHAR(100),
        acao VARCHAR(100),
        tabela_afetada VARCHAR(100),
        registro_id INTEGER,
        dados_anteriores JSONB,
        dados_novos JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT,
        data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    tablesInitialized = true;
    console.log("[contratos] All tables initialized successfully");
    
    // Import data from CSV file using batch import
    try {
      const { runImport } = await import('../scripts/importContratos');
      runImport().then(results => {
        if (results.length > 0) {
          console.log("[import] Batch import results:", results.map(r => `${r.table}: ${r.imported} imported`).join(', '));
        }
      }).catch(err => {
        console.log("[import] Batch import failed:", err.message);
      });
    } catch (importError: any) {
      console.log("[contratos] Import skipped or failed:", importError.message);
    }
  } catch (error) {
    console.error("[contratos] Error initializing tables:", error);
  }
}

export function registerContratosRoutes(app: Express) {
  ensureContratosTablesExist();
  
  // ============================================================================
  // ENTIDADES ROUTES
  // ============================================================================

  // Entidades - List all
  app.get("/api/contratos/entidades", isAuthenticated, async (req, res) => {
    try {
      const { tipo, search } = req.query;
      
      let query = sql`SELECT * FROM staging.entidades WHERE 1=1`;
      
      if (tipo === 'cliente') {
        query = sql`${query} AND eh_cliente = true`;
      } else if (tipo === 'fornecedor') {
        query = sql`${query} AND eh_fornecedor = true`;
      }
      
      if (search) {
        query = sql`${query} AND (
          nome ILIKE ${'%' + search + '%'} OR 
          cpf_cnpj ILIKE ${'%' + search + '%'} OR
          email ILIKE ${'%' + search + '%'}
        )`;
      }
      
      query = sql`${query} ORDER BY nome ASC`;
      const result = await db.execute(query);
      
      res.json({ entidades: result.rows });
    } catch (error) {
      console.error("Error fetching entidades:", error);
      res.status(500).json({ error: "Failed to fetch entidades" });
    }
  });

  // Entidades - Get by ID
  app.get("/api/contratos/entidades/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`
        SELECT * FROM staging.entidades WHERE id = ${parseInt(id)}
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Entidade não encontrada" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching entidade:", error);
      res.status(500).json({ error: "Failed to fetch entidade" });
    }
  });

  // Entidades - Create
  app.post("/api/contratos/entidades", isAuthenticated, async (req, res) => {
    try {
      const data = req.body;
      
      if (!data.nome) {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO staging.entidades (
          nome, tipo_pessoa, cpf_cnpj, nome_socio, cpf_socio, email, telefone,
          email_cobranca, telefone_cobranca, endereco, numero, complemento,
          bairro, cidade, estado, cep, eh_cliente, eh_fornecedor, observacoes
        ) VALUES (
          ${data.nome}, ${data.tipo_pessoa || 'juridica'}, ${data.cpf_cnpj || null},
          ${data.nome_socio || null}, ${data.cpf_socio || null}, ${data.email || null},
          ${data.telefone || null}, ${data.email_cobranca || null}, ${data.telefone_cobranca || null},
          ${data.endereco || null}, ${data.numero || null}, ${data.complemento || null},
          ${data.bairro || null}, ${data.cidade || null}, ${data.estado || null},
          ${data.cep || null}, ${data.eh_cliente ?? true}, ${data.eh_fornecedor ?? false},
          ${data.observacoes || null}
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

  // Entidades - Update
  app.put("/api/contratos/entidades/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      await db.execute(sql`
        UPDATE staging.entidades SET
          nome = ${data.nome},
          tipo_pessoa = ${data.tipo_pessoa || 'juridica'},
          cpf_cnpj = ${data.cpf_cnpj || null},
          nome_socio = ${data.nome_socio || null},
          cpf_socio = ${data.cpf_socio || null},
          email = ${data.email || null},
          telefone = ${data.telefone || null},
          email_cobranca = ${data.email_cobranca || null},
          telefone_cobranca = ${data.telefone_cobranca || null},
          endereco = ${data.endereco || null},
          numero = ${data.numero || null},
          complemento = ${data.complemento || null},
          bairro = ${data.bairro || null},
          cidade = ${data.cidade || null},
          estado = ${data.estado || null},
          cep = ${data.cep || null},
          eh_cliente = ${data.eh_cliente ?? true},
          eh_fornecedor = ${data.eh_fornecedor ?? false},
          observacoes = ${data.observacoes || null},
          data_atualizacao = CURRENT_TIMESTAMP
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

  // Entidades - Delete (soft delete)
  app.delete("/api/contratos/entidades/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.execute(sql`
        DELETE FROM staging.entidades WHERE id = ${parseInt(id)}
      `);
      
      res.json({ message: "Entidade removida com sucesso" });
    } catch (error) {
      console.error("Error deleting entidade:", error);
      res.status(500).json({ error: "Failed to delete entidade" });
    }
  });

  // ============================================================================
  // SERVIÇOS ROUTES
  // ============================================================================

  // Serviços - List all
  app.get("/api/contratos/servicos", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM staging.servicos WHERE ativo = true ORDER BY nome ASC
      `);
      res.json({ servicos: result.rows });
    } catch (error) {
      console.error("Error fetching servicos:", error);
      res.status(500).json({ error: "Failed to fetch servicos" });
    }
  });

  // Serviços - Create
  app.post("/api/contratos/servicos", isAuthenticated, async (req, res) => {
    try {
      const { nome, descricao } = req.body;
      const result = await db.execute(sql`
        INSERT INTO staging.servicos (nome, descricao) VALUES (${nome}, ${descricao || null})
        RETURNING id
      `);
      res.status(201).json({ id: (result.rows[0] as any).id });
    } catch (error) {
      console.error("Error creating servico:", error);
      res.status(500).json({ error: "Failed to create servico" });
    }
  });

  // Planos de Serviços - List by servico
  app.get("/api/contratos/planos-servicos", isAuthenticated, async (req, res) => {
    try {
      const { servico_id } = req.query;
      let query = sql`
        SELECT ps.*, s.nome as servico_nome
        FROM staging.planos_servicos ps
        LEFT JOIN staging.servicos s ON ps.servico_id = s.id
        WHERE ps.ativo = true
      `;
      if (servico_id) {
        query = sql`${query} AND ps.servico_id = ${parseInt(servico_id as string)}`;
      }
      query = sql`${query} ORDER BY s.nome, ps.nome`;
      const result = await db.execute(query);
      res.json({ planos: result.rows });
    } catch (error) {
      console.error("Error fetching planos:", error);
      res.status(500).json({ error: "Failed to fetch planos" });
    }
  });

  // Planos de Serviços - Create
  app.post("/api/contratos/planos-servicos", isAuthenticated, async (req, res) => {
    try {
      const data = req.body;
      const result = await db.execute(sql`
        INSERT INTO staging.planos_servicos (
          servico_id, nome, escopo, diretrizes, valor, periodicidade
        ) VALUES (
          ${data.servico_id}, ${data.nome}, ${data.escopo || null},
          ${data.diretrizes || null}, ${data.valor || 0}, ${data.periodicidade || null}
        ) RETURNING id
      `);
      res.status(201).json({ id: (result.rows[0] as any).id });
    } catch (error) {
      console.error("Error creating plano:", error);
      res.status(500).json({ error: "Failed to create plano" });
    }
  });

  // ============================================================================
  // CONTRATOS ROUTES
  // ============================================================================

  // Contratos - List all
  app.get("/api/contratos/contratos", isAuthenticated, async (req, res) => {
    try {
      const { status, search } = req.query;
      
      let query = sql`
        SELECT c.*, e.nome as cliente_nome, e.cpf_cnpj as cliente_cpf_cnpj
        FROM staging.contratos c
        LEFT JOIN staging.entidades e ON c.cliente_id = e.id
        WHERE 1=1
      `;
      
      if (status && status !== 'todos') {
        query = sql`${query} AND c.status = ${status}`;
      }
      
      if (search) {
        query = sql`${query} AND (
          c.numero_contrato ILIKE ${'%' + search + '%'} OR 
          e.nome ILIKE ${'%' + search + '%'} OR
          c.comercial_nome ILIKE ${'%' + search + '%'}
        )`;
      }
      
      query = sql`${query} ORDER BY c.data_criacao DESC`;
      const result = await db.execute(query);
      
      res.json({ contratos: result.rows });
    } catch (error) {
      console.error("Error fetching contratos:", error);
      res.status(500).json({ error: "Failed to fetch contratos" });
    }
  });

  // Contratos - Get by ID with items
  app.get("/api/contratos/contratos/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      const contratoResult = await db.execute(sql`
        SELECT c.*, e.nome as cliente_nome, e.cpf_cnpj as cliente_cpf_cnpj
        FROM staging.contratos c
        LEFT JOIN staging.entidades e ON c.cliente_id = e.id
        WHERE c.id = ${parseInt(id)}
      `);
      
      if (contratoResult.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }
      
      const itensResult = await db.execute(sql`
        SELECT ci.*, ps.nome as plano_nome, s.nome as servico_nome
        FROM staging.contratos_itens ci
        LEFT JOIN staging.planos_servicos ps ON ci.plano_servico_id = ps.id
        LEFT JOIN staging.servicos s ON ps.servico_id = s.id
        WHERE ci.contrato_id = ${parseInt(id)}
      `);
      
      res.json({
        contrato: contratoResult.rows[0],
        itens: itensResult.rows
      });
    } catch (error) {
      console.error("Error fetching contrato:", error);
      res.status(500).json({ error: "Failed to fetch contrato" });
    }
  });

  // Próximo número de contrato
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

  // Contratos - Create
  app.post("/api/contratos/contratos", isAuthenticated, async (req, res) => {
    try {
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO staging.contratos (
          numero_contrato, id_crm, cliente_id, fornecedor_id, descricao,
          data_inicio_recorrentes, data_inicio_cobranca_recorrentes,
          data_inicio_pontuais, data_inicio_cobranca_pontuais, status,
          observacoes, usuario_criacao, valor_original, valor_negociado,
          economia, desconto_percentual, comercial_nome, comercial_email,
          comercial_telefone, comercial_cargo, comercial_empresa
        ) VALUES (
          ${data.numero_contrato}, ${data.id_crm || null}, ${data.cliente_id || null},
          ${data.fornecedor_id || null}, ${data.descricao || null},
          ${data.data_inicio_recorrentes || null}, ${data.data_inicio_cobranca_recorrentes || null},
          ${data.data_inicio_pontuais || null}, ${data.data_inicio_cobranca_pontuais || null},
          ${data.status || 'rascunho'}, ${data.observacoes || null},
          ${data.usuario_criacao || null}, ${data.valor_original || 0},
          ${data.valor_negociado || 0}, ${data.economia || 0},
          ${data.desconto_percentual || 0}, ${data.comercial_nome || null},
          ${data.comercial_email || null}, ${data.comercial_telefone || null},
          ${data.comercial_cargo || null}, ${data.comercial_empresa || null}
        ) RETURNING id
      `);
      
      const contratoId = (result.rows[0] as any).id;
      
      // Insert itens if provided
      if (data.itens && data.itens.length > 0) {
        for (const item of data.itens) {
          await db.execute(sql`
            INSERT INTO staging.contratos_itens (
              contrato_id, plano_servico_id, quantidade, valor_unitario, valor_total,
              modalidade, valor_original, valor_negociado, desconto_percentual,
              tipo_desconto, valor_desconto, valor_final, economia, observacoes
            ) VALUES (
              ${contratoId}, ${item.plano_servico_id || null}, ${item.quantidade || 1},
              ${item.valor_unitario || 0}, ${item.valor_total || 0},
              ${item.modalidade || null}, ${item.valor_original || 0},
              ${item.valor_negociado || 0}, ${item.desconto_percentual || 0},
              ${item.tipo_desconto || null}, ${item.valor_desconto || 0},
              ${item.valor_final || 0}, ${item.economia || 0}, ${item.observacoes || null}
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

  // Contratos - Update
  app.put("/api/contratos/contratos/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      await db.execute(sql`
        UPDATE staging.contratos SET
          numero_contrato = ${data.numero_contrato},
          id_crm = ${data.id_crm || null},
          cliente_id = ${data.cliente_id || null},
          fornecedor_id = ${data.fornecedor_id || null},
          descricao = ${data.descricao || null},
          data_inicio_recorrentes = ${data.data_inicio_recorrentes || null},
          data_inicio_cobranca_recorrentes = ${data.data_inicio_cobranca_recorrentes || null},
          data_inicio_pontuais = ${data.data_inicio_pontuais || null},
          data_inicio_cobranca_pontuais = ${data.data_inicio_cobranca_pontuais || null},
          status = ${data.status || 'rascunho'},
          observacoes = ${data.observacoes || null},
          usuario_atualizacao = ${data.usuario_atualizacao || null},
          valor_original = ${data.valor_original || 0},
          valor_negociado = ${data.valor_negociado || 0},
          economia = ${data.economia || 0},
          desconto_percentual = ${data.desconto_percentual || 0},
          comercial_nome = ${data.comercial_nome || null},
          comercial_email = ${data.comercial_email || null},
          comercial_telefone = ${data.comercial_telefone || null},
          comercial_cargo = ${data.comercial_cargo || null},
          comercial_empresa = ${data.comercial_empresa || null},
          data_atualizacao = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
      `);
      
      // Update itens if provided
      if (data.itens) {
        await db.execute(sql`DELETE FROM staging.contratos_itens WHERE contrato_id = ${parseInt(id)}`);
        
        for (const item of data.itens) {
          await db.execute(sql`
            INSERT INTO staging.contratos_itens (
              contrato_id, plano_servico_id, quantidade, valor_unitario, valor_total,
              modalidade, valor_original, valor_negociado, desconto_percentual,
              tipo_desconto, valor_desconto, valor_final, economia, observacoes
            ) VALUES (
              ${parseInt(id)}, ${item.plano_servico_id || null}, ${item.quantidade || 1},
              ${item.valor_unitario || 0}, ${item.valor_total || 0},
              ${item.modalidade || null}, ${item.valor_original || 0},
              ${item.valor_negociado || 0}, ${item.desconto_percentual || 0},
              ${item.tipo_desconto || null}, ${item.valor_desconto || 0},
              ${item.valor_final || 0}, ${item.economia || 0}, ${item.observacoes || null}
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

  // Contratos - Delete
  app.delete("/api/contratos/contratos/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.execute(sql`DELETE FROM staging.contratos_itens WHERE contrato_id = ${parseInt(id)}`);
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
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE eh_cliente = true) as clientes,
          COUNT(*) FILTER (WHERE eh_fornecedor = true) as fornecedores,
          COUNT(*) FILTER (WHERE eh_cliente = true AND eh_fornecedor = true) as ambos
        FROM staging.entidades
      `);
      
      const contratosResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'rascunho') as rascunhos,
          COUNT(*) FILTER (WHERE status = 'assinado' OR status = 'ativo') as ativos,
          COUNT(*) FILTER (WHERE status = 'enviado_para_assinatura') as aguardando,
          COUNT(*) FILTER (WHERE status = 'cancelado') as cancelados,
          COUNT(*) FILTER (WHERE status = 'encerrado') as encerrados,
          COUNT(*) FILTER (WHERE status_faturamento = 'faturado') as faturados,
          COUNT(*) FILTER (WHERE status_faturamento = 'pendente') as pendentes_faturamento
        FROM staging.contratos
      `);
      
      const valorResult = await db.execute(sql`
        SELECT 
          COALESCE(SUM(ci.valor_final), 0) as valor_total,
          COALESCE(SUM(ci.economia), 0) as economia_total
        FROM staging.contratos_itens ci
        JOIN staging.contratos c ON ci.contrato_id = c.id
        WHERE c.status IN ('assinado', 'ativo')
      `);

      const servicosResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM staging.servicos WHERE ativo = true
      `);
      
      const entidadeStats = entidadesResult.rows[0] as any;
      const contratoStats = contratosResult.rows[0] as any;
      const valorStats = valorResult.rows[0] as any;
      const servicosStats = servicosResult.rows[0] as any;
      
      res.json({
        entidades: {
          total: parseInt(entidadeStats.total) || 0,
          clientes: parseInt(entidadeStats.clientes) || 0,
          fornecedores: parseInt(entidadeStats.fornecedores) || 0,
          ambos: parseInt(entidadeStats.ambos) || 0,
        },
        contratos: {
          total: parseInt(contratoStats.total) || 0,
          rascunhos: parseInt(contratoStats.rascunhos) || 0,
          ativos: parseInt(contratoStats.ativos) || 0,
          aguardando: parseInt(contratoStats.aguardando) || 0,
          cancelados: parseInt(contratoStats.cancelados) || 0,
          encerrados: parseInt(contratoStats.encerrados) || 0,
          faturados: parseInt(contratoStats.faturados) || 0,
          pendentesFaturamento: parseInt(contratoStats.pendentes_faturamento) || 0,
        },
        servicos: {
          total: parseInt(servicosStats.total) || 0,
        },
        valorTotalAtivos: parseFloat(valorStats.valor_total) || 0,
        economiaTotal: parseFloat(valorStats.economia_total) || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Import CSV data endpoint
  app.post("/api/contratos/import-csv", isAuthenticated, async (req, res) => {
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      
      return result;
    };

    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const csvPath = path.join(process.cwd(), 'attached_assets', 'turbop58_contratos_(2)_1767374833084.csv');
      
      if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ error: "CSV file not found" });
      }
      
      const content = fs.readFileSync(csvPath, 'utf-8');
      const allLines = content.split('\n');
      
      console.log(`[import] Loaded CSV with ${allLines.length} lines`);
      
      interface CSVSection {
        startLine: number;
        endLine: number;
        tableName: string;
        headers: string[];
      }
      
      const sections: CSVSection[] = [
        { startLine: 6862, endLine: 6888, tableName: 'servicos', headers: [] },
        { startLine: 4903, endLine: 5171, tableName: 'entidades', headers: [] },
        { startLine: 5722, endLine: 6861, tableName: 'planos_servicos', headers: [] },
        { startLine: 3353, endLine: 4475, tableName: 'contratos', headers: [] },
        { startLine: 4476, endLine: 4902, tableName: 'contratos_itens', headers: [] },
      ];
      
      const results: Record<string, { imported: number; skipped: number; errors: string[] }> = {};
      
      for (const section of sections) {
        const headerLine = allLines[section.startLine - 1];
        section.headers = parseCSVLine(headerLine);
        
        const dataLines = allLines.slice(section.startLine, section.endLine);
        
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];
        
        for (const line of dataLines) {
          if (!line.trim()) {
            skipped++;
            continue;
          }
          
          const values = parseCSVLine(line);
          if (values.length !== section.headers.length) {
            skipped++;
            continue;
          }
          
          const record: Record<string, any> = {};
          for (let i = 0; i < section.headers.length; i++) {
            let value = values[i];
            
            if (value === '' || value === 'NULL' || value === undefined) {
              record[section.headers[i]] = null;
            } else if (value === '0' || value === '1') {
              if (section.headers[i].startsWith('eh_') || section.headers[i] === 'ativo') {
                record[section.headers[i]] = value === '1';
              } else {
                record[section.headers[i]] = value;
              }
            } else {
              record[section.headers[i]] = value;
            }
          }
          
          try {
            const columns = Object.keys(record);
            const valuesStr = columns.map(c => {
              const v = record[c];
              if (v === null) return 'NULL';
              if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
              return `'${String(v).replace(/'/g, "''")}'`;
            }).join(', ');
            const columnsStr = columns.map(c => `"${c}"`).join(', ');
            
            await db.execute(sql.raw(`
              INSERT INTO staging.${section.tableName} (${columnsStr})
              VALUES (${valuesStr})
              ON CONFLICT (id) DO NOTHING
            `));
            imported++;
          } catch (err: any) {
            if (errors.length < 5) {
              errors.push(err.message);
            }
            skipped++;
          }
        }
        
        results[section.tableName] = { imported, skipped, errors };
        console.log(`[import] ${section.tableName}: ${imported} imported, ${skipped} skipped`);
      }
      
      res.json({ success: true, results });
    } catch (error: any) {
      console.error("[import] Error:", error);
      res.status(500).json({ error: error.message || "Import failed" });
    }
  });

  // Proxy para download de documento assinado do Assinafy
  app.get("/api/contratos/assinafy/download/:documentId", isAuthenticated, async (req, res) => {
    try {
      const { documentId } = req.params;
      
      // Buscar configuração do Assinafy
      const configResult = await db.execute(sql`
        SELECT api_key, api_url FROM staging.assinafy_config WHERE ativo = true LIMIT 1
      `);
      
      if (configResult.rows.length === 0) {
        return res.status(500).json({ error: "Configuração Assinafy não encontrada" });
      }
      
      const config = configResult.rows[0] as { api_key: string; api_url: string };
      const downloadUrl = `${config.api_url}/documents/${documentId}/download/certificated`;
      
      console.log("[assinafy] Attempting download from:", downloadUrl);
      
      // Tentar diferentes métodos de autenticação
      // Método 1: API Key como query parameter
      const urlWithKey = `${downloadUrl}?api_key=${config.api_key}`;
      
      let response = await fetch(urlWithKey, {
        headers: {
          'Accept': '*/*'
        }
      });
      
      // Se falhar, tentar com header X-API-Key
      if (!response.ok) {
        console.log("[assinafy] Query param auth failed, trying X-API-Key header");
        response = await fetch(downloadUrl, {
          headers: {
            'X-API-Key': config.api_key,
            'Accept': '*/*'
          }
        });
      }
      
      // Se ainda falhar, tentar com Authorization Bearer
      if (!response.ok) {
        console.log("[assinafy] X-API-Key header failed, trying Bearer token");
        response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
            'Accept': '*/*'
          }
        });
      }
      
      // Se ainda falhar, tentar com Authorization sem Bearer
      if (!response.ok) {
        console.log("[assinafy] Bearer failed, trying simple Authorization");
        response = await fetch(downloadUrl, {
          headers: {
            'Authorization': config.api_key,
            'Accept': '*/*'
          }
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[assinafy] All auth methods failed. Status:", response.status, "Response:", errorText);
        return res.status(response.status).json({ 
          error: "Erro ao baixar documento", 
          details: errorText,
          hint: "A API do Assinafy pode requerer um método de autenticação diferente. Verifique a documentação."
        });
      }
      
      // Obter o content-type da resposta original
      const contentType = response.headers.get('content-type') || 'application/pdf';
      
      // Definir headers para download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="contrato-${documentId}.pdf"`);
      
      // Stream do PDF para o cliente
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
      
    } catch (error: any) {
      console.error("[assinafy] Download error:", error);
      res.status(500).json({ error: "Erro ao baixar documento", details: error.message });
    }
  });
}
