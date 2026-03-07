# Assistente Jurídico — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered legal assistant chat page at `/juridico/assistente` with knowledge markdowns, OpenAI function calling for database queries, and persistent conversation history.

**Architecture:** OpenAI function calling with system prompt loaded from `agents/legal-*.md` markdowns. Backend route handles the agentic loop (call OpenAI → execute functions → feed results back → repeat until done). Conversations persisted in PostgreSQL. Frontend is a full-page chat with sidebar for conversation history.

**Tech Stack:** React + Tailwind (frontend), Express + Drizzle ORM + OpenAI SDK (backend), PostgreSQL (persistence)

---

### Task 1: Create Knowledge Markdowns

**Files:**
- Create: `agents/legal-cobranca.md`
- Create: `agents/legal-contratos.md`
- Create: `agents/legal-trabalhista.md`

**Step 1: Create `agents/legal-cobranca.md`**

```markdown
# Assistente Jurídico — Cobrança e Inadimplência

Você é um assistente jurídico especializado em cobrança e inadimplência empresarial no contexto brasileiro.

## Procedimentos de Cobrança (em ordem de escalonamento)

### 1. Notificação Extrajudicial
- Primeiro passo antes de qualquer medida judicial
- Enviar por e-mail com confirmação de leitura + carta registrada (AR)
- Prazo usual: 10 a 15 dias para resposta
- Deve conter: identificação do devedor, valor devido, data de vencimento original, prazo para pagamento

### 2. Protesto de Título
- Realizado em cartório de protesto
- Pode ser feito após vencimento do título (duplicata, nota promissória, cheque)
- Prazo de 3 dias úteis para pagamento após intimação
- Negativação nos órgãos de proteção ao crédito (SPC/Serasa) ocorre automaticamente

### 3. Ação de Execução
- Para títulos executivos extrajudiciais (duplicatas, contratos com força executiva)
- Citação do devedor para pagar em 3 dias (art. 829, CPC)
- Possibilidade de penhora de bens, bloqueio judicial (BacenJud/SisbaJud)

### 4. Ação de Cobrança
- Para dívidas sem título executivo
- Processo de conhecimento: citação → contestação → instrução → sentença
- Prazo prescricional: 5 anos (art. 206, §5º, CC) para prestação de serviços

### 5. Acordo/Negociação
- Pode ocorrer em qualquer fase
- Documentar por escrito com testemunhas
- Definir: valor acordado, número de parcelas, data de vencimento, multa por inadimplência do acordo
- Se houver processo judicial: homologar acordo em juízo

## Regras de Escalonamento por Dias de Atraso

| Dias de Atraso | Procedimento Sugerido | Prioridade |
|---|---|---|
| 1-30 | Cobrança amigável (e-mail/telefone) | Baixa |
| 31-60 | Notificação extrajudicial | Média |
| 61-90 | Protesto de título | Alta |
| 91-120 | Avaliação para ação judicial | Alta |
| 120+ | Ação de execução/cobrança | Urgente |

## Orientações Gerais
- SEMPRE verificar se há cláusula de foro no contrato antes de ajuizar ação
- Calcular juros de mora (1% ao mês, art. 406, CC) + correção monetária (IPCA ou IGP-M conforme contrato)
- Honorários advocatícios contratuais: verificar se há previsão no contrato (usualmente 10-20%)
- Custas processuais: variam por estado/comarca
- NUNCA aconselhar sobre casos específicos sem advogado — orientar procedimentos gerais
```

**Step 2: Create `agents/legal-contratos.md`**

