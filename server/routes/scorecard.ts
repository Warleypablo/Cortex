import type { Express } from "express";
import { isAuthenticated } from "../auth/middleware";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { BP_2026_TARGETS } from "../okr2026/bp2026Targets";
import { krs, type KRDef } from "../okr2026/okrRegistry";

export type ScorecardUnit = "BRL" | "PCT" | "COUNT";
export type ScorecardDirection = "up" | "down";
export type ScorecardOrigem = "bp" | "okr" | "override";

export interface ScorecardMeta {
  valor: number;
  unit: ScorecardUnit;
  direction: ScorecardDirection;
  origem: ScorecardOrigem;
  label: string;
}

export interface ScorecardMetasResult {
  metas: Record<string, ScorecardMeta>;
}

const MES_REGEX = /^\d{4}-\d{2}$/;

/**
 * Overrides fixos que não vêm do BP2026 nem do OKR (ex: metas manuais/negociadas
 * fora dos dois sistemas de planejamento).
 */
const OVERRIDES: Record<string, ScorecardMeta> = {
  receita_cabeca: {
    valor: 20000,
    unit: "BRL",
    direction: "up",
    origem: "override",
    label: "Receita por Cabeça",
  },
};

function quarterFromMes(mes: string): "Q1" | "Q2" | "Q3" | "Q4" | null {
  const mm = parseInt(mes.slice(5, 7), 10);
  if (!mm || mm < 1 || mm > 12) return null;
  if (mm <= 3) return "Q1";
  if (mm <= 6) return "Q2";
  if (mm <= 9) return "Q3";
  return "Q4";
}

function krDirectionToScorecard(direction: KRDef["direction"]): ScorecardDirection {
  return direction === "gte" ? "up" : "down";
}

/**
 * Mensaliza o target trimestral do KR de acordo com sua agregação:
 * - quarter_sum: o target é a soma do trimestre → divide por 3 para virar meta mensal.
 * - quarter_avg / quarter_end / quarter_max / quarter_min: o target já representa
 *   o valor esperado em qualquer ponto do trimestre → mantém como está.
 */
function mensalizarTargetOkr(kr: KRDef, valorTrimestre: number): number {
  if (kr.aggregation === "quarter_sum") {
    return valorTrimestre / 3;
  }
  return valorTrimestre;
}

/**
 * Monta o mapa de metas consolidadas (BP2026 + OKR) para um mês (YYYY-MM).
 * Função pura: não acessa banco nem I/O — lê apenas os registries estáticos.
 *
 * Regra de precedência quando a mesma metric_key existe nos dois sistemas
 * (ex: mrr_active, ebitda, cash_generation, cash_balance): o BP2026 vence,
 * por ser mensal (mais granular) — o OKR é só trimestral.
 */
export function montarMetasScorecard(mes: string): ScorecardMetasResult {
  const metas: Record<string, ScorecardMeta> = {};

  const quarter = quarterFromMes(mes);

  // 1) OKR primeiro (trimestral, mensalizado) — processado antes do BP para que
  //    o BP possa sobrescrever em caso de colisão de metric_key.
  if (quarter) {
    for (const kr of krs) {
      const valorTrimestre = kr.targets[quarter];
      if (valorTrimestre === undefined || valorTrimestre === null) continue;

      metas[kr.metricKey] = {
        valor: mensalizarTargetOkr(kr, valorTrimestre),
        unit: kr.unit,
        direction: krDirectionToScorecard(kr.direction),
        origem: "okr",
        label: kr.title,
      };
    }
  }

  // 2) BP2026 (mensal) — sobrescreve o OKR quando a metric_key colide.
  for (const metric of BP_2026_TARGETS) {
    const valor = metric.months[mes];
    if (valor === undefined || valor === null) continue;

    metas[metric.metric_key] = {
      valor,
      unit: metric.unit,
      // "flat" não tem um equivalente direto em "up"|"down"; tratamos como "up"
      // (neutro) já que o contrato do endpoint só suporta as duas direções.
      direction: metric.direction === "down" ? "down" : "up",
      origem: "bp",
      label: metric.title,
    };
  }

  // 3) Overrides fixos por último — sempre vencem.
  for (const [key, meta] of Object.entries(OVERRIDES)) {
    metas[key] = meta;
  }

  return { metas };
}

export function registerScorecardRoutes(app: Express) {
  app.get("/api/scorecard/metas", isAuthenticated, (req, res) => {
    const mes = req.query.mes as string | undefined;

    if (!mes || !MES_REGEX.test(mes)) {
      return res.status(400).json({ error: "Parâmetro 'mes' inválido. Use o formato YYYY-MM." });
    }

    try {
      const result = montarMetasScorecard(mes);
      res.json(result);
    } catch (error) {
      console.error("[api] Error building scorecard metas:", error);
      res.status(500).json({ error: "Failed to build scorecard metas" });
    }
  });

  // Responsáveis editáveis por métrica (quem é o dono de cada metric_key no scorecard).
  app.get("/api/scorecard/responsaveis", isAuthenticated, async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT metrica_key, responsavel
        FROM cortex_core.scorecard_responsaveis
      `);
      const itens = result.rows.map((row: any) => ({
        metrica_key: row.metrica_key as string,
        responsavel: row.responsavel as string | null,
      }));
      res.json({ itens });
    } catch (error) {
      console.error("[api] Error em GET /api/scorecard/responsaveis:", error);
      res.status(500).json({ error: "Falha ao buscar responsáveis do scorecard" });
    }
  });

  app.put("/api/scorecard/responsaveis", isAuthenticated, async (req, res) => {
    try {
      const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
      const validos = itens.filter(
        (item: any) => typeof item?.metrica_key === "string" && item.metrica_key.trim().length > 0
      );

      for (const item of validos) {
        const responsavel = typeof item.responsavel === "string" ? item.responsavel : null;
        await db.execute(sql`
          INSERT INTO cortex_core.scorecard_responsaveis (metrica_key, responsavel, atualizado_em)
          VALUES (${item.metrica_key}, ${responsavel}, NOW())
          ON CONFLICT (metrica_key) DO UPDATE SET responsavel = EXCLUDED.responsavel, atualizado_em = NOW()
        `);
      }

      res.json({ ok: true, salvos: validos.length });
    } catch (error) {
      console.error("[api] Error em PUT /api/scorecard/responsaveis:", error);
      res.status(500).json({ error: "Falha ao salvar responsáveis do scorecard" });
    }
  });
}
