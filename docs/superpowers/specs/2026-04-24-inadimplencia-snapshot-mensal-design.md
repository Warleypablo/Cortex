# Snapshot mensal de inadimplência total — Design

**Data:** 2026-04-24
**Branch destino:** `feature/inadimplencia-snapshot-mensal`
**Autor:** Claude + Warley

---

## Motivação

A inadimplência no Cortex hoje é sempre calculada ao vivo a partir de `"Conta Azul".caz_parcelas`. Não existe registro histórico do total de inadimplência fechado por mês — se a fonte mudar (parcelas pagas retroativamente, baixas manuais, correções no Conta Azul), perdemos a foto do mês.

Queremos **congelar** o total de inadimplência ao final de cada mês para permitir análise histórica confiável (evolução mês-a-mês, comparação com metas, auditoria).

## Escopo

**Incluído:**
- Tabela nova `cortex_core.inadimplencia_snapshots` armazenando um registro agregado por mês.
- Job agendado que roda ao meio-dia do último dia de cada mês e insere/atualiza o snapshot.
- Envio de email via SendGrid para `financeiro@turbopartners.com.br` em caso de falha.
- Endpoint HTTP para disparo manual do snapshot (recuperação de falha).

**Fora de escopo:**
- Breakdown por faixa de atraso (0-30, 31-60, 61-90, 90+) — pode ser adicionado depois se necessário.
- Snapshot por cliente (granular) — pode ser adicionado depois.
- UI para visualizar o histórico — por ora apenas tabela consultável via SQL.
- Retry automático em caso de falha transitória (falhou → avisa humano → dispara manualmente).

## Design

### 1. Tabela `cortex_core.inadimplencia_snapshots`

Espelha o padrão de `cortex_core.bp_snapshots` e `cortex_core.dfc_snapshots`.

```sql
CREATE TABLE cortex_core.inadimplencia_snapshots (
  id                   SERIAL PRIMARY KEY,
  mes_referencia       VARCHAR(7)   NOT NULL UNIQUE,  -- 'YYYY-MM'
  data_snapshot        DATE         NOT NULL,          -- dia exato da execução
  valor_total          NUMERIC(14,2) NOT NULL,
  quantidade_clientes  INTEGER      NOT NULL,
  quantidade_parcelas  INTEGER      NOT NULL,
  ticket_medio         NUMERIC(14,2) NOT NULL,
  criado_em            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inadimplencia_snapshots_mes
  ON cortex_core.inadimplencia_snapshots (mes_referencia);
```

**Decisões:**
- `mes_referencia UNIQUE` garante idempotência — múltiplas execuções no mesmo mês fazem UPSERT, nunca duplicam.
- `data_snapshot` (DATE) registra o dia real de execução; pode ser útil se o job rodar de forma retroativa por recuperação manual.
- Criada em produção (GCP) **e** local (`cortex_dev`) — ver regra em `memory/feedback_db_prod_sync.md`.

### 2. Cálculo (regra de negócio)

Mesma query do `storage.getInadimplenciaResumo()` atual, sem filtro de data inicial/final:

```sql
SELECT
  COALESCE(SUM(nao_pago::numeric), 0)     AS valor_total,
  COUNT(DISTINCT id_cliente)              AS quantidade_clientes,
  COUNT(*)                                AS quantidade_parcelas
FROM "Conta Azul".caz_parcelas
WHERE tipo_evento = 'RECEITA'
  AND data_vencimento < CURRENT_DATE
  AND nao_pago::numeric > 0;
```

`ticket_medio = valor_total / quantidade_clientes` (zero se não houver clientes).

### 3. Job agendado: `server/services/inadimplenciaSnapshotJob.ts`

Segue o padrão dos outros sync jobs do projeto (`setInterval` em `server/index.ts`).

**Arquitetura:**
- Função `runSnapshotJob()`:
  1. Calcula `mes_referencia` (formato `YYYY-MM`) e `data_snapshot` (CURRENT_DATE).
  2. Roda a query de cálculo.
  3. Executa `INSERT ... ON CONFLICT (mes_referencia) DO UPDATE SET ...`.
  4. Loga sucesso em `console.log`.
  5. Captura qualquer erro, loga e chama `sendErrorAlert(erro)`.

- Função `scheduleTick()`:
  - Roda a cada **1 hora** (`setInterval(3600 * 1000)`).
  - Verifica: *hoje é o último dia do mês?* E *a hora atual é 12?*
  - Se sim E ainda não há snapshot para `mes_referencia` atual → dispara `runSnapshotJob()`.

