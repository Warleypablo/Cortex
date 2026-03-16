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
  creator: { nome: string; cpf: string | null; cnpj: string | null; endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  contrato: { cargo: string; descricao_servicos: string; valor_remuneracao: string; duracao_meses: number; data_inicio: string; data_fim: string };
}

async function gerarContratoCreatorPDF({ creator, contrato }: ContratoCreatorPDFData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const cpfCnpj = creator.cnpj || creator.cpf || 'Não informado';
  const enderecoCompleto = [creator.endereco, creator.cidade, creator.estado, creator.cep].filter(Boolean).join(', ');
  const valorNum = parseFloat((contrato.valor_remuneracao || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  const valorFormatado = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const duracaoExtenso = numeroPorExtenso(contrato.duracao_meses);

  const dataInicioFmt = contrato.data_inicio ? formatDateBR(contrato.data_inicio) : '___/___/______';
  const dataFimFmt = contrato.data_fim ? formatDateBR(contrato.data_fim) : '___/___/______';
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
  const gap = (n = 0.8) => doc.moveDown(n);

  // ══════════════════════════════════════════════════════════════════════════
  // TÍTULO
  // ══════════════════════════════════════════════════════════════════════════
  p('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS', { bold: true, fontSize: 13, align: 'center', spacing: 1.5 });

  // ══════════════════════════════════════════════════════════════════════════
  // PREÂMBULO
  // ══════════════════════════════════════════════════════════════════════════
  p('Pelo presente instrumento particular, e na melhor forma de direito, as partes a seguir qualificadas:', { spacing: 0.8 });

  p('CONTRATANTE: TURBO PARTNERS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 42.100.292/0001-84, com sede na Avenida João Batista Parra, 633, Enseada do Suá, Vitória-ES, 29052-120, neste ato representada por seu sócio Rodrigo Queiroz Santos;', { spacing: 0.8 });

  p(`CONTRATADA: ${creator.nome}, pessoa jurídica de direito privado inscrita no ${creator.cnpj ? 'CNPJ' : 'CPF'} ${cpfCnpj}${enderecoCompleto ? `, com sede na ${enderecoCompleto}` : ''}${creator.cpf && creator.cnpj ? `, devidamente registrado no CPF ${creator.cpf}` : ''}.`, { spacing: 0.8 });

  p('Têm entre si, justo e contratado, o presente Contrato de Prestação de Serviços, mediante as seguintes cláusulas e condições:', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA PRIMEIRA – DO OBJETO DO CONTRATO
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA PRIMEIRA – DO OBJETO DO CONTRATO');

  p(`1.1. O CONTRATADO prestará serviços como ${contrato.cargo}. Para isso, deverá designar pessoa legalmente certificada e habilitada para a execução dos serviços.`, { spacing: 0.5 });

  p(`1.1.1. Os serviços serão prestados por pessoa previamente indicada pelo CONTRATADO e compreendem, de modo exemplificativo, as seguintes atribuições: ${contrato.descricao_servicos}, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE.`, { spacing: 0.5 });

  p('Parágrafo Primeiro. Fica certo e ajustado entre as PARTES que não haverá qualquer controle de horário e/ou carga horária do profissional alocado pela CONTRATADA para a execução dos serviços, tampouco obrigatoriedade quanto ao local de realização das tarefas.', { spacing: 0.5 });

  p('Parágrafo Segundo. Toda e qualquer pessoa eventualmente envolvida pela CONTRATADA na execução dos serviços contratados atuará em nome e por conta exclusiva da própria CONTRATADA, sendo esta a única responsável por sua relação jurídica, operacional e contratual com tais profissionais, sem qualquer vínculo direto ou indireto com a CONTRATANTE.', { spacing: 0.5 });

  p('Parágrafo Terceiro. As atribuições descritas nesta cláusula são meramente exemplificativas e poderão variar conforme entendimento técnico da CONTRATADA, respeitados os objetivos finais acordados entre as Partes.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA SEGUNDA – DO PRAZO
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA SEGUNDA – DO PRAZO');

  p(`2.1 – O presente contrato tem prazo de ${contrato.duracao_meses} [${duracaoExtenso}] meses, com início em ${dataInicioFmt} e fim em ${dataFimFmt}. Ao final deste prazo, o CONTRATO poderá ser renovado mediante manifestação expressa das partes, ocasião em que será reavaliado o escopo e as condições comerciais, desde que nenhuma das partes se manifeste no prazo de antecedência mínimo de 30 (trinta) dias anteriores ao término temporal contratual.`, { spacing: 0.5 });

  p('Parágrafo Primeiro. Ao final deste prazo, o contrato poderá ser renovado, sendo este realizado por simples aditivo contratual.', { spacing: 0.5 });

  p('Parágrafo Segundo. O presente contrato será considerado rescindido de pleno direito, no caso de falência, concordata ou liquidação, de quaisquer das partes, não sendo aplicável nesse caso nenhuma multa ou indenização.', { spacing: 0.5 });

  p('Parágrafo Terceiro. No caso de encerramento do presente contrato, a CONTRATADA deverá devolver, à CONTRATANTE, todo material em seu poder e que pertença à CONTRATANTE. A CONTRATANTE deverá quitar quaisquer pagamentos devidos por eventuais perdas e danos.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA TERCEIRA – DA REMUNERAÇÃO
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA TERCEIRA – DA REMUNERAÇÃO');

  p(`3.1 - A título de contraprestação pelos serviços prestados no âmbito deste contrato, a CONTRATADA fará jus à remuneração no valor de ${valorFormatado} (${valorPorExtenso(valorNum)}) mensais, enquanto vigente o presente instrumento, observado o escopo e a periodicidade das entregas pactuadas entre as partes.`, { spacing: 0.5 });

  p('Parágrafo Primeiro. Os valores que resultarem do disposto nesta cláusula constituem os únicos valores/créditos devidos pela CONTRATANTE ao CONTRATADO em razão do presente contrato, eximindo-se a CONTRATANTE de responder por quaisquer outros valores que sejam cobrados pelo CONTRATADO.', { spacing: 0.5 });

  p('Parágrafo Segundo. Até o 25° (vigésimo quinto) dia do mês subsequente à prestação dos serviços, a CONTRATANTE providenciará o pagamento da CONTRATADA, desde que cumpridas todo o escopo de entregas previstas no presente instrumento contratual.', { spacing: 0.5 });

  p('Parágrafo Terceiro. Até o 10° (décimo) dia anterior à data de pagamento e condicionado à plena constatação de cumprimento das entregas previstas, o CONTRATADO deverá emitir a competente Nota Fiscal, remetendo-a imediatamente à CONTRATANTE.', { spacing: 0.5 });

  p('Parágrafo Quarto. Caso em determinado exercício mensal haja a interrupção ou suspensão na prestação dos serviços, o pagamento será feito de modo proporcional ao período de efetiva execução das tarefas.', { spacing: 0.5 });

  p('Parágrafo Quinto. O recolhimento dos tributos incidentes sobre os Serviços, assim como o cumprimento das correspondentes obrigações tributárias acessórias, são de exclusiva responsabilidade da CONTRATADA, exceto nas hipóteses em que a CONTRATANTE deva, em razão de disposição legal, promover a retenção dos valores a serem pagos ao Fisco (Municipal, Estadual ou Federal).', { spacing: 0.5 });

  p('Parágrafo Sexto. O comprovante de depósito ou transferência servirá como recibo e prova de quitação e pagamento da obrigação ajustada.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA QUARTA – DAS OBRIGAÇÕES DO CONTRATADO
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA QUARTA – DAS OBRIGAÇÕES DO CONTRATADO');

  p('4.1 - São obrigações do CONTRATADO:', { spacing: 0.3 });
  p('I. Prestar os serviços contratados em conformidade com os padrões de qualidade acordados e com a boa técnica profissional aplicável ao setor.', { spacing: 0.3 });
  p('II. Fornecer as notas fiscais referentes aos pagamentos efetuados pela CONTRATANTE dentro do prazo previamente estipulado por meio do presente instrumento;', { spacing: 0.3 });
  p('III. Arcar com todas as despesas de natureza tributária decorrentes dos serviços especificados neste contrato;', { spacing: 0.3 });
  p('IV. Cumprir todas as determinações impostas pelas autoridades públicas competentes, referentes a estes serviços;', { spacing: 0.3 });
  p('V. Manter sigilosas, mesmo após findo este contrato, as informações privilegiadas de qualquer natureza às quais tenham acesso em virtude da execução destes serviços, pelo prazo de 5 (cinco) anos;', { spacing: 0.3 });
  p('VI. Comprometer-se a utilizar os equipamentos disponibilizados unicamente para fins profissionais relacionados às entregas pactuadas, observando as diretrizes técnicas definidas pela CONTRATANTE.', { spacing: 0.5 });

  p('Parágrafo Primeiro. Os documentos pertencentes ou em posse da empresa contratante depositados em mídias físicas ou digitais somente devem ser abertos e tratados em computadores credenciados e de propriedade da CONTRATANTE.', { spacing: 0.5 });

  p('Parágrafo Segundo. Sobre os computadores e demais equipamentos fornecidos para a prestação dos serviços não devem ser instalados programas alheios sem a autorização da CONTRATANTE.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA QUINTA – DAS OBRIGAÇÕES DA CONTRATANTE
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA QUINTA – DAS OBRIGAÇÕES DA CONTRATANTE');

  p('5.1 - São obrigações da CONTRATANTE:', { spacing: 0.3 });
  p('I. Fornecer todas as informações necessárias à execução dos serviços, incluindo diretrizes e objetivos, respeitada a autonomia técnica e operacional da CONTRATADA quanto aos meios e métodos empregados;', { spacing: 0.3 });
  p('II. Efetuar o pagamento, nas datas e nos termos definidos neste contrato;', { spacing: 0.3 });
  p('III. Manifestar, de forma expressa, eventuais críticas, dúvidas, solicitações, novas orientações e sugestões pertinentes aos serviços, quanto existirem;', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA SEXTA – DA RESCISÃO E EXTINÇÃO DO CONTRATO
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA SEXTA – DA RESCISÃO E EXTINÇÃO DO CONTRATO');

  p('6.1. O presente contrato poderá ser rescindido, a qualquer tempo, por qualquer das partes, independentemente de motivação, mediante comunicação prévia e escrita à outra parte, com antecedência mínima de 30 (trinta) dias, sem que disso decorra o pagamento de multa ou indenização, ressalvadas as obrigações já vencidas.', { spacing: 0.5 });

  p('6.2. O contrato poderá ser rescindido de forma motivada, por qualquer das partes, independentemente de aviso prévio, nas seguintes hipóteses:', { spacing: 0.3 });
  p('6.2.1. Descumprimento, pela outra parte, de quaisquer obrigações assumidas neste contrato, inclusive atraso na entrega dos serviços, execução inadequada do objeto ou violação de cláusulas contratuais;', { indent: 30, spacing: 0.3 });
  p('6.2.3. Prática de atos que comprometam a continuidade, a regularidade ou a finalidade do contrato.', { indent: 30, spacing: 0.5 });

  p('6.3. O contrato será considerado automaticamente extinto, independentemente de aviso ou notificação, nas seguintes hipóteses:', { spacing: 0.3 });
  p('6.3.1. Impossibilidade superveniente de execução do contrato por motivo de força maior ou caso fortuito, devidamente comprovado;', { indent: 30, spacing: 0.3 });
  p('6.3.2. Encerramento, dissolução ou extinção das atividades empresariais da CONTRATANTE.', { indent: 30, spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA SÉTIMA – DA INEXISTÊNCIA DE VÍNCULO TRABALHISTA E SOCIETÁRIO
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA SÉTIMA – DA INEXISTÊNCIA DE VÍNCULO TRABALHISTA E SOCIETÁRIO');

  p('7.1. - Não se estabelece, por força do presente contrato, nenhum vínculo empregatício, nem enseja qualquer tipo de subordinação e pessoalidade entre a CONTRATANTE e o pessoal do CONTRATADO, sendo certo que as obrigações e direitos das partes limita-se ao expressamente avençado neste contrato.', { spacing: 0.5 });

  p('7.2. O próprio CONTRATADO, na qualidade de prestador de serviços estabelecerá e concretizará, cotidianamente, a forma de realização dos serviços pactuados no presente termo.', { spacing: 0.5 });

  p('Parágrafo Primeiro. O CONTRATADO tem ciência e declara que nenhum ex-empregado da CONTRATANTE cujo contrato de trabalho tenha se encerrado há menos de 18 (dezoito) meses poderá ser alocado pelo CONTRATADO na prestação dos serviços.', { spacing: 0.5 });

  p('Parágrafo Segundo. O CONTRATADO tem ciência e declara que tem capacidade técnico-financeira para arcar com suas responsabilidades contratuais e extracontratuais, vinculada ou não a este contrato, e que não possui nem se colocará em situação de dependência econômica com relação ao resultado financeiro deste contrato.', { spacing: 0.5 });

  p('Parágrafo Terceiro. O CONTRATADO declara assumir integralmente os riscos relacionados à atividade empresarial que exerce, inclusive quanto à gestão de sua equipe, métodos de trabalho, investimentos necessários e responsabilidade pelos resultados.', { spacing: 0.5 });

  p('Parágrafo Quarto. O CONTRATADO tem ciência e declara que nada neste contrato poderá ser interpretado como tendo as partes, estabelecido qualquer forma de sociedade, associação, agência ou consórcio, de fato ou de direito, permanecendo cada uma das partes com as suas obrigações civis, comerciais, trabalhistas e tributárias, de forma autônoma.', { spacing: 0.5 });

  p('Parágrafo Quinto. Não haverá controles de horários de chegada ou saída ou subordinação, com total autonomia da CONTRATADA em relação à CONTRATANTE, se comprometendo a CONTRATANTE a executar os serviços contratados através das horas necessárias à execução dos serviços, conforme acordado, sob pena dos respectivos descontos. Caso não seja solicitado por escrito pela CONTRATANTE, não serão devidas horas adicionais às expressamente contratadas nesta cláusula.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA OITAVA – DA CONFIDENCIALIDADE E DIREITO DE IMAGEM
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA OITAVA – DA CONFIDENCIALIDADE E DIREITO DE IMAGEM');

  p('8.1. - As partes concordam que, sem o consentimento escrito, não poderão revelar ou divulgar, direta ou indiretamente, no todo ou em parte, isolada ou juntamente com terceiros, qualquer informação confidencial referente ao presente contrato, o que inclui, mas não se limita a: todos e quaisquer dados, relatórios, análises, estudos, pesquisas, interpretações, previsões / estimativas, registros, materiais e quaisquer outros elementos que contenham informações referentes à outra Parte. As disposições desta cláusula sobreviverão após o prazo de 05 (cinco) anos posteriores à vigência deste contrato ou à rescisão do mesmo por qualquer razão.', { spacing: 0.5 });

  p('Parágrafo Primeiro. Para os propósitos, serão consideradas "informações confidenciais" todas e quaisquer informações e/ou dados de natureza confidencial (incluindo, sem limitação, os termos e condições deste contrato e todos os segredos e/ou informações operacionais, econômicas e técnicas, bem como demais informações comerciais ou "know-how") que tenham sido direta ou indiretamente fornecidos ou divulgados por uma das partes à outra sob ou em função deste contrato, incluindo-se as informações de natureza comercial e os Contratos celebrados com terceiros para a comercialização dos produtos e serviços, mesmo as obtidas durante as negociações precedentes à formalização deste instrumento.', { spacing: 0.5 });

  p('Parágrafo Segundo. Caso alguma das partes venha a ser legalmente obrigada a revelar qualquer informação confidencial, por qualquer juízo ou autoridade governamental competente, essa deverá notificar a contrária de tal ordem, para que possa adotar medidas cabíveis para resguardar os seus direitos ou dispensar a parte que cumprir as obrigações dispostas neste acordo.', { spacing: 0.5 });

  p('Parágrafo Terceiro. A CONTRATADA não poderá, em nenhuma hipótese, fazer qualquer outro uso, realizar qualquer outro negócio ou celebrar qualquer outro contrato relacionado, direta ou indiretamente, às Informações Confidenciais.', { spacing: 0.5 });

  p('Parágrafo Quarto. Todas as Informações Confidenciais devem ser mantidas e tratadas como estritamente confidenciais e não poderão ser reveladas a qualquer terceiro, de forma alguma, no todo ou em parte, bem como não poderão ser utilizadas para qualquer finalidade que não esteja única e exclusivamente relacionada aos Serviços.', { spacing: 0.5 });

  p('Parágrafo Quinto. Sem prejuízo de outras obrigações, a CONTRATADA se compromete desde logo a:', { spacing: 0.3 });
  p('1. Não divulgar quaisquer Informações Confidenciais a quaisquer terceiros;', { indent: 30, spacing: 0.2 });
  p('2. Utilizar quaisquer Informações Confidenciais exclusivamente para a execução da prestação dos serviços;', { indent: 30, spacing: 0.2 });
  p('3. Não analisar, providenciar análise, derivar ou sintetizar qualquer informação recebida da CONTRATANTE sem autorização prévia e fora dos limites da execução de seu trabalho;', { indent: 30, spacing: 0.5 });

  p('Parágrafo Sexto. O descumprimento da presente cláusula enseja o pagamento, por parte da CONTRATADA ao CONTRATANTE, de multa não compensatória fixada em R$50.000,00 (cinquenta mil reais).', { spacing: 0.5 });

  p('8.2. O CONTRATADO autoriza, de forma livre, expressa, irrevogável e irretratável, a utilização de sua imagem, nome e voz pela CONTRATANTE, para fins institucionais, comerciais e publicitários relacionados ao objeto deste contrato, em quaisquer meios físicos ou digitais, sem limitação territorial ou temporal, inclusive após o término da relação contratual, sem que disso decorra direito a remuneração adicional.', { spacing: 0.5 });

  p('Parágrafo único. A utilização ora autorizada não implica exclusividade, vínculo empregatício ou societário, comprometendo-se a CONTRATANTE a utilizar a imagem do CONTRATADO de forma ética e compatível com a finalidade profissional pactuada.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA NONA – DA INEXISTÊNCIA DE LICENÇAS
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA NONA – DA INEXISTÊNCIA DE LICENÇAS');

  p('9.1. A CONTRATANTE reterá todo o direito, titularidade e interesse sobre as informações confidenciais presentes no presente contrato.', { spacing: 0.5 });

  p('9.2. Nada contido neste CONTRATO, nem a revelação de Informações Confidenciais, deverá ser interpretado como cessão ou transferência de quaisquer direitos, por meio de licença ou de qualquer outra forma, referente a marcas, patentes, direitos autorais, informações tecnológicas, segredos comerciais e/ou industriais, ou outras Informações Confidenciais, ou qualquer outra propriedade intelectual, sendo certo que a CONTRATANTE permanecerá como única proprietária das Informações Confidenciais.', { spacing: 0.5 });

  p('9.3. São e serão considerados como propriedade intelectual e/ou industrial única e exclusiva da CONTRATANTE qualquer produto, criação, desenvolvimento, relatório, planilha, resultado, dentre outros, ainda que tenham sido desenvolvidos pela CONTRATADA. Nenhum direito de propriedade intelectual e/ou industrial será detido pela CONTRATADA, a qual, expressamente, cede e transfere à CONTRATANTE, desde logo, não onerosamente, todo e qualquer direito relacionado ou derivado a qualquer espécie de criação decorrente do relacionamento entre as Partes.', { spacing: 0.5 });

  p('9.4. A CONTRATADA expressamente declara que todo e qualquer valor a título de eventuais direitos sobre propriedade intelectual e/ou industrial, direitos autorais ou qualquer espécie de direitos imateriais, já foi considerada pela Partes na fixação do Preço (contraprestação), razão pela qual nenhuma quantia poderá ser reclamada, a qualquer título, pela CONTRATADA.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA DÉCIMA – DA ABSTENÇÃO DE ALICIAMENTO
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA DÉCIMA – DA ABSTENÇÃO DE ALICIAMENTO E INDUÇÃO DE TERCEIROS VINCULADOS À CONTRATANTE');

  p('10.1. - Durante a vigência deste instrumento e por um período de 24 (vinte e quatro) meses após sua extinção, o CONTRATADO se compromete a não contratar, ou tentar contratar, direta ou indiretamente, qualquer empregado(a) da CONTRATANTE ou de qualquer outra empresa do grupo no Brasil ou no exterior, para trabalhar para seu novo empregador ou empresa da qual seja, direta ou indiretamente, ligado, inclusive como sócio.', { spacing: 0.5 });

  p('10.1.1 - Durante o período mencionado na Cláusula Segunda e pelo mesmo prazo de 02 (dois) anos contados da rescisão do contrato, o CONTRATADO também se compromete a não ajudar terceiros a contratar empregados(as) da CONTRATANTE ou de outra empresa do grupo, tampouco a induzir ou convencer qualquer empregado(a) da CONTRATANTE a rescindir o contrato que mantém com a CONTRATANTE.', { spacing: 0.5 });

  p('10.2. - O CONTRATADO, também neste ato, de forma irrevogável e irretratável, se compromete perante a CONTRATANTE a abster-se, durante a vigência do presente e pelo período de 02 (dois) anos contados da rescisão contratual de direta ou indiretamente, aliciar, induzir, convidar, contratar, nem determinar que seja aliciado, induzido ou convidado:', { spacing: 0.3 });
  p('(i) Qualquer cliente atendido e/ou captado pela CONTRATANTE ou pelo CONTRATADO durante a prestação de seus serviços para que tal cliente seja atendido por outra personalidade jurídica concorrente da TURBO;', { indent: 30, spacing: 0.3 });
  p('(ii) Qualquer empregado, sócio, diretor ou outro prestador de serviços da TURBO e/ou qualquer de suas afiliadas;', { indent: 30, spacing: 0.3 });
  p('(iii) Qualquer pessoa a deixar de fazer negócios com a TURBO e/ou qualquer de suas afiliadas;', { indent: 30, spacing: 0.3 });
  p('(iv) Qualquer fornecedor ou cliente da TURBO a deixar de realizar ou diminuir os negócios realizados com a CONTRATANTE;', { indent: 30, spacing: 0.5 });

  p('10.3. - Sem prejuízo das indenizações por perdas e danos e da responsabilidade criminal, o CONTRATADO, em caso de infração da presente cláusula, pagará ao CONTRATANTE uma multa não compensatória igual a R$ 100.000,00 (cem mil reais) por cada infração.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA DÉCIMA PRIMEIRA – DA PROTEÇÃO DE DADOS PESSOAIS
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA DÉCIMA PRIMEIRA – DA PROTEÇÃO DE DADOS PESSOAIS');

  p('11.1. - Seguindo as determinações da Lei 13.709/2018 ("Lei Geral de Proteção de Dados Pessoais") o CONTRATADO se compromete a manter segredo absoluto dos assuntos relacionados aos serviços prestados, bem como de todos os dados e informações relativos aos resultados obtidos na prestação do serviço, comprometendo-se a: não utilizar as informações confidenciais a que tiver acesso pelo período de 05 (cinco) anos, para gerar benefício próprio exclusivo e/ou unilateral, presente ou futuro, ou para o uso de terceiros; não efetuar nenhuma gravação ou cópia da documentação confidencial a que tiver acesso; não apropriar-se para si ou para outrem de material confidencial e/ou sigiloso da tecnologia que venha a ser disponível e; não repassar o conhecimento das informações confidenciais, responsabilizando-se por todas as pessoas que vierem a ter acesso às informações, por seu intermédio, e obrigando-se, assim, a reparar a ocorrência de qualquer dano e / ou prejuízo oriundo de uma eventual quebra de sigilo das informações fornecidas.', { spacing: 0.5 });

  p('Parágrafo Primeiro. As partes se comprometem a não utilizar os dados pessoais que tiverem acesso para fins distintos da relação estabelecida, sendo vedada a transmissão para terceiros.', { spacing: 0.5 });

  p('Parágrafo Segundo. As partes se comprometem em manter os compromissos acima, mesmo após o término da relação contratual, pelo período de 5 (cinco) anos.', { spacing: 0.5 });

  p('Parágrafo Terceiro. As partes declaram que qualquer conduta incompatível com as disposições acima será considerada uma grave violação deste contrato e será considerado motivo de justa causa para a rescisão imediata, sem prejuízo da adoção das medidas legalmente cabíveis.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA DÉCIMA SEGUNDA – DO USO E RESPONSABILIDADE PELOS EQUIPAMENTOS
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA DÉCIMA SEGUNDA – DO USO E RESPONSABILIDADE PELOS EQUIPAMENTOS FORNECIDOS PELA CONTRATANTE');

  p('12.1. A CONTRATANTE poderá disponibilizar, em regime de comodato, um computador de sua propriedade, para uso exclusivo da CONTRATADA na execução dos serviços contratados neste instrumento.', { spacing: 0.5 });

  p('12.2. A CONTRATADA compromete-se a zelar pelo bom estado de conservação, uso adequado e exclusivo do equipamento disponibilizado, abstendo-se de utilizá-lo para fins pessoais, atividades não relacionadas ao presente contrato, ou por terceiros.', { spacing: 0.5 });

  p('12.3. A CONTRATADA será responsável integral por qualquer dano, perda, extravio, furto, roubo ou mau uso do equipamento, independentemente de culpa, obrigando-se a arcar com os custos de reparação ou substituição integral do bem, conforme orçamento técnico indicado pela CONTRATANTE.', { spacing: 0.5 });

  p('12.4. Em caso de dano parcial, a CONTRATADA deverá restituir à CONTRATANTE o valor referente ao reparo, no prazo máximo de 30 (trinta) dias após a notificação escrita.', { spacing: 0.5 });

  p('12.5. Em caso de perda total, extravio, furto ou roubo, a CONTRATADA deverá indenizar a CONTRATANTE com base no valor de mercado atualizado do bem à época do evento, conforme cotação de revendedor autorizado ou nota fiscal de aquisição, o que for mais benéfico à CONTRATANTE.', { spacing: 0.5 });

  p('12.6. O equipamento deverá ser devolvido à CONTRATANTE no ato da rescisão do contrato, em perfeito estado de funcionamento e conservação, ressalvado o desgaste natural decorrente do uso regular.', { spacing: 0.5 });

  p('12.7. A CONTRATANTE poderá, a qualquer tempo, solicitar a devolução imediata do equipamento, cabendo à CONTRATADA o cumprimento imediato da solicitação.', { spacing: 0.5 });

  p('12.8. O inadimplemento das obrigações previstas nesta cláusula autoriza a CONTRATANTE a reter valores devidos à CONTRATADA até o limite da indenização cabível, sem prejuízo das demais medidas legais e contratuais aplicáveis.', { spacing: 1 });

  // ══════════════════════════════════════════════════════════════════════════
  // CLÁUSULA DÉCIMA TERCEIRA – DAS DISPOSIÇÕES GERAIS
  // ══════════════════════════════════════════════════════════════════════════
  heading('CLÁUSULA DÉCIMA TERCEIRA – DAS DISPOSIÇÕES GERAIS');

  p('13.1. Nenhuma das Partes poderá ceder ou transferir quaisquer direitos ou obrigações decorrentes deste contrato a terceiros, total ou parcialmente, sem o prévio e expresso consentimento por escrito da outra Parte.', { spacing: 0.5 });

  p('13.2. Todos os avisos e comunicações relacionadas ao presente contrato deverão ser feitos por escrito e sua entrega deverá ser considerada aperfeiçoada no ato do seu recebimento devidamente comprovado.', { spacing: 0.5 });

  p('13.3. O presente contrato é celebrado em caráter irrevogável e irretratável, obrigando as Partes e seus sucessores.', { spacing: 0.5 });

  p('13.4. A tolerância das Partes com relação a inadimplemento ou não cumprimento de qualquer obrigação, cláusula, termo ou condição ora estabelecida não constitui precedente, renúncia a obrigações, emenda ou renovação do contrato, e sim mera liberalidade.', { spacing: 0.5 });

  p('13.5. A declaração de nulidade ou anulação de qualquer dos dispositivos contidos neste instrumento não invalidará suas demais disposições, as quais permanecerão em pleno vigor.', { spacing: 0.5 });

  p('13.6. Não se estabelece, por força deste instrumento, qualquer forma de sociedade, associação, agência, consórcio, participação societária, ou responsabilidade solidária entre as partes.', { spacing: 0.5 });

  p('13.7. O objeto deste contrato não visa proporcionar nenhuma espécie de vantagem fiscal, trabalhista ou previdenciária a qualquer Parte ou a terceiros, e não implica vínculo empregatício entre uma das partes e os funcionários/prepostos da outra, ficando a cargo de cada uma delas a responsabilidade referente aos encargos sociais, tributários, previdenciários e trabalhistas de seus respectivos colaboradores.', { spacing: 0.5 });

  p('13.8. Os tributos (impostos, taxas, emolumentos, contribuições fiscais e parafiscais) que sejam devidos em decorrência direta ou indireta do presente contrato ou de sua execução, serão de exclusiva responsabilidade do contribuinte, conforme definido na norma tributária, autorizadas as retenções legais, sem direito a reembolso.', { spacing: 0.5 });

  p('13.9. O presente CONTRATO é o instrumento que regula todos os direitos e obrigações acordadas entre as Partes, substituindo todo e qualquer CONTRATO ou entendimento previamente realizado pelas Partes.', { spacing: 0.5 });

  p('13.10. Toda e qualquer modificação deste CONTRATO somente poderá ocorrer mediante aditamento, o qual deverá observar, obrigatoriamente, a forma escrita.', { spacing: 0.5 });

  p('13.11. Na hipótese de qualquer autuação, fiscalização, imposição de multa, desenquadramento ou fixação de qualquer outra sanção, de qualquer natureza, em desfavor da CONTRATADA, em especial em matéria tributária ou trabalhista, nenhuma responsabilidade incumbirá à CONTRATANTE, a qual fica desobrigada de qualquer pagamento ou assunção de despesas, sendo de rigor, ao revés, a obrigação de a CONTRATADA indenizar a CONTRATANTE por eventuais prejuízos decorrentes de tais eventos.', { spacing: 0.5 });

  p('13.12. Fica eleito o Foro da Comarca de Vitória/ES para nele serem dirimidas eventuais dúvidas ou questões oriundas deste contrato.', { spacing: 0.5 });

  p('13.13. Declaram as Partes que as obrigações aqui presentes são celebradas de boa-fé, livremente e de comum acordo, não existindo quaisquer vícios ou defeitos que possam acarretar a sua nulidade, em especial aqueles relacionados com dolo, erro, fraude, simulação ou coação, inexistindo também qualquer fato que possa ser configurado como estado de perigo ou de necessidade.', { spacing: 0.8 });

  // ── Declaração de assinatura digital ──
  p('As Partes neste ato declaram que (i) é admitida como válida e verdadeira a assinatura deste Contrato por meio de certificado digital emitido por entidades credenciadas para tanto pela Infraestrutura de Chaves Públicas Brasileira - ICP-Brasil; e (ii) são admitidas como válidas e originais as vias deste Contrato emitidas por meios de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil.', { spacing: 0.8 });

  p('Em testemunho do quê, as PARTES assinaram este Memorando em 3 (três) vias contendo os mesmos termos e condições, conjuntamente com 2 (duas) testemunhas.', { bold: true, spacing: 1.5 });

  // ── ASSINATURAS ──
  p(`Vitória, ${dataAtual}.`, { spacing: 2.5 });

  p('_____________________________________________', { align: 'center', spacing: 0.2 });
  p('TURBO PARTNERS LTDA', { bold: true, align: 'center', spacing: 2.5 });

  p('_____________________________________________', { align: 'center', spacing: 0.2 });
  p(creator.nome.toUpperCase(), { bold: true, align: 'center', spacing: 2.5 });

  p('_____________________________________________', { align: 'center', spacing: 0.2 });
  p('ANDRÉ MUSSO', { bold: true, align: 'center', spacing: 2.5 });

  p('_____________________________________________', { align: 'center', spacing: 0.2 });
  p('VICTOR DE SOUZA PEIXOTO', { bold: true, align: 'center' });

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
      const { cargo, descricao_servicos, valor_remuneracao, duracao_meses, data_inicio, data_fim, observacoes } = req.body;

      if (!cargo) return res.status(400).json({ error: "Cargo é obrigatório" });
      if (!descricao_servicos) return res.status(400).json({ error: "Descrição dos serviços é obrigatória" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.contratos_creators
          (creator_id, cargo, descricao_servicos, valor_remuneracao, duracao_meses, data_inicio, data_fim, observacoes)
        VALUES (
          ${creatorId}, ${cargo}, ${descricao_servicos},
          ${valor_remuneracao || 0}, ${duracao_meses || 6},
          ${data_inicio || null}, ${data_fim || null}, ${observacoes || null}
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
      const pdfBuffer = await gerarContratoCreatorPDF({
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, endereco: row.endereco, cidade: row.cidade, estado: row.estado, cep: row.cep },
        contrato: {
          cargo: row.cargo || 'prestador de serviços',
          descricao_servicos: row.descricao_servicos || 'conforme acordado entre as partes',
          valor_remuneracao: row.valor_remuneracao?.toString() || '0',
          duracao_meses: row.duracao_meses || 6,
          data_inicio: row.data_inicio || '',
          data_fim: row.data_fim || '',
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
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, endereco: row.endereco, cidade: row.cidade, estado: row.estado, cep: row.cep },
        contrato: {
          cargo: row.cargo || 'prestador de serviços',
          descricao_servicos: row.descricao_servicos || 'conforme acordado entre as partes',
          valor_remuneracao: row.valor_remuneracao?.toString() || '0',
          duracao_meses: row.duracao_meses || 6,
          data_inicio: row.data_inicio || '',
          data_fim: row.data_fim || '',
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
