// Tela /reports/operacao — leitura gerencial da semana de operação.
// Spec: docs/superpowers/specs/2026-07-24-reporte-semanal-operacao-design.md
//
// Compara a última semana FECHADA com a anterior. A semana em curso não entra:
// comparar meia semana com uma inteira produz queda fantasma toda segunda.
import type { Express } from "express";
import { db } from "../db";
import { parSemanas, hojeSP, type Semana } from "../reportsSemanal/semanas";
import {
  derivarOperacao,
  compararOperacao,
  type SemanaOperacao,
} from "../reportsSemanal/derivarOperacao";
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
import {
  estoquePontualNoFim,
  estoquePontualPorProduto,
  churnPorMotivoNaSemana,
  headcountOperacao,
  faturavelDoMes,
  detalheChurnPorAbono,
  detalheChurnDoMotivo,
  detalheEstoquePontual,
} from "../reportsSemanal/queriesOperacao";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * As queries de UMA semana. Em dois lotes de no máximo 4: o pool é max: 5
 * (server/db.ts) e é compartilhado com o app inteiro — disparar as 8 de uma vez
 * deixaria o resto do app esperando conexão enquanto esta tela carrega.
 */
async function apurarSemana(semana: Semana): Promise<SemanaOperacao> {
  const [carteira, base, entregaPontual, churnMrr] = await Promise.all([
    carteiraNoFim(db, semana.fim),
    baseNaAbertura(db, semana.inicio),
    entregaPontualNaSemana(db, semana.inicio, semana.fim),
    churnMrrNaSemana(db, semana.inicio, semana.fim),
  ]);
  const [churnPontual, estoque, porProduto, porMotivo] = await Promise.all([
    churnPontualNaSemana(db, semana.inicio, semana.fim),
    estoquePontualNoFim(db, semana.fim),
    estoquePontualPorProduto(db, semana.fim),
    churnPorMotivoNaSemana(db, semana.inicio, semana.fim),
  ]);
  const [headcount, faturavel] = await Promise.all([
    headcountOperacao(db, semana.fim),
    faturavelDoMes(db, semana.fim),
  ]);

  return derivarOperacao({
    semana,
    carteira,
    base,
    entregaPontual,
    estoquePontual: estoque,
    estoquePorProduto: porProduto,
    churnMrr,
    churnPontual,
    churnPorMotivo: porMotivo,
    headcountOperacao: headcount,
    faturavelMes: faturavel.valor,
    faturavelMesParcial: faturavel.parcial,
  });
}

export function registerReportsOperacaoRoutes(app: Express) {
  app.get("/api/reports/operacao", async (req, res) => {
    try {
      const ate = req.query.ate ? String(req.query.ate) : undefined;
      if (ate && !DATA_ISO.test(ate)) {
        return res.status(400).json({ error: "Parâmetro 'ate' deve ser uma data YYYY-MM-DD" });
      }

      const { atual, anterior } = parSemanas(hojeSP(), ate);
      // Semanas em SÉRIE: ver o comentário de pool em apurarSemana.
      const metricasAtual = await apurarSemana(atual);
      const metricasAnterior = await apurarSemana(anterior);

      res.json(compararOperacao(metricasAtual, metricasAnterior));
    } catch (e: any) {
      console.error("[reports/operacao] erro geral:", e);
      res.status(500).json({ error: "Falha ao montar o reporte de operação", details: e?.message });
    }
  });

  // Drill de uma célula: as linhas por trás do número. `chave` carrega o
  // produto ou o motivo quando a métrica é de uma tabela quebrada.
  app.get("/api/reports/operacao/detalhe", async (req, res) => {
    try {
      const metrica = String(req.query.metrica || "");
      const inicio = String(req.query.inicio || "");
      const fim = String(req.query.fim || "");
      const chave = req.query.chave ? String(req.query.chave) : null;

      if (!DATA_ISO.test(inicio) || !DATA_ISO.test(fim)) {
        return res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' devem ser datas YYYY-MM-DD" });
      }

      switch (metrica) {
        case "churnMrrTotal":
          return res.json({ tipo: "churn", linhas: await detalheChurnMrr(db, inicio, fim, false) });
        case "churnMrrAbonado":
          return res.json({
            tipo: "churn",
            linhas: await detalheChurnPorAbono(db, inicio, fim, { pontual: false, abonados: true }),
          });
        case "churnMrrLiquido":
          return res.json({
            tipo: "churn",
            linhas: await detalheChurnPorAbono(db, inicio, fim, { pontual: false, abonados: false }),
          });
        case "churnPontualTotal":
          return res.json({ tipo: "churn", linhas: await detalheChurnPontual(db, inicio, fim, false) });
        case "churnPontualAbonado":
          return res.json({
            tipo: "churn",
            linhas: await detalheChurnPorAbono(db, inicio, fim, { pontual: true, abonados: true }),
          });
        case "churnPontualLiquido":
          return res.json({
            tipo: "churn",
            linhas: await detalheChurnPorAbono(db, inicio, fim, { pontual: true, abonados: false }),
          });
        case "entregaPontual":
          return res.json({ tipo: "churn", linhas: await detalheEntregaPontual(db, inicio, fim) });
        case "estoquePontual":
          return res.json({ tipo: "churn", linhas: await detalheEstoquePontual(db, fim, chave) });
        case "churnMotivo": {
          if (!chave) {
            return res.status(400).json({ error: "Métrica 'churnMotivo' exige o parâmetro 'chave'" });
          }
          return res.json({ tipo: "churn", linhas: await detalheChurnDoMotivo(db, inicio, fim, chave) });
        }
        default:
          return res.status(400).json({ error: `Métrica '${metrica}' não tem drill` });
      }
    } catch (e: any) {
      console.error("[reports/operacao/detalhe] erro:", e);
      res.status(500).json({ error: "Falha ao carregar o detalhe", details: e?.message });
    }
  });
}
