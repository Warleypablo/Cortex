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

// Stubs que serão implementados nas próximas tasks
export function renderizarNotificacao(_input: RenderizarInput): string {
  return '';
}
