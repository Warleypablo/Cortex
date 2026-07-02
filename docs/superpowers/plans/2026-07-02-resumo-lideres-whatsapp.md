# Resumo Diário de Métricas para Líderes (WhatsApp) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Job no backend do Cortex que todo dia útil às 10h (America/Sao_Paulo) calcula as métricas do mês corrente e envia a mensagem "Bom dia líderes!!!" via Evolution API.

**Architecture:** Serviço novo `server/services/resumoLideres.ts` (cálculo + formatação pura + envio idempotente), rotas de preview/disparo manual, job `setInterval` em `server/index.ts` (padrão dos jobs existentes). Reusa `getMrrAtivo`/`getMrrInicioMes`/`getVendasMrrBreakdown` do `server/okr2026/metricsAdapter.ts` e `enviarMensagemWhatsApp` do `server/services/turbozap.ts`.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`...\`)`), vitest, Evolution API.

**Spec:** `docs/superpowers/specs/2026-07-02-resumo-lideres-whatsapp-design.md`

## Global Constraints

- Percentuais **exatos com 2 casas** (`14,37%`, `9,03%`) — nunca arredondar para inteiro.
- Moeda pt-BR: `R$ 1.150.674,00`.
- Mensagem NUNCA sai com métricas parciais: `mrrAtivo <= 0` ou `mrrInicioMes <= 0` → abortar com erro (metricsAdapter engole erros retornando 0).
- Idempotência: no máximo 1 envio `status='ok'` por `data_ref` (dia em São Paulo), salvo `force`.
- Commits na `main` direto (autorizado por Ichino), Conventional Commits, co-author `Claude Fable 5`.
- NUNCA commitar o CSV solto na raiz (`2026-06-30T23_28_18.120Z Turbo Partners 2 0.csv`) — stage sempre por caminho explícito, nunca `git add -A`.
- Validação local: `npx tsc --noEmit` + `npm test`. NÃO matar a porta 3000 em subagentes (só a sessão principal reinicia o dev server).

---

### Task 1: Formatador puro + tipos + helper de timezone (TDD)

**Files:**
- Create: `server/services/resumoLideres.ts`
- Test: `server/services/resumoLideres.test.ts`

**Interfaces:**
- Produces: `interface MetricasResumo`, `formatarMoedaBR(valor: number): string`, `formatarPercentBR(valor: number): string`, `formatarMensagemResumo(m: MetricasResumo, agora: { dataFmt: string; horaFmt: string }): string`, `agoraSaoPaulo(date?: Date): { dataRef: string; dataFmt: string; hora: number; horaFmt: string; diaSemana: number }`

- [ ] **Step 1: Write the failing test**

```typescript
// server/services/resumoLideres.test.ts
import { describe, it, expect } from "vitest";
import {
  formatarMoedaBR,
  formatarPercentBR,
  formatarMensagemResumo,
  agoraSaoPaulo,
  type MetricasResumo,
} from "./resumoLideres";

// Números da mensagem real de 25/06 (base % = MRR início de junho R$ 1.030.229,30)
const METRICAS: MetricasResumo = {
  mrrAtivo: 1150674,
  entregaPontual: 218584.45,
  churn: 148077,
  churnPct: (148077 / 1030229.3) * 100, // 14,37%
  emCancelamento: 111524,
  crossR: 43947,
  crossP: 55455,
  crossPAmortizado: 11091,
  crossTotal: 55038,
  netChurn: 93039,
  netChurnPct: (93039 / 1030229.3) * 100, // 9,03%
  mrrInicioMes: 1030229.3,
};

const MENSAGEM_ESPERADA = `Bom dia líderes!!!
Atualizações sobre nossas métricas principais, dia 25/06, 10h.

MRR: R$ 1.150.674,00
Entrega Pontual: R$ 218.584,45

Churn: R$ 148.077,00 - *14,37%*
Em cancelamento: R$ 111.524,00

Cross R: R$ 43.947,00
Cross P: R$ 55.455,00 / 5 = R$ 11.091,00
Total: R$ 43.947,00 + R$ 11.091,00 = R$ 55.038,00

Net Churn: R$ 93.039,00 - *9,03%*

