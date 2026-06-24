# BP 2026 — Evolução do estoque pontual por squad

**Data:** 2026-06-23
**Aba:** BP 2026 → Orçado × Realizado → Pontual
**Tipo:** Nova seção (terceiro bloco da aba)

## Objetivo

Mostrar a evolução mensal do **estoque pontual por squad** — o saldo de contratos pontuais em
estoque de cada squad, ao fim de cada mês. É o `(=) Estoque final` quebrado por **squad** (em vez de
por status).

## Decisões (brainstorming)
1. **Métrica:** estoque final (saldo total em estoque) por squad — `valorp>0` e status de estoque
   (ativo/triagem/pausado/onboarding/em cancelamento). A soma das linhas = `(=) Estoque final`.
2. **Formato:** tabela squad × mês (BPDreTable), mesmo padrão da aba, com YTD e drill.
3. **Régua:** snapshot (`cup_data_hist`), igual ao movimento de estoque logo acima.

## Estrutura-alvo

Terceiro bloco da aba (grupo `"Estoque pontual por squad"`), após a decomposição do Estoque final:
```
ESTOQUE PONTUAL POR SQUAD
🏛️ Olimpo        Jan … Jun        YTD (= posição do mês fechado)
💠 Pulse         …
🖥️ Tech          …
… (uma linha por squad, ordenado por estoque do mês corrente, desc)
```
- **YTD** = posição (saldo) do mês fechado — NÃO soma (é estoque, igual `Estoque final` e linhas de status).
- **Drill:** clicar (squad × mês) lista os contratos pontuais daquele squad no snapshot do mês.
- A soma das linhas de squad em cada mês = `(=) Estoque final` daquele mês (auditável).

## Arquitetura

### `bp2026.pontual.ts`
- A query do snapshot passa a trazer `h.squad` (`COALESCE(NULLIF(TRIM(h.squad),''),'(sem squad)')`).

### `bp2026.pontual.helpers.ts`
- `RegPontual` ganha `squad?: string`.
- Nova função `decomporSquad(atual: RegPontual[]): Record<string, number>` — soma `valorp` por squad,
  só do estoque (`ehEstoquePontual`), análoga a `decomporStatus`.
- `montarLinhasPontual`: após o bloco de estoque, emite uma linha por squad (grupo
  `GRUPO_SQUAD = "Estoque pontual por squad"`, `tipoAgregacao: "estoque"`), ordenadas por valor do mês
  corrente desc. Métrica `pontual_squad:<nome>`. YTD = posição do mês fechado.

### `bp2026.detalhe.ts`
- Drill: métrica que começa com `pontual_squad:` → `detPontualSnapshot(db, mes, false, r => r.squad === squad)`.
  O nome do squad é extraído de `metrica.slice("pontual_squad:".length)`. Reconhecida no gate via
  `metrica.startsWith("pontual_squad:")`. Título = o nome do squad.

### Frontend (`BPDreTable`)
- Sem mudança — grupo novo renderiza header automaticamente; linhas de squad são clicáveis (sem `subItem`).

## Testes (`bp2026.pontual.helpers.test.ts`)
- `decomporSquad`: soma `valorp` por squad só do estoque; soma total = estoque final.
- `montarLinhasPontual`: emite linhas `pontual_squad:<nome>` no grupo correto; soma das linhas de squad
  no mês = estoque final do mês; ordenação desc por valor.

## Edge cases
- Squad vazio/nulo → `(sem squad)`.
- Squad com emoji/espaço no nome: vai cru na métrica `pontual_squad:<nome>` (URL-encoded no fetch do drill).

## Fora de escopo
- Não alterar o bloco de Venda Pontual nem o movimento de estoque.
- Sem gráfico (decisão: tabela).
