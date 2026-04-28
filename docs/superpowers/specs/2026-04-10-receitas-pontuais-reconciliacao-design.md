# Receitas Pontuais — Reconciliação Cumulativa por Caixa (A3)

**Data:** 2026-04-10
**Status:** Aprovado, pronto para plano de implementação
**Escopo:** `server/routes.ts` endpoint `/api/contribuicao-squad/dfc/bulk` (lado de receitas)

---

## Contexto

Hoje a aba **Contribuição por Squad** filtra `WHERE valorr > 0` na query de receitas, ignorando totalmente os contratos pontuais (`valorp`). O squad **Tech** aparece com R$ 32k em vez dos R$ 2.288k reais; **Creators 1ª-4ª Entrega** (squad Makers) aparece com R$ 0; e qualquer projeto pontual à vista também desaparece.

A versão anterior do código contava `valorr + valorp`, mas tinha duas distorções graves:

1. **Tech parcelado:** vendia ecommerce R$ 20k em 10x, mas o sistema contava R$ 20k cheio toda vez que o cliente pagava qualquer parcela. Inflação de até 10×.
2. **Creators 4 entregas:** cliente compra 4 contratos do mesmo valor (1ª, 2ª, 3ª, 4ª Entrega), paga 1 entrega/mês; sistema contava os 4 contratos cheios todo mês = inflação 4×.

A solução A3 ataca os dois problemas usando **reconciliação cumulativa por caixa**: cada contrato pontual tem um "saldo devedor" que diminui mês a mês conforme o cliente paga, e nunca passa do `valorp` cheio.

---

## Decisões tomadas no brainstorm

| # | Pergunta | Decisão |
|---|----------|---------|
| 1 | Como atribuir parcelas do Conta Azul a contratos? | **Reconciliação cumulativa A3** — recorrentes recebem prioridade, sobra alimenta pontuais em FIFO por `data_inicio` até saldo zerar |
| 2 | Implementação SQL ou JS? | **Opção 1** — SQL devolve dados crus (contratos + pagamentos cronológicos), JS faz a simulação |
| 3 | Janela temporal para a simulação? | **Desde sempre** — para cada cliente, simular do primeiro pagamento histórico até o mês atual |
| 4 | Pontuais cancelados? | **Competem até `data_fim`** (`data_solicitacao_encerramento` ou `data_encerramento`, o que vier primeiro). Depois saem da fila. Saldo restante evapora. |
| 5 | Recorrente quando cliente paga parcial? | **Conta cheio (`valorr`)** se houver qualquer pagamento — preserva comportamento atual. Sobra usa `MAX(0, total_pago - SUM(valorr))`. |
| 6 | Clientes sem contrato no Clickup? | **Ocultar completamente** — não viram linha "Sem Squad" como antes |

---

## Algoritmo da simulação

### Tipos

```typescript
type ContratoTipo = 'recorrente' | 'pontual';

interface ContratoSim {
  id_subtask: string;
  cnpj: string;
  squad: string;
  servico: string;
  tipo: ContratoTipo;
  valor: number;                  // valorr (recorrente) ou valorp (pontual)
  data_inicio: Date;
  data_fim: Date | null;          // primeiro de [data_solicitacao_encerramento, data_encerramento]
  status: string;
  // estado mutável durante a simulação:
  saldo_devedor: number;          // só pontual; recorrente fica em 0 e não é usado
  recebido_por_mes: Map<string, number>; // 'YYYY-MM' -> valor recebido
}

interface ClienteSim {
  cnpj: string;
  cliente_nome: string;
  contratos: ContratoSim[];
  pagamentos_por_mes: Map<string, number>; // 'YYYY-MM' -> SUM(valor_pago)
}
```

### Função `contratoAtivoEm`

```typescript
function contratoAtivoEm(c: ContratoSim, mesYYYYMM: string): boolean {
  const inicioMes = primeiroDiaDoMes(mesYYYYMM); // ex: 2026-04-01
  const fimMes = ultimoDiaDoMes(mesYYYYMM);       // ex: 2026-04-30

  // Não começou ainda
  if (c.data_inicio > fimMes) return false;
  // Já encerrou antes do mês começar
  if (c.data_fim && c.data_fim < inicioMes) return false;
  // Recorrente excluído por status
  if (c.tipo === 'recorrente' && ['Cancelado', 'Encerrado', 'Pausado'].includes(c.status)) return false;
  // Pontual: status não exclui (pontual concluído fica como "entregue")

  return true;
}
```

### Função `simulateCliente`