*OBS 1: Bora buscar mais cross*
*OBS 2: Bora reter*
*OBS 3: Não sai mais ninguém*`;

describe("formatarMoedaBR", () => {
  it("formata inteiro com milhares e 2 casas", () => {
    expect(formatarMoedaBR(1150674)).toBe("R$ 1.150.674,00");
  });
  it("preserva centavos", () => {
    expect(formatarMoedaBR(218584.45)).toBe("R$ 218.584,45");
  });
});

describe("formatarPercentBR", () => {
  it("2 casas exatas, sem arredondar para inteiro", () => {
    expect(formatarPercentBR((93039 / 1030229.3) * 100)).toBe("9,03%");
    expect(formatarPercentBR((148077 / 1030229.3) * 100)).toBe("14,37%");
  });
});

describe("formatarMensagemResumo", () => {
  it("reproduz a mensagem real de 25/06 exatamente", () => {
    const msg = formatarMensagemResumo(METRICAS, { dataFmt: "25/06", horaFmt: "10h" });
    expect(msg).toBe(MENSAGEM_ESPERADA);
  });
});

describe("agoraSaoPaulo", () => {
  it("converte UTC para São Paulo (UTC-3)", () => {
    // 2026-06-25 13:00 UTC = 10:00 em São Paulo (quinta-feira)
    const sp = agoraSaoPaulo(new Date("2026-06-25T13:00:00Z"));
    expect(sp).toEqual({
      dataRef: "2026-06-25",
      dataFmt: "25/06",
      hora: 10,
      horaFmt: "10h",
      diaSemana: 4,
    });
  });
  it("vira o dia corretamente (23h UTC = 20h SP do mesmo dia; 02h UTC = 23h SP do dia anterior)", () => {
    expect(agoraSaoPaulo(new Date("2026-07-02T02:00:00Z")).dataRef).toBe("2026-07-01");
    expect(agoraSaoPaulo(new Date("2026-07-02T02:00:00Z")).hora).toBe(23);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mac0267/Cortex && npx vitest run server/services/resumoLideres.test.ts`
Expected: FAIL — "Cannot find module './resumoLideres'" (ou equivalente).

- [ ] **Step 3: Write minimal implementation**

```typescript
// server/services/resumoLideres.ts
// Resumo diário de métricas para líderes via WhatsApp.
// Spec: docs/superpowers/specs/2026-07-02-resumo-lideres-whatsapp-design.md

export interface MetricasResumo {
  mrrAtivo: number;
  entregaPontual: number;
  churn: number;
  churnPct: number; // 0-100
  emCancelamento: number;
  crossR: number;
  crossP: number; // pontual bruto
  crossPAmortizado: number; // crossP / 5
  crossTotal: number; // crossR + crossPAmortizado
  netChurn: number; // churn - crossTotal
  netChurnPct: number; // 0-100
  mrrInicioMes: number;
}

export function formatarMoedaBR(valor: number): string {
  return (
    "R$ " +
    valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function formatarPercentBR(valor: number): string {
  return (
    valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
  );
}

export function formatarMensagemResumo(
  m: MetricasResumo,
  agora: { dataFmt: string; horaFmt: string },
): string {
  return `Bom dia líderes!!!
Atualizações sobre nossas métricas principais, dia ${agora.dataFmt}, ${agora.horaFmt}.

MRR: ${formatarMoedaBR(m.mrrAtivo)}
Entrega Pontual: ${formatarMoedaBR(m.entregaPontual)}

Churn: ${formatarMoedaBR(m.churn)} - *${formatarPercentBR(m.churnPct)}*
Em cancelamento: ${formatarMoedaBR(m.emCancelamento)}

Cross R: ${formatarMoedaBR(m.crossR)}
Cross P: ${formatarMoedaBR(m.crossP)} / 5 = ${formatarMoedaBR(m.crossPAmortizado)}
Total: ${formatarMoedaBR(m.crossR)} + ${formatarMoedaBR(m.crossPAmortizado)} = ${formatarMoedaBR(m.crossTotal)}

Net Churn: ${formatarMoedaBR(m.netChurn)} - *${formatarPercentBR(m.netChurnPct)}*

