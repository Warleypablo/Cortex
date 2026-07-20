# Resumo dos Líderes v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o template da mensagem diária de líderes pelo modelo v3 (blocos temáticos com emojis) e implementar as cinco métricas novas e as três mudanças de régua aprovadas no spec.

**Architecture:** Todo o trabalho fica no server. `resumoLideres.ts` ganha uma query consolidada de carteira MRR e passa a consumir uma função nova de vendas novas do `metricsAdapter.ts`. A interface `MetricasResumo` é renomeada para bater com os rótulos exibidos, e `formatarMensagemResumo` — função pura, já coberta por testes de string — é reescrita sob TDD. O client não muda: ele só renderiza a string vinda de `/api/resumo-lideres/preview`.

**Tech Stack:** TypeScript, Drizzle ORM (`sql` template tags), PostgreSQL (Cloud SQL), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-20-resumo-lideres-novo-modelo-design.md`

## Global Constraints

- Branch de trabalho: `feature/resumo-lideres-v3` (já criada e no remoto). Não commitar em `main`.
- Toda moeda usa `formatarMoedaBR`; todo percentual usa `formatarPercentBR`. Nenhum valor formatado à mão.
- Percentuais de MRR sempre sobre `mrrMesAnterior`; percentuais de pontual sempre sobre `estoquePontualInicioMes`.
- `getMrrAtivo()` do `metricsAdapter.ts` **não pode ser alterado** — outras telas (OKR) dependem dele.
- A régua de cross-sell (`buildVendasMrrQuery`, `source = 'PARTNER'` + cliente pré-existente) **não pode ser alterada**.
- Schemas com espaço exigem aspas duplas: `"Clickup".cup_contratos`, `"Bitrix".crm_deal`.
- Rodar testes com `npx vitest run server/services/resumoLideres.test.ts`; typecheck com `npm run check`.
- Não subir dev server nem matar processos na porta 3000.

---

### Task 1: Queries das métricas novas

Adiciona as duas fontes de dados que hoje não existem, sem tocar na interface nem no template. Ao fim desta task o serviço continua produzindo a mensagem v2 e todos os testes atuais continuam passando — as funções novas ficam prontas mas ainda não consumidas.

**Files:**
- Modify: `server/okr2026/metricsAdapter.ts` (adicionar após `getCrosssellMrr`, ~linha 780)
- Modify: `server/services/resumoLideres.ts` (adicionar junto de `getMrrSoAtivo`, ~linha 158)
- Create: `scripts/validar-carteira-vendas-tmp.ts` (script descartável de verificação)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `getVendasNovasBreakdown(startDate?: string, endDate?: string): Promise<{ mrr: number; pontual: number }>` exportada de `server/okr2026/metricsAdapter.ts`
  - `getCarteiraMrr(): Promise<{ ativo: number; triagemOnboarding: number; emCancelamento: number; mrrAtivo: number; mrrOperando: number }>` — função de módulo (não exportada) em `server/services/resumoLideres.ts`

- [ ] **Step 1: Adicionar `getVendasNovasBreakdown` ao metricsAdapter**

Em `server/okr2026/metricsAdapter.ts`, logo depois da função `getCrosssellMrr`:

```ts
export interface VendasNovasBreakdown {
  mrr: number;
  pontual: number;
}

/**
 * Vendas NOVAS do período = deals ganhos de CNPJ sem contrato anterior ao mês do
 * fechamento (aquisição pura). Exclui cross-sell E upsell por construção: qualquer
 * venda para cliente pré-existente fica de fora.
 * Espelha a CTE cliente_inicio de buildVendasMrrQuery, invertendo o critério.
 */
