// server/routes/bp2026.funil.ts
// Sub-aba Funil Comercial: vendas, contratos vendidos, AOVs de venda, reuniões e conversão
// vs metas da aba CAC. Quebra por produto indisponível (CRM sem valor por produto).
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd, type MesValor } from "./bp2026.helpers";

interface MesLinha extends MesValor { atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct"; nota?: string; destaque?: boolean;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const NOTA_PRODUTO =
  "Quebra por produto indisponível: o CRM não registra valor por produto no deal " +
  "(campo produtos é lista de IDs sem split).";

const NOTA_TAXA =
  "Deals ganhos ÷ reuniões realizadas no mesmo mês — aproximação de coorte; " +
  "um deal pode fechar em mês diferente da reunião.";

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  vendasMrrPorMes: Record<number, number>;
  pontualPorMes: Record<number, number>;
  mesCorrente: number;
  mesFechado: number;
}

function razao(num: number | null, den: number | null): number | null {
  if (num === null || den === null || !den) return null;
  return num / den;
}

export async function montarFunil(deps: Deps): Promise<Linha[]> {
  const { db, orcado, vendasMrrPorMes, pontualPorMes, mesCorrente, mesFechado } = deps;

  // contagens do funil por mês (uma query): deals ganhos por tipo + reuniões realizadas
  const contagens = await db.execute(sql`
    SELECT mes,
           SUM(ganho_mrr) AS ganhos_mrr,
           SUM(ganho_pontual) AS ganhos_pontual,
           SUM(ganho_qualquer) AS ganhos,
           SUM(reuniao) AS reunioes
    FROM (
      SELECT EXTRACT(MONTH FROM data_fechamento)::int AS mes,
             CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_recorrente::numeric, 0) > 0 THEN 1 ELSE 0 END AS ganho_mrr,
             CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_pontual::numeric, 0) > 0 THEN 1 ELSE 0 END AS ganho_pontual,
             CASE WHEN stage_name = 'Negócio Ganho' AND (COALESCE(valor_recorrente::numeric, 0) > 0 OR COALESCE(valor_pontual::numeric, 0) > 0) THEN 1 ELSE 0 END AS ganho_qualquer,
             0 AS reuniao
      FROM "Bitrix".crm_deal
      WHERE data_fechamento >= '2026-01-01' AND data_fechamento < '2027-01-01'
      UNION ALL
      SELECT EXTRACT(MONTH FROM data_reuniao_realizada)::int AS mes,
             0, 0, 0, 1
      FROM "Bitrix".crm_deal
      WHERE data_reuniao_realizada >= '2026-01-01' AND data_reuniao_realizada < '2027-01-01'
    ) t
    GROUP BY mes ORDER BY mes
  `);
  const cnt: Record<number, { ganhosMrr: number; ganhosPontual: number; ganhos: number; reunioes: number }> = {};
  for (const row of contagens.rows as any[]) {
    cnt[Number(row.mes)] = {
      ganhosMrr: parseInt(row.ganhos_mrr), ganhosPontual: parseInt(row.ganhos_pontual),
      ganhos: parseInt(row.ganhos), reunioes: parseInt(row.reunioes),
    };
  }

  const mensal = (f: (m: number) => number | null) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));

  const vendasMrr = mensal((m) => vendasMrrPorMes[m] ?? 0);
  const vendasPontual = mensal((m) => pontualPorMes[m] ?? 0);
  const contratosMrr = mensal((m) => cnt[m]?.ganhosMrr ?? 0);
  const contratosPontual = mensal((m) => cnt[m]?.ganhosPontual ?? 0);
  const reunioes = mensal((m) => cnt[m]?.reunioes ?? 0);
  const aovMrr = Array.from({ length: 12 }, (_, i) => razao(vendasMrr[i], contratosMrr[i]));
  const aovPontual = Array.from({ length: 12 }, (_, i) => razao(vendasPontual[i], contratosPontual[i]));
  const taxa = mensal((m) => razao(cnt[m]?.ganhos ?? 0, cnt[m]?.reunioes ?? null));

  // orçados derivados: contratos = vendas_orc / aov_orc
  const orcContratos = (vendasMetrica: string, aovMetrica: string) => {
    const r: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      const aov = orcado[aovMetrica]?.[m] ?? 0;
      r[m] = aov ? (orcado[vendasMetrica]?.[m] ?? 0) / aov : 0;
    }
    return r;
  };
  const orcContratosMrr = orcContratos("vendas_mrr", "aov_venda_mrr");
  const orcContratosPontual = orcContratos("vendas_pontual", "aov_venda_pontual");

  const fazLinha = (
    def: { metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque"; direcao: Linha["direcao"]; unidade: NonNullable<Linha["unidade"]>; nota?: string; destaque?: boolean },
    serie: (number | null)[],
    orcadoMes: (m: number) => number,
    ytdOverride?: { orcado: number; realizado: number | null }
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const o = orcadoMes(mes);
      const r = serie[i];
      return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    let ytd: Linha["ytd"];
    if (mesFechado === 0) {
      ytd = { orcado: 0, realizado: null, atingimento: null };
    } else if (ytdOverride) {
      ytd = { ...ytdOverride, atingimento: calcAtingimento(ytdOverride.orcado, ytdOverride.realizado) };
    } else {
      const v = calcYtd(meses, mesFechado, def.tipoAgregacao);
      ytd = { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) };
    }
    return { ...def, meses, ytd };
  };

  const orcDe = (metrica: string) => (m: number) => orcado[metrica]?.[m] ?? 0;
  const somaAte = (s: (number | null)[]) =>
    s.slice(0, mesFechado).reduce<number | null>((acc, v) => (v === null ? acc : (acc ?? 0) + v), null);
  const somaOrcAte = (f: (m: number) => number) =>
    Array.from({ length: mesFechado }, (_, i) => f(i + 1)).reduce((a, b) => a + b, 0);

  const ytdRazao = (numS: (number | null)[], denS: (number | null)[], numOrc: (m: number) => number, denOrc: (m: number) => number) =>
    mesFechado === 0 ? undefined : {
      orcado: razao(somaOrcAte(numOrc), somaOrcAte(denOrc)) ?? 0,
      realizado: razao(somaAte(numS), somaAte(denS)),
    };

  return [
    fazLinha({ metrica: "funil_vendas_mrr", titulo: "Vendas MRR", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl", destaque: true, nota: NOTA_PRODUTO }, vendasMrr, orcDe("vendas_mrr")),
    fazLinha({ metrica: "funil_vendas_pontual", titulo: "Vendas Pontual", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl", destaque: true }, vendasPontual, orcDe("vendas_pontual")),
    fazLinha({ metrica: "contratos_vendidos_mrr", titulo: "Contratos vendidos — MRR", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "int" }, contratosMrr, (m) => orcContratosMrr[m]),
    fazLinha({ metrica: "contratos_vendidos_pontual", titulo: "Contratos vendidos — Pontual", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "int" }, contratosPontual, (m) => orcContratosPontual[m]),
    fazLinha({ metrica: "aov_venda_mrr", titulo: "AOV de venda — MRR", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, aovMrr, orcDe("aov_venda_mrr"),
      ytdRazao(vendasMrr, contratosMrr, orcDe("vendas_mrr"), (m) => orcContratosMrr[m])),
    fazLinha({ metrica: "aov_venda_pontual", titulo: "AOV de venda — Pontual", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, aovPontual, orcDe("aov_venda_pontual"),
      ytdRazao(vendasPontual, contratosPontual, orcDe("vendas_pontual"), (m) => orcContratosPontual[m])),
    fazLinha({ metrica: "reunioes", titulo: "Reuniões realizadas", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "int" }, reunioes, orcDe("reunioes_necessarias")),
    fazLinha({ metrica: "taxa_conversao", titulo: "Taxa de conversão", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "pct", nota: NOTA_TAXA }, taxa, orcDe("taxa_conversao"),
      mesFechado === 0 ? undefined : {
        orcado: razao(
          Array.from({ length: mesFechado }, (_, i) => (orcado["taxa_conversao"]?.[i + 1] ?? 0) * (orcado["reunioes_necessarias"]?.[i + 1] ?? 0)).reduce((a, b) => a + b, 0),
          somaOrcAte(orcDe("reunioes_necessarias"))
        ) ?? 0,
        realizado: razao(
          Array.from({ length: mesFechado }, (_, i) => cnt[i + 1]?.ganhos ?? 0).reduce<number>((a, b) => a + b, 0),
          somaAte(reunioes)
        ),
      }),
  ];
}
