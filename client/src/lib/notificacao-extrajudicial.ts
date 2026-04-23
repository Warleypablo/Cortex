export interface ParcelaParaNotificacao {
  naoPago: number;
  dataVencimento: string; // ISO date ou data parseável por new Date()
}

export interface ClienteParaNotificacao {
  nomeCliente: string;
  empresa: string;
  cnpj: string | null;
}

export interface FormularioNotificacao {
  email: string;
  endereco: string;
  numeroContrato: string;
  dataContrato: string; // ISO yyyy-mm-dd (input date HTML)
  nomeServico: string;
}

export interface RenderizarInput {
  cliente: ClienteParaNotificacao;
  parcelas: ParcelaParaNotificacao[];
  form: FormularioNotificacao;
  hoje?: Date; // injetável para testes determinísticos
}

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function formatarMesesEmAtraso(datas: string[]): string {
  if (datas.length === 0) return '';

  // Extrair pares únicos (ano, mês) e ordenar
  const chaves = new Set<string>();
  const pares: Array<{ ano: number; mes: number }> = [];

  for (const data of datas) {
    const d = new Date(data);
    if (isNaN(d.getTime())) continue;
    const ano = d.getUTCFullYear();
    const mes = d.getUTCMonth();
    const chave = `${ano}-${mes}`;
    if (!chaves.has(chave)) {
      chaves.add(chave);
      pares.push({ ano, mes });
    }
  }

  pares.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);

  const labels = pares.map(p => `${MESES_PT[p.mes]}/${p.ano}`);

  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}

function formatarBRL(valor: number): string {
  // Intl.NumberFormat pt-BR com style 'currency' insere U+00A0 (nbsp) entre "R$" e o número.
  // Normalizamos para espaço simples para consistência com o template da notificação.
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor).replace(/\u00A0/g, ' ');
}

function formatarDataBR(dataIso: string): string {
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function formatarValoresDescricao(parcelas: ParcelaParaNotificacao[]): string {
  if (parcelas.length === 0) return '';

  if (parcelas.length === 1) {
    return `no valor de ${formatarBRL(parcelas[0].naoPago)}`;
  }

  const primeiro = parcelas[0].naoPago;
  const todosIguais = parcelas.every(p => Math.abs(p.naoPago - primeiro) < 0.01);

  if (todosIguais) {
    return `no valor de ${formatarBRL(primeiro)} cada uma`;
  }

  const items = parcelas.map(p =>
    `${formatarBRL(p.naoPago)} com vencimento em ${formatarDataBR(p.dataVencimento)}`
  );

  if (items.length === 2) {
    return `sendo ${items[0]} e ${items[1]}`;
  }
  return `sendo ${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

const ANOS_EXTENSO: Record<number, string> = {
  2024: 'Dois Mil e Vinte e Quatro',
  2025: 'Dois Mil e Vinte e Cinco',
  2026: 'Dois Mil e Vinte e Seis',
  2027: 'Dois Mil e Vinte e Sete',
  2028: 'Dois Mil e Vinte e Oito',
  2029: 'Dois Mil e Vinte e Nove',
  2030: 'Dois Mil e Trinta',
};

export function anoPorExtenso(ano: number): string {
  return ANOS_EXTENSO[ano] ?? '[ANO POR EXTENSO]';
}

function calcularAnoPrincipal(parcelas: ParcelaParaNotificacao[]): number {
  if (parcelas.length === 0) return new Date().getUTCFullYear();
  const contagem = new Map<number, number>();
  for (const p of parcelas) {
    const d = new Date(p.dataVencimento);
    if (isNaN(d.getTime())) continue;
    const ano = d.getUTCFullYear();
    contagem.set(ano, (contagem.get(ano) ?? 0) + 1);
  }
  // Ano com mais parcelas; empate → maior
  let anoPrincipal = new Date().getUTCFullYear();
  let maxCount = -1;
  contagem.forEach((count, ano) => {
    if (count > maxCount || (count === maxCount && ano > anoPrincipal)) {
      anoPrincipal = ano;
      maxCount = count;
    }
  });
  return anoPrincipal;
}

export function renderizarNotificacao(input: RenderizarInput): string {
  const { cliente, parcelas, form, hoje = new Date() } = input;

  const nomeNotificada = (cliente.empresa?.trim() || cliente.nomeCliente || '').toUpperCase();
  const cnpjNotificada = cliente.cnpj?.trim() || '[CNPJ NÃO INFORMADO]';
  const enderecoNotificada = form.endereco.trim() || '[ENDEREÇO NÃO INFORMADO]';
  const numeroContrato = form.numeroContrato.trim() || '[Nº DO CONTRATO]';
  const dataAssinatura = form.dataContrato ? formatarDataBR(form.dataContrato) : '[DATA DO CONTRATO]';
  const nomeServico = form.nomeServico.trim() || '[NOME DO SERVIÇO]';

  const mesesEmAtraso = formatarMesesEmAtraso(parcelas.map(p => p.dataVencimento));
  const anoPrincipal = calcularAnoPrincipal(parcelas);
  const valoresDescricao = formatarValoresDescricao(parcelas);

  const dia = String(hoje.getUTCDate()).padStart(2, '0');
  const mes = String(hoje.getUTCMonth() + 1).padStart(2, '0');
  const ano = hoje.getUTCFullYear();
  const dataEmissao = `${dia}/${mes}/${ano}`;

  return `NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA

NOTIFICANTE: TURBO PARTNERS, pessoa jurídica de direito privado, com sede na Rua Carlos Fernando Lindenberg Filho, 90, no bairro Monte Belo, em Vitória - ES, CEP 29053-315, inscrita no CNPJ sob o nº 42.100.292/0001-84.

NOTIFICADA: ${nomeNotificada}, inscrita no CNPJ sob o nº ${cnpjNotificada}, a qual possui sede em ${enderecoNotificada}.

Por meio da presente Notificação Extrajudicial, a NOTIFICANTE, servindo-se da via Cartório de Títulos e Documentos, vem comunicar à NOTIFICADA acerca da sua patente e real inadimplência existente perante a ora NOTIFICANTE, referente aos débitos tocantes aos meses de ${mesesEmAtraso || '[MESES EM ATRASO]'}, de ${anoPrincipal} (${anoPorExtenso(anoPrincipal)}), que estão em ATRASO.

Deve-se, aqui, rememorar que em ${dataAssinatura} a NOTIFICADA firmou um contrato específico de compra e venda de "${nomeServico}" com a NOTIFICANTE, o qual está registrado sob o nº ${numeroContrato}, obrigando-se a pagar parcelas ${valoresDescricao || '[VALORES DAS PARCELAS]'}, no que concerne à contratação do serviço já citado acima.

Cumpre informar, através deste documento, portanto, que, nos termos do artigo 726 do Código de Processo Civil (Lei 13.105/2015), caso as parcelas não sejam quitadas até 10 (Dez) dias após o recebimento desta Notificação Extrajudicial, serão tomadas as medidas judiciais cabíveis, bem como a NOTIFICANTE procederá à abertura de inscrição do nome do NOTIFICADO junto aos órgãos competentes: SERASA - SCPC, consoante determina o artigo 43 parágrafo 3º da Lei nº 8.078/1990.


Sem mais, e nos termos da lei,

Vitória/ES, ${dataEmissao}.`;
}