export async function getVendasNovasBreakdown(
  startDate?: string,
  endDate?: string,
): Promise<VendasNovasBreakdown> {
  const dateFilter = (startDate && endDate)
    ? sql`d.data_fechamento >= ${startDate}::date AND d.data_fechamento <= ${endDate}::date`
    : sql`TO_CHAR(d.data_fechamento, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')`;

  try {
    const result = await db.execute(sql`
      WITH cliente_inicio AS (
        SELECT REGEXP_REPLACE(COALESCE(c.cnpj, ''), '[^0-9]', '', 'g') AS cnpj_norm,
               MIN(ct.data_inicio)::date AS primeiro_contrato
        FROM "Clickup".cup_clientes c
        JOIN "Clickup".cup_contratos ct ON ct.id_task = c.task_id
        WHERE COALESCE(c.cnpj, '') <> ''
        GROUP BY 1
      ),
      deals AS (
        SELECT
          d.valor_recorrente::numeric AS rec,
          d.valor_pontual::numeric AS pont,
          (ci.primeiro_contrato IS NULL
            OR ci.primeiro_contrato >= date_trunc('month', d.data_fechamento)::date) AS is_novo
        FROM "Bitrix".crm_deal d
        LEFT JOIN cliente_inicio ci
          ON REGEXP_REPLACE(COALESCE(d.cnpj, ''), '[^0-9]', '', 'g') = ci.cnpj_norm
        WHERE d.stage_name = 'Negócio Ganho'
          AND d.data_fechamento IS NOT NULL
          AND ${dateFilter}
      )
      SELECT
        COALESCE(SUM(rec) FILTER (WHERE is_novo), 0) AS mrr,
        COALESCE(SUM(pont) FILTER (WHERE is_novo), 0) AS pontual
      FROM deals`);
    const row = result.rows[0] as any;
    return {
      mrr: parseFloat(row?.mrr || "0"),
      pontual: parseFloat(row?.pontual || "0"),
    };
  } catch (error) {
    console.error("[OKR] Error fetching Vendas Novas Breakdown:", error);
    return { mrr: 0, pontual: 0 };
  }
}
```

- [ ] **Step 2: Adicionar `getCarteiraMrr` ao resumoLideres**

Em `server/services/resumoLideres.ts`, imediatamente após `getMrrSoAtivo`:

```ts
interface CarteiraMrr {
  ativo: number;              // status 'ativo'
  triagemOnboarding: number;  // status 'triagem' + 'onboarding'
  emCancelamento: number;     // status 'em cancelamento'
  mrrAtivo: number;           // triagem + onboarding + ativo
  mrrOperando: number;        // mrrAtivo + em cancelamento
}

/**
 * Carteira MRR ao vivo, nos quatro recortes do modelo v3, em uma query só.
 * 'pausado', 'entregue', 'excluído', 'não usar' e 'cancelado/inativo' ficam
 * fora de todos os recortes — ver spec 2026-07-20.
 */
async function getCarteiraMrr(): Promise<CarteiraMrr> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(valorr) FILTER (WHERE status = 'ativo'), 0) AS ativo,
      COALESCE(SUM(valorr) FILTER (WHERE status IN ('triagem', 'onboarding')), 0) AS triagem_onboarding,
      COALESCE(SUM(valorr) FILTER (WHERE status = 'em cancelamento'), 0) AS em_cancelamento
    FROM "Clickup".cup_contratos
  `);
  const row = result.rows[0] as any;
  const ativo = parseFloat(row?.ativo || "0");
  const triagemOnboarding = parseFloat(row?.triagem_onboarding || "0");
  const emCancelamento = parseFloat(row?.em_cancelamento || "0");
  const mrrAtivo = ativo + triagemOnboarding;
  return {
    ativo,
    triagemOnboarding,
    emCancelamento,
    mrrAtivo,
    mrrOperando: mrrAtivo + emCancelamento,
  };
}
```

- [ ] **Step 3: Escrever o script de verificação**

Criar `scripts/validar-carteira-vendas-tmp.ts`:

```ts
// Script descartável: confere as queries novas da Task 1 contra o banco local.
import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { getVendasNovasBreakdown, getVendasMrrBreakdown } from "../server/okr2026/metricsAdapter";

async function main() {
  const carteira = await db.execute(sql`
    SELECT
      COALESCE(SUM(valorr) FILTER (WHERE status = 'ativo'), 0) AS ativo,
      COALESCE(SUM(valorr) FILTER (WHERE status IN ('triagem', 'onboarding')), 0) AS triagem_onboarding,
      COALESCE(SUM(valorr) FILTER (WHERE status = 'em cancelamento'), 0) AS em_cancelamento
    FROM "Clickup".cup_contratos
  `);
  console.log("CARTEIRA:", carteira.rows[0]);

  const novas = await getVendasNovasBreakdown();
  const cross = await getVendasMrrBreakdown();
  console.log("VENDAS NOVAS:", novas);
  console.log("BREAKDOWN CROSS:", cross);
  console.log("novas.mrr + cross.crosssell <= cross.total ?", novas.mrr + cross.crosssell <= cross.total + 0.01);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Rodar o script e conferir**

Run: `npx tsx scripts/validar-carteira-vendas-tmp.ts`

Expected: imprime os três recortes da carteira com valores > 0 para `ativo` e `triagem_onboarding`, e a última linha imprime `true`. Se `novas.mrr + cross.crosssell` exceder `cross.total`, as duas réguas estão se sobrepondo e a query da Step 1 está errada — pare e investigue antes de seguir.

Conferir o recorte da carteira contra o SQL direto:

```bash
set -a && source .env && set +a && PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT status, ROUND(SUM(valorr)::numeric,2) FROM \"Clickup\".cup_contratos GROUP BY status ORDER BY 2 DESC NULLS LAST;"
```

Expected: os valores de `ativo`, `triagem`+`onboarding` e `em cancelamento` batem com o que o script imprimiu.

- [ ] **Step 5: Typecheck e testes existentes**

Run: `npm run check 2>&1 | grep -E "resumoLideres|metricsAdapter"`
Expected: sem saída (nenhum erro novo nesses arquivos).

Run: `npx vitest run server/services/resumoLideres.test.ts`
Expected: PASS — a v2 continua intacta nesta task.

- [ ] **Step 6: Commit**

```bash
git add server/okr2026/metricsAdapter.ts server/services/resumoLideres.ts
git commit -m "feat(resumo-lideres): queries de vendas novas e carteira MRR

