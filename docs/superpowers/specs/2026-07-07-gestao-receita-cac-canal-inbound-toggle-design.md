# CAC por canal: fundir Inbound + toggle CAC por contrato

**Data:** 2026-07-07
**Tela:** `/gestao/receita` → aba Macro → seção "CAC por canal — variáveis de custo"
**Arquivos-núcleo:** `server/routes/gestaoReceita.cacCanais.ts`, `client/src/components/gestao/CacPorCanal.tsx`

## Contexto

A seção "CAC por canal" mostra, por macro-canal de aquisição, o CAC gerencial =
soma das variáveis de custo ÷ **clientes** fechados do canal. Clientes = deals
ganhos no Bitrix (`COUNT(*)` por `source` → macro-canal). O catálogo de canais é
`CAC_CANAIS` (fonte única, consumida também pelo drill `cac_canal` em
`gestaoReceita.detalhe.ts` e pelo quadro de-para na UI).

Duas mudanças pedidas:

1. **Fundir "Inbound pago" + "Inbound orgânico" num único canal "Inbound".**
2. **Adicionar toggle CAC por contrato ↔ por cliente** (a mesma régua de contrato
   do BP 2026: nº de serviços vendidos no deal).

## Mudança 1 — Fundir Inbound

No catálogo `CAC_CANAIS`, os dois entries `inbound_pago` e `inbound_organico`
viram um só:

```ts
{ id: "inbound", label: "Inbound",
  sources: ["WEBFORM","ADVERTISING","STORE","WEB","CALL","BOOKING","EMAIL","TRADE_SHOW","instagram_organic"],
  itens: [{ id: "anuncios", label: "Investimento em anúncios", auto: "ads_spend" }] }
```

- Passa de **10 → 9 canais**.
- O item automático "Investimento em anúncios" (spend Meta+Google+TikTok+LinkedIn)
  é mantido. **Consequência esperada:** o CAC do Inbound passa a diluir o spend de
  ads sobre o denominador de todos os sources inbound (pago + orgânico) — efeito
  natural de juntar os dois.
- **Propaga sozinho** para o drill (`gestaoReceita.detalhe.ts` faz
  `CAC_CANAIS.find(c => c.id === chave)` e lista os deals dos `sources` do canal) e
  para o quadro de-para na UI (vem do payload).
- **Sem metas órfãs:** `inbound_pago` só tinha item automático (não editável) e
  `inbound_organico` nenhum item — não há override manual salvo em
  `cortex_core.gestao_receita_metas` com chave `cac_canal:inbound_pago:*` /
  `cac_canal:inbound_organico:*` para migrar.

## Mudança 2 — Toggle CAC por contrato ↔ por cliente

### Régua de contrato (idêntica ao BP)

1 serviço vendido = 1 contrato. Fonte: campo `servicos_vendidos` do deal (Bitrix),
parseado por `parseServicosVendidos` e contado por `contarServicosPorSegmento`
(`server/routes/bp2026.vendasProduto.helpers.ts`) — cada id mapeado em
`SERVICOS_BITRIX` conta 1 (repetições do mesmo segmento contam), com piso 1 por
deal ganho para nunca sumir um deal nem quebrar a invariante **CAC/contrato ≤
CAC/cliente**. Um deal com N serviços conta N contratos e 1 cliente.

### Backend (`gestaoReceita.cacCanais.ts`)

- `computeCacCanais`: a query de deals ganhos passa a retornar **uma linha por
  deal** com `source`, `mes`, `servicos_vendidos`, `valor_recorrente`,
  `valor_pontual` (em vez de `COUNT(*)` agrupado).
- Agregação em JS por deal: `clientes += 1`; `contratos += ` total de
  `contarServicosPorSegmento({ ids, valorRec, valorPont })` (rec + pont), com piso
  1 por deal ganho.
- `DealsSourceMes` ganha `contratos`. `agregarCacCanais` agrega
  `contratosCanalMes` análogo a `clientesCanalMes`.
- `CacCanalOut` ganha `contratos: number` e `cacContrato: number | null`.
  `CacCanaisOut.geral` ganha `contratos` e `cacContrato`.
- **`custoTotal` é invariante** — o toggle só troca o denominador do CAC.
- O incentivo por cliente (Indique e Ganhe, Parceria) continua calculado sobre
  clientes; ele compõe o `custoTotal`, que não muda com o modo.

### Frontend (`CacPorCanal.tsx`)

- Estado `modo: "cliente" | "contrato"` (`useState`, default `"cliente"`).
- Switch global no cabeçalho da seção (ao lado do título "CAC por canal").
- `denom(c) = modo === "contrato" ? c.contratos : c.clientes`; CAC por card e CAC
  geral usam esse denominador.
- Rótulos refletem o modo: "CAC / contrato" | "CAC / cliente"; subtítulo do card
  geral "N contratos" | "N clientes"; rodapé do card "Contratos N" | "Clientes N".
- Texto "Como é calculado" reflete o modo ativo.
- Tipos `CacCanalCard` e `CacCanaisData` ganham `contratos` (e geral).

## Testes

`server/routes/gestaoReceita.cacCanais.test.ts`:
- Atualizar id `inbound_pago` → `inbound` e a contagem 10 → 9 canais.
- Novos casos: deal com N serviços vendidos → N contratos no canal; `cacContrato =
  custoTotal ÷ contratos`; piso 1 para deal sem serviço mapeado.

## Fora de escopo

- Drill-down continua listando deals do canal (não muda com o toggle).
- Card macro "CAC — custo de aquisição" (outra seção, régua ClickUp) intocado.
- Persistência do modo do toggle entre sessões (estado local basta).