```markdown
# Assistente Jurídico — Contratos Empresariais

Você é um assistente jurídico especializado em contratos empresariais no contexto brasileiro.

## Tipos de Contrato

### Prestação de Serviços (SaaS/Recorrente)
- Objeto claro: descrição dos serviços, SLA, métricas de qualidade
- Vigência: prazo determinado com renovação automática ou indeterminado
- Rescisão: aviso prévio mínimo de 30 dias (usual), multa proporcional
- Reajuste: anual pelo IPCA ou IGP-M (definir no contrato)

### Contrato de Parceria Comercial
- Definir responsabilidades de cada parte
- Cláusula de não-concorrência e confidencialidade
- Divisão de receitas/comissões
- Propriedade intelectual: quem detém os direitos sobre o que é criado

### Contrato de Trabalho (CLT)
- Ver markdown legal-trabalhista.md para detalhes

## Cláusulas Essenciais

### Multa Rescisória
- Contrato determinado: multa proporcional ao tempo restante
- Contrato indeterminado: usualmente 1-3 mensalidades
- Fundamentação: art. 603 do CC (cláusula penal)

### SLA (Service Level Agreement)
- Disponibilidade mínima: ex. 99,5% uptime
- Tempo de resposta: classificar por severidade (P1, P2, P3)
- Penalidades: desconto proporcional ou créditos
- Exclusões: manutenção programada, força maior

### Confidencialidade (NDA)
- Definição de informações confidenciais
- Prazo de vigência: durante contrato + 2 a 5 anos após término
- Penalidade por violação
- Exceções: informações públicas, ordem judicial

### Propriedade Intelectual
- Work-for-hire: tudo que o prestador cria pertence ao contratante
- Licenciamento: direitos de uso sem transferência de propriedade
- Código-fonte: definir se há entrega e em quais condições

## Análise de Contratos — Checklist
1. Partes estão corretamente identificadas (razão social, CNPJ)?
2. Objeto está claro e específico?
3. Valor e forma de pagamento estão definidos?
4. Prazo de vigência e condições de renovação?
5. Cláusula de rescisão com aviso prévio e multa?
6. Foro de eleição definido?
7. Cláusula de confidencialidade presente?
8. SLA definido (se aplicável)?
9. Responsabilidade por danos limitada?
10. Cláusula de força maior presente?

## Orientações Gerais
- Contratos acima de R$ 50.000 devem ser revisados por advogado antes de assinatura
- Manter cópia digitalizada de todos os contratos assinados
- Controlar datas de vencimento e renovação automaticamente
- NUNCA assinar contrato sem ler todas as cláusulas — orientar revisão profissional
```

**Step 3: Create `agents/legal-trabalhista.md`**

```markdown
# Assistente Jurídico — Direito Trabalhista

Você é um assistente jurídico especializado em direito trabalhista brasileiro.

## Modalidades de Contratação

### CLT (Consolidação das Leis do Trabalho)
- Vínculo empregatício com carteira assinada
- Direitos: FGTS (8%), 13º salário, férias + 1/3, INSS, vale-transporte
- Jornada: 44h semanais (8h/dia + 4h sábado) ou acordo de compensação
- Hora extra: mínimo 50% de acréscimo (100% aos domingos/feriados)

### PJ (Pessoa Jurídica)
- Contrato de prestação de serviços entre empresas
- Sem vínculo empregatício (atenção à subordinação/pessoalidade)
- Riscos de reconhecimento de vínculo: exclusividade, subordinação direta, pessoalidade, habitualidade
- Recomendação: contrato claro com autonomia do prestador

### Estágio (Lei 11.788/2008)
- Máximo 6h/dia e 30h/semana
- Termo de compromisso obrigatório
- Seguro contra acidentes pessoais
- Duração máxima: 2 anos (exceto PCD)

## Rescisão Contratual

### Sem Justa Causa (pelo empregador)
- Aviso prévio: 30 dias + 3 dias por ano trabalhado (máx. 90 dias)
- Multa FGTS: 40% sobre saldo
- Saldo de salário, férias proporcionais + 1/3, 13º proporcional
- Prazo para pagamento: 10 dias corridos após término

### Por Justa Causa (art. 482, CLT)
- Hipóteses: improbidade, incontinência, negociação habitual, condenação criminal, desídia, embriaguez, violação de segredo, indisciplina, abandono de emprego, ato lesivo da honra
- Direitos: apenas saldo de salário e férias vencidas + 1/3
- ATENÇÃO: exige prova robusta e proporcionalidade

### Pedido de Demissão
- Aviso prévio de 30 dias (ou desconto)
- Sem multa FGTS, sem saque FGTS, sem seguro-desemprego
- Demais verbas proporcionais são devidas

### Acordo Mútuo (art. 484-A, CLT — Reforma Trabalhista)
- Aviso prévio: 50% (se indenizado)
- Multa FGTS: 20%
- Saque FGTS: até 80%
- Sem seguro-desemprego

## Documentação Obrigatória
- Contrato de trabalho assinado
- CTPS (digital ou física) com anotações
- Exame admissional, periódico e demissional
- Recibos de pagamento assinados
- Controle de ponto (empresas com 20+ funcionários)
- Termo de responsabilidade de equipamentos

## Prazos Importantes
- Prescrição trabalhista: 5 anos durante o contrato, 2 anos após rescisão
- Homologação (se > 1 ano): no sindicato ou MTE
- Pagamento de rescisão: 10 dias corridos
- Entrega de documentos (TRCT, guias): junto com pagamento

## Orientações Gerais
- SEMPRE documentar advertências e suspensões por escrito
- Manter pasta individual do colaborador atualizada
- Férias devem ser concedidas nos 12 meses subsequentes ao período aquisitivo
- Banco de horas: acordo individual por escrito (compensação em até 6 meses) ou ACT/CCT (até 1 ano)
- NUNCA substituir aconselhamento de advogado trabalhista para casos específicos
```