```typescript
function simulateCliente(cliente: ClienteSim, mesAtualYYYYMM: string): void {
  // 1. Inicializar saldo devedor de cada pontual
  for (const c of cliente.contratos) {
    if (c.tipo === 'pontual') c.saldo_devedor = c.valor;
  }

  // 2. Construir lista cronológica de meses
  const mesesPagos = Array.from(cliente.pagamentos_por_mes.keys()).sort();
  if (mesesPagos.length === 0) return;
  const todosMeses = gerarMesesEntre(mesesPagos[0], mesAtualYYYYMM);

  // 3. Simular mês a mês
  for (const mes of todosMeses) {
    const totalPago = cliente.pagamentos_por_mes.get(mes) || 0;
    const ativos = cliente.contratos.filter(c => contratoAtivoEm(c, mes));

    // 3a. Recorrentes contam cheio se totalPago > 0
    const recorrentes = ativos.filter(c => c.tipo === 'recorrente');
    const somaRecorrentes = recorrentes.reduce((s, c) => s + c.valor, 0);
    if (totalPago > 0) {
      for (const r of recorrentes) {
        r.recebido_por_mes.set(mes, r.valor);
      }
    }

    // 3b. Sobra alimenta pontuais em FIFO
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

### Agregação final (depois de simular todos os clientes)

```typescript
// Para cada (squad, mes) do ANO SELECIONADO, somar c.recebido_por_mes[mes]
// Para cada (squad, cliente) do ANO SELECIONADO, somar igual
```

### Walkthrough — caso real CNPJ 03364572000148

**Setup:** Performance R$ 1.997/mês recorrente (Squadra) + Ecommerce R$ 15.000 pontual (Tech, `data_inicio = 2025-09-22`).

| Mês | Pago total | Recorr | Sobra | Saldo Ecomm antes | Atribui | Saldo depois |
|-----|-----------|--------|-------|-------------------|---------|--------------|
| Set/25 | 5.512 | 1.997 | 3.515 | 15.000 | 3.515 | 11.485 |
| Out/25 | 5.512 | 1.997 | 3.515 | 11.485 | 3.515 | 7.970 |
| Nov/25 | 1.967 | 1.997 (cheio mesmo pagando 1.967) | 0 | 7.970 | 0 | 7.970 |
| Dez/25 | 1.967 | 1.997 | 0 | 7.970 | 0 | 7.970 |
| Jan/26 | 1.967 | 1.997 | 0 | 7.970 | 0 | 7.970 |
| Fev/26 | 1.997 | 1.997 | 0 | 7.970 | 0 | 7.970 |
| Mar/26 | 1.997 | 1.997 | 0 | 7.970 | 0 | 7.970 |

**Resultado:** Tech Ecommerce recebe R$ 7.030 acumulados; saldo de R$ 7.970 ainda devido. Squadra Performance recebe R$ 1.997 todo mês (mesmo Nov-Jan onde cliente pagou só R$ 1.967 — decisão #5).

### Walkthrough — caso Creators (4 entregas)

**Setup:** 4 contratos pontuais Creators (1ª, 2ª, 3ª, 4ª Entrega) × R$ 6.799 cada = R$ 27.196 total. Sem recorrente. Cliente paga R$ 6.799/mês durante 4 meses.

| Mês | Pago | Sobra | 1ª Entr | 2ª Entr | 3ª Entr | 4ª Entr |
|-----|------|-------|---------|---------|---------|---------|
| Mês 1 | 6.799 | 6.799 | **6.799** (saldo→0) | 0 | 0 | 0 |
| Mês 2 | 6.799 | 6.799 | 0 | **6.799** (saldo→0) | 0 | 0 |
| Mês 3 | 6.799 | 6.799 | 0 | 0 | **6.799** (saldo→0) | 0 |
| Mês 4 | 6.799 | 6.799 | 0 | 0 | 0 | **6.799** (saldo→0) |
| Mês 5 | 0 | 0 | 0 | 0 | 0 | 0 |

**Total atribuído:** R$ 27.196 ao squad Makers, distribuído ao longo de 4 meses, sem inflação.

---

## Queries SQL (Opção 1)

### Query 1 — Contratos relevantes

```sql
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
```

**Notas:**
- A query NÃO filtra por ano nem por squad — JS aplica esses filtros depois
- A query NÃO exclui status — JS aplica via `contratoAtivoEm`

### Query 2 — Pagamentos cronológicos por cliente

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
GROUP BY cnpj_limpo, caz.nome, TO_CHAR(p.data_quitacao, 'YYYY-MM')
ORDER BY cnpj_limpo, mes
```

**Notas:**
- Agrega `valor_pago` por (cliente, mês). Devolve histórico inteiro.
- Não filtra por ano. A simulação precisa do contexto cumulativo desde o primeiro pagamento.

### Query 3 — Despesas (sem mudança)

A query proporcional de salários e a query de freelancers continuam idênticas. **A3 só afeta receitas.**

---

## Estrutura de arquivos

| Arquivo | Mudança |
|---------|---------|
| `server/contribuicaoSquad/simulator.ts` **(novo)** | Função pura `simulateCliente`, tipos `ContratoSim`/`ClienteSim`, helpers `contratoAtivoEm`/`gerarMesesEntre`. Não importa nada do Express/Drizzle. |
| `server/contribuicaoSquad/simulator.test.ts` **(novo)** | Testes unitários (vitest) cobrindo 5 cenários conhecidos |
| `server/routes.ts` (~5341–5825) | Substituir a query monolítica de receitas por (a) Query 1 + Query 2, (b) montagem de `Map<cnpj, ClienteSim>`, (c) loop `simulateCliente` para cada cliente, (d) agregação final em `resumoPorSquad`/`receitasDetalhesPorSquad`/`monthlyData` |
| `client/src/pages/ContribuicaoSquad.tsx` | **Sem mudança** (consome o mesmo `BulkResponse`) |