Adiciona getVendasNovasBreakdown (aquisicao pura, exclui cross e upsell)
e getCarteiraMrr (ativo, triagem/onboarding, em cancelamento em uma query).
Ainda nao consumidas — o template v2 segue inalterado.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

O script `scripts/validar-carteira-vendas-tmp.ts` **não** entra no commit (é descartável).

---

### Task 2: Interface v3, fórmulas e template

Renomeia os campos, muda as três fórmulas e reescreve o template. Interface, consumidor e testes mudam juntos porque a renomeação os acopla — separá-los deixaria a árvore sem compilar entre commits.

**Files:**
- Modify: `server/services/resumoLideres.ts:15-39` (interface), `:44-47` (MESES), `:62-66` (saudacao), `:68-117` (template), `:251-306` (calcularMetricasResumo)
- Test: `server/services/resumoLideres.test.ts` (reescrita das fixtures e asserções)

**Interfaces:**
- Consumes: `getVendasNovasBreakdown()` e `getCarteiraMrr()` da Task 1.
- Produces: `MetricasResumo` v3 e `formatarMensagemResumo(m: MetricasResumo, agora: { dataFmt, horaFmt, hora, mes }): string` — assinatura inalterada, conteúdo novo.

- [ ] **Step 1: Reescrever a fixture e a mensagem esperada do teste**

Substituir em `server/services/resumoLideres.test.ts` o bloco `METRICAS` e `MENSAGEM_ESPERADA` (linhas 11 a 74) por:

```ts
// Números do modelo de referência de 18/07 (base % de MRR = MRR junho R$ 1.137.868;
// base % pontual = estoque pontual em aberto no início do mês R$ 2.090.519,35).
const METRICAS: MetricasResumo = {
  mrrAdicionado: 42310,
  pontualVendido: 118500,
  carteiraTriagemOnboarding: 150789.28,
  carteiraAtivo: 1069598,
  carteiraEmCancelamento: 96805,
  mrrAtivo: 1220387.28,
  mrrOperando: 1317192.28,
  entregaPontual: 169293.45,
  mrrMesAnterior: 1137868,
  estoquePontualInicioMes: 2090519.35,
  churnTotal: 67030,
  churnTotalPct: (67030 / 1137868) * 100, // 5,89%
  churnAjustado: 43314,
  churnAjustadoPct: (43314 / 1137868) * 100, // 3,81%
  churnPontual: 171272,
  churnPontualPct: (171272 / 2090519.35) * 100, // 8,19%
  churnPontualAjustado: 91973,
  churnPontualAjustadoPct: (91973 / 2090519.35) * 100, // 4,40%
  crossR: 5997,
  crossP: 10300,
  crossTotal: 16297, // sem amortização
  netChurn: 37317, // churnAjustado − crossR
  netChurnPct: (37317 / 1137868) * 100, // 3,28%
  netChurnBruto: 61033, // churnTotal − crossR
  netChurnBrutoPct: (61033 / 1137868) * 100, // 5,36%
  // Calculado mas não exibido na v3 (mantido para o payload de /preview)
  churnBrutoSemAbono: 55000,
  churnBrutoSemAbonoPct: (55000 / 1137868) * 100,
};

const MENSAGEM_ESPERADA = `☀️ Boa tarde, líderes!

