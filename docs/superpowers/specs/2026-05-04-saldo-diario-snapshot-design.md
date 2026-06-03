# Spec: Snapshot Diário de Saldo Bancário

**Data:** 2026-05-04
**Status:** Aprovado

## Contexto

O saldo bancário consolidado hoje é calculado dinamicamente consultando `caz_bancos` em tempo real. Não há histórico de saldo por dia — ao retroagir, o `bp_snapshots` recalcula o `cash_balance` de forma estimada (saldo atual menos fluxos posteriores). Isso produz valores aproximados, não o saldo real de cada dia.

## Objetivo

Criar uma tabela que registre o saldo total consolidado de todos os bancos ativos uma vez por dia às 18h, garantindo histórico fiel e imutável do caixa real.

## Tabela

```sql
-- Schema: cortex_core
CREATE TABLE cortex_core.saldo_diario_snapshots (
  data        DATE            PRIMARY KEY,
  saldo_total NUMERIC(15,2)   NOT NULL,
  criado_em   TIMESTAMPTZ     DEFAULT NOW()
);
```

- Uma linha por dia (`data DATE PRIMARY KEY`)
- Upsert idempotente: se o job rodar mais de uma vez no mesmo dia, o valor é sobrescrito
- `saldo_total` = `SUM(balance::numeric) FROM "Conta Azul".caz_bancos WHERE ativo = true`

## Job

**Arquivo:** `server/services/saldoDiarioSnapshotJob.ts`

Segue o padrão exato do `inadimplenciaSnapshotJob`:

| Componente | Detalhe |
|---|---|
| `tick()` | Chamado a cada 1h; dispara quando `getHours() === 18` e snapshot do dia ainda não existe |
| `recoverOnStartup()` | Se servidor reiniciar após 18h sem snapshot do dia, dispara imediatamente |
| `runSnapshotJob(date?)` | Lê saldo de `caz_bancos` e faz upsert em `saldo_diario_snapshots` |
| `runWithAlert()` | Wrapper que envia email em caso de falha |
| `setupSaldoDiarioSnapshotJob()` | Exportado e registrado em `server/index.ts` |

**Horário de disparo:** 18h00 (local do servidor)

**Alerta de falha:** email para `financeiro@turbopartners.com.br` (mesmo destino do inadimplência), via SendGrid.

**Recovery:** `recoverOnStartup()` protege contra restart do servidor após 18h.

## Endpoint Manual

```
POST /api/admin/saldo-diario/snapshot/run
```

- Autenticação: `isAuthenticated` + `isAdmin`
- Body opcional: `{ "data": "2026-04-30" }` para backfill de datas específicas
- Retorna: `{ data, saldo_total, criado_em }`

## Migration

Adicionada em `server/db.ts` no bloco de migrations existentes, usando `CREATE TABLE IF NOT EXISTS`. Deve ser aplicada também no banco de produção (GCP).

## Sem endpoint de leitura nesta fase

Não há rota `GET` pública nesta entrega — os dados ficam disponíveis via consulta SQL direta e via backfill manual. Endpoints de visualização são escopo futuro.

## Fluxo de dados

```
[18h00] tick() detecta hora →
  existe snapshot hoje? → sim: skip
                        → não: runWithAlert()
                                  ↓
                          SELECT SUM(balance) FROM caz_bancos WHERE ativo=true
                                  ↓
                          INSERT/UPDATE saldo_diario_snapshots SET data=hoje, saldo_total=X
```

## Backfill

Para recuperar datas passadas, usar o endpoint manual com o campo `data`:

```bash
curl -X POST /api/admin/saldo-diario/snapshot/run \
  -H "Content-Type: application/json" \
  -d '{"data": "2026-04-30"}'
```

Obs.: backfill captura o saldo **atual** de `caz_bancos`, não o saldo histórico real. É útil apenas para registrar o estado presente em datas que faltaram.
