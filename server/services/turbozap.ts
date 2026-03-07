import { db } from "../db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ============================================
// Types
// ============================================

export interface ClienteCobranca {
  id_cliente: string;
  cliente_nome: string;
  telefone: string;
  cnpj: string;
  data_vencimento: string;
  total: number;
  link_pagamento: string;
  status: string;
}

export interface PreviewNivel {
  tipo: string;
  label: string;
  dias: number;
  data_vencimento: string;
  clientes: ClienteCobranca[];
  total_valor: number;
  instancia: "financeiro" | "juridico";
  condicional?: string;
}

export interface EnvioRegistro {
  id: number;
  id_cliente: string;
  cliente_nome: string;
  cnpj: string;
  telefone: string;
  data_vencimento: string;
  valor: number;
  link_pagamento: string;
  tipo_cobranca: string;
  mensagem_enviada: string;
  status: string;
  erro_detalhe: string | null;
  executado_por: string;
  execucao_id: string;
  criado_em: string;
}

export interface TurboZapStats {
  enviados_hoje: number;
  enviados_mes: number;
  erros_hoje: number;
  taxa_sucesso: number;
}

export interface TurboZapConfiguracao {
  id: number;
  chave: string;
  valor: string;
  atualizado_por: string | null;
  atualizado_em: string;
}

// ============================================
// Níveis de escalação
// ============================================

interface NivelCobranca {
  tipo: string;
  label: string;
  dias: number;
  instancia: "financeiro" | "juridico";
  condicional?: string;
}

const NIVEIS_COBRANCA: NivelCobranca[] = [
  { tipo: "D-3", label: "D-3 (Lembrete)", dias: -3, instancia: "financeiro" },
  { tipo: "D+0", label: "D+0 (Vencimento)", dias: 0, instancia: "financeiro" },
  { tipo: "D+3", label: "D+3 (3 dias)", dias: 3, instancia: "financeiro" },
  { tipo: "D+7", label: "D+7 (Suspensão)", dias: 7, instancia: "financeiro" },
  { tipo: "D+10", label: "D+10 (Rescisão)", dias: 10, instancia: "financeiro" },
  { tipo: "D+15", label: "D+15 (Encerramento)", dias: 15, instancia: "financeiro" },
  { tipo: "D+20", label: "D+20 (Cancelado)", dias: 20, instancia: "financeiro" },
  { tipo: "D+30", label: "D+30 (Formalização Jurídica)", dias: 30, instancia: "juridico" },
  { tipo: "D+40", label: "D+40 (Comunicação Protesto)", dias: 40, instancia: "juridico" },
  { tipo: "D+45", label: "D+45 (Protesto Efetivado)", dias: 45, instancia: "juridico", condicional: "protesto_efetivado" },
  { tipo: "D+50", label: "D+50 (Aviso Negativação)", dias: 50, instancia: "juridico" },
  { tipo: "D+55", label: "D+55 (Negativação Efetivada)", dias: 55, instancia: "juridico", condicional: "negativacao_efetivada" },
];

// ============================================
// Templates padrão (seeds)
// ============================================