**Step 4: Commit**

```bash
git add agents/legal-cobranca.md agents/legal-contratos.md agents/legal-trabalhista.md
git commit -m "feat(juridico): add legal knowledge markdowns for AI assistant

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 2: Add Database Schema for Chat Persistence

**Files:**
- Modify: `shared/schema.ts` (add tables after `juridicoProcessos` block, around line 1465)

**Step 1: Add schema tables to `shared/schema.ts`**

Insert after line 1465 (`export type InsertJuridicoProcesso = ...`):

```typescript
// Tabela para conversas do assistente jurídico
export const juridicoChatConversas = cortexCoreSchema.table("juridico_chat_conversas", {
  id: serial("id").primaryKey(),
  usuarioId: varchar("usuario_id", { length: 100 }).notNull(),
  titulo: varchar("titulo", { length: 200 }),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export type JuridicoChatConversa = typeof juridicoChatConversas.$inferSelect;

// Tabela para mensagens do assistente jurídico
export const juridicoChatMensagens = cortexCoreSchema.table("juridico_chat_mensagens", {
  id: serial("id").primaryKey(),
  conversaId: integer("conversa_id").notNull(),
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant'
  conteudo: text("conteudo").notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type JuridicoChatMensagem = typeof juridicoChatMensagens.$inferSelect;
```

**Step 2: Create tables in database**

Run SQL directly against the database (via existing pattern in the project):

```sql
CREATE TABLE IF NOT EXISTS cortex_core.juridico_chat_conversas (
  id SERIAL PRIMARY KEY,
  usuario_id VARCHAR(100) NOT NULL,
  titulo VARCHAR(200),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.juridico_chat_mensagens (
  id SERIAL PRIMARY KEY,
  conversa_id INTEGER NOT NULL REFERENCES cortex_core.juridico_chat_conversas(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  conteudo TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_juridico_chat_conversas_usuario ON cortex_core.juridico_chat_conversas(usuario_id);
CREATE INDEX idx_juridico_chat_mensagens_conversa ON cortex_core.juridico_chat_mensagens(conversa_id);
```

**Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(juridico): add chat persistence schema for legal assistant

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 3: Add Permission Key and Navigation Item

**Files:**
- Modify: `shared/nav-config.ts:86-91` (add ASSISTENTE to JUR permissions)
- Modify: `shared/nav-config.ts:459-468` (add Assistente item to juridico nav)
- Modify: `shared/nav-config.ts` (add route mapping in ROUTE_PERMISSION_MAP)

**Step 1: Add permission key**

In `shared/nav-config.ts`, inside the `JUR` block (line 86-91), add:

```typescript
JUR: {
  CLIENTES_INADIMPLENTES: 'jur.clientes_inadimplentes',
  CONTRATOS_MODULE: 'jur.contratos_module',
  CONTRATOS_COLABORADORES: 'jur.contratos_colaboradores',
  PROCESSOS: 'jur.processos',
  ASSISTENTE: 'jur.assistente',  // ← ADD THIS
},
```

**Step 2: Add nav item**

In the `juridico` section of `NAV_CONFIG` (line 459-468), add the Assistente item as first item:

```typescript
juridico: {
  title: 'Jurídico',
  icon: 'Scale',
  items: [
    { title: 'Assistente IA', url: '/juridico/assistente', icon: 'Bot', permissionKey: PERMISSION_KEYS.JUR.ASSISTENTE },  // ← ADD THIS
    { title: 'Clientes Inadimplentes', url: '/juridico/clientes', icon: 'Gavel', permissionKey: PERMISSION_KEYS.JUR.CLIENTES_INADIMPLENTES },
    { title: 'Processos', url: '/juridico/processos', icon: 'Scale', permissionKey: PERMISSION_KEYS.JUR.PROCESSOS },
    { title: 'Contratos', url: '/contratos-module', icon: 'FileText', permissionKey: PERMISSION_KEYS.JUR.CONTRATOS_MODULE },
    { title: 'Contratos Colaboradores', url: '/juridico/contratos-colaborador', icon: 'Users', permissionKey: PERMISSION_KEYS.JUR.CONTRATOS_COLABORADORES },
  ],
},
```

**Step 3: Add route permission mapping**

Find the `ROUTE_PERMISSION_MAP` section and add after the existing juridico routes:

```typescript
'/juridico/assistente': PERMISSION_KEYS.JUR.ASSISTENTE,
```

**Step 4: Commit**

```bash
git add shared/nav-config.ts
git commit -m "feat(juridico): add permission key and nav item for AI assistant

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 4: Create Backend Route with Function Calling

**Files:**
- Create: `server/routes/juridico-assistente.ts`
- Modify: `server/routes.ts` (import and register route)

**Step 1: Create `server/routes/juridico-assistente.ts`**

```typescript
import { Express } from "express";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { juridicoChatConversas, juridicoChatMensagens, juridicoClientes, juridicoProcessos, juridicoRegrasEscalonamento } from "../../shared/schema";
import { eq, desc, sql, and, gte, lte, ilike } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Load legal knowledge markdowns
function loadLegalKnowledge(): string {
  const agentsDir = path.resolve(process.cwd(), "agents");
  const legalFiles = ["legal-cobranca.md", "legal-contratos.md", "legal-trabalhista.md"];

  const knowledge = legalFiles
    .map(file => {
      const filePath = path.join(agentsDir, file);
      try {
        return fs.readFileSync(filePath, "utf-8");
      } catch {
        console.warn(`[juridico-assistente] Knowledge file not found: ${filePath}`);
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  return knowledge;
}

const LEGAL_SYSTEM_PROMPT = `Você é o Assistente Jurídico do Turbo Cortex — um especialista em direito empresarial brasileiro que auxilia o setor jurídico da Turbo Partners.

## REGRAS IMPORTANTES:
- Responda SEMPRE em português brasileiro
- Formate respostas em Markdown para melhor legibilidade
- Use tabelas quando apresentar dados comparativos
- NUNCA substitua aconselhamento de advogado — sempre oriente buscar profissional para decisões finais
- Quando consultar dados do banco, apresente-os de forma organizada
- Se não tiver certeza sobre algo, diga explicitamente

## BASE DE CONHECIMENTO JURÍDICO:

${loadLegalKnowledge()}
`;

// OpenAI function definitions for database queries
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_clientes_inadimplentes",
      description: "Busca clientes inadimplentes com informações de contexto jurídico. Retorna dados de procedimento, status jurídico, valor acordado, advogado responsável.",
      parameters: {
        type: "object",
        properties: {
          status_juridico: {
            type: "string",
            enum: ["aguardando_documentos", "em_andamento", "finalizado", "suspenso"],
            description: "Filtrar por status jurídico"
          },
          procedimento: {
            type: "string",
            enum: ["notificacao", "protesto", "acao_judicial", "acordo", "baixa"],
            description: "Filtrar por tipo de procedimento"
          },
          limite: {
            type: "number",
            description: "Número máximo de resultados (default: 20)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_processos",
      description: "Busca processos judiciais cadastrados. Retorna número CNJ, cliente, ação, status, valor da causa, último andamento.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["Ativo", "Encerrado", "Arquivado", "Suspenso"],
            description: "Filtrar por status do processo"
          },
          cliente: {
            type: "string",
            description: "Nome do cliente para buscar (busca parcial)"
          },
          natureza: {
            type: "string",
            enum: ["Cível", "Trabalhista"],
            description: "Filtrar por natureza da ação"
          },
          limite: {
            type: "number",
            description: "Número máximo de resultados (default: 20)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_regras_escalonamento",
      description: "Busca regras de escalonamento de cobrança por dias de atraso. Retorna procedimento sugerido e prioridade para cada faixa de dias.",
      parameters: {
        type: "object",
        properties: {
          dias_atraso: {
            type: "number",
            description: "Dias de atraso para buscar a regra aplicável"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_parcelas_cliente",
      description: "Busca parcelas/faturas de um cliente no Conta Azul. Retorna status de pagamento, valores, datas de vencimento.",
      parameters: {
        type: "object",
        properties: {
          nome_cliente: {
            type: "string",
            description: "Nome do cliente para buscar parcelas"
          },
          status: {
            type: "string",
            enum: ["PAGO", "PENDENTE", "VENCIDO"],
            description: "Filtrar por status da parcela"
          },
          limite: {
            type: "number",
            description: "Número máximo de resultados (default: 20)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "resumo_juridico",
      description: "Retorna um resumo geral do setor jurídico: total de processos ativos, clientes inadimplentes, procedimentos em andamento.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  }
];

// Execute tool functions
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "buscar_clientes_inadimplentes": {
        const conditions = [];
        if (args.status_juridico) conditions.push(eq(juridicoClientes.statusJuridico, args.status_juridico as string));
        if (args.procedimento) conditions.push(eq(juridicoClientes.procedimento, args.procedimento as string));

        const limite = (args.limite as number) || 20;
        const query = db.select().from(juridicoClientes);
        const results = conditions.length > 0
          ? await query.where(and(...conditions)).limit(limite)
          : await query.limit(limite);

        if (results.length === 0) return JSON.stringify({ mensagem: "Nenhum cliente inadimplente encontrado com os filtros informados.", total: 0 });
        return JSON.stringify({ total: results.length, clientes: results });
      }

      case "buscar_processos": {
        const conditions = [];
        if (args.status) conditions.push(eq(juridicoProcessos.status, args.status as string));
        if (args.natureza) conditions.push(eq(juridicoProcessos.naturezaAcao, args.natureza as string));
        if (args.cliente) conditions.push(ilike(juridicoProcessos.clientePrincipal, `%${args.cliente}%`));

        const limite = (args.limite as number) || 20;
        const query = db.select().from(juridicoProcessos);
        const results = conditions.length > 0
          ? await query.where(and(...conditions)).limit(limite)
          : await query.limit(limite);

        if (results.length === 0) return JSON.stringify({ mensagem: "Nenhum processo encontrado com os filtros informados.", total: 0 });
        return JSON.stringify({ total: results.length, processos: results });
      }

      case "buscar_regras_escalonamento": {
        const results = await db.select().from(juridicoRegrasEscalonamento).where(eq(juridicoRegrasEscalonamento.ativo, true));

        if (args.dias_atraso) {
          const dias = args.dias_atraso as number;
          const regraAplicavel = results.find(r => dias >= (r.diasAtrasoMin ?? 0) && dias <= (r.diasAtrasoMax ?? 9999));
          return JSON.stringify({ dias_atraso: dias, regra_aplicavel: regraAplicavel || null, todas_regras: results });
        }

        return JSON.stringify({ regras: results });
      }

      case "buscar_parcelas_cliente": {
        const conditions = [];
        if (args.nome_cliente) conditions.push(ilike(sql`"Conta Azul".caz_parcelas.nome_cliente`, `%${args.nome_cliente}%`));
        if (args.status) conditions.push(eq(sql`"Conta Azul".caz_parcelas.status`, args.status as string));

        const limite = (args.limite as number) || 20;
        const results = await db.execute(sql`
          SELECT nome_cliente, valor, status, data_emissao, data_vencimento, data_pagamento, tipo, categoria, descricao
          FROM "Conta Azul".caz_parcelas
          ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions.map(c => sql`${c}`), sql` AND `)}` : sql``}
          ORDER BY data_vencimento DESC
          LIMIT ${limite}
        `);

        if (results.rows.length === 0) return JSON.stringify({ mensagem: "Nenhuma parcela encontrada.", total: 0 });
        return JSON.stringify({ total: results.rows.length, parcelas: results.rows });
      }

      case "resumo_juridico": {
        const [processosAtivos] = await db.execute(sql`
          SELECT COUNT(*) as total FROM cortex_core.juridico_processos WHERE status = 'Ativo'
        `);
        const [clientesInadimplentes] = await db.execute(sql`
          SELECT COUNT(*) as total FROM juridico_clientes WHERE status_juridico != 'finalizado' OR status_juridico IS NULL
        `);
        const procedimentos = await db.execute(sql`
          SELECT procedimento, COUNT(*) as total FROM juridico_clientes WHERE procedimento IS NOT NULL GROUP BY procedimento
        `);

        return JSON.stringify({
          processos_ativos: processosAtivos?.total || 0,
          clientes_inadimplentes: clientesInadimplentes?.total || 0,
          procedimentos_por_tipo: procedimentos.rows,
        });
      }

      default:
        return JSON.stringify({ error: `Função desconhecida: ${name}` });
    }
  } catch (error: any) {
    console.error(`[juridico-assistente] Error executing tool ${name}:`, error);
    return JSON.stringify({ error: `Erro ao executar consulta: ${error.message}` });
  }
}

