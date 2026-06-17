# Design — Segmentação de bases por coorte de entrada (recência)

**Data:** 2026-06-17
**Status:** Desenho (aprovação pendente) — não implementar ainda
**Contexto:** aba Planejamento de Broadcast (GHL), módulo `shared/ghl-broadcast/*`

---

## 1. Problema

Hoje uma "base" é definida **só por tags** (`BASE_TAG_MAP`): ex. `Creators - MQLs` = `[status]_mql` + `[lead]_creators`. A base **não sabe quando a pessoa entrou**. Consequência: um disparo pra "Creators MQL" hoje atinge gente que entrou ao longo de mais de um ano, misturando lead quente (entrou essa semana) com lead frio (entrou há 14 meses). Não dá pra ser assertivo nem ter controle de com quem se está falando.

### Evidência (dados reais, jun/2026)
- `ghl_contacts.date_added` tem **100% de cobertura** (49.596 contatos, set/2024 → jun/2026).
- `Creators - MQLs` (189 contatos): entradas concentradas em **2025** (pico jul/2025 = 66), **zero em 2026**.
- `Creators - Todos` (10.924): fluxo fresco todo mês (jun/2026 = 369, mai = 870, abr = 743…).

→ A recência é uma dimensão real e grande. O dado pra fazer o recorte **já existe** (`date_added`), sem precisar de tag nova.

---

## 2. Decisões tomadas (com a Raquel, 2026-06-17)

1. **Base vira 2 eixos:** filtro qualitativo (funil/status — o que já existe) **×** coorte de recência (janela sobre `date_added`).
2. **Trava de cadência por `base × coorte`** (não só por base). "Creators-MQLs novos" e "Creators-MQLs antigos" são públicos diferentes → podem ser disparados na mesma semana sem violar a regra de fadiga.
3. **Presets de coorte:** mês atual · mês passado · últimos 3 meses · **personalizado** (safra fixa por mês/intervalo).
4. **Arquitetura:** híbrida — **cérebro no dash de CRM (Cortex/Planejamento), execução no GHL ("funnels")**. Ver seção 6.

---

## 3. Modelo de dados

### Coorte = janela sobre `date_added`, relativa à data do disparo
| Preset | Definição | Quem é | Uso típico |
|---|---|---|---|
| **Mês atual** | `date_added` no mês-calendário corrente | entrou agora | quente — agendamento direto (HOOK/CASE) |
| **Mês passado** | mês-calendário anterior | esfriando | reforço/nutrição |
| **Últimos 3 meses** | últimos 90 dias | janela ampla recente | volume com alguma frescura |
| **Personalizado** | mês absoluto (ex. dez/2025) ou intervalo de datas | safra fixa | campanha pontual / acompanhar safra |

> Coortes dinâmicas (mês atual/passado/3 meses) recalculam a cada disparo. A personalizada é fixa.

### Slot do planejamento ganha o campo coorte
`broadcast_plan` ganha **`coorte`** (text, ex. `mes_atual` | `mes_passado` | `ult_3_meses` | `custom:2025-12` | `custom:2026-01-01..2026-02-15`). `NULL` = base inteira (comportamento atual, retrocompatível).

### Cálculo de audiência
A audiência de um slot passa a ser: `getBaseFiltro(base)` (tags, como hoje) **AND** `date_added` dentro da janela da coorte. A lógica de match de tag (`contatoSatisfazBase` + aliases) **não muda** — só ganha o predicado de data por cima.

---

## 4. Cadência por base × coorte

`regras-calendario.ts` hoje trava por `base` (janela 7d, 14d/padrão, limite mensal). Passa a chavear por **`base|coorte`**:
- `verificaJanela7Dias`, `verificaJanela14DiasPadrao`, `verificaLimiteMensal` agrupam por `base + coorte` em vez de só `base`.
- `buildDisparosHistoricos` (server) passa a registrar a coorte de cada disparo (precisa que `broadcast_classification`/`broadcast_plan` guardem a coorte).
- Efeito: você pode planejar "Creators-MQLs · mês atual" na segunda e "Creators-MQLs · mês passado" na quarta — duas pessoas distintas, zero violação.

⚠️ **Atenção a sobreposição:** "últimos 3 meses" CONTÉM "mês atual" e "mês passado". Se o operador usar janelas que se sobrepõem na mesma semana, há risco de a mesma pessoa receber 2 disparos. Mitigação: alertar (warn) quando coortes sobrepostas da mesma base aparecem na mesma semana, OU tratar coortes como mutuamente exclusivas ("mês atual" = só este mês; "1–3 meses" = exclui o mês atual). **Decisão de produto pendente.**