Atualização das principais métricas
18/07 • 13h

━━━━━━━━━━━━━━━

💰 Receita (Julho)

Novas Vendas
📈 MRR Adicionado: R$ 42.310,00
📦 Pontual Vendido: R$ 118.500,00

📌 Considera apenas vendas novas (sem Cross Sell e Upsell).

Carteira MRR
🟡 Triagem / Onboarding: R$ 150.789,28
🟢 Ativo: R$ 1.069.598,00
🟠 Em Cancelamento: R$ 96.805,00

📌 MRR Ativo: R$ 1.220.387,28
🚀 MRR Operando: R$ 1.317.192,28

📦 Entrega Pontual: R$ 169.293,45

📌 MRR Base Junho: R$ 1.137.868,00

💡 Legenda
• MRR Ativo: Triagem + Onboarding + Ativo.
• MRR Operando: Todos os status, exceto Pausado e Cancelado.

━━━━━━━━━━━━━━━

📉 Churn

💰 MRR
🔴 Total: R$ 67.030,00 (5,89%)
🟢 Ajustado: R$ 43.314,00 (3,81%)

📦 Pontual
🔴 Total: R$ 171.272,00 (8,19%)
🟢 Ajustado: R$ 91.973,00 (4,40%)

━━━━━━━━━━━━━━━

🔄 Cross Sell

💰 MRR: R$ 5.997,00
📦 Pontual: R$ 10.300,00

🏆 Total: R$ 16.297,00

━━━━━━━━━━━━━━━

🎯 Net Churn (MRR)

🟢 Ajustado

Churn Ajustado: R$ 43.314,00
➖ Cross Sell: R$ 5.997,00
🟰 R$ 37.317,00 (3,28%)

🔴 Bruto

Churn Total: R$ 67.030,00
➖ Cross Sell: R$ 5.997,00
🟰 R$ 61.033,00 (5,36%)

━━━━━━━━━━━━━━━

💡 Disclaimers

• MRR Adicionado e Pontual Vendido consideram apenas vendas novas, sem Cross Sell e Upsell.
• Churn Ajustado desconsidera erro de venda, clientes que não iniciaram e inadimplência de até 1 mês.
• O percentual do Churn Pontual é calculado sobre o estoque pontual em aberto no início do mês (R$ 2.090.519,35).
• Net Churn = Churn − Cross Sell.
• MRR Ativo = Triagem + Onboarding + Ativo.
• MRR Operando = Todos os status, exceto Pausado e Cancelado.

👀 Seguimos acompanhando diariamente os indicadores e atuando rapidamente sobre os principais desvios.`;
```

**Nota sobre arredondamento:** o modelo de referência escreve o churn ajustado como `3,80%`, mas `43.314 ÷ 1.137.868 = 3,8066%`, que `formatarPercentBR` arredonda para `3,81%`. O teste usa o valor calculado. Não force `3,80%`.

- [ ] **Step 2: Reescrever os casos de teste do template**

Substituir o bloco `describe("formatarMensagemResumo", ...)` inteiro por:

```ts
describe("formatarMensagemResumo", () => {
  it("reproduz o modelo v3 de 18/07 13h exatamente", () => {
    const msg = formatarMensagemResumo(METRICAS, {
      dataFmt: "18/07",
      horaFmt: "13h",
      hora: 13,
      mes: 7,
    });
    expect(msg).toBe(MENSAGEM_ESPERADA);
  });

  it("saudação por faixa horária, com emoji", () => {
    const manha = formatarMensagemResumo(METRICAS, { dataFmt: "18/07", horaFmt: "9h", hora: 9, mes: 7 });
    expect(manha.startsWith("🌞 Bom dia, líderes!")).toBe(true);
    const tarde = formatarMensagemResumo(METRICAS, { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 });
    expect(tarde.startsWith("☀️ Boa tarde, líderes!")).toBe(true);
    const noite = formatarMensagemResumo(METRICAS, { dataFmt: "18/07", horaFmt: "20h", hora: 20, mes: 7 });
    expect(noite.startsWith("🌙 Boa noite, líderes!")).toBe(true);
  });

  it("cross sell zerado sai formatado, não como ZERO", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossR: 0, crossP: 0, crossTotal: 0 },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).toContain("💰 MRR: R$ 0,00\n📦 Pontual: R$ 0,00");
    expect(msg).not.toContain("ZERO");
  });

  it("não exibe a régua de abonos", () => {
    const msg = formatarMensagemResumo(METRICAS, { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 });
    expect(msg).not.toContain("sem abonos");
    expect(msg).not.toContain("abonado no mês");
  });

  it("virada de ano: mês base de janeiro é Dezembro", () => {
    const msg = formatarMensagemResumo(METRICAS, { dataFmt: "05/01", horaFmt: "9h", hora: 9, mes: 1 });
    expect(msg).toContain("💰 Receita (Janeiro)");
    expect(msg).toContain("📌 MRR Base Dezembro: R$ 1.137.868,00");
  });
});
```