export function registerJuridicoAssistenteRoutes(app: Express) {
  // List conversations for current user
  app.get("/api/juridico/assistente/conversas", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const conversas = await db.select()
        .from(juridicoChatConversas)
        .where(eq(juridicoChatConversas.usuarioId, userId))
        .orderBy(desc(juridicoChatConversas.atualizadoEm));

      res.json(conversas);
    } catch (error) {
      console.error("[juridico-assistente] Error listing conversations:", error);
      res.status(500).json({ error: "Erro ao listar conversas" });
    }
  });

  // Create new conversation
  app.post("/api/juridico/assistente/conversas", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const [conversa] = await db.insert(juridicoChatConversas)
        .values({ usuarioId: userId, titulo: "Nova conversa" })
        .returning();

      res.json(conversa);
    } catch (error) {
      console.error("[juridico-assistente] Error creating conversation:", error);
      res.status(500).json({ error: "Erro ao criar conversa" });
    }
  });

  // Get messages for a conversation
  app.get("/api/juridico/assistente/conversas/:id/mensagens", async (req, res) => {
    try {
      const conversaId = parseInt(req.params.id);
      if (isNaN(conversaId)) return res.status(400).json({ error: "ID inválido" });

      const mensagens = await db.select()
        .from(juridicoChatMensagens)
        .where(eq(juridicoChatMensagens.conversaId, conversaId))
        .orderBy(juridicoChatMensagens.criadoEm);

      res.json(mensagens);
    } catch (error) {
      console.error("[juridico-assistente] Error fetching messages:", error);
      res.status(500).json({ error: "Erro ao buscar mensagens" });
    }
  });

  // Send message and get AI response
  app.post("/api/juridico/assistente/chat", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const { conversaId, message } = req.body;
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Mensagem é obrigatória" });
      }
      if (!conversaId) return res.status(400).json({ error: "conversaId é obrigatório" });

      // Save user message
      await db.insert(juridicoChatMensagens).values({
        conversaId,
        role: "user",
        conteudo: message.trim(),
      });

      // Load conversation history
      const historico = await db.select()
        .from(juridicoChatMensagens)
        .where(eq(juridicoChatMensagens.conversaId, conversaId))
        .orderBy(juridicoChatMensagens.criadoEm);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: LEGAL_SYSTEM_PROMPT },
        ...historico.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.conteudo,
        })),
      ];

      // Agentic loop: call OpenAI → execute tools → repeat
      let response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages,
        tools,
        tool_choice: "auto",
        max_completion_tokens: 2048,
        temperature: 0.3,
      });

      let assistantMessage = response.choices[0]?.message;

      // Loop while model wants to call tools (max 5 iterations)
      let iterations = 0;
      while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < 5) {
        iterations++;

        // Add assistant message with tool calls
        messages.push(assistantMessage);

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeTool(toolCall.function.name, args);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Call OpenAI again with tool results
        response = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages,
          tools,
          tool_choice: "auto",
          max_completion_tokens: 2048,
          temperature: 0.3,
        });

        assistantMessage = response.choices[0]?.message;
      }

      const responseContent = assistantMessage?.content || "Desculpe, não consegui processar sua solicitação.";

      // Save assistant response
      await db.insert(juridicoChatMensagens).values({
        conversaId,
        role: "assistant",
        conteudo: responseContent,
      });

      // Auto-generate title from first message
      const msgCount = historico.length;
      if (msgCount <= 1) {
        const titulo = message.trim().substring(0, 100) + (message.length > 100 ? "..." : "");
        await db.update(juridicoChatConversas)
          .set({ titulo, atualizadoEm: new Date() })
          .where(eq(juridicoChatConversas.id, conversaId));
      } else {
        await db.update(juridicoChatConversas)
          .set({ atualizadoEm: new Date() })
          .where(eq(juridicoChatConversas.id, conversaId));
      }

      res.json({ response: responseContent });
    } catch (error) {
      console.error("[juridico-assistente] Error in chat:", error);
      res.status(500).json({ error: "Erro ao processar mensagem" });
    }
  });

  // Delete conversation
  app.delete("/api/juridico/assistente/conversas/:id", async (req, res) => {
    try {
      const conversaId = parseInt(req.params.id);
      if (isNaN(conversaId)) return res.status(400).json({ error: "ID inválido" });

      await db.delete(juridicoChatMensagens).where(eq(juridicoChatMensagens.conversaId, conversaId));
      await db.delete(juridicoChatConversas).where(eq(juridicoChatConversas.id, conversaId));

      res.json({ success: true });
    } catch (error) {
      console.error("[juridico-assistente] Error deleting conversation:", error);
      res.status(500).json({ error: "Erro ao excluir conversa" });
    }
  });
}
```

**Step 2: Register route in `server/routes.ts`**

Add import at the top (after line ~29, with other route imports):

```typescript
import { registerJuridicoAssistenteRoutes } from "./routes/juridico-assistente";
```

Add registration call (after line ~15015, with other route registrations):

```typescript
registerJuridicoAssistenteRoutes(app);
```

**Step 3: Commit**

```bash
git add server/routes/juridico-assistente.ts server/routes.ts
git commit -m "feat(juridico): add backend route for legal AI assistant with function calling

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 5: Create Frontend Page

