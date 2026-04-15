export type TipoReceita = "RECORRENTE" | "PONTUAL" | "NAO_CLASSIFICADO";

export interface ParcelaInput {
  centro_custo_nome: string | null;
  valor_centro_custo: string | null;
  valor_bruto: number;
  status: string;
}

export interface ClassifiedResult {
  tipo: TipoReceita;
  previsto: number;
  realizado: number;
}

const REALIZADO_STATUSES = new Set(['PAGO', 'QUITADO']);

function classifySingle(nome: string | null): TipoReceita {
  if (!nome) return 'NAO_CLASSIFICADO';
  const lower = nome.toLowerCase();
  if (lower.includes('recorrente')) return 'RECORRENTE';
  if (lower.includes('pontual')) return 'PONTUAL';
  return 'NAO_CLASSIFICADO';
}

export function classifyParcela(p: ParcelaInput): ClassifiedResult[] {
  const isRealizado = REALIZADO_STATUSES.has(p.status);

  const nome = p.centro_custo_nome ?? '';
  const hasDelim = nome.includes(';');

  // Case 1: CC único (sem ';') — usa valor_bruto direto
  if (!hasDelim) {
    const tipo = classifySingle(nome);
    return [{
      tipo,
      previsto: p.valor_bruto,
      realizado: isRealizado ? p.valor_bruto : 0,
    }];
  }

  // Detecta se é misto (Recorrente + Pontual juntos) ou mesmo-tipo
  const lower = nome.toLowerCase();
  const hasRec = lower.includes('recorrente');
  const hasPon = lower.includes('pontual');
  const isMisto = hasRec && hasPon;

  // Case 2: múltiplos CCs mas todos do mesmo tipo → usa valor_bruto
  //         (contorna o bug do CA que infla valor_centro_custo em vendas parceladas)
  if (!isMisto) {
    const tipo = classifySingle(nome);
    return [{
      tipo,
      previsto: p.valor_bruto,
      realizado: isRealizado ? p.valor_bruto : 0,
    }];
  }

  // Case 3: CC misto (Recorrente + Pontual) → split posicional
  const nomes = nome.split(';');
  const valores = (p.valor_centro_custo ?? '').split(';');

  const agregado: Record<TipoReceita, ClassifiedResult> = {
    RECORRENTE: { tipo: 'RECORRENTE', previsto: 0, realizado: 0 },
    PONTUAL: { tipo: 'PONTUAL', previsto: 0, realizado: 0 },
    NAO_CLASSIFICADO: { tipo: 'NAO_CLASSIFICADO', previsto: 0, realizado: 0 },
  };
  const seen = new Set<TipoReceita>();

  for (let i = 0; i < nomes.length; i++) {
    const itemTipo = classifySingle(nomes[i]);
    const rawValor = valores[i] ?? '';
    const valor = rawValor.trim() === '' ? 0 : Number(rawValor);
    if (Number.isNaN(valor)) continue;
    seen.add(itemTipo);
    agregado[itemTipo].previsto += valor;
    if (isRealizado) agregado[itemTipo].realizado += valor;
  }

  return Object.values(agregado).filter(r => seen.has(r.tipo));
}
