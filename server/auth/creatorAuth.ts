import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export interface CreatorSessionData {
  id: number;
  nome: string;
  email: string;
  cpf: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  chave_pix: string | null;
  tipo_pix: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCreatorAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Check existing session
  const session = req.session as any;
  if (session?.creatorData?.id) {
    return next();
  }

  // 2. Check token in query string
  const token = req.query.token as string | undefined;
  if (!token || !UUID_REGEX.test(token)) {
    return res.status(401).json({ message: "Acesso negado. Use o link fornecido pela equipe." });
  }

  // 3. Validate token against DB and create session
  (async () => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, email, cpf, cnpj, endereco, cidade, estado, cep, chave_pix, tipo_pix
        FROM cortex_core.creators
        WHERE portal_token = ${token}::uuid AND ativo = true
        LIMIT 1
      `);

      const creator = (result.rows as any[])[0];
      if (!creator) {
        return res.status(401).json({ message: "Token inválido ou expirado." });
      }

      const creatorData: CreatorSessionData = {
        id: creator.id,
        nome: creator.nome,
        email: creator.email,
        cpf: creator.cpf,
        cnpj: creator.cnpj,
        endereco: creator.endereco,
        cidade: creator.cidade,
        estado: creator.estado,
        cep: creator.cep,
        chave_pix: creator.chave_pix,
        tipo_pix: creator.tipo_pix,
      };

      // Regenerate session (security best practice)
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          console.error("[creator-auth] Erro ao regenerar sessão:", regenErr);
          return res.status(500).json({ message: "Erro ao criar sessão" });
        }

        (req.session as any).creatorData = creatorData;

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[creator-auth] Erro ao salvar sessão:", saveErr);
            return res.status(500).json({ message: "Erro ao salvar sessão" });
          }
          console.log(`[creator-auth] Sessão criada para creator: ${creator.nome} (id=${creator.id})`);
          next();
        });
      });
    } catch (error) {
      console.error("[creator-auth] Erro ao validar token:", error);
      res.status(500).json({ message: "Erro interno" });
    }
  })();
}