E ajustar o `describe("formatarPercentBR", ...)` para as bases novas:

```ts
describe("formatarPercentBR", () => {
  it("2 casas exatas, sem arredondar para inteiro", () => {
    expect(formatarPercentBR((67030 / 1137868) * 100)).toBe("5,89%");
    expect(formatarPercentBR((37317 / 1137868) * 100)).toBe("3,28%");
    expect(formatarPercentBR((171272 / 2090519.35) * 100)).toBe("8,19%");
  });
});
```

- [ ] **Step 3: Rodar os testes para verificar que falham**

Run: `npx vitest run server/services/resumoLideres.test.ts`
Expected: FAIL — erros de tipo em `METRICAS` (propriedades `mrrAdicionado`, `carteiraAtivo`, `netChurnBruto` não existem em `MetricasResumo`; `mrrTotal` e `crossPAmortizado` faltando) e falha de asserção na comparação de string.

- [ ] **Step 4: Atualizar a interface `MetricasResumo`**

Substituir a interface (linhas 15-39) por:

```ts
export interface MetricasResumo {
  // Novas vendas (Bitrix, aquisição pura — sem cross sell e sem upsell)
  mrrAdicionado: number;
  pontualVendido: number;
  // Carteira MRR (cup_contratos ao vivo)
  carteiraTriagemOnboarding: number; // status 'triagem' + 'onboarding'
  carteiraAtivo: number; // status 'ativo'
  carteiraEmCancelamento: number; // status 'em cancelamento'
  mrrAtivo: number; // triagem + onboarding + ativo
  mrrOperando: number; // mrrAtivo + em cancelamento
  entregaPontual: number; // valorp dos contratos que viraram 'entregue' no mês
  // Bases dos percentuais
  mrrMesAnterior: number; // 1º snapshot do mês = fechamento do mês anterior
  estoquePontualInicioMes: number; // valorp em aberto no 1º snapshot do mês
  // Churn
  churnTotal: number; // valor_r bruto de cup_churn no mês
  churnTotalPct: number; // 0-100
  churnAjustado: number; // sem os motivos operacionais
  churnAjustadoPct: number; // 0-100
  churnPontual: number; // valorp dos contratos pontuais com pedido de churn no mês
  churnPontualPct: number; // 0-100
  churnPontualAjustado: number; // idem, sem os motivos operacionais
  churnPontualAjustadoPct: number; // 0-100
  // Cross sell (valores cheios — sem amortização desde a v3)
  crossR: number;
  crossP: number;
  crossTotal: number; // crossR + crossP
  // Net churn (subtrai apenas o cross sell de MRR)
  netChurn: number; // churnAjustado - crossR
  netChurnPct: number; // 0-100
  netChurnBruto: number; // churnTotal - crossR
  netChurnBrutoPct: number; // 0-100
  // Calculado e exposto em /preview, mas não exibido no texto v3
  churnBrutoSemAbono: number;
  churnBrutoSemAbonoPct: number;
}
```

- [ ] **Step 5: Atualizar MESES e saudacao**

Substituir a constante `MESES` (linhas 44-47):

```ts
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
```

E a função `saudacao` (linhas 62-66):

```ts
function saudacao(hora: number): string {
  if (hora < 12) return "🌞 Bom dia";
  if (hora < 18) return "☀️ Boa tarde";
  return "🌙 Boa noite";
}
```

- [ ] **Step 6: Reescrever o template**

Substituir o corpo de `formatarMensagemResumo` (o bloco de `const mes = ...` até o `return` final) por:

```ts
  const mes = MESES[agora.mes - 1];
  const mesAnterior = MESES[(agora.mes + 10) % 12];

  return `${saudacao(agora.hora)}, líderes!

Atualização das principais métricas
${agora.dataFmt} • ${agora.horaFmt}

━━━━━━━━━━━━━━━

💰 Receita (${mes})