---

## 5. Mensagem validada × coorte (3ª dimensão)

A matriz de validação hoje é `base × oferta × padrão`. Recência é o eixo natural pra completá-la:
- **Coorte nova** → objetivo "Agendar reunião", padrões de ataque (HOOK_PROVOCATIVO, CASE_STUDY).
- **Coorte antiga** → objetivo "Reativação"/"Nutrição", padrões de reaquecimento (REATIVACAO, URGENCIA_SAZONAL). É a mesma lógica que a matriz já aplica pra base "Congelados".

Proposta: uma regra leve `coorte → objetivo/padrão sugerido` (warn, não block) que orienta sem travar.

---

## 6. Arquitetura: dash de CRM vs "funnels" (GHL)

Há dois trabalhos distintos:
- **Decidir** (qual coorte, qual mensagem, qual dia, respeitando cadência e validação) = **inteligência**.
- **Executar** (puxar a lista e disparar) = **entrega**.

Toda a inteligência **já vive no Cortex**: matriz de validação, regras de cadência, calendário de planejamento, ranking de leverage por performance real, e o espelho dos contatos (`ghl_contacts` com `date_added` + tags). O **GHL ("funnels") é onde o disparo sai** (bulk actions / workflows / campaigns), e o GHL filtra contatos nativamente por **"Date Added" + tags** (smart lists).

→ **Recomendação: híbrido.**
- **Cérebro no dash de CRM (Cortex / aba Planejamento):** seletor de coorte no slot, cálculo do tamanho da coorte em tempo real, trava por base×coorte, validação. É onde a decisão é tomada.
- **Mãos no GHL ("funnels"):** na hora de disparar, a coorte definida no dash vira um filtro de smart list no GHL (tags da base + "Date Added" na janela). Como o GHL filtra por Date Added nativamente, a coorte mapeia **1:1** — sem descasamento de público.

### Por que não construir só no GHL/funnels
O GHL não tem o cérebro da Turbo: sem matriz de validação, sem cadência, sem calendário de planejamento, sem ranking por performance. Construir lá perde toda a inteligência que já existe no Cortex.

### Por que não construir só no dash (e o dash disparar)
O dash não dispara — quem dispara é o GHL. O dash pode calcular e até empurrar a lista, mas o envio é do GHL.

### Dois níveis de integração (decisão de fase)
- **Nível 1 — manual (começo):** o dash mostra a coorte e a "receita" do filtro (ex.: `[lead]_creators + [status]_mql` + Date Added últimos 30d = 40 pessoas); o operador recria esse filtro como smart list no GHL e dispara. Zero risco, rápido.
- **Nível 2 — automático (depois):** o dash empurra a coorte pro GHL via API — cria/atualiza uma smart list, OU aplica uma tag de coorte (ex.: `[coorte]_2026_06`) nos contatos. Aí o disparo no GHL é só escolher a lista/tag. (O sync hoje só lê contatos/tags via `/contacts/search` e `/locations/{id}/tags`; escrever exigiria estender `goHighLevelSync`.)

---

## 7. Fases de implementação (quando aprovado)

1. **Fase 1 — coorte como filtro de leitura (dash):** predicado `date_added` no cálculo de audiência + seletor de coorte no editor de slot, mostrando o tamanho da coorte em tempo real. Persistir `coorte` em `broadcast_plan`. Nível 1 de integração (operador recria o filtro no GHL). _Entrega valor sem tocar no GHL._
2. **Fase 2 — cadência por base×coorte:** chavear `regras-calendario` e `buildDisparosHistoricos` por `base|coorte`; tratar sobreposição (seção 4).
3. **Fase 3 — validação coorte→padrão:** regra leve recência → objetivo/padrão sugerido na matriz.
4. **Fase 4 — push pro GHL (Nível 2):** estender `goHighLevelSync` pra criar smart list / aplicar tag de coorte via API.

---

## 8. Questões em aberto

1. **Sobreposição de coortes** (seção 4): coortes mutuamente exclusivas ou só alertar? (recomendo exclusivas por padrão + opção de sobrepor com warn).
2. **"Creators - MQLs" tem 0 entradas em 2026** — o tag de qualificação MQL mudou? Parou de ser aplicado? Afeta quais coortes existem de fato nessa base. **Investigar antes da Fase 1.**
3. **Definição de "mês atual":** mês-calendário (1–30) ou últimos 30 dias rolantes? (recomendo mês-calendário pra casar com o filtro nativo do GHL).
4. **Nível de integração inicial:** confirmar começar no Nível 1 (manual) — sim, é o recomendado.
