import { Router } from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import type { User } from "./userDb";
import { getCallbackURL } from "./config";
import { isExternalEmailAllowed, createExternalUser, EXTERNAL_USER_ROUTES } from "./userDb";
import { validateBody } from "../middleware/validate";
import { externalLoginSchema, clientLoginSchema } from "../middleware/schemas";
import { db } from "../db";
import { cazClientes, cazParcelas, chatMensagens, chatAtendimentos, cupClientes, cupContratos, portalCancelamentos, arClientes, arMetricas, arCampanhas, arCanais, clientCredentials } from "../../shared/schema";
import { eq, desc, sql, inArray, and, asc } from "drizzle-orm";

// Hashed passwords for external users
const EXTERNAL_USER_PASSWORDS: Record<string, string> = {
  'ajame@icloud.com': '$2b$10$fCajbl5u9ulRxVQSthFoUuEmH/qlxSnFWM6YaJlM2HkNHJa1BJ7Z6',
  'warleyreserva4@gmail.com': '$2b$10$fCajbl5u9ulRxVQSthFoUuEmH/qlxSnFWM6YaJlM2HkNHJa1BJ7Z6',
};

const router = Router();

router.get("/auth/debug", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ message: "Not found" });
  }
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
  const devLoginEnabled = process.env.ENABLE_DEV_LOGIN === "true";
  if (process.env.NODE_ENV === "production" || !devLoginEnabled) {
    return res.status(403).json({ message: "Dev login not available" });
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
router.post("/auth/external-login", validateBody(externalLoginSchema), async (req, res) => {
  const { email, password } = req.body;
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

router.post("/auth/client-login", validateBody(clientLoginSchema), async (req, res) => {
  const { cnpj, password } = req.body;

  const raw = cleanCnpj(cnpj);
  if (raw.length !== 14 || !/^\d{14}$/.test(raw)) {
    return res.status(400).json({ message: "CNPJ inválido. Use o formato XX.XXX.XXX/XXXX-XX" });
  }

  const formatted = formatCnpj(raw);

  try {
    // Busca normalizando o CNPJ no banco: remove todos os não-dígitos antes de comparar
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

    // Busca ou cria credenciais para este cliente
    let creds = await db
      .select()
      .from(clientCredentials)
      .where(eq(clientCredentials.cnpj, raw))
      .limit(1);

    if (!creds.length) {
      // Primeira vez: cria credenciais com senha padrão
      const defaultPassword = process.env.CLIENT_DEFAULT_PASSWORD;
      if (!defaultPassword) {
        return res.status(500).json({ message: "CLIENT_DEFAULT_PASSWORD not configured" });
      }
      const hash = bcrypt.hashSync(defaultPassword, 10);
      const [newCred] = await db
        .insert(clientCredentials)
        .values({
          clientId: client.id,
          cnpj: raw,
          passwordHash: hash,
          mustChangePassword: true,
        })
        .returning();
      creds = [newCred];
      console.log(`🔑 Credenciais criadas para CNPJ ${formatted} (senha padrão)`);
    }

    const credential = creds[0];

    // Valida a senha
    if (!bcrypt.compareSync(password, credential.passwordHash)) {
      console.log(`❌ Senha incorreta para CNPJ ${formatted}`);
      return res.status(401).json({ message: "Senha incorreta" });
    }

    const clientPayload = {
      id: client.id,
      nome: client.nome,
      cnpj: client.cnpj,
      email: client.email,
      telefone: client.telefone,
      endereco: client.endereco,
      ativo: client.ativo,
      mustChangePassword: credential.mustChangePassword,
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
        console.log(`✅ Login de cliente bem-sucedido: ${client.nome} (${client.cnpj}) mustChangePassword=${credential.mustChangePassword} sessionId=${req.sessionID}`);
        res.json({ message: "Login realizado com sucesso", client: clientPayload });
      });
    });
  } catch (error) {
    console.error("Erro no login de cliente:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// Troca de senha do cliente (obrigatória no primeiro login)
router.post("/api/auth/client-change-password", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) {
    return res.status(401).json({ message: "Não autenticado como cliente" });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ message: "Senha atual é obrigatória" });
  }
  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ message: "Nova senha é obrigatória" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "A nova senha deve ter no mínimo 6 caracteres" });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: "A nova senha deve ser diferente da atual" });
  }

  const raw = cleanCnpj(clientData.cnpj || '');

  try {
    const creds = await db
      .select()
      .from(clientCredentials)
      .where(eq(clientCredentials.cnpj, raw))
      .limit(1);

    if (!creds.length) {
      return res.status(404).json({ message: "Credenciais não encontradas" });
    }

    const credential = creds[0];

    if (!bcrypt.compareSync(currentPassword, credential.passwordHash)) {
      return res.status(401).json({ message: "Senha atual incorreta" });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await db
      .update(clientCredentials)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(clientCredentials.id, credential.id));

    // Atualiza sessão
    (req.session as any).clientData.mustChangePassword = false;
    req.session.save((err) => {
      if (err) console.error("Erro ao salvar sessão após troca de senha:", err);
    });

    console.log(`🔑 Senha alterada com sucesso: cliente id=${clientData.id} CNPJ=${raw}`);
    res.json({ message: "Senha alterada com sucesso" });
  } catch (error) {
    console.error("Erro ao alterar senha do cliente:", error);
    return res.status(500).json({ message: "Erro ao alterar senha" });
  }
});

