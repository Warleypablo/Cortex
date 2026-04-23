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

// Stubs que serão implementados nas próximas tasks
export function renderizarNotificacao(_input: RenderizarInput): string {
  return '';
}
