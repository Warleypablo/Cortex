# ROI por canal — seção "CAC por canal" (/gestao/receita, aba Macro)

**Data:** 2026-07-08
**Status:** aprovado
**Pedido:** stakeholder (via WhatsApp) — "Conseguimos colocar o ROI de cada canal aqui? ROI MRR = Valor vendido MRR/Custo total no canal; ROI Pontual = Valor vendido Pontual/Custo total no canal".

## Objetivo

Mostrar, em cada card da seção "CAC por canal — variáveis de custo", o retorno do canal
sobre o custo investido, separado em recorrente e pontual:

- **ROI MRR** = valor vendido MRR do canal ÷ custo total do canal
- **ROI Pontual** = valor vendido Pontual do canal ÷ custo total do canal

## Decisões (aprovadas pelo usuário)

1. **Fonte do valor vendido: Bitrix** — `SUM(valor_recorrente)` / `SUM(valor_pontual)`
   dos deals ganhos (`stage_name = 'Negócio Ganho'`, `data_fechamento` no período) do
   canal, agrupados por source → macro-canal (mesmo de-para já usado para clientes).
   - Consistente com os cards "Venda nova MRR/Pontual" da tela e com a tabela
     "Resultado por canal de aquisição" (mesma fonte e régua).
   - Canal e valor vêm do mesmo objeto (deal) → atribuição 1:1, sem perdas.
   - Alternativa rejeitada: ClickUp (`cup_contratos.valorr/valorp` atribuído via CNPJ) —
     seria consistente com o nº de "contratos" da seção, mas perde contratos de clientes
     sem deal no mês, não bate com "Venda nova" e a atribuição por CNPJ tem gaps.
   - Referência jun/26: Bitrix MRR R$285.235 · Pontual R$383.298 (79 deals);
     ClickUp atribuído seria R$356.796 / R$560.532.
2. **Formato: multiplicador** (padrão ROAS) — ex.: `1,8x`, 1 casa decimal, vírgula BR.
3. **ROI não vai no payload** — o frontend calcula `vendido ÷ custoVivo` para
   recalcular ao vivo durante a edição de metas (mesma mecânica do CAC).

## Backend — `server/routes/gestaoReceita.cacCanais.ts`

- A query de deals ganhos em `computeCacCanais` (hoje: source, mes, cnpj_norm,
  data_fechamento) passa a selecionar também
  `COALESCE(valor_recorrente::numeric, 0)` e `COALESCE(valor_pontual::numeric, 0)`.
- `DealsSourceMes` ganha `vrec: number` e `vpont: number` (por deal; `clientes: 1`).
- `agregarCacCanais` acumula por canal × mês (igual clientes) e soma no range:
  cada item de `canais` ganha `vendidoMrr: number` e `vendidoPontual: number`.
- `geral` ganha `vendidoMrr`/`vendidoPontual` = soma dos 9 canais.
- Deals com source fora do catálogo continuam fora (mesma regra dos clientes) —
  por isso o total da seção pode ficar ≤ card "Venda nova" da tela.

## Frontend — `client/src/components/gestao/CacPorCanal.tsx`

- Tipos `CacCanalCard` e `CacCanaisData.geral` ganham `vendidoMrr`/`vendidoPontual`.
- **Card de canal**: novo bloco no rodapé (abaixo da linha "Clientes/Custo total"),
  duas linhas:
  - `ROI MRR <mult> · vendido <brl(vendidoMrr)>`
  - `ROI Pontual <mult> · vendido <brl(vendidoPontual)>`
- **Card geral (header)**: ROI MRR e ROI Pontual gerais exibidos junto ao CAC geral,
  calculados com `geralCusto` (custo vivo somado dos canais).
- Cálculo: `roi = custoVivo > 0 ? vendido / custoVivo : null`.
  - `custoVivo = 0` → exibir `—` (valor vendido continua visível).
  - `vendido = 0` e custo > 0 → `0,0x`.
  - Formato: `(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "x"`.
- ROI **independe** do toggle "Por cliente / Por contrato".
- **Nota da seção**: acrescentar fórmula do ROI, fonte (valores dos deals ganhos
  Bitrix, mesma régua do card "Venda nova") e o aviso de que deals com source fora
  dos 9 canais ficam de fora (soma dos canais ≈ Venda nova, não exata).
- Dark/light mode: mesmas classes utilitárias já usadas no card (texto
  `text-gray-*`/`dark:text-zinc-*`; multiplicador em `text-gray-900 dark:text-white`).

## Testes — `server/routes/gestaoReceita.cacCanais.test.ts`

- Agregação de `vendidoMrr`/`vendidoPontual` por canal (deals de sources distintos).
- Range multi-mês (soma dos meses do range, ignora meses fora).
- Source fora do catálogo não soma em nenhum canal.
- Canal sem deals → vendido 0.
- `geral.vendidoMrr/vendidoPontual` = soma dos canais.

## Fora de escopo

- Drawer de drill do canal (`onDrill cac_canal`) — sem mudanças nesta entrega.
- ROI no modo "Por contrato" com denominador diferente — ROI não usa denominador.
- Anualização do ROI MRR (LTV-like) — fórmula pedida é mensal simples.