const DEFAULT_TEMPLATES: Record<string, string> = {
  "D-3": `Olá {nome}, tudo certo? \n
Este é apenas um lembrete de que a fatura referente ao período vigente possui vencimento previsto para {vencimento}.\n
segue o link para facilitar:
{link_pagamento}
Permanecemos à disposição para qualquer esclarecimento.`,

  "D+0": `Olá! {nome}, tudo certo? \n
Passando aqui só pra avisar que o boleto da Turbo no valor de R$ {valor} vence hoje.\n
Segue o link pra facilitar: {link_pagamento}\n
Qualquer dúvida, estamos à disposição.\n
\nEstamos cientes de que o vencimento caiu em um dia não útil. O pagamento no próximo dia útil não gerará multas nem encargos.
— Time Financeiro | Turbo Partners`,

  "D+3": `Oi {nome}, tudo certo?\n

venceu o boleto da Turbo (R$ {valor}, vencimento em {vencimento}), e ainda não localizamos o pagamento por aqui.\n
Caso já tenha pago, é só nos enviar o comprovante por aqui.\n
Se ainda não conseguiu, segue o link pra facilitar:\n
{link_pagamento}\n

Importante: caso a pendência não seja regularizada até o 7º dia após o vencimento, os serviços serão pausados automaticamente até a quitação.
Qualquer dúvida, estamos à disposição.

— Time Financeiro | Turbo Partners`,

  "D+7": `Prezado(a), {nome}\n

Verificamos a manutenção da inadimplência referente à fatura vencida em {vencimento} no valor de R$ {valor}.\n
Assim, informamos que, conforme previsto contratualmente e em nossas rotinas operacionais, as operações e serviços vinculados ao contrato encontram-se temporariamente suspensos, permanecendo assim até a confirmação da regularização do pagamento.\n
Caso haja interesse na regularização do débito, segue abaixo o boleto atualizado para pagamento:\n
{link_pagamento}\n
Qualquer dúvida, estamos à disposição.\n

— Time Financeiro | Turbo Partners`,

  "D+10": `Prezado(a), {nome}\n

A inadimplência referente ao contrato permanece sem regularização até o presente momento.\n
Informamos que, caso a situação persista, poderá ser adotado o procedimento de rescisão contratual, nos termos previstos no instrumento firmado entre as partes.\n
Caso haja interesse na regularização do débito, segue abaixo o boleto atualizado para pagamento:\n
{link_pagamento}\n
Qualquer dúvida, estamos à disposição.\n

— Time Financeiro | Turbo Partners`,

  "D+15": `Prezado(a), {nome}\n

Diante da continuidade da inadimplência do boleto vencido em {vencimento} no valor de R$ {valor}, informamos que o contrato encontra-se em fase de encerramento administrativo, em razão do descumprimento das obrigações financeiras assumidas.\n
Na ausência de regularização, o cancelamento contratual será efetivado, conforme previsto contratualmente.\n
Caso haja interesse na regularização do débito, segue abaixo o boleto atualizado para pagamento:\n
{link_pagamento}\n
Qualquer dúvida, estamos à disposição.\n

— Time Financeiro | Turbo Partners`,

  "D+20": `Prezado(a), {nome}\n

Informamos que, diante da ausência de regularização do débito vencido em {vencimento} no valor de R$ {valor}, o contrato foi cancelado, nos termos do instrumento contratual firmado.\n
O débito permanece exigível e passível de cobrança pelos meios administrativos e legais cabíveis.\n
Caso haja interesse na regularização do débito, segue abaixo o boleto atualizado para pagamento:\n
{link_pagamento}\n
Qualquer dúvida, estamos à disposição.\n

— Time Financeiro | Turbo Partners`,

  "D+30": `Prezado(a), {nome}\n
Informamos que, em razão da inadimplência referente à fatura vencida em {vencimento}, no valor de R$ {valor}, o caso foi formalmente encaminhado ao departamento jurídico da empresa.\n
A partir desta data, todas as tratativas relacionadas ao débito serão conduzidas exclusivamente pela área jurídica.\n
Caso haja interesse na regularização imediata do débito, segue abaixo o boleto atualizado:\n
{link_pagamento}\n
Orientamos que o pagamento seja realizado com a maior brevidade possível, a fim de evitar a adoção de medidas legais cabíveis.\n
— Departamento Jurídico | Turbo Partners`,

  "D+40": `Prezado(a), {nome}\n
Na qualidade de representante legal, informamos que foi iniciado o procedimento de protesto extrajudicial referente ao débito vencido em {vencimento}, no valor de R$ {valor}.\n
O protesto será formalizado junto ao cartório competente no prazo de até 5 (cinco) dias úteis, caso a pendência não seja regularizada.\n
Para evitar o registro do protesto, providencie o pagamento através do link abaixo:\n
{link_pagamento}\n
Alertamos que o protesto implica em restrições de crédito e pode impactar diretamente a capacidade de obtenção de financiamentos e participação em licitações.\n
— Departamento Jurídico | Turbo Partners`,

  "D+45": `Prezado(a), {nome}\n
Informamos que o protesto referente ao débito vencido em {vencimento}, no valor de R$ {valor}, foi efetivado junto ao cartório competente.\n
O registro do protesto gera implicações legais e financeiras imediatas, incluindo restrição cadastral e impacto na obtenção de crédito.\n
Ainda é possível regularizar a situação mediante pagamento integral do débito. Após a confirmação do pagamento, providenciaremos a baixa do protesto.\n
{link_pagamento}\n
— Departamento Jurídico | Turbo Partners`,

  "D+50": `Prezado(a), {nome}\n
Na qualidade de representante legal, informamos que, diante da manutenção da inadimplência e do protesto já efetivado, será realizada a negativação do débito junto aos órgãos de proteção ao crédito (SPC/Serasa).\n
O débito de R$ {valor}, vencido em {vencimento}, será registrado no prazo de 5 (cinco) dias úteis, caso não haja regularização.\n
Para evitar a negativação, providencie o pagamento:\n
{link_pagamento}\n
Alertamos que a negativação impacta diretamente o score de crédito e pode restringir operações financeiras da empresa.\n
— Departamento Jurídico | Turbo Partners`,

  "D+55": `Prezado(a), {nome}\n
Informamos que a negativação referente ao débito de R$ {valor}, vencido em {vencimento}, foi efetivada junto aos órgãos de proteção ao crédito (SPC/Serasa).\n
O registro permanecerá ativo até a quitação integral do débito ou pelo prazo legal de 5 anos.\n
Após a confirmação do pagamento, providenciaremos a exclusão da negativação no prazo de até 5 (cinco) dias úteis.\n
{link_pagamento}\n
— Departamento Jurídico | Turbo Partners`,
};

