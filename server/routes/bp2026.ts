// server/routes/bp2026.ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import {
  calcAtingimento,
  calcYtd,
  ultimoDiaDoMes,
  subtrairMeses,
  ratear,
  type MesValor,
  type TipoAgregacao,
} from "./bp2026.helpers";

const ANO = 2026;
const CACHE_TTL_MS = 10 * 60 * 1000;

export type Direcao = "maior_melhor" | "menor_melhor";

interface DefLinha {
  metrica: string;
  titulo: string;
  tipoAgregacao: TipoAgregacao;
  direcao: Direcao;
  nota?: string;
}

interface LinhaReceita {
  metrica: string;
  titulo: string;
  tipoAgregacao: TipoAgregacao;
  direcao: Direcao;
  nota?: string;
  meses: Array<{
    mes: number;
    orcado: number;
    realizado: number | null;
    atingimento: number | null;
    fonteAproximada?: boolean;
  }>;
}

let cache: { payload: unknown; expiraEm: number } | null = null;

const LINHAS: Array<{
  metrica: string;
  titulo: string;
  tipoAgregacao: TipoAgregacao;
  direcao: Direcao;
}> = [
  { metrica: "mrr_ativo", titulo: "(+) MRR Ativo", tipoAgregacao: "estoque", direcao: "maior_melhor" },
  { metrica: "receita_pontual", titulo: "(+) Receita Pontual", tipoAgregacao: "fluxo", direcao: "maior_melhor" },
  { metrica: "outras_receitas", titulo: "(+) Outras Receitas", tipoAgregacao: "fluxo", direcao: "maior_melhor" },
];