Novas Vendas
📈 MRR Adicionado: ${formatarMoedaBR(m.mrrAdicionado)}
📦 Pontual Vendido: ${formatarMoedaBR(m.pontualVendido)}

📌 Considera apenas vendas novas (sem Cross Sell e Upsell).

Carteira MRR
🟡 Triagem / Onboarding: ${formatarMoedaBR(m.carteiraTriagemOnboarding)}
🟢 Ativo: ${formatarMoedaBR(m.carteiraAtivo)}
🟠 Em Cancelamento: ${formatarMoedaBR(m.carteiraEmCancelamento)}

📌 MRR Ativo: ${formatarMoedaBR(m.mrrAtivo)}
🚀 MRR Operando: ${formatarMoedaBR(m.mrrOperando)}

📦 Entrega Pontual: ${formatarMoedaBR(m.entregaPontual)}

📌 MRR Base ${mesAnterior}: ${formatarMoedaBR(m.mrrMesAnterior)}

💡 Legenda
• MRR Ativo: Triagem + Onboarding + Ativo.
• MRR Operando: Todos os status, exceto Pausado e Cancelado.

━━━━━━━━━━━━━━━

📉 Churn

💰 MRR
🔴 Total: ${formatarMoedaBR(m.churnTotal)} (${formatarPercentBR(m.churnTotalPct)})
🟢 Ajustado: ${formatarMoedaBR(m.churnAjustado)} (${formatarPercentBR(m.churnAjustadoPct)})

📦 Pontual
🔴 Total: ${formatarMoedaBR(m.churnPontual)} (${formatarPercentBR(m.churnPontualPct)})
🟢 Ajustado: ${formatarMoedaBR(m.churnPontualAjustado)} (${formatarPercentBR(m.churnPontualAjustadoPct)})

━━━━━━━━━━━━━━━

🔄 Cross Sell

💰 MRR: ${formatarMoedaBR(m.crossR)}
📦 Pontual: ${formatarMoedaBR(m.crossP)}

🏆 Total: ${formatarMoedaBR(m.crossTotal)}

━━━━━━━━━━━━━━━

🎯 Net Churn (MRR)

🟢 Ajustado

Churn Ajustado: ${formatarMoedaBR(m.churnAjustado)}
➖ Cross Sell: ${formatarMoedaBR(m.crossR)}
🟰 ${formatarMoedaBR(m.netChurn)} (${formatarPercentBR(m.netChurnPct)})

🔴 Bruto

Churn Total: ${formatarMoedaBR(m.churnTotal)}
➖ Cross Sell: ${formatarMoedaBR(m.crossR)}
🟰 ${formatarMoedaBR(m.netChurnBruto)} (${formatarPercentBR(m.netChurnBrutoPct)})

━━━━━━━━━━━━━━━

💡 Disclaimers

• MRR Adicionado e Pontual Vendido consideram apenas vendas novas, sem Cross Sell e Upsell.
• Churn Ajustado desconsidera erro de venda, clientes que não iniciaram e inadimplência de até 1 mês.
• O percentual do Churn Pontual é calculado sobre o estoque pontual em aberto no início do mês (${formatarMoedaBR(m.estoquePontualInicioMes)}).
• Net Churn = Churn − Cross Sell.
• MRR Ativo = Triagem + Onboarding + Ativo.
• MRR Operando = Todos os status, exceto Pausado e Cancelado.

👀 Seguimos acompanhando diariamente os indicadores e atuando rapidamente sobre os principais desvios.`;
}
```

Remover as variáveis `crossRTexto`, `crossPTexto` e `churnAbonado`, que deixam de ser usadas.

- [ ] **Step 7: Atualizar `calcularMetricasResumo`**

Substituir o corpo da função (linhas 251-306) por:

```ts
export async function calcularMetricasResumo(): Promise<MetricasResumo> {
  const [carteira, mrrMesAnterior, vendasNovas, breakdown, churn, churnPontual, entregaPontual, estoquePontualInicioMes] =
    await Promise.all([
      getCarteiraMrr(),
      getMrrInicioMes(),
      getVendasNovasBreakdown(),
      getVendasMrrBreakdown(),
      getChurnMes(),
      getChurnPontualMes(),
      getEntregaPontualMes(),
      getEstoquePontualInicioMes(),
    ]);

  // O metricsAdapter engole erros retornando 0; sem base de MRR a mensagem seria
  // enganosa, então abortamos. As métricas de venda podem ser legitimamente zero.
  if (carteira.mrrAtivo <= 0 || mrrMesAnterior <= 0) {
    throw new Error(
      `Métricas de MRR inválidas (mrrAtivo=${carteira.mrrAtivo}, mrrMesAnterior=${mrrMesAnterior}) — envio abortado`,
    );
  }

  const crossR = breakdown.crosssell;
  const crossP = breakdown.crosssell_pontual;
  const crossTotal = crossR + crossP;
  const netChurn = churn.ajustado - crossR;
  const netChurnBruto = churn.total - crossR;

  return {
    mrrAdicionado: vendasNovas.mrr,
    pontualVendido: vendasNovas.pontual,
    carteiraTriagemOnboarding: carteira.triagemOnboarding,
    carteiraAtivo: carteira.ativo,
    carteiraEmCancelamento: carteira.emCancelamento,
    mrrAtivo: carteira.mrrAtivo,
    mrrOperando: carteira.mrrOperando,
    entregaPontual,
    mrrMesAnterior,
    estoquePontualInicioMes,
    churnTotal: churn.total,
    churnTotalPct: (churn.total / mrrMesAnterior) * 100,
    churnAjustado: churn.ajustado,
    churnAjustadoPct: (churn.ajustado / mrrMesAnterior) * 100,
    churnPontual: churnPontual.total,
    churnPontualPct: estoquePontualInicioMes > 0 ? (churnPontual.total / estoquePontualInicioMes) * 100 : 0,
    churnPontualAjustado: churnPontual.ajustado,
    churnPontualAjustadoPct: estoquePontualInicioMes > 0 ? (churnPontual.ajustado / estoquePontualInicioMes) * 100 : 0,
    crossR,
    crossP,
    crossTotal,
    netChurn,
    netChurnPct: (netChurn / mrrMesAnterior) * 100,
    netChurnBruto,
    netChurnBrutoPct: (netChurnBruto / mrrMesAnterior) * 100,
    churnBrutoSemAbono: churn.brutoSemAbono,
    churnBrutoSemAbonoPct: (churn.brutoSemAbono / mrrMesAnterior) * 100,
  };
}
```

Ajustar os imports no topo do arquivo: remover `getMrrAtivo` (não mais usado aqui), adicionar `getVendasNovasBreakdown`:

```ts
import {
  getMrrInicioMes,
  getVendasMrrBreakdown,
  getVendasNovasBreakdown,
} from "../okr2026/metricsAdapter";
```

Remover a função `getMrrSoAtivo`, substituída por `getCarteiraMrr`.

- [ ] **Step 8: Rodar os testes para verificar que passam**

Run: `npx vitest run server/services/resumoLideres.test.ts`
Expected: PASS — todos os casos, incluindo a comparação exata da string.

Se a comparação de string falhar por diferença invisível, comparar com `console.log(JSON.stringify(msg))` para localizar espaço ou quebra de linha extra.

- [ ] **Step 9: Typecheck**

Run: `npm run check 2>&1 | grep -E "resumoLideres|metricsAdapter|AdminResumoLideres"`
Expected: sem saída. Se `AdminResumoLideres.tsx` aparecer, algum campo removido de `MetricasResumo` estava sendo lido no client — corrigir antes de commitar.

- [ ] **Step 10: Commit**

```bash
git add server/services/resumoLideres.ts server/services/resumoLideres.test.ts
git commit -m "feat(resumo-lideres): novo modelo de mensagem v3

Reorganiza a mensagem em blocos tematicos com emojis e aplica as tres
mudancas de regua: cross sell pontual sem amortizacao /5, net churn
subtraindo apenas o cross sell de MRR, e MRR Operando incluindo
'em cancelamento'. Renomeia mrrAtivo/mrrTotal para bater com os rotulos
exibidos (MRR Ativo agora e triagem+onboarding+ativo). A regua de abonos
segue calculada, fora do texto.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Validação contra dados reais e changelog

O template está correto por teste unitário, mas nenhum passo até aqui provou que os números reais fecham. Esta task roda o cálculo de ponta a ponta e verifica as identidades aritméticas.

**Files:**
- Create: `scripts/preview-resumo-lideres-tmp.ts` (descartável)
- Modify: `docs/CHANGELOG.md`

**Interfaces:**
- Consumes: `calcularMetricasResumo()` e `formatarMensagemResumo()` da Task 2.
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Escrever o script de preview**

Criar `scripts/preview-resumo-lideres-tmp.ts`:

```ts
// Script descartável: imprime a mensagem real e checa as identidades aritméticas.
import "dotenv/config";
import { calcularMetricasResumo, formatarMensagemResumo, agoraSaoPaulo } from "../server/services/resumoLideres";