const DEFAULT_SKIP_NUMEROS = [
  "5527981111621",
  "5527997081791",
  "5527998989705",
  "5551993251413",
  "5531988120000",
];

// ============================================
// Init tables
// ============================================

export async function initTurboZapTables(): Promise<void> {
  try {
    // Create envios table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.turbozap_envios (
        id SERIAL PRIMARY KEY,
        id_cliente TEXT,
        cliente_nome TEXT,
        cnpj TEXT,
        telefone TEXT,
        data_vencimento DATE,
        valor DECIMAL(12,2),
        link_pagamento TEXT,
        tipo_cobranca TEXT,
        mensagem_enviada TEXT,
        status TEXT DEFAULT 'enviado',
        erro_detalhe TEXT,
        executado_por TEXT,
        execucao_id TEXT,
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indices
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_turbozap_envios_execucao ON cortex_core.turbozap_envios(execucao_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_turbozap_envios_cnpj ON cortex_core.turbozap_envios(cnpj)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_turbozap_envios_criado ON cortex_core.turbozap_envios(criado_em)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_turbozap_envios_tipo ON cortex_core.turbozap_envios(tipo_cobranca)
    `);

    // Create configuracoes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.turbozap_configuracoes (
        id SERIAL PRIMARY KEY,
        chave TEXT UNIQUE NOT NULL,
        valor TEXT,
        atualizado_por TEXT,
        atualizado_em TIMESTAMP DEFAULT NOW()
      )
    `);

    // Seed default configurations
    const seedConfigs = [
      { chave: "skip_numeros", valor: JSON.stringify(DEFAULT_SKIP_NUMEROS) },
      { chave: "template_D-3", valor: DEFAULT_TEMPLATES["D-3"] },
      { chave: "template_D+0", valor: DEFAULT_TEMPLATES["D+0"] },
      { chave: "template_D+3", valor: DEFAULT_TEMPLATES["D+3"] },
      { chave: "template_D+7", valor: DEFAULT_TEMPLATES["D+7"] },
      { chave: "template_D+10", valor: DEFAULT_TEMPLATES["D+10"] },
      { chave: "template_D+15", valor: DEFAULT_TEMPLATES["D+15"] },
      { chave: "template_D+20", valor: DEFAULT_TEMPLATES["D+20"] },
      { chave: "delay_min", valor: "10" },
      { chave: "delay_max", valor: "20" },
      { chave: "dry_run", valor: "false" },
      { chave: "template_D+30", valor: DEFAULT_TEMPLATES["D+30"] },
      { chave: "template_D+40", valor: DEFAULT_TEMPLATES["D+40"] },
      { chave: "template_D+45", valor: DEFAULT_TEMPLATES["D+45"] },
      { chave: "template_D+50", valor: DEFAULT_TEMPLATES["D+50"] },
      { chave: "template_D+55", valor: DEFAULT_TEMPLATES["D+55"] },
      { chave: "dry_run_juridico", valor: "true" },
    ];

    for (const cfg of seedConfigs) {
      await db.execute(sql`
        INSERT INTO cortex_core.turbozap_configuracoes (chave, valor)
        VALUES (${cfg.chave}, ${cfg.valor})
        ON CONFLICT (chave) DO NOTHING
      `);
    }

    console.log("[turbozap] Tables initialized successfully");
  } catch (error) {
    console.error("[turbozap] Error initializing tables:", error);
    throw error;
  }
}

