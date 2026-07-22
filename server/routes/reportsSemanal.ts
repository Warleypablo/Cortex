// Tela /reports/semanal — métricas do Resumo dos Líderes em recorte semanal.
// Spec: docs/superpowers/specs/2026-07-21-reporte-semanal-lideres-design.md
//
// A classificação venda nova × cross-sell vem de server/crm/expansao.ts, o
// MESMO módulo que a mensagem diária usa. É o que impede a tela e a mensagem
// de divergirem.
import type { Express } from "express";
import { db } from "../db";
import { gerarSemanas, hojeSP } from "../reportsSemanal/semanas";
import { derivarSemana, type SemanaMetricas } from "../reportsSemanal/derivar";
import { vendasPorChannel, dealsPorChannel } from "../crm/expansao";
import {
  carteiraNoFim,
  baseNaAbertura,
  entregaPontualNaSemana,
  churnMrrNaSemana,
  churnPontualNaSemana,
  detalheChurnMrr,
  detalheChurnPontual,
  detalheEntregaPontual,
} from "../reportsSemanal/queries";

const SEMANAS_PADRAO = 12;
const SEMANAS_MAX = 52;

export function registerReportsSemanalRoutes(app: Express) {
  app.get("/api/reports/semanal", async (req, res) => {
    try {
      const pedido = Number(req.query.semanas);
      const quantidade = Number.isFinite(pedido)
        ? Math.min(Math.max(Math.trunc(pedido), 1), SEMANAS_MAX)
        : SEMANAS_PADRAO;

      const semanas = gerarSemanas(hojeSP(), quantidade);

      // As semanas são independentes entre si: uma rodada de Promise.all por
      // semana, e todas as semanas em paralelo.
      const metricas: SemanaMetricas[] = await Promise.all(
        semanas.map(async (semana) => {
          const [vendas, carteira, base, entregaPontual, churnMrr, churnPontual] = await Promise.all([
            vendasPorChannel(db, semana.inicio, semana.fim),
            carteiraNoFim(db, semana.fim),
            baseNaAbertura(db, semana.inicio),
            entregaPontualNaSemana(db, semana.inicio, semana.fim),
            churnMrrNaSemana(db, semana.inicio, semana.fim),
            churnPontualNaSemana(db, semana.inicio, semana.fim),
          ]);
          return derivarSemana({
            semana,
            vendas,
            carteira,
            baseMrr: base.mrr,
            basePontual: base.pontual,
            entregaPontual,
            churnMrr,
            churnPontual,
          });
        }),
      );

      res.json({ semanas: metricas });
    } catch (e: any) {
      console.error("[reports/semanal] erro geral:", e);
      res.status(500).json({ error: "Falha ao montar o reporte semanal", details: e?.message });
    }
  });

  // Drill de uma célula: as linhas por trás do número.
  app.get("/api/reports/semanal/detalhe", async (req, res) => {
    try {
      const metrica = String(req.query.metrica || "");
      const inicio = String(req.query.inicio || "");
      const fim = String(req.query.fim || "");

      if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
        return res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' devem ser datas YYYY-MM-DD" });
      }

      switch (metrica) {
        case "mrrAdicionado":
        case "pontualVendido": {
          const deals = await dealsPorChannel(db, inicio, fim, "novo");
          return res.json({ tipo: "deals", linhas: deals });
        }
        case "crossMrr":
        case "crossPontual": {
          const deals = await dealsPorChannel(db, inicio, fim, "cross");
          return res.json({ tipo: "deals", linhas: deals });
        }
        case "churnMrrTotal":
        case "churnMrrAjustado":
          return res.json({ tipo: "churn", linhas: await detalheChurnMrr(db, inicio, fim) });
        case "churnPontualTotal":
        case "churnPontualAjustado":
          return res.json({ tipo: "churn", linhas: await detalheChurnPontual(db, inicio, fim) });
        case "entregaPontual":
          return res.json({ tipo: "churn", linhas: await detalheEntregaPontual(db, inicio, fim) });
        default:
          return res.status(400).json({ error: `Métrica '${metrica}' não tem drill` });
      }
    } catch (e: any) {
      console.error("[reports/semanal/detalhe] erro:", e);
      res.status(500).json({ error: "Falha ao carregar o detalhe", details: e?.message });
    }
  });
}
