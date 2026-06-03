# Notificação Extrajudicial no Funil Jurídico — Implementation Plan (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar botão "Gerar Notificação" no card do funil jurídico que abre modal com substituição automática de variáveis do template de notificação extrajudicial, com ações de copiar texto e abrir no cliente de email (mailto).

**Architecture:** Backend expõe `email` e `endereco` de `caz_clientes` no endpoint existente. Frontend adiciona função pura de substituição (`renderizarNotificacao`) testada por unit tests + modal novo com form + preview editável. Zero envio server-side nessa fase.

**Tech Stack:** React + TypeScript + Tailwind + shadcn/ui (Dialog), Vitest para testes unitários, date-fns para formatação de datas, Drizzle/pg para SQL.

**Spec:** `docs/superpowers/specs/2026-04-23-notificacao-extrajudicial-juridico-design.md`

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `server/storage.ts` | Modificar (método `getInadimplenciaClientes`, ~linha 9164–9360) | Incluir `email` e `endereco` na CTE e no SELECT |
| `server/routes/juridico.ts` | Modificar (endpoint `GET /api/juridico/clientes`, ~linha 164–173 e 215–230) | Propagar `email`/`endereco` no payload retornado |
| `client/src/pages/JuridicoClientes.tsx` | Modificar | Adicionar `email`/`endereco` na interface `ClienteInadimplente`, novo botão condicional, estado do modal |
| `client/src/lib/notificacao-extrajudicial.ts` | Criar | Função pura `renderizarNotificacao()` + helpers |
| `client/src/lib/notificacao-extrajudicial.test.ts` | Criar | Testes unitários (Vitest) |
| `client/src/components/juridico/NotificacaoExtrajudicialModal.tsx` | Criar | Modal com form + preview editável + ações |

---

## Task 1: Backend — Incluir email e endereço no payload de clientes

**Files:**
- Modify: `server/storage.ts:9164-9360` (método `getInadimplenciaClientes`)
- Modify: `server/routes/juridico.ts:74-249` (endpoint GET e bloco de clientes históricos)

- [ ] **Step 1: Adicionar email e endereco na CTE `cliente_metadata` em `storage.ts`**

Abra `server/storage.ts`, localize a CTE `cliente_metadata` (linha ~9276). Atualize o SELECT da CTE para incluir `email` e `endereco` de `caz_clientes`:

```sql
cliente_metadata AS (
  SELECT DISTINCT ON (TRIM(cc.ids::text))
    TRIM(cc.ids::text) as id_cliente,
    cc.cnpj,
    cc.email,
    cc.endereco,
    cup.nome as nome_clickup,
    cup.status as status_clickup,
    cup.responsavel,
    cup.cluster,
    cup.task_id,
    cup.telefone
  FROM "Conta Azul".caz_clientes cc
  LEFT JOIN "Clickup".cup_clientes cup ON TRIM(cc.cnpj::text) = TRIM(cup.cnpj::text) 
    AND cc.cnpj IS NOT NULL AND cc.cnpj::text != ''
  WHERE cc.ids IS NOT NULL
  ORDER BY TRIM(cc.ids::text), cup.status DESC NULLS LAST
),
```

- [ ] **Step 2: Incluir os campos no SELECT final e no `ORDER BY` da query**

Na query final (linha ~9314), adicione `cliente_info.email` e `cliente_info.endereco`:

```sql
SELECT 
  parcelas.id_cliente,
  caz.nome_caz as nome_cliente,
  parcelas.valor_total,
  parcelas.quantidade_parcelas,
  parcelas.parcela_mais_antiga,
  parcelas.dias_atraso_max,
  parcelas.empresa,
  cliente_info.cnpj,
  cliente_info.email,
  cliente_info.endereco,
  cliente_info.nome_clickup,
  cliente_info.status_clickup,
  cliente_info.responsavel,
  cliente_info.cluster,
  contrato_servicos.servicos,
  cliente_info.telefone,
  contrato_info.vendedor,
  contrato_info.squad
FROM parcelas_agregadas parcelas
-- (restante inalterado)
```

- [ ] **Step 3: Expor os campos no tipo de retorno e no mapeamento**

Atualize o tipo de retorno do método (linha ~9173–9191) para incluir:

```ts
  clientes: {
    idCliente: string;
    nomeCliente: string;
    valorTotal: number;
    quantidadeParcelas: number;
    parcelaMaisAntiga: Date;
    diasAtrasoMax: number;
    empresa: string;
    cnpj: string | null;
    email: string | null;
    endereco: string | null;
    statusClickup: string | null;
    responsavel: string | null;
    cluster: string | null;
    servicos: string | null;
    telefone: string | null;
    vendedor: string | null;
    squad: string | null;
  }[];
```

E o `map` final (linha ~9341) passa a incluir:

```ts
const clientes = (result.rows as any[]).map(row => ({
  idCliente: row.id_cliente || '',
  nomeCliente: row.nome_clickup || row.nome_cliente || 'Cliente Desconhecido',
  valorTotal: parseFloat(row.valor_total || '0'),
  quantidadeParcelas: parseInt(row.quantidade_parcelas || '0'),
  parcelaMaisAntiga: new Date(row.parcela_mais_antiga),
  diasAtrasoMax: parseInt(row.dias_atraso_max || '0'),
  empresa: row.empresa || '',
  cnpj: row.cnpj || null,
  email: row.email || null,
  endereco: row.endereco || null,
  statusClickup: row.status_clickup || null,
  responsavel: row.responsavel || null,
  cluster: row.cluster || null,
  servicos: row.servicos || null,
  telefone: row.telefone || null,
  vendedor: row.vendedor || null,
  squad: row.squad || null,
}));
```

