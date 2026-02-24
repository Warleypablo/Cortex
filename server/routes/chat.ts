import type { Express } from "express";
import { db } from "../db";
import { chatMensagens, chatAtendimentos, cazClientes, cupClientes } from "../../shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export function registerChatRoutes(app: Express) {

  // ── GET /api/chat/conversas ─────────────────────────────────────────────────
  // Admins veem todas. Colaboradores veem apenas as dos seus clientes.
  app.get("/api/chat/conversas", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    const user = req.user as any;
    const isAdmin = user?.role === 'admin';
    const userName = user?.name ?? '';

    try {
      const baseSelect = sql`
        SELECT
          cc.id AS client_id,
          cc.nome AS client_nome,
          cc.cnpj,
          cu.responsavel,
          (
            SELECT mensagem FROM cortex_core.chat_mensagens
            WHERE client_id = cc.id
            ORDER BY criado_em DESC LIMIT 1
          ) AS last_message,
          (
            SELECT criado_em FROM cortex_core.chat_mensagens
            WHERE client_id = cc.id
            ORDER BY criado_em DESC LIMIT 1
          ) AS last_at,
          (
            SELECT COUNT(*)::int FROM cortex_core.chat_mensagens
            WHERE client_id = cc.id
              AND remetente_tipo = 'cliente'
              AND lida = FALSE
          ) AS unread_count,
          (
            SELECT encerrado_em FROM cortex_core.chat_atendimentos
            WHERE client_id = cc.id
            ORDER BY encerrado_em DESC LIMIT 1
          ) AS ultimo_encerramento,
          CASE WHEN EXISTS (
            SELECT 1 FROM cortex_core.chat_mensagens cm2
            WHERE cm2.client_id = cc.id
              AND cm2.criado_em > COALESCE(
                (SELECT MAX(encerrado_em) FROM cortex_core.chat_atendimentos WHERE client_id = cc.id),
                '1970-01-01'::timestamp
              )
          ) THEN TRUE ELSE FALSE END AS ativo
        FROM "Conta Azul".caz_clientes cc
        LEFT JOIN "Clickup".cup_clientes cu ON cc.cnpj = cu.cnpj
        WHERE EXISTS (
          SELECT 1 FROM cortex_core.chat_mensagens WHERE client_id = cc.id
        )
      `;

      const rows = isAdmin
        ? await db.execute(sql`${baseSelect} ORDER BY last_at DESC NULLS LAST`)
        : await db.execute(sql`
            ${baseSelect}
              AND (
                cu.responsavel ILIKE '%' || ${userName} || '%'
                OR ${userName} ILIKE '%' || COALESCE(cu.responsavel, '') || '%'
              )
            ORDER BY last_at DESC NULLS LAST
          `);

      res.json(rows.rows);
    } catch (error) {
      console.error("Erro ao listar conversas:", error);
      return res.status(500).json({ message: "Erro ao listar conversas" });
    }
  });

  // ── GET /api/chat/conversa/:clientId ──────────────────────────────────────
  app.get("/api/chat/conversa/:clientId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    const user = req.user as any;
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ message: "clientId inválido" });

    try {
      // Verifica que o responsavel bate
      const clienteRow = await db.execute(sql`
        SELECT cc.id, cc.nome, cc.cnpj, cu.responsavel
        FROM "Conta Azul".caz_clientes cc
        LEFT JOIN "Clickup".cup_clientes cu ON cc.cnpj = cu.cnpj
        WHERE cc.id = ${clientId}
        LIMIT 1
      `);

      if (!clienteRow.rows.length) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      const cliente = clienteRow.rows[0] as any;
      const responsavel = (cliente.responsavel ?? '') as string;
      const userName = (user?.name ?? '') as string;

      // Verifica acesso: responsavel deve bater com o nome do usuário
      const isResponsavel =
        responsavel.toLowerCase().includes(userName.toLowerCase().split(' ')[0]) ||
        userName.toLowerCase().includes((responsavel ?? '').toLowerCase().split(' ')[0]);

      if (!isResponsavel && user?.role !== 'admin') {
        return res.status(403).json({ message: "Acesso não autorizado a esta conversa" });
      }

      // Busca mensagens
      const mensagens = await db
        .select()
        .from(chatMensagens)
        .where(eq(chatMensagens.clientId, clientId))
        .orderBy(chatMensagens.criadoEm);

      // Marca mensagens do cliente como lidas
      await db
        .update(chatMensagens)
        .set({ lida: true })
        .where(
          and(
            eq(chatMensagens.clientId, clientId),
            eq(chatMensagens.remetenteTipo, 'cliente')
          )
        );

      // Busca último atendimento encerrado
      const ultimoAtendimento = await db
        .select()
        .from(chatAtendimentos)
        .where(eq(chatAtendimentos.clientId, clientId))
        .orderBy(desc(chatAtendimentos.encerradoEm))
        .limit(1);

      // Verifica se há mensagens após o último encerramento (conversa ativa)
      const ultimoEncerramentoEm = ultimoAtendimento[0]?.encerradoEm ?? null;
      const ativo = mensagens.some(m =>
        !ultimoEncerramentoEm || new Date(m.criadoEm) > new Date(ultimoEncerramentoEm)
      );

      res.json({
        mensagens,
        clientNome: cliente.nome,
        cnpj: cliente.cnpj,
        responsavel,
        ativo,
        ultimoAtendimento: ultimoAtendimento[0] ?? null,
      });
    } catch (error) {
      console.error("Erro ao buscar conversa:", error);
      return res.status(500).json({ message: "Erro ao buscar conversa" });
    }
  });

  // ── POST /api/chat/conversa/:clientId ─────────────────────────────────────
  app.post("/api/chat/conversa/:clientId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    const user = req.user as any;
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ message: "clientId inválido" });

    const { mensagem } = req.body;
    if (!mensagem || typeof mensagem !== 'string' || !mensagem.trim()) {
      return res.status(400).json({ message: "Mensagem inválida" });
    }

    try {
      const [nova] = await db
        .insert(chatMensagens)
        .values({
          clientId,
          remetenteTipo: 'colaborador',
          remetenteNome: user?.name ?? 'Colaborador',
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

  // ── POST /api/chat/encerrar/:clientId ────────────────────────────────────────
  // Encerra o atendimento: registra em chat_atendimentos com duração calculada
  app.post("/api/chat/encerrar/:clientId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    const user = req.user as any;
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ message: "clientId inválido" });

    try {
      // Busca o timestamp do último encerramento para definir início da sessão atual
      const ultimoAtend = await db
        .select({ encerradoEm: chatAtendimentos.encerradoEm })
        .from(chatAtendimentos)
        .where(eq(chatAtendimentos.clientId, clientId))
        .orderBy(desc(chatAtendimentos.encerradoEm))
        .limit(1);

      const ultimoEncerramentoEm = ultimoAtend[0]?.encerradoEm ?? null;

      // Encontra a primeira mensagem da sessão atual (após o último encerramento)
      const primeiraMsg = ultimoEncerramentoEm
        ? await db.execute(sql`
            SELECT MIN(criado_em) AS iniciado_em
            FROM cortex_core.chat_mensagens
            WHERE client_id = ${clientId}
              AND criado_em > ${ultimoEncerramentoEm}
          `)
        : await db.execute(sql`
            SELECT MIN(criado_em) AS iniciado_em
            FROM cortex_core.chat_mensagens
            WHERE client_id = ${clientId}
          `);

      const iniciadoEm = (primeiraMsg.rows[0] as any)?.iniciado_em;
      if (!iniciadoEm) {
        return res.status(400).json({ message: "Nenhuma mensagem encontrada para encerrar" });
      }

      const agora = new Date();
      const duracaoMs = agora.getTime() - new Date(iniciadoEm).getTime();
      const duracaoMinutos = (duracaoMs / 60000).toFixed(2);

      const [atendimento] = await db
        .insert(chatAtendimentos)
        .values({
          clientId,
          iniciadoEm: new Date(iniciadoEm),
          encerradoEm: agora,
          encerradoPor: user?.name ?? 'Colaborador',
          duracaoMinutos,
        })
        .returning();

      // Mensagem de encerramento (visível no chat do cliente)
      await db.insert(chatMensagens).values({
        clientId,
        remetenteTipo: 'colaborador',
        remetenteNome: null,
        mensagem: JSON.stringify({
          _type: 'encerramento',
          atendimentoId: atendimento.id,
          encerradoPor: user?.name ?? 'Colaborador',
        }),
        lida: false,
      });

      // Solicitação de avaliação
      await db.insert(chatMensagens).values({
        clientId,
        remetenteTipo: 'colaborador',
        remetenteNome: null,
        mensagem: JSON.stringify({
          _type: 'avaliacao_request',
          atendimentoId: atendimento.id,
        }),
        lida: false,
      });

      console.log(`✅ Atendimento encerrado: cliente=${clientId} duração=${duracaoMinutos}min por="${user?.name}"`);
      res.json(atendimento);
    } catch (error) {
      console.error("Erro ao encerrar atendimento:", error);
      return res.status(500).json({ message: "Erro ao encerrar atendimento" });
    }
  });

  // ── GET /api/chat/unread-count ─────────────────────────────────────────────
  // Contagem total de não lidas para badge no menu (admins = todas)
  app.get("/api/chat/unread-count", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ count: 0 });
    const user = req.user as any;
    const isAdmin = user?.role === 'admin';
    const userName = user?.name ?? '';

    try {
      const result = isAdmin
        ? await db.execute(sql`
            SELECT COUNT(*)::int AS count
            FROM cortex_core.chat_mensagens
            WHERE remetente_tipo = 'cliente' AND lida = FALSE
          `)
        : await db.execute(sql`
            SELECT COUNT(*)::int AS count
            FROM cortex_core.chat_mensagens cm
            JOIN "Conta Azul".caz_clientes cc ON cm.client_id = cc.id
            LEFT JOIN "Clickup".cup_clientes cu ON cc.cnpj = cu.cnpj
            WHERE cm.remetente_tipo = 'cliente'
              AND cm.lida = FALSE
              AND (
                cu.responsavel ILIKE '%' || ${userName} || '%'
                OR ${userName} ILIKE '%' || COALESCE(cu.responsavel, '') || '%'
              )
          `);

      res.json({ count: (result.rows[0] as any)?.count ?? 0 });
    } catch (error) {
      console.error("Erro ao contar não lidas:", error);
      res.json({ count: 0 });
    }
  });
}