**Files:**
- Create: `client/src/pages/AssistenteJuridico.tsx`
- Modify: `client/src/App.tsx` (add lazy import + route)

**Step 1: Create `client/src/pages/AssistenteJuridico.tsx`**

Full-page chat component with:
- Left sidebar: conversation list + "Nova conversa" button
- Main area: message list with ScrollArea + input at bottom
- Empty state with suggestion cards
- Dark/light mode support
- Markdown rendering for assistant responses (use `react-markdown` if available, or dangerouslySetInnerHTML with basic markdown parsing)
- Loading spinner while waiting for AI response

Key patterns to follow from existing codebase:
- Use `useQuery` and `useMutation` from `@tanstack/react-query` for API calls
- Use `apiRequest` helper from `@/lib/queryClient` for fetch calls
- Use `useAuth` hook for user context
- Use Tailwind `dark:` variants for all colors
- UI components from `@/components/ui/` (Button, Input, ScrollArea, Card)
- Icons from `lucide-react` (Bot, Send, Plus, Trash2, MessageSquare, Scale)

The component should:
1. On mount: fetch conversations list
2. On conversation select: fetch messages for that conversation
3. On new conversation: POST to create, then set as active
4. On send message: POST to chat endpoint, append user message immediately, show loading, append AI response when received
5. Auto-scroll to bottom on new messages