// ============================================
// Helpers
// ============================================

export function normalizarNumero(numero: string): string {
  return String(numero).replace(/\D/g, "");
}

export function formatarValorBR(valor: number | string | null): string {
  if (valor === null || valor === undefined) return "";
  try {
    let num: number;
    if (typeof valor === "number") {
      num = valor;
    } else {
      let s = String(valor).trim().replace("R$", "").replace(/\s/g, "");
      if (s.includes(",") && s.includes(".")) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(",", ".");
      }
      num = parseFloat(s);
    }
    if (isNaN(num)) return String(valor);
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return String(valor);
  }
}

function formatarData(dateVal: string | Date): string {
  try {
    const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal);
  }
}

function calcularDataVencimento(dias: number): string {
  const now = new Date();
  // D-3 means the bill is due in 3 days (future), so we ADD days
  // D+N means the bill was due N days ago (past), so we SUBTRACT days
  const target = new Date(now);
  target.setDate(target.getDate() - dias);
  return target.toISOString().split("T")[0];
}

export function formatarMensagem(
  template: string,
  cliente: ClienteCobranca,
): string {
  const vencimento = formatarData(cliente.data_vencimento);
  const valor = formatarValorBR(cliente.total);
  return template
    .replace(/\{nome\}/g, cliente.cliente_nome)
    .replace(/\{valor\}/g, valor)
    .replace(/\{vencimento\}/g, vencimento)
    .replace(/\{link_pagamento\}/g, cliente.link_pagamento || "");
}

// ============================================
// Database queries
// ============================================

async function getConfiguracao(chave: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT valor FROM cortex_core.turbozap_configuracoes WHERE chave = ${chave}
  `);
  if (result.rows.length === 0) return null;
  return (result.rows[0] as any).valor;
}

export async function buscarClientesPorVencimento(dataVencimento: string): Promise<ClienteCobranca[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (p.id_cliente, p.data_vencimento)
      p.id_cliente AS id_cliente,
      c.nome AS cliente_nome,
      cup.telefone,
      c.cnpj,
      p.data_vencimento,
      p.nao_pago AS total,
      p.url_cobranca AS link_pagamento,
      p.status
    FROM "Conta Azul".caz_parcelas p
    INNER JOIN "Conta Azul".caz_clientes c ON c.ids = p.id_cliente::text
    INNER JOIN "Clickup".cup_clientes cup
      ON regexp_replace(cup.cnpj::text, '[^0-9]', '', 'g')
       = regexp_replace(c.cnpj::text, '[^0-9]', '', 'g')
    WHERE p.data_vencimento = ${dataVencimento}
      AND p.nao_pago > 0
      AND p.status != 'ACQUITTED'
      AND cup.telefone IS NOT NULL
    ORDER BY p.id_cliente, p.data_vencimento
  `);
  return result.rows as ClienteCobranca[];
}

// ============================================
// Preview
// ============================================

