# Resumo diário de métricas para líderes via WhatsApp

**Data:** 2026-07-02
**Status:** Aprovado (brainstorming com Ichino)

## Objetivo

Automatizar a mensagem "Bom dia líderes!!!" enviada hoje manualmente num grupo de
WhatsApp com as métricas principais do mês corrente (MRR, Entrega Pontual, Churn,
Em cancelamento, Cross R/P, Net Churn). Job no backend do Cortex calcula, formata
e envia **todo dia útil às 10h (America/Sao_Paulo)** via Evolution API.

Fase 1: enviar somente para o número de teste (Ichino) até validar os números.
Fase 2: apontar `RESUMO_LIDERES_DESTINO` para o ID do grupo dos líderes.

## Definições das métricas (validadas contra prod em 2026-07-02)

Todas acumuladas no mês corrente, calculadas no momento do envio:

| Métrica | Definição | Implementação |
|---|---|---|
| MRR | `SUM(valorr)` live de `"Clickup".cup_contratos`, `status IN ('ativo','onboarding','triagem')`, `valorr > 0` | reusa `getMrrAtivo()` (`server/okr2026/metricsAdapter.ts`) |
| Entrega Pontual | `SUM(valorp)` de contratos que **passaram a `status='entregue'` no mês**: status live = 'entregue' E (status no snapshot do dia 1º ≠ 'entregue' OU contrato não existia no dia 1º), `valorp > 0` | query nova (`cup_data_hist` dia 1º × `cup_contratos` live) |
| Churn | `SUM(valor_r)` **bruto** de `"Clickup".cup_churn` com `data_solicitacao_encerramento` no mês corrente (inclui abonados — alinhado ao card do ClickUp) | query nova |
| Churn % | Churn ÷ MRR início do mês (snapshot dia 1º, mesmos filtros do MRR) | reusa `getMrrInicioMes()` |
| Em cancelamento | `SUM(valorr)` live, `status = 'em cancelamento'`, `valorr > 0` | query nova |
| Cross R / Cross P | cross-sell recorrente/pontual do mês: deals `Negócio Ganho` com `source='PARTNER'` e cliente pré-existente (primeiro contrato antes do mês do fechamento) | reusa `getVendasMrrBreakdown()` |
| Cross total | Cross R + (Cross P ÷ 5) — amortização do pontual em 5 meses | derivada |
| Net Churn | Churn − Cross total; % sobre MRR início do mês | derivada |

Validação feita contra a mensagem real de 25/06 10h: MRR, Em cancelamento, Churn %
(base = MRR início de junho R$ 1.030.229 → 14,37% e 9% exatos) e a família de dados
da Entrega Pontual (centavos ,45) conferem; desvios residuais são registros
retroativos no ClickUp/Bitrix — a automação reflete o estado do momento do envio.

## Formato da mensagem

Idêntico ao exemplo manual, com data do dia, hora real do envio (ex.: `dia 02/07, 10h`)
e percentuais **exatos com 2 casas**
(ex.: `9,03%`, sem arredondar para `9%`). Moeda em pt-BR (`R$ 1.150.674,00`).
`*negrito*` do WhatsApp nos percentuais e nas OBS. As 3 OBS entram fixas:

```
Bom dia líderes!!!
Atualizações sobre nossas métricas principais, dia DD/MM, 10h.

MRR: R$ X
Entrega Pontual: R$ X

Churn: R$ X - *P,PP%*
Em cancelamento: R$ X

Cross R: R$ X
Cross P: R$ X / 5 = R$ X
Total: R$ X + R$ X = R$ X

Net Churn: R$ X - *P,PP%*

*OBS 1: Bora buscar mais cross*
*OBS 2: Bora reter*
*OBS 3: Não sai mais ninguém*
```

## Componentes

### `server/services/resumoLideres.ts` (novo)
- `calcularMetricasResumo()` — roda as queries em paralelo (`Promise.all`), retorna
  objeto tipado com todas as métricas e derivadas.
- `formatarMensagemResumo(metricas, dataRef)` — função pura, gera o texto acima.
- `enviarResumoLideres(opts?: { force?: boolean })` — verifica idempotência,
  calcula → formata → `enviarMensagemWhatsApp()` (reuso de
  `server/services/turbozap.ts`) → grava em `cortex_core.resumo_lideres_envios`.

### Configuração (`.env`)
- `RESUMO_LIDERES_DESTINO` — número (fase 1) ou ID de grupo (fase 2). Sem valor → job não envia (loga aviso).
- `RESUMO_LIDERES_INSTANCIA` — opcional, default = instância financeiro do TurboZap.
- `RESUMO_LIDERES_ATIVO` — `true`/`false`, liga/desliga o job sem deploy de código.

### Idempotência — `cortex_core.resumo_lideres_envios`
```sql
id SERIAL PK, data_ref DATE NOT NULL, destino TEXT, mensagem TEXT,
status TEXT NOT NULL ('ok' | 'erro'), erro TEXT, criado_em TIMESTAMP DEFAULT NOW()
```
Definida em `shared/schema.ts` (Drizzle) + `CREATE TABLE IF NOT EXISTS` na
inicialização (padrão `server/db.ts` / init do serviço). Job só envia se não houver
registro `status='ok'` para a `data_ref` de hoje. Criar em local **e prod**.

### Job — `server/index.ts` (padrão dos jobs existentes)
- `setInterval` de 5 min: calcula dia/hora em `America/Sao_Paulo` via `Intl.DateTimeFormat`.
- Condições: `RESUMO_LIDERES_ATIVO=true` E dia útil (seg–sex) E hora local ∈ [10h, 12h)
  E sem envio `ok` hoje → `enviarResumoLideres()`.
- Janela até 12h = retry automático em caso de falha (falha grava `status='erro'` e
  o próximo tick tenta de novo). Feriados não são excluídos nesta versão (YAGNI).

### Endpoints (autenticados, `server/routes/resumoLideres.ts`)
- `GET /api/resumo-lideres/preview` — retorna `{ metricas, mensagem }` sem enviar.
- `POST /api/resumo-lideres/enviar` — dispara na hora; body `{ force?: boolean }`
  para reenviar mesmo já tendo envio `ok` no dia.

## Tratamento de erros
- Falha de query ou Evolution API → grava `status='erro'` com a mensagem, loga com
  prefixo `[resumo-lideres]`, retry no próximo tick dentro da janela 10h–12h.
- Nunca enviar mensagem com métricas parciais: qualquer query falhando aborta o envio.

## Testes
- Unitário do formatador: métricas fixas → texto esperado exato (formato moeda,
  percentuais, negrito).
- Validação real: `preview` + envio manual pro número de teste, comparando com a
  mensagem montada à mão pelo time nos primeiros dias.

## Fora de escopo (YAGNI)
- Exclusão de feriados; UI de configuração; OBS dinâmicas; envio para múltiplos destinos.
