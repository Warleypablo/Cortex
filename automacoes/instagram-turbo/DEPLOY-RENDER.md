# 🚀 Deploy do Publicador Orgânico na Render (24/7, independente do Mac)

> **NOTA (jul/2026):** o blueprint (`render.yaml`) agora vive na **RAIZ do repo**
> (a Render só lê blueprint na raiz). A cópia que existia nesta pasta foi removida.
> Estado atual de prod: DRY_RUN=0, report `*/30`, publish `*/15`.

Como deixar o agente publicando **sozinho na nuvem** — Mac ligado, desligado ou
fechado não importa. O motor (`agente/main_poller.py`) já existe; aqui só
hospedamos ele.

**Escopo desta v1:** Instagram, via **dois Cron Jobs** em ritmos diferentes.
TikTok fica pra depois (precisa resolver token efêmero — ver fim do doc).

---

## Como funciona (modelo de execução) — DOIS ritmos

A releitura do ClickUp é **pesada** (lista as aprovadas + lê Doc/Drive de cada
card), mas a publicação precisa ser **frequente** (pra sair no horário). Resolver
os dois com um cron único forçaria escolher entre "martelar o ClickUp" ou "postar
atrasado". Por isso são **dois crons**:

| Cron | Ritmo | Comando | O que faz |
|---|---|---|---|
| **Releitura** | de hora em hora | `--mode report` | Relê o ClickUp, pega cards novos do dia, atualiza o calendário (24x/dia ≫ as 3x pedidas). |
| **Publicação** | a cada 5 min | `--mode publish` | Publica os cards cujo horário venceu + executa os botões (Soltar/Agendar/Cancelar/Pausar). **Não relê o ClickUp inteiro** — só pergunta ao Cortex "tem algo pra postar / botão clicado?" (consulta leve no banco; só toca o ClickUp quando vai publicar um card específico). |

Resultado: card novo aparece no calendário em até ~1h; post sai no horário (atraso
≤5 min); "Soltar agora" responde em ≤5 min (lê aquele card na hora, não espera a
releitura). Ninguém precisa clicar nada pro fluxo automático.

> **Trade-off da releitura horária:** um card adicionado no ClickUp *entre* duas
> releituras (ex.: criado 14h05 pra sair 14h30) só entra no calendário na próxima
> hora — e pode sair atrasado. Se for urgente, o atalho é **"Soltar agora"** no
> painel (não depende da releitura). Quer menos atraso? Suba a frequência do cron
> de releitura (ex.: `*/30 * * * *`).

> **Por que Cron e não Worker 24/7?** Mais barato, sem processo travado em
> memória, e cada run é isolado — se um tick crashar, o próximo sobe limpo.

---

## Pré-requisitos (uma vez)

- [ ] Conta Render com acesso ao repo (mesmo onde o Cortex já deploya).
- [ ] **Service Account JSON** do Google com acesso de leitura às pastas/Docs do
      Drive **e** `roles/storage.objectAdmin` no bucket `turbo-ig-rehost`.
- [ ] **Meta long-lived token** válido + `IG_BUSINESS_ACCOUNT_ID`.
- [ ] Token do Cortex (`ORGANICO_INGEST_TOKEN`) — o **mesmo** valor que está no
      ambiente do Cortex (a rota `/api/growth/organico/ingest` valida por ele).

> **Sem mudança de código.** O `config.py` lê tudo de variáveis de ambiente, e o
> Google aceita o JSON como **Secret File** montado em disco. `requirements.txt`
> não tem dependências (o `agente/` é stdlib puro; assinatura RS256 usa o
> `openssl` que já vem na imagem Python da Render).

---

## Passo a passo (Dashboard da Render — recomendado)

São **dois Cron Jobs**, idênticos exceto **Schedule** e **Command**. Crie os dois:

