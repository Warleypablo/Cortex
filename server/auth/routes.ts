import { Router } from "express";
import passport from "passport";
import type { User } from "./userDb";
import { getCallbackURL } from "./config";

const router = Router();

// Dev login - APENAS para desenvolvimento/teste
router.get("/auth/dev-login", (req, res) => {
  // Bloqueia em produção
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_LOGIN) {
    return res.status(403).json({ error: "Dev login não disponível em produção" });
  }
  
  const devUser: User = {
    id: "dev-admin-001",
    googleId: "dev-google-id",
    email: "warleyreserva4@gmail.com",
    name: "Dev Admin",
    picture: "",
    createdAt: new Date().toISOString(),
    role: "admin",
    allowedRoutes: [
      '/',
      '/contratos',
      '/colaboradores',
      '/colaboradores/analise',
      '/patrimonio',
      '/ferramentas',
      '/turbozap',
      '/visao-geral',
      '/dashboard/financeiro',
      '/dashboard/geg',
      '/dashboard/inhire',
      '/dashboard/recrutamento',
      '/dashboard/meta-ads',
      '/dashboard/retencao',
      '/dashboard/dfc',
      '/dashboard/auditoria-sistemas',
      '/admin/usuarios'
    ]
  };
  
  req.logIn(devUser, (err) => {
    if (err) {
      console.error("❌ Erro no dev login:", err);
      return res.redirect("/login");
    }
    console.log("✅ Dev login bem-sucedido!");
    res.redirect("/");
  });
});

router.get("/auth/debug", (req, res) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const customDomain = process.env.CUSTOM_DOMAIN;
  const replitDomains = process.env.REPLIT_DOMAINS;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  
  res.json({
    clientIDExists: !!clientID,
    clientIDStart: clientID?.substring(0, 30),
    callbackURL: getCallbackURL(),
    customDomain: customDomain || null,
    replitDomains: replitDomains || null,
    devDomain: devDomain || null
  });
});

router.get("/auth/google", (req, res, next) => {
  console.log("🚀 Iniciando autenticação Google OAuth...");
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })(req, res, next);
});

router.get("/auth/google/callback",
  (req, res, next) => {
    console.log("📥 Callback do Google recebido");
    console.log("Query params:", req.query);
    passport.authenticate("google", { failureRedirect: "/login" }, (err, user, info) => {
      if (err) {
        console.error("❌ Erro na autenticação Google:", err);
        return res.redirect("/login");
      }
      if (!user) {
        console.error("❌ Usuário não retornado. Info:", info);
        return res.redirect("/login");
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("❌ Erro ao fazer login:", loginErr);
          return res.redirect("/login");
        }
        console.log("✅ Login bem-sucedido!");
        res.redirect("/");
      });
    })(req, res, next);
  }
);

router.post("/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/api/auth/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  res.json(req.user as User);
});

export default router;