router.get("/api/auth/client-me", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) {
    return res.status(401).json({ message: "Não autenticado como cliente" });
  }

  // Sempre busca o estado atual de mustChangePassword do banco
  try {
    const raw = cleanCnpj(clientData.cnpj || '');
    if (raw.length === 14) {
      const creds = await db
        .select({ mustChangePassword: clientCredentials.mustChangePassword })
        .from(clientCredentials)
        .where(eq(clientCredentials.cnpj, raw))
        .limit(1);
      if (creds.length) {
        clientData.mustChangePassword = creds[0].mustChangePassword;
      }
    }
  } catch (e) {
    // Se falhar a consulta, usa o valor da sessão
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

// Avaliação de atendimento pelo cliente
router.post("/api/portal-cliente/avaliar-atendimento", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) return res.status(401).json({ message: "Não autenticado como cliente" });

  const { atendimentoId, nota, comentario } = req.body;
  if (!atendimentoId || typeof atendimentoId !== 'number') {
    return res.status(400).json({ message: "atendimentoId inválido" });
  }
  if (!nota || typeof nota !== 'number' || nota < 1 || nota > 5) {
    return res.status(400).json({ message: "Nota inválida (1 a 5)" });
  }

  try {
    // Garante que o atendimento pertence ao cliente
    const atend = await db
      .select()
      .from(chatAtendimentos)
      .where(and(eq(chatAtendimentos.id, atendimentoId), eq(chatAtendimentos.clientId, clientData.id)))
      .limit(1);

    if (!atend.length) {
      return res.status(404).json({ message: "Atendimento não encontrado" });
    }
    if (atend[0].avaliacao !== null) {
      return res.status(409).json({ message: "Atendimento já avaliado" });
    }

    // Salva avaliação no atendimento
    await db
      .update(chatAtendimentos)
      .set({ avaliacao: nota, avaliacaoComentario: comentario?.trim() || null })
      .where(eq(chatAtendimentos.id, atendimentoId));

    // Atualiza a mensagem avaliacao_request → avaliacao_respondida
    // Usa LIKE em vez de ::jsonb para evitar erro em mensagens de texto puro
    await db.execute(sql`
      UPDATE cortex_core.chat_mensagens
      SET mensagem = ${JSON.stringify({ _type: 'avaliacao_respondida', atendimentoId, nota })}
      WHERE client_id = ${clientData.id}
        AND mensagem LIKE '%"_type":"avaliacao_request"%'
        AND mensagem LIKE ${`%"atendimentoId":${atendimentoId}%`}
    `);

    console.log(`⭐ Avaliação recebida: atendimento=${atendimentoId} nota=${nota} cliente=${clientData.id}`);
    res.json({ message: "Avaliação enviada com sucesso" });
  } catch (error) {
    console.error("Erro ao registrar avaliação:", error);
    return res.status(500).json({ message: "Erro ao salvar avaliação" });
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
      .where(sql`${cazParcelas.idCliente} = ANY(${safeIdList}::uuid[])`)
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

// ── GET /api/portal-cliente/dashboard ────────────────────────────────────────
router.get("/api/portal-cliente/dashboard", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) return res.status(401).json({ message: "Não autenticado como cliente" });

  try {
    // 1. Buscar IDs do cliente (mesma lógica de /resumo)
    const clientRows = await db
      .select({ ids: cazClientes.ids })
      .from(cazClientes)
      .where(eq(cazClientes.id, clientData.id))
      .limit(1);

    const ids = clientRows[0]?.ids;
    let faturas: any[] = [];

    if (ids) {
      const trimmed = ids.trim();
      let idList: string[];
      if (trimmed.startsWith("[")) {
        idList = (JSON.parse(trimmed) as (string | number)[]).map(String);
      } else {
        idList = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
      }

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeIdList = idList.filter((id) => UUID_REGEX.test(id));

      if (safeIdList.length > 0) {
        faturas = await db
          .select({
            id: cazParcelas.id,
            status: cazParcelas.status,
            valorBruto: cazParcelas.valorBruto,
            descricao: cazParcelas.descricao,
            dataVencimento: sql<string>`to_char(${cazParcelas.dataVencimento}, 'YYYY-MM-DD')`,
            dataQuitacao: sql<string>`to_char(${cazParcelas.dataQuitacao}, 'YYYY-MM-DD')`,
            categoriaNome: cazParcelas.categoriaNome,
            urlCobranca: cazParcelas.urlCobranca,
          })
          .from(cazParcelas)
          .where(sql`${cazParcelas.idCliente} = ANY(${safeIdList}::uuid[])`)
          .orderBy(desc(cazParcelas.dataVencimento))
          .limit(50);
      }
    }

    // 2. Calcular KPIs de faturas
    const atrasadas = faturas.filter((f) =>
      ["ATRASADO", "VENCIDO"].includes((f.status ?? "").toUpperCase())
    );
    const pendentes = faturas.filter((f) => {
      const s = (f.status ?? "").toUpperCase();
      return !["RECEBIDO", "PAGO", "QUITADO", "ATRASADO", "VENCIDO"].includes(s);
    });
    const proximaFatura = pendentes.sort((a: any, b: any) =>
      (a.dataVencimento ?? "").localeCompare(b.dataVencimento ?? "")
    )[0];

    // 3. Buscar serviços ativos (mesma query de /servicos)
    const servicosResult = await db
      .select({ status: cupContratos.status })
      .from(cazClientes)
      .innerJoin(cupClientes, eq(cazClientes.cnpj, cupClientes.cnpj))
      .innerJoin(cupContratos, eq(cupClientes.taskId, cupContratos.idTask))
      .where(eq(cazClientes.id, clientData.id));

    const servicosAtivos = servicosResult.filter((s) => {
      const st = (s.status ?? "").toLowerCase();
      return st.includes("ativo") || st.includes("anda") || st.includes("progr");
    }).length;

    // 4. Mensagens não lidas
    const naoLidas = await db
      .select({ id: chatMensagens.id })
      .from(chatMensagens)
      .where(
        and(
          eq(chatMensagens.clientId, clientData.id),
          eq(chatMensagens.remetenteTipo, "colaborador"),
          eq(chatMensagens.lida, false)
        )
      );
    const mensagensNaoLidas = naoLidas.length;

    // 5. Alertas automáticos
    const alertas: Array<{ tipo: string; mensagem: string }> = [];
    if (atrasadas.length > 0) {
      const totalAtrasado = atrasadas.reduce(
        (sum, f) => sum + parseFloat(f.valorBruto ?? "0"), 0
      );
      alertas.push({
        tipo: "atrasado",
        mensagem: `Você tem ${atrasadas.length} fatura${atrasadas.length > 1 ? "s" : ""} atrasada${atrasadas.length > 1 ? "s" : ""} (R$ ${totalAtrasado.toFixed(2).replace(".", ",")})`,
      });
    }
    if (mensagensNaoLidas > 0) {
      alertas.push({
        tipo: "mensagem",
        mensagem: `Você tem ${mensagensNaoLidas} mensagen${mensagensNaoLidas > 1 ? "s" : ""} não lida${mensagensNaoLidas > 1 ? "s" : ""}`,
      });
    }

    res.json({
      proximoVencimento: proximaFatura
        ? { valor: parseFloat(proximaFatura.valorBruto ?? "0"), data: proximaFatura.dataVencimento }
        : null,
      faturasAtrasadas: {
        count: atrasadas.length,
        total: atrasadas.reduce((sum, f) => sum + parseFloat(f.valorBruto ?? "0"), 0),
      },
      servicosAtivos,
      mensagensNaoLidas,
      ultimasFaturas: faturas.slice(0, 3),
      alertas,
    });
  } catch (error) {
    console.error("Erro ao buscar dashboard do cliente:", error);
    return res.status(500).json({ message: "Erro ao buscar dados do dashboard" });
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

// ── GET /api/portal-cliente/performance ───────────────────────────────────────
router.get("/api/portal-cliente/performance", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) return res.status(401).json({ message: "Não autenticado como cliente" });

  const freq = (req.query.freq as string) || "SEMANAL";
  const periodo = req.query.periodo as string | undefined; // formato YYYY-MM-DD

  try {
    // 1. cazClientes → dados do cliente logado (CNPJ)
    const cazRow = await db
      .select({ id: cazClientes.id, cnpj: cazClientes.cnpj, nome: cazClientes.nome })
      .from(cazClientes)
      .where(eq(cazClientes.id, clientData.id))
      .limit(1);
    console.log(`🔍 [PERF] Step 1 - cazClientes id=${clientData.id}:`, cazRow[0] ? `cnpj="${cazRow[0].cnpj}" nome="${cazRow[0].nome}"` : 'NOT FOUND');

    // 2. cazClientes.cnpj → cupClientes.cnpj (busca nome no Clickup)
    //    O CNPJ pode estar formatado diferente nos dois schemas, então normaliza
    const cupRow = await db
      .select({ nome: cupClientes.nome, cnpj: cupClientes.cnpj })
      .from(cazClientes)
      .innerJoin(cupClientes, sql`regexp_replace(${cazClientes.cnpj}, '[^0-9]', '', 'g') = regexp_replace(${cupClientes.cnpj}, '[^0-9]', '', 'g')`)
      .where(eq(cazClientes.id, clientData.id))
      .limit(1);
    console.log(`🔍 [PERF] Step 2 - cupClientes via CNPJ join:`, cupRow[0] ? `nome="${cupRow[0].nome}" cnpj="${cupRow[0].cnpj}"` : 'NOT FOUND (CNPJ não bate entre Conta Azul e Clickup)');

    if (!cupRow.length || !cupRow[0].nome) {
      return res.json({ cliente: null, categoria: null, metricas: null, campanhas_meta: [], campanhas_google: [], canais: [], historico: [], _debug: { step: 2, msg: 'cupClientes not found via CNPJ join' } });
    }

    const nomeClickup = cupRow[0].nome;

    // 3. cupClientes.nome → arClientes.nome
    //    Tenta match exato primeiro, depois fuzzy por similaridade (pg_trgm)
    let arClienteRow = await db
      .select()
      .from(arClientes)
      .where(sql`LOWER(TRIM(${arClientes.nome})) = LOWER(TRIM(${nomeClickup}))`)
      .limit(1);

    let matchType = 'exact';

    // Fallback: similaridade por trigramas (pg_trgm) — threshold 0.3
    if (!arClienteRow.length) {
      arClienteRow = await db
        .select()
        .from(arClientes)
        .where(sql`similarity(LOWER(${arClientes.nome}), LOWER(${nomeClickup})) > 0.3`)
        .orderBy(sql`similarity(LOWER(${arClientes.nome}), LOWER(${nomeClickup})) DESC`)
        .limit(1);
      matchType = 'similarity';
    }

    // Fallback 2: normaliza removendo sufixos corporativos (LTDA, ME, EIRELI, S/A, etc.)
    if (!arClienteRow.length) {
      const normSql = (col: any) => sql`LOWER(TRIM(regexp_replace(${col}, '\\s*(LTDA|ME|EPP|EIRELI|S/?A|S\\.A\\.|LTDA\\.?|-)\\s*', '', 'gi')))`;
      arClienteRow = await db
        .select()
        .from(arClientes)
        .where(sql`${normSql(arClientes.nome)} = ${normSql(sql`${nomeClickup}`)}`)
        .limit(1);
      matchType = 'normalized';
    }

    // Fallback 3: LIKE com primeiras palavras significativas do nome
    if (!arClienteRow.length) {
      const palavras = nomeClickup.trim().split(/\s+/).filter(p => !['LTDA', 'ME', 'EPP', 'EIRELI', 'S/A', 'SA', 'DE', 'DO', 'DA', 'E', '-'].includes(p.toUpperCase()));
      const prefix = palavras.slice(0, 2).join(' ');
      if (prefix.length >= 3) {
        arClienteRow = await db
          .select()
          .from(arClientes)
          .where(sql`LOWER(${arClientes.nome}) LIKE LOWER(${`%${prefix}%`})`)
          .limit(1);
        matchType = 'like-prefix';
      }
    }

    console.log(`🔍 [PERF] Step 3 - arClientes match nome="${nomeClickup}":`,
      arClienteRow[0] ? `id=${arClienteRow[0].id} nome="${arClienteRow[0].nome}" categoria="${arClienteRow[0].categoria}" (${matchType})` : 'NOT FOUND em todos os métodos');

    if (!arClienteRow.length) {
      return res.json({ cliente: nomeClickup, categoria: null, metricas: null, campanhas_meta: [], campanhas_google: [], canais: [], historico: [] });
    }

    const arCliente = arClienteRow[0];
    const clienteNome = arCliente.nome;
    const categoria = arCliente.categoria;

    // 4. Métricas do período selecionado (ou mais recente)
    let metricasQuery = db
      .select()
      .from(arMetricas)
      .where(sql`LOWER(TRIM(${arMetricas.clienteNome})) = LOWER(TRIM(${clienteNome})) AND ${arMetricas.freq} = ${freq}`)
      .orderBy(desc(arMetricas.periodoInicio))
      .limit(1);

    if (periodo) {
      metricasQuery = db
        .select()
        .from(arMetricas)
        .where(sql`LOWER(TRIM(${arMetricas.clienteNome})) = LOWER(TRIM(${clienteNome})) AND ${arMetricas.freq} = ${freq} AND ${arMetricas.periodoInicio} = ${periodo}`)
        .limit(1);
    }

    const metricasRows = await metricasQuery;
    const metricas = metricasRows[0] ?? null;
    console.log(`🔍 [PERF] Step 4 - metricas for "${clienteNome}" freq=${freq}:`, metricas ? `periodo=${metricas.periodoInicio} → ${metricas.periodoFim}` : 'NOT FOUND (sem métricas)');

    // Período de referência para campanhas e canais
    const refInicio = metricas?.periodoInicio ?? periodo;
    const refFim = metricas?.periodoFim ?? periodo;

    // 4. Top 5 campanhas Meta
    const campanhasMeta = refInicio ? await db
      .select()
      .from(arCampanhas)
      .where(sql`LOWER(TRIM(${arCampanhas.clienteNome})) = LOWER(TRIM(${clienteNome})) AND ${arCampanhas.freq} = ${freq} AND ${arCampanhas.periodoInicio} = ${refInicio} AND ${arCampanhas.plataforma} = 'meta'`)
      .orderBy(asc(arCampanhas.rank))
      .limit(5) : [];

    // 5. Top 5 campanhas Google
    const campanhasGoogle = refInicio ? await db
      .select()
      .from(arCampanhas)
      .where(sql`LOWER(TRIM(${arCampanhas.clienteNome})) = LOWER(TRIM(${clienteNome})) AND ${arCampanhas.freq} = ${freq} AND ${arCampanhas.periodoInicio} = ${refInicio} AND ${arCampanhas.plataforma} = 'google'`)
      .orderBy(asc(arCampanhas.rank))
      .limit(5) : [];

    // 6. Top 5 canais GA4
    const canais = refInicio ? await db
      .select()
      .from(arCanais)
      .where(sql`LOWER(TRIM(${arCanais.clienteNome})) = LOWER(TRIM(${clienteNome})) AND ${arCanais.freq} = ${freq} AND ${arCanais.periodoInicio} = ${refInicio}`)
      .orderBy(asc(arCanais.rank))
      .limit(5) : [];

    // 7. Histórico (últimos 6 períodos) para gráficos de evolução
    const historico = await db
      .select()
      .from(arMetricas)
      .where(sql`LOWER(TRIM(${arMetricas.clienteNome})) = LOWER(TRIM(${clienteNome})) AND ${arMetricas.freq} = ${freq}`)
      .orderBy(desc(arMetricas.periodoInicio))
      .limit(6);

    // 8. Períodos disponíveis para o seletor
    const periodosRaw = await db
      .select({ periodoInicio: arMetricas.periodoInicio, periodoFim: arMetricas.periodoFim })
      .from(arMetricas)
      .where(sql`LOWER(TRIM(${arMetricas.clienteNome})) = LOWER(TRIM(${clienteNome})) AND ${arMetricas.freq} = ${freq}`)
      .orderBy(desc(arMetricas.periodoInicio))
      .limit(24);

    res.json({
      cliente: clienteNome,
      categoria,
      metricas,
      campanhas_meta: campanhasMeta,
      campanhas_google: campanhasGoogle,
      canais,
      historico: historico.reverse(),
      periodos: periodosRaw,
    });
  } catch (error) {
    console.error("Erro ao buscar performance do cliente:", error);
    return res.status(500).json({ message: "Erro ao buscar dados de performance" });
  }
});

export default router;
