import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import crypto from "crypto";

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
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS etapa_pagamento VARCHAR(20)`,
      // Portal token columns
      `ALTER TABLE cortex_core.creators ADD COLUMN IF NOT EXISTS tipo_pessoa VARCHAR(20) NOT NULL DEFAULT 'fisica'`,
      `ALTER TABLE cortex_core.creators ADD COLUMN IF NOT EXISTS portal_token UUID`,
      `ALTER TABLE cortex_core.creators ADD COLUMN IF NOT EXISTS portal_token_criado_em TIMESTAMP`,
      // NF columns on contratos_creators
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS nf_arquivo_path TEXT`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS nf_arquivo_nome TEXT`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS nf_numero VARCHAR(50)`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS nf_valor NUMERIC(10,2)`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS nf_data_emissao DATE`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS nf_anexado_em TIMESTAMP`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS nf_arquivo_data BYTEA`,
      `ALTER TABLE cortex_core.contratos_creators ADD COLUMN IF NOT EXISTS nf_arquivo_mimetype VARCHAR(100)`,
    ];
    for (const ddl of newCols) {
      try { await db.execute(sql.raw(ddl)); } catch { /* column already exists */ }
    }
    // Unique index on portal_token
    try {
      await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_portal_token ON cortex_core.creators(portal_token) WHERE portal_token IS NOT NULL`));
    } catch { /* index already exists */ }
    // Backfill: contratos já assinados entram na primeira etapa do fluxo de pagamento
    await db.execute(sql`UPDATE cortex_core.contratos_creators SET etapa_pagamento = 'producao' WHERE status = 'assinado' AND etapa_pagamento IS NULL`);
    console.log("[creators] Tables ensured");
  } catch (error) {
    console.error("[creators] Error creating tables:", error);
  }
}

// ── PDF Generation ────────────────────────────────────────────────────────────

export interface ContratoCreatorPDFData {
  creator: { nome: string; cpf: string | null; cnpj: string | null; email?: string; endereco: string | null };
  contrato: { cargo: string; descricao_servicos: string; valor_remuneracao: string; duracao_meses: number; data_inicio: string; data_fim: string; qtd_videos?: number; qtd_variacoes_gancho?: number; unidade_prazo?: string; cliente_nome?: string; prazo_entrega_dias?: number };
}

export async function gerarContratoCreatorPDF(
  { creator, contrato }: ContratoCreatorPDFData,
  clausulasOverride?: Record<number, string>
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const valorNum = parseFloat((contrato.valor_remuneracao || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  const valorFormatado = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorExtenso = valorPorExtenso(valorNum);
  const prazoEntrega = 3;
  const prazoExtenso = numeroPorExtenso(prazoEntrega);
  const prazoAjustes = 3;
  const prazoAjustesExtenso = numeroPorExtenso(prazoAjustes);
  const clienteNome = contrato.cliente_nome || 'do cliente';

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

  const bullet = (text: string) => {
    doc.fontSize(10).font('Helvetica')
       .text(`-  ${text}`, 80, undefined, { align: 'left', lineGap: 4, width: 460 });
    doc.moveDown(0.3);
  };

  const romanItem = (text: string) => {
    doc.fontSize(10).font('Helvetica')
       .text(text, 75, undefined, { align: 'justify', lineGap: 4, width: 465 });
    doc.moveDown(0.3);
  };

  const renderOverride = (texto: string) => {
    texto.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      if (line.startsWith('- ')) bullet(line.slice(2));
      else if (/^[IVX]+\s*[–-]/.test(line)) romanItem(line);
      else p(line, { spacing: 0.5 });
    });
    doc.moveDown(0.5);
  };

  // ── TÍTULO ──
  p('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', { bold: true, fontSize: 14, align: 'center', spacing: 1.5 });

  // ── PREÂMBULO ──
  p('Pelo presente instrumento particular de contrato, entre as partes abaixo qualificadas:', { spacing: 0.8 });

  p('Na qualidade de CONTRATANTE: TURBO PARTNERS LTDA, CNPJ 42.100.292/0001-84, com sede na Avenida João Baptista Parra, 633, Edifício Enseada Office, Sala 1301, Praia do Suá, Vitória, ES, CEP 29052-123, na forma de seu contrato social;', { spacing: 0.8 });

  // Monta qualificação da CONTRATADA com dados cadastrais
  const contratadaParts: string[] = [];
  contratadaParts.push(`Na qualidade de CONTRATADA: ${creator.nome}`);
  if (creator.cpf) contratadaParts.push(`CPF ${creator.cpf}`);
  if (creator.cnpj) contratadaParts.push(`CNPJ ${creator.cnpj}`);
  if (creator.endereco) {
    contratadaParts.push(`com endereço em ${creator.endereco}`);
  }
  if (creator.email) contratadaParts.push(`e-mail ${creator.email}`);
  p(`${contratadaParts.join(', ')};`, { spacing: 1 });

  // ── CLÁUSULA 1 - OBJETO ──
  heading('CLÁUSULA 1 - OBJETO');
  if (clausulasOverride?.[0]) {
    renderOverride(clausulasOverride[0]);
  } else {
    p(`1.1 O presente contrato tem por objeto a prestação de serviços de criação de conteúdo audiovisual publicitário, bem como a cessão de direitos de imagem e de utilização do conteúdo produzido, destinados à divulgação da marca ${clienteNome}.`, { spacing: 0.5 });

    p('1.2 O conteúdo deverá observar as diretrizes constantes no briefing de campanha, que passa a integrar o presente contrato como documento complementar.', { spacing: 0.5 });

    p('1.3 A CONTRATADA compromete-se a produzir:', { spacing: 0.3 });

    // Quantidades de vídeos e variações de gancho
    if (contrato.qtd_videos) {
      bullet(`${contrato.qtd_videos} (${numeroPorExtenso(contrato.qtd_videos)}) vídeo(s) de conteúdo`);
    }
    if (contrato.qtd_variacoes_gancho) {
      bullet(`${contrato.qtd_variacoes_gancho} (${numeroPorExtenso(contrato.qtd_variacoes_gancho)}) variação(ões) de gancho`);
    }

    // Entregas adicionais como bullet list
    const entregas = contrato.descricao_servicos.split(/\n|;/).map(s => s.trim()).filter(Boolean);
    if (entregas.length > 0) {
      for (const entrega of entregas) {
        bullet(entrega);
      }
    } else if (!contrato.qtd_videos && !contrato.qtd_variacoes_gancho) {
      bullet('Conteúdo conforme briefing de campanha.');
    }
    doc.moveDown(0.5);
  }

  // ── CLÁUSULA 2 ──
  heading('CLÁUSULA 2 - DAS OBRIGAÇÕES DA CONTRATADA');
  if (clausulasOverride?.[1]) {
    renderOverride(clausulasOverride[1]);
  } else {
    p('2.1. A CONTRATADA obriga-se a produzir o conteúdo objeto deste contrato em estrita conformidade com as diretrizes, orientações e especificações constantes no briefing de campanha fornecido pela CONTRATANTE, o qual passa a integrar o presente instrumento para todos os fins de direito.', { spacing: 0.5 });

    p('2.2. O conteúdo produzido deverá atender a padrões mínimos de qualidade técnica e editorial compatíveis com a finalidade publicitária da campanha, devendo observar, entre outros aspectos, adequada captação de áudio, iluminação suficiente para a correta visualização do produto, enquadramento apropriado da imagem e fidelidade às informações e características do produto ou serviço divulgado.', { spacing: 0.5 });

    p('2.3. A CONTRATADA compromete-se, ainda, a conduzir a produção do conteúdo de forma diligente e profissional, abstendo-se de realizar quaisquer manifestações, condutas ou inserções que possam comprometer a reputação, a imagem institucional ou os interesses comerciais da CONTRATANTE ou da marca objeto da campanha.', { spacing: 0.5 });

    p('2.4. A CONTRATANTE poderá solicitar ajustes técnicos ou editoriais no material entregue sempre que verificar desconformidade com o briefing, com os padrões de qualidade exigidos ou com as diretrizes da campanha, hipótese em que a CONTRATADA deverá proceder às adequações necessárias, sem custo adicional, nos termos deste contrato.', { spacing: 1 });
  }

  // ── CLÁUSULA 3 ──
  heading('CLÁUSULA 3 – DAS OBRIGAÇÕES DA CONTRATANTE');
  if (clausulasOverride?.[2]) {
    renderOverride(clausulasOverride[2]);
  } else {
    p('3.1. Compete à CONTRATANTE fornecer à CONTRATADA todas as informações necessárias à adequada execução do conteúdo contratado, incluindo, entre outras, orientações relativas ao produto, forma de utilização, características, diferenciais e demais elementos relevantes para a correta elaboração do material.', { spacing: 0.5 });

    p('3.2. Constitui obrigação da CONTRATANTE encaminhar à CONTRATADA o(s) produto(s) objeto da campanha dentro do prazo previamente acordado entre as partes, de modo a não comprometer o cronograma de produção do conteúdo.', { spacing: 0.5 });

    p('3.3. A CONTRATANTE deverá disponibilizar à CONTRATADA o briefing da campanha, bem como quaisquer diretrizes, orientações ou materiais complementares necessários à correta execução do conteúdo.', { spacing: 1 });
  }

  // ── CLÁUSULA 4 ──
  heading('CLÁUSULA 4 – DO PRAZO DE ENTREGA');
  if (clausulasOverride?.[3]) {
    renderOverride(clausulasOverride[3]);
  } else {
    p(`4.1 A CONTRATADA obriga-se a produzir e entregar o conteúdo audiovisual previsto no briefing no prazo máximo de ${String(prazoEntrega).padStart(2, '0')} (${prazoExtenso}) dias corridos, contados do recebimento do produto objeto da campanha, comprovado por registro de entrega ou confirmação eletrônica.`, { spacing: 0.5 });

    p('4.2 É dever da CONTRATADA observar fielmente as condições descritas no OBJETO do presente contrato e seguir detalhamentos do Briefing de Conteúdos;', { spacing: 0.5 });

    p('4.3 Eventual prorrogação do prazo somente será admitida mediante concordância expressa da CONTRATANTE.', { spacing: 0.5 });

    p('4.4. O atraso injustificado na entrega do conteúdo contratado sujeitará a CONTRATADA ao pagamento de multa moratória no valor de R$ 150,00 (cento e cinquenta reais) por dia de atraso, limitada ao montante máximo equivalente a 10 (dez) vezes o valor da remuneração contratada, sem prejuízo:', { spacing: 0.3 });

    romanItem('I – da possibilidade de rescisão imediata do contrato por inadimplemento;');
    romanItem('II – da cobrança de eventuais perdas e danos, nos termos dos arts. 389, 395 e 402 do Código Civil;');
    romanItem('III – da obrigação de restituição de eventuais valores antecipados.');
    doc.moveDown(0.5);
  }

  // ── CLÁUSULA 5 ──
  heading('CLÁUSULA 5 – DA AVALIAÇÃO, CORREÇÃO E REGRAVAÇÃO DO CONTEÚDO');
  if (clausulasOverride?.[4]) {
    renderOverride(clausulasOverride[4]);
  } else {
    p('5.1. O conteúdo produzido será submetido à avaliação da CONTRATANTE, que verificará sua conformidade com o briefing, com as diretrizes da campanha e com os padrões técnicos exigidos.', { spacing: 0.5 });

    p('5.2. Caso o material apresentado não esteja em conformidade com as especificações da campanha ou apresente inconsistências técnicas ou editoriais, a CONTRATADA obriga-se a realizar as correções ou regravações necessárias.', { spacing: 0.5 });

    p('5.3. As adequações poderão compreender, entre outras medidas:', { spacing: 0.3 });

    romanItem('I – regravação total ou parcial do conteúdo;');
    romanItem('II – correção de falas ou informações veiculadas;');
    romanItem('III – ajustes técnicos de áudio, iluminação ou enquadramento;');
    romanItem('IV – adequação do roteiro às diretrizes da campanha.');
    doc.moveDown(0.3);

    p(`5.4. A nova versão do conteúdo deverá ser entregue no prazo máximo de ${String(prazoAjustes).padStart(2, '0')} (${prazoAjustesExtenso}) dias corridos, contados da solicitação de ajustes pela CONTRATANTE.`, { spacing: 1 });
  }

  // ── CLÁUSULA 6 ──
  heading('CLÁUSULA 6 – DOS PRODUTOS ENVIADOS PARA GRAVAÇÃO');
  if (clausulasOverride?.[5]) {
    renderOverride(clausulasOverride[5]);
  } else {
    p('6.1. Os produtos enviados pela CONTRATANTE destinam-se exclusivamente à produção do conteúdo objeto deste contrato.', { spacing: 0.5 });

    p('6.2. A CONTRATADA será responsável pela guarda, conservação e utilização adequada dos produtos desde o momento do recebimento até a conclusão da campanha.', { spacing: 0.5 });

    p('6.3. A CONTRATADA responderá por eventuais danos, extravio ou deterioração dos produtos decorrentes de culpa, negligência ou uso inadequado.', { spacing: 1 });
  }

  // ── CLÁUSULA 7 ──
  heading('CLÁUSULA 7 – DA CESSÃO DE DIREITOS DE IMAGEM E CONTEÚDO');
  if (clausulasOverride?.[6]) {
    renderOverride(clausulasOverride[6]);
  } else {
    p('7.1. A CONTRATADA autoriza a utilização de sua imagem, voz, nome e demais elementos de identificação pessoal pela CONTRATANTE, exclusivamente para fins de divulgação da campanha objeto deste contrato.', { spacing: 0.5 });

    p('7.2. A autorização de uso será válida pelo prazo de 12 (doze) meses, contado da aprovação final do conteúdo.', { spacing: 0.5 });

    p('7.3. Nos termos da Lei nº 9.610/1998, a CONTRATADA cede à CONTRATANTE os direitos patrimoniais de utilização do conteúdo produzido, limitados às finalidades e ao período previstos neste contrato.', { spacing: 1 });
  }

  // ── CLÁUSULA 8 ──
  heading('CLÁUSULA 8 – DA REMUNERAÇÃO');
  if (clausulasOverride?.[7]) {
    renderOverride(clausulasOverride[7]);
  } else {
    p(`8.1. Pela execução dos serviços objeto deste contrato, a CONTRATADA receberá a remuneração total de ${valorFormatado} (${valorExtenso}), além dos produtos utilizados para a gravação do conteúdo.`, { spacing: 0.5 });

    p('8.2. O pagamento da remuneração prevista neste contrato será realizado somente após a aprovação final do material pela CONTRATANTE, considerando-se eventuais ajustes ou alterações que forem solicitadas.', { spacing: 0.5 });

    p('8.3. A nota fiscal somente poderá ser emitida pela CONTRATADA após a aprovação do conteúdo pelo responsável designado pela CONTRATANTE.', { spacing: 0.5 });

    p('8.4. Após a emissão da nota fiscal, o pagamento será efetuado pela CONTRATANTE no prazo de até 07 (sete) dias úteis, contados do seu recebimento e da validação final do conteúdo entregue.', { spacing: 1 });
  }

  // ── CLÁUSULA 9 ──
  heading('CLÁUSULA 9 – DA CONFIDENCIALIDADE');
  if (clausulasOverride?.[8]) {
    renderOverride(clausulasOverride[8]);
  } else {
    p('9.1. A CONTRATADA compromete-se a manter absoluto sigilo sobre quaisquer informações relacionadas à campanha, produtos, estratégias de marketing ou materiais promocionais fornecidos pela CONTRATANTE.', { spacing: 0.5 });

    p('9.2. É vedada a divulgação antecipada de produtos, campanhas ou quaisquer informações que ainda não tenham sido tornadas públicas.', { spacing: 0.5 });

    p('9.3. O descumprimento desta cláusula sujeitará a CONTRATADA ao pagamento de multa equivalente a 10 (dez) vezes o valor da remuneração contratada, sem prejuízo da indenização por eventuais danos.', { spacing: 1 });
  }

  // ── CLÁUSULA 10 ──
  heading('CLÁUSULA 10 – DA RESCISÃO');
  if (clausulasOverride?.[9]) {
    renderOverride(clausulasOverride[9]);
  } else {
    p('10.1. Caso a CONTRATADA promova a rescisão do presente contrato sem justa causa antes da conclusão das obrigações assumidas, ficará sujeita ao pagamento de multa compensatória equivalente a 05 (cinco) vezes o valor total da remuneração contratada, sem prejuízo da reparação de eventuais prejuízos adicionais suportados pela CONTRATANTE.', { spacing: 0.5 });

    p('Parágrafo Primeiro. Esta ficará igualmente obrigada a devolver à CONTRATANTE, no prazo máximo de 03 (três) dias corridos, contados da comunicação da rescisão, todos os produtos que lhe tenham sido enviados para fins de produção do conteúdo.', { spacing: 0.5 });

    p('10.2. O não cumprimento do prazo de devolução previsto na cláusula anterior sujeitará a CONTRATADA ao pagamento de multa adicional diária de 20% (vinte por cento) equivalente ao valor do produto retido, até a efetiva devolução do produto, sem prejuízo da cobrança do valor integral correspondente ao bem caso este não seja restituído.', { spacing: 1 });
  }

  // ── CLÁUSULA 11 ──
  heading('CLÁUSULA 11 – DA NATUREZA JURÍDICA DA RELAÇÃO');
  if (clausulasOverride?.[10]) {
    renderOverride(clausulasOverride[10]);
  } else {
    p('11.1. O presente contrato possui natureza estritamente civil, inexistindo vínculo empregatício entre as partes.', { spacing: 0.5 });

    p('11.2. A CONTRATADA atuará com autonomia técnica e organizacional, inexistindo relação de subordinação jurídica.', { spacing: 1 });
  }

  // ── CLÁUSULA 12 ──
  heading('CLÁUSULA 12 – DO FORO');
  if (clausulasOverride?.[11]) {
    renderOverride(clausulasOverride[11]);
  } else {
    p('12.1. Para dirimir quaisquer controvérsias decorrentes deste contrato, as partes elegem o Foro da Comarca de Vitória, Estado do Espírito Santo, com renúncia expressa a qualquer outro, por mais privilegiado que seja.', { spacing: 1.5 });
  }

  // ── ENCERRAMENTO E ASSINATURAS ──
  p('E por estarem assim, as partes justas e acertadas, firmam o presente contrato:', { spacing: 1.5 });

  p(`Data: Vitória, ${dataAtual}.`, { bold: true, align: 'center', spacing: 3 });

  p('__________________________', { align: 'center', spacing: 0.2 });
  p('TURBO PARTNERS LTDA', { bold: true, align: 'center', spacing: 0.1 });
  p('Rodrigo Queiroz', { align: 'center', spacing: 3 });

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

export interface ClausulaTexto {
  index: number;
  titulo: string;
  texto: string;
}

export function gerarTextosClausulas(data: ContratoCreatorPDFData): ClausulaTexto[] {
  const { contrato } = data;
  const valorNum = parseFloat((contrato.valor_remuneracao || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  const valorFormatado = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorExtenso = valorPorExtenso(valorNum);
  const prazoEntrega = 3;
  const prazoExtenso = numeroPorExtenso(prazoEntrega);
  const prazoAjustes = 3;
  const prazoAjustesExtenso = numeroPorExtenso(prazoAjustes);
  const clienteNome = contrato.cliente_nome || 'do cliente';
  const entregas = (contrato.descricao_servicos || '').split(/\n|;/).map(s => s.trim()).filter(Boolean);

  return [
    {
      index: 0,
      titulo: 'CLÁUSULA 1 - OBJETO',
      texto: [
        `1.1 O presente contrato tem por objeto a prestação de serviços de criação de conteúdo audiovisual publicitário, bem como a cessão de direitos de imagem e de utilização do conteúdo produzido, destinados à divulgação da marca ${clienteNome}.`,
        '1.2 O conteúdo deverá observar as diretrizes constantes no briefing de campanha, que passa a integrar o presente contrato como documento complementar.',
        '1.3 A CONTRATADA compromete-se a produzir:',
        ...(contrato.qtd_videos ? [`- ${contrato.qtd_videos} (${numeroPorExtenso(contrato.qtd_videos)}) vídeo(s) de conteúdo`] : []),
        ...(contrato.qtd_variacoes_gancho ? [`- ${contrato.qtd_variacoes_gancho} (${numeroPorExtenso(contrato.qtd_variacoes_gancho)}) variação(ões) de gancho`] : []),
        ...entregas.map(e => `- ${e}`),
        ...(entregas.length === 0 && !contrato.qtd_videos && !contrato.qtd_variacoes_gancho
          ? ['- Conteúdo conforme briefing de campanha.']
          : []),
      ].join('\n\n'),
    },
    {
      index: 1,
      titulo: 'CLÁUSULA 2 - DAS OBRIGAÇÕES DA CONTRATADA',
      texto: [
        '2.1. A CONTRATADA obriga-se a produzir o conteúdo objeto deste contrato em estrita conformidade com as diretrizes, orientações e especificações constantes no briefing de campanha fornecido pela CONTRATANTE, o qual passa a integrar o presente instrumento para todos os fins de direito.',
        '2.2. O conteúdo produzido deverá atender a padrões mínimos de qualidade técnica e editorial compatíveis com a finalidade publicitária da campanha, devendo observar, entre outros aspectos, adequada captação de áudio, iluminação suficiente para a correta visualização do produto, enquadramento apropriado da imagem e fidelidade às informações e características do produto ou serviço divulgado.',
        '2.3. A CONTRATADA compromete-se, ainda, a conduzir a produção do conteúdo de forma diligente e profissional, abstendo-se de realizar quaisquer manifestações, condutas ou inserções que possam comprometer a reputação, a imagem institucional ou os interesses comerciais da CONTRATANTE ou da marca objeto da campanha.',
        '2.4. A CONTRATANTE poderá solicitar ajustes técnicos ou editoriais no material entregue sempre que verificar desconformidade com o briefing, com os padrões de qualidade exigidos ou com as diretrizes da campanha, hipótese em que a CONTRATADA deverá proceder às adequações necessárias, sem custo adicional, nos termos deste contrato.',
      ].join('\n\n'),
    },
    {
      index: 2,
      titulo: 'CLÁUSULA 3 – DAS OBRIGAÇÕES DA CONTRATANTE',
      texto: [
        '3.1. Compete à CONTRATANTE fornecer à CONTRATADA todas as informações necessárias à adequada execução do conteúdo contratado, incluindo, entre outras, orientações relativas ao produto, forma de utilização, características, diferenciais e demais elementos relevantes para a correta elaboração do material.',
        '3.2. Constitui obrigação da CONTRATANTE encaminhar à CONTRATADA o(s) produto(s) objeto da campanha dentro do prazo previamente acordado entre as partes, de modo a não comprometer o cronograma de produção do conteúdo.',
        '3.3. A CONTRATANTE deverá disponibilizar à CONTRATADA o briefing da campanha, bem como quaisquer diretrizes, orientações ou materiais complementares necessários à correta execução do conteúdo.',
      ].join('\n\n'),
    },
    {
      index: 3,
      titulo: 'CLÁUSULA 4 – DO PRAZO DE ENTREGA',
      texto: [
        `4.1 A CONTRATADA obriga-se a produzir e entregar o conteúdo audiovisual previsto no briefing no prazo máximo de ${String(prazoEntrega).padStart(2, '0')} (${prazoExtenso}) dias corridos, contados do recebimento do produto objeto da campanha, comprovado por registro de entrega ou confirmação eletrônica.`,
        '4.2 É dever da CONTRATADA observar fielmente as condições descritas no OBJETO do presente contrato e seguir detalhamentos do Briefing de Conteúdos;',
        '4.3 Eventual prorrogação do prazo somente será admitida mediante concordância expressa da CONTRATANTE.',
        '4.4. O atraso injustificado na entrega do conteúdo contratado sujeitará a CONTRATADA ao pagamento de multa moratória no valor de R$ 150,00 (cento e cinquenta reais) por dia de atraso, limitada ao montante máximo equivalente a 10 (dez) vezes o valor da remuneração contratada, sem prejuízo:\n\nI – da possibilidade de rescisão imediata do contrato por inadimplemento;\nII – da cobrança de eventuais perdas e danos, nos termos dos arts. 389, 395 e 402 do Código Civil;\nIII – da obrigação de restituição de eventuais valores antecipados.',
      ].join('\n\n'),
    },
    {
      index: 4,
      titulo: 'CLÁUSULA 5 – DA AVALIAÇÃO, CORREÇÃO E REGRAVAÇÃO DO CONTEÚDO',
      texto: [
        '5.1. O conteúdo produzido será submetido à avaliação da CONTRATANTE, que verificará sua conformidade com o briefing, com as diretrizes da campanha e com os padrões técnicos exigidos.',
        '5.2. Caso o material apresentado não esteja em conformidade com as especificações da campanha ou apresente inconsistências técnicas ou editoriais, a CONTRATADA obriga-se a realizar as correções ou regravações necessárias.',
        '5.3. As adequações poderão compreender, entre outras medidas:\n\nI – regravação total ou parcial do conteúdo;\nII – correção de falas ou informações veiculadas;\nIII – ajustes técnicos de áudio, iluminação ou enquadramento;\nIV – adequação do roteiro às diretrizes da campanha.',
        `5.4. A nova versão do conteúdo deverá ser entregue no prazo máximo de ${String(prazoAjustes).padStart(2, '0')} (${prazoAjustesExtenso}) dias corridos, contados da solicitação de ajustes pela CONTRATANTE.`,
      ].join('\n\n'),
    },
    {
      index: 5,
      titulo: 'CLÁUSULA 6 – DOS PRODUTOS ENVIADOS PARA GRAVAÇÃO',
      texto: [
        '6.1. Os produtos enviados pela CONTRATANTE destinam-se exclusivamente à produção do conteúdo objeto deste contrato.',
        '6.2. A CONTRATADA será responsável pela guarda, conservação e utilização adequada dos produtos desde o momento do recebimento até a conclusão da campanha.',
        '6.3. A CONTRATADA responderá por eventuais danos, extravio ou deterioração dos produtos decorrentes de culpa, negligência ou uso inadequado.',
      ].join('\n\n'),
    },
    {
      index: 6,
      titulo: 'CLÁUSULA 7 – DA CESSÃO DE DIREITOS DE IMAGEM E CONTEÚDO',
      texto: [
        '7.1. A CONTRATADA autoriza a utilização de sua imagem, voz, nome e demais elementos de identificação pessoal pela CONTRATANTE, exclusivamente para fins de divulgação da campanha objeto deste contrato.',
        '7.2. A autorização de uso será válida pelo prazo de 12 (doze) meses, contado da aprovação final do conteúdo.',
        '7.3. Nos termos da Lei nº 9.610/1998, a CONTRATADA cede à CONTRATANTE os direitos patrimoniais de utilização do conteúdo produzido, limitados às finalidades e ao período previstos neste contrato.',
      ].join('\n\n'),
    },
    {
      index: 7,
      titulo: 'CLÁUSULA 8 – DA REMUNERAÇÃO',
      texto: [
        `8.1. Pela execução dos serviços objeto deste contrato, a CONTRATADA receberá a remuneração total de ${valorFormatado} (${valorExtenso}), além dos produtos utilizados para a gravação do conteúdo.`,
        '8.2. O pagamento da remuneração prevista neste contrato será realizado somente após a aprovação final do material pela CONTRATANTE, considerando-se eventuais ajustes ou alterações que forem solicitadas.',
        '8.3. A nota fiscal somente poderá ser emitida pela CONTRATADA após a aprovação do conteúdo pelo responsável designado pela CONTRATANTE.',
        '8.4. Após a emissão da nota fiscal, o pagamento será efetuado pela CONTRATANTE no prazo de até 07 (sete) dias úteis, contados do seu recebimento e da validação final do conteúdo entregue.',
      ].join('\n\n'),
    },
    {
      index: 8,
      titulo: 'CLÁUSULA 9 – DA CONFIDENCIALIDADE',
      texto: [
        '9.1. A CONTRATADA compromete-se a manter absoluto sigilo sobre quaisquer informações relacionadas à campanha, produtos, estratégias de marketing ou materiais promocionais fornecidos pela CONTRATANTE.',
        '9.2. É vedada a divulgação antecipada de produtos, campanhas ou quaisquer informações que ainda não tenham sido tornadas públicas.',
        '9.3. O descumprimento desta cláusula sujeitará a CONTRATADA ao pagamento de multa equivalente a 10 (dez) vezes o valor da remuneração contratada, sem prejuízo da indenização por eventuais danos.',
      ].join('\n\n'),
    },
    {
      index: 9,
      titulo: 'CLÁUSULA 10 – DA RESCISÃO',
      texto: [
        '10.1. Caso a CONTRATADA promova a rescisão do presente contrato sem justa causa antes da conclusão das obrigações assumidas, ficará sujeita ao pagamento de multa compensatória equivalente a 05 (cinco) vezes o valor total da remuneração contratada, sem prejuízo da reparação de eventuais prejuízos adicionais suportados pela CONTRATANTE.',
        'Parágrafo Primeiro. Esta ficará igualmente obrigada a devolver à CONTRATANTE, no prazo máximo de 03 (três) dias corridos, contados da comunicação da rescisão, todos os produtos que lhe tenham sido enviados para fins de produção do conteúdo.',
        '10.2. O não cumprimento do prazo de devolução previsto na cláusula anterior sujeitará a CONTRATADA ao pagamento de multa adicional diária de 20% (vinte por cento) equivalente ao valor do produto retido, até a efetiva devolução do produto, sem prejuízo da cobrança do valor integral correspondente ao bem caso este não seja restituído.',
      ].join('\n\n'),
    },
    {
      index: 10,
      titulo: 'CLÁUSULA 11 – DA NATUREZA JURÍDICA DA RELAÇÃO',
      texto: [
        '11.1. O presente contrato possui natureza estritamente civil, inexistindo vínculo empregatício entre as partes.',
        '11.2. A CONTRATADA atuará com autonomia técnica e organizacional, inexistindo relação de subordinação jurídica.',
      ].join('\n\n'),
    },
    {
      index: 11,
      titulo: 'CLÁUSULA 12 – DO FORO',
      texto: '12.1. Para dirimir quaisquer controvérsias decorrentes deste contrato, as partes elegem o Foro da Comarca de Vitória, Estado do Espírito Santo, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
    },
  ];
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

  // GET /api/creators/contratos/todos — Todos os contratos com nome do creator
  app.get("/api/creators/contratos/todos", async (req, res) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      let query = `
        SELECT cc.*, cr.nome AS creator_nome, cr.email AS creator_email
        FROM cortex_core.contratos_creators cc
        JOIN cortex_core.creators cr ON cr.id = cc.creator_id
        WHERE cc.status != 'excluido'
      `;
      if (statusFilter) {
        query += ` AND cc.status = '${statusFilter.replace(/'/g, "''")}'`;
      }
      query += ` ORDER BY cc.criado_em DESC`;
      const result = await db.execute(sql.raw(query));
      res.json(result.rows);
    } catch (error: any) {
      console.error("[creators] Erro ao listar todos os contratos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/creators/pagamentos — Contratos no fluxo de pagamento
  app.get("/api/creators/pagamentos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT cc.id, cc.creator_id, cc.cargo, cc.cliente_nome, cc.valor_remuneracao,
               cc.assinado_em, cc.etapa_pagamento, cc.observacoes, cc.atualizado_em,
               cc.prazo_entrega_dias,
               cc.nf_arquivo_nome, cc.nf_numero, cc.nf_valor, cc.nf_data_emissao, cc.nf_anexado_em,
               cr.nome AS creator_nome, cr.email AS creator_email,
               cr.chave_pix, cr.tipo_pix
        FROM cortex_core.contratos_creators cc
        JOIN cortex_core.creators cr ON cr.id = cc.creator_id
        WHERE cc.etapa_pagamento IS NOT NULL
        ORDER BY cc.atualizado_em DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[creators] Erro ao listar pagamentos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/creators/contratos/:id/nf — Download NF (equipe interna)
  app.get("/api/creators/contratos/:id/nf", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const result = await db.execute(sql`
        SELECT nf_arquivo_data, nf_arquivo_nome, nf_arquivo_mimetype
        FROM cortex_core.contratos_creators WHERE id = ${id} LIMIT 1
      `);
      const row = (result.rows as any[])[0];
      if (!row?.nf_arquivo_data) return res.status(404).json({ error: "NF não encontrada" });

      const buffer = Buffer.isBuffer(row.nf_arquivo_data) ? row.nf_arquivo_data : Buffer.from(row.nf_arquivo_data);
      res.set({
        "Content-Type": row.nf_arquivo_mimetype || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${row.nf_arquivo_nome || "nf.pdf"}"`,
        "Content-Length": String(buffer.length),
      });
      res.send(buffer);
    } catch (error: any) {
      console.error("[creators] Erro ao baixar NF:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/creators/contratos/:id/etapa-pagamento — Mover contrato entre etapas
  app.patch("/api/creators/contratos/:id/etapa-pagamento", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { etapa_pagamento } = req.body;
      const validEtapas = ['producao', 'aguardando_aprovacao', 'aprovado', 'pago'];
      if (!validEtapas.includes(etapa_pagamento)) {
        return res.status(400).json({ error: `Etapa inválida. Valores aceitos: ${validEtapas.join(', ')}` });
      }
      const result = await db.execute(sql`
        UPDATE cortex_core.contratos_creators
        SET etapa_pagamento = ${etapa_pagamento}, atualizado_em = NOW()
        WHERE id = ${id} AND status = 'assinado'
        RETURNING *
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado ou não está assinado" });
      }
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[creators] Erro ao atualizar etapa pagamento:", error);
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
      const { tipo_pessoa, nome, cpf, cnpj, email, endereco, cidade, estado, cep, chave_pix, tipo_pix, observacoes } = req.body;

      if (!tipo_pessoa || !['fisica', 'juridica', 'ambos'].includes(tipo_pessoa)) return res.status(400).json({ error: "Tipo de pessoa é obrigatório (fisica, juridica ou ambos)" });
      if (!nome) return res.status(400).json({ error: "Nome é obrigatório" });
      if (!email) return res.status(400).json({ error: "Email é obrigatório" });
      if ((tipo_pessoa === 'fisica' || tipo_pessoa === 'ambos') && !cpf) return res.status(400).json({ error: "CPF é obrigatório para pessoa física" });
      if ((tipo_pessoa === 'juridica' || tipo_pessoa === 'ambos') && !cnpj) return res.status(400).json({ error: "CNPJ é obrigatório para pessoa jurídica" });
      if (!endereco) return res.status(400).json({ error: "Endereço é obrigatório" });
      if (!tipo_pix) return res.status(400).json({ error: "Tipo PIX é obrigatório" });
      if (!chave_pix) return res.status(400).json({ error: "Chave PIX é obrigatória" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.creators (tipo_pessoa, nome, cpf, cnpj, email, endereco, cidade, estado, cep, chave_pix, tipo_pix, observacoes)
        VALUES (${tipo_pessoa}, ${nome}, ${cpf || null}, ${cnpj || null}, ${email}, ${endereco || null}, ${cidade || null}, ${estado || null}, ${cep || null}, ${chave_pix || null}, ${tipo_pix || null}, ${observacoes || null})
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
      const { tipo_pessoa, nome, cpf, cnpj, email, endereco, cidade, estado, cep, chave_pix, tipo_pix, observacoes } = req.body;

      const result = await db.execute(sql`
        UPDATE cortex_core.creators SET
          tipo_pessoa = COALESCE(${tipo_pessoa || null}, tipo_pessoa),
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
        SELECT * FROM cortex_core.contratos_creators WHERE creator_id = ${creatorId} AND status != 'excluido' ORDER BY criado_em DESC
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

  // GET /api/creators/contratos/:id/clausulas — Retorna textos das cláusulas como JSON
  app.get("/api/creators/contratos/:id/clausulas", async (req, res) => {
    try {
      const contratoId = parseInt(req.params.id);
      const result = await db.execute(sql`
        SELECT cc.*, c.nome, c.cpf, c.cnpj, c.email, c.endereco
        FROM cortex_core.contratos_creators cc
        JOIN cortex_core.creators c ON c.id = cc.creator_id
        WHERE cc.id = ${contratoId}
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }
      const row = result.rows[0] as any;
      const clausulas = gerarTextosClausulas({
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, email: row.email || undefined, endereco: row.endereco },
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
        },
      });
      res.json(clausulas);
    } catch (error: any) {
      console.error("[creators] Erro ao gerar cláusulas:", error);
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
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, email: row.email || undefined, endereco: row.endereco },
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

  // POST /api/creators/contratos/:id/preview-pdf-with-overrides — Preview PDF com edições
  app.post("/api/creators/contratos/:id/preview-pdf-with-overrides", async (req, res) => {
    try {
      const contratoId = parseInt(req.params.id);
      const clausulasEditadas: Record<number, string> | undefined = req.body?.clausulasEditadas;

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
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, email: row.email || undefined, endereco: row.endereco },
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
      }, clausulasEditadas);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=contrato_creator_${contratoId}_preview.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("[creators] Erro ao gerar preview com overrides:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/creators/contratos/:id/enviar-assinatura — Gerar PDF + enviar Assinafy
  app.post("/api/creators/contratos/:id/enviar-assinatura", async (req, res) => {
    const contratoId = parseInt(req.params.id);
    const clausulasEditadas: Record<number, string> | undefined = req.body?.clausulasEditadas;
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
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, email: row.email || undefined, endereco: row.endereco },
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
      }, clausulasEditadas);
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
        { nome: "Rodrigo Queiroz", email: "rodrigo.queiroz@turbopartners.com.br" }
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

  // GET /api/creators/contratos/:id/signing-url — Buscar link de assinatura do Assinafy
  app.get("/api/creators/contratos/:id/signing-url", async (req, res) => {
    const contratoId = parseInt(req.params.id);
    try {
      const [configResult, dataResult] = await Promise.all([
        db.execute(sql`SELECT api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'creators' LIMIT 1`),
        db.execute(sql`
          SELECT cc.assinafy_document_id, c.email AS creator_email
          FROM cortex_core.contratos_creators cc
          JOIN cortex_core.creators c ON c.id = cc.creator_id
          WHERE cc.id = ${contratoId}
        `)
      ]);

      const config = configResult.rows[0] as any;
      if (!config?.api_key) return res.status(500).json({ error: "Config Assinafy não encontrada" });

      const data = dataResult.rows[0] as any;
      if (!data) return res.status(404).json({ error: "Contrato não encontrado" });
      if (!data.assinafy_document_id) return res.status(400).json({ error: "Contrato não foi enviado para assinatura" });

      const resp = await fetch(`${config.api_url}/documents/${data.assinafy_document_id}`, {
        method: 'GET',
        headers: { 'X-Api-Key': config.api_key }
      });

      if (!resp.ok) {
        return res.status(resp.status).json({ error: `Erro ao buscar documento: HTTP ${resp.status}` });
      }

      const result = await resp.json() as any;
      const doc = result.data || {};
      const assignment = doc.assignment || {};
      const rawSigners = Array.isArray(assignment.signers) ? assignment.signers : [];
      const items = Array.isArray(assignment.items) ? assignment.items : [];

      const signingUrls = Array.isArray(assignment.signing_urls) ? assignment.signing_urls : [];

      // Build signer list with completion status and signing URL
      const signers = rawSigners.map((s: any) => {
        const item = items.find((it: any) => it.signer?.id === s.id);
        const signed = item?.completed === true || item?.value === 'SIGNED';
        const signingEntry = signingUrls.find((su: any) => su.signer_id === s.id);
        return {
          name: s.full_name || '',
          email: s.email || '',
          url: signingEntry?.url || '',
          status: signed ? 'signed' : 'pending',
        };
      });

      const creatorSigner = signers.find((s: any) => s.email?.toLowerCase() === data.creator_email?.toLowerCase());

      res.json({
        url: creatorSigner?.url || signers[0]?.url || doc.signing_url || '',
        signers,
      });
    } catch (error: any) {
      console.error("[assinafy-signing-url] Erro:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/creators/contratos/sync-assinaturas — Sync manual dos status de assinatura
  app.post("/api/creators/contratos/sync-assinaturas", async (_req, res) => {
    try {
      const configResult = await db.execute(sql`
        SELECT api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'creators' LIMIT 1
      `);
      const config = configResult.rows[0] as any;
      if (!config?.api_key) {
        return res.status(500).json({ error: "Config Assinafy creators não encontrada" });
      }

      const pendingResult = await db.execute(sql`
        SELECT id, assinafy_document_id, status, assinafy_status
        FROM cortex_core.contratos_creators
        WHERE assinafy_document_id IS NOT NULL
          AND status = 'enviado'
          AND assinado_em IS NULL
      `);

      const pending = pendingResult.rows as any[];
      if (pending.length === 0) {
        return res.json({ message: "Nenhum contrato pendente", updated: 0, total: 0 });
      }

      let updated = 0;
      const details: any[] = [];

      for (const c of pending) {
        try {
          const resp = await fetch(`${config.api_url}/documents/${c.assinafy_document_id}`, {
            method: 'GET',
            headers: { 'X-Api-Key': config.api_key }
          });

          if (!resp.ok) {
            // Se 403/404, documento é inacessível — resetar para rascunho para permitir reenvio
            if (resp.status === 403 || resp.status === 404) {
              await db.execute(sql`
                UPDATE cortex_core.contratos_creators
                SET status = 'rascunho', assinafy_status = NULL, assinafy_document_id = NULL, enviado_em = NULL, atualizado_em = NOW()
                WHERE id = ${c.id}
              `);
              details.push({ id: c.id, docId: c.assinafy_document_id, error: `HTTP ${resp.status}`, action: 'reset_rascunho' });
              updated++;
            } else {
              details.push({ id: c.id, docId: c.assinafy_document_id, error: `HTTP ${resp.status}` });
            }
            continue;
          }

          const result = await resp.json() as any;
          const docStatus = result.data?.status || (typeof result.status === 'string' ? result.status : null);

          const isAssinado = docStatus === 'signed' || docStatus === 'completed' || docStatus === 'certificated';
          const isRecusado = docStatus === 'declined';

          if (isAssinado) {
            await db.execute(sql`
              UPDATE cortex_core.contratos_creators SET status = 'assinado', assinafy_status = 'signed', assinado_em = NOW(), etapa_pagamento = 'producao', atualizado_em = NOW()
              WHERE id = ${c.id}
            `);
            updated++;
          } else if (isRecusado) {
            await db.execute(sql`
              UPDATE cortex_core.contratos_creators SET status = 'recusado', assinafy_status = 'declined', atualizado_em = NOW()
              WHERE id = ${c.id}
            `);
            updated++;
          } else if (docStatus && docStatus !== c.assinafy_status) {
            await db.execute(sql`
              UPDATE cortex_core.contratos_creators SET assinafy_status = ${docStatus}, atualizado_em = NOW()
              WHERE id = ${c.id}
            `);
          }

          details.push({ id: c.id, docId: c.assinafy_document_id, prevStatus: c.assinafy_status, apiStatus: docStatus, action: isAssinado ? 'assinado' : isRecusado ? 'recusado' : 'updated' });
        } catch (err: any) {
          details.push({ id: c.id, docId: c.assinafy_document_id, error: err.message });
        }
      }

      console.log(`[assinafy-sync-manual] ${updated}/${pending.length} contratos creators atualizados`);
      res.json({ updated, total: pending.length, details });
    } catch (error: any) {
      console.error("[assinafy-sync-manual] Erro:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Gerar token do portal ─────────────────────────────────────────────────
  app.post("/api/creators/:id/gerar-token", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const token = crypto.randomUUID();
      await db.execute(sql`
        UPDATE cortex_core.creators
        SET portal_token = ${token}::uuid, portal_token_criado_em = NOW()
        WHERE id = ${id}
      `);

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      res.json({ token, url: `${baseUrl}/portal/creator?token=${token}` });
    } catch (error: any) {
      console.error("[creators] Erro ao gerar token:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/creators/contratos/:id — Soft delete contrato + excluir no Assinafy
  app.delete("/api/creators/contratos/:id", async (req, res) => {
    const contratoId = parseInt(req.params.id);

    try {
      // Buscar contrato
      const result = await db.execute(sql`
        SELECT id, status, assinafy_document_id FROM cortex_core.contratos_creators WHERE id = ${contratoId}
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }

      const contrato = result.rows[0] as any;

      // Se tem documento no Assinafy, tentar excluir lá
      if (contrato.assinafy_document_id) {
        try {
          const configResult = await db.execute(sql`
            SELECT api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'creators' LIMIT 1
          `);

          if (configResult.rows.length > 0) {
            const config = configResult.rows[0] as { api_key: string; api_url: string };
            const deleteUrl = `${config.api_url}/documents/${contrato.assinafy_document_id}`;
            console.log(`[creators] Deleting Assinafy document: ${contrato.assinafy_document_id}`);

            const response = await fetch(deleteUrl, {
              method: "DELETE",
              headers: { "X-Api-Key": config.api_key },
            });

            if (response.ok) {
              console.log(`[creators] Assinafy document deleted successfully`);
            } else {
              const errorText = await response.text();
              console.error(`[creators] Assinafy delete failed (${response.status}): ${errorText}`);
              // Continue with local soft delete even if Assinafy fails
            }
          }
        } catch (err) {
          console.error("[creators] Error deleting from Assinafy:", err);
          // Continue with local soft delete
        }
      }

      // Soft delete local
      await db.execute(sql`
        UPDATE cortex_core.contratos_creators SET status = 'excluido' WHERE id = ${contratoId}
      `);

      console.log(`[creators] Contrato ${contratoId} excluído (soft delete)`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[creators] Erro ao excluir contrato:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
