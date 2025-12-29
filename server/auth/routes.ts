import { Router } from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import type { User } from "./userDb";
import { getCallbackURL } from "./config";
import { isExternalEmailAllowed, createExternalUser, EXTERNAL_USER_ROUTES } from "./userDb";

// Senhas hasheadas para usuários externos (hash de "Turboinvest*")
const EXTERNAL_USER_PASSWORDS: Record<string, string> = {
  'ajame@icloud.com': '$2b$10$fCajbl5u9ulRxVQSthFoUuEmH/qlxSnFWM6YaJlM2HkNHJa1BJ7Z6',
  'warleyreserva4@gmail.com': '$2b$10$fCajbl5u9ulRxVQSthFoUuEmH/qlxSnFWM6YaJlM2HkNHJa1BJ7Z6',
};

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
        // Força o salvamento da sessão antes de redirecionar
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("❌ Erro ao salvar sessão:", saveErr);
            return res.redirect("/login");
          }
          console.log("✅ Login bem-sucedido!");
          res.redirect("/");
        });
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
    allowedRoutes: [],
    department: "admin"
  };
  
  req.login(devUser, (err) => {
    if (err) {
      console.error("Dev login error:", err);
      return res.status(500).json({ message: "Dev login failed" });
    }
    // Força o salvamento da sessão antes de retornar resposta
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error("Dev login session save error:", saveErr);
        return res.status(500).json({ message: "Session save failed" });
      }
      console.log("✅ Dev Admin login successful");
      res.json({ message: "Dev login successful", user: devUser });
    });
  });
});

router.get("/api/auth/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  res.json(req.user as User);
});

router.get("/api/user/profile", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = req.user as User;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department || (user.role === 'admin' ? 'admin' : null),
    picture: user.picture
  });
});

// Login externo para investidores (sem Google OAuth, com senha)
router.post("/auth/external-login", async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: "Email é obrigatório" });
  }
  
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: "Senha é obrigatória" });
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Verifica se o email está na lista de externos permitidos
  if (!isExternalEmailAllowed(normalizedEmail)) {
    console.log(`❌ Login externo negado para: ${normalizedEmail}`);
    return res.status(403).json({ message: "Email não autorizado para acesso externo" });
  }
  
  // Verifica a senha
  const storedHash = EXTERNAL_USER_PASSWORDS[normalizedEmail];
  if (!storedHash) {
    console.log(`❌ Senha não configurada para: ${normalizedEmail}`);
    return res.status(403).json({ message: "Acesso não configurado para este email" });
  }
  
  const isPasswordValid = bcrypt.compareSync(password, storedHash);
  if (!isPasswordValid) {
    console.log(`❌ Senha incorreta para: ${normalizedEmail}`);
    return res.status(401).json({ message: "Senha incorreta" });
  }
  
  try {
    // Cria ou busca usuário externo
    const user = await createExternalUser(normalizedEmail);
    
    req.login(user, (err) => {
      if (err) {
        console.error("Erro no login externo:", err);
        return res.status(500).json({ message: "Erro ao fazer login" });
      }
      // Força o salvamento da sessão antes de retornar resposta
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Erro ao salvar sessão externa:", saveErr);
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }
        console.log(`✅ Login externo bem-sucedido: ${normalizedEmail}`);
        res.json({ message: "Login realizado com sucesso", user });
      });
    });
  } catch (error) {
    console.error("Erro ao criar usuário externo:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default router;
