export interface Placar {
  porCliente: { recorrente: number; pontual: number; recorrenteAtivo: number; razao: number };
  volume: { pontualReceita: number; pontualClientes: number; recorrenteRealizado: number; recorrenteMrrCorrente: number; recorrenteClientes: number; recorrenteClientesAtivos: number };
  breakEven: { ticketPontual: number; minRecompras: number; maxRecompras: number; recompraRealPct: number };
}
export interface LtvMaduro { realizadoBlended: number; realizadoAtivo: number; projetadoChurn: number; premissaChurnMeses: number; }
export interface MixMes { mes: string; pontualN: number; pontualValor: number; recorrenteN: number; recorrenteMrrNovo: number; }
export interface FunilNivel { nivel: number; atingiram: number; pararamAqui: number; churn: number; emAndamento: number; concluido: number; valorpChurn: number; dropPct: number; }
export interface SafraPonto { safra: string; n: number; pctAtivo: number; }
export interface Recompra { totalAvulsos: number; comRecompra: number; pctRecompra: number; }
export interface RedesignPayload {
  meta: { de: string | null; ate: string | null; hoje: string; nSequenciados: number; nAvulsos: number; pctSequenciados: number };
  placar: Placar;
  ltvMaduro: LtvMaduro;
  mixMensal: MixMes[];
  retencao: { funilVendido: FunilNivel[]; funilEntregue: FunilNivel[]; safra: SafraPonto[]; recompra: Recompra };
  maturidade: { recorrenteIdade: number; pontualIdade: number; aviso: boolean };
}
