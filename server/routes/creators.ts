import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import PDFDocument from "pdfkit";

async function ensureCreatorsTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.creators (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cpf VARCHAR(14),
        cnpj VARCHAR(18),
        email VARCHAR(255) NOT NULL,
        endereco TEXT,
        cidade VARCHAR(100),
        estado VARCHAR(2),
        cep VARCHAR(10),
        chave_pix TEXT,
        tipo_pix VARCHAR(20),
        ativo BOOLEAN DEFAULT true,
        observacoes TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.contratos_creators (
        id SERIAL PRIMARY KEY,
        creator_id INTEGER REFERENCES cortex_core.creators(id),
        cliente_task_id VARCHAR(50),
        cliente_nome VARCHAR(255),
        entregaveis JSONB,
        valor_remuneracao NUMERIC(10,2),
        prazo_entrega_dias INTEGER DEFAULT 3,
        observacoes TEXT,
        assinafy_document_id VARCHAR(255),
        assinafy_status VARCHAR(50),
        enviado_em TIMESTAMP,
        assinado_em TIMESTAMP,
        status VARCHAR(50) DEFAULT 'rascunho',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[creators] Tables ensured");
  } catch (error) {
    console.error("[creators] Error creating tables:", error);
  }
}

// ── PDF Generation ────────────────────────────────────────────────────────────