**Decisão de file structure:** extrair a simulação para um arquivo separado porque (a) é função pura testável, (b) `routes.ts` já é gigantesco, (c) facilita validar o algoritmo sem precisar subir Express.

---

## Edge cases tratados

| Caso | Comportamento |
|------|---------------|
| Cliente sem contrato no Clickup | **Ocultado** (decisão #6). Nem aparece como "Sem Squad". |
| Cliente com contrato mas nunca pagou | Não aparece (sem `valor_pago`). |
| Cliente paga em mês onde nenhum contrato está ativo | Pagamento ignorado. Não vira receita de ninguém. |
| Pontual cancelado com saldo devedor parcial | Sai da fila a partir do mês seguinte ao `data_fim`. O atribuído fica. Saldo evapora. |
| Pontual cancelado nunca pago | Nunca compete por sobra. Receita = 0. |
| Cliente paga MAIS que `valorr + valorp` total | Excedente vai pro ralo. Soma final pode ser MENOR que `SUM(valor_pago)`. |
| Cliente paga MENOS que `SUM(valorr)` num mês | Recorrente conta cheio (decisão #5), pontual recebe 0. |
| Múltiplos pontuais ativos com saldo devedor | FIFO por `data_inicio`. Mais antigo recebe primeiro. |
| Contrato com `valorr = valorp = 0` | Excluído na Query 1. |
| Contrato sem `data_inicio` | Considerado ativo desde `'1900-01-01'` (fallback). |
| `data_quitacao` em mês anterior ao primeiro contrato do cliente | Pagamento é processado, mas não tem onde alocar → ignorado. |
| Cliente novo no meio do ano | Histórico curto, simulação roda só desde o primeiro pagamento. |

---

## Testes

Arquivo `server/contribuicaoSquad/simulator.test.ts` (vitest):

1. **Cliente só recorrente, paga normal todo mês** → cada mês conta `valorr` cheio
2. **Cliente só pontual à vista (1 pagamento que cobre `valorp`)** → o mês recebe `valorp`, depois nada
3. **Cliente só pontual parcelado em 5 meses** → 5 meses recebem o pagamento até saldo zerar; mês 6 em diante não recebe nada mesmo se cliente continuar pagando
4. **Cliente recorrente + pontual parcelado em paralelo** → recorrente fixo no `valorr`, pontual recebe a sobra mês a mês
5. **Cliente Creators 4 entregas FIFO** → cada mês um contrato diferente é zerado em ordem de `data_inicio`

Não vou testar a parte de SQL/integração — só a função pura. SQL é validado manualmente via psql.

---

## Validação manual (Task 0 do plano)

Antes de codar, validar via psql:

1. **Sanity check global 2026:**
   ```sql
   -- Soma atual (só recorrente)
   SELECT ... existing query ...
   -- Soma esperada nova (recorrente + pontual reconciliado)
   -- Esperada > soma atual, mas ≤ SUM(valor_pago) dos clientes envolvidos
   ```

2. **Caso conhecido — CNPJ 03364572000148:**
   - Tech Ecommerce deve receber ~R$ 7.030 acumulados (set+out/2025), 0 nos meses seguintes
   - Squadra Performance deve receber R$ 1.997/mês

3. **Caso Creators:**
   - Encontrar 1 cliente Makers com 4 entregas-Creators
   - Validar que recebe `valorp` × 4 distribuído em 4 meses, não `valorp × 4` por mês

4. **Sanity check Tech:**
   - Tech sai de R$ 32k (atual) para algo bem maior (centenas de milhares)
   - Não deve passar de `SUM(valor_pago)` dos clientes Tech

---

## Performance

- ~322 clientes × média ~24 meses de histórico = ~8000 iterações
- Cada iteração: ~10 operações
- Total: <100ms (tempo de CPU JS)
- Query 2 (pagamentos cronológicos) já tem índices em `id_cliente` e `data_quitacao`

Nenhuma preocupação com performance.

---

## Limitações conhecidas

1. **Atribuição é heurística.** Quando cliente paga uma quantia ambígua que poderia ser de vários contratos, FIFO escolhe o mais antigo. Pode estar errado em casos atípicos.

2. **Recorrente com pagamento parcial é silenciado.** Se cliente pagou só R$ 1.500 do recorrente R$ 2.000, ainda contamos R$ 2.000 (decisão #5). Sobra fica em 0, então pontual também é ignorado nesse mês. Trade-off conhecido.

3. **Overpayment vai pro ralo.** Cliente pagando além do esperado não infla nenhum squad — mas a soma anual da aba pode ser menor que `SUM(valor_pago)` total. Visível na validação.

4. **Pontual sem `data_inicio`** usa fallback `1900-01-01`. Provavelmente raro, mas pode distorcer ordenação FIFO se houver muitos.

---

## Próximos passos

Plano de implementação detalhado em `docs/superpowers/plans/2026-04-10-receitas-pontuais-reconciliacao.md`.