*OBS 1: Bora buscar mais cross*
*OBS 2: Bora reter*
*OBS 3: Não sai mais ninguém*`;
}

export function agoraSaoPaulo(date: Date = new Date()): {
  dataRef: string;
  dataFmt: string;
  hora: number;
  horaFmt: string;
  diaSemana: number; // 0=dom ... 6=sáb
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hora = parseInt(get("hour"), 10) % 24; // hour12:false pode devolver "24" à meia-noite
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(date);
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    dataRef: `${get("year")}-${get("month")}-${get("day")}`,
    dataFmt: `${get("day")}/${get("month")}`,
    hora,
    horaFmt: `${hora}h`,
    diaSemana: weekdayMap[weekday] ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/mac0267/Cortex && npx vitest run server/services/resumoLideres.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
cd /Users/mac0267/Cortex
git add server/services/resumoLideres.ts server/services/resumoLideres.test.ts
git commit -m "feat(resumo-lideres): formatador da mensagem diária de métricas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

### Task 2: Cálculo das métricas

**Files:**
- Modify: `server/services/resumoLideres.ts` (append)

**Interfaces:**
- Consumes: `getMrrAtivo()`, `getMrrInicioMes()`, `getVendasMrrBreakdown()` de `server/okr2026/metricsAdapter.ts`; `db`, `sql` de `server/db.ts` / `drizzle-orm`.
- Produces: `calcularMetricasResumo(): Promise<MetricasResumo>` — lança `Error` se `mrrAtivo <= 0` ou `mrrInicioMes <= 0`.

- [ ] **Step 1: Adicionar imports no topo do arquivo**

```typescript
// no topo de server/services/resumoLideres.ts
import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  getMrrAtivo,
  getMrrInicioMes,
  getVendasMrrBreakdown,
} from "../okr2026/metricsAdapter";
```

- [ ] **Step 2: Implementar as queries e a agregação (append no arquivo)**

```typescript
// ============================================
// Cálculo das métricas (mês corrente em America/Sao_Paulo)
// ============================================

async function getChurnMesBruto(): Promise<number> {
  // Churn BRUTO (inclui abonados) — alinhado ao card do ClickUp
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(valor_r), 0) AS churn
    FROM "Clickup".cup_churn
    WHERE data_solicitacao_encerramento >= date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo'))::date
      AND data_solicitacao_encerramento < (date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 month')::date
  `);
  return parseFloat((result.rows[0] as any)?.churn || "0");
}

async function getEmCancelamento(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(valorr), 0) AS total
    FROM "Clickup".cup_contratos
    WHERE status = 'em cancelamento' AND valorr > 0
  `);
  return parseFloat((result.rows[0] as any)?.total || "0");
}

async function getEntregaPontualMes(): Promise<number> {
  // Contratos que PASSARAM a 'entregue' no mês: live = 'entregue' e no snapshot
  // do dia 1º não era 'entregue' (ou nem existia — criado e entregue no mês).
  const result = await db.execute(sql`
    WITH primeiro_snapshot AS (
      SELECT MIN(data_snapshot) AS d
      FROM "Clickup".cup_data_hist
      WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')
    )
    SELECT COALESCE(SUM(c.valorp), 0) AS total
    FROM "Clickup".cup_contratos c
    LEFT JOIN "Clickup".cup_data_hist h
      ON h.id_subtask = c.id_subtask
     AND h.data_snapshot = (SELECT d FROM primeiro_snapshot)
    WHERE c.status = 'entregue'
      AND c.valorp > 0
      AND (h.id_subtask IS NULL OR h.status <> 'entregue')
  `);
  return parseFloat((result.rows[0] as any)?.total || "0");
}

