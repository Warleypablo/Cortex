import { sql } from "drizzle-orm";
import {
  custoMensalRecorrente, converter, agruparPor, totalBRL, totalUSD,
  type LinhaCusto, type Moeda, type Projeto,
} from "../../../shared/custos-calc";
import { getTaxaMes } from "./cambio";

export interface ResumoMes {
  mes: string;
  totalBRL: number;
  totalUSD: number;
  porPilar: Record<string, number>;
  porProjeto: Record<string, number>;
  porFornecedor: Record<string, number>;
  taxa: number;
  cambioEstimado: boolean;
  linhas: LinhaCusto[];
}

function asProjeto(v: any): Projeto {
  return v === "Synapse" || v === "Cortex" ? v : "Geral";
}
function asMoeda(v: any): Moeda {
  return v === "BRL" ? "BRL" : "USD";
}

/** Lista de meses 'YYYY-MM' de `de` até `ate`, inclusive. */
export function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  let [y, m] = de.split("-").map(Number);
  const [ay, am] = ate.split("-").map(Number);
  while (y < ay || (y === ay && m <= am)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export async function consolidarMes(db: any, mes: string): Promise<ResumoMes> {
  const { taxa, estimada } = await getTaxaMes(db, mes);
  const linhas: LinhaCusto[] = [];

  // Assinaturas (pilar 'assinaturas')
  const assinaturas = await db.execute(sql`
    SELECT fornecedor, valor, moeda, ciclo, data_assinatura, data_cancelamento, status, projeto
    FROM cortex_core.custo_assinaturas
  `);
  for (const r of assinaturas.rows as any[]) {
    const custo = custoMensalRecorrente(
      { valor: parseFloat(r.valor), ciclo: r.ciclo, dataInicio: r.data_assinatura, dataFim: r.data_cancelamento, status: r.status },
      mes,
    );
    if (custo <= 0) continue;
    const moeda = asMoeda(r.moeda);
    const { valorUSD, valorBRL } = converter(custo, moeda, taxa);
    linhas.push({ pilar: "assinaturas", fornecedor: r.fornecedor, projeto: asProjeto(r.projeto), moeda, valorOriginal: custo, valorUSD, valorBRL });
  }

  // Itens manuais / ferramentas (pilar 'ferramentas')
  const itens = await db.execute(sql`
    SELECT descricao, fornecedor, valor, moeda, ciclo, data_inicio, data_fim, status, projeto
    FROM cortex_core.custo_itens_manuais
  `);
  for (const r of itens.rows as any[]) {
    const custo = custoMensalRecorrente(
      { valor: parseFloat(r.valor), ciclo: r.ciclo, dataInicio: r.data_inicio, dataFim: r.data_fim, status: r.status },
      mes,
    );
    if (custo <= 0) continue;
    const moeda = asMoeda(r.moeda);
    const { valorUSD, valorBRL } = converter(custo, moeda, taxa);
    linhas.push({ pilar: "ferramentas", fornecedor: r.fornecedor || r.descricao, projeto: asProjeto(r.projeto), moeda, valorOriginal: custo, valorUSD, valorBRL });
  }

  // GCP (pilar 'gcp') — soma do mês por serviço/projeto
  const gcp = await db.execute(sql`
    SELECT servico, SUM(custo) AS custo, moeda, projeto_interno
    FROM cortex_core.custo_gcp_diario
    WHERE to_char(data, 'YYYY-MM') = ${mes}
    GROUP BY servico, moeda, projeto_interno
  `);
  for (const r of gcp.rows as any[]) {
    const moeda = asMoeda(r.moeda);
    const { valorUSD, valorBRL } = converter(parseFloat(r.custo), moeda, taxa);
    linhas.push({ pilar: "gcp", fornecedor: "Google Cloud", projeto: asProjeto(r.projeto_interno), moeda, valorOriginal: parseFloat(r.custo), valorUSD, valorBRL });
  }

  // Anthropic API (pilar 'anthropic') — soma do mês por workspace/projeto (sempre USD)
  const anthropic = await db.execute(sql`
    SELECT workspace, SUM(custo_usd) AS custo, projeto_interno
    FROM cortex_core.custo_anthropic_diario
    WHERE to_char(data, 'YYYY-MM') = ${mes}
    GROUP BY workspace, projeto_interno
  `);
  for (const r of anthropic.rows as any[]) {
    const { valorUSD, valorBRL } = converter(parseFloat(r.custo), "USD", taxa);
    linhas.push({ pilar: "anthropic", fornecedor: "Anthropic API", projeto: asProjeto(r.projeto_interno), moeda: "USD", valorOriginal: parseFloat(r.custo), valorUSD, valorBRL });
  }

  return {
    mes,
    totalBRL: totalBRL(linhas),
    totalUSD: totalUSD(linhas),
    porPilar: agruparPor(linhas, "pilar"),
    porProjeto: agruparPor(linhas, "projeto"),
    porFornecedor: agruparPor(linhas, "fornecedor"),
    taxa,
    cambioEstimado: estimada,
    linhas,
  };
}

export async function evolucao(db: any, de: string, ate: string): Promise<ResumoMes[]> {
  const meses = mesesEntre(de, ate);
  const out: ResumoMes[] = [];
  for (const m of meses) out.push(await consolidarMes(db, m));
  return out;
}