- [ ] **Step 4: Incluir email/endereço também para clientes históricos em `routes/juridico.ts`**

Em `server/routes/juridico.ts`, o bloco de clientes históricos (linha ~215) cria objetos mínimos. Adicione `email: null` e `endereco: null` no objeto `cliente` para manter consistência do tipo:

```ts
clientesHistoricos.push({
  cliente: {
    idCliente: clienteId,
    nomeCliente: nomeReal,
    valorTotal: contexto.valorAcordado || 0,
    quantidadeParcelas: 0,
    parcelaMaisAntiga: '',
    diasAtrasoMax: 0,
    empresa: empresaReal,
    cnpj: null,
    email: null,
    endereco: null,
    statusClickup: null,
    responsavel: null,
    cluster: null,
    servicos: null,
    telefone: null,
  },
  // restante inalterado
});
```

Além disso, atualize a query de nomes históricos (linha ~180) para também buscar email e endereço:

```sql
SELECT DISTINCT ON (TRIM(ids::text))
  TRIM(ids::text) as id_cliente,
  nome,
  COALESCE(empresa, '') as empresa,
  email,
  endereco
FROM "Conta Azul".caz_clientes
WHERE ids IS NOT NULL AND TRIM(ids::text) = ANY(${idsHistoricoNaoInadimplentes})
ORDER BY TRIM(ids::text)
```

E no laço que popula `clientesHistoricos`, use esses valores:

```ts
const clienteInfo = nomesClientesHistoricos[clienteId];
// ...
clientesHistoricos.push({
  cliente: {
    // ... campos existentes
    email: clienteInfo?.email || null,
    endereco: clienteInfo?.endereco || null,
    // ...
  },
  // ...
});
```

E atualize o tipo do lookup:

```ts
const nomesClientesHistoricos: Record<string, { nome: string; empresa: string; email: string | null; endereco: string | null }> = {};
// ...
for (const row of nomesResult.rows as any[]) {
  nomesClientesHistoricos[row.id_cliente] = { 
    nome: row.nome || '', 
    empresa: row.empresa || '',
    email: row.email || null,
    endereco: row.endereco || null,
  };
}
```

- [ ] **Step 5: Validar a query no banco local antes de prosseguir**

Execute com o servidor rodando (ou via `psql` direto no Cloud SQL local clone):

```bash
# Reiniciar dev server
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &

# Esperar 5s e testar endpoint
sleep 5 && curl -s http://localhost:3000/api/juridico/clientes \
  -H "Cookie: $(cat ~/.cortex_dev_cookie 2>/dev/null)" | jq '.clientes[0].cliente | {nomeCliente, email, endereco}'
```

Expected: JSON com `nomeCliente`, `email` (pode ser null) e `endereco` (pode ser null).

Se der 401/403 (auth), rode via psql:

```bash
psql "$DATABASE_URL" -c "SELECT email, endereco FROM \"Conta Azul\".caz_clientes WHERE email IS NOT NULL LIMIT 3;"
```

Expected: 3 linhas com emails válidos.

- [ ] **Step 6: Commit**

```bash
git add server/storage.ts server/routes/juridico.ts
git commit -m "$(cat <<'EOF'
feat(juridico): expose email and endereco from caz_clientes in inadimplencia endpoint

Required for the upcoming extrajudicial notification feature in the
legal funnel. Adds both fields to the storage method query and propagates
them through the GET /api/juridico/clientes response.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Criar tipos compartilhados da função de renderização

**Files:**
- Create: `client/src/lib/notificacao-extrajudicial.ts`

- [ ] **Step 1: Criar o arquivo com tipos públicos**

Crie `client/src/lib/notificacao-extrajudicial.ts` com o conteúdo inicial:

```ts
export interface ParcelaParaNotificacao {
  naoPago: number;
  dataVencimento: string; // ISO date ou data parseável por new Date()
}

export interface ClienteParaNotificacao {
  nomeCliente: string;
  empresa: string;
  cnpj: string | null;
}

export interface FormularioNotificacao {
  email: string;
  endereco: string;
  numeroContrato: string;
  dataContrato: string; // ISO yyyy-mm-dd (input date HTML)
  nomeServico: string;
}

export interface RenderizarInput {
  cliente: ClienteParaNotificacao;
  parcelas: ParcelaParaNotificacao[];
  form: FormularioNotificacao;
  hoje?: Date; // injetável para testes determinísticos
}

// Stubs que serão implementados nas próximas tasks
export function renderizarNotificacao(_input: RenderizarInput): string {
  return '';
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/notificacao-extrajudicial.ts
git commit -m "$(cat <<'EOF'
feat(juridico): scaffold notification rendering module with types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Implementar `formatarMesesEmAtraso` (TDD)

**Files:**
- Modify: `client/src/lib/notificacao-extrajudicial.ts`
- Create: `client/src/lib/notificacao-extrajudicial.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Crie `client/src/lib/notificacao-extrajudicial.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatarMesesEmAtraso } from './notificacao-extrajudicial';

