# CAC por canal — variáveis de custo (/gestao/receita)

**Data:** 2026-07-02
**Status:** aguardando revisão do usuário
**Origem:** mockup em screenshots (seção "CAC por canal — variáveis de custo") apontado como faltante na tela.

## Objetivo

Nova seção na aba **Macro** da `/gestao/receita`, abaixo da tabela "Custo da operação": CAC gerencial por macro-canal de aquisição, com custos manuais editáveis por mês e incentivos automáticos por cliente. Complementa (não substitui) o card "CAC — custo de aquisição" oficial, que segue em regime caixa Conta Azul.

## Decisões do usuário (2026-07-02)

1. **Localização:** aba Macro, abaixo do CAC atual/Custo da operação.
2. **Mapeamento macro-canal → sources:** conforme catálogo abaixo, aprovado sem ajustes; Parceria fica sem source (0 clientes) até existir no CRM.
3. **Clientes** = deals ganhos no mês do canal (mesma régua da coluna "Deals" da tabela de canais e do card "CAC por cliente"); Expansão/Crossell conta cada deal ganho.
4. **Itens de custo fixos** no código; só o valor é editável, por mês, via botão "Editar metas" existente.
5. **Incentivo unitário editável** (default R$ 1.000), total automático = unitário × clientes.
6. **Abordagem A** (payload do agregador + componente novo) — assumida por recomendação (usuário ausente na pergunta final); reversível nesta revisão.

## Catálogo fixo (constante no server)

| id | Canal | Sources Bitrix | Itens manuais (id → label) | Incentivo |
|---|---|---|---|---|
| `inbound_pago` | Inbound pago | `WEBFORM`, `ADVERTISING`, `OTHER`, `STORE` | `anuncios` → Investimento em anúncios | — |
| `inbound_organico` | Inbound orgânico | `WEB`, `CALL`, `BOOKING`, `EMAIL`, `TRADE_SHOW`, `instagram_organic` | — ("Sem custo direto") | — |
| `outbound` | Outbound | `UC_YWZVA2` | `time` → Custo de time; `ferramentas` → Ferramentas (Lemlist, Intexfy...) | — |
| `social_selling` | Social Selling | `UC_4VCKGM` | `anuncios_dist` → Anúncios p/ distribuição | — |
| `reativacao` | Reativação | `UC_HIBVO6`, `UC_8HI30Y` | `broadcast` → Disparos de broadcast; `time` → Custo de time | — |
| `recomendacao` | Recomendação | `UC_PTYW1Y`, `CALLBACK` | — ("Sem custo") | — |
| `indique_ganhe` | Indique e ganhe | `RC_GENERATOR` | — | "Incentivo" R$/cliente |
| `evento` | Evento | `RECOMMENDATION`, `UC_KYOYOW` | `custo_evento` → Custo do evento (manual) | — |
| `parceria` | Parceria | *(nenhum)* | `time_resp` → Custo de time responsável | "Comissão" R$/cliente |
| `expansao` | Expansão de conta (Crossell) | `PARTNER`, `UC_7WV0LW`, `REPEAT_SALE` | `time` → Custo de time | — |

Nota: os códigos e labels de source vêm de `server/routes/bitrixSources.ts` (`CALL` = "Agendamento direto", `ADVERTISING` = "Contato recebido", `RECOMMENDATION` = "Eventos", etc. — códigos crus são enganosos). `instagram_organic` é source cru sem label.

## Backend

**Módulo novo:** `server/routes/gestaoReceita.cacCanais.ts`, exporta `computeCacCanais(db, { dIni, dFim, metas })`, chamado pelo agregador; resultado no payload como `macro.cacCanais`.

**Query nova** (deals ganhos por source e mês, p/ incentivo mês a mês):

```sql
SELECT COALESCE(NULLIF(source, ''), '(não informado)') AS source,
       date_trunc('month', data_fechamento) AS mes,
       COUNT(*) AS clientes
FROM "Bitrix".crm_deal
WHERE stage_name = 'Negócio Ganho' AND data_fechamento >= $dIni AND data_fechamento < $dFim
GROUP BY 1, 2
```

Agregação por macro-canal no JS via catálogo. Sources fora do catálogo (ex.: "(não informado)") não entram em nenhum card — o CAC geral da seção considera só os 10 canais (documentar na nota da UI).

