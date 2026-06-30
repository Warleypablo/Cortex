import { Request, Response, NextFunction } from "express";

// Service token (FCA_API_TOKEN): autoriza acesso SOMENTE LEITURA (GET) aos endpoints
// de dados da aba Orçado x Realizado. Usado pela rotina FCA agendada (Claude) pra puxar
// os mesmos números da tela sem sessão de browser — garante reconciliação total com o
// Aprofundado e evita duplicar a lógica de query. Escopo deliberadamente estreito:
// apenas GET + apenas /api/growth/orcado-realizado/* (nunca mutações nem outras rotas).
function isFcaServiceTokenRequest(req: Request): boolean {
  const token = process.env.FCA_API_TOKEN;
  if (!token) return false;
  if (req.method !== "GET") return false;
  const pathOnly = req.originalUrl.split("?")[0];
  if (!pathOnly.startsWith("/api/growth/orcado-realizado/")) return false;
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return false;
  return header.slice(7).trim() === token;
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  if (isFcaServiceTokenRequest(req)) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized - Please login" });
}