| | Cron 1 — Releitura | Cron 2 — Publicação |
|---|---|---|
| **Name** | `organico-report-instagram` | `organico-publish-instagram` |
| **Schedule** | `0 * * * *` (de hora em hora) | `*/5 * * * *` (a cada 5 min) |
| **Command** | `python -m agente.main_poller --once --mode report` | `python -m agente.main_poller --once --mode publish` |

Para **cada** cron:
1. **New → Cron Job** → conecte o repo do Cortex.
2. **Root Directory:** `automacoes/instagram-turbo`
3. **Runtime:** Python · **Build:** `pip install -r requirements.txt`
4. **Command** e **Schedule:** conforme a tabela acima.
5. **Secret File:** adicione um arquivo chamado **`service-account.json`** com o
   conteúdo do JSON (precisa nos **dois** crons). A Render monta em
   `/etc/secrets/service-account.json` (já é o valor de `GOOGLE_SERVICE_ACCOUNT_JSON`).
6. **Environment Variables:** preencha a tabela abaixo (nos dois). Dica: crie um
   **Environment Group** `organico-instagram` com tudo e linke nos dois crons —
   aí você mantém as variáveis num lugar só.
7. **⚠️ Suba primeiro com `DRY_RUN=1`** e rode cada cron na mão (botão *Run*).
   Confira nos logs: o `report` lista as tasks e atualiza o painel; o `publish`
   roda leve **sem publicar**. Veja o painel "Orgânico" do Cortex atualizar.
8. Validado? Troque **`DRY_RUN=0`** no grupo/variáveis e salve. A partir daí publica.

> Alternativa IaC: o `render.yaml` ao lado já tem os dois crons + o Environment
> Group prontos. Pra usar como Blueprint, **mova-o pra raiz do repo** e conecte —
> mas revise antes, porque o web service do Cortex hoje é gerenciado pelo
> dashboard, não por Blueprint. (O Secret File continua sendo upload manual.)

### Variáveis de ambiente

| Variável | Valor | Secreto? |
|---|---|---|
| `DRY_RUN` | `1` p/ validar → `0` p/ produção | não |
| `CLICKUP_API_TOKEN` | *(token pessoal pk_…)* | **sim** |
| `CLICKUP_WORKSPACE_ID` | `31021986` | não |
| `CLICKUP_LIST_ID_INSTAGRAM` | `901300920768` | não |
| `CLICKUP_POSTING_DATE_FIELD` | `Data de postagem` | não |
| `CLICKUP_HORARIO_FIELD` | `Horário` | não |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `/etc/secrets/service-account.json` | não (o arquivo é Secret File) |
| `GOOGLE_DRIVE_MESES_ROOT_FOLDER_ID` | `1yGxKCORxe7PipuYKY1yd508IWQyKgIIt` | não |
| `GCS_REHOST_BUCKET` | `turbo-ig-rehost` | não |
| `META_LONG_LIVED_TOKEN` | *(token de 60 dias)* | **sim** |
| `IG_BUSINESS_ACCOUNT_ID` | *(id da conta IG business)* | **sim** |
| `ANTHROPIC_API_KEY` | *(sk-ant-…)* | **sim** |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | não |
| `CORTEX_INGEST_URL` | `https://cortex.turbopartners.com.br/api/growth/organico/ingest` | não |
| `ORGANICO_INGEST_TOKEN` | *(o mesmo do .env do Cortex)* | **sim** |

---

## ⚠️ O que mantém isso "100% automático" de verdade

Estes são os pontos que matam um sistema desatendido se ignorados:

### 1. Token da Meta expira a cada 60 dias — **risco nº 1**
É o que vai derrubar tudo silenciosamente: roda lindo por 2 meses e para sem
avisar. Mitigação mínima desta v1: **lembrete no calendário a cada ~50 dias**
pra trocar o `META_LONG_LIVED_TOKEN` no dashboard. Evolução: um segundo cron
mensal que troca o token via `GET /oauth/access_token?grant_type=fb_exchange_token`
(precisa de `META_APP_ID`/`META_APP_SECRET`) e grava o novo em lugar persistente
(o disco da Render é efêmero, então tem que ir pro banco/secret, não pra arquivo).