const LINHAS_DEDUCOES: DefLinha[] = [
  { metrica: "inadimplencia", titulo: "(−) Inadimplência", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
  { metrica: "impostos_receita", titulo: "(−) Impostos sobre Receita", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
];

const NOTA_BENEFICIO =
  "O benefício (Caju) não separa operação de administrativo no Conta Azul; " +
  "o realizado é rateado pela fração orçada do mês.";

const LINHAS_CSV: DefLinha[] = [
  { metrica: "csv_salarios", titulo: "(−) CSV — Salários", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
  { metrica: "csv_beneficio", titulo: "(−) CSV — Benefício", tipoAgregacao: "fluxo", direcao: "menor_melhor", nota: NOTA_BENEFICIO },
  { metrica: "csv_stack", titulo: "(−) CSV — Stack Tecnologia", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
];

const NOTA_SGA =
  "Inclui o complemento do benefício (Caju) não atribuído ao CSV, " +
  "rateado pela fração orçada do mês.";

const NOTA_BONUS =
  "Realizado usa a categoria Premiações (05.01.10), que também inclui " +
  "premiações mensais orçadas no SG&A (~R$ 5k/mês).";

const LINHAS_OPEX: DefLinha[] = [
  { metrica: "cac", titulo: "(−) CAC", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
  { metrica: "sga", titulo: "(−) SG&A", tipoAgregacao: "fluxo", direcao: "menor_melhor", nota: NOTA_SGA },
  { metrica: "bonus", titulo: "(−) Bônus", tipoAgregacao: "fluxo", direcao: "menor_melhor", nota: NOTA_BONUS },
];

const NOTA_IMPOSTOS_DIRETOS =
  "IRPJ/CSLL ainda não aparecem lançados no Conta Azul em 2026 — o atingimento " +
  "baixo reflete lacuna de lançamento, não economia.";

const NOTA_GERACAO =
  "Enquanto IRPJ/CSLL não forem lançados no Conta Azul, o realizado desta linha " +
  "fica superestimado.";

const LINHAS_POS_EBITDA: DefLinha[] = [
  { metrica: "impostos_diretos", titulo: "(−) IR + CSLL + ICMS + DIFAL", tipoAgregacao: "fluxo", direcao: "menor_melhor", nota: NOTA_IMPOSTOS_DIRETOS },
  { metrica: "capex", titulo: "(−) CAPEX", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
];

// Soma mensal de despesas em regime caixa (QUITADO por data_quitacao em 2026),
// filtrada por um predicado de categorias.
async function somaDespesaCaixaPorMes(
  db: any,
  predicadoCategorias: ReturnType<typeof sql>
): Promise<Record<number, number>> {
  const result = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_quitacao)::int AS mes,
           SUM(COALESCE(valor_pago::numeric, 0)) AS total
    FROM "Conta Azul".caz_parcelas
    WHERE tipo_evento = 'DESPESA'
      AND status = 'QUITADO'
      AND data_quitacao >= '2026-01-01' AND data_quitacao < '2027-01-01'
      AND (${predicadoCategorias})
    GROUP BY 1 ORDER BY 1
  `);
  const porMes: Record<number, number> = {};
  for (const row of result.rows as any[]) {
    porMes[Number(row.mes)] = parseFloat(row.total);
  }
  return porMes;
}

function buildLinhas(
  defs: DefLinha[],
  orcado: Record<string, Record<number, number>>,
  realizadoPorMetrica: Record<string, (mes: number) => number | null>
): LinhaReceita[] {
  return defs.map(({ metrica, titulo, tipoAgregacao, direcao, nota }) => ({
    metrica,
    titulo,
    tipoAgregacao,
    direcao,
    nota,
    meses: Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const o = orcado[metrica]?.[mes] ?? 0;
      const r = realizadoPorMetrica[metrica](mes);
      return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    }),
  }));
}

export function registerBp2026Routes(app: Express, db: any) {
  app.get("/api/bp2026/receitas", async (_req, res) => {
    try {
      if (cache && Date.now() < cache.expiraEm) {
        return res.json(cache.payload);
      }

      // 1. Orçado
      const orcadoResult = await db.execute(sql`
        SELECT metrica, mes, valor::numeric AS valor
        FROM cortex_core.bp2026_orcado
        ORDER BY metrica, mes
      `);
      const orcado: Record<string, Record<number, number>> = {};
      for (const row of orcadoResult.rows as any[]) {
        if (!orcado[row.metrica]) orcado[row.metrica] = {};
        orcado[row.metrica][Number(row.mes)] = parseFloat(row.valor);
      }

      // 2. MRR realizado: último snapshot disponível dentro de cada mês
      const mrrResult = await db.execute(sql`
        WITH snaps AS (
          SELECT DISTINCT data_snapshot::date AS d
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot::date >= '2026-01-01'
        ),
        alvo AS (
          SELECT gs.mes, MAX(s.d) AS snapshot_dia
          FROM generate_series(1, 12) AS gs(mes)
          JOIN snaps s
            ON s.d >= make_date(2026, gs.mes, 1)
           AND s.d < (make_date(2026, gs.mes, 1) + INTERVAL '1 month')
          GROUP BY gs.mes
        )
        SELECT a.mes, a.snapshot_dia::text AS snapshot_dia, SUM(h.valorr::numeric) AS mrr
        FROM alvo a
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.snapshot_dia
        WHERE h.status IN ('ativo', 'onboarding', 'triagem')
        GROUP BY a.mes, a.snapshot_dia
        ORDER BY a.mes
      `);
      const mrrPorMes: Record<number, { valor: number; snapshotDia: string }> = {};
      for (const row of mrrResult.rows as any[]) {
        mrrPorMes[Number(row.mes)] = {
          valor: parseFloat(row.mrr),
          snapshotDia: row.snapshot_dia,
        };
      }

      // 3. Pontual realizado: vendas ganhas no Bitrix
      const pontualResult = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_fechamento)::int AS mes,
               SUM(valor_pontual::numeric) AS total
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= '2026-01-01' AND data_fechamento < '2027-01-01'
          AND valor_pontual > 0
        GROUP BY 1 ORDER BY 1
      `);
      const pontualPorMes: Record<number, number> = {};
      for (const row of pontualResult.rows as any[]) {
        pontualPorMes[Number(row.mes)] = parseFloat(row.total);
      }

      // 4. Outras receitas: Conta Azul por competência
      const outrasResult = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_competencia)::int AS mes,
               SUM(valor_liquido::numeric) AS total
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_competencia >= '2026-01-01' AND data_competencia < '2027-01-01'
          AND (categoria_nome LIKE '03.02%' OR categoria_nome LIKE '03.03%'
               OR categoria_nome LIKE '04.01%' OR categoria_nome LIKE '04.03%')
        GROUP BY 1 ORDER BY 1
      `);
      const outrasPorMes: Record<number, number> = {};
      for (const row of outrasResult.rows as any[]) {
        outrasPorMes[Number(row.mes)] = parseFloat(row.total);
      }

      // 4b. Inadimplência: foto atual — não pago das parcelas JÁ vencidas no mês
      // (data_vencimento <= hoje: parcelas a vencer no restante do mês corrente não são inadimplência)
      const inadResult = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_vencimento)::int AS mes,
               SUM(nao_pago::numeric) AS total
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_vencimento >= '2026-01-01' AND data_vencimento < '2027-01-01'
          AND data_vencimento <= CURRENT_DATE
          AND nao_pago::numeric > 0
        GROUP BY 1 ORDER BY 1
      `);
      const inadPorMes: Record<number, number> = {};
      for (const row of inadResult.rows as any[]) {
        inadPorMes[Number(row.mes)] = parseFloat(row.total);
      }

      // 4c. Impostos sobre receita: regime caixa (quitação), categorias 05.05.x
      const impostosPorMes = await somaDespesaCaixaPorMes(db, sql`categoria_nome LIKE '05.05%'`);

      // 4d. CSV Salários: caixa — folha de operação (05.01 exceto premiações) + freelancers (05.02)
      const salariosPorMes = await somaDespesaCaixaPorMes(
        db,
        sql`(categoria_nome LIKE '05.01%' AND categoria_nome NOT LIKE '05.01.10%') OR categoria_nome LIKE '05.02%'`
      );

      // 4e. Benefícios totais da empresa (Caju): caixa — rateado depois pela fração orçada
      const beneficioTotalPorMes = await somaDespesaCaixaPorMes(db, sql`categoria_nome LIKE '06.10.04%'`);

      // 4f. CSV Stack: caixa — todo o software da empresa (conceito da planilha)
      const stackPorMes = await somaDespesaCaixaPorMes(
        db,
        sql`categoria_nome LIKE '05.03%' OR categoria_nome LIKE '05.04.01%' OR categoria_nome LIKE '06.05.03%' OR categoria_nome LIKE '06.10.01%'`
      );

      // 4g. CAC: caixa — comercial, mídia, eventos, brindes, viagens, locomoção
      const cacPorMes = await somaDespesaCaixaPorMes(
        db,
        sql`categoria_nome LIKE '05.04.02%' OR categoria_nome LIKE '06.04%'
            OR categoria_nome LIKE '06.05.04%' OR categoria_nome LIKE '06.05.05%'
            OR categoria_nome LIKE '06.06%' OR categoria_nome LIKE '06.07%'`
      );

      // 4h. SG&A (sem benefício): caixa — ocupação, tarifas, backoffice, pró-labore, adm
      const sgaBucketPorMes = await somaDespesaCaixaPorMes(
        db,
        sql`categoria_nome LIKE '06.02%' OR categoria_nome LIKE '06.03%'
            OR categoria_nome LIKE '06.08%' OR categoria_nome LIKE '06.09%'
            OR categoria_nome LIKE '06.10.02%' OR categoria_nome LIKE '06.10.03%'
            OR categoria_nome LIKE '06.10.06%' OR categoria_nome LIKE '06.10.07%'
            OR categoria_nome LIKE '06.10.08%'`
      );

      // 4i. Bônus: caixa — Premiações (05.01.10), excluída do CSV-Salários
      const bonusPorMes = await somaDespesaCaixaPorMes(db, sql`categoria_nome LIKE '05.01.10%'`);

      // 4j. Impostos diretos: caixa — ICMS/DIFAL + IRPJ/CSLL quando lançados
      const impostosDiretosPorMes = await somaDespesaCaixaPorMes(
        db,
        sql`categoria_nome LIKE '06.12%' OR categoria_nome LIKE '06.13%' OR categoria_nome LIKE '08.01%'`
      );

      // 4k. CAPEX: caixa — computadores, periféricos e conserto de ativo
      const capexPorMes = await somaDespesaCaixaPorMes(db, sql`categoria_nome LIKE '06.11%'`);

      // 5. Montagem: meses futuros => realizado null
      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const mesCorrente =
        anoAtual > ANO ? 12 : anoAtual < ANO ? 0 : agora.getMonth() + 1;
      // mesFechado: 12 quando o ano inteiro já fechou, 0 quando nenhum mês fechou ainda,
      // caso contrário o mês imediatamente anterior ao corrente.
      const mesFechado = anoAtual > ANO ? 12 : mesCorrente <= 1 ? 0 : mesCorrente - 1;

      const realizadoPorMetrica: Record<string, (mes: number) => number | null> = {
        mrr_ativo: (mes) => (mes <= mesCorrente ? mrrPorMes[mes]?.valor ?? null : null),
        receita_pontual: (mes) => (mes <= mesCorrente ? pontualPorMes[mes] ?? null : null),
        outras_receitas: (mes) => (mes <= mesCorrente ? outrasPorMes[mes] ?? null : null),
        inadimplencia: (mes) => (mes <= mesCorrente ? inadPorMes[mes] ?? 0 : null),
        impostos_receita: (mes) => (mes <= mesCorrente ? impostosPorMes[mes] ?? 0 : null),
        csv_salarios: (mes) => (mes <= mesCorrente ? salariosPorMes[mes] ?? 0 : null),
        csv_beneficio: (mes) =>
          mes <= mesCorrente
            ? ratear(
                beneficioTotalPorMes[mes] ?? 0,
                orcado["csv_beneficio"]?.[mes] ?? 0,
                orcado["beneficio_total_empresa"]?.[mes] ?? 0
              )
            : null,
        csv_stack: (mes) => (mes <= mesCorrente ? stackPorMes[mes] ?? 0 : null),
        cac: (mes) => (mes <= mesCorrente ? cacPorMes[mes] ?? 0 : null),
        sga: (mes) => {
          if (mes > mesCorrente) return null;
          // complemento do Caju: parcela não atribuída ao CSV (fecha o rateio da Parte 3)
          const complemento = ratear(
            beneficioTotalPorMes[mes] ?? 0,
            (orcado["beneficio_total_empresa"]?.[mes] ?? 0) - (orcado["csv_beneficio"]?.[mes] ?? 0),
            orcado["beneficio_total_empresa"]?.[mes] ?? 0
          );
          if (complemento === null) return null; // denominador inválido => seed quebrado, sinalizar
          return (sgaBucketPorMes[mes] ?? 0) + complemento;
        },
        bonus: (mes) => (mes <= mesCorrente ? bonusPorMes[mes] ?? 0 : null),
        impostos_diretos: (mes) => (mes <= mesCorrente ? impostosDiretosPorMes[mes] ?? 0 : null),
        capex: (mes) => (mes <= mesCorrente ? capexPorMes[mes] ?? 0 : null),
      };

      const linhas: LinhaReceita[] = LINHAS.map(({ metrica, titulo, tipoAgregacao, direcao }) => ({
        metrica,
        titulo,
        tipoAgregacao,
        direcao,
        meses: Array.from({ length: 12 }, (_, i) => {
          const mes = i + 1;
          const o = orcado[metrica]?.[mes] ?? 0;
          const r = realizadoPorMetrica[metrica](mes);
          const fonteAproximada =
            metrica === "mrr_ativo" && r !== null && mes <= mesFechado
              ? mrrPorMes[mes]?.snapshotDia !== ultimoDiaDoMes(ANO, mes)
              : undefined;
          return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r), fonteAproximada };
        }),
      }));

      // 6. Linha derivada: Receita Total Faturável
      const totalMeses: MesValor[] = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        const orcadoTotal = linhas.reduce((s, l) => s + l.meses[i].orcado, 0);
        const algumRealizado = linhas.some((l) => l.meses[i].realizado !== null);
        const realizadoTotal = algumRealizado
          ? linhas.reduce((s, l) => s + (l.meses[i].realizado ?? 0), 0)
          : null;
        return { mes, orcado: orcadoTotal, realizado: realizadoTotal };
      });
      linhas.push({
        metrica: "receita_total_faturavel",
        titulo: "(=) Receita Total Faturável",
        tipoAgregacao: "fluxo",
        direcao: "maior_melhor",
        meses: totalMeses.map((m) => ({
          ...m,
          atingimento: calcAtingimento(m.orcado, m.realizado),
        })),
      });

      // 6b. Deduções: inadimplência e impostos
      const deducoes = buildLinhas(LINHAS_DEDUCOES, orcado, realizadoPorMetrica);
      linhas.push(...deducoes);

      // 6c. Receita Líquida = Total Faturável − Inadimplência − Impostos
      const liquidaMeses = subtrairMeses(
        totalMeses,
        deducoes.map((d) => d.meses)
      );
      linhas.push({
        metrica: "receita_liquida",
        titulo: "(=) Receita Líquida",
        tipoAgregacao: "fluxo",
        direcao: "maior_melhor",
        meses: liquidaMeses.map((m) => ({
          ...m,
          atingimento: calcAtingimento(m.orcado, m.realizado),
        })),
      });

      // 6d. CSV: salários, benefício (rateado) e stack
      const linhasCsv = buildLinhas(LINHAS_CSV, orcado, realizadoPorMetrica);
      linhas.push(...linhasCsv);

      // 6e. Margem Bruta = Receita Líquida − CSV (salários + benefício + stack)
      const margemMeses = subtrairMeses(
        liquidaMeses,
        linhasCsv.map((l) => l.meses)
      );
      linhas.push({
        metrica: "margem_bruta",
        titulo: "(=) Margem Bruta",
        tipoAgregacao: "fluxo",
        direcao: "maior_melhor",
        meses: margemMeses.map((m) => ({
          ...m,
          atingimento: calcAtingimento(m.orcado, m.realizado),
        })),
      });

      // 6f. Opex: CAC, SG&A (com complemento do benefício) e Bônus
      const linhasOpex = buildLinhas(LINHAS_OPEX, orcado, realizadoPorMetrica);
      linhas.push(...linhasOpex);

      // 6g. EBITDA = Margem Bruta − CAC − SG&A − Bônus
      const ebitdaMeses = subtrairMeses(
        margemMeses,
        linhasOpex.map((l) => l.meses)
      );
      linhas.push({
        metrica: "ebitda",
        titulo: "(=) EBITDA",
        tipoAgregacao: "fluxo",
        direcao: "maior_melhor",
        meses: ebitdaMeses.map((m) => ({
          ...m,
          atingimento: calcAtingimento(m.orcado, m.realizado),
        })),
      });

      // 6h. Pós-EBITDA: impostos diretos e CAPEX
      const linhasPosEbitda = buildLinhas(LINHAS_POS_EBITDA, orcado, realizadoPorMetrica);
      linhas.push(...linhasPosEbitda);

      // 6i. Geração de Caixa = EBITDA − impostos diretos − CAPEX
      const geracaoMeses = subtrairMeses(
        ebitdaMeses,
        linhasPosEbitda.map((l) => l.meses)
      );
      linhas.push({
        metrica: "geracao_caixa",
        titulo: "(=) Geração de Caixa",
        tipoAgregacao: "fluxo",
        direcao: "maior_melhor",
        nota: NOTA_GERACAO,
        meses: geracaoMeses.map((m) => ({
          ...m,
          atingimento: calcAtingimento(m.orcado, m.realizado),
        })),
      });

      // 7. YTD por linha — acumula apenas meses fechados; mês corrente (parcial) fica de fora
      // mesFechado já calculado acima (hoisted para uso em fonteAproximada)
      const payload = {
        ano: ANO,
        mesCorrente,
        mesFechado,
        linhas: linhas.map((l) => ({
          ...l,
          ytd: (() => {
            if (mesFechado === 0) {
              return { orcado: 0, realizado: null, atingimento: null };
            }
            const v = calcYtd(l.meses, mesFechado, l.tipoAgregacao);
            return { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) };
          })(),
        })),
        atualizadoEm: new Date().toISOString(),
      };

      cache = { payload, expiraEm: Date.now() + CACHE_TTL_MS };
      res.json(payload);
    } catch (error) {
      console.error("[bp2026] Erro em /api/bp2026/receitas:", error);
      res.status(500).json({ error: "Erro ao calcular orçado x realizado" });
    }
  });
}