export async function previewCobrancas(): Promise<PreviewNivel[]> {
  const skipNumerosRaw = await getConfiguracao("skip_numeros");
  const skipNumeros = new Set<string>(
    skipNumerosRaw ? JSON.parse(skipNumerosRaw) : DEFAULT_SKIP_NUMEROS,
  );

  const niveis: PreviewNivel[] = [];

  for (const nivel of NIVEIS_COBRANCA) {
    const dataVencimento = calcularDataVencimento(nivel.dias);
    let clientes = await buscarClientesPorVencimento(dataVencimento);

    // Filter out skip numbers
    clientes = clientes.filter((c) => {
      const num = normalizarNumero(c.telefone);
      return !skipNumeros.has(num);
    });

    // Deduplicate by id_cliente + data_vencimento
    const vistos = new Set<string>();
    const unicos: ClienteCobranca[] = [];
    for (const c of clientes) {
      const chave = `${c.id_cliente}_${c.data_vencimento}`;
      if (!vistos.has(chave)) {
        vistos.add(chave);
        unicos.push(c);
      }
    }

    const totalValor = unicos.reduce((sum, c) => sum + (Number(c.total) || 0), 0);

    niveis.push({
      tipo: nivel.tipo,
      label: nivel.label,
      dias: nivel.dias,
      data_vencimento: dataVencimento,
      clientes: unicos,
      total_valor: totalValor,
      instancia: nivel.instancia,
      condicional: nivel.condicional,
    });
  }

  return niveis;
}

// ============================================
// Envio via Evolution API
// ============================================

async function enviarMensagemWhatsApp(
  numero: string,
  texto: string,
  instancia: "financeiro" | "juridico" = "financeiro",
): Promise<{ success: boolean; error?: string }> {
  const serverUrl = process.env.EVOLUTION_SERVER_URL;
  const instanceId = instancia === "juridico"
    ? process.env.EVOLUTION_JURIDICO_INSTANCE_ID
    : process.env.EVOLUTION_INSTANCE_ID;
  const token = process.env.EVOLUTION_TOKEN;

  if (!serverUrl || !instanceId || !token) {
    return { success: false, error: `Evolution API não configurada para instância '${instancia}'` };
  }

  const dryRunKey = instancia === "juridico" ? "dry_run_juridico" : "dry_run";
  const dryRun = await getConfiguracao(dryRunKey);
  if (dryRun === "true") {
    console.log(`[turbozap][DRY_RUN][${instancia}] Não enviando para ${numero}`);
    return { success: true };
  }

  try {
    const response = await fetch(
      `https://${serverUrl}/message/sendText/${instanceId}`,
      {
        method: "POST",
        headers: {
          "apikey": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: numero,
          options: { delay: 100, presence: "composing", linkPreview: true },
          text: texto,
        }),
      },
    );

    if (response.status === 200 || response.status === 201) {
      return { success: true };
    }
    const errorText = await response.text();
    return { success: false, error: `HTTP ${response.status}: ${errorText}` };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro de conexão" };
  }
}

// ============================================
// Pipeline Jurídico helper
// ============================================

async function checkPipelineJuridico(cnpj: string, dataVencimento: string): Promise<Record<string, any> | null> {
  const result = await db.execute(sql`
    SELECT * FROM cortex_core.turbozap_pipeline_juridico
    WHERE cnpj = ${cnpj} AND data_vencimento = ${dataVencimento}
    LIMIT 1
  `);
  return result.rows.length > 0 ? (result.rows[0] as Record<string, any>) : null;
}

// ============================================
// Executar cobranças
// ============================================

