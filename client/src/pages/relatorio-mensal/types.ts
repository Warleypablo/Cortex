export interface ColaboradorSlide {
  id: number;
  nome: string;
  cargo: string;
  squad: string;
  fotoUrl: string | null;
}

export interface NovoColaborador extends ColaboradorSlide {
  admissao: string;
}

export interface Aniversariante extends ColaboradorSlide {
  aniversario: string;
  dia: number;
}

export interface AniversarioEmpresa extends ColaboradorSlide {
  admissao: string;
  anosDeEmpresa: number;
}

export interface KRItem {
  id: string;
  title: string;
  unit: "BRL" | "PCT" | "COUNT";
  direction: "gte" | "lte";
  targetQ: number;
  actual: number | null;
  achievement: number; // percentage 0-100
}

export interface ObjectiveSlide {
  id: string;
  title: string;
  subtitle?: string;
  krs: KRItem[];
}

export interface CloserRanking {
  name: string;
  fotoUrl: string | null;
  mrrObtido: number;
  pontualObtido: number;
  totalObtido: number;
  negociosGanhos: number;
}

export interface ContratosMes {
  numContratos: number;
  contratosRecorrente: number;
  contratosPontual: number;
  receitaRecorrente: number;
  receitaPontual: number;
  tmRecorrente: number;
  tmPontual: number;
}

export interface RelatorioMensalData {
  mesReferencia: string;
  mesLabel: string;
  mesDadosLabel: string;
  novosColaboradores: NovoColaborador[];
  aniversariantes: Aniversariante[];
  aniversariosEmpresa: AniversarioEmpresa[];
  okrObjectives: ObjectiveSlide[];
  rankingClosers: CloserRanking[];
  topPontual: CloserRanking | null;
  contratosMes: ContratosMes;
}
