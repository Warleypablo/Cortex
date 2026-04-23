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

// Stubs que serão implementados nas próximas tasks
export function renderizarNotificacao(_input: RenderizarInput): string {
  return '';
}