export async function executarCobrancas(
  executadoPor: string,
): Promise<{ execucaoId: string; enviados: number; erros: number; pulados: number }> {
  const execucaoId = randomUUID();
  const preview = await previewCobrancas();

  const delayMinRaw = await getConfiguracao("delay_min");
  const delayMaxRaw = await getConfiguracao("delay_max");
  const delayMin = parseFloat(delayMinRaw || "10") * 1000;
  const delayMax = parseFloat(delayMaxRaw || "20") * 1000;

  let enviados = 0;
  let erros = 0;
  let pulados = 0;

  for (const nivel of preview) {
    // Get template for this level
    const template = await getConfiguracao(`template_${nivel.tipo}`);
    if (!template) {
      console.warn(`[turbozap] No template for ${nivel.tipo}, skipping`);
      continue;
    }

    for (const cliente of nivel.clientes) {
      // Check for duplicate: same client + same tipo + same day
      const today = new Date().toISOString().split("T")[0];
      const dupCheck = await db.execute(sql`
        SELECT id FROM cortex_core.turbozap_envios
        WHERE cnpj = ${cliente.cnpj || ""}
          AND tipo_cobranca = ${nivel.tipo}
          AND criado_em::date = ${today}::date
          AND status = 'enviado'
        LIMIT 1
      `);

      if (dupCheck.rows.length > 0) {
        pulados++;
        await db.execute(sql`
          INSERT INTO cortex_core.turbozap_envios (
            id_cliente, cliente_nome, cnpj, telefone,
            data_vencimento, valor, link_pagamento,
            tipo_cobranca, mensagem_enviada, status, erro_detalhe,
            executado_por, execucao_id
          ) VALUES (
            ${cliente.id_cliente}, ${cliente.cliente_nome}, ${cliente.cnpj || ""},
            ${cliente.telefone}, ${cliente.data_vencimento}, ${Number(cliente.total)},
            ${cliente.link_pagamento || ""}, ${nivel.tipo}, ${""},
            'pulado', 'Duplicata: já enviado hoje para este cliente/tipo',
            ${executadoPor}, ${execucaoId}
          )
        `);
        continue;
      }

      // Check conditional pipeline flag (D+45, D+55)
      if (nivel.condicional) {
        const pipeline = await checkPipelineJuridico(cliente.cnpj, cliente.data_vencimento);
        if (!pipeline || !(pipeline as any)[nivel.condicional]) {
          pulados++;
          await db.execute(sql`
            INSERT INTO cortex_core.turbozap_envios (
              id_cliente, cliente_nome, cnpj, telefone,
              data_vencimento, valor, link_pagamento,
              tipo_cobranca, mensagem_enviada, status, erro_detalhe,
              executado_por, execucao_id
            ) VALUES (
              ${cliente.id_cliente}, ${cliente.cliente_nome}, ${cliente.cnpj || ""},
              ${cliente.telefone}, ${cliente.data_vencimento}, ${Number(cliente.total)},
              ${cliente.link_pagamento || ""}, ${nivel.tipo}, ${""},
              'pulado', ${"Condicional não atendido: " + nivel.condicional},
              ${executadoPor}, ${execucaoId}
            )
          `);
          continue;
        }
      }

      const numero = normalizarNumero(cliente.telefone);
      const mensagem = formatarMensagem(template, cliente);

      const resultado = await enviarMensagemWhatsApp(numero, mensagem, nivel.instancia);

      if (resultado.success) {
        enviados++;
        await db.execute(sql`
          INSERT INTO cortex_core.turbozap_envios (
            id_cliente, cliente_nome, cnpj, telefone,
            data_vencimento, valor, link_pagamento,
            tipo_cobranca, mensagem_enviada, status,
            executado_por, execucao_id
          ) VALUES (
            ${cliente.id_cliente}, ${cliente.cliente_nome}, ${cliente.cnpj || ""},
            ${cliente.telefone}, ${cliente.data_vencimento}, ${Number(cliente.total)},
            ${cliente.link_pagamento || ""}, ${nivel.tipo}, ${mensagem},
            'enviado', ${executadoPor}, ${execucaoId}
          )
        `);

        // Auto-create pipeline record when D+30 is sent
        if (nivel.tipo === "D+30") {
          await db.execute(sql`
            INSERT INTO cortex_core.turbozap_pipeline_juridico (cnpj, cliente_nome, data_vencimento, valor, etapa)
            VALUES (${cliente.cnpj || ""}, ${cliente.cliente_nome}, ${cliente.data_vencimento}, ${Number(cliente.total)}, 'formalizado')
            ON CONFLICT (cnpj, data_vencimento) DO NOTHING
          `);
        }
      } else {
        erros++;
        await db.execute(sql`
          INSERT INTO cortex_core.turbozap_envios (
            id_cliente, cliente_nome, cnpj, telefone,
            data_vencimento, valor, link_pagamento,
            tipo_cobranca, mensagem_enviada, status, erro_detalhe,
            executado_por, execucao_id
          ) VALUES (
            ${cliente.id_cliente}, ${cliente.cliente_nome}, ${cliente.cnpj || ""},
            ${cliente.telefone}, ${cliente.data_vencimento}, ${Number(cliente.total)},
            ${cliente.link_pagamento || ""}, ${nivel.tipo}, ${mensagem},
            'erro', ${resultado.error || "Erro desconhecido"},
            ${executadoPor}, ${execucaoId}
          )
        `);
      }

      // Random delay between sends
      const delay = Math.random() * (delayMax - delayMin) + delayMin;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { execucaoId, enviados, erros, pulados };
}

// ============================================
// Histórico
// ============================================

export async function getHistorico(filters: {
  data_inicio?: string;
  data_fim?: string;
  tipo_cobranca?: string;
  status?: string;
  busca?: string;
}): Promise<EnvioRegistro[]> {
  const conditions: string[] = ["1=1"];

  if (filters.data_inicio) {
    const val = filters.data_inicio.replace(/'/g, "''");
    conditions.push(`e.criado_em >= '${val}'::date`);
  }
  if (filters.data_fim) {
    const val = filters.data_fim.replace(/'/g, "''");
    conditions.push(`e.criado_em < ('${val}'::date + interval '1 day')`);
  }
  if (filters.tipo_cobranca && filters.tipo_cobranca !== "todos") {
    const val = filters.tipo_cobranca.replace(/'/g, "''");
    conditions.push(`e.tipo_cobranca = '${val}'`);
  }
  if (filters.status && filters.status !== "todos") {
    const val = filters.status.replace(/'/g, "''");
    conditions.push(`e.status = '${val}'`);
  }
  if (filters.busca) {
    const val = filters.busca.replace(/'/g, "''");
    conditions.push(`(e.cliente_nome ILIKE '%${val}%' OR e.cnpj ILIKE '%${val}%' OR e.telefone ILIKE '%${val}%')`);
  }

  const whereClause = conditions.join(" AND ");
  const result = await db.execute(
    sql.raw(`
      SELECT * FROM cortex_core.turbozap_envios e
      WHERE ${whereClause}
      ORDER BY e.criado_em DESC
      LIMIT 500
    `),
  );
  return result.rows as EnvioRegistro[];
}

// ============================================
// Stats
// ============================================

export async function getStats(): Promise<TurboZapStats> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'enviado' AND criado_em::date = CURRENT_DATE) AS enviados_hoje,
      COUNT(*) FILTER (WHERE status = 'enviado' AND criado_em >= DATE_TRUNC('month', CURRENT_DATE)) AS enviados_mes,
      COUNT(*) FILTER (WHERE status = 'erro' AND criado_em::date = CURRENT_DATE) AS erros_hoje,
      COUNT(*) FILTER (WHERE criado_em >= DATE_TRUNC('month', CURRENT_DATE)) AS total_mes,
      COUNT(*) FILTER (WHERE status = 'enviado' AND criado_em >= DATE_TRUNC('month', CURRENT_DATE)) AS sucesso_mes
    FROM cortex_core.turbozap_envios
  `);

  const row = result.rows[0] as any;
  const totalMes = Number(row?.total_mes) || 0;
  const sucessoMes = Number(row?.sucesso_mes) || 0;

  return {
    enviados_hoje: Number(row?.enviados_hoje) || 0,
    enviados_mes: Number(row?.enviados_mes) || 0,
    erros_hoje: Number(row?.erros_hoje) || 0,
    taxa_sucesso: totalMes > 0 ? Math.round((sucessoMes / totalMes) * 100) : 100,
  };
}

// ============================================
// Configurações CRUD
// ============================================

export async function getConfiguracoes(): Promise<TurboZapConfiguracao[]> {
  const result = await db.execute(sql`
    SELECT * FROM cortex_core.turbozap_configuracoes ORDER BY chave
  `);
  return result.rows as TurboZapConfiguracao[];
}

export async function updateConfiguracao(
  chave: string,
  valor: string,
  atualizadoPor: string,
): Promise<TurboZapConfiguracao> {
  const result = await db.execute(sql`
    UPDATE cortex_core.turbozap_configuracoes
    SET valor = ${valor}, atualizado_por = ${atualizadoPor}, atualizado_em = NOW()
    WHERE chave = ${chave}
    RETURNING *
  `);
  if (result.rows.length === 0) {
    throw new Error(`Configuração '${chave}' não encontrada`);
  }
  return result.rows[0] as TurboZapConfiguracao;
}