**Step 2: Add lazy import and route to `client/src/App.tsx`**

Add lazy import (after line 108, with other juridico imports):

```typescript
const AssistenteJuridico = lazyWithRetry(() => import("@/pages/AssistenteJuridico"));
```

Add route (after line 333, with other juridico routes):

```tsx
<Route path="/juridico/assistente">{() => <ProtectedRoute path="/juridico/assistente" component={AssistenteJuridico} />}</Route>
```

**Step 3: Commit**

```bash
git add client/src/pages/AssistenteJuridico.tsx client/src/App.tsx
git commit -m "feat(juridico): add frontend page for legal AI assistant chat

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

### Task 6: Test End-to-End

**Step 1: Restart server**

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

**Step 2: Verify in browser**

1. Navigate to `/juridico/assistente`
2. Verify sidebar shows "Jurídico > Assistente IA" menu item
3. Click "Nova Conversa"
4. Send test messages:
   - "Olá, quais são os procedimentos de cobrança?" (knowledge-only)
   - "Quais processos judiciais estão ativos?" (function calling)
   - "Resuma a situação do setor jurídico" (resumo function)
5. Verify conversation persists after page reload
6. Test delete conversation
7. Verify dark mode styling

**Step 3: Fix any issues found during testing**

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(juridico): adjust legal assistant after e2e testing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```
