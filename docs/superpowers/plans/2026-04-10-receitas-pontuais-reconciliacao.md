# Receitas Pontuais — Reconciliação Cumulativa por Caixa (A3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a query monolítica de receitas em `/api/contribuicao-squad/dfc/bulk` por uma simulação cumulativa per-cliente que reconcilia pagamentos do Conta Azul contra contratos do Clickup, atribuindo recorrentes integralmente e distribuindo a sobra para pontuais em FIFO até o saldo devedor zerar.

**Architecture:** Função pura `simulateCliente` em arquivo isolado (`server/contribuicaoSquad/simulator.ts`) recebe `ClienteSim` (contratos + pagamentos cronológicos) e popula `recebido_por_mes` em cada contrato. O endpoint REST faz duas queries SQL crus (contratos + pagamentos), monta o `Map<cnpj, ClienteSim>`, chama `simulateCliente` para cada cliente, e agrega os resultados nos campos `monthlyData`/`resumoPorSquad`/`receitasDetalhesPorSquad` que o frontend já consome (sem mudança no contrato JSON). Testes unitários cobrem 5 cenários conhecidos via vitest.

**Tech Stack:** PostgreSQL (CTEs, agregação por mês), Drizzle ORM (`db.execute(sql\`...\`)`), Express, Node.js, vitest (testes unitários), TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-10-receitas-pontuais-reconciliacao-design.md`

---

## File Structure

| Arquivo | Responsabilidade |
|---------|------------------|
| `server/contribuicaoSquad/simulator.ts` (NOVO) | Função pura `simulateCliente` + tipos `ContratoSim`/`ClienteSim` + helpers `contratoAtivoEm`/`gerarMesesEntre`. Não importa Express/Drizzle. Testável isoladamente. |
| `server/contribuicaoSquad/simulator.test.ts` (NOVO) | 5 testes unitários cobrindo: só recorrente, pontual à vista, pontual parcelado, recorrente+pontual juntos, Creators 4 entregas FIFO. |
| `server/routes.ts` (~5341–5825) | Substituir query de receitas e processamento por: (1) Query 1 (contratos), (2) Query 2 (pagamentos cronológicos), (3) montagem `Map<cnpj, ClienteSim>`, (4) loop `simulateCliente`, (5) agregação para `monthlyData`/`resumoPorSquad`/`receitasDetalhesPorSquad`. |
| `client/src/pages/ContribuicaoSquad.tsx` | **Sem mudança.** O contrato JSON é o mesmo. |

---

## Branch

Trabalhar em `feature/contribuicao-squad-receitas-pontuais` (já criada, contém o spec).

---

## Pré-validação

### Task 0: Validar query SQL e cenários conhecidos no banco de produção

**Files:** Nenhum (validação manual via psql)

- [ ] **Step 1: Conectar no banco de produção**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo
```

> Credenciais em `memory/reference_databases.md`.

- [ ] **Step 2: Validar Query 1 (contratos) — shape e contagem**

```sql
WITH cnpj_norm AS (
  SELECT cl.task_id,
    REPLACE(REPLACE(REPLACE(COALESCE(cl.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo
  FROM "Clickup".cup_clientes cl
  WHERE cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) != ''
)
SELECT
  cn.cnpj_limpo,
  ct.id_subtask,
  COALESCE(NULLIF(TRIM(ct.squad), ''), 'Sem Squad') AS squad,
  COALESCE(ct.servico, 'Serviço não identificado') AS servico,
  CASE
    WHEN COALESCE(ct.valorr::numeric, 0) > 0 THEN 'recorrente'
    WHEN COALESCE(ct.valorp::numeric, 0) > 0 THEN 'pontual'
  END AS tipo,
  GREATEST(COALESCE(ct.valorr::numeric, 0), COALESCE(ct.valorp::numeric, 0)) AS valor,
  ct.data_inicio,
  COALESCE(ct.data_solicitacao_encerramento, ct.data_encerramento) AS data_fim,
  COALESCE(ct.status, '') AS status
FROM cnpj_norm cn
INNER JOIN "Clickup".cup_contratos ct ON cn.task_id = ct.id_task
WHERE (COALESCE(ct.valorr::numeric, 0) > 0 OR COALESCE(ct.valorp::numeric, 0) > 0)
  AND ct.squad IS NOT NULL AND TRIM(ct.squad) != ''
LIMIT 5;
```

**Expected:** ~5 linhas com colunas `cnpj_limpo, id_subtask, squad, servico, tipo, valor, data_inicio, data_fim, status`. `tipo` deve ser `'recorrente'` ou `'pontual'`. Conferir que `valor` é o `valorr` ou `valorp` correto.

Anotar a contagem total:

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE COALESCE(valorr::numeric, 0) > 0) AS recorrente,
  COUNT(*) FILTER (WHERE COALESCE(valorp::numeric, 0) > 0) AS pontual
FROM "Clickup".cup_contratos
WHERE (COALESCE(valorr::numeric, 0) > 0 OR COALESCE(valorp::numeric, 0) > 0)
  AND squad IS NOT NULL AND TRIM(squad) != '';
