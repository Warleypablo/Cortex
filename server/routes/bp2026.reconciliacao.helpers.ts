// server/routes/bp2026.reconciliacao.helpers.ts
// Classifica o movimento de MRR de um produto entre dois snapshots fim-de-mês.
// Puro (sem DB): a camada de rota fornece SnapRow[] com `linha` já calculada via CASE_PRODUTO.

export const POOL_STATUS: readonly string[] = ["ativo", "onboarding", "triagem"];

export interface SnapRow {
  id_subtask: string;
  cliente: string;
  servico: string;
  status: string; // minúsculo (cup_data_hist)
  linha: string;  // 'performance' | 'creators' | 'social' | 'gc' | 'others'
  valorr: number;
  dataInicio?: string | null; // data_inicio do contrato (≈ data_criado) p/ auditoria
}

export type ComponenteChave =
  | "vendas" | "expansao" | "reativacao"
  | "churn_cancel" | "churn_downsell" | "pausas"
  | "saidas_sem_rastreio" | "entregue" | "mudanca_produto";

export interface ContratoMov {
  id_subtask: string;
  cliente: string;
  servico: string;
  valorrIni: number;
  valorrFim: number;
  delta: number;
  dataInicio?: string | null;
}

export interface Componente {
  chave: ComponenteChave;
  titulo: string;
  valor: number;
  n: number;
  contratos: ContratoMov[];
}

export interface Reconciliacao {
  produto: string;
  mrrInicio: number;
  mrrFim: number;
  componentes: Componente[];
  reconcilia: boolean;
}

const TITULOS: Record<ComponenteChave, string> = {
  vendas: "Vendas (novos contratos)",
  expansao: "Expansão (upsell)",
  reativacao: "Reativação",
  churn_cancel: "Churn — cancelamento",
  churn_downsell: "Churn — downsell",
  pausas: "Pausas",
  saidas_sem_rastreio: "Saídas sem rastreio",
  entregue: "Entregue (pontual concluído)",
  mudanca_produto: "Mudança de produto",
};

const ORDEM: ComponenteChave[] = [
  "vendas", "expansao", "reativacao",
  "churn_cancel", "churn_downsell", "pausas",
  "saidas_sem_rastreio", "entregue", "mudanca_produto",
];

function inPool(row: SnapRow | undefined, produto: string): boolean {
  return !!row && POOL_STATUS.includes(row.status) && row.linha === produto;
}

export function computeReconciliacao(produto: string, prev: SnapRow[], cur: SnapRow[]): Reconciliacao {
  const prevMap = new Map(prev.map((r) => [r.id_subtask, r]));
  const curMap = new Map(cur.map((r) => [r.id_subtask, r]));

  const buckets: Record<ComponenteChave, ContratoMov[]> = {
    vendas: [], expansao: [], reativacao: [],
    churn_cancel: [], churn_downsell: [], pausas: [],
    saidas_sem_rastreio: [], entregue: [], mudanca_produto: [],
  };

  const ids = new Set<string>();
  for (const r of prev) if (inPool(r, produto)) ids.add(r.id_subtask);
  for (const r of cur) if (inPool(r, produto)) ids.add(r.id_subtask);

  let mrrInicio = 0;
  let mrrFim = 0;

  for (const id of Array.from(ids)) {
    const p = prevMap.get(id);
    const c = curMap.get(id);
    const wasIn = inPool(p, produto);
    const isIn = inPool(c, produto);
    const vIni = wasIn ? p!.valorr : 0;
    const vFim = isIn ? c!.valorr : 0;
    mrrInicio += vIni;
    mrrFim += vFim;
    const ref = c ?? p!;
    const mov: ContratoMov = {
      id_subtask: id, cliente: ref.cliente, servico: ref.servico,
      valorrIni: vIni, valorrFim: vFim, delta: vFim - vIni,
      dataInicio: ref.dataInicio ?? null,
    };

    if (!wasIn && isIn) {
      // entrada no pool. !wasIn já garante que estava fora do pool em prev,
      // então p.linha === produto = mesmo produto que voltou (reativação);
      // p.linha !== produto = veio de outro produto (mudança de produto).
      if (!p) buckets.vendas.push(mov);
      else if (p.linha === produto) buckets.reativacao.push(mov);
      else buckets.mudanca_produto.push(mov);
    } else if (wasIn && !isIn) {
      if (!c) buckets.saidas_sem_rastreio.push(mov);
      else if (c.status === "pausado") buckets.pausas.push(mov);
      else if (c.status === "cancelado/inativo" || c.status === "em cancelamento") buckets.churn_cancel.push(mov);
      else if (c.status === "entregue") buckets.entregue.push(mov);
      else if (c.linha !== produto) buckets.mudanca_produto.push(mov);
      else buckets.churn_cancel.push(mov);
    } else if (wasIn && isIn) {
      if (vFim > vIni) buckets.expansao.push(mov);
      else if (vFim < vIni) buckets.churn_downsell.push(mov);
      // vFim === vIni (estável): delta 0, não entra em bucket de propósito.
    }
  }

  const componentes: Componente[] = ORDEM
    .map((chave) => {
      const contratos = buckets[chave];
      const valor = contratos.reduce((s, m) => s + m.delta, 0);
      return { chave, titulo: TITULOS[chave], valor, n: contratos.length, contratos };
    })
    .filter((comp) => comp.n > 0);

  const soma = componentes.reduce((s, comp) => s + comp.valor, 0);
  const reconcilia = Math.abs(mrrInicio + soma - mrrFim) < 0.01;

  return { produto, mrrInicio, mrrFim, componentes, reconcilia };
}
