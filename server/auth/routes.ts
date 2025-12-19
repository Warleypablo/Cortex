import { Router } from "express";
import passport from "passport";
import type { User } from "./userDb";
import { getCallbackURL } from "./config";

const router = Router();

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

// Dev login - apenas para ambiente de desenvolvimento
router.post("/auth/dev-login", (req, res) => {
  // Só funciona em desenvolvimento (quando não há domínio customizado em produção)
  const isProduction = process.env.NODE_ENV === "production" && !process.env.REPLIT_DEV_DOMAIN;
  
  if (isProduction) {
    return res.status(403).json({ message: "Dev login not available in production" });
  }
  
  const devUser: User = {
    id: "dev-admin-001",
    googleId: "dev-google-id",
    email: "dev@turbopartners.com.br",
    name: "Dev Admin",
    picture: "",
    createdAt: new Date().toISOString(),
    role: "admin",
    allowedRoutes: []
  };
  
  req.login(devUser, (err) => {
    if (err) {
      console.error("Dev login error:", err);
      return res.status(500).json({ message: "Dev login failed" });
    }
    console.log("✅ Dev Admin login successful");
    res.json({ message: "Dev login successful", user: devUser });
  });
});

router.get("/api/auth/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  res.json(req.user as User);
});

export default router;