```

**Anotar:** `total = ?`, `recorrente = ?`, `pontual = ?` (será usado no smoke test).

- [ ] **Step 3: Validar Query 2 (pagamentos) — shape e cobertura**

```sql
SELECT
  REPLACE(REPLACE(REPLACE(COALESCE(caz.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo,
  caz.nome AS cliente_nome,
  TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes,
  SUM(p.valor_pago::numeric) AS total_pago_mes
FROM "Conta Azul".caz_parcelas p
INNER JOIN "Conta Azul".caz_clientes caz ON TRIM(p.id_cliente::text) = TRIM(caz.ids::text)
WHERE p.tipo_evento = 'RECEITA'
  AND p.status = 'QUITADO'
  AND p.valor_pago::numeric > 0
  AND caz.cnpj IS NOT NULL AND TRIM(caz.cnpj) != ''
  AND REPLACE(REPLACE(REPLACE(COALESCE(caz.cnpj, ''), '.', ''), '-', ''), '/', '') = '03364572000148'
GROUP BY cnpj_limpo, caz.nome, TO_CHAR(p.data_quitacao, 'YYYY-MM')
ORDER BY mes;
```

**Expected:** linhas mensais para o CNPJ 03364572000148. Conferir que set/25 → R$ 5.512,45, out/25 → R$ 5.512,44, nov/25 → R$ 1.967,04, etc.

- [ ] **Step 4: Calcular soma anual antiga (referência)**

```sql
SELECT SUM(valor_anual) FROM (
  SELECT DISTINCT
    cn.cnpj_limpo, ct.id_subtask, COALESCE(ct.valorr::numeric, 0) * 12 AS valor_anual
  FROM (
    SELECT cl.task_id, REPLACE(REPLACE(REPLACE(cl.cnpj, '.', ''), '-', ''), '/', '') AS cnpj_limpo
    FROM "Clickup".cup_clientes cl WHERE cl.cnpj IS NOT NULL
  ) cn
  INNER JOIN "Clickup".cup_contratos ct ON cn.task_id = ct.id_task
  INNER JOIN (
    SELECT DISTINCT REPLACE(REPLACE(REPLACE(caz.cnpj, '.', ''), '-', ''), '/', '') AS cnpj_limpo
    FROM "Conta Azul".caz_parcelas p
    INNER JOIN "Conta Azul".caz_clientes caz ON TRIM(p.id_cliente::text) = TRIM(caz.ids::text)
    WHERE p.tipo_evento = 'RECEITA' AND p.status = 'QUITADO'
      AND p.data_quitacao >= '2026-01-01' AND p.data_quitacao <= '2026-12-31'
  ) pagos ON pagos.cnpj_limpo = cn.cnpj_limpo
  WHERE COALESCE(ct.valorr::numeric, 0) > 0 AND ct.squad IS NOT NULL
) x;
```

**Anotar:** `soma_anual_antiga = ?` (vai ser comparado depois).

- [ ] **Step 5: Sanity check — total pago no Conta Azul em 2026**

```sql
SELECT SUM(p.valor_pago::numeric) AS total_pago_2026
FROM "Conta Azul".caz_parcelas p
WHERE p.tipo_evento = 'RECEITA'
  AND p.status = 'QUITADO'
  AND p.data_quitacao >= '2026-01-01'
  AND p.data_quitacao <= '2026-12-31';
```

**Anotar:** `total_pago_real_2026 = ?`. A soma final da nova lógica não pode ultrapassar isso (mas pode ser menor por overpayment).

- [ ] **Step 6: Identificar 1 cliente Creators de 4 entregas para validação posterior**

```sql
SELECT cl.cnpj, cl.nome,
  STRING_AGG(ct.servico, ' | ' ORDER BY ct.servico) AS servicos,
  COUNT(*) AS n
FROM "Clickup".cup_contratos ct
JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
WHERE ct.servico ILIKE '%Entrega%Creators%'
  AND ct.valorp::numeric > 0
GROUP BY cl.cnpj, cl.nome
HAVING COUNT(*) = 4
LIMIT 3;
```

**Anotar:** CNPJ + nome de 1 cliente com 4 entregas Creators. Será usado na validação browser (Task 11).

---

## Implementation: Função pura simulator.ts

### Task 1: Criar arquivo simulator.ts com tipos e helpers

**Files:**
- Create: `server/contribuicaoSquad/simulator.ts`

- [ ] **Step 1: Criar diretório e arquivo**

```bash
mkdir -p server/contribuicaoSquad
```

- [ ] **Step 2: Escrever tipos e helpers no arquivo**

Crie `server/contribuicaoSquad/simulator.ts` com:

```typescript
// Reconciliação cumulativa de receitas por caixa (A3)
// Spec: docs/superpowers/specs/2026-04-10-receitas-pontuais-reconciliacao-design.md

export type ContratoTipo = 'recorrente' | 'pontual';

export interface ContratoSim {
  id_subtask: string;
  cnpj: string;
  squad: string;
  servico: string;
  tipo: ContratoTipo;
  valor: number;                // valorr (recorrente) ou valorp (pontual)
  data_inicio: Date;
  data_fim: Date | null;        // primeiro de [data_solicitacao_encerramento, data_encerramento]
  status: string;
  // estado mutável durante a simulação:
  saldo_devedor: number;        // só pontual; recorrente fica em 0
  recebido_por_mes: Map<string, number>; // 'YYYY-MM' -> valor
}

export interface ClienteSim {
  cnpj: string;
  cliente_nome: string;
  contratos: ContratoSim[];
  pagamentos_por_mes: Map<string, number>; // 'YYYY-MM' -> SUM(valor_pago)
}

const STATUS_RECORRENTE_INATIVO = new Set(['Cancelado', 'Encerrado', 'Pausado']);

/** Retorna true se o contrato está ativo no mês YYYY-MM informado. */
export function contratoAtivoEm(c: ContratoSim, mesYYYYMM: string): boolean {
  const [ano, mes] = mesYYYYMM.split('-').map(Number);
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  const fimMes = new Date(Date.UTC(ano, mes, 0));

  if (c.data_inicio > fimMes) return false;
  if (c.data_fim && c.data_fim < inicioMes) return false;
  if (c.tipo === 'recorrente' && STATUS_RECORRENTE_INATIVO.has(c.status)) return false;

  return true;
}

/** Gera todos os YYYY-MM entre dois meses (inclusivo). Ex: ('2024-11', '2025-02') -> ['2024-11','2024-12','2025-01','2025-02']. */
export function gerarMesesEntre(inicio: string, fim: string): string[] {
  const result: string[] = [];
  const [aIni, mIni] = inicio.split('-').map(Number);
  const [aFim, mFim] = fim.split('-').map(Number);
  let ano = aIni;
  let mes = mIni;
  while (ano < aFim || (ano === aFim && mes <= mFim)) {
    result.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes++;
    if (mes > 12) { mes = 1; ano++; }
  }
  return result;
}

/**
 * Simula reconciliação por caixa para 1 cliente.
 * MUTATES: cada contrato de cliente.contratos tem seu saldo_devedor e recebido_por_mes populados.
 */
export function simulateCliente(cliente: ClienteSim, mesAtualYYYYMM: string): void {
  // 1. Inicializar saldo devedor de cada pontual
  for (const c of cliente.contratos) {
    if (c.tipo === 'pontual') c.saldo_devedor = c.valor;
    else c.saldo_devedor = 0;
    c.recebido_por_mes = new Map();
  }

  // 2. Lista cronológica de meses, do primeiro pagamento até o mês atual
  const mesesPagos = Array.from(cliente.pagamentos_por_mes.keys()).sort();
  if (mesesPagos.length === 0) return;
  const primeiroMes = mesesPagos[0];
  const todosMeses = gerarMesesEntre(primeiroMes, mesAtualYYYYMM);

  // 3. Loop mês a mês
  for (const mes of todosMeses) {
    const totalPago = cliente.pagamentos_por_mes.get(mes) || 0;
    if (totalPago <= 0) continue;

    const ativos = cliente.contratos.filter(c => contratoAtivoEm(c, mes));

    // 3a. Recorrentes contam cheio se totalPago > 0
    const recorrentes = ativos.filter(c => c.tipo === 'recorrente');
    const somaRecorrentes = recorrentes.reduce((s, c) => s + c.valor, 0);
    for (const r of recorrentes) {
      r.recebido_por_mes.set(mes, r.valor);
    }

    // 3b. Sobra alimenta pontuais em FIFO por data_inicio
    let sobra = Math.max(0, totalPago - somaRecorrentes);
    if (sobra <= 0) continue;

    const pontuaisFila = ativos
      .filter(c => c.tipo === 'pontual' && c.saldo_devedor > 0)
      .sort((a, b) => a.data_inicio.getTime() - b.data_inicio.getTime());

    for (const p of pontuaisFila) {
      const atribuir = Math.min(p.saldo_devedor, sobra);
      const atual = p.recebido_por_mes.get(mes) || 0;
      p.recebido_por_mes.set(mes, atual + atribuir);
      p.saldo_devedor -= atribuir;
      sobra -= atribuir;
      if (sobra <= 0) break;
    }
    // sobra residual (overpayment) é ignorada
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "simulator.ts"`
Expected: nenhum output (zero erros).

- [ ] **Step 4: Commit**

```bash
git add server/contribuicaoSquad/simulator.ts
git commit -m "$(cat <<'EOF'
feat(contribuicao-squad): adiciona simulator A3 puro para receitas

Função simulateCliente reconcilia pagamentos do Conta Azul contra
contratos do Clickup. Recorrentes recebem valor cheio; sobra
alimenta pontuais em FIFO por data_inicio até saldo_devedor zerar.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Tests: simulator.test.ts (TDD)

### Task 2: Teste 1 — Cliente só recorrente

**Files:**
- Create: `server/contribuicaoSquad/simulator.test.ts`

- [ ] **Step 1: Escrever o teste**

Crie `server/contribuicaoSquad/simulator.test.ts` com:

```typescript
import { describe, it, expect } from 'vitest';
import { simulateCliente, ClienteSim, ContratoSim } from './simulator';

function makeContrato(overrides: Partial<ContratoSim>): ContratoSim {
  return {
    id_subtask: 'sub-1',
    cnpj: '11111111000111',
    squad: 'Squadra',
    servico: 'Performance',
    tipo: 'recorrente',
    valor: 0,
    data_inicio: new Date('2024-01-01'),
    data_fim: null,
    status: 'ativo',
    saldo_devedor: 0,
    recebido_por_mes: new Map(),
    ...overrides,
  };
}

function makeCliente(contratos: ContratoSim[], pagamentos: Record<string, number>): ClienteSim {
  return {
    cnpj: '11111111000111',
    cliente_nome: 'Cliente Teste',
    contratos,
    pagamentos_por_mes: new Map(Object.entries(pagamentos)),
  };
}

describe('simulateCliente', () => {
  it('cliente só com recorrente: cada mês conta valorr cheio', () => {
    const recorrente = makeContrato({ tipo: 'recorrente', valor: 2000 });
    const cliente = makeCliente([recorrente], {
      '2026-01': 2000,
      '2026-02': 2000,
      '2026-03': 2000,
    });

    simulateCliente(cliente, '2026-03');

    expect(recorrente.recebido_por_mes.get('2026-01')).toBe(2000);
    expect(recorrente.recebido_por_mes.get('2026-02')).toBe(2000);
    expect(recorrente.recebido_por_mes.get('2026-03')).toBe(2000);
  });
});
```

- [ ] **Step 2: Rodar e ver passar**

Run: `npx vitest run server/contribuicaoSquad/simulator.test.ts`
Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add server/contribuicaoSquad/simulator.test.ts
git commit -m "$(cat <<'EOF'
test(contribuicao-squad): teste 1 — cliente só recorrente

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Teste 2 — Pontual à vista (1 pagamento que cobre valorp)

**Files:**
- Modify: `server/contribuicaoSquad/simulator.test.ts`

- [ ] **Step 1: Adicionar teste no `describe('simulateCliente', ...)`**

Adicione DENTRO do `describe`, depois do primeiro `it`:

```typescript
  it('pontual à vista: 1 pagamento que cobre valorp completo', () => {
    const pontual = makeContrato({
      tipo: 'pontual',
      valor: 5000,
      servico: 'Landing Page',
      squad: 'Tech',
    });
    const cliente = makeCliente([pontual], {
      '2026-02': 5000,
    });

    simulateCliente(cliente, '2026-03');

    expect(pontual.recebido_por_mes.get('2026-02')).toBe(5000);
    expect(pontual.recebido_por_mes.get('2026-03')).toBeUndefined();
    expect(pontual.saldo_devedor).toBe(0);
  });
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run server/contribuicaoSquad/simulator.test.ts`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add server/contribuicaoSquad/simulator.test.ts
git commit -m "$(cat <<'EOF'
test(contribuicao-squad): teste 2 — pontual à vista

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Teste 3 — Pontual parcelado em 5 meses

**Files:**
- Modify: `server/contribuicaoSquad/simulator.test.ts`

- [ ] **Step 1: Adicionar teste**

Adicione DENTRO do `describe`, depois do teste anterior:

```typescript
  it('pontual parcelado: distribui ao longo dos meses até saldo zerar', () => {
    const pontual = makeContrato({
      tipo: 'pontual',
      valor: 10000,
      servico: 'Ecommerce',
      squad: 'Tech',
    });
    const cliente = makeCliente([pontual], {
      '2026-01': 2000,
      '2026-02': 2000,
      '2026-03': 2000,
      '2026-04': 2000,
      '2026-05': 2000,
      '2026-06': 2000, // depois de saldo zerar — não deve atribuir
    });

    simulateCliente(cliente, '2026-06');

    expect(pontual.recebido_por_mes.get('2026-01')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-02')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-03')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-04')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-05')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-06')).toBeUndefined();
    expect(pontual.saldo_devedor).toBe(0);
  });
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run server/contribuicaoSquad/simulator.test.ts`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add server/contribuicaoSquad/simulator.test.ts
git commit -m "$(cat <<'EOF'
test(contribuicao-squad): teste 3 — pontual parcelado em 5 meses

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Teste 4 — Recorrente + pontual juntos

**Files:**
- Modify: `server/contribuicaoSquad/simulator.test.ts`

- [ ] **Step 1: Adicionar teste**

```typescript
  it('recorrente + pontual: recorrente fixo, sobra alimenta pontual', () => {
    const recorrente = makeContrato({
      id_subtask: 'rec-1',
      tipo: 'recorrente',
      valor: 2000,
      servico: 'Performance',
      squad: 'Squadra',
      data_inicio: new Date('2025-01-01'),
    });
    const pontual = makeContrato({
      id_subtask: 'pon-1',
      tipo: 'pontual',
      valor: 15000,
      servico: 'Ecommerce',
      squad: 'Tech',
      data_inicio: new Date('2025-09-22'),
    });
    const cliente = makeCliente([recorrente, pontual], {
      '2025-09': 5512,  // recorrente + parte do ecommerce
      '2025-10': 5512,
      '2025-11': 1967,  // só recorrente (cliente pagou menos que esperado)
      '2025-12': 1967,
      '2026-01': 1967,
      '2026-02': 1997,
      '2026-03': 1997,
    });

    simulateCliente(cliente, '2026-03');

    // Recorrente conta cheio mesmo quando cliente pagou menos (decisão #5)
    expect(recorrente.recebido_por_mes.get('2025-09')).toBe(2000);
    expect(recorrente.recebido_por_mes.get('2025-11')).toBe(2000);
    expect(recorrente.recebido_por_mes.get('2026-03')).toBe(2000);

    // Pontual recebe sobra (2 meses com sobra = 3512 cada)
    expect(pontual.recebido_por_mes.get('2025-09')).toBe(3512);
    expect(pontual.recebido_por_mes.get('2025-10')).toBe(3512);
    expect(pontual.recebido_por_mes.get('2025-11')).toBeUndefined();

    // Saldo após 2 meses de sobra: 15000 - 7024 = 7976
    expect(pontual.saldo_devedor).toBe(7976);
  });
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run server/contribuicaoSquad/simulator.test.ts`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add server/contribuicaoSquad/simulator.test.ts
git commit -m "$(cat <<'EOF'
test(contribuicao-squad): teste 4 — recorrente + pontual juntos

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Teste 5 — Creators 4 entregas FIFO

**Files:**
- Modify: `server/contribuicaoSquad/simulator.test.ts`

- [ ] **Step 1: Adicionar teste**

```typescript
  it('Creators 4 entregas: FIFO consome um contrato por mês', () => {
    const e1 = makeContrato({
      id_subtask: 'e1', tipo: 'pontual', valor: 6799,
      servico: '1ª Entrega - Creators', squad: 'Makers',
      data_inicio: new Date('2025-08-01'),
    });
    const e2 = makeContrato({
      id_subtask: 'e2', tipo: 'pontual', valor: 6799,
      servico: '2ª Entrega - Creators', squad: 'Makers',
      data_inicio: new Date('2025-08-02'),
    });
    const e3 = makeContrato({
      id_subtask: 'e3', tipo: 'pontual', valor: 6799,
      servico: '3ª Entrega - Creators', squad: 'Makers',
      data_inicio: new Date('2025-08-03'),
    });
    const e4 = makeContrato({
      id_subtask: 'e4', tipo: 'pontual', valor: 6799,
      servico: '4ª Entrega - Creators', squad: 'Makers',
      data_inicio: new Date('2025-08-04'),
    });
    const cliente = makeCliente([e1, e2, e3, e4], {
      '2025-09': 6799,
      '2025-10': 6799,
      '2025-11': 6799,
      '2025-12': 6799,
      '2026-01': 6799, // depois de tudo zerado — não deve atribuir nada
    });

    simulateCliente(cliente, '2026-01');

    // FIFO por data_inicio: e1 primeiro (2025-08-01), depois e2, e3, e4
    expect(e1.recebido_por_mes.get('2025-09')).toBe(6799);
    expect(e1.saldo_devedor).toBe(0);
    expect(e2.recebido_por_mes.get('2025-10')).toBe(6799);
    expect(e2.saldo_devedor).toBe(0);
    expect(e3.recebido_por_mes.get('2025-11')).toBe(6799);
    expect(e3.saldo_devedor).toBe(0);
    expect(e4.recebido_por_mes.get('2025-12')).toBe(6799);
    expect(e4.saldo_devedor).toBe(0);

    // Mês 2026-01: tudo zerado, nada recebe
    expect(e1.recebido_por_mes.get('2026-01')).toBeUndefined();
    expect(e4.recebido_por_mes.get('2026-01')).toBeUndefined();

    // Nenhum contrato pego por outro mês fora do esperado
    expect(e1.recebido_por_mes.get('2025-10')).toBeUndefined();
    expect(e2.recebido_por_mes.get('2025-09')).toBeUndefined();
  });
```

- [ ] **Step 2: Rodar TODOS os testes**

Run: `npx vitest run server/contribuicaoSquad/simulator.test.ts`
Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add server/contribuicaoSquad/simulator.test.ts
git commit -m "$(cat <<'EOF'
test(contribuicao-squad): teste 5 — Creators 4 entregas FIFO

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Backend integration

### Task 7: Substituir query monolítica de receitas em routes.ts

**Files:**
- Modify: `server/routes.ts:5350-5494` (query antiga + parser do `result.rows` em `mesesMap`)
- Modify: `server/routes.ts:5750-5798` (montagem de `resumoPorSquad` e `receitasDetalhesPorSquad`)

Esta task substitui o pipeline de receitas inteiro. NÃO toca as queries de despesas (salários, freelancers) — só o lado de receitas.

- [ ] **Step 1: Adicionar import no topo do routes.ts**

Localizar a linha `import { isAuthenticated } from "./auth/middleware";` (~linha 6) e adicionar logo abaixo:

```typescript
import { simulateCliente, ContratoSim, ClienteSim } from "./contribuicaoSquad/simulator";
```

- [ ] **Step 2: Substituir a query monolítica e o parsing**

Localizar o bloco que começa em `// Query: valorr do contrato por squad, condicionado ao cliente ter pago no mês (sem rateio)` (~linha 5350) e vai até o fim do `for (const row of result.rows as any[])` (~linha 5494).

Substituir TODO esse bloco por:

```typescript
      // ──── RECEITAS: Reconciliação cumulativa A3 ────────────────────────────
      // Spec: docs/superpowers/specs/2026-04-10-receitas-pontuais-reconciliacao-design.md

      // Query 1: contratos relevantes (sem filtro de ano nem squad — JS aplica)
      const contratosResult = await db.execute(sql`
        WITH cnpj_norm AS (
          SELECT
            cl.task_id,
            REPLACE(REPLACE(REPLACE(COALESCE(cl.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo
          FROM "Clickup".cup_clientes cl
          WHERE cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) != ''
        )
        SELECT
          cn.cnpj_limpo,
          ct.id_subtask,
          COALESCE(NULLIF(TRIM(ct.squad), ''), 'Sem Squad') AS squad,
          COALESCE(ct.servico, 'Serviço não identificado') AS servico,
          CASE
            WHEN COALESCE(ct.valorr::numeric, 0) > 0 THEN 'recorrente'
            WHEN COALESCE(ct.valorp::numeric, 0) > 0 THEN 'pontual'
          END AS tipo,
          GREATEST(COALESCE(ct.valorr::numeric, 0), COALESCE(ct.valorp::numeric, 0)) AS valor,
          ct.data_inicio,
          COALESCE(ct.data_solicitacao_encerramento, ct.data_encerramento) AS data_fim,
          COALESCE(ct.status, '') AS status
        FROM cnpj_norm cn
        INNER JOIN "Clickup".cup_contratos ct ON cn.task_id = ct.id_task
        WHERE (COALESCE(ct.valorr::numeric, 0) > 0 OR COALESCE(ct.valorp::numeric, 0) > 0)
          AND ct.squad IS NOT NULL AND TRIM(ct.squad) != ''
      `);

      // Query 2: pagamentos cronológicos (histórico inteiro, todos os clientes)
      const pagamentosResult = await db.execute(sql`
        SELECT
          REPLACE(REPLACE(REPLACE(COALESCE(caz.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo,
          caz.nome AS cliente_nome,
          TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes,
          SUM(p.valor_pago::numeric) AS total_pago_mes
        FROM "Conta Azul".caz_parcelas p
        INNER JOIN "Conta Azul".caz_clientes caz ON TRIM(p.id_cliente::text) = TRIM(caz.ids::text)
        WHERE p.tipo_evento = 'RECEITA'
          AND p.status = 'QUITADO'
          AND p.valor_pago::numeric > 0
          AND caz.cnpj IS NOT NULL AND TRIM(caz.cnpj) != ''
        GROUP BY cnpj_limpo, caz.nome, TO_CHAR(p.data_quitacao, 'YYYY-MM')
        ORDER BY cnpj_limpo, mes
      `);

      // ──── Montar Map<cnpj, ClienteSim> ─────────────────────────────────────
      const clientesMap = new Map<string, ClienteSim>();

      // Primeiro: criar entrada por cliente a partir dos pagamentos
      for (const row of pagamentosResult.rows as any[]) {
        const cnpj = row.cnpj_limpo;
        if (!cnpj) continue;
        let cliente = clientesMap.get(cnpj);
        if (!cliente) {
          cliente = {
            cnpj,
            cliente_nome: row.cliente_nome || 'Cliente não identificado',
            contratos: [],
            pagamentos_por_mes: new Map(),
          };
          clientesMap.set(cnpj, cliente);
        }
        const mes = row.mes as string;
        const valor = Number(row.total_pago_mes) || 0;
        cliente.pagamentos_por_mes.set(mes, (cliente.pagamentos_por_mes.get(mes) || 0) + valor);
      }

      // Depois: anexar contratos a cada cliente que tem pagamentos
      for (const row of contratosResult.rows as any[]) {
        const cnpj = row.cnpj_limpo;
        if (!cnpj) continue;
        const cliente = clientesMap.get(cnpj);
        if (!cliente) continue; // cliente sem pagamento — ignorar
        if (!row.tipo) continue; // contrato sem valor — pulado pela CASE da query

        const dataInicioRaw = row.data_inicio;
        const dataInicio = dataInicioRaw ? new Date(dataInicioRaw) : new Date('1900-01-01');
        const dataFim = row.data_fim ? new Date(row.data_fim) : null;

        const contrato: ContratoSim = {
          id_subtask: row.id_subtask,
          cnpj,
          squad: row.squad || 'Sem Squad',
          servico: row.servico || 'Serviço não identificado',
          tipo: row.tipo as 'recorrente' | 'pontual',
          valor: Number(row.valor) || 0,
          data_inicio: dataInicio,
          data_fim: dataFim,
          status: row.status || '',
          saldo_devedor: 0,
          recebido_por_mes: new Map(),
        };
        cliente.contratos.push(contrato);
      }

      // ──── Rodar simulação para cada cliente ─────────────────────────────────
      const hoje = new Date();
      const mesAtualYYYYMM = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

      for (const cliente of clientesMap.values()) {
        // Cliente sem contratos é ignorado (decisão #6)
        if (cliente.contratos.length === 0) continue;
        simulateCliente(cliente, mesAtualYYYYMM);
      }

      // ──── Agregar resultados em estruturas legacy ──────────────────────────
      // mesesMap: por mês do ano selecionado, com categorias/clientes/serviços
      type ParcelaInfo = {
        id: string | null;
        valor: number;
        dataQuitacao: string | null;
        linkNfse: string | null;
        numNfse: string | null;
        urlCobranca: string | null;
        clienteNome: string;
        servicoNome: string;
        squad: string;
      };
      type ServicoInfo = { valor: number; squad: string; parcelas: ParcelaInfo[] };
      type ClienteInfo = { valorTotal: number; servicos: Map<string, ServicoInfo> };
      type CategoriaInfo = { nome: string; valorTotal: number; clientes: Map<string, ClienteInfo> };
      type MesData = {
        categorias: Map<string, CategoriaInfo>;
        receitaTotal: number;
        totalParcelas: number;
      };

      const mesesMap = new Map<string, MesData>();
      const squadsSet = new Set<string>();

      // Iterar contratos simulados, somando recebido_por_mes nos meses do ano selecionado
      for (const cliente of clientesMap.values()) {
        for (const contrato of cliente.contratos) {
          // Filtrar squad se necessário (mesma fuzzy lógica que existia)
          const sqNorm = contrato.squad;
          if (squadFilter) {
            const stripPrefix = (s: string) => s.replace(/^[^a-zA-Z]+/, '');
            const matches =
              sqNorm === squadFilter ||
              sqNorm.toLowerCase().includes(stripPrefix(squadFilter).toLowerCase()) ||
              squadFilter.toLowerCase().includes(stripPrefix(sqNorm).toLowerCase());
            if (!matches) continue;
          }

          squadsSet.add(sqNorm);

          for (const [mes, valor] of contrato.recebido_por_mes.entries()) {
            // Filtrar só meses do ano selecionado
            if (!mes.startsWith(`${ano}-`)) continue;
            if (valor <= 0) continue;

            if (!mesesMap.has(mes)) {
              mesesMap.set(mes, { categorias: new Map(), receitaTotal: 0, totalParcelas: 0 });
            }
            const mesData = mesesMap.get(mes)!;
            mesData.receitaTotal += valor;
            mesData.totalParcelas += 1;

            const categoriaNome = 'Sem Categoria';
            if (!mesData.categorias.has(categoriaNome)) {
              mesData.categorias.set(categoriaNome, {
                nome: categoriaNome,
                valorTotal: 0,
                clientes: new Map(),
              });
            }
            const cat = mesData.categorias.get(categoriaNome)!;
            cat.valorTotal += valor;

            if (!cat.clientes.has(cliente.cliente_nome)) {
              cat.clientes.set(cliente.cliente_nome, { valorTotal: 0, servicos: new Map() });
            }
            const cli = cat.clientes.get(cliente.cliente_nome)!;
            cli.valorTotal += valor;

            const chaveServico = `${contrato.servico}|${sqNorm}`;
            if (!cli.servicos.has(chaveServico)) {
              cli.servicos.set(chaveServico, { valor: 0, squad: sqNorm, parcelas: [] });
            }
            const srv = cli.servicos.get(chaveServico)!;
            srv.valor += valor;
            srv.parcelas.push({
              id: contrato.id_subtask,
              valor,
              dataQuitacao: null,
              linkNfse: null,
              numNfse: null,
              urlCobranca: null,
              clienteNome: cliente.cliente_nome,
              servicoNome: contrato.servico,
              squad: sqNorm,
            });
          }
        }
      }
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "routes.ts(53\|routes.ts(54\|routes.ts(55\|simulator"` 
Expected: nenhum erro novo nas linhas modificadas. (Erros pré-existentes em outras linhas — DbStorage, regex flag, downlevelIteration — são fine.)

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "$(cat <<'EOF'
feat(contribuicao-squad): integra simulator A3 no endpoint bulk

Substitui query monolítica de receitas por (1) Query 1 contratos,
(2) Query 2 pagamentos cronológicos, (3) montagem Map<cnpj, ClienteSim>,
(4) loop simulateCliente, (5) agregação para mesesMap mantendo o
mesmo formato do BulkResponse.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Refazer `resumoPorSquad` e `receitasDetalhesPorSquad` a partir dos contratos simulados

**Files:**
- Modify: `server/routes.ts:5750-5798`

A montagem antiga iterava `result.rows` (que não existe mais). Precisa ser refeita iterando `clientesMap.values()`.

- [ ] **Step 1: Localizar o bloco antigo**

Procurar o bloco que começa com `// Agregar resumo por squad a partir dos dados brutos` e vai até `for (const sq of Object.keys(receitasDetalhesPorSquad)) { ... .sort(...) }`.

- [ ] **Step 2: Substituir por versão baseada em clientesMap**

Substituir o bloco identificado por:

```typescript
      // ──── Agregar resumo por squad a partir dos contratos simulados ──────
      const squadSummaryMap = new Map<string, { total: number; porMes: number[]; contratos: Set<string> }>();
      for (const cliente of clientesMap.values()) {
        for (const contrato of cliente.contratos) {
          const sq = contrato.squad;

          // Aplica filtro de squad se necessário
          if (squadFilter) {
            const stripPrefix = (s: string) => s.replace(/^[^a-zA-Z]+/, '');
            const matches =
              sq === squadFilter ||
              sq.toLowerCase().includes(stripPrefix(squadFilter).toLowerCase()) ||
              squadFilter.toLowerCase().includes(stripPrefix(sq).toLowerCase());
            if (!matches) continue;
          }

          if (!squadSummaryMap.has(sq)) {
            squadSummaryMap.set(sq, { total: 0, porMes: new Array(12).fill(0), contratos: new Set() });
          }
          const entry = squadSummaryMap.get(sq)!;

          for (const [mes, valor] of contrato.recebido_por_mes.entries()) {
            if (!mes.startsWith(`${ano}-`)) continue;
            const monthIdx = parseInt(mes.split('-')[1]) - 1;
            entry.total += valor;
            entry.porMes[monthIdx] += valor;
          }

          // Considera o contrato no count se ele teve pelo menos 1 mês com valor no ano
          const teveValorNoAno = Array.from(contrato.recebido_por_mes.entries()).some(
            ([mes, v]) => mes.startsWith(`${ano}-`) && v > 0
          );
          if (teveValorNoAno) {
            entry.contratos.add(`${cliente.cliente_nome}|${contrato.servico}|${sq}`);
          }
        }
      }

      const resumoPorSquad = Array.from(squadSummaryMap.entries())
        .filter(([sq]) => !/\bOFF\b/i.test(sq))
        .map(([squad, data]) => ({
          squad,
          receitaTotal: data.total,
          porMes: data.porMes,
          quantidadeContratos: data.contratos.size,
        }))
        .sort((a, b) => b.receitaTotal - a.receitaTotal);

      // ──── Detalhes de receita por squad → cliente → mês ─────────────────
      const receitasDetalhesPorSquad: Record<string, { cliente: string; porMes: number[]; total: number }[]> = {};
      for (const cliente of clientesMap.values()) {
        for (const contrato of cliente.contratos) {
          const sq = contrato.squad;
          if (/\bOFF\b/i.test(sq)) continue;

          for (const [mes, valor] of contrato.recebido_por_mes.entries()) {
            if (!mes.startsWith(`${ano}-`)) continue;
            if (valor <= 0) continue;
            const monthIdx = parseInt(mes.split('-')[1]) - 1;

            if (!receitasDetalhesPorSquad[sq]) receitasDetalhesPorSquad[sq] = [];
            let entry = receitasDetalhesPorSquad[sq].find(e => e.cliente === cliente.cliente_nome);
            if (!entry) {
              entry = { cliente: cliente.cliente_nome, porMes: new Array(12).fill(0), total: 0 };
              receitasDetalhesPorSquad[sq].push(entry);
            }
            entry.porMes[monthIdx] += valor;
            entry.total += valor;
          }
        }
      }
      // Ordenar clientes por total desc dentro de cada squad
      for (const sq of Object.keys(receitasDetalhesPorSquad)) {
        receitasDetalhesPorSquad[sq].sort((a, b) => b.total - a.total);
      }
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "routes.ts" | grep -v "DbStorage\|downlevelIteration\|ES6 or later\|argument of type 'string'"`
Expected: nenhuma linha (sem erros novos).

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "$(cat <<'EOF'
refactor(contribuicao-squad): refaz resumo e detalhes por squad via clientesMap

resumoPorSquad e receitasDetalhesPorSquad agora vêm da iteração de
clientesMap (estado pós-simulação) em vez de result.rows da query
antiga.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Smoke test do endpoint

**Files:** Nenhum (validação via curl)

- [ ] **Step 1: Restart do dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1; npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 5
```

- [ ] **Step 2: Login dev e hit no endpoint**

```bash
curl -s -c /tmp/cortex-cookies.txt -X POST "http://localhost:3000/auth/dev-login" > /dev/null
curl -s -b /tmp/cortex-cookies.txt "http://localhost:3000/api/contribuicao-squad/dfc/bulk?ano=2026" > /tmp/bulk-response.json
```

- [ ] **Step 3: Validar shape da resposta**

```bash
python3 -c "
import json
d = json.load(open('/tmp/bulk-response.json'))
assert 'despesasMensais' in d
assert 'salariosDetalhesPorSquad' in d
assert 'resumoPorSquad' in d
assert 'receitasDetalhesPorSquad' in d
assert 'meses' in d
print('Top-level keys OK:', sorted(d.keys()))
print()
total_anual = sum(s['receitaTotal'] for s in d['resumoPorSquad'])
print(f'Soma anual receitas (resumoPorSquad): R\$ {total_anual:,.2f}')
print(f'# squads em resumoPorSquad: {len(d[\"resumoPorSquad\"])}')
print()
print('Top 5 squads por receita:')
for s in d['resumoPorSquad'][:5]:
    print(f'  {s[\"squad\"]}: R\$ {s[\"receitaTotal\"]:>14,.2f} ({s[\"quantidadeContratos\"]} contratos)')
print()
# Tech específico
tech = next((s for s in d['resumoPorSquad'] if 'Tech' in s['squad']), None)
if tech:
    print(f'Tech: R\$ {tech[\"receitaTotal\"]:,.2f}')
    print('  porMes:', [round(v) for v in tech['porMes']])
"
```

**Expected:**
- Soma anual deve ser **maior** que a soma antiga (anotada na Task 0 Step 4) — porque pontuais voltam.
- Tech deve mostrar valor **muito maior** que R$ 32k (provavelmente >R$ 200k).
- Não deve passar do `total_pago_real_2026` da Task 0 Step 5.

- [ ] **Step 4: Validar caso conhecido CNPJ 03364572000148**

```bash
python3 -c "
import json
d = json.load(open('/tmp/bulk-response.json'))
# Procurar Tech, depois Ecommerce
tech_clientes = d['receitasDetalhesPorSquad'].get('🖥️ Tech', [])
print('Clientes do Tech:')
for c in tech_clientes[:10]:
    print(f'  {c[\"cliente\"][:50]}: total R\$ {c[\"total\"]:,.2f}')
    print(f'    porMes:', [round(v) for v in c['porMes']])
"
```

**Expected:** entre os clientes Tech, deve aparecer um com nome relacionado ao CNPJ 03364572000148, com valores nos meses jan-mar de 2026 (provavelmente baixos, porque a maior parte do parcelamento foi atribuída em set/out de 2025). Anotar valores.

- [ ] **Step 5: Sem commit (validação)**

Se algum check falhar, voltar à task correspondente. Se passar, prosseguir.

---

## Validação final

### Task 10: Rodar todos os testes unitários

**Files:** Nenhum (validação)

- [ ] **Step 1: Rodar suite completa**

Run: `npx vitest run server/contribuicaoSquad/`
Expected: 5 passed.

- [ ] **Step 2: Rodar suite global pra garantir que não quebrou nada**

Run: `npx vitest run`
Expected: Todos os testes do projeto passam (ou pelo menos os pré-existentes continuam no mesmo estado).

- [ ] **Step 3: Sem commit (validação)**

---

### Task 11: Validação manual no browser

**Files:** Nenhum (validação manual pelo usuário)

- [ ] **Step 1: Restart e abrir aba**

Garantir que dev server está rodando. Abrir `http://localhost:3000` → Contribuição por Squad → Ano 2026.

- [ ] **Step 2: Validar Tech aparecendo**

Squad **Tech** deve aparecer no ranking com receita significativa (provavelmente >R$ 200k). Antes era R$ 32k.

- [ ] **Step 3: Validar Makers / Creators**

Squad **Makers** (ou onde estão os Creators) deve mostrar receita coerente. Expandir e procurar os clientes Creators identificados na Task 0 Step 6.

- [ ] **Step 4: Validar não há "Sem Squad" órfão**

Não deve haver linha "Sem Squad" com receita > 0 vinda de cliente sem contrato (decisão #6).

- [ ] **Step 5: Validar caso CNPJ 03364572000148**

Procurar o cliente nas expansões dos squads Squadra (recorrente) e Tech (pontual). Squadra deve mostrar R$ 1.997 nos meses pagos. Tech deve mostrar valores baixos ou zero em jan-mar/2026 (a maior parte do parcelamento foi alocada em set/out/2025, fora do ano selecionado).

- [ ] **Step 6: Validar margem por squad**

Para 1 squad qualquer, conferir mentalmente: `Receita - Despesa = Margem` em pelo menos 1 mês.

- [ ] **Step 7: Dark + light mode**

Alternar tema. Confirmar legibilidade.

- [ ] **Step 8: Filtro por squad**

Selecionar 1 squad no dropdown. Página deve recarregar mostrando só esse squad.

- [ ] **Step 9: Sem commit**

---

### Task 12: Push final + PR

**Files:** Nenhum (operacional)

- [ ] **Step 1: Push da feature branch**

```bash
git push --set-upstream origin feature/contribuicao-squad-receitas-pontuais
```

- [ ] **Step 2: Abrir PR via gh**

```bash
gh pr create --base main --head feature/contribuicao-squad-receitas-pontuais --title "feat(contribuicao-squad): reconciliação cumulativa A3 de receitas pontuais" --body "$(cat <<'EOF'
## Summary

- Substitui a query monolítica de receitas por uma simulação cumulativa per-cliente (A3)
- Pontuais voltam a ser contabilizados, mas sem inflação: cada contrato pontual tem saldo devedor que diminui ao longo dos pagamentos
- Recorrentes preservam comportamento atual (cheio se houve qualquer pagamento)
- Sobra mensal alimenta pontuais em FIFO por data_inicio
- Resolve casos Tech parcelado e Creators 4 entregas sem configuração manual

## Algoritmo

Para cada cliente:
1. Reconstruir histórico cronológico de pagamentos (do primeiro até hoje)
2. Para cada mês: recorrentes ativos contam valor cheio (se houve pagamento)
3. Sobra = MAX(0, total_pago - SUM(valorr_recorrentes))
4. Sobra alimenta pontuais ativos com saldo > 0, em ordem de data_inicio
5. Pontual com saldo zerado sai da fila

## Estrutura

- `server/contribuicaoSquad/simulator.ts` (NOVO): função pura testável
- `server/contribuicaoSquad/simulator.test.ts` (NOVO): 5 testes vitest
- `server/routes.ts`: substituição do pipeline de receitas (não toca despesas)
- `client/src/pages/ContribuicaoSquad.tsx`: SEM mudança (mesmo BulkResponse)

## Test plan

- [ ] 5 testes unitários do simulator passam
- [ ] Aba Contribuição por Squad → 2026 carrega
- [ ] Squad Tech aparece com receita significativa (era R\$ 32k, agora >R\$ 200k esperado)
- [ ] Squad Makers / Creators aparece com receita coerente
- [ ] Sem clientes 'Sem Squad' órfãos
- [ ] CNPJ 03364572000148: Squadra recebe R\$ 1.997/mês recorrente
- [ ] Dark + light mode OK
- [ ] Filtro por squad funciona

Spec: \`docs/superpowers/specs/2026-04-10-receitas-pontuais-reconciliacao-design.md\`
Plano: \`docs/superpowers/plans/2026-04-10-receitas-pontuais-reconciliacao.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Reportar URL do PR**

---

## Resumo de commits esperados

| # | Task | Mensagem |
|---|------|----------|
| 1 | Task 1 | feat(contribuicao-squad): adiciona simulator A3 puro para receitas |
| 2 | Task 2 | test(contribuicao-squad): teste 1 — cliente só recorrente |
| 3 | Task 3 | test(contribuicao-squad): teste 2 — pontual à vista |
| 4 | Task 4 | test(contribuicao-squad): teste 3 — pontual parcelado em 5 meses |
| 5 | Task 5 | test(contribuicao-squad): teste 4 — recorrente + pontual juntos |
| 6 | Task 6 | test(contribuicao-squad): teste 5 — Creators 4 entregas FIFO |
| 7 | Task 7 | feat(contribuicao-squad): integra simulator A3 no endpoint bulk |
| 8 | Task 8 | refactor(contribuicao-squad): refaz resumo e detalhes por squad via clientesMap |

Tasks 0, 9, 10, 11, 12 não geram commit (validação/operacional).