async function main() {
  const m = await calcularMetricasResumo();
  console.log(formatarMensagemResumo(m, agoraSaoPaulo()));
  console.log("\n=== CHECKS ===");
  const quase = (a: number, b: number) => Math.abs(a - b) < 0.01;
  console.log("carteira fecha:", quase(m.carteiraTriagemOnboarding + m.carteiraAtivo, m.mrrAtivo));
  console.log("operando fecha:", quase(m.mrrAtivo + m.carteiraEmCancelamento, m.mrrOperando));
  console.log("cross total fecha:", quase(m.crossR + m.crossP, m.crossTotal));
  console.log("net churn fecha:", quase(m.churnAjustado - m.crossR, m.netChurn));
  console.log("net churn bruto fecha:", quase(m.churnTotal - m.crossR, m.netChurnBruto));
  console.log("pct churn fecha:", quase((m.churnTotal / m.mrrMesAnterior) * 100, m.churnTotalPct));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Rodar e conferir**

Run: `npx tsx scripts/preview-resumo-lideres-tmp.ts`

Expected: a mensagem completa no formato v3, e as seis linhas de check imprimindo `true`. Qualquer `false` é bug de cálculo — corrigir antes de seguir.

Conferir também, por leitura: nenhum valor sai como `R$ NaN` ou `NaN%`, e `MRR Base <mês>` traz o mês anterior correto.

- [ ] **Step 3: Comparar o "Ativo" com o banco**

Run:
```bash
set -a && source .env && set +a && PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT ROUND(SUM(valorr)::numeric,2) AS ativo FROM \"Clickup\".cup_contratos WHERE status='ativo';"
```

Expected: bate com a linha "🟢 Ativo" da mensagem. Divergência frente ao modelo de referência (R$ 1.069.598) é esperada no banco local por defasagem de sync — o que importa é bater com o banco consultado.

- [ ] **Step 4: Entrada no changelog**

Inserir em `docs/CHANGELOG.md` logo abaixo da linha `# Changelog`, seguindo o formato das entradas existentes (título com data e escopo, seções "O que foi feito" e "Por que"):

```markdown
## 2026-07-20 | feat(resumo-lideres): novo modelo de mensagem (v3)

**O que foi feito:**
- Mensagem reorganizada em blocos temáticos separados por réguas: Receita, Churn, Cross Sell, Net Churn e Disclaimers
- Métricas novas: MRR Adicionado e Pontual Vendido (vendas novas, sem cross sell e upsell), split da carteira em Triagem/Onboarding, Ativo e Em Cancelamento, e MRR Operando
- Cross sell pontual passa a aparecer em valor cheio — acabou a amortização ÷5
- Net Churn (ajustado e bruto) subtrai apenas o cross sell de MRR
- Linha "Churn MRR sem abonos" sai do texto; a métrica segue calculada e disponível em `/api/resumo-lideres/preview`

**Por que:**
- O formato anterior era uma lista corrida sem hierarquia visual, difícil de ler no WhatsApp
- As réguas de cross sell e net churn não eram comparáveis entre si: amortizar o pontual em 5x misturava caixa futuro com MRR corrente

**Atenção:** "MRR Ativo" mudou de significado — antes era só o status ativo, agora é Triagem + Onboarding + Ativo. Comparações com mensagens anteriores à v3 não são diretas.
```

- [ ] **Step 5: Limpar os scripts descartáveis**

```bash
rm -f scripts/validar-carteira-vendas-tmp.ts scripts/preview-resumo-lideres-tmp.ts
```

- [ ] **Step 6: Suite completa**

Run: `npx vitest run server/services/resumoLideres.test.ts`
Expected: PASS.

Run: `npm run check 2>&1 | grep -E "resumoLideres|metricsAdapter"`
Expected: sem saída.

- [ ] **Step 7: Commit e push**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): resumo dos lideres v3

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

## Validação humana antes do merge

Depois da Task 3, o usuário precisa abrir `/admin/resumo-lideres` e conferir a prévia renderizada — em especial se a mensagem fica legível no WhatsApp (largura das linhas, réguas `━` e emojis) e se os números batem com a expectativa da liderança. O envio real (`POST /api/resumo-lideres/enviar`) só depois desse aval.

**Não** rodar o dev server como parte da execução das tasks; a validação da UI é do usuário.
