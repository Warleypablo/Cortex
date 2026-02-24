import { Router } from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import type { User } from "./userDb";
import { getCallbackURL } from "./config";
import { isExternalEmailAllowed, createExternalUser, EXTERNAL_USER_ROUTES } from "./userDb";
import { db } from "../db";
import { cazClientes, cazParcelas, chatMensagens, cupClientes, cupContratos, portalCancelamentos } from "../../shared/schema";
import { eq, desc, sql, inArray, and } from "drizzle-orm";

// Senhas hasheadas para usuários externos (hash de "***REMOVED***")
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
    prompt: "select_account",
  })(req, res, next);
});

// Teste simples para verificar se a rota está acessível
router.get("/auth/google/callback-test", (req, res) => {
  console.log("✅ Callback test route accessed!");
  res.json({ message: "Callback route is accessible", query: req.query });
});

router.get("/auth/google/callback",
  (req, res, next) => {
    console.log("📥 Callback do Google recebido - URL:", req.originalUrl);
    console.log("Headers host:", req.headers.host);
    console.log("Query params:", JSON.stringify(req.query));
    console.log("Session ID antes do authenticate:", req.sessionID);
    
    passport.authenticate("google", { failureRedirect: "/login" }, (err, user, info) => {
      console.log("🔐 Passport authenticate concluído");
      console.log("Err:", err);
      console.log("User:", user ? user.email : "null");
      console.log("Info:", info);
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
    // Destroi a sessão completamente para evitar cache de login
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error("Erro ao destruir sessão:", destroyErr);
      }
      // Limpa o cookie de sessão
      res.clearCookie('connect.sid', { path: '/' });
      res.json({ message: "Logged out successfully" });
    });
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

// =============================================
// PORTAL DO CLIENTE - Autenticação por CNPJ
// =============================================

// Limpa e normaliza CNPJ para busca
function cleanCnpj(raw: string): string {
  return raw.replace(/[.\-\/\s]/g, '').trim();
}

// Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX
function formatCnpj(cnpj: string): string {
  const c = cleanCnpj(cnpj);
  if (c.length !== 14) return cnpj;
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12,14)}`;
}

router.post("/auth/client-login", async (req, res) => {
  const { cnpj } = req.body;

  if (!cnpj || typeof cnpj !== 'string') {
    return res.status(400).json({ message: "CNPJ é obrigatório" });
  }

  const raw = cleanCnpj(cnpj);
  if (raw.length !== 14 || !/^\d{14}$/.test(raw)) {
    return res.status(400).json({ message: "CNPJ inválido. Use o formato XX.XXX.XXX/XXXX-XX" });
  }

  const formatted = formatCnpj(raw);

  try {
    // Busca normalizando o CNPJ no banco: remove todos os não-dígitos antes de comparar
    // Isso cobre qualquer formato que possa estar armazenado (com ou sem máscara)
    const rows = await db
      .select()
      .from(cazClientes)
      .where(sql`regexp_replace(${cazClientes.cnpj}, '[^0-9]', '', 'g') = ${raw}`)
      .limit(1);

    const client = rows[0];

    console.log(`🔍 Portal login: buscando CNPJ ${formatted} (${raw} dígitos) → ${rows.length} resultado(s)`);

    if (!client) {
      console.log(`❌ CNPJ não encontrado no portal: ${formatted}`);
      return res.status(404).json({ message: "CNPJ não encontrado. Verifique os dados e tente novamente." });
    }

    const clientPayload = {
      id: client.id,
      nome: client.nome,
      cnpj: client.cnpj,
      email: client.email,
      telefone: client.telefone,
      endereco: client.endereco,
      ativo: client.ativo,
    };

    // Regenera a sessão para evitar interferência do Passport com sessões internas
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error("Erro ao regenerar sessão:", regenErr);
        return res.status(500).json({ message: "Erro ao criar sessão" });
      }

      (req.session as any).clientData = clientPayload;

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Erro ao salvar sessão do cliente:", saveErr);
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }
        console.log(`✅ Login de cliente bem-sucedido: ${client.nome} (${client.cnpj}) sessionId=${req.sessionID}`);
        res.json({ message: "Login realizado com sucesso", client: clientPayload });
      });
    });
  } catch (error) {
    console.error("Erro no login de cliente:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

router.get("/api/auth/client-me", (req, res) => {
  const sessionKeys = Object.keys(req.session);
  const clientData = (req.session as any).clientData;
  console.log(`🔍 /api/auth/client-me → sessionId=${req.sessionID} keys=[${sessionKeys.join(',')}] clientData=${clientData ? JSON.stringify(clientData.cnpj) : 'null'}`);
  if (!clientData) {
    return res.status(401).json({ message: "Não autenticado como cliente" });
  }
  res.json(clientData);
});

// DEBUG temporário - ver CNPJs no banco (apenas dev)
router.get("/api/debug/cnpjs", async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: "Not found" });
  }
  try {
    const sample = await db
      .select({ id: cazClientes.id, cnpj: cazClientes.cnpj, nome: cazClientes.nome })
      .from(cazClientes)
      .limit(10);
    res.json({ total: sample.length, sample });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar CNPJs", error: String(error) });
  }
});

// Solicitação de cancelamento: registra no chat do cliente → responsável recebe notificação
router.post("/api/portal-cliente/solicitacao-cancelamento", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) return res.status(401).json({ message: "Não autenticado como cliente" });

  const { produto, motivos, urgencia, detalhe, nota, pontosMelhoria, proximoPasso, retorno } = req.body;

  if (!produto || typeof produto !== 'string') {
    return res.status(400).json({ message: "Produto inválido" });
  }
  if (!Array.isArray(motivos) || motivos.length === 0 || motivos.some((m: unknown) => typeof m !== 'string')) {
    return res.status(400).json({ message: "Selecione ao menos um motivo" });
  }
  const urgenciasValidas = ['imediato', 'fim_periodo', 'a_combinar'];
  if (!urgencia || !urgenciasValidas.includes(urgencia)) {
    return res.status(400).json({ message: "Informe a urgência do cancelamento" });
  }

  try {
    // 1. Salvar registro estruturado na tabela de cancelamentos
    const [cancelamento] = await db.insert(portalCancelamentos).values({
      clientId: clientData.id,
      produto,
      nota: (nota && typeof nota === 'number') ? nota : null,
      motivos: JSON.stringify(motivos),
      pontosMelhoria: (Array.isArray(pontosMelhoria) && pontosMelhoria.length > 0) ? JSON.stringify(pontosMelhoria) : null,
      proximoPasso: (proximoPasso && typeof proximoPasso === 'string') ? proximoPasso : null,
      retorno: (retorno && typeof retorno === 'string') ? retorno : null,
      urgencia,
      detalhe: (detalhe && typeof detalhe === 'string' && detalhe.trim()) ? detalhe.trim() : null,
    }).returning();

    // 2. Enviar marcador JSON ao chat — ChatAtendimento vai renderizar como card visual
    const marcadorMensagem = JSON.stringify({
      _type: 'cancelamento',
      _id: cancelamento.id,
      produto,
      nota: cancelamento.nota,
      motivos: motivos as string[],
      urgencia,
    });

    await db.insert(chatMensagens).values({
      clientId: clientData.id,
      remetenteTipo: 'cliente',
      remetenteNome: clientData.nome ?? 'Cliente',
      mensagem: marcadorMensagem,
      lida: false,
    });

    console.log(`📩 Cancelamento registrado: id=${cancelamento.id} cliente=${clientData.id} produto="${produto}"`);
    res.json({ message: "Solicitação enviada com sucesso" });
  } catch (error) {
    console.error("Erro ao registrar solicitação de cancelamento:", error);
    return res.status(500).json({ message: "Erro ao enviar solicitação" });
  }
});

// Serviços contratados do cliente (cup_clientes.task_id → cup_contratos.id_task)
router.get("/api/portal-cliente/servicos", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) return res.status(401).json({ message: "Não autenticado como cliente" });

  try {
    const servicos = await db
      .select({
        produto: cupContratos.produto,
        status: cupContratos.status,
        responsavel: cupContratos.responsavel,
      })
      .from(cazClientes)
      .innerJoin(cupClientes, eq(cazClientes.cnpj, cupClientes.cnpj))
      .innerJoin(cupContratos, eq(cupClientes.taskId, cupContratos.idTask))
      .where(eq(cazClientes.id, clientData.id));

    res.json(servicos);
  } catch (error) {
    console.error("Erro ao buscar serviços do cliente:", error);
    return res.status(500).json({ message: "Erro ao buscar serviços" });
  }
});

router.post("/auth/client-logout", (req, res) => {
  delete (req.session as any).clientData;
  req.session.save((err) => {
    if (err) console.error("Erro ao salvar sessão no logout do cliente:", err);
    res.json({ message: "Logout realizado com sucesso" });
  });
});

// Atualiza email e/ou telefone do cliente logado
router.patch("/api/portal-cliente/perfil", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) {
    return res.status(401).json({ message: "Não autenticado como cliente" });
  }

  const { email, telefone } = req.body;
  const setData: { email?: string | null; telefone?: string | null } = {};

  if (typeof email === 'string') {
    setData.email = email.trim() || null;
  }
  if (typeof telefone === 'string') {
    setData.telefone = telefone.trim() || null;
  }

  if (Object.keys(setData).length === 0) {
    return res.status(400).json({ message: "Nenhum campo para atualizar" });
  }

  try {
    await db
      .update(cazClientes)
      .set(setData)
      .where(eq(cazClientes.id, clientData.id));

    // Atualiza dados na sessão
    if ('email' in setData) (req.session as any).clientData.email = setData.email;
    if ('telefone' in setData) (req.session as any).clientData.telefone = setData.telefone;

    req.session.save((err) => {
      if (err) console.error("Erro ao salvar sessão após update de perfil:", err);
    });

    console.log(`✅ Perfil atualizado: cliente id=${clientData.id} campos=${Object.keys(setData).join(',')}`);
    res.json({ message: "Dados atualizados com sucesso", ...setData });
  } catch (error) {
    console.error("Erro ao atualizar perfil do cliente:", error);
    return res.status(500).json({ message: "Erro ao atualizar dados" });
  }
});

// Resumo financeiro do cliente logado (via caz_clientes.ids → caz_parcelas.id_cliente)
router.get("/api/portal-cliente/resumo", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) {
    return res.status(401).json({ message: "Não autenticado como cliente" });
  }

  try {
    // Busca a coluna ids do cliente para relacionar com caz_parcelas
    const clientRows = await db
      .select({ ids: cazClientes.ids })
      .from(cazClientes)
      .where(eq(cazClientes.id, clientData.id))
      .limit(1);

    const ids = clientRows[0]?.ids;
    if (!ids) {
      console.log(`⚠️ Cliente id=${clientData.id} não possui ids configurado`);
      return res.json({ faturas: [], totais: { total: 0, pago: 0, naoPago: 0 } });
    }

    // Parse ids: suporta JSON array ("[1,2]") ou lista separada por vírgula ("1,2")
    let idList: string[];
    const trimmed = ids.trim();
    if (trimmed.startsWith('[')) {
      idList = (JSON.parse(trimmed) as (string | number)[]).map(String);
    } else {
      idList = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (idList.length === 0) {
      return res.json({ faturas: [], totais: { total: 0, pago: 0, naoPago: 0 } });
    }

    // Valida formato UUID antes de injetar no SQL (os valores vêm do próprio banco, mas garante segurança)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeIdList = idList.filter(id => UUID_REGEX.test(id));

    console.log(`🔍 Portal resumo: cliente id=${clientData.id} ids=[${safeIdList.join(',')}]`);

    if (safeIdList.length === 0) {
      return res.json({ faturas: [], totais: { total: 0, pago: 0, naoPago: 0 } });
    }

    // id_cliente é uuid no banco → cast explícito para evitar "operator does not exist: uuid = text"
    // Datas via to_char para evitar problemas de timezone na serialização JSON
    const faturas = await db
      .select({
        id: cazParcelas.id,
        status: cazParcelas.status,
        valorBruto: cazParcelas.valorBruto,
        valorPago: cazParcelas.valorPago,
        naoPago: cazParcelas.naoPago,
        descricao: cazParcelas.descricao,
        dataVencimento: sql<string>`to_char(${cazParcelas.dataVencimento}, 'YYYY-MM-DD')`,
        dataQuitacao: sql<string>`to_char(${cazParcelas.dataQuitacao}, 'YYYY-MM-DD')`,
        categoriaNome: cazParcelas.categoriaNome,
        tipoEvento: cazParcelas.tipoEvento,
        urlCobranca: cazParcelas.urlCobranca,
      })
      .from(cazParcelas)
      .where(sql`${cazParcelas.idCliente} = ANY(${sql.raw(`ARRAY[${safeIdList.map(id => `'${id}'`).join(',')}]::uuid[]`)})`)
      .orderBy(desc(cazParcelas.dataVencimento))
      .limit(50);

    const totais = faturas.reduce(
      (acc, f) => {
        acc.total += parseFloat(f.valorBruto ?? '0');
        acc.pago += parseFloat(f.valorPago ?? '0');
        acc.naoPago += parseFloat(f.naoPago ?? '0');
        return acc;
      },
      { total: 0, pago: 0, naoPago: 0 }
    );

    res.json({ faturas, totais });
  } catch (error) {
    console.error("Erro ao buscar resumo financeiro do cliente:", error);
    return res.status(500).json({ message: "Erro ao buscar dados financeiros" });
  }
});

// ── GET /api/portal-cliente/chat ─────────────────────────────────────────────
router.get("/api/portal-cliente/chat", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) return res.status(401).json({ message: "Não autenticado como cliente" });

  try {
    // Busca o responsável via JOIN com cup_clientes
    const responsavelRow = await db
      .select({ responsavel: cupClientes.responsavel })
      .from(cazClientes)
      .leftJoin(cupClientes, eq(cazClientes.cnpj, cupClientes.cnpj))
      .where(eq(cazClientes.id, clientData.id))
      .limit(1);
    const responsavel = responsavelRow[0]?.responsavel ?? null;

    // Busca mensagens
    const mensagens = await db
      .select()
      .from(chatMensagens)
      .where(eq(chatMensagens.clientId, clientData.id))
      .orderBy(chatMensagens.criadoEm);

    // Marca mensagens do colaborador como lidas
    await db
      .update(chatMensagens)
      .set({ lida: true })
      .where(
        and(
          eq(chatMensagens.clientId, clientData.id),
          eq(chatMensagens.remetenteTipo, 'colaborador')
        )
      );

    res.json({ mensagens, responsavel });
  } catch (error) {
    console.error("Erro ao buscar chat do cliente:", error);
    return res.status(500).json({ message: "Erro ao buscar mensagens" });
  }
});

// ── POST /api/portal-cliente/chat ────────────────────────────────────────────
router.post("/api/portal-cliente/chat", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) return res.status(401).json({ message: "Não autenticado como cliente" });

  const { mensagem } = req.body;
  if (!mensagem || typeof mensagem !== 'string' || !mensagem.trim()) {
    return res.status(400).json({ message: "Mensagem inválida" });
  }

  try {
    const [nova] = await db
      .insert(chatMensagens)
      .values({
        clientId: clientData.id,
        remetenteTipo: 'cliente',
        remetenteNome: clientData.nome ?? 'Cliente',
        mensagem: mensagem.trim(),
        lida: false,
      })
      .returning();
    res.json(nova);
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return res.status(500).json({ message: "Erro ao enviar mensagem" });
  }
});

export default router;
