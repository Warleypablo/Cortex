export interface MesValor {
  mes: number;
  orcado: number;
  realizado: number | null;
}

export type TipoAgregacao = "fluxo" | "estoque";

export function calcAtingimento(orcado: number, realizado: number | null): number | null {
  if (realizado === null || !orcado) return null;
  return realizado / orcado;
}

export function calcYtd(
  meses: MesValor[],
  mesAte: number,
  tipo: TipoAgregacao
): { orcado: number; realizado: number | null } {
  const ate = meses.filter((m) => m.mes <= mesAte);
  if (tipo === "estoque") {
    const orcado = ate.length ? ate[ate.length - 1].orcado : 0;
    const comDado = ate.filter((m) => m.realizado !== null);
    const realizado = comDado.length ? comDado[comDado.length - 1].realizado : null;
    return { orcado, realizado };
  }
  const orcado = ate.reduce((s, m) => s + m.orcado, 0);
  const comDado = ate.filter((m) => m.realizado !== null);
  const realizado = comDado.length
    ? comDado.reduce((s, m) => s + (m.realizado ?? 0), 0)
    : null;
  return { orcado, realizado };
}

export function ultimoDiaDoMes(ano: number, mes: number): string {
  const d = new Date(Date.UTC(ano, mes, 0));
  return d.toISOString().slice(0, 10);
}

// Rateio proporcional null-safe (usado para dividir o benefício entre CSV e SG&A
// pela fração orçada do mês). Denominador inválido => null, para expor erro de seed.
export function ratear(
  valor: number | null,
  numerador: number,
  denominador: number
): number | null {
  if (valor === null || !denominador) return null;
  return (valor * numerador) / denominador;
}

export interface ItemDetalhe {
  grupo: string;
  nome: string;
  detalhe: string;
  data: string | null;
  valor: number;
}

export interface GrupoDetalhe {
  titulo: string;
  total: number;
  itens: Array<Omit<ItemDetalhe, "grupo">>;
  itensOmitidos?: { qtd: number; valor: number };
}

// Agrupa itens por `grupo`, ordena grupos por total desc e itens por valor desc;
// corta cada grupo em `limite` itens, agregando o excedente em itensOmitidos.
export function agruparItens(itens: ItemDetalhe[], limite: number): GrupoDetalhe[] {
  const porGrupo = new Map<string, ItemDetalhe[]>();
  for (const item of itens) {
    const lista = porGrupo.get(item.grupo) ?? [];
    lista.push(item);
    porGrupo.set(item.grupo, lista);
  }
  const grupos: GrupoDetalhe[] = [];
  for (const [titulo, lista] of porGrupo) {
    lista.sort((a, b) => b.valor - a.valor);
    const total = lista.reduce((s, i) => s + i.valor, 0);
    const visiveis = lista.slice(0, limite);
    const omitidos = lista.slice(limite);
    grupos.push({
      titulo,
      total,
      itens: visiveis.map(({ grupo: _g, ...resto }) => resto),
      ...(omitidos.length
        ? { itensOmitidos: { qtd: omitidos.length, valor: omitidos.reduce((s, i) => s + i.valor, 0) } }
        : {}),
    });
  }
  grupos.sort((a, b) => b.total - a.total);
  return grupos;
}

// Pré-condição: todos os arrays alinhados por posição (meses 1..12, mesmo comprimento).
export function subtrairMeses(
  minuendo: MesValor[],
  subtraendos: MesValor[][]
): MesValor[] {
  return minuendo.map((m, i) => {
    const partes = subtraendos.map((s) => s[i]);
    const orcado = partes.reduce((acc, p) => acc - p.orcado, m.orcado);
    const algumNull = m.realizado === null || partes.some((p) => p.realizado === null);
    const realizado = algumNull
      ? null
      : partes.reduce((acc, p) => acc - (p.realizado ?? 0), m.realizado ?? 0);
    return { mes: m.mes, orcado, realizado };
  });
}