export async function calcularMetricasResumo(): Promise<MetricasResumo> {
  const [mrrAtivo, mrrInicioMes, breakdown, churn, emCancelamento, entregaPontual] =
    await Promise.all([
      getMrrAtivo(),
      getMrrInicioMes(),
      getVendasMrrBreakdown(),
      getChurnMesBruto(),
      getEmCancelamento(),
      getEntregaPontualMes(),
    ]);

  // metricsAdapter engole erros retornando 0 — nunca enviar mensagem com métricas parciais
  if (mrrAtivo <= 0 || mrrInicioMes <= 0) {
    throw new Error(
      `Métricas base inválidas (mrrAtivo=${mrrAtivo}, mrrInicioMes=${mrrInicioMes}) — envio abortado`,
    );
  }

  const crossR = breakdown.crosssell;
  const crossP = breakdown.crosssell_pontual;
  const crossPAmortizado = crossP / 5;
  const crossTotal = crossR + crossPAmortizado;
  const netChurn = churn - crossTotal;

  return {
    mrrAtivo,
    entregaPontual,
    churn,
    churnPct: (churn / mrrInicioMes) * 100,
    emCancelamento,
    crossR,
    crossP,
    crossPAmortizado,
    crossTotal,
    netChurn,
    netChurnPct: (netChurn / mrrInicioMes) * 100,
    mrrInicioMes,
  };
}
```

- [ ] **Step 3: Typecheck + testes existentes**

Run: `cd /Users/mac0267/Cortex && npx tsc --noEmit && npx vitest run server/services/resumoLideres.test.ts`
Expected: sem erros de tipo; testes PASS.

- [ ] **Step 4: Validar contra o banco local (smoke test)**

```bash
cd /Users/mac0267/Cortex && npx tsx -e "
import { calcularMetricasResumo, formatarMensagemResumo, agoraSaoPaulo } from './server/services/resumoLideres';
calcularMetricasResumo().then((m) => {
  console.log(JSON.stringify(m, null, 2));
  console.log('---');
  console.log(formatarMensagemResumo(m, agoraSaoPaulo()));
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
"
```
Expected: JSON com métricas plausíveis (MRR ~1,1M+) e mensagem formatada. Banco local pode estar defasado vs prod — valores diferentes de prod são esperados; o que valida aqui é a query rodar e o shape ser correto.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac0267/Cortex
git add server/services/resumoLideres.ts
git commit -m "feat(resumo-lideres): cálculo das métricas do mês (MRR, churn, cross, entrega pontual)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

### Task 3: Idempotência + envio via Evolution API

**Files:**
- Modify: `server/services/resumoLideres.ts` (append)
- Modify: `shared/schema.ts` (append — definição Drizzle p/ documentação do schema)

**Interfaces:**
- Consumes: `enviarMensagemWhatsApp(numero, texto, instancia)` de `server/services/turbozap.ts`; `cortexCoreSchema` de `shared/schema.ts:7`.
- Produces: `initResumoLideresTable(): Promise<void>`, `enviarResumoLideres(opts?: { force?: boolean }): Promise<{ success: boolean; skipped?: boolean; mensagem?: string; error?: string }>`.
- Env: `RESUMO_LIDERES_DESTINO` (obrigatória p/ enviar), `RESUMO_LIDERES_INSTANCIA` (`financeiro` default | `juridico`).

- [ ] **Step 1: Adicionar import do turbozap no topo do arquivo**

```typescript
import { enviarMensagemWhatsApp } from "./turbozap";
```

- [ ] **Step 2: Implementar tabela, idempotência e envio (append)**

```typescript
// ============================================
// Idempotência + envio
// ============================================

export async function initResumoLideresTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.resumo_lideres_envios (
      id SERIAL PRIMARY KEY,
      data_ref DATE NOT NULL,
      destino TEXT,
      mensagem TEXT,
      status TEXT NOT NULL DEFAULT 'ok',
      erro TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function jaEnviadoHoje(dataRef: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM cortex_core.resumo_lideres_envios
    WHERE data_ref = ${dataRef} AND status = 'ok'
    LIMIT 1
  `);
  return result.rows.length > 0;
}

async function registrarEnvio(
  dataRef: string,
  destino: string,
  mensagem: string,
  status: "ok" | "erro",
  erro?: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.resumo_lideres_envios (data_ref, destino, mensagem, status, erro)
    VALUES (${dataRef}, ${destino}, ${mensagem}, ${status}, ${erro ?? null})
  `);
}

export async function enviarResumoLideres(
  opts: { force?: boolean } = {},
): Promise<{ success: boolean; skipped?: boolean; mensagem?: string; error?: string }> {
  const destino = process.env.RESUMO_LIDERES_DESTINO;
  if (!destino) {
    return { success: false, error: "RESUMO_LIDERES_DESTINO não configurado" };
  }

  const sp = agoraSaoPaulo();
  if (!opts.force && (await jaEnviadoHoje(sp.dataRef))) {
    return { success: true, skipped: true };
  }

  let mensagem: string;
  try {
    const metricas = await calcularMetricasResumo();
    mensagem = formatarMensagemResumo(metricas, sp);
  } catch (err: any) {
    // Falha de cálculo NÃO registra 'erro' com mensagem vazia — só loga e retorna
    console.error("[resumo-lideres] Falha ao calcular métricas:", err.message);
    return { success: false, error: err.message };
  }

  const instancia: "financeiro" | "juridico" =
    process.env.RESUMO_LIDERES_INSTANCIA === "juridico" ? "juridico" : "financeiro";
  const resultado = await enviarMensagemWhatsApp(destino, mensagem, instancia);

  await registrarEnvio(
    sp.dataRef,
    destino,
    mensagem,
    resultado.success ? "ok" : "erro",
    resultado.error,
  );

  if (!resultado.success) {
    console.error("[resumo-lideres] Falha no envio:", resultado.error);
    return { success: false, error: resultado.error, mensagem };
  }
  return { success: true, mensagem };
}
```

- [ ] **Step 3: Definição Drizzle em `shared/schema.ts` (append no fim do arquivo)**

```typescript
// Resumo diário de métricas para líderes via WhatsApp (idempotência de envio)
export const resumoLideresEnvios = cortexCoreSchema.table("resumo_lideres_envios", {
  id: serial("id").primaryKey(),
  dataRef: date("data_ref").notNull(),
  destino: text("destino"),
  mensagem: text("mensagem"),
  status: text("status").notNull().default("ok"),
  erro: text("erro"),
  criadoEm: timestamp("criado_em").defaultNow(),
});
```

(Conferir que `serial`, `date`, `text`, `timestamp` já estão importados de `drizzle-orm/pg-core` no topo do arquivo — se algum faltar, adicionar ao import existente.)

- [ ] **Step 4: Typecheck + criar tabela no banco local**

Run: `cd /Users/mac0267/Cortex && npx tsc --noEmit`
Expected: sem erros.

```bash
cd /Users/mac0267/Cortex && npx tsx -e "
import { initResumoLideresTable } from './server/services/resumoLideres';
initResumoLideresTable().then(() => { console.log('tabela ok'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
"
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "\\d cortex_core.resumo_lideres_envios"
```
Expected: `tabela ok` e a descrição da tabela com as 7 colunas.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac0267/Cortex
git add server/services/resumoLideres.ts shared/schema.ts
git commit -m "feat(resumo-lideres): envio idempotente via Evolution API + tabela de log

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

### Task 4: Endpoints de preview e disparo manual

**Files:**
- Create: `server/routes/resumoLideres.ts`
- Modify: `server/routes.ts` (import no topo junto do turbozap `server/routes.ts:50`; registro junto de `registerTurboZapRoutes` em `server/routes.ts:8513-8514`)

**Interfaces:**
- Consumes: `calcularMetricasResumo`, `formatarMensagemResumo`, `agoraSaoPaulo`, `enviarResumoLideres`, `initResumoLideresTable` de `../services/resumoLideres`.
- Produces: `registerResumoLideresRoutes(app: Express)` — `GET /api/resumo-lideres/preview` → `{ metricas, mensagem }`; `POST /api/resumo-lideres/enviar` (body `{ force?: boolean }`) → resultado do envio.

- [ ] **Step 1: Criar `server/routes/resumoLideres.ts`**

```typescript
import type { Express } from "express";
import {
  calcularMetricasResumo,
  formatarMensagemResumo,
  agoraSaoPaulo,
  enviarResumoLideres,
} from "../services/resumoLideres";

export function registerResumoLideresRoutes(app: Express) {
  // GET /api/resumo-lideres/preview - mensagem formatada sem enviar
  app.get("/api/resumo-lideres/preview", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const metricas = await calcularMetricasResumo();
      const mensagem = formatarMensagemResumo(metricas, agoraSaoPaulo());
      res.json({ metricas, mensagem });
    } catch (error: any) {
      console.error("[resumo-lideres] Error preview:", error);
      res.status(500).json({ message: error.message || "Erro ao gerar preview" });
    }
  });

  // POST /api/resumo-lideres/enviar - dispara o envio agora ({ force: true } reenvia)
  app.post("/api/resumo-lideres/enviar", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const resultado = await enviarResumoLideres({ force: req.body?.force === true });
      if (!resultado.success) return res.status(500).json(resultado);
      res.json(resultado);
    } catch (error: any) {
      console.error("[resumo-lideres] Error enviar:", error);
      res.status(500).json({ message: error.message || "Erro ao enviar" });
    }
  });
}
```

- [ ] **Step 2: Registrar em `server/routes.ts`**

Junto ao import do turbozap (linha ~50):

```typescript
import { registerResumoLideresRoutes } from "./routes/resumoLideres";
import { initResumoLideresTable } from "./services/resumoLideres";
```

Junto ao registro do turbozap (linhas ~8513-8514):

```typescript
  registerResumoLideresRoutes(app);
  initResumoLideresTable().catch((err) => console.error("[resumo-lideres] Init error:", err));
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/mac0267/Cortex && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Testar no dev server (sessão principal, NÃO subagente)**

```bash
lsof -ti:3000 | xargs kill -9; cd /Users/mac0267/Cortex && npm run dev &
sleep 8 && curl -s http://localhost:3000/api/resumo-lideres/preview
```
Expected: `{"message":"Não autenticado"}` (401) — rota registrada e protegida. Preview autenticado é validado no browser (sessão logada) na Task 6.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac0267/Cortex
git add server/routes/resumoLideres.ts server/routes.ts
git commit -m "feat(resumo-lideres): endpoints de preview e disparo manual

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

### Task 5: Job agendado + variáveis de ambiente

**Files:**
- Modify: `server/index.ts` (novo bloco de job, após o bloco do `runBitrixDealsSync` que termina em `server/index.ts:731`)
- Modify: `.env` (local — job desligado)

**Interfaces:**
- Consumes: `agoraSaoPaulo`, `enviarResumoLideres` de `./services/resumoLideres` (import dinâmico, padrão dos jobs).
- Env: `RESUMO_LIDERES_ATIVO` (`true` liga o job; local fica `false` para o dev server não disparar envio).

- [ ] **Step 1: Adicionar bloco do job em `server/index.ts` (após linha 731)**

```typescript
  // Resumo diário de métricas para líderes via WhatsApp — dias úteis, 10h São Paulo.
  // Janela 10h-12h: se o envio das 10h falhar, os ticks seguintes tentam de novo;
  // idempotência (cortex_core.resumo_lideres_envios) garante no máximo 1 envio/dia.
  const RESUMO_LIDERES_CHECK_INTERVAL = 5 * 60 * 1000; // 5min
  const runResumoLideresJob = async () => {
    try {
      if (process.env.RESUMO_LIDERES_ATIVO !== "true") return;
      const { agoraSaoPaulo, enviarResumoLideres } = await import("./services/resumoLideres");
      const sp = agoraSaoPaulo();
      const diaUtil = sp.diaSemana >= 1 && sp.diaSemana <= 5;
      if (!diaUtil || sp.hora < 10 || sp.hora >= 12) return;
      const resultado = await enviarResumoLideres();
      if (resultado.skipped) return;
      if (resultado.success) {
        console.log("[resumo-lideres-job] Resumo enviado com sucesso");
      } else {
        console.error(`[resumo-lideres-job] Falha (retry no próximo tick): ${resultado.error}`);
      }
    } catch (err: any) {
      console.error("[resumo-lideres-job] Erro:", err.message);
    }
  };
  setTimeout(() => runResumoLideresJob(), 60000); // 1min após boot
  setInterval(() => runResumoLideresJob(), RESUMO_LIDERES_CHECK_INTERVAL);
  console.log("[resumo-lideres-job] Scheduled every 5min (envia dias úteis ~10h America/Sao_Paulo)");
```

- [ ] **Step 2: Adicionar variáveis no `.env` local (append, junto das EVOLUTION_* linhas 41-44)**

```bash
# Resumo diário de métricas p/ líderes (WhatsApp). Local: job DESLIGADO (envio só manual via POST)
RESUMO_LIDERES_ATIVO=false
RESUMO_LIDERES_DESTINO=
RESUMO_LIDERES_INSTANCIA=financeiro
```

- [ ] **Step 3: Typecheck + boot do dev server**

Run: `cd /Users/mac0267/Cortex && npx tsc --noEmit`
Expected: sem erros.

```bash
lsof -ti:3000 | xargs kill -9; cd /Users/mac0267/Cortex && npm run dev &
sleep 8
```
Expected: log de boot contém `[resumo-lideres-job] Scheduled every 5min`.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac0267/Cortex
git add server/index.ts
git commit -m "feat(resumo-lideres): job diário 10h (dias úteis, America/Sao_Paulo)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

(`.env` é gitignored — não entra no commit.)

---

### Task 6: Produção — tabela, env vars e teste real

**Files:** nenhum arquivo de código; operações em prod + validação manual.

**Interfaces:**
- Consumes: credenciais prod (host 34.95.249.110, db dados_turbo, senha no bloco `# DB_PASSWORD=` do `.env` raiz); ambiente de deploy do server de prod (onde as env vars de runtime são configuradas).

- [ ] **Step 1: Criar a tabela em PROD** (regra do projeto: mudança de schema aplica em local E prod)

```bash
cd /Users/mac0267/Cortex
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
CREATE TABLE IF NOT EXISTS cortex_core.resumo_lideres_envios (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  destino TEXT,
  mensagem TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  erro TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);"
```
Expected: `CREATE TABLE`.

- [ ] **Step 2: Configurar env vars no ambiente de PROD**

No ambiente onde o server de produção roda, definir:
```
RESUMO_LIDERES_ATIVO=true
RESUMO_LIDERES_DESTINO=<número do Ichino com DDI+DDD, só dígitos — ex: 5531999999999>
RESUMO_LIDERES_INSTANCIA=financeiro
```
**BLOQUEIO CONHECIDO:** o número de teste ainda não foi informado — pedir ao usuário. Enquanto `RESUMO_LIDERES_DESTINO` estiver vazio o job loga erro e não envia nada (comportamento seguro).

- [ ] **Step 3: Teste real de envio (local, manual, destino = número de teste)**

Com o número no `.env` local (`RESUMO_LIDERES_DESTINO=...`) e dev server rodando, no browser logado em `localhost:3000` abrir `/api/resumo-lideres/preview` e conferir a mensagem. Depois disparar:

```bash
# via browser/console logado (cookie de sessão):
fetch("/api/resumo-lideres/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) }).then(r => r.json()).then(console.log)
```
Expected: `{ success: true, mensagem: "Bom dia líderes!!!..." }` e a mensagem chegando no WhatsApp do número de teste. Conferir registro: `SELECT * FROM cortex_core.resumo_lideres_envios ORDER BY id DESC LIMIT 1;` (local).

**Atenção:** o teste local usa a instância financeiro REAL da Evolution API — a mensagem sai do número oficial. Conferir `dry_run` da configuração do TurboZap se quiser ensaiar sem enviar.

- [ ] **Step 4: Validar números vs mensagem manual do time**

Nos primeiros dias, comparar a mensagem automática com a manual. Desvios esperados: registros retroativos no ClickUp/Bitrix (documentado na spec).

---

## Self-review (feito na escrita)

- **Cobertura da spec:** métricas (Task 2), formato/2 casas (Task 1), idempotência+tabela (Task 3), endpoints (Task 4), job+env (Task 5), prod+validação real (Task 6). Feriados/UI/multi-destino: fora de escopo (spec).
- **Sem placeholders:** todo step tem código/comando completo.
- **Consistência de tipos:** `MetricasResumo` definido na Task 1 e consumido nas Tasks 2-4; assinatura `agora: { dataFmt, horaFmt }` consistente; `enviarResumoLideres` retorna `{ success, skipped?, mensagem?, error? }` nas Tasks 3-5.
