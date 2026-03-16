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
    // Migrate: add new columns for updated contract model
    const newCols = [
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS cargo VARCHAR(255)`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS descricao_servicos TEXT`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS duracao_meses INTEGER DEFAULT 6`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS data_inicio DATE`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS data_fim DATE`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS qtd_videos INTEGER`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS qtd_creators INTEGER`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS qtd_variacoes_gancho INTEGER`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS unidade_prazo VARCHAR(10) DEFAULT 'meses'`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS prazo_entrega_dias INTEGER`,
    ];
    for (const ddl of newCols) {
      try { await db.execute(sql.raw(ddl)); } catch { /* column already exists */ }
    }
    console.log("[creators] Tables ensured");
  } catch (error) {
    console.error("[creators] Error creating tables:", error);
  }
}

// ── PDF Generation ────────────────────────────────────────────────────────────

interface ContratoCreatorPDFData {
  creator: { nome: string; cpf: string | null; cnpj: string | null; email?: string; endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  contrato: { cargo: string; descricao_servicos: string; valor_remuneracao: string; duracao_meses: number; data_inicio: string; data_fim: string; qtd_videos?: number; qtd_variacoes_gancho?: number; unidade_prazo?: string; cliente_nome?: string; prazo_entrega_dias?: number };
}

async function gerarContratoCreatorPDF({ creator, contrato }: ContratoCreatorPDFData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const cpfCnpj = creator.cnpj || creator.cpf || 'Não informado';
  const docType = creator.cnpj ? 'CNPJ' : 'CPF';
  const enderecoCompleto = [creator.endereco, creator.cidade, creator.estado, creator.cep].filter(Boolean).join(', ');
  const valorNum = parseFloat((contrato.valor_remuneracao || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  const valorFormatado = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const unidadePrazo = contrato.unidade_prazo || 'meses';
  const prazoEntrega = contrato.prazo_entrega_dias || 3;

  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Helpers ──
  const p = (text: string, opts?: { bold?: boolean; fontSize?: number; align?: string; spacing?: number; indent?: number }) => {
    const x = opts?.indent ? 60 + opts.indent : undefined;
    doc.fontSize(opts?.fontSize || 10)
       .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(text, x, undefined, { align: (opts?.align as any) || 'justify', lineGap: 4, width: opts?.indent ? 480 - opts.indent : undefined });
    if (opts?.spacing) doc.moveDown(opts.spacing);
  };

  const heading = (text: string) => p(text, { bold: true, fontSize: 11, spacing: 0.5 });

  // ── TÍTULO ──
  p('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', { bold: true, fontSize: 14, align: 'center', spacing: 1.5 });

  // ── PREÂMBULO ──
  p('Pelo presente instrumento particular de contrato, entre as partes abaixo qualificadas:', { spacing: 0.8 });

  p('Na qualidade de CONTRATANTE: TURBO PARTNERS LTDA, CNPJ 42.100.292/0001-84, com sede na R Treze de Maio, 9 - Centro, Vitória, ES, na forma de seu contrato social;', { spacing: 0.8 });

  let contratadaText = `Na qualidade de CONTRATADA: ${creator.nome}`;
  if (enderecoCompleto) contratadaText += `, residente e domiciliado na ${enderecoCompleto}`;
  if (creator.email) contratadaText += `, e-mail ${creator.email}`;
  contratadaText += ` e inscrita no ${docType} nº ${cpfCnpj}.`;
  p(contratadaText, { spacing: 1 });

  // ── CLÁUSULA 1ª - OBJETO ──
  heading('Cláusula 1ª - OBJETO');

  const clienteRef = contrato.cliente_nome ? `para o cliente ${contrato.cliente_nome} ` : '';
  p(`1. O CONTRATANTE tem interesse que a CONTRATADA preste serviços e ceda seus direitos de imagem ${clienteRef}de acordo com as condições estipuladas neste instrumento; Têm entre si justo e contratado a Prestação de Serviços objeto do presente instrumento, mediante as seguintes condições:`, { spacing: 0.8 });

  p('1.1 - INFORMAÇÕES DA CAMPANHA', { bold: true, spacing: 0.5 });
  p('IMAGEM / ÁUDIO', { spacing: 0.5 });

  // ── Tabela Informações da Campanha ──
  const tableX = 60;
  const tableW = 480;
  const tableY = doc.y;
  const colW = tableW / 2;
  const cellPad = 8;

  // Calcular altura
  doc.fontSize(9).font('Helvetica');
  const leftH = doc.heightOfString(`Direito de Uso de Imagem?\n(x) Sim ( ) Não\nPeríodo:\nDurante 12 meses`, { width: colW - 2 * cellPad });
  const rightH = doc.heightOfString(`Canais:\n(x) Redes Sociais\n(x) Anúncios\n(x) Canais de Comunicação`, { width: colW - 2 * cellPad });
  const rowH = Math.max(leftH, rightH) + 2 * cellPad + 10;

  doc.rect(tableX, tableY, colW, rowH).stroke();
  doc.rect(tableX + colW, tableY, colW, rowH).stroke();

  // Coluna esquerda
  doc.fontSize(9).font('Helvetica-Bold')
     .text('Direito de Uso de Imagem?', tableX + cellPad, tableY + cellPad, { width: colW - 2 * cellPad });
  doc.font('Helvetica').text('(x) Sim ( ) Não', { width: colW - 2 * cellPad });
  doc.font('Helvetica-Bold').text('Período:', { width: colW - 2 * cellPad });
  doc.font('Helvetica').text('Durante 12 meses', { width: colW - 2 * cellPad });

  // Coluna direita
  doc.fontSize(9).font('Helvetica-Bold')
     .text('Canais:', tableX + colW + cellPad, tableY + cellPad, { width: colW - 2 * cellPad });
  doc.font('Helvetica')
     .text('(x) Redes Sociais', { width: colW - 2 * cellPad })
     .text('(x) Anúncios', { width: colW - 2 * cellPad })
     .text('(x) Canais de Comunicação', { width: colW - 2 * cellPad });

  doc.y = tableY + rowH + 15;
  doc.x = 60;

  // 1.2 ENTREGAS
  p('1.2 ENTREGAS', { bold: true, spacing: 0.5 });
  p(contrato.descricao_servicos, { spacing: 1 });

  // ── CLÁUSULA 2ª ──
  heading('Cláusula 2ª - DAS OBRIGAÇÕES DA CONTRATADA');

  p('2.1 É dever da CONTRATADA observar fielmente as condições descritas no OBJETO do presente contrato e seguir detalhamentos do Briefing de Conteúdos;', { spacing: 0.5 });

  p(`2.2 É responsabilidade da CONTRATADA entregar o conteúdo acordado no Briefing de Conteúdos dentro do período de ${prazoEntrega} dias corridos após o recebimento do produto;`, { spacing: 0.5 });

  p('2.3 A CONTRATADA não poderá se fazer substituir por outro usuário na prestação de serviços, uma vez que foi escolhido pela CONTRATANTE em razão das suas características pessoais, tendo o presente contrato, intuitu personae.', { spacing: 1 });

  // ── CLÁUSULA 3ª ──
  heading('Cláusula 3ª - DAS OBRIGAÇÕES DO CONTRATANTE');

  p('3.1 O CONTRATANTE deverá passar para a CONTRATADA todas as informações relacionadas ao produto, como forma de manuseio, vantagens ou características;', { spacing: 0.5 });

  p('3.2 É dever do CONTRATANTE enviar o(s) produto(s) acordados dentro do prazo estipulado para não atrasar a produção de conteúdo;', { spacing: 0.5 });

  p('3.3 A CONTRATADA compromete-se a entregar todos os conteúdos acordados no prazo estipulado no presente contrato. Caso ocorra atraso na entrega, sem justificativa prévia e aceita pela CONTRATANTE, deverá pagar uma multa no valor de R$ 300,00 (trezentos reais) por dia de atraso, a ser paga diretamente à CONTRATANTE, sem prejuízo da rescisão contratual e de eventuais danos e perdas que possam ser reclamados judicialmente.', { spacing: 1 });

  // ── CLÁUSULA 4ª ──
  heading('Cláusula 4ª - REMUNERAÇÃO');

  p(`4.1 A ação produzida pelo CONTRATADO para a CONTRATANTE será remunerado no valor de ${valorFormatado}. Além dos produtos utilizados para filmagem, conforme acordado entre as partes.`, { spacing: 0.5 });

  p('4.2 O pagamento será efetuado exclusivamente após a aprovação final do material, considerando eventuais alterações que não estejam relacionadas ao briefing inicial. A nota fiscal somente poderá ser emitida após a devida aprovação do analista responsável, sendo que a autorização para pagamento ocorrerá após a validação final do conteúdo e o recebimento da nota fiscal correspondente.', { spacing: 1 });

  // ── CLÁUSULA 5ª ──
  heading('Cláusula 5ª - DA AVALIAÇÃO DE PERFORMANCE');

  p('5.1 A execução dos serviços, objeto do presente contrato, passará por avaliação do CONTRATANTE para fins de constatar o cumprimento dos indicadores de produtividade.', { spacing: 0.5 });

  p('5.2 Caso não esteja dentro dos parâmetros acordados no Guia de Conteúdo, é dever da CONTRATADA regravar os conteúdos dentro do prazo de 3 dias corridos.', { spacing: 1 });

  // ── CLÁUSULA 6ª ──
  heading('Cláusula 6ª - DA RESCISÃO');

  p('6.1 Após a entrega, poderão as partes rescindir este contrato, desde que avise previamente e que nenhuma das partes seja lesada.', { spacing: 1 });

  // ── CLÁUSULA 7ª ──
  heading('Cláusula 7ª - DAS CONDIÇÕES GERAIS');

  p('7.1 Fica compactuado entre as partes a total inexistência de vínculo trabalhista entre as partes contratantes, excluindo as obrigações previdenciárias e os encargos sociais, não havendo entre CONTRATADO e CONTRATANTE qualquer tipo de relação de subordinação.', { spacing: 0.5 });

  p('7.2 Fica compactuado entre as partes a total inexistência de vínculo com o cliente para qual será produzido os conteúdos, excluindo as obrigações previdenciárias e os encargos sociais, não havendo entre CONTRATADO e CLIENTE qualquer tipo de relação de subordinação.', { spacing: 1 });

  // ── CLÁUSULA 8ª ──
  heading('Cláusula 8ª - DO FORO');

  p('8.1 Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da Comarca de Vitória, do Estado do Espírito Santo.', { spacing: 1.5 });

  // ── ENCERRAMENTO E ASSINATURAS ──
  p('E por estarem assim, as partes justas e acertadas, firmam o presente contrato:', { spacing: 1.5 });

  p(`Data: Vitória, ${dataAtual}.`, { bold: true, align: 'center', spacing: 3 });

  p('__________________________', { align: 'center', spacing: 0.2 });
  p('TURBO PARTNERS LTDA', { bold: true, align: 'center', spacing: 0.1 });
  p('Roberto Fachetti', { align: 'center', spacing: 3 });

  p('__________________________', { align: 'center', spacing: 0.2 });
  p(creator.nome, { bold: true, align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function formatDateBR(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch { return dateStr; }
}

function numeroPorExtenso(n: number): string {
  const map: Record<number, string> = {
    1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis',
    7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez', 11: 'onze', 12: 'doze',
    18: 'dezoito', 24: 'vinte e quatro', 36: 'trinta e seis',
  };
  return map[n] || String(n);
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
      const { cargo, descricao_servicos, valor_remuneracao, duracao_meses, data_inicio, data_fim, observacoes, qtd_videos, qtd_creators, qtd_variacoes_gancho, unidade_prazo, cliente_nome, cliente_task_id, prazo_entrega_dias } = req.body;

      if (!cargo) return res.status(400).json({ error: "Cargo é obrigatório" });
      if (!descricao_servicos) return res.status(400).json({ error: "Descrição dos serviços é obrigatória" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.contratos_creators
          (creator_id, cargo, descricao_servicos, valor_remuneracao, duracao_meses, data_inicio, data_fim, observacoes, qtd_videos, qtd_creators, qtd_variacoes_gancho, unidade_prazo, cliente_nome, cliente_task_id, prazo_entrega_dias)
        VALUES (
          ${creatorId}, ${cargo}, ${descricao_servicos},
          ${valor_remuneracao || 0}, ${duracao_meses || 6},
          ${data_inicio || null}, ${data_fim || null}, ${observacoes || null},
          ${qtd_videos || null}, ${qtd_creators || null}, ${qtd_variacoes_gancho || null},
          ${unidade_prazo || 'meses'}, ${cliente_nome || null}, ${cliente_task_id || null},
          ${prazo_entrega_dias || null}
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
        SELECT cc.*, c.nome, c.cpf, c.cnpj, c.email, c.endereco, c.cidade, c.estado, c.cep
        FROM cortex_core.contratos_creators cc
        JOIN cortex_core.creators c ON c.id = cc.creator_id
        WHERE cc.id = ${contratoId}
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }

      const row = result.rows[0] as any;
      const pdfBuffer = await gerarContratoCreatorPDF({
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, email: row.email || undefined, endereco: row.endereco, cidade: row.cidade, estado: row.estado, cep: row.cep },
        contrato: {
          cargo: row.cargo || 'prestador de serviços',
          descricao_servicos: row.descricao_servicos || 'conforme acordado entre as partes',
          valor_remuneracao: row.valor_remuneracao?.toString() || '0',
          duracao_meses: row.duracao_meses || 6,
          data_inicio: row.data_inicio || '',
          data_fim: row.data_fim || '',
          qtd_videos: row.qtd_videos || undefined,
          qtd_variacoes_gancho: row.qtd_variacoes_gancho || undefined,
          unidade_prazo: row.unidade_prazo || 'meses',
          cliente_nome: row.cliente_nome || undefined,
          prazo_entrega_dias: row.prazo_entrega_dias || undefined,
        }
      });

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
        db.execute(sql`SELECT account_id, api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'creators' LIMIT 1`),
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

      const pdfBuffer = await gerarContratoCreatorPDF({
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, email: row.email || undefined, endereco: row.endereco, cidade: row.cidade, estado: row.estado, cep: row.cep },
        contrato: {
          cargo: row.cargo || 'prestador de serviços',
          descricao_servicos: row.descricao_servicos || 'conforme acordado entre as partes',
          valor_remuneracao: row.valor_remuneracao?.toString() || '0',
          duracao_meses: row.duracao_meses || 6,
          data_inicio: row.data_inicio || '',
          data_fim: row.data_fim || '',
          qtd_videos: row.qtd_videos || undefined,
          qtd_variacoes_gancho: row.qtd_variacoes_gancho || undefined,
          unidade_prazo: row.unidade_prazo || 'meses',
          cliente_nome: row.cliente_nome || undefined,
          prazo_entrega_dias: row.prazo_entrega_dias || undefined,
        }
      });
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
        { nome: "Roberto Fachetti", email: "roberto.fachetti@turbopartners.com.br" }
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