- **Recovery de restart:** no `setup()` inicial, checa se hoje é o último dia do mês, já passou do meio-dia, e não há snapshot do mês. Se tudo for verdade, dispara imediatamente.

**"Último dia do mês" em JS:**
```ts
function isLastDayOfMonth(date: Date): boolean {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return next.getMonth() !== date.getMonth();
}
```

### 4. Aviso de erro por email

**Arquivo:** `server/services/sendgrid-notification.ts` (reuso do módulo existente).

Adicionar nova função exportada `sendAlertEmail(params: { to: string; subject: string; text: string; html: string; })` que reusa `ensureConfig()` já presente. Mantém o arquivo atual focado em email, sem acoplar à lógica do jurídico.

**Função helper no job:** `sendErrorAlert(err: Error, mesRef: string)`:
- Destino: `financeiro@turbopartners.com.br` (hardcoded; não faz sentido configurar via env para um aviso interno).
- Assunto: `[Cortex] Falha no snapshot de inadimplência — ${mesRef}`.
- Corpo HTML/text: data/hora da tentativa, `mes_referencia`, mensagem de erro, stack trace, e instrução para rodar manualmente via endpoint.

Se o próprio envio do email falhar, apenas loga `console.error` — não há outro canal de fallback (confirmado com usuário).

### 5. Endpoint manual: `POST /api/inadimplencia/snapshot/run`

Registrado em `server/routes/inadimplencia.ts`.

- Protegido por `isAuthenticated` (já global em `/api`).
- Body opcional: `{ mesReferencia?: 'YYYY-MM' }` — se omitido, usa o mês corrente.
- Dispara `runSnapshotJob()` com o mês informado.
- Retorna `{ ok: true, snapshot: {...} }` com o registro inserido/atualizado, ou `{ ok: false, error }` em caso de falha (não dispara o email — erro volta no response).

### 6. Integração em `server/index.ts`

Adicionar próximo aos outros jobs (após `pollAssinafyStatus`):

```ts
// Inadimplência — snapshot mensal (último dia do mês, meio-dia)
const { setupInadimplenciaSnapshotJob } = await import("./services/inadimplenciaSnapshotJob");
setupInadimplenciaSnapshotJob();
```

## Plano de testes

**Validação local (antes do merge):**
1. Aplicar schema no `cortex_dev`.
2. Chamar `POST /api/inadimplencia/snapshot/run` → linha criada em `inadimplencia_snapshots`.
3. Chamar de novo → mesma linha atualizada (não duplica).
4. Simular erro (quebrar temporariamente a query) → confirmar email recebido em `financeiro@turbopartners.com.br`.
5. Confirmar que job inicial não dispara em dias que não são último do mês (log esperado: "skipping — not last day").

**Validação do schedule:**
- Testar com "mock" do `Date.now()` ou ajustando manualmente o relógio do servidor local para o último dia do mês, 11:55. Avançar para 12:05. Confirmar que o job disparou.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Servidor reinicia na janela 12:00-12:59 do último dia e perde o trigger | Recovery de restart checa no startup se hoje é o último dia + passou das 12h + não há snapshot → dispara imediatamente |
| Job roda duas vezes (ex: em ambiente staging + prod rodando juntos) | `UNIQUE (mes_referencia)` + UPSERT garantem idempotência |
| SendGrid fora do ar durante uma falha | `console.error` fica no log do servidor; endpoint manual sempre disponível |
| Inadimplência calculada diferente do painel ao vivo | Usar **exatamente** a mesma query de `getInadimplenciaResumo` (referenciar a função compartilhada, não reescrever) |

## Arquivos afetados

**Novos:**
- `server/services/inadimplenciaSnapshotJob.ts`
- `migrations/2026-04-24_inadimplencia_snapshots.sql` (schema)

**Modificados:**
- `server/services/sendgrid-notification.ts` (adicionar `sendAlertEmail`)
- `server/routes/inadimplencia.ts` (adicionar endpoint `POST /snapshot/run`)
- `server/index.ts` (setup do job)

## Decisões tomadas (histórico do brainstorming)

1. **Granularidade:** apenas total agregado por mês (1 linha/mês). Faixas por atraso e breakdown por cliente ficam para iterações futuras.
2. **Canal de erro:** email SendGrid (único canal, sem in-app notification).
3. **Timing:** 12:00 do último dia do mês.
4. **Destinatário do alerta:** `financeiro@turbopartners.com.br`.
5. **Trigger manual:** endpoint HTTP incluído para recuperação.
