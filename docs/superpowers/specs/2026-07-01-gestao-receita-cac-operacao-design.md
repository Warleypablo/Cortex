# Custo da operação — Orçado × Realizado (seção CAC, aba Macro de /gestao/receita)

**Data:** 2026-07-01 · **Status:** aprovado via mockup do usuário (nota do rodapé do mockup define as fontes)

## Objetivo

Detalhar a composição do custo comercial na seção "CAC — custo de aquisição" da aba
Macro, com uma tabela Orçado × Realizado por item de custo, espelhando o mockup enviado.

## Linhas da tabela

| Item | Realizado | Orçado (default) |
|---|---|---|
| (-) Growth | Cortex · `cac_growth` (06.06.02) | BP `cac_growth`, editável |
| (-) ADs | Cortex · `cac_ads` (06.06.01) | BP `cac_ads`, editável |
| (-) Ferramentas | **manual** | manual (sem BP), editável |
| (-) Pré-vendas | Cortex · `cac_pre_vendas` (06.04.03) | BP `cac_pre_vendas`, editável |
| (-) Comissões PV | **manual** (Conta Azul não separa PV×Vendas) | manual, editável |
| (-) Vendas | Cortex · `cac_vendas` (06.04.02) | BP `cac_vendas`, editável |
| (-) Comissões Vendas | **manual** | manual, editável |
| (-) Gerência | Cortex · `cac_gerencia` (06.04.01) | BP `cac_gerencia`, editável |
| (-) Eventos | **manual** (decisão do mockup, apesar de existir 06.07.01) | BP `cac_eventos`, editável |
| **Custo total** | soma | soma |

Realizado "Cortex" = regime caixa do Conta Azul (`somaDespesaCaixaPorMes` + `PREDICADOS_CAC_SUB`),
mesma régua do restante da tela.

## Armazenamento dos manuais

Reusa `cortex_core.gestao_receita_metas(chave, ano, mes, valor)` — sem tabela nova.
Chaves novas:

- `cac_op_orc:<item>` — override do orçado (todos os 9 itens)
- `cac_op_real:<item>` — realizado manual (ferramentas, comissoes_pv, comissoes_vendas, eventos)

Regex `CHAVE_META_OK` do PUT estendida para aceitar `cac_op_(orc|real):[a-z_]+`.

## Semântica por período

- **Orçado**: `override[cac_op_orc:item] ?? BP[chave] ?? 0`. Override só aplica em mês
  único (regra existente da tela); em período multi-mês vale a soma do BP.
- **Realizado manual**: soma das entradas mensais do período (sempre — é fato, não meta).
- **Realizado Cortex**: soma caixa dos meses do período (já existente).
- Edição só em mês único, pelo botão "Editar metas" existente.

## UI

- Nova tabela `SectionCard` dentro do bloco CAC (abaixo dos cards CAC por contrato/cliente).
- Colunas: Item | Orçado | Realizado | Var. Linha de total em negrito com soma ao vivo
  (usa rascunho durante a edição).
- Orçado: vira `MetaInput` no modo edição (todos). Realizado: `MetaInput` só nos 4 manuais;
  linhas Cortex mostram pill "Conta Azul" e abrem drill (`tipo=cac_sub`, chave = predicado).
- Var. = `VarPill` com `lowerIsBetter` (estourar custo = vermelho).
- Nota explica: itens manuais, e que o card "Custo comercial total (CAC)" inclui também
  Brindes/Viagens/Outras despesas comerciais (fora da tabela) — o Custo total daqui é menor.

## Drill

Novo tipo `cac_sub` em `gestaoReceita.detalhe.ts`: chave = nome do predicado em
`PREDICADOS_CAC_SUB` (whitelist), mesma query de parcelas quitadas dos tipos de custo.

## Fora de escopo

- Linha "Outros (Brindes/Viagens/Outras)" para reconciliar com o card CAC — pode ser
  adicionada depois se o time quiser que o total bata com o card.
- Split automático das comissões (exigiria mudar plano de contas do Conta Azul).
