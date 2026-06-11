# Bitrix: automação do campo "Data de reunião agendada"

## Por quê

O funil de broadcast do Cortex (aba **Funil** do CRM Marketing) conta a etapa
**Reunião marcada** pelo campo de data do card (`UF_CRM_1753386683` →
`data_reuniao_agendada` no espelho) e **Compareceu** pelo campo
`UF_CRM_1755642298` (`data_reuniao_realizada`). **Venda** usa a data de
fechamento nativa (CLOSEDATE), que o Bitrix preenche sozinho ao ganhar o deal.

O problema: esses campos de data de reunião dependem de preenchimento manual
pelo SDR, e a disciplina falha — medido em jun/2026:

| Estágio (deals desde 01/05) | Total | Com data de reunião |
|---|---|---|
| Agendamento direto | 83 | **0** |
| Contactado | 31 | **0** |
| Reunião agendada | 28 | 28 ✓ |
| Negócio Ganho | 64 | 45 |

Ou seja: reuniões que existem ficam invisíveis para o funil quando o card não
tem a data. A correção robusta é fazer o **próprio movimento do card** (ação
natural do SDR) preencher a data via automação do Bitrix.

## O que configurar (admin do Bitrix)

Para **cada pipeline** em que reunião é marcada (Outbound, Inbound, Bot SDR...):

1. Abrir o pipeline → **Automation rules** (Regras de automação) do estágio
   que representa "reunião marcada" (ex.: *Reunião agendada*, *Agendamento direto*).
2. Adicionar regra **"Modify document"** (Editar documento) disparada
   **ao entrar no estágio**:
   - Campo: **Data de reunião agendada** (`UF_CRM_1753386683`)
   - Valor: `{=System:Date}` (data atual) — **somente se o campo estiver vazio**
     (usar condição "Campo vazio" para não sobrescrever data já preenchida).
3. Repetir no estágio de "reunião realizada" para o campo
   **Data de reunião realizada** (`UF_CRM_1755642298`).
4. Alternativa mais rígida (em vez da automação): tornar o campo
   **obrigatório no estágio** (Pipeline → configurações do estágio → campos
   obrigatórios), forçando o SDR a informar a data real ao mover o card.

> Preferir a automação com data atual quando a reunião é agendada "para hoje"
> não é o caso comum — o ideal é a regra preencher com a data do agendamento
> se o processo usar atividade/calendário; na prática, a obrigatoriedade no
> estágio (opção 4) costuma dar o dado mais fiel.

## O que já está resolvido no Cortex (não depende disto)

- **Venda** não depende mais da data de reunião — usa CLOSEDATE (100% dos
  ganhos têm).
- O espelho dos deals atualiza de hora em hora (`scripts/sync-bitrix-deals.ts`).
- O match respondedor→deal não depende mais do sync de contatos do GHL
  (fallback pelo telefone da conversa).

Esta automação fecha o último elo: **Reunião marcada / Compareceu** refletindo
fielmente o trabalho do SDR sem depender de ele lembrar de preencher campo.
