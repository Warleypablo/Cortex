import { Request, Response, NextFunction } from "express";
import type { User } from "../auth/userDb";

/**
 * Middleware que restringe a rota a um único email (ou lista de emails).
 * Deve ser usado APÓS isAuthenticated.
 *
 * Usado pela feature de Otimização de Ads, onde apenas o aprovador autorizado
 * pode propor/aprovar/executar ações que alteram o estado real das campanhas.
 */
export function requireEmail(allowed: string | string[]) {
  const allowedSet = new Set(
    (Array.isArray(allowed) ? allowed : [allowed]).map((e) => e.toLowerCase().trim()),
  );

  return function (req: Request, res: Response, next: NextFunction) {
    const user = req.user as User | undefined;
    const email = user?.email?.toLowerCase().trim();
    if (!email || !allowedSet.has(email)) {
      return res.status(403).json({
        message: "Forbidden — esta ação está restrita ao(s) email(s) autorizado(s).",
      });
    }
    next();
  };
}
