// server/routes/bp2026.ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import {
  calcAtingimento,
  calcYtd,
  ultimoDiaDoMes,
  subtrairMeses,
  type MesValor,
  type TipoAgregacao,
} from "./bp2026.helpers";

const ANO = 2026;
const CACHE_TTL_MS = 10 * 60 * 1000;

export type Direcao = "maior_melhor" | "menor_melhor";

interface LinhaReceita {
  metrica: string;
  titulo: string;
  tipoAgregacao: TipoAgregacao;
  direcao: Direcao;
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

const LINHAS_DEDUCOES: Array<{
  metrica: string;
  titulo: string;
  tipoAgregacao: TipoAgregacao;
  direcao: Direcao;
}> = [
  { metrica: "inadimplencia", titulo: "(−) Inadimplência", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
  { metrica: "impostos_receita", titulo: "(−) Impostos sobre Receita", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
];

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

      // 4b. Inadimplência: foto atual — não pago das parcelas vencidas no mês
      const inadResult = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_vencimento)::int AS mes,
               SUM(nao_pago::numeric) AS total
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_vencimento >= '2026-01-01' AND data_vencimento < '2027-01-01'
          AND nao_pago::numeric > 0
        GROUP BY 1 ORDER BY 1
      `);
      const inadPorMes: Record<number, number> = {};
      for (const row of inadResult.rows as any[]) {
        inadPorMes[Number(row.mes)] = parseFloat(row.total);
      }

      // 4c. Impostos sobre receita: regime caixa (quitação), categorias 05.05.x
      const impostosResult = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_quitacao)::int AS mes,
               SUM(COALESCE(valor_pago::numeric, 0)) AS total
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'DESPESA'
          AND categoria_nome LIKE '05.05%'
          AND status = 'QUITADO'
          AND data_quitacao >= '2026-01-01' AND data_quitacao < '2027-01-01'
        GROUP BY 1 ORDER BY 1
      `);
      const impostosPorMes: Record<number, number> = {};
      for (const row of impostosResult.rows as any[]) {
        impostosPorMes[Number(row.mes)] = parseFloat(row.total);
      }

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
      const deducoes: LinhaReceita[] = LINHAS_DEDUCOES.map(
        ({ metrica, titulo, tipoAgregacao, direcao }) => ({
          metrica,
          titulo,
          tipoAgregacao,
          direcao,
          meses: Array.from({ length: 12 }, (_, i) => {
            const mes = i + 1;
            const o = orcado[metrica]?.[mes] ?? 0;
            const r = realizadoPorMetrica[metrica](mes);
            return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
          }),
        })
      );
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