describe('formatarMesesEmAtraso', () => {
  it('formata um único mês', () => {
    expect(formatarMesesEmAtraso(['2026-02-10'])).toBe('fevereiro/2026');
  });

  it('formata dois meses com "e"', () => {
    expect(formatarMesesEmAtraso(['2026-01-10', '2026-02-10']))
      .toBe('janeiro/2026 e fevereiro/2026');
  });

  it('formata três meses com vírgulas e "e"', () => {
    expect(formatarMesesEmAtraso(['2026-01-10', '2026-02-10', '2026-03-10']))
      .toBe('janeiro/2026, fevereiro/2026 e março/2026');
  });

  it('remove duplicatas do mesmo mês/ano', () => {
    expect(formatarMesesEmAtraso(['2026-01-05', '2026-01-15', '2026-02-10']))
      .toBe('janeiro/2026 e fevereiro/2026');
  });

  it('ordena cronologicamente mesmo com entrada fora de ordem', () => {
    expect(formatarMesesEmAtraso(['2026-03-10', '2026-01-10', '2026-02-10']))
      .toBe('janeiro/2026, fevereiro/2026 e março/2026');
  });

  it('lida com parcelas em anos diferentes', () => {
    expect(formatarMesesEmAtraso(['2025-12-10', '2026-01-10']))
      .toBe('dezembro/2025 e janeiro/2026');
  });

  it('retorna string vazia para array vazio', () => {
    expect(formatarMesesEmAtraso([])).toBe('');
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

```bash
cd /Users/mac0267/Cortex && npx vitest run client/src/lib/notificacao-extrajudicial.test.ts
```

Expected: FAIL com "formatarMesesEmAtraso is not a function" ou similar.

- [ ] **Step 3: Implementar a função**

Em `client/src/lib/notificacao-extrajudicial.ts`, adicione (antes do `renderizarNotificacao`):

```ts
const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function formatarMesesEmAtraso(datas: string[]): string {
  if (datas.length === 0) return '';

  // Extrair pares únicos (ano, mês) e ordenar
  const chaves = new Set<string>();
  const pares: Array<{ ano: number; mes: number }> = [];

  for (const data of datas) {
    const d = new Date(data);
    if (isNaN(d.getTime())) continue;
    const ano = d.getUTCFullYear();
    const mes = d.getUTCMonth();
    const chave = `${ano}-${mes}`;
    if (!chaves.has(chave)) {
      chaves.add(chave);
      pares.push({ ano, mes });
    }
  }

  pares.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);

  const labels = pares.map(p => `${MESES_PT[p.mes]}/${p.ano}`);

  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}
```

Observação: usamos `getUTCMonth`/`getUTCFullYear` para evitar bugs de timezone em datas ISO sem hora (ex: `"2026-01-10"` vira `2026-01-10T00:00:00Z`; com `getMonth()` em timezone negativo viraria dezembro/2025).

- [ ] **Step 4: Rodar testes e confirmar que passam**

```bash
cd /Users/mac0267/Cortex && npx vitest run client/src/lib/notificacao-extrajudicial.test.ts
```

Expected: 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/notificacao-extrajudicial.ts client/src/lib/notificacao-extrajudicial.test.ts
git commit -m "$(cat <<'EOF'
feat(juridico): add formatarMesesEmAtraso helper

Formata lista de datas de vencimento em string de meses/ano
ordenada cronologicamente, com tratamento de duplicatas e
timezone via getUTC*. Cobre parcelas em anos diferentes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Implementar `formatarValoresDescricao` (regra híbrida, TDD)

**Files:**
- Modify: `client/src/lib/notificacao-extrajudicial.ts`
- Modify: `client/src/lib/notificacao-extrajudicial.test.ts`

- [ ] **Step 1: Adicionar testes**

Adicione ao final de `notificacao-extrajudicial.test.ts`:

```ts
import { formatarValoresDescricao } from './notificacao-extrajudicial';

describe('formatarValoresDescricao', () => {
  it('usa formato "cada uma" quando todas as parcelas têm mesmo valor', () => {
    const parcelas = [
      { naoPago: 6000, dataVencimento: '2026-01-10' },
      { naoPago: 6000, dataVencimento: '2026-02-10' },
      { naoPago: 6000, dataVencimento: '2026-03-10' },
    ];
    expect(formatarValoresDescricao(parcelas))
      .toBe('no valor de R$ 6.000,00 cada uma');
  });

  it('tolera diferenças de até R$ 0,01 como mesmo valor', () => {
    const parcelas = [
      { naoPago: 6000.00, dataVencimento: '2026-01-10' },
      { naoPago: 6000.001, dataVencimento: '2026-02-10' },
    ];
    expect(formatarValoresDescricao(parcelas))
      .toBe('no valor de R$ 6.000,00 cada uma');
  });

  it('usa formato de lista quando valores variam', () => {
    const parcelas = [
      { naoPago: 5000, dataVencimento: '2026-01-10' },
      { naoPago: 5000, dataVencimento: '2026-02-10' },
      { naoPago: 3200, dataVencimento: '2026-03-10' },
    ];
    expect(formatarValoresDescricao(parcelas))
      .toBe('sendo R$ 5.000,00 com vencimento em 10/01/2026, R$ 5.000,00 com vencimento em 10/02/2026 e R$ 3.200,00 com vencimento em 10/03/2026');
  });

  it('retorna string vazia para lista vazia', () => {
    expect(formatarValoresDescricao([])).toBe('');
  });

  it('usa "no valor de R$ X" para parcela única', () => {
    const parcelas = [{ naoPago: 6000, dataVencimento: '2026-01-10' }];
    expect(formatarValoresDescricao(parcelas))
      .toBe('no valor de R$ 6.000,00');
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

```bash
cd /Users/mac0267/Cortex && npx vitest run client/src/lib/notificacao-extrajudicial.test.ts
```

Expected: FAIL — `formatarValoresDescricao is not a function`.

- [ ] **Step 3: Implementar a função**

Adicione ao `notificacao-extrajudicial.ts`:

```ts
function formatarBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

function formatarDataBR(dataIso: string): string {
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function formatarValoresDescricao(parcelas: ParcelaParaNotificacao[]): string {
  if (parcelas.length === 0) return '';

  if (parcelas.length === 1) {
    return `no valor de ${formatarBRL(parcelas[0].naoPago)}`;
  }

  const primeiro = parcelas[0].naoPago;
  const todosIguais = parcelas.every(p => Math.abs(p.naoPago - primeiro) < 0.01);

  if (todosIguais) {
    return `no valor de ${formatarBRL(primeiro)} cada uma`;
  }

  const items = parcelas.map(p =>
    `${formatarBRL(p.naoPago)} com vencimento em ${formatarDataBR(p.dataVencimento)}`
  );

  if (items.length === 2) {
    return `sendo ${items[0]} e ${items[1]}`;
  }
  return `sendo ${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}
```

- [ ] **Step 4: Rodar testes e confirmar que passam**

```bash
cd /Users/mac0267/Cortex && npx vitest run client/src/lib/notificacao-extrajudicial.test.ts
```

Expected: 12 tests passed (7 anteriores + 5 novos).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/notificacao-extrajudicial.ts client/src/lib/notificacao-extrajudicial.test.ts
git commit -m "$(cat <<'EOF'
feat(juridico): add formatarValoresDescricao with hybrid format

Usa formato 'cada uma' quando valores iguais, senão lista detalhada
com data de vencimento de cada parcela.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Implementar `anoPorExtenso` + template completo (TDD)

**Files:**
- Modify: `client/src/lib/notificacao-extrajudicial.ts`
- Modify: `client/src/lib/notificacao-extrajudicial.test.ts`

- [ ] **Step 1: Adicionar testes para renderização completa**

Adicione ao `notificacao-extrajudicial.test.ts`:

```ts
import { renderizarNotificacao, anoPorExtenso } from './notificacao-extrajudicial';

describe('anoPorExtenso', () => {
  it('converte 2026', () => {
    expect(anoPorExtenso(2026)).toBe('Dois Mil e Vinte e Seis');
  });
  it('converte 2025', () => {
    expect(anoPorExtenso(2025)).toBe('Dois Mil e Vinte e Cinco');
  });
  it('usa placeholder para anos fora da lista', () => {
    expect(anoPorExtenso(1999)).toBe('[ANO POR EXTENSO]');
  });
});

describe('renderizarNotificacao', () => {
  const cliente = {
    nomeCliente: 'João da Silva',
    empresa: 'EMPRESA DEVEDORA LTDA',
    cnpj: '22.222.020/0002-22',
  };

  const parcelas = [
    { naoPago: 6000, dataVencimento: '2026-01-10' },
    { naoPago: 6000, dataVencimento: '2026-02-10' },
    { naoPago: 6000, dataVencimento: '2026-03-10' },
  ];

  const form = {
    email: 'contato@devedora.com',
    endereco: 'Rua do Triunfo, 222, Vitória da Conquista/BA, CEP 45.000-000',
    numeroContrato: '000.33333.22',
    dataContrato: '2025-06-15',
    nomeServico: 'Consultoria financeira',
  };

  const hoje = new Date('2026-04-23T12:00:00Z');

  it('inclui nome e CNPJ da notificada', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('EMPRESA DEVEDORA LTDA');
    expect(texto).toContain('22.222.020/0002-22');
  });

  it('inclui endereço do formulário', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('Rua do Triunfo, 222');
  });

  it('inclui meses em atraso formatados', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('janeiro/2026, fevereiro/2026 e março/2026');
  });

  it('inclui ano principal por extenso', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('Dois Mil e Vinte e Seis');
  });

  it('inclui data do contrato formatada', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('15/06/2025');
  });

  it('inclui nome do serviço e número do contrato', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('Consultoria financeira');
    expect(texto).toContain('000.33333.22');
  });

  it('inclui valor das parcelas no formato cada uma', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('R$ 6.000,00 cada uma');
  });

  it('inclui assinatura com data de emissão', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('Vitória/ES');
    expect(texto).toContain('23/04/2026');
  });

  it('usa placeholders quando campos do form estão vazios', () => {
    const formVazio = { ...form, numeroContrato: '', dataContrato: '', nomeServico: '', endereco: '' };
    const texto = renderizarNotificacao({ cliente, parcelas, form: formVazio, hoje });
    expect(texto).toContain('[Nº DO CONTRATO]');
    expect(texto).toContain('[DATA DO CONTRATO]');
    expect(texto).toContain('[NOME DO SERVIÇO]');
    expect(texto).toContain('[ENDEREÇO NÃO INFORMADO]');
  });

  it('usa placeholder quando CNPJ é null', () => {
    const clienteSemCnpj = { ...cliente, cnpj: null };
    const texto = renderizarNotificacao({ cliente: clienteSemCnpj, parcelas, form, hoje });
    expect(texto).toContain('[CNPJ NÃO INFORMADO]');
  });

  it('faz fallback de empresa para nomeCliente quando empresa vazia', () => {
    const clienteSemEmpresa = { ...cliente, empresa: '' };
    const texto = renderizarNotificacao({ cliente: clienteSemEmpresa, parcelas, form, hoje });
    expect(texto).toContain('JOÃO DA SILVA');
  });

  it('inclui cabeçalho fixo da TURBO PARTNERS', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('TURBO PARTNERS');
    expect(texto).toContain('42.100.292/0001-84');
    expect(texto).toContain('Rua Carlos Fernando Lindenberg Filho, 90');
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

```bash
cd /Users/mac0267/Cortex && npx vitest run client/src/lib/notificacao-extrajudicial.test.ts
```

Expected: FAIL — renderização retorna string vazia, `anoPorExtenso is not a function`.

- [ ] **Step 3: Implementar `anoPorExtenso` e `renderizarNotificacao`**

Substitua em `notificacao-extrajudicial.ts` o stub de `renderizarNotificacao` e adicione `anoPorExtenso`:

```ts
const ANOS_EXTENSO: Record<number, string> = {
  2024: 'Dois Mil e Vinte e Quatro',
  2025: 'Dois Mil e Vinte e Cinco',
  2026: 'Dois Mil e Vinte e Seis',
  2027: 'Dois Mil e Vinte e Sete',
  2028: 'Dois Mil e Vinte e Oito',
  2029: 'Dois Mil e Vinte e Nove',
  2030: 'Dois Mil e Trinta',
};

export function anoPorExtenso(ano: number): string {
  return ANOS_EXTENSO[ano] ?? '[ANO POR EXTENSO]';
}

function calcularAnoPrincipal(parcelas: ParcelaParaNotificacao[]): number {
  if (parcelas.length === 0) return new Date().getUTCFullYear();
  const contagem = new Map<number, number>();
  for (const p of parcelas) {
    const d = new Date(p.dataVencimento);
    if (isNaN(d.getTime())) continue;
    const ano = d.getUTCFullYear();
    contagem.set(ano, (contagem.get(ano) ?? 0) + 1);
  }
  // Ano com mais parcelas; empate → maior
  let anoPrincipal = new Date().getUTCFullYear();
  let maxCount = -1;
  for (const [ano, count] of contagem.entries()) {
    if (count > maxCount || (count === maxCount && ano > anoPrincipal)) {
      anoPrincipal = ano;
      maxCount = count;
    }
  }
  return anoPrincipal;
}

export function renderizarNotificacao(input: RenderizarInput): string {
  const { cliente, parcelas, form, hoje = new Date() } = input;

  const nomeNotificada = (cliente.empresa?.trim() || cliente.nomeCliente || '').toUpperCase();
  const cnpjNotificada = cliente.cnpj?.trim() || '[CNPJ NÃO INFORMADO]';
  const enderecoNotificada = form.endereco.trim() || '[ENDEREÇO NÃO INFORMADO]';
  const numeroContrato = form.numeroContrato.trim() || '[Nº DO CONTRATO]';
  const dataAssinatura = form.dataContrato ? formatarDataBR(form.dataContrato) : '[DATA DO CONTRATO]';
  const nomeServico = form.nomeServico.trim() || '[NOME DO SERVIÇO]';

  const mesesEmAtraso = formatarMesesEmAtraso(parcelas.map(p => p.dataVencimento));
  const anoPrincipal = calcularAnoPrincipal(parcelas);
  const valoresDescricao = formatarValoresDescricao(parcelas);

  const dia = String(hoje.getUTCDate()).padStart(2, '0');
  const mes = String(hoje.getUTCMonth() + 1).padStart(2, '0');
  const ano = hoje.getUTCFullYear();
  const dataEmissao = `${dia}/${mes}/${ano}`;

  return `NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA

NOTIFICANTE: TURBO PARTNERS, pessoa jurídica de direito privado, com sede na Rua Carlos Fernando Lindenberg Filho, 90, no bairro Monte Belo, em Vitória - ES, CEP 29053-315, inscrita no CNPJ sob o nº 42.100.292/0001-84.

NOTIFICADA: ${nomeNotificada}, inscrita no CNPJ sob o nº ${cnpjNotificada}, a qual possui sede em ${enderecoNotificada}.

Por meio da presente Notificação Extrajudicial, a NOTIFICANTE, servindo-se da via Cartório de Títulos e Documentos, vem comunicar à NOTIFICADA acerca da sua patente e real inadimplência existente perante a ora NOTIFICANTE, referente aos débitos tocantes aos meses de ${mesesEmAtraso || '[MESES EM ATRASO]'}, de ${anoPrincipal} (${anoPorExtenso(anoPrincipal)}), que estão em ATRASO.

Deve-se, aqui, rememorar que em ${dataAssinatura} a NOTIFICADA firmou um contrato específico de compra e venda de "${nomeServico}" com a NOTIFICANTE, o qual está registrado sob o nº ${numeroContrato}, obrigando-se a pagar parcelas ${valoresDescricao || '[VALORES DAS PARCELAS]'}, no que concerne à contratação do serviço já citado acima.

Cumpre informar, através deste documento, portanto, que, nos termos do artigo 726 do Código de Processo Civil (Lei 13.105/2015), caso as parcelas não sejam quitadas até 10 (Dez) dias após o recebimento desta Notificação Extrajudicial, serão tomadas as medidas judiciais cabíveis, bem como a NOTIFICANTE procederá à abertura de inscrição do nome do NOTIFICADO junto aos órgãos competentes: SERASA - SCPC, consoante determina o artigo 43 parágrafo 3º da Lei nº 8.078/1990.


Sem mais, e nos termos da lei,

Vitória/ES, ${dataEmissao}.`;
}
```

- [ ] **Step 4: Rodar testes e confirmar que passam**

```bash
cd /Users/mac0267/Cortex && npx vitest run client/src/lib/notificacao-extrajudicial.test.ts
```

Expected: All tests pass (12 anteriores + 3 anoPorExtenso + 12 renderizar = 27 total).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/notificacao-extrajudicial.ts client/src/lib/notificacao-extrajudicial.test.ts
git commit -m "$(cat <<'EOF'
feat(juridico): implement renderizarNotificacao with template substitution

Função pura que monta a notificação extrajudicial com todas as
variáveis substituídas. Aceita Date injetável para testes
determinísticos. Placeholders explícitos quando dados estão ausentes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Criar componente `NotificacaoExtrajudicialModal`

**Files:**
- Create: `client/src/components/juridico/NotificacaoExtrajudicialModal.tsx`

- [ ] **Step 1: Criar o arquivo do modal**

Crie o diretório se necessário e o arquivo `client/src/components/juridico/NotificacaoExtrajudicialModal.tsx`:

```tsx
import { useState, useMemo, useRef } from 'react';
import { Mail, Copy, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  renderizarNotificacao,
  type ClienteParaNotificacao,
  type ParcelaParaNotificacao,
  type FormularioNotificacao,
} from '@/lib/notificacao-extrajudicial';

interface NotificacaoExtrajudicialModalProps {
  open: boolean;
  onClose: () => void;
  cliente: ClienteParaNotificacao & {
    email: string | null;
    endereco: string | null;
    servicos: string | null;
  };
  parcelas: ParcelaParaNotificacao[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAILTO_MAX_LENGTH = 1800;

export function NotificacaoExtrajudicialModal({
  open,
  onClose,
  cliente,
  parcelas,
}: NotificacaoExtrajudicialModalProps) {
  const { toast } = useToast();

  const [form, setForm] = useState<FormularioNotificacao>({
    email: cliente.email ?? '',
    endereco: cliente.endereco ?? '',
    numeroContrato: '',
    dataContrato: '',
    nomeServico: cliente.servicos ?? '',
  });

  const [previewEditado, setPreviewEditado] = useState<string | null>(null);
  const [manualEdit, setManualEdit] = useState(false);

  const previewGerado = useMemo(
    () => renderizarNotificacao({ cliente, parcelas, form }),
    [cliente, parcelas, form],
  );

  const preview = manualEdit && previewEditado !== null ? previewEditado : previewGerado;

  const emailValido = EMAIL_REGEX.test(form.email.trim());
  const emailAusenteNoBanco = !cliente.email;

  const handleFormChange = (campo: keyof FormularioNotificacao, valor: string) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const handlePreviewChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPreviewEditado(e.target.value);
    setManualEdit(true);
  };

  const handleRestaurar = () => {
    setManualEdit(false);
    setPreviewEditado(null);
  };

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      toast({ title: 'Texto copiado!', description: 'Notificação copiada para a área de transferência.' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleAbrirEmail = () => {
    const encoded = encodeURIComponent(preview);
    if (encoded.length > MAILTO_MAX_LENGTH) {
      toast({
        title: 'Texto muito longo para mailto',
        description: "Use 'Copiar texto' e cole no cliente de email.",
      });
      return;
    }
    const subject = encodeURIComponent('Notificação Extrajudicial de Cobrança - TURBO PARTNERS');
    const mailto = `mailto:${encodeURIComponent(form.email.trim())}?subject=${subject}&body=${encoded}`;
    window.location.href = mailto;
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notificação Extrajudicial de Cobrança</DialogTitle>
          <DialogDescription>
            {cliente.empresa || cliente.nomeCliente}
          </DialogDescription>
        </DialogHeader>

        {emailAusenteNoBanco && (
          <div
            className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3 text-sm text-yellow-800 dark:text-yellow-200"
            data-testid="alert-email-ausente"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Email não cadastrado em <code>caz_clientes</code>. Preencha manualmente abaixo para continuar.
            </span>
          </div>
        )}

        <div className="space-y-6">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dados do Notificado
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="notif-email">Email do notificado</Label>
                <Input
                  id="notif-email"
                  type="email"
                  value={form.email}
                  onChange={e => handleFormChange('email', e.target.value)}
                  placeholder="contato@empresa.com"
                  data-testid="input-email-notificado"
                />
              </div>
              <div>
                <Label htmlFor="notif-endereco">Endereço completo</Label>
                <Input
                  id="notif-endereco"
                  value={form.endereco}
                  onChange={e => handleFormChange('endereco', e.target.value)}
                  placeholder="Rua X, 123, Cidade/UF, CEP 00000-000"
                  data-testid="input-endereco-notificado"
                />
              </div>
              <div>
                <Label htmlFor="notif-contrato">Nº do contrato</Label>
                <Input
                  id="notif-contrato"
                  value={form.numeroContrato}
                  onChange={e => handleFormChange('numeroContrato', e.target.value)}
                  placeholder="000.33333.22"
                  data-testid="input-numero-contrato"
                />
              </div>
              <div>
                <Label htmlFor="notif-data-contrato">Data de assinatura do contrato</Label>
                <Input
                  id="notif-data-contrato"
                  type="date"
                  value={form.dataContrato}
                  onChange={e => handleFormChange('dataContrato', e.target.value)}
                  data-testid="input-data-contrato"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dados do Contrato
            </h4>
            <div>
              <Label htmlFor="notif-servico">Nome do serviço contratado</Label>
              <Input
                id="notif-servico"
                value={form.nomeServico}
                onChange={e => handleFormChange('nomeServico', e.target.value)}
                placeholder="Consultoria financeira"
                data-testid="input-nome-servico"
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Preview da Notificação
              </h4>
              {manualEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestaurar}
                  data-testid="button-restaurar-preview"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Restaurar do formulário
                </Button>
              )}
            </div>
            <Textarea
              value={preview}
              onChange={handlePreviewChange}
              className="font-mono text-xs min-h-[500px]"
              data-testid="textarea-preview-notificacao"
            />
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} data-testid="button-fechar-notificacao">
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={handleAbrirEmail}
            disabled={!emailValido}
            data-testid="button-abrir-email"
          >
            <Mail className="h-4 w-4 mr-2" />
            Abrir no email
          </Button>
          <Button onClick={handleCopiar} data-testid="button-copiar-notificacao">
            <Copy className="h-4 w-4 mr-2" />
            Copiar texto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar type-check passa**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "notificacao|NotificacaoExtrajudicial" | head -20
```

Expected: nenhuma saída (sem erros relacionados ao módulo novo).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/juridico/NotificacaoExtrajudicialModal.tsx
git commit -m "$(cat <<'EOF'
feat(juridico): add NotificacaoExtrajudicialModal component

Modal com form de campos ausentes no banco, preview editável em tempo
real (com proteção contra sobrescrita após edição manual) e ações
copiar / abrir mailto.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Integrar botão no card do funil jurídico

**Files:**
- Modify: `client/src/pages/JuridicoClientes.tsx`

- [ ] **Step 1: Atualizar a interface `ClienteInadimplente`**

Em `JuridicoClientes.tsx`, localize a interface `ClienteInadimplente` (linha ~83) e adicione os novos campos:

```ts
interface ClienteInadimplente {
  idCliente: string;
  nomeCliente: string;
  valorTotal: number;
  quantidadeParcelas: number;
  parcelaMaisAntiga: string;
  diasAtrasoMax: number;
  empresa: string;
  cnpj: string | null;
  email: string | null;
  endereco: string | null;
  statusClickup: string | null;
  responsavel: string | null;
  cluster: string | null;
  servicos: string | null;
  telefone: string | null;
}
```

- [ ] **Step 2: Importar o modal e ícone Mail**

No bloco de imports de ícones lucide (linha ~28), adicione `Mail`:

```tsx
import {
  Scale,
  Users,
  // ... existentes
  Receipt,
  Mail,
} from "lucide-react";
```

Adicione import do modal junto aos outros imports (depois do import de `queryClient`):

```tsx
import { NotificacaoExtrajudicialModal } from "@/components/juridico/NotificacaoExtrajudicialModal";
```

- [ ] **Step 3: Adicionar estado do modal**

Dentro do componente (após `const [editingCliente, ...]` linha ~233), adicione:

```ts
const [notificacaoCliente, setNotificacaoCliente] = useState<ClienteJuridico | null>(null);
```

- [ ] **Step 4: Adicionar o botão no card (condicional)**

Localize o bloco `{/* Linha 3: Botões de Ação - Grid em mobile */}` (linha ~1184). Dentro dele, **antes** do botão "Atualizar" (linha ~1214), adicione:

```tsx
{item.contexto?.procedimentoJuridico === "notificacao" && (
  <Button
    size="default"
    variant="outline"
    className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 flex-1 sm:flex-none min-w-[100px]"
    onClick={() => setNotificacaoCliente(item)}
    data-testid={`button-notificacao-${index}`}
  >
    <Mail className="h-4 w-4 mr-1.5 sm:mr-2" />
    <span className="hidden xs:inline">Gerar Notificação</span>
    <span className="xs:hidden">Notificar</span>
  </Button>
)}
```

- [ ] **Step 5: Renderizar o modal ao final do componente**

No final do JSX, antes de fechar o componente raiz (procure pelo último `</div>` ou `</>` do return principal — logo antes do dialog de edição existente ou após ele), adicione:

```tsx
{notificacaoCliente && (
  <NotificacaoExtrajudicialModal
    open={!!notificacaoCliente}
    onClose={() => setNotificacaoCliente(null)}
    cliente={{
      nomeCliente: notificacaoCliente.cliente.nomeCliente,
      empresa: notificacaoCliente.cliente.empresa,
      cnpj: notificacaoCliente.cliente.cnpj,
      email: notificacaoCliente.cliente.email,
      endereco: notificacaoCliente.cliente.endereco,
      servicos: notificacaoCliente.cliente.servicos,
    }}
    parcelas={notificacaoCliente.parcelas.map(p => ({
      naoPago: p.naoPago,
      dataVencimento: p.dataVencimento,
    }))}
  />
)}
```

- [ ] **Step 6: Rodar type-check**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "JuridicoClientes|notificacao" | head -20
```

Expected: sem erros.

- [ ] **Step 7: Rodar testes unitários (garantir que nada quebrou)**

```bash
cd /Users/mac0267/Cortex && npx vitest run client/src/lib/notificacao-extrajudicial.test.ts client/src/lib/utils.test.ts
```

Expected: todos passam.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/JuridicoClientes.tsx
git commit -m "$(cat <<'EOF'
feat(juridico): integrate extrajudicial notification modal in client card

Botão 'Gerar Notificação' aparece apenas quando procedimentoJuridico
é 'notificacao'. Exibe modal com substituição automática de variáveis
e ações de copiar / abrir mailto.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Testes manuais e validação final

**Files:** nenhuma modificação — apenas validação no navegador.

- [ ] **Step 1: Reiniciar dev server**

```bash
cd /Users/mac0267/Cortex && lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Esperar até aparecer "Server running on http://localhost:3000".

- [ ] **Step 2: Teste funcional — fluxo feliz**

Abrir `http://localhost:3000/juridico/clientes` no navegador:

1. Encontrar um cliente com `procedimentoJuridico = "notificacao"` (ou atualizar um cliente via botão "Atualizar" para setar esse procedimento).
2. Verificar que o botão "Gerar Notificação" aparece só nesse cliente.
3. Clicar no botão → modal abre.
4. Confirmar que email e endereço estão pré-preenchidos se existirem em `caz_clientes`.
5. Preencher número do contrato (ex: `000.33333.22`), data de assinatura (ex: `15/06/2025`), nome do serviço.
6. Observar que o preview atualiza em tempo real conforme os inputs mudam.
7. Clicar em "Copiar texto" → toast de sucesso aparece; colar em qualquer editor e conferir formato.
8. Clicar em "Abrir no email" → cliente de email nativo (Mail/Outlook/Thunderbird) abre com destinatário, assunto e corpo preenchidos.

- [ ] **Step 3: Teste funcional — email ausente**

1. Encontrar cliente sem email em `caz_clientes` (ou editar manualmente no banco para um cliente de teste).
2. Verificar que o alert amarelo aparece no topo do modal.
3. Verificar que o botão "Abrir no email" fica desabilitado até preencher email válido.

- [ ] **Step 4: Teste funcional — edição manual do preview**

1. Abrir o modal com cliente com dados completos.
2. Editar manualmente o textarea do preview.
3. Observar que o botão "Restaurar do formulário" aparece.
4. Alterar um input do form → preview NÃO sobrescreve a edição manual.
5. Clicar em "Restaurar do formulário" → texto volta ao gerado pelo form.

- [ ] **Step 5: Teste dark mode / light mode**

1. Alternar tema via toggle da aplicação.
2. Abrir o modal em dark mode → cores coerentes, alert amarelo legível, inputs com borda visível.
3. Abrir em light mode → idem.

- [ ] **Step 6: Teste mobile (responsive)**

Usando DevTools (iPhone 13 ou similar):

1. Abrir o modal → seções empilham em 1 coluna.
2. Botões do footer continuam acessíveis.
3. Textarea do preview é utilizável.

- [ ] **Step 7: Rodar suite completa de testes unitários**

```bash
cd /Users/mac0267/Cortex && npm test
```

Expected: todos os tests passam (incluindo os 27 novos do `notificacao-extrajudicial.test.ts`).

- [ ] **Step 8: Atualizar Obsidian e chamado (workflow pós-task)**

Conforme `CLAUDE.md` (seção Workflow Pós-Conclusão):
1. Commit + push já foi feito task a task.
2. Atualizar arquivo de task no Obsidian vault (se houver TASK-N associada).
3. Se for resposta a um chamado, atualizar status para `review` no `cortex_core.chamados`.

---

## Self-Review

### Cobertura da spec
- ✅ §2.1.1 Botão condicional ao procedimento `notificacao` → Task 7 Step 4
- ✅ §2.1.2 Modal com form + preview editável → Task 6
- ✅ §2.1.3 Função pura de substituição → Tasks 3, 4, 5
- ✅ §2.1.4 Copiar + mailto → Task 6
- ✅ §2.1.5 Backend expõe email e endereço → Task 1
- ✅ §4.3 Estado manualEdit + Restaurar → Task 6
- ✅ §4.4 Validação de email válido → Task 6
- ✅ §4.5 Limite de 1800 chars no mailto → Task 6
- ✅ §5.2 Todas as variáveis derivadas → Tasks 3, 4, 5
- ✅ §5.3 Regra híbrida de valores → Task 4
- ✅ §7 Edge cases → cobertos nos testes (Tasks 3, 4, 5) e manual (Task 8)
- ✅ §8.1 Testes unitários obrigatórios → Tasks 3, 4, 5
- ✅ §8.2 Testes manuais → Task 8

### Placeholders
Nenhum TBD/TODO/etc. Todos os steps têm código ou comandos concretos.

### Consistência de tipos
- `ClienteParaNotificacao` (lib) → cliente passa `nomeCliente`, `empresa`, `cnpj`. Task 7 Step 5 mapeia corretamente.
- `ParcelaParaNotificacao` exige `naoPago` e `dataVencimento`. Task 7 Step 5 mapeia corretamente a partir de `Parcela`.
- `FormularioNotificacao` consistente entre lib e modal.
- Backend retorna `email: string | null` e `endereco: string | null`. Frontend espera mesmo formato.

Plano completo.
