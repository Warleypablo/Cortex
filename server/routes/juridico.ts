import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated } from "../auth/middleware";
import { validateBody } from "../middleware/validate";
import { upsertContextoJuridicoSchema } from "../middleware/schemas";
import PDFDocument from "pdfkit";
import * as path from "path";

function isAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export function registerJuridicoRoutes(app: Express) {
  // ==================== JURÍDICO - Clientes para ação legal ====================
  
  // Ensure juridico_regras_escalonamento table exists and has default rules
  async function ensureEscalationRulesTable() {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS juridico_regras_escalonamento (
          id SERIAL PRIMARY KEY,
          dias_atraso_min INTEGER NOT NULL,
          dias_atraso_max INTEGER,
          procedimento_sugerido TEXT NOT NULL,
          prioridade INTEGER NOT NULL DEFAULT 1,
          ativo BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Check if table has rules, seed defaults if empty
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM juridico_regras_escalonamento`);
      const count = parseInt((countResult.rows[0] as any)?.count || '0');
      
      if (count === 0) {
        await db.execute(sql`
          INSERT INTO juridico_regras_escalonamento (dias_atraso_min, dias_atraso_max, procedimento_sugerido, prioridade, ativo)
          VALUES 
            (30, 59, 'notificacao', 1, true),
            (60, 89, 'protesto', 2, true),
            (90, NULL, 'acao_judicial', 3, true)
        `);
        console.log("[juridico] Default escalation rules seeded");
      }
    } catch (error) {
      console.log("[juridico] Warning: Could not ensure escalation rules table:", (error as Error).message);
    }
  }
  
  // Ensure tipo_inadimplencia column exists in cortex_core.inadimplencia_contextos table
  async function ensureTipoInadimplenciaColumn() {
    try {
      // Add column if not exists
      await db.execute(sql`
        ALTER TABLE cortex_core.inadimplencia_contextos 
        ADD COLUMN IF NOT EXISTS tipo_inadimplencia TEXT DEFAULT NULL
      `);
      console.log("[juridico] tipo_inadimplencia column ensured");
    } catch (error) {
      console.log("[juridico] Warning: Could not add tipo_inadimplencia column:", (error as Error).message);
    }
  }
  
  // Initialize tables on startup
  ensureEscalationRulesTable();
  ensureTipoInadimplenciaColumn();
  
  // Jurídico - Listar clientes inadimplentes + clientes com histórico jurídico (mesmo após pagamento)
  app.get("/api/juridico/clientes", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      
      // 1. Buscar clientes inadimplentes
      const clientesData = await storage.getInadimplenciaClientes(dataInicio, dataFim, 'valor', 1000);
      
      // 2. Filtrar clientes inadimplentes com mais de 3 dias de atraso
      const clientesFiltrados = clientesData.clientes.filter(c => c.diasAtrasoMax > 3);
      const todosIds = clientesFiltrados.map(c => c.idCliente);
      
      // 2.5. Buscar clientes com histórico jurídico (acordos/recuperados) que não estão mais inadimplentes
      const clientesComHistoricoJuridico = await storage.getClientesComContextoJuridico();
      const idsHistoricoNaoInadimplentes = clientesComHistoricoJuridico.filter(id => !todosIds.includes(id));
      
      // Buscar todos os IDs para contextos (inadimplentes + históricos)
      const todosIdsParaContextos = [...todosIds, ...idsHistoricoNaoInadimplentes];
      
      // 3. Buscar contextos jurídicos
      const contextos = await storage.getInadimplenciaContextos(todosIdsParaContextos);
      
      // 4. Buscar regras de escalonamento (handle table not existing gracefully)
      let escalationRules: Array<{
        diasAtrasoMin: number;
        diasAtrasoMax: number | null;
        procedimentoSugerido: string;
        prioridade: number;
      }> = [];
      
      try {
        const escalationRulesResult = await db.execute(sql`
          SELECT 
            dias_atraso_min as "diasAtrasoMin",
            dias_atraso_max as "diasAtrasoMax",
            procedimento_sugerido as "procedimentoSugerido",
            prioridade
          FROM juridico_regras_escalonamento
          WHERE ativo = true
          ORDER BY prioridade ASC
        `);
        escalationRules = escalationRulesResult.rows as typeof escalationRules;
      } catch (rulesError) {
        console.log("[juridico] Escalation rules table not available:", (rulesError as Error).message);
      }
      
      // Helper function to get suggested procedimento based on dias_atraso
      const getSuggestedProcedimento = (diasAtraso: number) => {
        for (const rule of escalationRules) {
          const min = rule.diasAtrasoMin;
          const max = rule.diasAtrasoMax;
          if (diasAtraso >= min && (max === null || diasAtraso <= max)) {
            return {
              procedimento: rule.procedimentoSugerido,
              prioridade: rule.prioridade
            };
          }
        }
        return null;
      };
      
      // Procedimento priority mapping
      const PROCEDIMENTO_PRIORITY: Record<string, number> = {
        'notificacao': 1,
        'protesto': 2,
        'acao_judicial': 3,
        'acordo': 4,
        'baixa': 5
      };
      
      // 4. Buscar parcelas em paralelo para clientes inadimplentes
      const parcelasPromises = clientesFiltrados.map(cliente => 
        storage.getInadimplenciaDetalheParcelas(cliente.idCliente, dataInicio, dataFim)
      );
      const parcelasResults = await Promise.all(parcelasPromises);
      
      // 5. Montar resposta com sugestão de escalonamento para clientes inadimplentes
      const clientesComDados = clientesFiltrados.map((cliente, index) => {
        const contexto = contextos[cliente.idCliente] || {};
        const suggestion = getSuggestedProcedimento(cliente.diasAtrasoMax);
        
        const currentProcedimento = contexto.procedimentoJuridico;
        const currentPriority = currentProcedimento ? (PROCEDIMENTO_PRIORITY[currentProcedimento] || 0) : 0;
        const suggestedPriority = suggestion?.prioridade || 0;
        
        // Determine if escalation is needed (suggested is higher priority than current)
        // Lower prioridade number means earlier stage, higher number = more severe
        // needsEscalation = current procedure is LOWER stage than suggested
        const needsEscalation = suggestion && currentPriority < suggestedPriority;
        
        return {
          cliente,
          contexto,
          parcelas: parcelasResults[index].parcelas,
          isHistorico: false,
          suggestedProcedimento: suggestion?.procedimento || null,
          needsEscalation,
        };
      });
      
      // 6. Adicionar clientes históricos (acordos/recuperados que já pagaram)
      // Esses clientes têm contexto jurídico mas não estão mais inadimplentes
      
      // Buscar nomes reais dos clientes históricos
      const nomesClientesHistoricos: Record<string, { nome: string; empresa: string }> = {};
      if (idsHistoricoNaoInadimplentes.length > 0) {
        const escapedIds = idsHistoricoNaoInadimplentes.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');
        const nomesResult = await db.execute(sql.raw(`
          SELECT DISTINCT ON (TRIM(ids::text))
            TRIM(ids::text) as id_cliente,
            nome,
            COALESCE(empresa, '') as empresa
          FROM "Conta Azul".caz_clientes
          WHERE ids IS NOT NULL AND TRIM(ids::text) IN (${escapedIds})
          ORDER BY TRIM(ids::text)
        `));
        for (const row of nomesResult.rows as any[]) {
          nomesClientesHistoricos[row.id_cliente] = { nome: row.nome || '', empresa: row.empresa || '' };
        }
      }
      
      const clientesHistoricos: typeof clientesComDados = [];
      for (const clienteId of idsHistoricoNaoInadimplentes) {
        const contexto = contextos[clienteId] || {};
        // Só incluir se tiver procedimento de acordo ou baixa concluída (são os "recuperados")
        const isRecuperado = contexto.procedimentoJuridico === 'acordo' || 
          (contexto.statusJuridico === 'concluido' && contexto.procedimentoJuridico === 'baixa');
        
        if (isRecuperado) {
          // Buscar nome real do cliente
          const clienteInfo = nomesClientesHistoricos[clienteId];
          // Para clientes manuais (prefixo "manual_"), extrair nome do contexto
          let nomeReal = clienteInfo?.nome;
          if (!nomeReal && clienteId.startsWith('manual_')) {
            // Extrair nome do contexto: "Nome - Cliente recuperado manualmente"
            nomeReal = contexto.contextoJuridico?.split(' - ')[0] || clienteId.replace('manual_', '').replace(/_/g, ' ');
          } else if (!nomeReal) {
            nomeReal = `Cliente ${clienteId}`;
          }
          const empresaReal = clienteInfo?.empresa || '';
          
          // Criar objeto cliente mínimo para exibição
          clientesHistoricos.push({
            cliente: {
              idCliente: clienteId,
              nomeCliente: nomeReal,
              valorTotal: contexto.valorAcordado || 0,
              quantidadeParcelas: 0,
              parcelaMaisAntiga: '',
              diasAtrasoMax: 0,
              empresa: empresaReal,
              cnpj: null,
              statusClickup: null,
              responsavel: null,
              cluster: null,
              servicos: null,
              telefone: null,
            },
            contexto,
            parcelas: [],
            isHistorico: true,
            suggestedProcedimento: null,
            needsEscalation: false,
          });
        }
      }
      
      const todosClientes = [...clientesComDados, ...clientesHistoricos];
      
      console.log("[api] Juridico clientes - Inadimplentes:", clientesFiltrados.length, "Históricos:", clientesHistoricos.length);
      
      res.json({ clientes: todosClientes });
    } catch (error) {
      console.error("[api] Error fetching juridico clientes:", error);
      res.status(500).json({ error: "Failed to fetch juridico clientes" });
    }
  });

  app.put("/api/juridico/clientes/:clienteId/contexto", validateBody(upsertContextoJuridicoSchema), async (req, res) => {
    try {
      const { clienteId } = req.params;
      const { contextoJuridico, procedimentoJuridico, statusJuridico, valorAcordado, tipoInadimplencia } = req.body;
      
      const user = (req as any).user;
      const atualizadoPor = user?.name || user?.googleId || 'Sistema';
      
      const result = await storage.upsertContextoJuridico({
        clienteId,
        contextoJuridico,
        procedimentoJuridico,
        statusJuridico,
        valorAcordado: valorAcordado != null ? parseFloat(valorAcordado) : undefined,
        tipoInadimplencia,
        atualizadoPor,
      });
      
      console.log("[api] Contexto jurídico atualizado para cliente:", clienteId);
      
      res.json(result);
    } catch (error) {
      console.error("[api] Error updating contexto juridico:", error);
      res.status(500).json({ error: "Failed to update contexto juridico" });
    }
  });

  // Função para inserir clientes recuperados manualmente na inicialização
  async function ensureManualRecoveredClients() {
    try {
      const clientesManuais = [
        { id: 'manual_show_room', nome: 'Show Room', valor: 1967 },
        { id: 'manual_advocacia_morais', nome: 'Advocacia Morais', valor: 1997 },
        { id: 'manual_reset', nome: 'Reset', valor: 3000 },
        { id: 'manual_nativa', nome: 'Nativa', valor: 5000 },
        { id: 'manual_kingly', nome: 'Kingly', valor: 1998 },
        { id: 'manual_fast_lab', nome: 'Fast Lab', valor: 1058 },
        { id: 'manual_ouvi_dizer', nome: 'Ouvi Dizer', valor: 2700 },
        { id: 'manual_hortencia', nome: 'Hortencia', valor: 4500 },
        { id: 'manual_rivers', nome: 'Rivers', valor: 1875 },
        { id: 'manual_manafix', nome: 'Manafix', valor: 2019.38 },
        { id: 'manual_agro_nutri', nome: 'Agro Nutri', valor: 2955 },
        { id: 'manual_brisa', nome: 'Brisa', valor: 689 },
      ];
      
      for (const cliente of clientesManuais) {
        await db.execute(sql`
          INSERT INTO cortex_core.inadimplencia_contextos (cliente_id, procedimento_juridico, status_juridico, valor_acordado, contexto_juridico, acao, contexto, atualizado_por)
          VALUES (${cliente.id}, 'acordo', 'concluido', ${cliente.valor}, ${cliente.nome + ' - Cliente recuperado manualmente'}, 'acordo_manual', 'Cliente recuperado com acordo', 'Sistema')
          ON CONFLICT (cliente_id) DO UPDATE SET
            procedimento_juridico = 'acordo',
            status_juridico = 'concluido',
            valor_acordado = EXCLUDED.valor_acordado,
            contexto_juridico = EXCLUDED.contexto_juridico
        `);
      }
      
      console.log("[juridico] Clientes recuperados manuais inseridos:", clientesManuais.length);
    } catch (error) {
      console.warn("[juridico] Erro ao inserir clientes recuperados manuais:", (error as Error).message);
    }
  }
  
  // Executar na inicialização
  ensureManualRecoveredClients();

  // Função para atualizar valor_acordado de clientes específicos pelo nome
  async function updateClienteValorAcordadoByName() {
    try {
      // Atualizar GO COFFEE com valor R$ 3.283
      await db.execute(sql`
        UPDATE cortex_core.inadimplencia_contextos ic
        SET valor_acordado = 3283
        FROM "Conta Azul".caz_clientes c
        WHERE ic.cliente_id = c.id::text
          AND UPPER(c.nome) LIKE '%GO COFFEE%'
      `);
      console.log("[juridico] Valor acordado atualizado para GO COFFEE: R$ 3.283");
    } catch (error) {
      console.warn("[juridico] Erro ao atualizar valor acordado:", (error as Error).message);
    }
  }
  
  // Executar na inicialização
  updateClienteValorAcordadoByName();

  // Função para corrigir nomes e adicionar clientes de erro operacional
  async function setupErroOperacionalClients() {
    try {
      // Remover TODOS os registros de erro operacional (antigos e novos, incluindo os com NULL)
      await db.execute(sql`
        DELETE FROM cortex_core.inadimplencia_contextos 
        WHERE tipo_inadimplencia = 'erro_operacional'
           OR cliente_id LIKE 'erro_%'
           OR contexto_juridico ILIKE '%Registro manual%'
           OR contexto_juridico ILIKE '%Fantasma%'
           OR contexto_juridico ILIKE '%Hubstage%'
           OR contexto_juridico ILIKE '%GPA Suplementos%'
           OR contexto_juridico ILIKE '%Winstage%'
      `);
      
      // Lista completa de clientes de erro operacional com valores corretos (apenas do print)
      const clientesErroOperacional = [
        { nome: 'NOODROPS', valor: 7200 },
        { nome: 'GOTA TROPICANA', valor: 2000 },
        { nome: 'FANTASMA DA OPERA', valor: 7958.04 },
        { nome: 'FS COMPANY', valor: 2000 },
        { nome: 'VITÓRIA TERNOS', valor: 5994 },
        { nome: 'CHAMA 27', valor: 8199.44 },
        { nome: 'GPA SUPLEMENTOS', valor: 8366.60 },
        { nome: 'PELICULAS FACIL', valor: 12805 },
        { nome: 'HUBSAGE DISTRIBUIDORA', valor: 0 },
        { nome: 'QUIPROCO ROUPARIA E VERBAL LTDA', valor: 1997 },
        { nome: 'WINSTAGE', valor: 6100 },
        { nome: 'SMART MINI', valor: 2167 },
        { nome: 'RAFAELA MACEDO DE JESUS', valor: 6000 },
        { nome: 'DELICIOUS HEALTHY ALIMENTACAO', valor: 6148.86 },
        { nome: 'MAXCAR MOBILIDADE', valor: 2997 },
        { nome: 'BRISA COMÉRCIO', valor: 3997 },
        { nome: 'LIFE GOM', valor: 8997 },
        { nome: 'MS CREATIVE', valor: 2997 },
        { nome: 'LOOPS NUTRITION', valor: 3442.58 },
        { nome: 'LÍVERE', valor: 8366 },
        { nome: 'VENAMORE', valor: 15000 },
        { nome: 'AMAZON MIX', valor: 5116 },
      ];
      
      for (const cliente of clientesErroOperacional) {
        await db.execute(sql`
          INSERT INTO cortex_core.inadimplencia_contextos (cliente_id, procedimento_juridico, status_juridico, valor_acordado, contexto_juridico, acao, contexto, atualizado_por, tipo_inadimplencia)
          VALUES (${cliente.nome}, 'baixa', 'concluido', ${cliente.valor}, ${cliente.nome}, 'erro_operacional', 'Classificado como erro operacional', 'Sistema', 'erro_operacional')
          ON CONFLICT (cliente_id) DO UPDATE SET
            tipo_inadimplencia = 'erro_operacional',
            valor_acordado = ${cliente.valor},
            contexto_juridico = ${cliente.nome}
        `);
      }
      
      console.log("[juridico] Clientes erro operacional configurados:", clientesErroOperacional.length);
    } catch (error) {
      console.warn("[juridico] Erro ao configurar clientes erro operacional:", (error as Error).message);
    }
  }
  
  // Executar na inicialização
  setupErroOperacionalClients();

  // ==================== JURÍDICO - Contratos Colaboradores ====================
  
  // Inicializar tabela de status de contratos de colaboradores
  let contratosColabStatusTableInitialized = false;
  async function ensureContratosColabStatusTable() {
    if (contratosColabStatusTableInitialized) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.contratos_colaboradores_status (
          id SERIAL PRIMARY KEY,
          colaborador_id INTEGER NOT NULL,
          colaborador_nome VARCHAR(255) NOT NULL,
          colaborador_email VARCHAR(255),
          documento_id VARCHAR(255),
          status VARCHAR(50) NOT NULL DEFAULT 'Enviado para assinatura',
          data_envio TIMESTAMP DEFAULT NOW(),
          data_assinatura TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      contratosColabStatusTableInitialized = true;
      console.log("[database] Contratos colaboradores status table initialized");
    } catch (error) {
      console.error("[database] Error initializing contratos_colaboradores_status table:", error);
    }
  }
  
  app.get("/api/juridico/colaboradores-contrato", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradoresParaContrato();
      res.json({ colaboradores });
    } catch (error) {
      console.error("[api] Error fetching colaboradores para contrato:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
    }
  });
  
  // GET - Listar status de todos os contratos de colaboradores
  app.get("/api/juridico/colaboradores-contrato/status", async (req, res) => {
    try {
      await ensureContratosColabStatusTable();
      
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.contratos_colaboradores_status 
        ORDER BY data_envio DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching contratos status:", error);
      res.status(500).json({ error: "Failed to fetch contratos status" });
    }
  });
  
  // GET - Status de contrato de um colaborador específico
  app.get("/api/juridico/colaboradores-contrato/:id/status", async (req, res) => {
    try {
      await ensureContratosColabStatusTable();
      const colaboradorId = parseInt(req.params.id);
      
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.contratos_colaboradores_status 
        WHERE colaborador_id = ${colaboradorId}
        ORDER BY data_envio DESC
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        return res.json({ status: null });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error fetching contrato status:", error);
      res.status(500).json({ error: "Failed to fetch contrato status" });
    }
  });
  
  // GET - Download do documento assinado no Assinafy (colaboradores)
  app.get("/api/juridico/colaboradores-contrato/download/:documentId", async (req, res) => {
    try {
      const { documentId } = req.params;

      const configResult = await db.execute(sql`
        SELECT api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'colaboradores' LIMIT 1
      `);

      if (configResult.rows.length === 0) {
        // Fallback: buscar qualquer config ativa (tabela pode não ter coluna tipo)
        const fallback = await db.execute(sql`
          SELECT api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true LIMIT 1
        `);
        if (fallback.rows.length === 0) {
          return res.status(500).json({ error: "Configuração Assinafy não encontrada" });
        }
        configResult.rows = fallback.rows;
      }

      const config = configResult.rows[0] as { api_key: string; api_url: string };
      const downloadUrl = `${config.api_url}/documents/${documentId}/download/certificated`;

      let response = await fetch(downloadUrl, {
        headers: { 'X-Api-Key': config.api_key, 'Accept': '*/*' }
      });

      // Fallback: tentar download sem /certificated (documento ainda não certificado)
      if (!response.ok) {
        const downloadUrl2 = `${config.api_url}/documents/${documentId}/download`;
        response = await fetch(downloadUrl2, {
          headers: { 'X-Api-Key': config.api_key, 'Accept': '*/*' }
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[assinafy-colab] Download error:", response.status, errorText);
        return res.status(response.status).json({ error: "Erro ao baixar documento", details: errorText });
      }

      const contentType = response.headers.get('content-type') || 'application/pdf';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="contrato-${documentId}.pdf"`);

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("[assinafy-colab] Download error:", error);
      res.status(500).json({ error: "Erro ao baixar documento", details: error.message });
    }
  });

  // PATCH - Atualizar status de contrato (para marcar como assinado manualmente)
  app.patch("/api/juridico/colaboradores-contrato/:id/status", async (req, res) => {
    try {
      await ensureContratosColabStatusTable();
      const colaboradorId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status é obrigatório" });
      }
      
      const dataAssinatura = status === 'Assinado' ? sql`NOW()` : sql`NULL`;
      
      const result = await db.execute(sql`
        UPDATE cortex_core.contratos_colaboradores_status 
        SET status = ${status}, 
            data_assinatura = ${dataAssinatura},
            updated_at = NOW()
        WHERE colaborador_id = ${colaboradorId}
        AND id = (
          SELECT id FROM cortex_core.contratos_colaboradores_status 
          WHERE colaborador_id = ${colaboradorId}
          ORDER BY data_envio DESC
          LIMIT 1
        )
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating contrato status:", error);
      res.status(500).json({ error: "Failed to update contrato status" });
    }
  });

  // POST - Sincronizar status dos contratos de colaboradores com Assinafy
  app.post("/api/juridico/colaboradores-contrato/sync-status", async (req, res) => {
    try {
      await ensureContratosColabStatusTable();

      // 1. Buscar config do Assinafy
      const configResult = await db.execute(sql`
        SELECT account_id, api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'colaboradores' LIMIT 1
      `);

      if (configResult.rows.length === 0) {
        return res.status(500).json({ error: "Configuração do Assinafy para colaboradores não encontrada" });
      }

      const config = configResult.rows[0] as { account_id: string; api_key: string; api_url: string };

      // 2. Buscar contratos com documento_id e status não-final
      const contratosResult = await db.execute(sql`
        SELECT id, colaborador_id, colaborador_nome, documento_id, status
        FROM cortex_core.contratos_colaboradores_status
        WHERE documento_id IS NOT NULL
          AND status NOT IN ('Assinado', 'Recusado', 'Cancelado')
      `);

      const contratos = contratosResult.rows as any[];
      console.log(`[sync-colab] Verificando ${contratos.length} contratos pendentes no Assinafy`);

      let atualizados = 0;
      const resultados: { colaborador: string; statusAnterior: string; statusNovo: string }[] = [];

      for (const contrato of contratos) {
        try {
          // 3. Consultar status no Assinafy
          const statusUrl = `${config.api_url}/documents/${contrato.documento_id}`;
          const statusResponse = await fetch(statusUrl, {
            method: 'GET',
            headers: { 'X-Api-Key': config.api_key }
          });

          const statusResult = await statusResponse.json() as any;
          const assStatus = statusResult.data?.status || statusResult.status;

          // 4. Mapear status do Assinafy para status local
          let novoStatus: string | null = null;

          if (assStatus === 'signed' || assStatus === 'completed' || assStatus === 'certificated') {
            novoStatus = 'Assinado';
          } else if (assStatus === 'declined') {
            novoStatus = 'Recusado';
          } else if (assStatus === 'cancelled' || assStatus === 'expired') {
            novoStatus = 'Cancelado';
          } else if (assStatus === 'pending' || assStatus === 'waiting_signatures') {
            novoStatus = 'Enviado para assinatura';
          }

          if (novoStatus && novoStatus !== contrato.status) {
            const dataAssinatura = novoStatus === 'Assinado' ? sql`NOW()` : sql`NULL`;
            await db.execute(sql`
              UPDATE cortex_core.contratos_colaboradores_status
              SET status = ${novoStatus},
                  data_assinatura = ${dataAssinatura},
                  updated_at = NOW()
              WHERE id = ${contrato.id}
            `);
            atualizados++;
            resultados.push({
              colaborador: contrato.colaborador_nome,
              statusAnterior: contrato.status,
              statusNovo: novoStatus,
            });
            console.log(`[sync-colab] ${contrato.colaborador_nome}: ${contrato.status} → ${novoStatus}`);
          }
        } catch (err) {
          console.error(`[sync-colab] Erro ao verificar contrato ${contrato.documento_id}:`, err);
        }
      }

      console.log(`[sync-colab] Sync concluído: ${atualizados} de ${contratos.length} atualizados`);
      res.json({ total: contratos.length, atualizados, resultados });
    } catch (error) {
      console.error("[sync-colab] Erro:", error);
      res.status(500).json({ error: "Erro ao sincronizar status" });
    }
  });

  // Função compartilhada para gerar PDF de contrato de colaborador
  async function gerarContratoPDF(params: {
    nome: string;
    cpf: string;
    cnpj: string;
    endereco: string;
    estado: string;
    cargo: string;
    salario: string;
    patrimonio: string | null;
  }): Promise<Buffer> {
    const { nome, cpf, cnpj, endereco, estado, cargo, salario, patrimonio } = params;

    // Calcular datas - Data de início é SEMPRE hoje, data fim é 6 meses depois
    const dataInicioDate = new Date();
    const dataInicio = dataInicioDate.toLocaleDateString('pt-BR');
    const dataFimDate = new Date(dataInicioDate);
    dataFimDate.setMonth(dataFimDate.getMonth() + 6);
    const dataFim = dataFimDate.toLocaleDateString('pt-BR');
    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Formatar salário para exibição no contrato
    const salarioNumerico = parseFloat((salario || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const salarioFormatado = salarioNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Mapeamento de escopos por cargo
    const escoposPorCargo: Record<string, { titulo: string; escopo: string }> = {
      "ANALISTA DE CX": {
        titulo: "ANALISTA DE CX",
        escopo: "garantir a experiência do cliente em todas as interações com a empresa, criar estratégia para melhorar a experiência do cliente, identificando e implementando soluções para corrigir problemas, fornecer informações precisas e atualizadas sobre os produtos e serviços oferecidos pela empresa, interagir com outras equipes da empresa, como a equipe de performance e vendas, para garantir que as necessidades dos clientes sejam atendidas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "CXCS": {
        titulo: "ANALISTA DE CX",
        escopo: "garantir a experiência do cliente em todas as interações com a empresa, criar estratégia para melhorar a experiência do cliente, identificando e implementando soluções para corrigir problemas, fornecer informações precisas e atualizadas sobre os produtos e serviços oferecidos pela empresa, interagir com outras equipes da empresa, como a equipe de performance e vendas, para garantir que as necessidades dos clientes sejam atendidas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "ANALISTA DE COMUNICAÇÃO": {
        titulo: "ANALISTA DE COMUNICAÇÃO",
        escopo: "roteirizar vídeos UGC que sejam autênticos, criativos e impactantes para as marcas que trabalhamos; colaborar com as equipes de Social Media e Performance para garantir que o conteúdo gerado não apenas engaje, mas também converta de forma eficaz; criar copy criativa que se destaque e gere conversões reais, aplicando técnicas de storytelling para gerar conexão genuína com o público; estar sempre atualizado sobre novas tendências e formatos de vídeo, garantindo que seus conteúdos não fiquem para trás; colaborar com grandes marcas, entendendo suas necessidades e entregando resultados concretos, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "G&G": {
        titulo: "G&G",
        escopo: "conduzir processos de recrutamento e seleção do início ao fim para diferentes áreas da empresa, alinhar perfis com gestores, entendendo necessidades técnicas e comportamentais das vagas, criar e publicar anúncios de vagas em portais, redes sociais e plataformas especializadas, realizar triagem de currículos, entrevistas por competências e dinâmicas de grupo, aplicar testes comportamentais e técnicos, quando necessário, gerar relatórios de indicadores (tempo de contratação, fontes de recrutamento, etc), sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "GENTE E GESTÃO": {
        titulo: "ANALISTA DE GENTE E GESTÃO",
        escopo: "conduzir processos seletivos completos, desde a triagem de currículos até a finalização da contratação; apoiar na implementação de programas de treinamento, desenvolvimento e avaliação de desempenho; acompanhar a performance dos colaboradores, realizar feedbacks construtivos e colaborar com a área de gestão para alinhamento de estratégias de pessoas; conduzir o processo de integração para novos colaboradores, assegurando um bom início na empresa; auxiliar nas rotinas administrativas relacionadas a benefícios, folha de pagamento e demais questões operacionais de recursos humanos; contribuir para a manutenção de um bom ambiente de trabalho, alinhado aos valores e à missão da empresa, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "VIDEOMAKER": {
        titulo: "VIDEOMAKER",
        escopo: "editar vídeos corporativos, institucionais e de marketing, aplicando técnicas de edição para criar conteúdo impactante e engajador; implementar efeitos visuais, transições e tratamentos de imagem para elevar a qualidade do material produzido; revisar o trabalho com base no feedback do solicitante; garantir a entrega de vídeos finalizados dentro dos prazos e padrões de qualidade estabelecidos; trazer iniciativas externas de aprimoramento e atualização com base no mercado de edição, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "DESIGNER": {
        titulo: "DESIGNER",
        escopo: "desenvolvimento de logotipos, materiais gráficos e layouts para campanhas, incluindo redes sociais, e-mail marketing e peças publicitárias; criação e otimização de peças gráficas para plataformas digitais (site, e-commerce, redes sociais, etc.); colaborar com as equipes de marketing e comunicação para entender as necessidades de design e desenvolver soluções criativas que atendam às demandas; manter-se atualizado sobre as últimas tendências e ferramentas de design e edição de vídeos, com foco na criação de conteúdo visual impactante; elaborar apresentações para reuniões internas e externas, com layout atrativo e condizente com a identidade visual da empresa, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "GESTOR DE PERFORMANCE": {
        titulo: "GESTOR DE PERFORMANCE",
        escopo: "construir campanhas e atuar de forma tática na otimização de mídias; acompanhamento da jornada do cliente junto ao time de CX/CS; auxiliar na criação, implementação e otimização de campanhas em Google Ads e Meta Ads; desenvolver análises rotineiras para identificar padrões de otimização e reportar insights aos stakeholders; monitorar a performance das campanhas e gerar relatórios para análise; colaborar com a equipe para desenvolver estratégias que aumentem a eficácia das campanhas; acompanhar tendências do mercado e aplicar boas práticas em campanhas digitais, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "PRÉ-VENDAS": {
        titulo: "ANALISTA DE PRÉ-VENDAS",
        escopo: "criação de listas para prospecção outbound (BDR); qualificação de leads; garantir o comparecimento do cliente na reunião agendada; construir um resumo do cliente para o closer ter contexto ao participar da reunião; atingir metas de reuniões agendadas; apresentação de pré reunião; desenvolvimento técnico comercial constante; construir relacionamento com clientes; atualizar o CRM; participar de reuniões internas; apresentação de Planos de Ação, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "SDR": {
        titulo: "ANALISTA DE PRÉ-VENDAS",
        escopo: "criação de listas para prospecção outbound (BDR); qualificação de leads; garantir o comparecimento do cliente na reunião agendada; construir um resumo do cliente para o closer ter contexto ao participar da reunião; atingir metas de reuniões agendadas; apresentação de pré reunião; desenvolvimento técnico comercial constante; construir relacionamento com clientes; atualizar o CRM; participar de reuniões internas; apresentação de Planos de Ação, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "BDR": {
        titulo: "ANALISTA DE PRÉ-VENDAS",
        escopo: "criação de listas para prospecção outbound (BDR); qualificação de leads; garantir o comparecimento do cliente na reunião agendada; construir um resumo do cliente para o closer ter contexto ao participar da reunião; atingir metas de reuniões agendadas; apresentação de pré reunião; desenvolvimento técnico comercial constante; construir relacionamento com clientes; atualizar o CRM; participar de reuniões internas; apresentação de Planos de Ação, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "FINANCEIRO": {
        titulo: "FINANCEIRO",
        escopo: "planejamento e controle financeiro, interpretação de relatórios, avaliação e consultoria, controle de custos, análise de riscos, acompanhamento de resultados, criar, acompanhar e medir indicadores, contas a pagar, contas a receber, emissão de nota fiscal, lançamentos financeiros, elaboração de relatórios gerenciais, acompanhamento de processos operacionais, dentre outras atividades financeiras não listadas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "PO": {
        titulo: "PRODUCT OWNER",
        escopo: "atuar prestando suporte para nossos clientes de sites e e-commerces, identificar/resolver bugs e problemas gerais relacionados a sites (site fora do ar, problemas de cálculo de frete, entre outros), relacionamento com clientes para a exposição do ocorrido e verificação da melhor tratativa, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "PRODUCT OWNER": {
        titulo: "PRODUCT OWNER",
        escopo: "atuar prestando suporte para nossos clientes de sites e e-commerces, identificar/resolver bugs e problemas gerais relacionados a sites (site fora do ar, problemas de cálculo de frete, entre outros), relacionamento com clientes para a exposição do ocorrido e verificação da melhor tratativa, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "INSIDE SALES": {
        titulo: "INSIDE SALES",
        escopo: "realização de reuniões, apresentação de propostas e fechamento, gerir pipeline de vendas, construir relacionamento com clientes, atualizar o CRM, participar de reuniões internas, cumprimento de metas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "ANALISTA DE DADOS": {
        titulo: "ANALISTA DE DADOS",
        escopo: "coletar, organizar e analisar grandes volumes de dados para extrair insights estratégicos que impactem diretamente os resultados de nossos clientes, criar e manter dashboards no Power BI que permitam a visualização clara e precisa dos dados, fornecendo relatórios acionáveis para as equipes de marketing, produto e liderança, escrever e otimizar consultas SQL para extrair dados relevantes e facilitar a análise contínua, desenvolver recomendações baseadas em dados para impulsionar a performance dos negócios, ajudando a identificar oportunidades e soluções, trabalhar em estreita colaboração com equipes de marketing e produto, garantindo que os dados gerados alimentem e apoiem as estratégias de crescimento, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "DADOS": {
        titulo: "ANALISTA DE DADOS",
        escopo: "coletar, organizar e analisar grandes volumes de dados para extrair insights estratégicos que impactem diretamente os resultados de nossos clientes, criar e manter dashboards no Power BI que permitam a visualização clara e precisa dos dados, fornecendo relatórios acionáveis para as equipes de marketing, produto e liderança, escrever e otimizar consultas SQL para extrair dados relevantes e facilitar a análise contínua, desenvolver recomendações baseadas em dados para impulsionar a performance dos negócios, ajudando a identificar oportunidades e soluções, trabalhar em estreita colaboração com equipes de marketing e produto, garantindo que os dados gerados alimentem e apoiem as estratégias de crescimento, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "UIUX": {
        titulo: "UI/UX",
        escopo: "desenvolver soluções visuais criativas para campanhas de marketing e publicidade: materiais gráficos, impressos e outros formatos, como infográficos, moodboards, grids e edição de vídeos, acompanhar os projetos e propor inovações gráficas de comunicação e design, alinhadas ao propósito e identidade das marcas, noções de Motion Design será considerado diferencial, participar de cerimônias de aprendizados com a equipe de design, participar de reuniões de debriefing e alinhamento com clientes, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "UI/UX": {
        titulo: "UI/UX",
        escopo: "desenvolver soluções visuais criativas para campanhas de marketing e publicidade: materiais gráficos, impressos e outros formatos, como infográficos, moodboards, grids e edição de vídeos, acompanhar os projetos e propor inovações gráficas de comunicação e design, alinhadas ao propósito e identidade das marcas, noções de Motion Design será considerado diferencial, participar de cerimônias de aprendizados com a equipe de design, participar de reuniões de debriefing e alinhamento com clientes, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "JURÍDICO": {
        titulo: "JURÍDICO",
        escopo: "analisar, elaborar, revisar e negociar contratos, aditivos e instrumentos jurídicos da empresa, orientar preventivamente as áreas internas quanto a riscos legais, compliance, obrigações regulatórias e mitigação de passivos, acompanhar demandas administrativas e judiciais, gerenciar escritórios terceirizados e assegurar a defesa dos interesses institucionais, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "JURIDICO": {
        titulo: "JURÍDICO",
        escopo: "analisar, elaborar, revisar e negociar contratos, aditivos e instrumentos jurídicos da empresa, orientar preventivamente as áreas internas quanto a riscos legais, compliance, obrigações regulatórias e mitigação de passivos, acompanhar demandas administrativas e judiciais, gerenciar escritórios terceirizados e assegurar a defesa dos interesses institucionais, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "DESENVOLVEDOR": {
        titulo: "DESENVOLVEDOR",
        escopo: "prestar à CONTRATANTE serviços técnicos especializados de desenvolvimento de software voltados a e-commerces na plataforma Shopify, abrangendo, de forma ampla e não exaustiva, a criação, customização, manutenção, correção, evolução e otimização de lojas virtuais, temas, funcionalidades, integrações, automações, APIs e aplicações relacionadas, bem como suporte técnico, ajustes de performance, segurança, conformidade técnica e boas práticas de desenvolvimento, de acordo com as demandas definidas pela CONTRATANTE, utilizando-se das tecnologias, recursos e padrões aplicáveis ao ecossistema Shopify, comprometendo-se a executar os serviços com diligência, qualidade técnica e observância às normas legais e contratuais vigentes"
      },
      "GESTOR DE COMUNIDADE": {
        titulo: "GESTOR DE COMUNIDADE",
        escopo: "planejar, criar e gerenciar estratégias de comunidade para fortalecer o relacionamento entre a marca e seu público, moderar e engajar comunidades em plataformas digitais como redes sociais, fóruns, grupos e canais de comunicação, desenvolver conteúdos e ações que estimulem a participação, interação e fidelização dos membros da comunidade, monitorar métricas de engajamento e crescimento da comunidade, gerando relatórios e insights para otimização contínua, identificar oportunidades de relacionamento e colaborar com as equipes de marketing, CX e conteúdo para alinhar as estratégias de comunidade aos objetivos do negócio, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      }
    };

    const cargoOriginal = cargo || '';
    const cargoUpper = cargoOriginal.toUpperCase().trim();

    // Função para encontrar escopo com matching flexível
    const findEscopo = (cargoParam: string): { titulo: string; escopo: string } | undefined => {
      // Tenta match direto
      if (escoposPorCargo[cargoParam]) return escoposPorCargo[cargoParam];

      // Tenta match parcial (se o cargo contém a chave ou vice-versa)
      for (const [key, value] of Object.entries(escoposPorCargo)) {
        if (cargoParam.includes(key) || key.includes(cargoParam)) {
          return value;
        }
      }
      return undefined;
    };

    const escopoInfo = findEscopo(cargoUpper) || {
      titulo: cargo || 'PRESTADOR DE SERVIÇOS',
      escopo: 'prestar serviços conforme acordado entre as partes, respeitando as diretrizes técnicas e operacionais da CONTRATANTE'
    };

    console.log(`[gerarContratoPDF] Cargo original: "${cargoOriginal}", Upper: "${cargoUpper}", Titulo encontrado: "${escopoInfo.titulo}"`);

    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Helper para texto justificado (padrão ABNT)
    const j = { align: 'justify' as const };

    // Logo no header
    const logoPath = path.join(process.cwd(), 'server/assets/turbo_logo.png');
    const fs = await import('fs');
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 60, 30, { width: 150 });
      }
    } catch (e) {
      console.log('[gerarContratoPDF] Logo não encontrada');
    }

    doc.moveDown(3);

    // Header
    doc.fontSize(12).font('Helvetica-Bold').text('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS', { align: 'center' });
    doc.moveDown(1);

    // Partes
    doc.fontSize(9).font('Helvetica').text('Pelo presente instrumento particular, e na melhor forma de direito, as partes a seguir qualificadas:', j);
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica-Bold').text('CONTRATANTE: ', { continued: true });
    doc.font('Helvetica').text('TURBO PARTNERS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o n° 42.100.292/0001-84, com sede na Av. João Batista Parra, 633 - 13° Andar - Enseada do Suá, Vitória - ES, CEP: 29052-123, neste ato representada por seu sócio Rodrigo Queiroz Santos;', j);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('CONTRATADA: ', { continued: true });

    // Detectar se é pessoa física (CPF) ou jurídica (CNPJ) e formatar qualificação
    const gerarQualificacaoContratada = (): string => {
      const cnpjLimpo = (cnpj || '').replace(/\D/g, '');
      const cpfLimpo = (cpf || '').replace(/\D/g, '');
      const enderecoFormatado = endereco || 'Não informado';
      const estadoFormatado = estado ? `, ${estado}` : '';

      // Formatar CNPJ se existir
      const cnpjFormatado = cnpjLimpo.length === 14
        ? (cnpj || cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'))
        : null;

      // Formatar CPF se existir
      const cpfFormatado = cpfLimpo.length === 11
        ? (cpf || cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'))
        : null;

      // Se tem CNPJ válido (pessoa jurídica)
      if (cnpjFormatado) {
        if (cpfFormatado) {
          // Modelo completo: CNPJ + endereço + CPF
          return `${nome}, pessoa jurídica de direito privado inscrita no CNPJ ${cnpjFormatado}, com sede na ${enderecoFormatado}${estadoFormatado}, devidamente registrado no CPF ${cpfFormatado}.`;
        }
        return `${nome}, pessoa jurídica de direito privado inscrita no CNPJ ${cnpjFormatado}, com sede na ${enderecoFormatado}${estadoFormatado}.`;
      }

      // Se tem apenas CPF (pessoa física)
      if (cpfFormatado) {
        return `${nome}, pessoa física, inscrita no CPF sob o n° ${cpfFormatado}, residente na ${enderecoFormatado}${estadoFormatado}.`;
      }

      // Fallback
      return `${nome}, com endereço na ${enderecoFormatado}${estadoFormatado}.`;
    };

    doc.font('Helvetica').text(gerarQualificacaoContratada(), j);
    doc.moveDown(0.4);
    doc.text('têm entre si, justo e contratado, o presente Contrato de Prestação de Serviços, mediante as seguintes cláusulas e condições:', j);
    doc.moveDown(0.4);

    // CLÁUSULA PRIMEIRA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA PRIMEIRA – DO OBJETO DO CONTRATO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text(`1.1. A CONTRATADA prestará serviços como ${escopoInfo.titulo}, nos termos e condições deste instrumento. Para tanto, a CONTRATADA alocará profissionais com qualificação técnica compatível com o objeto, podendo substituí-los a qualquer tempo, sob sua exclusiva responsabilidade.`, j);
    doc.moveDown(0.15);
    doc.text(`1.1.1. Os serviços objeto deste contrato poderão ser executados diretamente pela CONTRATADA ou por profissionais por ela livremente indicados, contratados ou subcontratados, sob sua exclusiva responsabilidade técnica, jurídica e administrativa, e compreendem, de modo exemplificativo, as seguintes atribuições: ${escopoInfo.escopo}`, j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. Fica certo e ajustado entre as PARTES que não haverá qualquer controle de horário e/ou carga horária do profissional alocado pela CONTRATADA para a execução dos serviços, tampouco obrigatoriedade quanto ao local de realização das tarefas.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. Toda e qualquer pessoa eventualmente envolvida pela CONTRATADA na execução dos serviços contratados atuará em nome e por conta exclusiva da CONTRATADA, sendo esta a única responsável por sua relação jurídica, operacional e contratual com tais profissionais, inexistindo qualquer vínculo direto ou indireto com a CONTRATANTE. Assim, a comunicação à CONTRATANTE sobre a identidade dos profissionais eventualmente alocados terá caráter meramente informativo e não configurará pessoalidade na prestação dos serviços.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. Quanto estiver atuando em dependências da CONTRATANTE, a CONTRATADA responsabiliza-se a fazer cumprir, por seu pessoal, as normas legais e internas da CONTRATANTE no tocante à segurança geral, higiene, proteção ao patrimônio e prevenção de incêndios.', j);
    doc.moveDown(0.4);

    // CLÁUSULA SEGUNDA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA SEGUNDA – DO PRAZO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text(`2.1 – O presente contrato tem prazo de 6 [seis] meses, com início em ${dataInicio} e fim em ${dataFim}. Ao final deste prazo, o CONTRATO poderá ser renovado mediante manifestação expressa das partes, ocasião em que será reavaliado o escopo e as condições comerciais.`, j);
    doc.moveDown(0.15);
    doc.text('Parágrafo único. A eventual renovação dependerá de manifestação expressa das partes, mediante aditivo escrito.', j);
    doc.moveDown(0.4);

    // CLÁUSULA TERCEIRA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA TERCEIRA – DA REMUNERAÇÃO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text(`3.1 - A título de contraprestação pelos serviços prestados no âmbito deste contrato, a CONTRATADA fará jus à remuneração periódica pelos serviços prestados o montante de ${salarioFormatado} (${salarioNumerico > 0 ? 'valor bruto' : 'conforme acordado entre as partes'}), enquanto vigente o presente instrumento, observado o escopo e a periodicidade das entregas pactuadas entre as partes.`, j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. Os valores que resultarem do disposto nesta cláusula constituem os únicos valores/créditos devidos pela CONTRATANTE ao CONTRATADO em razão do presente contrato, eximindo-se a CONTRATANTE de responder por quaisquer outros valores que sejam cobrados pelo CONTRATADO.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. Até o 25° (vigésimo quinto) dia do mês subsequente à prestação dos serviços, a CONTRATANTE providenciará o pagamento da CONTRATADA, desde que cumpridas todo o escopo de entregas previstas no presente instrumento contratual.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. Até o 10° (décimo) dia anterior à data de pagamento e condicionado à plena constatação de cumprimento das entregas previstas, o CONTRATADO deverá emitir a competente Nota Fiscal, remetendo-a imediatamente à CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quarto. O CONTRATADO será o único responsável pelo pagamento de eventuais valores devidos a terceiros por si SUBCONTRATADOS, não subsistindo nenhuma obrigação da CONTRATANTE para com terceiros neste sentido, tampouco de pagamento de qualquer outra importância à definida neste CONTRATO.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quinto. Caso em determinado exercício mensal haja a interrupção ou suspensão na prestação dos serviços, o pagamento será feito de modo proporcional ao período de efetiva execução das tarefas.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Sexto. O recolhimento dos tributos incidentes sobre os Serviços, assim como o cumprimento das correspondentes obrigações tributárias acessórias, são de exclusiva responsabilidade da CONTRATADA, exceto nas hipóteses em que a CONTRATANTE deva, em razão de disposição legal, promover a retenção dos valores a serem pagos ao Fisco (Municipal, Estadual ou Federal).', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Sétimo. O comprovante de depósito ou transferência servirá como recibo e prova de quitação e pagamento da obrigação ajustada.', j);
    doc.moveDown(0.4);

    // CLÁUSULA QUARTA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA QUARTA – DAS OBRIGAÇÕES DA CONTRATADA');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('4.1 - São obrigações da CONTRATADA:', j);
    doc.moveDown(0.2);
    doc.text('4.2. A CONTRATADA executará os serviços com plena autonomia técnica, operacional e organizacional, competindo-lhe definir os métodos, ferramentas, rotinas e estratégias de trabalho necessários à execução do objeto contratado. As diretrizes eventualmente fornecidas pela CONTRATANTE terão caráter meramente orientativo quanto aos objetivos do projeto, não configurando subordinação hierárquica ou poder diretivo sobre a CONTRATADA.', j);
    doc.moveDown(0.2);
    doc.text('4.3. Fornecer as notas fiscais referentes aos pagamentos efetuados pela CONTRATANTE dentro do prazo previamente estipulado por meio do presente instrumento;', j);
    doc.moveDown(0.2);
    doc.text('4.4. Arcar com todas as despesas de natureza tributária decorrentes dos serviços especificados neste contrato;', j);
    doc.moveDown(0.2);
    doc.text('4.5. Cumprir o escopo, os prazos, os entregáveis e os requisitos técnicos acordados entre as partes para a execução do objeto, preservada a autonomia técnica e operacional da CONTRATADA quanto aos meios e métodos empregados.', j);
    doc.moveDown(0.2);
    doc.text('4.6. Manter sob estrito sigilo todas as informações e dados recebidos ou a que tiver acesso em razão da execução do projeto objeto deste contrato, comprometendo-se a não divulgá-los, reproduzi-los ou utilizá-los para finalidade diversa daquela prevista neste instrumento, obrigação que subsistirá mesmo após o término ou rescisão contratual, pelo prazo de 5 (cinco) anos, abrangendo quaisquer informações confidenciais ou privilegiadas, de natureza técnica, comercial, estratégica ou de qualquer outra espécie.', j);
    doc.moveDown(0.2);
    doc.text('4.7. A eventual disponibilização de equipamentos pela CONTRATANTE ocorrerá exclusivamente por razões de segurança da informação, padronização tecnológica e proteção de dados corporativos, não implicando integração da CONTRATADA à estrutura organizacional da CONTRATANTE, onde tal disponibilização não descaracteriza a autonomia empresarial da CONTRATADA, que permanece responsável pela organização de seus próprios meios de trabalho.', j);
    doc.moveDown(0.2);
    doc.text('4.8. A CONTRATANTE poderá, a qualquer tempo, realizar auditorias técnicas e de segurança da informação nos equipamentos disponibilizados em comodato, inclusive mediante acesso administrativo, exclusivamente para fins de proteção de dados, integridade de sistemas, prevenção de incidentes e verificação de conformidade com as políticas internas aplicáveis.', j);
    doc.moveDown(0.2);
    doc.text('4.9. A CONTRATADA compromete-se a observar os critérios técnicos e requisitos de qualidade previamente acordados entre as partes para fins de aceite dos entregáveis, podendo a CONTRATANTE recusar, fundamentadamente, materiais que não atendam ao escopo, às especificações e aos critérios de qualidade pactuados.', j);
    doc.moveDown(0.2);
    doc.text('4.10. A CONTRATADA compromete-se a não praticar qualquer ato que possa prejudicar a imagem, reputação ou credibilidade da CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. O envolvimento da CONTRATADA em situação que gere repercussão negativa relevante autoriza a rescisão imediata do contrato, sem ônus para a CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. Os documentos pertencentes ou em posse da empresa contratante depositados em mídias físicas ou digitais somente devem ser abertos e tratados em computadores credenciados e de propriedade da CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. Sobre os computadores e demais equipamentos fornecidos para a prestação dos serviços não devem ser instalados programas alheios sem a autorização da CONTRATANTE.', j);
    doc.moveDown(0.4);

    // CLÁUSULA QUINTA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA QUINTA – DAS OBRIGAÇÕES DA CONTRATANTE');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('5.1. Sem prejuízo das demais obrigações expressamente ajustadas neste Contrato, a CONTRATANTE se obriga a:', j);
    doc.moveDown(0.2);
    doc.text('5.2. A CONTRATANTE poderá fornecer informações estratégicas, objetivos comerciais ou parâmetros gerais relacionados ao escopo do projeto, os quais servirão exclusivamente como referência para o desenvolvimento das atividades pela CONTRATADA, preservada sua plena autonomia técnica e operacional.', j);
    doc.moveDown(0.2);
    doc.text('5.3. Efetuar o pagamento, nas datas e nos termos definidos neste contrato;', j);
    doc.moveDown(0.2);
    doc.text('5.4. Manifestar, de forma expressa, eventuais críticas, dúvidas, solicitações, novas orientações e sugestões pertinentes aos serviços, quando existirem;', j);
    doc.moveDown(0.4);

    // CLÁUSULA SEXTA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA SEXTA – DA RESCISÃO E EXTINÇÃO DO CONTRATO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('6.1. A CONTRATANTE poderá, a seu exclusivo critério e independentemente de apresentação de justificativa, resilir unilateralmente o presente contrato a qualquer tempo, produzindo a rescisão efeitos imediatos a partir do recebimento da informação, sem que disso decorra qualquer direito a indenização, multa, compensação financeira ou ressarcimento em favor da CONTRATADA, ressalvado apenas o pagamento proporcional dos serviços comprovadamente prestados até a data da efetiva extinção contratual.', j);
    doc.moveDown(0.15);
    doc.text('6.2. Rescindido o contrato, a CONTRATADA deverá, no prazo máximo de 48 (quarenta e oito) horas, devolver todos os bens, documentos, mídias, credenciais e acessos disponibilizados, bem como realizar a transferência organizada de informações necessárias à continuidade do projeto.', j);
    doc.moveDown(0.15);
    doc.text('§1º. No mesmo prazo, a CONTRATADA deverá (i) cessar imediatamente o uso de quaisquer credenciais, acessos e ambientes da CONTRATANTE; (ii) eliminar, de forma segura, quaisquer cópias de dados, informações e materiais da CONTRATANTE eventualmente mantidos fora dos ambientes autorizados; e (iii) fornecer declaração escrita de devolução/eliminação, sem prejuízo de auditoria.', j);
    doc.moveDown(0.15);
    doc.text('§2º. A CONTRATANTE poderá reter e compensar valores eventualmente devidos à CONTRATADA com quaisquer prejuízos comprovados, multas contratuais, custos de reparação/substituição de equipamentos e valores decorrentes do descumprimento de obrigações estipuladas no presente contrato.', j);
    doc.moveDown(0.15);
    doc.text('§3º. Fica expressamente pactuado que a CONTRATADA não fará jus a qualquer indenização por expectativa de renovação, continuidade, descontinuidade do projeto, investimentos realizados, perdas e danos indiretos ou lucros cessantes.', j);
    doc.moveDown(0.15);
    doc.text('6.2. Sem prejuízo das demais hipóteses previstas neste contrato ou na legislação aplicável, constituem motivos suficientes para a rescisão imediata do presente instrumento, independentemente de aviso prévio ou indenização à CONTRATADA:', j);
    doc.moveDown(0.2);
    doc.text('I – a execução inadequada, negligente ou tecnicamente deficiente dos serviços contratados;', j);
    doc.text('II – o descumprimento de prazos, entregas ou requisitos/critério de qualidade pactuados entre as partes;', j);
    doc.text('III – a violação das obrigações de confidencialidade, proteção de dados, propriedade intelectual ou segurança da informação;', j);
    doc.text('IV – a prática de condutas que possam comprometer, direta ou indiretamente, a reputação, a imagem institucional ou a credibilidade da CONTRATANTE perante terceiros;', j);
    doc.text('V – a prática de atos contrários à boa-fé objetiva, à lealdade contratual e aos deveres de cooperação inerentes às relações empresariais.', j);
    doc.moveDown(0.15);
    doc.text('6.3 A extinção do presente contrato, por qualquer motivo, não afetará a validade ou exigibilidade das obrigações que, por sua natureza, devam subsistir após o término da relação contratual, especialmente aquelas relativas à confidencialidade, propriedade intelectual, proteção de dados e não aliciamento.', j);
    doc.moveDown(0.4);

    // CLÁUSULA SÉTIMA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA SÉTIMA – DA INEXISTÊNCIA DE VÍNCULO TRABALHISTA E SOCIETÁRIO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('7.1. As partes reconhecem expressamente que a presente contratação possui natureza estritamente civil e empresarial, regida pelas disposições do Código Civil, inexistindo entre as partes qualquer relação de emprego ou vínculo trabalhista.', j);
    doc.moveDown(0.15);
    doc.text('7.2. A CONTRATADA exerce atividade empresarial própria, assumindo integralmente os riscos de sua atividade econômica, nos termos do art. 966 do Código Civil, inexistindo entre as partes quaisquer dos elementos caracterizadores da relação de emprego previstos no art. 3º da Consolidação das Leis do Trabalho, de modo que a CONTRATADA estabelecerá e concretizará a forma de realização dos serviços pactuados no presente termo.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. O CONTRATADO tem ciência e declara que nenhum ex-empregado da CONTRATANTE cujo contrato de trabalho tenha se encerrado há menos de 18 (dezoito) meses poderá ser alocado pelo CONTRATADO na prestação dos serviços.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. O CONTRATADO tem ciência e declara que tem capacidade técnico-financeira para arcar com suas responsabilidades contratuais e extracontratuais, vinculada ou não a este contrato, e que não possui nem se colocará em situação de dependência econômica com relação ao resultado financeiro deste contrato.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. O CONTRATADO declara assumir integralmente os riscos relacionados à atividade empresarial que exerce, inclusive quanto à gestão de sua equipe, métodos de trabalho, investimentos necessários e responsabilidade pelos resultados.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quarto. O CONTRATADO tem ciência e declara que nada neste contrato poderá ser interpretado como tendo as partes, estabelecido qualquer forma de sociedade, associação, agência ou consórcio, de fato ou de direito, permanecendo cada uma das partes com as suas obrigações civis, comerciais, trabalhistas e tributárias, de forma autônoma.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quinto. A execução dos serviços ocorrerá com plena autonomia técnica, organizacional e econômica da CONTRATADA, inexistindo controle de jornada, subordinação hierárquica ou exclusividade.', j);
    doc.moveDown(0.4);

    // CLÁUSULA OITAVA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA OITAVA – DA CONFIDENCIALIDADE');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('8.1 - As partes concordam que, sem o consentimento escrito, não poderão revelar ou divulgar, direta ou indiretamente, no todo ou em parte, isolada ou juntamente com terceiros, qualquer informação confidencial referente ao presente contrato, o que inclui, mas não se limita a: todos e quaisquer dados, relatórios, análises, estudos, pesquisas, interpretações, previsões / estimativas, registros, materiais e quaisquer outros elementos que contenham informações referentes à outra Parte. As disposições desta cláusula sobreviverão após o prazo de 05 (cinco) anos posteriores à vigência deste contrato ou à rescisão do mesmo por qualquer razão.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. Para os propósitos, serão consideradas "informações confidenciais" todas e quaisquer informações e/ou dados de natureza confidencial (incluindo, sem limitação, os termos e condições deste contrato e todos os segredos e/ou informações operacionais, econômicas e técnicas, bem como demais informações comerciais ou "know-how") que tenham sido direta ou indiretamente fornecidos ou divulgados por uma das partes à outra sob ou em função deste contrato, incluindo-se as informações de natureza comercial e os Contratos celebrados com terceiros para a comercialização dos produtos e serviços, mesmo as obtidas durante as negociações precedentes à formalização deste instrumento.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. Caso a CONTRATADA venha a ser legalmente obrigada, por determinação judicial ou de autoridade administrativa competente, a revelar qualquer Informação Confidencial relacionada à CONTRATANTE, deverá comunicar formalmente à CONTRATANTE, por escrito e com a maior brevidade possível, acerca da referida exigência, fornecendo cópia da ordem recebida e todas as informações pertinentes, a fim de que a CONTRATANTE possa adotar as medidas judiciais ou administrativas cabíveis à preservação de seus direitos.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo único. A CONTRATADA limitar-se-á a revelar exclusivamente as informações estritamente exigidas pela autoridade competente, envidando seus melhores esforços para resguardar o caráter confidencial dos dados divulgados.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. A CONTRATADA não poderá, em nenhuma hipótese, fazer qualquer outro uso, realizar qualquer outro negócio ou celebrar qualquer outro contrato relacionado, direta ou indiretamente, às Informações Confidenciais.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quarto. Todas as Informações Confidenciais devem ser mantidas e tratadas como estritamente confidenciais e não poderão ser reveladas a qualquer terceiro, de forma alguma, no todo ou em parte, bem como não poderão ser utilizadas para qualquer finalidade que não esteja única e exclusivamente relacionada aos Serviços.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quinto. Sem prejuízo de outras obrigações, a CONTRATADA se compromete desde logo a:', j);
    doc.text('1. Não divulgar quaisquer Informações Confidenciais a quaisquer terceiros;', j);
    doc.text('2. Utilizar quaisquer Informações Confidenciais exclusivamente para a execução da prestação dos serviços;', j);
    doc.text('3. Não analisar, providenciar análise, derivar ou sintetizar qualquer informação recebida da CONTRATANTE sem autorização prévia e fora dos limites da execução de seu trabalho.', j);
    doc.moveDown(0.15);
    doc.text('8.2. A CONTRATADA, por si e por quaisquer profissionais por ela alocados, será responsável por quaisquer danos causados à CONTRATANTE ou a terceiros em decorrência do descumprimento das obrigações de sigilo previstas nesta cláusula, independentemente de dolo ou culpa.', j);
    doc.moveDown(0.15);
    doc.text('8.3. O descumprimento das obrigações de confidencialidade ensejará a obrigação de indenizar integralmente os danos comprovadamente sofridos pela parte prejudicada, sem prejuízo das demais medidas judiciais cabíveis.', j);
    doc.moveDown(0.15);
    doc.text('8.4. A CONTRATADA reconhece que a violação das obrigações de confidencialidade e segurança da informação poderá causar dano de difícil reparação, razão pela qual a CONTRATANTE poderá pleitear tutela específica/inibitória e medidas de urgência para cessação do ilícito, sem prejuízo de perdas e danos.', j);
    doc.moveDown(0.4);

    // CLÁUSULA NONA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA NONA – DA INEXISTÊNCIA DE LICENÇAS');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('9.1. A CONTRATANTE reterá todo o direito, titularidade e interesse sobre as informações confidenciais presentes no presente contrato.', j);
    doc.moveDown(0.15);
    doc.text('9.2. Nada contido neste CONTRATO, nem a revelação de Informações Confidenciais, deverá ser interpretado como cessão ou transferência de quaisquer direitos, por meio de licença ou de qualquer outra forma, referente a marcas, patentes, direitos autorais, informações tecnológicas, segredos comerciais e/ou industriais, ou outras Informações Confidenciais, ou qualquer outra propriedade intelectual, sendo certo que a CONTRATANTE permanecerá como única proprietária das Informações Confidenciais.', j);
    doc.moveDown(0.15);
    doc.text('9.3. São e serão considerados como propriedade intelectual e/ou industrial única e exclusiva da CONTRATANTE qualquer produto, criação, desenvolvimento, relatório, planilha, resultado, dentre outros, ainda que tenham sido desenvolvidos pela CONTRATADA. Nenhum direito de propriedade intelectual e/ou industrial será detido pela CONTRATADA, a qual, expressamente, cede e transfere à CONTRATANTE, desde logo, não onerosamente, todo e qualquer direito relacionado ou derivado a qualquer espécie de criação decorrente do relacionamento entre as Partes.', j);
    doc.moveDown(0.15);
    doc.text('9.4. Não assiste à CONTRATADA qualquer direito ou expectativa de direito de propriedade intelectual e/ou industrial ou de qualquer direito imaterial, tampouco lhe assiste qualquer direito de postular ou formular qualquer reivindicação.', j);
    doc.moveDown(0.15);
    doc.text('9.5. A CONTRATADA expressamente declara que todo e qualquer valor a título de eventuais direitos sobre propriedade intelectual e/ou industrial, direitos autorais ou qualquer espécie de direitos imateriais, já foi considerada pelas Partes na fixação do Preço (contraprestação), razão pela qual nenhuma quantia poderá ser reclamada, a qualquer título, pela CONTRATADA.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA – DA ABSTENÇÃO DE ALICIAMENTO E INDUÇÃO DE TERCEIROS VINCULADOS À CONTRATANTE');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('10.1. Durante a vigência deste instrumento e por um período de 24 (vinte e quatro) meses após sua extinção, o CONTRATADO se compromete a não contratar, ou tentar contratar, direta ou indiretamente, qualquer empregado(a) da CONTRATANTE ou de qualquer outra empresa do grupo no Brasil ou no exterior, para trabalhar para seu novo empregador ou empresa da qual seja, direta ou indiretamente, ligado, inclusive como sócio.', j);
    doc.moveDown(0.15);
    doc.text('10.1.1. Durante o período mencionado na Cláusula Segunda e pelo mesmo prazo de 02 (dois) anos contados da rescisão do contrato, o CONTRATADO também se compromete a não ajudar terceiros a contratar empregados(as) da CONTRATANTE ou de outra empresa do grupo, tampouco a induzir ou convencer qualquer empregado(a) da CONTRATANTE a rescindir o contrato que mantém com a CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('10.2. O CONTRATADO, também neste ato, de forma irrevogável e irretratável, se compromete perante a CONTRATANTE a abster-se, durante a vigência do presente e pelo período de 03 (três) anos contados da rescisão contratual de direta ou indiretamente, aliciar, induzir, convidar, contratar, nem determinar que seja aliciado, induzido ou convidado:', j);
    doc.moveDown(0.2);
    doc.text('(i) Qualquer cliente atendido e/ou captado pela CONTRATANTE ou pelo CONTRATADO durante a prestação de seus serviços para que tal cliente seja atendido por outra personalidade jurídica concorrente da TURBO;', j);
    doc.text('(ii) Qualquer empregado, sócio, diretor ou outro prestador de serviços da TURBO e/ou qualquer de suas afiliadas;', j);
    doc.text('(iii) Qualquer pessoa a deixar de fazer negócios com a TURBO e/ou qualquer de suas afiliadas;', j);
    doc.text('(iv) Qualquer fornecedor ou cliente da TURBO a deixar de realizar ou diminuir os negócios realizados com a CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.font('Helvetica-Bold').text('10.3. Sem prejuízo das indenizações por perdas e danos e da responsabilidade criminal, o CONTRATADO, em caso de infração da presente cláusula, pagará ao CONTRATANTE uma multa não compensatória igual a R$ 100.000,00 (cem mil reais) por cada infração.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA PRIMEIRA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA PRIMEIRA – DA PROTEÇÃO DE DADOS PESSOAIS');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('11.1. Seguindo as determinações da Lei 13.709/2018 ("Lei Geral de Proteção de Dados Pessoais") o CONTRATADO se compromete a manter segredo absoluto dos assuntos relacionados aos serviços prestados, bem como de todos os dados e informações relativos aos resultados obtidos na prestação do serviço, comprometendo-se a: não utilizar as informações confidenciais a que tiver acesso pelo período de 05 (cinco) anos, para gerar benefício próprio exclusivo e/ou unilateral, presente ou futuro, ou para o uso de terceiros; não efetuar nenhuma gravação ou cópia da documentação confidencial a que tiver acesso; não apropriar-se para si ou para outrem de material confidencial e/ou sigiloso da tecnologia que venha a ser disponível e; não repassar o conhecimento das informações confidenciais, responsabilizando-se por todas as pessoas que vierem a ter acesso às informações, por seu intermédio, e obrigando-se, assim, a reparar a ocorrência de qualquer dano e/ou prejuízo oriundo de uma eventual quebra de sigilo das informações fornecidas.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. As partes se comprometem a não utilizar os dados pessoais que tiverem acesso para fins distintos da relação estabelecida, sendo vedada a transmissão para terceiros.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. As partes se comprometem em manter os compromissos acima, mesmo após o término da relação contratual.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. As partes declaram que qualquer conduta incompatível com as disposições acima será considerada uma grave violação deste contrato e será considerado motivo de justa causa para a rescisão imediata, sem prejuízo da adoção das medidas legalmente cabíveis.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA SEGUNDA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA SEGUNDA – DO USO E RESPONSABILIDADE PELOS EQUIPAMENTOS FORNECIDOS PELA CONTRATANTE');
    doc.moveDown(0.15);
    const patrimonioDescricao = patrimonio || 'a definir';
    doc.font('Helvetica').fontSize(8.5).text(`12.1. A CONTRATANTE disponibilizará, em regime de comodato, exclusivamente por razões de segurança da informação, padronização tecnológica e proteção de dados corporativos, um computador MacBook modelo ${patrimonioDescricao}, um Fone Logitech H390, Mouse Logitech Bluetooth e um Adaptador Hub USB-C HDMI com ao menos 2 entradas USB-A, de sua propriedade, para uso exclusivo da CONTRATADA na execução dos serviços contratados neste instrumento.`, j);
    doc.moveDown(0.15);
    doc.text('12.2. A CONTRATADA compromete-se a zelar pelo bom estado de conservação, uso adequado e exclusivo do equipamento disponibilizado, abstendo-se de utilizá-lo para fins pessoais, atividades não relacionadas ao presente contrato, ou por terceiros.', j);
    doc.moveDown(0.15);
    doc.text('12.3. A CONTRATADA será responsável integral por qualquer dano, perda, extravio, furto, roubo ou mau uso do equipamento, independentemente de culpa, obrigando-se a arcar com os custos de reparação ou substituição integral do bem, conforme orçamento técnico indicado pela CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('12.4. Em caso de dano parcial, a CONTRATADA deverá restituir à CONTRATANTE o valor referente ao reparo, no prazo máximo de 30 (trinta) dias após a notificação escrita.', j);
    doc.moveDown(0.15);
    doc.text('12.5. Em caso de perda total, extravio, furto ou roubo, a CONTRATADA deverá indenizar a CONTRATANTE com base no valor de mercado atualizado do bem à época do evento, conforme cotação de revendedor autorizado ou nota fiscal de aquisição, o que for mais benéfico à CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('12.6. O equipamento deverá ser devolvido à CONTRATANTE no ato de rescisão do contrato, em perfeito estado de funcionamento e conservação, ressalvado o desgaste natural decorrente do uso regular.', j);
    doc.moveDown(0.15);
    doc.text('12.7. A CONTRATANTE poderá, a qualquer tempo, solicitar a devolução imediata do equipamento, cabendo à CONTRATADA o cumprimento imediato da solicitação.', j);
    doc.moveDown(0.15);
    doc.text('12.8. O inadimplemento das obrigações previstas nesta cláusula autoriza a CONTRATANTE a reter valores devidos à CONTRATADA até o limite da indenização cabível e/ou de quaisquer multas e perdas e danos decorrentes do descumprimento contratual, sem prejuízo das demais medidas.', j);
    doc.moveDown(0.15);
    doc.text('12.9. A CONTRATANTE poderá realizar auditorias técnicas no equipamento disponibilizado, a qualquer tempo.', j);
    doc.moveDown(0.15);
    doc.text('12.10. O não cumprimento da obrigação de devolução dos equipamentos no prazo estipulado neste contrato sujeitará a CONTRATADA ao pagamento de multa diária de R$ 500,00 (quinhentos reais), a partir do primeiro dia de atraso, até a efetiva restituição dos bens à CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo único. A multa prevista nesta cláusula possui natureza moratória, não substituindo a obrigação de devolução dos equipamentos, nem afastando o direito da CONTRATANTE de exigir o pagamento do valor de reposição do bem ou a reparação de eventuais perdas e danos.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA TERCEIRA - DIREITO DE USO DE IMAGEM
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA TERCEIRA – DO DIREITO DE USO DE IMAGEM');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('13. O CONTRATADO autoriza, de forma livre, expressa, irrevogável e irretratável, a utilização de sua imagem, nome e voz pela CONTRATANTE, para fins institucionais, comerciais e publicitários relacionados ou não ao objeto deste contrato, em quaisquer meios físicos ou digitais, sem limitação territorial ou temporal, inclusive após o término da relação contratual, sem que disso decorra direito a remuneração adicional.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo único. A utilização ora autorizada não implica exclusividade, vínculo empregatício ou societário, comprometendo-se a CONTRATANTE a utilizar a imagem do CONTRATADO de forma ética e compatível com a finalidade profissional pactuada.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA QUARTA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA QUARTA – DAS DISPOSIÇÕES GERAIS');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('14.1. Este Contrato constitui o entendimento integral e completo entre as partes, substituindo todos os entendimentos, compromissos, negociações, acordos e contratos anteriores, sejam eles verbais ou escritos, relativos ao objeto deste Contrato. Qualquer modificação ou emenda a este Contrato só será válida se formalizada por escrito e assinada pelos representantes legais de ambas as partes.', j);
    doc.moveDown(0.15);
    doc.text('14.2. As partes reconhecem que a nulidade ou inexequibilidade de qualquer disposição deste Contrato não afetará a validade ou exequibilidade das demais disposições, que continuarão em pleno vigor e efeito. Caso qualquer disposição deste Contrato seja considerada inválida, ilegal ou inexequível, as partes negociarão de boa-fé para substituí-la por uma disposição que, na máxima extensão permitida por lei, preserve a intenção original da disposição inválida, ilegal ou inexequível.', j);
    doc.moveDown(0.15);
    doc.text('14.3. A CONTRATADA responderá integralmente por quaisquer danos, prejuízos ou responsabilidades decorrentes de atos praticados por si, por seus sócios, empregados, prepostos, colaboradores ou subcontratados no âmbito da execução dos serviços objeto deste contrato.', j);
    doc.moveDown(0.15);
    doc.text('14.4. Não se estabelece, por força deste instrumento, qualquer forma de sociedade, associação, agência, consórcio, participação societária, ou responsabilidade solidária entre as partes.', j);
    doc.moveDown(0.15);
    doc.text('14.5. O objeto deste contrato não visa proporcionar nenhuma espécie de vantagem fiscal, trabalhista ou previdenciária a qualquer Parte ou a terceiros, e não implica vínculo empregatício entre uma das partes e os funcionários/prepostos da outra, ficando a cargo de cada uma delas a responsabilidade referente aos encargos sociais, tributários, previdenciários e trabalhistas de seus respectivos colaboradores.', j);
    doc.moveDown(0.15);
    doc.text('14.6. Os tributos (impostos, taxas, emolumentos, contribuições fiscais e parafiscais) que sejam devidos em decorrência direta ou indireta do presente contrato ou de sua execução, serão de exclusiva responsabilidade do contribuinte, conforme definido na norma tributária, autorizadas as retenções legais, sem direito a reembolso.', j);
    doc.moveDown(0.15);
    doc.text('14.7. O presente CONTRATO é o instrumento que regula todos os direitos e obrigações acordadas entre as Partes, substituindo todo e qualquer CONTRATO ou entendimento previamente realizado pelas Partes.', j);
    doc.moveDown(0.15);
    doc.text('14.8. Na hipótese de qualquer autuação, fiscalização, imposição de multa, desenquadramento ou fixação de qualquer outra sanção, de qualquer natureza, em desfavor da CONTRATADA, em especial em matéria cível, tributária ou trabalhista, nenhuma responsabilidade incumbirá à CONTRATANTE, a qual fica desobrigada de qualquer pagamento ou assunção de despesas, sendo de rigor, ao revés, a obrigação de a CONTRATADA indenizar a CONTRATANTE por eventuais prejuízos decorrentes de tais eventos.', j);
    doc.moveDown(0.15);
    doc.text('14.9. Durante a vigência deste contrato, a CONTRATADA compromete-se a não utilizar informações estratégicas, dados comerciais, metodologias, modelos de negócio, bases de dados ou qualquer outro ativo intelectual da CONTRATANTE em benefício próprio ou de terceiros, especialmente para atuação concorrente ou potencialmente prejudicial aos interesses comerciais da CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('14.10. O presente contrato não estabelece exclusividade entre as partes, nem gera expectativa de renovação automática ou volume mínimo de demandas, de modo que em nenhuma hipótese a CONTRATANTE será responsável por lucros cessantes, danos indiretos ou perdas financeiras da CONTRATADA.', j);
    doc.moveDown(0.15);
    doc.text('14.11. Declaram as Partes que as obrigações aqui presentes são celebradas de boa-fé, livremente e de comum acordo, não existindo quaisquer vícios ou defeitos que possam acarretar a sua nulidade, em especial aqueles relacionados com dolo, erro, fraude, simulação ou coação, inexistindo também qualquer fato que possa ser configurado como estado de perigo ou de necessidade.', j);
    doc.moveDown(0.15);
    doc.text('14.12. As partes reconhecem expressamente que o objeto do presente contrato não se vincula à atuação pessoal de qualquer indivíduo específico, inexistindo pessoalidade na prestação dos serviços, sendo a CONTRATADA integralmente responsável pela gestão de seus profissionais, colaboradores, empregados, prepostos ou subcontratados eventualmente envolvidos na execução do objeto contratual.', j);
    doc.moveDown(0.15);
    doc.text('14.13. Fica eleito o Foro da Comarca de Vitória/ES para nele serem dirimidas eventuais dúvidas ou questões oriundas deste contrato.', j);
    doc.moveDown(0.5);

    doc.text('As Partes neste ato declaram que (i) é admitida como válida e verdadeira a assinatura deste Contrato por meio de certificado digital emitido por entidades credenciadas para tanto pela Infraestrutura de Chaves Públicas Brasileira - ICP-Brasil; e (ii) são admitidas como válidas e originais as vias deste Contrato emitidas por meios de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil.', j);
    doc.moveDown(0.3);
    doc.text('E assim, por estarem justas e CONTRATADAS, as partes assinam este presente contrato em 2 (duas) vias de igual teor, na presença das testemunhas abaixo.', j);
    doc.moveDown(1);

    // Assinaturas
    doc.fontSize(9).text(`Vitória, ${dataAtual}.`, j);
    doc.moveDown(1.5);
    doc.text('____________________________________________________', { align: 'center' });
    doc.font('Helvetica-Bold').text('TURBO PARTNERS LTDA', { align: 'center' });
    doc.moveDown(1.5);
    doc.text('____________________________________________________', { align: 'center' });
    doc.font('Helvetica-Bold').text(nome.toUpperCase(), { align: 'center' });

    doc.end();

    return pdfPromise;
  }

  // POST - Enviar contrato de colaborador para assinatura via Assinafy
  app.post("/api/juridico/colaboradores-contrato/:id/enviar-assinatura", async (req, res) => {
    const colaboradorId = parseInt(req.params.id);
    const startTime = Date.now();

    try {
      console.log(`[assinafy-colab] Iniciando envio para assinatura - Colaborador ID: ${colaboradorId}`);

      // 1. Buscar config e dados do colaborador em paralelo
      const [configResult, colaboradorResult] = await Promise.all([
        db.execute(sql`
          SELECT account_id, api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'colaboradores' LIMIT 1
        `),
        db.execute(sql`
          SELECT id, nome, cpf, cnpj, endereco, estado, cargo, setor, admissao::text as admissao,
                 COALESCE(email_pessoal, email_turbo) as email, salario
          FROM "Inhire".rh_pessoal
          WHERE id = ${colaboradorId}
        `)
      ]);

      if (configResult.rows.length === 0) {
        return res.status(500).json({ error: "Configuração do Assinafy para colaboradores não encontrada" });
      }
      if (colaboradorResult.rows.length === 0) {
        return res.status(404).json({ error: "Colaborador não encontrado" });
      }

      const config = configResult.rows[0] as { account_id: string; api_key: string; api_url: string };
      const colaborador = colaboradorResult.rows[0] as any;

      if (!colaborador.email) {
        return res.status(400).json({ error: "Colaborador não possui email cadastrado. Cadastre o email antes de enviar para assinatura." });
      }

      console.log(`[assinafy-colab] Signatário: ${colaborador.nome} (${colaborador.email}) [${Date.now() - startTime}ms]`);

      // 2. Buscar patrimônio e gerar PDF em paralelo
      const [patrimonioResult, FormDataModule] = await Promise.all([
        db.execute(sql`
          SELECT descricao FROM "Inhire".rh_patrimonio
          WHERE (responsavel_id = ${colaboradorId} OR responsavel_atual = ${colaborador.nome})
            AND (ativo ILIKE '%notebook%' OR ativo ILIKE '%macbook%' OR ativo ILIKE '%computador%' OR ativo ILIKE '%mac%' OR descricao ILIKE '%macbook%')
            AND descricao IS NOT NULL
          ORDER BY id DESC LIMIT 1
        `),
        import('form-data')
      ]);
      const patrimonio = (patrimonioResult.rows[0] as any)?.descricao || null;

      const pdfBuffer = await gerarContratoPDF({
        nome: colaborador.nome,
        cpf: colaborador.cpf,
        cnpj: colaborador.cnpj,
        endereco: colaborador.endereco,
        estado: colaborador.estado,
        cargo: colaborador.cargo,
        salario: colaborador.salario?.toString() || '0',
        patrimonio,
      });
      console.log(`[assinafy-colab] PDF gerado: ${pdfBuffer.length} bytes [${Date.now() - startTime}ms]`);

      // 3. Upload do PDF para Assinafy
      const FormData = FormDataModule.default;
      const formData = new FormData();
      formData.append('file', pdfBuffer, {
        filename: `contrato_colaborador_${colaboradorId}.pdf`,
        contentType: 'application/pdf'
      });

      const uploadUrl = `${config.api_url}/accounts/${config.account_id}/documents`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'X-Api-Key': config.api_key,
          ...formData.getHeaders()
        },
        body: formData.getBuffer()
      });

      const uploadResult = await uploadResponse.json() as any;

      if (uploadResult.status !== 200 && !uploadResult.id) {
        console.error('[assinafy-colab] Erro no upload:', uploadResult);
        return res.status(500).json({ error: "Erro ao fazer upload do documento", details: uploadResult.message });
      }

      const documentId = uploadResult.id || uploadResult.data?.id;
      console.log(`[assinafy-colab] Documento criado: ${documentId} [${Date.now() - startTime}ms]`);

      // 4. Buscar/criar signatários EM PARALELO com o polling do documento
      const signerUrl = `${config.api_url}/accounts/${config.account_id}/signers`;

      const sociosResponsaveis = [
        { nome: "Rodrigo Queiroz Santos", email: "rodrigo.queiroz@turbopartners.com.br" },
        { nome: "Victor Peixoto", email: "victor.peixoto@turbopartners.com.br" },
        { nome: "Julia Viana", email: "julia.viana@turbopartners.com.br" }
      ];

      const getOrCreateSigner = async (nome: string, email: string): Promise<string> => {
        const searchUrl = `${signerUrl}?search=${encodeURIComponent(email)}`;
        const searchResponse = await fetch(searchUrl, {
          method: 'GET',
          headers: { 'X-Api-Key': config.api_key }
        });

        const searchResult = await searchResponse.json() as any;

        if (searchResult.status === 200 && searchResult.data && Array.isArray(searchResult.data)) {
          const existingSigner = searchResult.data.find((s: any) =>
            s.email?.toLowerCase() === email.toLowerCase()
          );
          if (existingSigner) return existingSigner.id;
        }

        const signerResponse = await fetch(signerUrl, {
          method: 'POST',
          headers: {
            'X-Api-Key': config.api_key,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ full_name: nome, email: email })
        });

        const signerResult = await signerResponse.json() as any;
        return signerResult.data?.id || signerResult.id;
      };

      // Polling do documento e busca de signatários rodam em paralelo
      const waitForDocument = async (): Promise<boolean> => {
        const statusUrl = `${config.api_url}/documents/${documentId}`;
        for (let attempt = 1; attempt <= 30; attempt++) {
          const statusResponse = await fetch(statusUrl, {
            method: 'GET',
            headers: { 'X-Api-Key': config.api_key }
          });
          const statusResult = await statusResponse.json() as any;
          const currentStatus = statusResult.data?.status || statusResult.status;

          if (attempt === 1 || attempt % 5 === 0) {
            console.log(`[assinafy-colab] Status (tentativa ${attempt}/30): ${currentStatus} [${Date.now() - startTime}ms]`);
          }

          if (currentStatus === 'metadata_ready') {
            console.log(`[assinafy-colab] Documento pronto! [${Date.now() - startTime}ms]`);
            return true;
          }

          if (currentStatus === 'failed' || currentStatus === 'error') {
            return false;
          }

          // Polling progressivo: 500ms nas primeiras 5, depois 1s
          await new Promise(resolve => setTimeout(resolve, attempt <= 5 ? 500 : 1000));
        }
        return false;
      };

      const [documentReady, signerIds] = await Promise.all([
        waitForDocument(),
        Promise.all([
          getOrCreateSigner(colaborador.nome, colaborador.email),
          ...sociosResponsaveis.map(s => getOrCreateSigner(s.nome, s.email))
        ])
      ]);

      console.log(`[assinafy-colab] Signatários: ${signerIds.join(', ')} [${Date.now() - startTime}ms]`);

      if (!documentReady) {
        return res.status(500).json({ error: "Documento não ficou pronto. Tente novamente.", documentId });
      }

      // 5. Enviar para assinatura
      const assignmentUrl = `${config.api_url}/documents/${documentId}/assignments`;
      const assignmentResponse = await fetch(assignmentUrl, {
        method: 'POST',
        headers: {
          'X-Api-Key': config.api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: 'virtual',
          signerIds: signerIds
        })
      });

      const assignmentResult = await assignmentResponse.json() as any;

      if (assignmentResult.status !== 200 && assignmentResult.status !== 201) {
        return res.status(500).json({ error: "Erro ao enviar para assinatura", details: assignmentResult.message });
      }

      // 6. Salvar status em paralelo com a resposta
      ensureContratosColabStatusTable().then(() =>
        db.execute(sql`
          INSERT INTO cortex_core.contratos_colaboradores_status
          (colaborador_id, colaborador_nome, colaborador_email, documento_id, status, data_envio)
          VALUES (${colaboradorId}, ${colaborador.nome}, ${colaborador.email}, ${documentId}, 'Enviado para assinatura', NOW())
        `)
      ).catch(err => console.error('[assinafy-colab] Erro ao salvar status:', err));

      const elapsed = Date.now() - startTime;
      console.log(`[assinafy-colab] Contrato enviado com sucesso em ${elapsed}ms`);

      res.json({
        success: true,
        documentId,
        emailEnviado: colaborador.email,
        message: "Contrato enviado para assinatura com sucesso"
      });

    } catch (error) {
      console.error("[assinafy-colab] Erro:", error);
      res.status(500).json({ error: "Erro ao enviar para assinatura" });
    }
  });

  // POST - Gerar PDF de contrato de colaborador (download direto)
  app.post("/api/juridico/colaboradores-contrato/pdf", async (req, res) => {
    try {
      const { nome, cpf, cnpj, endereco, estado, cargo, salario, patrimonio } = req.body;

      if (!nome) {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }

      const pdfBuffer = await gerarContratoPDF({ nome, cpf, cnpj, endereco, estado, cargo, salario: salario || '0', patrimonio });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Contrato_${nome.replace(/\s+/g, '_')}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("[api] Error generating contract PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });


  // ==================== JURÍDICO - Regras de Escalonamento ====================
  // Note: Table creation and seeding is handled by ensureEscalationRulesTable() above

  // GET escalation rules
  app.get("/api/juridico/regras-escalonamento", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, 
          dias_atraso_min as "diasAtrasoMin", 
          dias_atraso_max as "diasAtrasoMax", 
          procedimento_sugerido as "procedimentoSugerido", 
          prioridade, 
          ativo, 
          created_at as "createdAt"
        FROM juridico_regras_escalonamento
        WHERE ativo = true
        ORDER BY prioridade ASC
      `);
      
      res.json({ regras: result.rows });
    } catch (error) {
      console.error("[api] Error fetching escalation rules:", error);
      res.status(500).json({ error: "Failed to fetch escalation rules" });
    }
  });

  // ==================== JURÍDICO - Processos Judiciais ====================

  let juridicoProcessosTableInitialized = false;
  async function ensureJuridicoProcessosTable() {
    if (juridicoProcessosTableInitialized) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.juridico_processos (
          id SERIAL PRIMARY KEY,
          numero_cnj VARCHAR(50) UNIQUE,
          cliente_principal VARCHAR(255),
          posicao_cliente VARCHAR(50),
          acao TEXT,
          status VARCHAR(30) DEFAULT 'Ativo',
          contrario_principal VARCHAR(255),
          cpf_cnpj VARCHAR(20),
          objetos_acao TEXT,
          data_distribuicao DATE,
          instancia VARCHAR(30),
          comarca VARCHAR(100),
          orgao VARCHAR(100),
          vara_turma VARCHAR(100),
          natureza_acao VARCHAR(50),
          valor_causa DECIMAL(15,2),
          sentenca_acordao TEXT,
          ultimo_andamento TEXT,
          observacoes TEXT,
          criado_em TIMESTAMP DEFAULT NOW(),
          atualizado_em TIMESTAMP DEFAULT NOW(),
          criado_por VARCHAR(100)
        )
      `);
      juridicoProcessosTableInitialized = true;
    } catch (error) {
      console.error("[api] Error ensuring juridico_processos table:", error);
    }
  }

  // GET - Resumo/KPIs dos processos
  app.get("/api/juridico/processos/resumo", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();

      const result = await db.execute(sql`
        SELECT
          COUNT(*)::int as "totalProcessos",
          COUNT(*) FILTER (WHERE status = 'Ativo')::int as "processosAtivos",
          COALESCE(SUM(valor_causa), 0)::numeric as "valorTotalRisco",
          COALESCE(SUM(valor_causa) FILTER (WHERE status = 'Ativo'), 0)::numeric as "valorRiscoAtivo"
        FROM cortex_core.juridico_processos
      `);

      const porNatureza = await db.execute(sql`
        SELECT
          COALESCE(natureza_acao, 'Não informado') as "natureza",
          COUNT(*)::int as "quantidade",
          COALESCE(SUM(valor_causa), 0)::numeric as "valor"
        FROM cortex_core.juridico_processos
        GROUP BY natureza_acao
        ORDER BY COUNT(*) DESC
      `);

      const porStatus = await db.execute(sql`
        SELECT
          COALESCE(status, 'Não informado') as "status",
          COUNT(*)::int as "quantidade"
        FROM cortex_core.juridico_processos
        GROUP BY status
        ORDER BY COUNT(*) DESC
      `);

      const porPosicao = await db.execute(sql`
        SELECT
          COALESCE(posicao_cliente, 'Não informado') as "posicao",
          COUNT(*)::int as "quantidade"
        FROM cortex_core.juridico_processos
        GROUP BY posicao_cliente
        ORDER BY COUNT(*) DESC
      `);

      const porComarca = await db.execute(sql`
        SELECT
          COALESCE(comarca, 'Não informado') as "comarca",
          COUNT(*)::int as "quantidade"
        FROM cortex_core.juridico_processos
        GROUP BY comarca
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `);

      const evolucaoMensal = await db.execute(sql`
        SELECT
          TO_CHAR(data_distribuicao, 'YYYY-MM') as "mes",
          TO_CHAR(data_distribuicao, 'Mon/YY') as "mesLabel",
          COUNT(*)::int as "quantidade"
        FROM cortex_core.juridico_processos
        WHERE data_distribuicao IS NOT NULL
        GROUP BY TO_CHAR(data_distribuicao, 'YYYY-MM'), TO_CHAR(data_distribuicao, 'Mon/YY')
        ORDER BY TO_CHAR(data_distribuicao, 'YYYY-MM')
      `);

      const resumo = result.rows[0] || { totalProcessos: 0, processosAtivos: 0, valorTotalRisco: 0, valorRiscoAtivo: 0 };

      res.json({
        ...resumo,
        porNatureza: porNatureza.rows,
        porStatus: porStatus.rows,
        porPosicao: porPosicao.rows,
        porComarca: porComarca.rows,
        evolucaoMensal: evolucaoMensal.rows,
      });
    } catch (error) {
      console.error("[api] Error fetching processos resumo:", error);
      res.status(500).json({ error: "Failed to fetch processos summary" });
    }
  });

  // GET - Listar todos os processos com filtros
  app.get("/api/juridico/processos", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();

      const busca = req.query.busca as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const natureza = req.query.natureza as string | undefined;
      const posicao = req.query.posicao as string | undefined;

      const conditions: SQL[] = [];

      if (busca) {
        const pattern = `%${busca}%`;
        conditions.push(sql`(numero_cnj ILIKE ${pattern} OR cliente_principal ILIKE ${pattern} OR contrario_principal ILIKE ${pattern} OR acao ILIKE ${pattern})`);
      }
      if (statusFilter && statusFilter !== 'todos') {
        conditions.push(sql`status = ${statusFilter}`);
      }
      if (natureza && natureza !== 'todos') {
        conditions.push(sql`natureza_acao = ${natureza}`);
      }
      if (posicao && posicao !== 'todos') {
        conditions.push(sql`posicao_cliente = ${posicao}`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          id, numero_cnj as "numeroCnj", cliente_principal as "clientePrincipal",
          posicao_cliente as "posicaoCliente", acao, status,
          contrario_principal as "contrarioPrincipal", cpf_cnpj as "cpfCnpj",
          objetos_acao as "objetosAcao", data_distribuicao as "dataDistribuicao",
          instancia, comarca, orgao, vara_turma as "varaTurma",
          natureza_acao as "naturezaAcao", valor_causa as "valorCausa",
          sentenca_acordao as "sentencaAcordao", ultimo_andamento as "ultimoAndamento",
          observacoes, criado_em as "criadoEm", atualizado_em as "atualizadoEm",
          criado_por as "criadoPor"
        FROM cortex_core.juridico_processos
        ${whereClause}
        ORDER BY criado_em DESC
      `);
      res.json({ processos: result.rows });
    } catch (error) {
      console.error("[api] Error fetching processos:", error);
      res.status(500).json({ error: "Failed to fetch processos" });
    }
  });

  // POST - Criar novo processo
  app.post("/api/juridico/processos", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();
      const data = req.body;

      const result = await db.execute(sql`
        INSERT INTO cortex_core.juridico_processos (
          numero_cnj, cliente_principal, posicao_cliente, acao, status,
          contrario_principal, cpf_cnpj, objetos_acao, data_distribuicao,
          instancia, comarca, orgao, vara_turma, natureza_acao, valor_causa,
          sentenca_acordao, ultimo_andamento, observacoes, criado_por
        ) VALUES (
          ${data.numeroCnj || null}, ${data.clientePrincipal || null},
          ${data.posicaoCliente || null}, ${data.acao || null}, ${data.status || 'Ativo'},
          ${data.contrarioPrincipal || null}, ${data.cpfCnpj || null},
          ${data.objetosAcao || null}, ${data.dataDistribuicao || null},
          ${data.instancia || null}, ${data.comarca || null}, ${data.orgao || null},
          ${data.varaTurma || null}, ${data.naturezaAcao || null}, ${data.valorCausa || null},
          ${data.sentencaAcordao || null}, ${data.ultimoAndamento || null},
          ${data.observacoes || null}, ${data.criadoPor || null}
        )
        RETURNING id
      `);

      res.json({ success: true, id: (result.rows[0] as any)?.id });
    } catch (error) {
      console.error("[api] Error creating processo:", error);
      res.status(500).json({ error: "Failed to create processo" });
    }
  });

  // PUT - Atualizar processo existente
  app.put("/api/juridico/processos/:id", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();
      const { id } = req.params;
      const data = req.body;

      await db.execute(sql`
        UPDATE cortex_core.juridico_processos SET
          numero_cnj = ${data.numeroCnj || null},
          cliente_principal = ${data.clientePrincipal || null},
          posicao_cliente = ${data.posicaoCliente || null},
          acao = ${data.acao || null},
          status = ${data.status || 'Ativo'},
          contrario_principal = ${data.contrarioPrincipal || null},
          cpf_cnpj = ${data.cpfCnpj || null},
          objetos_acao = ${data.objetosAcao || null},
          data_distribuicao = ${data.dataDistribuicao || null},
          instancia = ${data.instancia || null},
          comarca = ${data.comarca || null},
          orgao = ${data.orgao || null},
          vara_turma = ${data.varaTurma || null},
          natureza_acao = ${data.naturezaAcao || null},
          valor_causa = ${data.valorCausa || null},
          sentenca_acordao = ${data.sentencaAcordao || null},
          ultimo_andamento = ${data.ultimoAndamento || null},
          observacoes = ${data.observacoes || null},
          atualizado_em = NOW()
        WHERE id = ${parseInt(id)}
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error updating processo:", error);
      res.status(500).json({ error: "Failed to update processo" });
    }
  });

  // DELETE - Excluir processo
  app.delete("/api/juridico/processos/:id", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();
      const { id } = req.params;

      await db.execute(sql`
        DELETE FROM cortex_core.juridico_processos WHERE id = ${parseInt(id)}
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting processo:", error);
      res.status(500).json({ error: "Failed to delete processo" });
    }
  });

  // POST - Seed inicial de processos jurídicos (dados da planilha)
  app.post("/api/juridico/processos/seed", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();

      // Limpar dados existentes para re-inserir com dados corretos
      await db.execute(sql`DELETE FROM cortex_core.juridico_processos`);

      const processos = [
        { numero_cnj: '5029875-82.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerido', acao: 'Ação Declaratória de Inexigibilidade de Débito', status: 'Ativo', contrario_principal: 'NOVAES COMERCIO LTDA', cpf_cnpj: '39.306.125/0001-80', objetos_acao: 'Declaração de inexistência de débito', data_distribuicao: '2025-08-04', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '5º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 1997.00, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Arquivamento definitivo.', observacoes: 'Após homologado o acordo entre as partes, o processo foi arquivado.' },
        { numero_cnj: '5034121-24.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'CB WEBSTORE LTDA', cpf_cnpj: '53.322.748/0001-77', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 7668.22, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Arquivamento definitivo.', observacoes: 'Informamos o pagamento da dívida, então o processo foi arquivado.' },
        { numero_cnj: '5034126-46.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'INFOTECH PROMOCAO DE VENDAS E SERVICOS LTDA', cpf_cnpj: '37.809.871/0001-60', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 5848.14, sentenca_acordao: 'Não', ultimo_andamento: 'Proferido despacho determinando nossa manifestação sobre a exceção de pré-executividade apresentada pela Executada.', observacoes: 'Iremos elaborar e protocolar a manifestação sobre a exceção de pré-executividade.' },
        { numero_cnj: '5034199-18.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: '56.267.836 MAHATMA LUCAS GADELHA PEREIRA', cpf_cnpj: '56.267.836/0001-01', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 11997.35, sentenca_acordao: 'Não', ultimo_andamento: 'Processo concluso ao magistrado após apresentarmos emenda da inicial demonstrando o enquadramento da Turbo como legitimada a atuar nos Juizados Especiais.', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5034208-77.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'PODER DOS FIOS COSMETICOS LTDA', cpf_cnpj: '57.732.954/0001-06', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 15078.61, sentenca_acordao: 'Não', ultimo_andamento: 'Juntada da comprovação da prestação de serviço (Relatório enviado pela TURBO) e conclusão para o juiz apreciar.', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5034211-32.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'FS COMPANY LTDA', cpf_cnpj: '52.505.247/0001-63', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '9º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 2828.30, sentenca_acordao: 'Não', ultimo_andamento: 'Certificado o decurso do prazo para defesa.', observacoes: 'Vamos peticionar nos autos pedidos a constrição de bens para pagamento.' },
        { numero_cnj: '4001375-27.2026.8.26.0011', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Carta Precatória Cível', status: 'Ativo', contrario_principal: 'FS COMPANY LTDA', cpf_cnpj: '52.505.247/0001-63', objetos_acao: 'Citação da requerida', data_distribuicao: '2026-01-27', instancia: '1ª Instância', comarca: 'Regional XI - Pinheiros', orgao: 'TJSP', vara_turma: '1ª Vara do Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: null, sentenca_acordao: 'Não', ultimo_andamento: 'Baixa da Carta Precatória.', observacoes: 'Será necessária a redistribuição de nova Carta Precatória.' },
        { numero_cnj: '5034216-54.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'DOLCE FIT ALIMENTOS E BEBIDAS FUNCIONAIS LTDA', cpf_cnpj: '51.822.715/0001-60', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Comarca da Capital', orgao: 'TJES', vara_turma: '5º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 3859.40, sentenca_acordao: 'Não', ultimo_andamento: 'Expedida Carta Precatória para citar a parte contrária.', observacoes: 'Acompanhar a Carta Precatória.' },
        { numero_cnj: '4022385-49.2025.8.26.0016', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Carta Precatória Cível', status: 'Ativo', contrario_principal: 'DOLCE FIT ALIMENTOS E BEBIDAS FUNCIONAIS LTDA', cpf_cnpj: '51.822.715/0001-60', objetos_acao: 'Citação da requerida', data_distribuicao: '2025-02-04', instancia: '1ª Instância', comarca: 'JEC Central - Vergueiro', orgao: 'TJSP', vara_turma: '2ª Vara do Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: null, sentenca_acordao: 'Não', ultimo_andamento: 'Baixa da Carta Precatória.', observacoes: 'Será necessária a redistribuição de nova Carta Precatória.' },
        { numero_cnj: '5034333-45.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'BR SERVICOS DIGITAIS LTDA', cpf_cnpj: '57.470.157/0001-06', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-30', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 5109.92, sentenca_acordao: 'Não', ultimo_andamento: 'Havíamos sido intimados para comprovar a expedição de Carta Precatória de citação da Executada. Peticionamos requerendo que a medida seja promovida pelo Juízo, conforme lei.', observacoes: 'Inserido em rotina para diligenciar a análise do nosso último pedido.' },
        { numero_cnj: '5034476-34.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'FE DOS CACHOS LTDA', cpf_cnpj: '42.040.732/0001-55', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-01', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 6976.14, sentenca_acordao: 'Não', ultimo_andamento: 'Havíamos sido intimados para comprovar a expedição de Carta Precatória de citação da Executada. Peticionamos requerendo que a medida seja promovida pelo Juízo, conforme lei.', observacoes: 'Inserido em rotina para diligenciar a análise do nosso último pedido.' },
        { numero_cnj: '5035287-91.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'ALLDAYS NUTRITION LTDA', cpf_cnpj: '52.395.585/0001-90', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 12983.65, sentenca_acordao: 'Não', ultimo_andamento: 'Juntada da comprovação da prestação de serviço (Relatório enviado pela TURBO) e conclusão para o juiz apreciar', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5035314-74.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'FANTASMA DA OPERA ESTETICA E SAUDE CAPILAR LTDA', cpf_cnpj: '49.051.240/0001-04', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 10474.18, sentenca_acordao: 'Não', ultimo_andamento: 'Determinada a comprovação de expedição de Carta Precatória de citação da Executada.', observacoes: 'Vamos nos manifestar conforme outros processos.' },
        { numero_cnj: '5035320-81.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'HORTENCIA MOTA VIDAL 01477644164', cpf_cnpj: '40.157.671/0001-85', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '5º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 6224.77, sentenca_acordao: 'Não', ultimo_andamento: 'Com o retorno negativo da Carta Precatória inicialmente distribuída, indicamos novo endereço e requeremos expedição de novo mandado de citação.', observacoes: 'Diligenciar, em gabinete, a apreciação do nosso pedido.' },
        { numero_cnj: '5035362-33.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'PLATAFORMA E COMERCIO DJAZ LTDA', cpf_cnpj: '31.679.332/0001-78', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '9ª Vara Cível', natureza_acao: 'Cível', valor_causa: 2182.05, sentenca_acordao: 'Não', ultimo_andamento: 'Solicitamos a remessa do processo para o Juizado Especial, tendo em vista a distribuição para a Vara Cível.', observacoes: 'Diligenciar, em gabinete, a apreciação do nosso pedido.' },
        { numero_cnj: '5035397-90.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'EBEYBE STORE LTDA', cpf_cnpj: '44.333.986/0001-97', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '9º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 15464.15, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Extinto sob fundamento de que a Turbo não pode litigar em Juizados', observacoes: 'Validar redistribuição na vara cível.' },
        { numero_cnj: '5035382-24.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'JOAO FABIO LOUREIRO SILVA', cpf_cnpj: '53.042.649/0001-31', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 2182.83, sentenca_acordao: 'Não', ultimo_andamento: 'Com o retorno negativo do primeiro mandado de citação, indicamos novo endereço e requeremos expedição de novo mandado de citação.', observacoes: 'Inserido em rotina para diligenciar a análise do nosso último pedido.' },
        { numero_cnj: '5035373-62.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'FERREIRA SOLANO LTDA', cpf_cnpj: '49.758.173/0001-62', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 12886.46, sentenca_acordao: 'Não', ultimo_andamento: 'Distribuímos Carta Precatória para citação da Executada.', observacoes: 'Diligenciar o cumprimento da CP.' },
        { numero_cnj: '5233432-55.2025.8.13.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Carta Precatória Cível', status: 'Ativo', contrario_principal: 'FERREIRA SOLANO LTDA', cpf_cnpj: '49.758.173/0001-62', objetos_acao: 'Citação da requerida', data_distribuicao: '2025-12-09', instancia: '1ª Instância', comarca: 'Belo Horizonte', orgao: 'TJMG', vara_turma: 'Vara de Precatórias Cíveis', natureza_acao: 'Cível', valor_causa: 1000.00, sentenca_acordao: 'Não', ultimo_andamento: 'Determinado o cumprimento da CP.', observacoes: 'Aguardar.' },
        { numero_cnj: '5036040-48.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'AMAM - INDUSTRIA E COMERCIO LTDA', cpf_cnpj: '21.045.782/0001-55', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-11', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 7856.21, sentenca_acordao: 'Não', ultimo_andamento: 'Juntada da comprovação da prestação de serviço (Relatório enviado pela TURBO).', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5036058-69.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'GPA SUPLEMENTOS LTDA', cpf_cnpj: '44.040.041/0001-87', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-11', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '8º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 10774.50, sentenca_acordao: 'Não', ultimo_andamento: 'Peticionamos a citação da PJ na pessoa do sócio.', observacoes: 'Diligenciar a análise do nosso pedido.' },
        { numero_cnj: '5036072-53.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'GRUPO EMPRESARIAL TORI LTDA', cpf_cnpj: '52.481.399/0001-73', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-11', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '8º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 18069.71, sentenca_acordao: 'Não', ultimo_andamento: 'Fomos intimados para apresentar a via original do título executivo, então explicamos que a documentação é toda nato-digital e que já havia sido juntada.', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5036402-50.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'BRITO E SANTOS SUPLEMENTOS ALIMENTARES LTDA', cpf_cnpj: '44.319.426/0001-88', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-12', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 2634.96, sentenca_acordao: 'Não', ultimo_andamento: 'Fomos intimados para apresentar a via original do título executivo, então explicamos que a documentação é toda nato-digital e que já havia sido juntada.', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5036420-71.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'DALBOSCO SUPLEMENTOS LTDA', cpf_cnpj: '54.907.558/0001-84', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-12', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '9º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 4455.83, sentenca_acordao: 'Não', ultimo_andamento: 'Expedida carta de citação da Executada.', observacoes: 'Aguardar.' },
        { numero_cnj: '5035611-81.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'HUBSAGE DISTRIBUIDORA LTDA', cpf_cnpj: '34.366.677/0002-40', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-09', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 23782.44, sentenca_acordao: 'Não', ultimo_andamento: 'Petição solicitando a adequação da certidão para distribuir Carta Precatória.', observacoes: 'Diligenciar.' },
        { numero_cnj: '5037007-93.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Executado', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'N.P. COMERCIO E INDUSTRIA LTDA', cpf_cnpj: '55.542.136/0001-15', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-17', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '5º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 6364.16, sentenca_acordao: 'Não', ultimo_andamento: 'Havíamos sido intimados para comprovar a expedição de Carta Precatória de citação da Executada. Peticionamos requerendo que a medida seja promovida pelo Juízo, conforme lei.', observacoes: 'Inserido em rotina para diligenciar a análise do nosso último pedido.' },
        { numero_cnj: '5048176-77.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'ALPHA MASTER', cpf_cnpj: '54.378.550/0001-78', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-11-27', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 9345.30, sentenca_acordao: 'Não', ultimo_andamento: 'Pedimos o cancelamento da audiência de conciliação e a expedição de carta de citação para a parte contrária.', observacoes: 'Diligenciar a análise do nosso pedido.' },
        { numero_cnj: '5048115-22.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'BYR LTDA', cpf_cnpj: '39.395.019/0001-10', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-11-27', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 8897.61, sentenca_acordao: 'Não', ultimo_andamento: 'Determinado que nós apresentemos prova da prestação do serviço.', observacoes: 'Peticionar comprovando o cumprimento da nossa parte do contrato.' },
        { numero_cnj: '5050013-70.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'CASA ATELIE CONFECCOES LTDA', cpf_cnpj: '28.676.521/0001-82', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-12-09', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '5ª Vara Cível', natureza_acao: 'Cível', valor_causa: 19893.57, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Proferida sentença homologando nosso pedido de desistência.', observacoes: 'Acompanhar arquivamento.' },
        { numero_cnj: '5001548-21.2026.8.08.0048', cliente_principal: 'PEIXOTO DEBBANE TREINAMENTO E CONSULTORIA ADMINISTRATIVA LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'VENAMORE COMERCIO DE JOIAS LTDA', cpf_cnpj: '37.028.050/0001-97', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2026-01-16', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 16554.27, sentenca_acordao: 'Não', ultimo_andamento: 'Intimação para nos manifestar sobre a competência, se Vitória ou Serra.', observacoes: 'Elaborar manifestação no sentido de que a competência é de Vitória.' },
        { numero_cnj: '5040975-68.2024.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerido', acao: 'Ação de indenização por danos materiais e morais', status: 'Ativo', contrario_principal: 'ANDREA DE PINHO E SILVA LTDA', cpf_cnpj: '31.652.414/0001-29', objetos_acao: 'Invalidação de débito e danos', data_distribuicao: '2024-10-02', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 3000.00, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Arquivamento definitivo.', observacoes: 'Arquivado após acordo realizado em sentença.' },
        { numero_cnj: '5002320-56.2026.8.08.0024', cliente_principal: 'PEIXOTO DEBBANE TREINAMENTO E CONSULTORIA ADMINISTRATIVA LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'SAVERHOME REPRESENTACOES MEDICAS LTDA', cpf_cnpj: '41.593.226/0001-20', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2026-01-21', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '8º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 9093.64, sentenca_acordao: 'Não', ultimo_andamento: 'Processo concluso ao magistrado para despacho inicial.', observacoes: 'Diligenciar despacho inicial para mandar citar a parte contrária.' },
        { numero_cnj: '5002999-56.2026.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'CK DISTRIBUIDORA E REPRESENTACOES LTDA', cpf_cnpj: '31.941.662/0001-90', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2026-01-27', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 9467.50, sentenca_acordao: 'Não', ultimo_andamento: 'Processo concluso ao magistrado para despacho inicial.', observacoes: 'Diligenciar despacho inicial para mandar citar a parte contrária.' },
        { numero_cnj: '0000375-19.2025.5.17.0004', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Reclamado', acao: 'Reclamação Trabalhista', status: 'Ativo', contrario_principal: 'PEDRO HENRIQUE LOPES ESPINDOLA', cpf_cnpj: '160.584.817-40', objetos_acao: 'Indenização trabalhista', data_distribuicao: '2025-03-31', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TRT17', vara_turma: '4ª Vara do Trabalho', natureza_acao: 'Trabalhista', valor_causa: 23587.40, sentenca_acordao: 'Não', ultimo_andamento: null, observacoes: 'Processo Suspenso' },
        { numero_cnj: '5025365-68.2024.4.02.5001', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Ação Ordinária', status: 'Ativo', contrario_principal: 'UNIÃO - FAZENDA NACIONAL', cpf_cnpj: '00.394.460/0216-53', objetos_acao: 'Restituição de indébito tributário', data_distribuicao: '2024-08-02', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TRF2', vara_turma: '6ª Vara Federal Cível', natureza_acao: 'Tributária', valor_causa: 472.91, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Aguardando a União apresentar os cálculos do valor por ela devido', observacoes: 'Aguardar a manifestação da União. Em seguida: Sentença' },
        { numero_cnj: '5034153-63.2024.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Ação Ordinária', status: 'Concluído', contrario_principal: 'ESTADO DO ESPÍRITO SANTO', cpf_cnpj: '27.080.605/0008-63', objetos_acao: 'Restituição de indébito tributário', data_distribuicao: '2024-08-19', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '2º Juizado Especial Criminal e Fazenda Pública', natureza_acao: 'Tributária', valor_causa: 301.12, sentenca_acordao: 'Sim (sen)', ultimo_andamento: 'Expedição de RPV. Arquivamento do processo', observacoes: 'Confirmar com o cliente o saque do crédito e repasse dos honorários (15%)' },
        { numero_cnj: '5040198-49.2025.8.08.0024', cliente_principal: 'ANDRE DEBBANE MUSSO', posicao_cliente: 'Requerente', acao: 'Ação Ordinária', status: 'Ativo', contrario_principal: 'ESTADO DO ESPÍRITO SANTO', cpf_cnpj: '27.080.605/0008-62', objetos_acao: 'Restituição de indébito tributário', data_distribuicao: '2025-11-07', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Criminal e Fazenda Pública', natureza_acao: 'Tributária', valor_causa: 575.20, sentenca_acordao: 'Não', ultimo_andamento: 'O Estado reconheceu o direito do autor. Aguardando sentença', observacoes: 'Aguardar a sentença' },
        { numero_cnj: '5033392-06.2025.4.02.5001', cliente_principal: 'ANDRE DEBBANE MUSSO', posicao_cliente: 'Requerente', acao: 'Ação Ordinária', status: 'Ativo', contrario_principal: 'UNIÃO - FAZENDA NACIONAL', cpf_cnpj: '00.394.460/0216-53', objetos_acao: 'Restituição de indébito tributário', data_distribuicao: '2025-10-21', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TRF2', vara_turma: '2ª Vara Federal Cível', natureza_acao: 'Tributária', valor_causa: 1053.11, sentenca_acordao: 'Não', ultimo_andamento: 'Aguardando Sentença', observacoes: 'Aguardar a sentença' },
      ];

      let inserted = 0;
      const errors: string[] = [];

      for (const p of processos) {
        try {
          const valorCausa = p.valor_causa !== null && p.valor_causa !== undefined ? String(p.valor_causa) : null;
          const dataDistribuicao = p.data_distribuicao || null;
          await db.execute(sql`
            INSERT INTO cortex_core.juridico_processos (
              numero_cnj, cliente_principal, posicao_cliente, acao, status,
              contrario_principal, cpf_cnpj, objetos_acao, data_distribuicao,
              instancia, comarca, orgao, vara_turma, natureza_acao, valor_causa,
              sentenca_acordao, ultimo_andamento, observacoes
            ) VALUES (
              ${p.numero_cnj}, ${p.cliente_principal}, ${p.posicao_cliente}, ${p.acao}, ${p.status},
              ${p.contrario_principal}, ${p.cpf_cnpj}, ${p.objetos_acao}, ${dataDistribuicao},
              ${p.instancia}, ${p.comarca}, ${p.orgao}, ${p.vara_turma}, ${p.natureza_acao}, ${valorCausa},
              ${p.sentenca_acordao}, ${p.ultimo_andamento}, ${p.observacoes}
            )
            ON CONFLICT (numero_cnj) DO NOTHING
          `);
          inserted++;
        } catch (err: any) {
          console.error(`[api] Error inserting processo ${p.numero_cnj}:`, err?.message || err);
          errors.push(`${p.numero_cnj}: ${err?.message || 'unknown error'}`);
        }
      }

      res.json({ success: true, message: `${inserted} de ${processos.length} processos inseridos com sucesso`, errors: errors.length > 0 ? errors : undefined });
    } catch (error: any) {
      console.error("[api] Error seeding processos:", error?.message || error);
      res.status(500).json({ error: "Failed to seed processos", detail: error?.message });
    }
  });
}