### 2. Post duplicado — por que NÃO acontece (e o limite)
A idempotência real é o comentário **`[agente:postado v1]`** na task do ClickUp
(`idempotency.py`) — persiste entre runs, então cada container novo enxerga o que
já foi postado. **O lockfile `.cache/.lock` NÃO protege na Render** (disco efêmero
por container — e o poller nem usa ele). A proteção contra duplicar depende de:
(a) o marcador do ClickUp + (b) a Render **não sobrepor** runs de cron (ela pula
um agendamento se o anterior ainda está rodando). Janela de risco teórica: se um
publish demora > 5 min e a Render sobrepuser, dois ticks poderiam pegar o mesmo
card antes do marcador ser escrito. Na prática um tick que não publica é < 30s.
**Monitore a duração do tick** — se passar de alguns minutos com frequência, suba
o `schedule` pra `*/10` ou migre pra Worker 24/7 com lock real.

### 3. Monitoramento / heartbeat
Os **dois** crons batem heartbeat no painel: o `report` (de hora em hora) manda o
ciclo completo com as contagens, e o `publish` (a cada 5 min) manda um heartbeat
leve — então a saúde do painel ("último tick") fica fresca a ≤5 min, sem parecer
parada entre as releituras. Configure um **alerta** (o WhatsApp da Fase 4 já
estava no mapa) pra avisar "sem tick há > 15 min" ou "falha ao publicar". Sem
isso, você não fica sabendo que parou.

### 4. O conteúdo upstream continua humano
O agente publica sozinho, mas só sai card **pronto**: legenda no Doc, mídia no
Drive, **Data de postagem + Horário** preenchidos. Card incompleto ele pula de
propósito (é o `readiness` funcionando). A publicação é 100% automática; o
*abastecimento dos cards* segue manual.

### 5. Custo do Anthropic e carga no ClickUp — já mitigados pela separação
A releitura pesada (listar aprovadas + ler Doc/Drive de cada card, podendo chamar
o Claude pra legenda) roda **só de hora em hora** (`--mode report`), não a cada
5 min. O cron de 5 min (`--mode publish`) é leve: consulta o Cortex e só toca
ClickUp/Drive/Anthropic quando *de fato* vai publicar um card. Isso já segura
custo do Anthropic e rate-limit do ClickUp. Se ainda assim apertar, baixe a
frequência da releitura (ex.: `0 6-22 * * *` = só em horário comercial).

---

## Validação pós-deploy (checklist)

- [ ] Os **dois** crons rodaram com `DRY_RUN=1`: o `report` listou as tasks e o
      `publish` rodou leve, ambos **sem publicar**.
- [ ] Painel "Orgânico" do Cortex atualizou (a rota `/ingest` aceitou o bearer
      token — ela é token-auth, não sessão), e a saúde mostra "último tick" recente.
- [ ] Card novo criado no ClickUp aparece no calendário **na releitura seguinte**
      (≤ 1h) — confirma o ciclo ClickUp → calendário.
- [ ] Service Account lê Drive/Docs e tem acesso ao bucket `turbo-ig-rehost`.
- [ ] `DRY_RUN=0` e **um** post real saiu no horário do card (confira que o
      comentário `[agente:postado v1]` apareceu na task e que NÃO duplicou).
- [ ] **"Soltar agora"** no painel publica em ≤5 min (testa o cron `publish`).
- [ ] Lembrete de rotação do token Meta criado (~50 dias).

---

## TikTok (quando for a hora)
O TikTok guarda os tokens em `.cache/tiktok_tokens.json` — que **some a cada
deploy** na Render (disco efêmero). Antes de subir o TikTok num cron, mova o
refresh token pra um lugar persistente (banco/secret). O resto do orquestrador
(`agente/main_tiktok.py`) já existe.