async function gerarContratoCreatorPDF(
  creator: { nome: string; cpf: string | null; cnpj: string | null; endereco: string | null; cidade: string | null; estado: string | null; cep: string | null },
  contrato: { cliente_nome: string; entregaveis: any[]; valor_remuneracao: string; prazo_entrega_dias: number; observacoes?: string | null }
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const cpfCnpj = creator.cnpj || creator.cpf || 'Não informado';
  const enderecoCompleto = [creator.endereco, creator.cidade, creator.estado, creator.cep].filter(Boolean).join(', ');
  const valorNum = parseFloat((contrato.valor_remuneracao || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  const valorFormatado = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Helper to add bold/normal mixed text
  const addParagraph = (text: string, opts?: { bold?: boolean; fontSize?: number; align?: string; spacing?: number }) => {
    doc.fontSize(opts?.fontSize || 10)
       .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(text, { align: (opts?.align as any) || 'justify', lineGap: 4 });
    if (opts?.spacing) doc.moveDown(opts.spacing);
  };

  // ── TÍTULO ──
  addParagraph('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS', { bold: true, fontSize: 13, align: 'center', spacing: 1.5 });

  // ── PREÂMBULO ──
  addParagraph('CONTRATANTE:', { bold: true, spacing: 0.3 });
  addParagraph('TURBO PARTNERS ASSESSORIA DE MARKETING LTDA, inscrita no CNPJ sob o nº 37.854.211/0001-84, com sede na Rua Fernando de Noronha, nº 311, bairro Boa Viagem, Recife/PE, CEP 51.021-320, neste ato representada por seus sócios administradores.', { spacing: 0.8 });

  addParagraph('CONTRATADA:', { bold: true, spacing: 0.3 });
  addParagraph(`${creator.nome}, inscrita no ${creator.cnpj ? 'CNPJ' : 'CPF'} sob o nº ${cpfCnpj}${enderecoCompleto ? `, com endereço em ${enderecoCompleto}` : ''}.`, { spacing: 0.8 });

  addParagraph('As partes acima identificadas têm, entre si, justo e acertado o presente Contrato Particular de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.', { spacing: 1 });

  // ── CLÁUSULA 1 — DO OBJETO ──
  addParagraph('CLÁUSULA 1ª — DO OBJETO', { bold: true, fontSize: 11, spacing: 0.5 });
  addParagraph(`1.1. O presente contrato tem por objeto a prestação de serviços de criação de conteúdo pela CONTRATADA, destinados à divulgação da marca ${contrato.cliente_nome}, conforme especificações abaixo.`, { spacing: 0.5 });

  addParagraph('1.2. A CONTRATADA se compromete a entregar os materiais conforme as diretrizes de briefing fornecidas pela CONTRATANTE.', { spacing: 0.5 });

  // Entregáveis
  addParagraph('1.3. Os entregáveis acordados são:', { spacing: 0.3 });
  if (Array.isArray(contrato.entregaveis) && contrato.entregaveis.length > 0) {
    contrato.entregaveis.forEach((item: any, i: number) => {
      const desc = typeof item === 'string' ? item : `${item.quantidade || 1}x ${item.tipo || item.descricao || 'Entregável'}`;
      addParagraph(`   ${i + 1}. ${desc}`, { spacing: 0.2 });
    });
  } else {
    addParagraph('   Conforme acordado entre as partes.', { spacing: 0.2 });
  }
  doc.moveDown(0.5);

  // ── CLÁUSULA 2 — DO PRAZO ──
  addParagraph('CLÁUSULA 2ª — DO PRAZO E FORMA DE ENTREGA', { bold: true, fontSize: 11, spacing: 0.5 });
  addParagraph(`2.1. A CONTRATADA terá o prazo máximo de ${contrato.prazo_entrega_dias} (${contrato.prazo_entrega_dias === 1 ? 'um' : contrato.prazo_entrega_dias === 3 ? 'três' : contrato.prazo_entrega_dias}) dias corridos, contados a partir do recebimento do briefing, para entrega dos materiais.`, { spacing: 0.5 });
  addParagraph('2.2. Os materiais deverão ser entregues em formato digital, conforme especificações da CONTRATANTE.', { spacing: 0.5 });
  addParagraph('2.3. Caso haja necessidade de ajustes, a CONTRATADA realizará até 2 (duas) rodadas de revisão sem custo adicional.', { spacing: 1 });

  // ── CLÁUSULA 3 — DA PROPRIEDADE INTELECTUAL ──
  addParagraph('CLÁUSULA 3ª — DA PROPRIEDADE INTELECTUAL', { bold: true, fontSize: 11, spacing: 0.5 });
  addParagraph('3.1. Todos os materiais produzidos pela CONTRATADA no âmbito deste contrato serão de propriedade exclusiva da CONTRATANTE, podendo esta utilizá-los, reproduzi-los e distribuí-los sem qualquer restrição.', { spacing: 0.5 });
  addParagraph('3.2. A CONTRATADA autoriza o uso de sua imagem e voz nos materiais produzidos, pelo prazo de 12 (doze) meses a contar da entrega.', { spacing: 1 });

  // ── CLÁUSULA 4 — DA CONFIDENCIALIDADE ──
  addParagraph('CLÁUSULA 4ª — DA CONFIDENCIALIDADE', { bold: true, fontSize: 11, spacing: 0.5 });
  addParagraph('4.1. A CONTRATADA compromete-se a manter sigilo absoluto sobre todas as informações a que tiver acesso em razão da prestação dos serviços, incluindo, mas não se limitando a, estratégias de marketing, dados de clientes e informações comerciais da CONTRATANTE.', { spacing: 1 });

  // ── CLÁUSULA 5 — DA NÃO EXCLUSIVIDADE ──
  addParagraph('CLÁUSULA 5ª — DA NÃO EXCLUSIVIDADE E INDEPENDÊNCIA', { bold: true, fontSize: 11, spacing: 0.5 });
  addParagraph('5.1. O presente contrato não estabelece vínculo empregatício, associação ou qualquer forma de relação trabalhista entre as partes.', { spacing: 0.5 });
  addParagraph('5.2. A CONTRATADA é livre para prestar serviços a terceiros, desde que não haja conflito de interesses com os clientes da CONTRATANTE.', { spacing: 1 });

  // ── CLÁUSULA 6 — DAS PENALIDADES ──
  addParagraph('CLÁUSULA 6ª — DAS PENALIDADES', { bold: true, fontSize: 11, spacing: 0.5 });
  addParagraph('6.1. O descumprimento de qualquer cláusula deste contrato poderá acarretar a rescisão imediata, sem aviso prévio, e aplicação de multa equivalente a 20% (vinte por cento) do valor total do contrato.', { spacing: 0.5 });
  addParagraph('6.2. Em caso de atraso na entrega, será aplicado desconto de 5% (cinco por cento) por dia de atraso sobre o valor da remuneração.', { spacing: 1 });

  // ── CLÁUSULA 7 — DA REMUNERAÇÃO ──
  addParagraph('CLÁUSULA 7ª — DA REMUNERAÇÃO', { bold: true, fontSize: 11, spacing: 0.5 });
  addParagraph(`7.1. Pela prestação dos serviços descritos neste contrato, a CONTRATANTE pagará à CONTRATADA a remuneração total de ${valorFormatado} (${valorPorExtenso(valorNum)}).`, { spacing: 0.5 });
  addParagraph('7.2. O pagamento será realizado em até 30 (trinta) dias após a entrega e aprovação dos materiais pela CONTRATANTE.', { spacing: 0.5 });
  addParagraph('7.3. O pagamento será efetuado via transferência bancária (PIX) para a conta indicada pela CONTRATADA.', { spacing: 1 });

  // ── CLÁUSULA 8 — DA RESCISÃO ──
  addParagraph('CLÁUSULA 8ª — DA RESCISÃO', { bold: true, fontSize: 11, spacing: 0.5 });
  addParagraph('8.1. O presente contrato poderá ser rescindido por qualquer das partes, mediante notificação por escrito com antecedência mínima de 5 (cinco) dias úteis.', { spacing: 0.5 });
  addParagraph('8.2. Em caso de rescisão, os serviços já realizados até a data da rescisão serão devidos proporcionalmente.', { spacing: 1 });

  // ── CLÁUSULA 9 — DO FORO ──
  addParagraph('CLÁUSULA 9ª — DO FORO', { bold: true, fontSize: 11, spacing: 0.5 });
  addParagraph('9.1. Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de Recife/PE, com renúncia expressa a qualquer outro.', { spacing: 1.5 });

  // ── ASSINATURAS ──
  addParagraph(`Recife/PE, ${dataAtual}.`, { spacing: 2 });

  addParagraph('_____________________________________________', { align: 'center', spacing: 0.2 });
  addParagraph('TURBO PARTNERS ASSESSORIA DE MARKETING LTDA', { bold: true, align: 'center', spacing: 0.1 });
  addParagraph('CONTRATANTE', { align: 'center', spacing: 2 });

  addParagraph('_____________________________________________', { align: 'center', spacing: 0.2 });
  addParagraph(creator.nome.toUpperCase(), { bold: true, align: 'center', spacing: 0.1 });
  addParagraph('CONTRATADA', { align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function valorPorExtenso(valor: number): string {
  if (valor === 0) return 'zero reais';
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function grupo(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    const partes: string[] = [];
    if (c > 0) partes.push(centenas[c]);
    if (d === 1) {
      partes.push(especiais[u]);
    } else {
      if (d > 0) partes.push(dezenas[d]);
      if (u > 0) partes.push(unidades[u]);
    }
    return partes.join(' e ');
  }

  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);
  const partes: string[] = [];

  const milhares = Math.floor(inteiro / 1000);
  const resto = inteiro % 1000;

  if (milhares > 0) partes.push(`${grupo(milhares)} mil`);
  if (resto > 0) partes.push(grupo(resto));

  let resultado = partes.join(' e ') || 'zero';
  resultado += inteiro === 1 ? ' real' : ' reais';

  if (centavos > 0) {
    resultado += ` e ${grupo(centavos)} centavo${centavos === 1 ? '' : 's'}`;
  }

  return resultado;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerCreatorsRoutes(app: Express) {
  ensureCreatorsTables();

  // ── CRUD Creators ──────────────────────────────────────────────────────────

  // GET /api/creators — Listar
  app.get("/api/creators", async (_req, res) => {
    try {
      const { search, ativo } = _req.query;
      let query = `SELECT * FROM cortex_core.creators`;
      const conditions: string[] = [];

      if (ativo !== undefined && ativo !== '') {
        conditions.push(`ativo = ${ativo === 'true'}`);
      }
      if (search && typeof search === 'string' && search.trim()) {
        conditions.push(`(nome ILIKE '%${search.replace(/'/g, "''")}%' OR email ILIKE '%${search.replace(/'/g, "''")}%')`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY nome ASC';

      const result = await db.execute(sql.raw(query));
      res.json(result.rows);
    } catch (error: any) {
      console.error("[creators] Erro ao listar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/creators/:id — Detalhe + contratos
  app.get("/api/creators/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [creatorResult, contratosResult] = await Promise.all([
        db.execute(sql`SELECT * FROM cortex_core.creators WHERE id = ${id}`),
        db.execute(sql`SELECT * FROM cortex_core.contratos_creators WHERE creator_id = ${id} ORDER BY criado_em DESC`)
      ]);

      if (creatorResult.rows.length === 0) {
        return res.status(404).json({ error: "Creator não encontrado" });
      }

      res.json({ ...creatorResult.rows[0], contratos: contratosResult.rows });
    } catch (error: any) {
      console.error("[creators] Erro ao buscar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/creators — Cadastrar
  app.post("/api/creators", async (req, res) => {
    try {
      const { nome, cpf, cnpj, email, endereco, cidade, estado, cep, chave_pix, tipo_pix, observacoes } = req.body;

      if (!email) return res.status(400).json({ error: "Email é obrigatório" });
      if (!nome) return res.status(400).json({ error: "Nome é obrigatório" });
      if (!cpf && !cnpj) return res.status(400).json({ error: "CPF ou CNPJ é obrigatório" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.creators (nome, cpf, cnpj, email, endereco, cidade, estado, cep, chave_pix, tipo_pix, observacoes)
        VALUES (${nome}, ${cpf || null}, ${cnpj || null}, ${email}, ${endereco || null}, ${cidade || null}, ${estado || null}, ${cep || null}, ${chave_pix || null}, ${tipo_pix || null}, ${observacoes || null})
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error("[creators] Erro ao cadastrar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/creators/:id — Atualizar
  app.put("/api/creators/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { nome, cpf, cnpj, email, endereco, cidade, estado, cep, chave_pix, tipo_pix, observacoes } = req.body;

      const result = await db.execute(sql`
        UPDATE cortex_core.creators SET
          nome = COALESCE(${nome || null}, nome),
          cpf = ${cpf ?? null},
          cnpj = ${cnpj ?? null},
          email = COALESCE(${email || null}, email),
          endereco = ${endereco ?? null},
          cidade = ${cidade ?? null},
          estado = ${estado ?? null},
          cep = ${cep ?? null},
          chave_pix = ${chave_pix ?? null},
          tipo_pix = ${tipo_pix ?? null},
          observacoes = ${observacoes ?? null},
          atualizado_em = NOW()
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Creator não encontrado" });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[creators] Erro ao atualizar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/creators/:id — Soft delete
  app.delete("/api/creators/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.execute(sql`
        UPDATE cortex_core.creators SET ativo = false, atualizado_em = NOW() WHERE id = ${id}
      `);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[creators] Erro ao desativar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Contratos ──────────────────────────────────────────────────────────────

  // GET /api/creators/:id/contratos
  app.get("/api/creators/:id/contratos", async (req, res) => {
    try {
      const creatorId = parseInt(req.params.id);
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.contratos_creators WHERE creator_id = ${creatorId} ORDER BY criado_em DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[creators] Erro ao listar contratos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/creators/:id/contratos — Criar contrato (rascunho)
  app.post("/api/creators/:id/contratos", async (req, res) => {
    try {
      const creatorId = parseInt(req.params.id);
      const { cliente_task_id, cliente_nome, entregaveis, valor_remuneracao, prazo_entrega_dias, observacoes } = req.body;

      if (!cliente_nome) return res.status(400).json({ error: "Nome do cliente é obrigatório" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.contratos_creators
          (creator_id, cliente_task_id, cliente_nome, entregaveis, valor_remuneracao, prazo_entrega_dias, observacoes)
        VALUES (
          ${creatorId}, ${cliente_task_id || null}, ${cliente_nome},
          ${JSON.stringify(entregaveis || [])}::jsonb,
          ${valor_remuneracao || 0}, ${prazo_entrega_dias || 3}, ${observacoes || null}
        )
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error("[creators] Erro ao criar contrato:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/creators/clientes/search — Buscar clientes em cup_clientes
  app.get("/api/creators/clientes/search", async (req, res) => {
    try {
      const q = (req.query.q as string || '').trim();
      if (!q || q.length < 2) return res.json([]);

      const result = await db.execute(sql`
        SELECT task_id, nome, cnpj, status
        FROM "Clickup".cup_clientes
        WHERE nome ILIKE ${'%' + q + '%'}
        ORDER BY nome ASC
        LIMIT 20
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[creators] Erro ao buscar clientes:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/creators/contratos/:id/preview-pdf — Preview PDF
  app.get("/api/creators/contratos/:id/preview-pdf", async (req, res) => {
    try {
      const contratoId = parseInt(req.params.id);

      const result = await db.execute(sql`
        SELECT cc.*, c.nome, c.cpf, c.cnpj, c.endereco, c.cidade, c.estado, c.cep
        FROM cortex_core.contratos_creators cc
        JOIN cortex_core.creators c ON c.id = cc.creator_id
        WHERE cc.id = ${contratoId}
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }

      const row = result.rows[0] as any;
      const pdfBuffer = await gerarContratoCreatorPDF(
        { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, endereco: row.endereco, cidade: row.cidade, estado: row.estado, cep: row.cep },
        {
          cliente_nome: row.cliente_nome,
          entregaveis: typeof row.entregaveis === 'string' ? JSON.parse(row.entregaveis) : (row.entregaveis || []),
          valor_remuneracao: row.valor_remuneracao?.toString() || '0',
          prazo_entrega_dias: row.prazo_entrega_dias || 3,
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=contrato_creator_${contratoId}.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("[creators] Erro ao gerar preview:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/creators/contratos/:id/enviar-assinatura — Gerar PDF + enviar Assinafy
  app.post("/api/creators/contratos/:id/enviar-assinatura", async (req, res) => {
    const contratoId = parseInt(req.params.id);
    const startTime = Date.now();

    try {
      console.log(`[assinafy-creator] Iniciando envio - Contrato ID: ${contratoId}`);

      // 1. Buscar config + dados
      const [configResult, dataResult] = await Promise.all([
        db.execute(sql`SELECT account_id, api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'colaboradores' LIMIT 1`),
        db.execute(sql`
          SELECT cc.*, c.nome, c.cpf, c.cnpj, c.email, c.endereco, c.cidade, c.estado, c.cep
          FROM cortex_core.contratos_creators cc
          JOIN cortex_core.creators c ON c.id = cc.creator_id
          WHERE cc.id = ${contratoId}
        `)
      ]);

      if (configResult.rows.length === 0) {
        return res.status(500).json({ error: "Configuração do Assinafy não encontrada" });
      }
      if (dataResult.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }

      const config = configResult.rows[0] as { account_id: string; api_key: string; api_url: string };
      const row = dataResult.rows[0] as any;

      if (!row.email) {
        return res.status(400).json({ error: "Creator não possui email cadastrado" });
      }

      console.log(`[assinafy-creator] Signatário: ${row.nome} (${row.email}) [${Date.now() - startTime}ms]`);

      // 2. Gerar PDF + import FormData
      const [FormDataModule] = await Promise.all([import('form-data')]);

      const pdfBuffer = await gerarContratoCreatorPDF(
        { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, endereco: row.endereco, cidade: row.cidade, estado: row.estado, cep: row.cep },
        {
          cliente_nome: row.cliente_nome,
          entregaveis: typeof row.entregaveis === 'string' ? JSON.parse(row.entregaveis) : (row.entregaveis || []),
          valor_remuneracao: row.valor_remuneracao?.toString() || '0',
          prazo_entrega_dias: row.prazo_entrega_dias || 3,
        }
      );
      console.log(`[assinafy-creator] PDF gerado: ${pdfBuffer.length} bytes [${Date.now() - startTime}ms]`);

      // 3. Upload PDF
      const FormData = FormDataModule.default;
      const formData = new FormData();
      formData.append('file', pdfBuffer, {
        filename: `contrato_creator_${contratoId}.pdf`,
        contentType: 'application/pdf'
      });

      const uploadUrl = `${config.api_url}/accounts/${config.account_id}/documents`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'X-Api-Key': config.api_key, ...formData.getHeaders() },
        body: formData.getBuffer()
      });

      const uploadResult = await uploadResponse.json() as any;
      if (uploadResult.status !== 200 && !uploadResult.id) {
        console.error('[assinafy-creator] Erro no upload:', uploadResult);
        return res.status(500).json({ error: "Erro ao fazer upload do documento", details: uploadResult.message });
      }

      const documentId = uploadResult.id || uploadResult.data?.id;
      console.log(`[assinafy-creator] Documento criado: ${documentId} [${Date.now() - startTime}ms]`);

      // 4. Signatários + polling em paralelo
      const signerUrl = `${config.api_url}/accounts/${config.account_id}/signers`;

      const sociosResponsaveis = [
        { nome: "Rodrigo Queiroz Santos", email: "rodrigo.queiroz@turbopartners.com.br" },
        { nome: "Victor Peixoto", email: "victor.peixoto@turbopartners.com.br" },
        { nome: "Julia Viana", email: "julia.viana@turbopartners.com.br" }
      ];

      const getOrCreateSigner = async (nome: string, email: string): Promise<string> => {
        const searchUrl = `${signerUrl}?search=${encodeURIComponent(email)}`;
        const searchResponse = await fetch(searchUrl, { method: 'GET', headers: { 'X-Api-Key': config.api_key } });
        const searchResult = await searchResponse.json() as any;

        if (searchResult.status === 200 && searchResult.data && Array.isArray(searchResult.data)) {
          const existing = searchResult.data.find((s: any) => s.email?.toLowerCase() === email.toLowerCase());
          if (existing) return existing.id;
        }

        const signerResponse = await fetch(signerUrl, {
          method: 'POST',
          headers: { 'X-Api-Key': config.api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: nome, email })
        });
        const signerResult = await signerResponse.json() as any;
        return signerResult.data?.id || signerResult.id;
      };

      const waitForDocument = async (): Promise<boolean> => {
        const statusUrl = `${config.api_url}/documents/${documentId}`;
        for (let attempt = 1; attempt <= 30; attempt++) {
          const statusResponse = await fetch(statusUrl, { method: 'GET', headers: { 'X-Api-Key': config.api_key } });
          const statusResult = await statusResponse.json() as any;
          const currentStatus = statusResult.data?.status || statusResult.status;

          if (attempt === 1 || attempt % 5 === 0) {
            console.log(`[assinafy-creator] Status (tentativa ${attempt}/30): ${currentStatus} [${Date.now() - startTime}ms]`);
          }

          if (currentStatus === 'metadata_ready') return true;
          if (currentStatus === 'failed' || currentStatus === 'error') return false;

          await new Promise(resolve => setTimeout(resolve, attempt <= 5 ? 500 : 1000));
        }
        return false;
      };

      const [documentReady, signerIds] = await Promise.all([
        waitForDocument(),
        Promise.all([
          getOrCreateSigner(row.nome, row.email),
          ...sociosResponsaveis.map(s => getOrCreateSigner(s.nome, s.email))
        ])
      ]);

      console.log(`[assinafy-creator] Signatários: ${signerIds.join(', ')} [${Date.now() - startTime}ms]`);

      if (!documentReady) {
        return res.status(500).json({ error: "Documento não ficou pronto. Tente novamente.", documentId });
      }

      // 5. Enviar para assinatura
      const assignmentUrl = `${config.api_url}/documents/${documentId}/assignments`;
      const assignmentResponse = await fetch(assignmentUrl, {
        method: 'POST',
        headers: { 'X-Api-Key': config.api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'virtual', signerIds })
      });

      const assignmentResult = await assignmentResponse.json() as any;
      if (assignmentResult.status !== 200 && assignmentResult.status !== 201) {
        return res.status(500).json({ error: "Erro ao enviar para assinatura", details: assignmentResult.message });
      }

      // 6. Atualizar status no DB
      db.execute(sql`
        UPDATE cortex_core.contratos_creators SET
          assinafy_document_id = ${documentId},
          assinafy_status = 'enviado',
          status = 'enviado',
          enviado_em = NOW(),
          atualizado_em = NOW()
        WHERE id = ${contratoId}
      `).catch(err => console.error('[assinafy-creator] Erro ao salvar status:', err));

      const elapsed = Date.now() - startTime;
      console.log(`[assinafy-creator] Contrato enviado com sucesso em ${elapsed}ms`);

      res.json({
        success: true,
        documentId,
        emailEnviado: row.email,
        message: "Contrato enviado para assinatura com sucesso"
      });

    } catch (error) {
      console.error("[assinafy-creator] Erro:", error);
      res.status(500).json({ error: "Erro ao enviar para assinatura" });
    }
  });
}