**Cálculo por canal:**
- `clientes` = Σ clientes dos sources do canal no período.
- Item manual: valor mensal = override `cac_canal:<canal>:<item>` do mês (default 0); no período, soma dos meses (mesma semântica de `cac_op_real`).
- Incentivo: por mês, `unit_mes × clientes_mes`, com `unit_mes` = override `cac_canal_unit:<canal>` do mês (default 1000); total = soma dos meses.
- `custoTotal` = Σ itens + incentivo; `cacCliente` = `custoTotal / clientes` (null quando `clientes = 0` → UI mostra "—").
- Geral: `{ cac: Σ custoTotal ÷ Σ clientes, clientes: Σ, custoTotal: Σ }`.

**Payload:**

```ts
macro.cacCanais = {
  geral: { cac: number | null, clientes: number, custoTotal: number },
  canais: Array<{
    id: string; label: string; clientes: number; custoTotal: number; cacCliente: number | null;
    itens: Array<{ id: string; label: string; valor: number; tipo: 'manual' }>;
    incentivo?: { label: string; unit: number; qtd: number; total: number };
  }>;
}
```

**Chaves de meta novas** em `cortex_core.gestao_receita_metas` (tabela existente, sem migração):
- `cac_canal:<canal>:<item>` — custo manual mensal.
- `cac_canal_unit:<canal>` — unitário do incentivo.

**Whitelist:** estender `CHAVE_META_OK` (`server/routes/gestaoReceita.ts:509`) com `cac_canal:[a-z_]+:[a-z_]+` e `cac_canal_unit:[a-z_]+`.

## Frontend

**Componente novo:** `client/src/components/gestao/CacPorCanal.tsx`, renderizado em `SecaoMacro` (GestaoReceita.tsx) após `CustoOperacaoTabela`. Não crescer o arquivo da página (já tem 837 linhas).

- `BlockHead` "CAC por canal — variáveis de custo".
- Card "COMO É CALCULADO": texto "CAC do canal = soma das variáveis de custo ÷ nº de clientes fechados do canal (Bitrix). Custos manuais editáveis; incentivos por cliente automáticos." + CAC geral grande (mono, verde) + sub "CAC GERAL · N CLIENTES".
- Grid `grid-cols-1 md:grid-cols-2 gap-3`, 10 cards sempre visíveis na ordem do catálogo (mesmo com 0 clientes — precisa dar para editar custo).
- Card: título à esquerda, `CAC / CLIENTE` à direita (valor mono verde; "—" sempre que clientes = 0; com clientes > 0, mostra custoTotal ÷ clientes, inclusive R$ 0 quando custo 0). Linhas: item manual com valor em pill (vira `MetaInput` chave `cac_canal:<canal>:<item>` quando `metas.editando`); incentivo como "Incentivo R$ 1.000 / cliente × N   R$ X" (unitário vira `MetaInput` chave `cac_canal_unit:<canal>` no modo edição; total sempre automático); canais sem itens: "Sem custo direto —". Rodapé: "Clientes N `<Fonte tipo="bitrix" />` · Custo total R$ X".
- Fonte dos clientes = badge **Bitrix** (padrão da tela; mockup dizia "Cortex", mas o dado é Bitrix como todo o resto da aba).
- Dark/light mode obrigatório em todas as classes.
- `Nota` final: "Visão gerencial: custos informados manualmente por mês (+ incentivos automáticos por cliente). Não bate com o card 'CAC — custo de aquisição' (Conta Azul, regime caixa) por design. Parceria ainda não tem source no CRM (clientes 0). Deals de sources fora dos 10 canais (ex.: sem origem) ficam fora desta seção."
- Edição respeita `mesUnico` (range multi-mês = leitura apenas), como o resto da tela.

## Fora de escopo (v1)

- Drill-down nos cards (futuro: reusar drill de canal por source).
- Source de "Parceria" no CRM (quando existir, adicionar ao catálogo).
- Qualquer mudança no card CAC oficial ou na tabela "Custo da operação".

## Testes / validação

- `npx tsc --noEmit` limpo nos arquivos tocados.
- Validação no browser (dev server): valores default (custos 0), edição de custos e do unitário em mês único, aritmética dos totais e do CAC geral, dark + light mode.
- Conferir que o PUT aceita as chaves novas e o GET reflete o override no mês seguinte à edição.
