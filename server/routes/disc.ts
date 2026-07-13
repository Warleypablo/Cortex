import type { Express } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { computeDiscResult, FATORES, type Fator } from "@shared/disc";

const respostasSchema = z.object({
  respostas: z
    .array(z.enum(["D", "I", "S", "C"]))
    .length(40, "O teste precisa de 40 respostas"),
});

// SELECT do resultado mais recente por usuário, com dados do colaborador.
// DISTINCT ON garante 1 linha por user_id (a mais recente).
function ultimoPorUsuarioSQL() {
  return sql`
    SELECT DISTINCT ON (r.user_id)
      r.user_id        AS "userId",
      r.colaborador_id AS "colaboradorId",
      r.score_d        AS "scoreD",
      r.score_i        AS "scoreI",
      r.score_s        AS "scoreS",
      r.score_c        AS "scoreC",
      r.perfil_dominante  AS "dominante",
      r.perfil_secundario AS "secundario",
      r.criado_em      AS "criadoEm",
      p.nome           AS "nome",
      p.squad          AS "squad",
      u.name           AS "userName",
      u.picture        AS "foto"
    FROM "Inhire".rh_disc_resultados r
    LEFT JOIN "Inhire".rh_pessoal p ON p.id = r.colaborador_id
    LEFT JOIN cortex_core.auth_users u ON u.id = r.user_id
    ORDER BY r.user_id, r.criado_em DESC
  `;
}

export function registerDiscRoutes(app: Express, db: any) {
  // POST — envia respostas, calcula no server, grava.
  app.post("/api/gg/disc/resultado", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ error: "Não autenticado" });

      const parsed = respostasSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Respostas inválidas", details: parsed.error });
      }
      const respostas = parsed.data.respostas as Fator[];
      const resultado = computeDiscResult(respostas);

      // Resolve colaborador pelo email do usuário logado.
      let colaboradorId: number | null = null;
      if (user.email) {
        const colab = await db.execute(sql`
          SELECT id FROM "Inhire".rh_pessoal
          WHERE LOWER(email_turbo) = LOWER(${user.email})
             OR LOWER(email_pessoal) = LOWER(${user.email})
          LIMIT 1
        `);
        if (colab.rows.length > 0) colaboradorId = (colab.rows[0] as any).id;
      }

      const inserted = await db.execute(sql`
        INSERT INTO "Inhire".rh_disc_resultados
          (user_id, colaborador_id, respostas, score_d, score_i, score_s, score_c, perfil_dominante, perfil_secundario)
        VALUES
          (${user.id}, ${colaboradorId}, ${JSON.stringify(respostas)}::jsonb,
           ${resultado.scoreD}, ${resultado.scoreI}, ${resultado.scoreS}, ${resultado.scoreC},
           ${resultado.dominante}, ${resultado.secundario})
        RETURNING id, criado_em AS "criadoEm"
      `);

      res.status(201).json({
        ...resultado,
        id: (inserted.rows[0] as any).id,
        criadoEm: (inserted.rows[0] as any).criadoEm,
        colaboradorId,
      });
    } catch (error) {
      console.error("[api] Error saving DISC result:", error);
      res.status(500).json({ error: "Falha ao salvar resultado" });
    }
  });

  // GET — resultado atual do usuário logado (ou null).
  app.get("/api/gg/disc/meu", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ error: "Não autenticado" });
      const result = await db.execute(sql`
        SELECT score_d AS "scoreD", score_i AS "scoreI", score_s AS "scoreS", score_c AS "scoreC",
               perfil_dominante AS "dominante", perfil_secundario AS "secundario", criado_em AS "criadoEm"
        FROM "Inhire".rh_disc_resultados
        WHERE user_id = ${user.id}
        ORDER BY criado_em DESC
        LIMIT 1
      `);
      res.json(result.rows[0] ?? null);
    } catch (error) {
      console.error("[api] Error fetching my DISC:", error);
      res.status(500).json({ error: "Falha ao buscar resultado" });
    }
  });

  // GET — mapa do time: distribuição + quem fez + quem falta.
  app.get("/api/gg/disc/mapa", async (req, res) => {
    try {
      const feitosRes = await db.execute(ultimoPorUsuarioSQL());
      const feitos = feitosRes.rows.map((r: any) => ({
        userId: r.userId,
        colaboradorId: r.colaboradorId,
        nome: r.nome ?? r.userName ?? "—",
        foto: r.foto ?? null,
        squad: r.squad ?? null,
        dominante: r.dominante,
        secundario: r.secundario,
        criadoEm: r.criadoEm,
      }));

      const distribuicao = { D: 0, I: 0, S: 0, C: 0 } as Record<Fator, number>;
      for (const f of feitos) if (f.dominante in distribuicao) distribuicao[f.dominante as Fator]++;

      // Pendentes: colaboradores ativos sem nenhum resultado.
      const pendRes = await db.execute(sql`
        SELECT p.id AS "colaboradorId", p.nome AS "nome", p.squad AS "squad"
        FROM "Inhire".rh_pessoal p
        WHERE (p.status IS NULL OR LOWER(p.status) = 'ativo')
          AND p.id NOT IN (
            SELECT DISTINCT colaborador_id FROM "Inhire".rh_disc_resultados WHERE colaborador_id IS NOT NULL
          )
        ORDER BY p.nome
      `);

      res.json({
        distribuicao,
        total: feitos.length,
        feitos,
        pendentes: pendRes.rows,
      });
    } catch (error) {
      console.error("[api] Error fetching DISC mapa:", error);
      res.status(500).json({ error: "Falha ao buscar mapa" });
    }
  });

  // GET — resultado completo por usuário (para abrir detalhe no mapa).
  app.get("/api/gg/disc/resultado/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await db.execute(sql`
        SELECT r.score_d AS "scoreD", r.score_i AS "scoreI", r.score_s AS "scoreS", r.score_c AS "scoreC",
               r.perfil_dominante AS "dominante", r.perfil_secundario AS "secundario", r.criado_em AS "criadoEm",
               COALESCE(p.nome, u.name) AS "nome", p.squad AS "squad", u.picture AS "foto"
        FROM "Inhire".rh_disc_resultados r
        LEFT JOIN "Inhire".rh_pessoal p ON p.id = r.colaborador_id
        LEFT JOIN cortex_core.auth_users u ON u.id = r.user_id
        WHERE r.user_id = ${userId}
        ORDER BY r.criado_em DESC
        LIMIT 1
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Sem resultado" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error fetching DISC by user:", error);
      res.status(500).json({ error: "Falha ao buscar resultado" });
    }
  });

  // GET — resultado por colaborador (card no perfil do colaborador).
  app.get("/api/gg/disc/por-colaborador/:colaboradorId", async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.colaboradorId);
      if (isNaN(colaboradorId)) return res.status(400).json({ error: "ID inválido" });
      const result = await db.execute(sql`
        SELECT score_d AS "scoreD", score_i AS "scoreI", score_s AS "scoreS", score_c AS "scoreC",
               perfil_dominante AS "dominante", perfil_secundario AS "secundario", criado_em AS "criadoEm"
        FROM "Inhire".rh_disc_resultados
        WHERE colaborador_id = ${colaboradorId}
        ORDER BY criado_em DESC
        LIMIT 1
      `);
      res.json(result.rows[0] ?? null);
    } catch (error) {
      console.error("[api] Error fetching DISC by colaborador:", error);
      res.status(500).json({ error: "Falha ao buscar resultado" });
    }
  });
}
