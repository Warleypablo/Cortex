# 🚀 Deploy do Publicador Orgânico na Render (24/7, independente do Mac)

Como deixar o agente publicando **sozinho na nuvem** — Mac ligado, desligado ou
fechado não importa. O motor (`agente/main_poller.py`) já existe; aqui só
hospedamos ele.

**Escopo desta v1:** Instagram, via **Cron Job** que roda `--once` a cada 5 min.
TikTok fica pra depois (precisa resolver token efêmero — ver fim do doc).

---

## Como funciona (modelo de execução)

A cada 5 min a Render sobe um container novo, roda **um tick** e desliga:

```
python -m agente.main_poller --once
```

Um tick faz 3 coisas (`main_poller.py:tick`):
1. **reporta** o estado de cada card aprovado pro painel (saúde + readiness)
2. **consome** os comandos do painel (Soltar agora / Agendar / Cancelar)
3. **publica** os cards cujo horário (campo do card) já venceu

Não precisa de ninguém clicando nada. O card sai no horário dele (com até ~5 min
de atraso, que é a granularidade do cron).

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

1. **New → Cron Job** → conecte o repo do Cortex.
2. **Root Directory:** `automacoes/instagram-turbo`
3. **Runtime:** Python · **Build:** `pip install -r requirements.txt`
4. **Command:** `python -m agente.main_poller --once`
5. **Schedule:** `*/5 * * * *`
6. **Secret File:** adicione um arquivo chamado **`service-account.json`** com o
   conteúdo do JSON. A Render monta em `/etc/secrets/service-account.json`
   (já é o valor de `GOOGLE_SERVICE_ACCOUNT_JSON` abaixo).
7. **Environment Variables:** preencha a tabela abaixo.
8. **⚠️ Suba primeiro com `DRY_RUN=1`** e rode o cron manualmente (botão *Run*)
   uma vez. Confira nos logs que ele lista as tasks e reporta pro painel **sem
   publicar**. Veja o painel "Orgânico" do Cortex atualizar.
9. Validado? Troque **`DRY_RUN=0`** e salve. A partir daí publica de verdade.

> Alternativa IaC: o `render.yaml` ao lado tem essa mesma spec pronta. Pra usar
> como Blueprint, **mova-o pra raiz do repo** e conecte — mas revise antes,
> porque o web service do Cortex hoje é gerenciado pelo dashboard, não por
> Blueprint.

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
Cada tick faz POST do ciclo pro painel (`state_sink.report_cycle`) — então o
painel "Orgânico" mostra "último tick" e saúde. Configure um **alerta** (o
WhatsApp da Fase 4 já estava no mapa) pra avisar "sem tick há > 20 min" ou
"falha ao publicar". Sem isso, você não fica sabendo que parou.

### 4. O conteúdo upstream continua humano
O agente publica sozinho, mas só sai card **pronto**: legenda no Doc, mídia no
Drive, **Data de postagem + Horário** preenchidos. Card incompleto ele pula de
propósito (é o `readiness` funcionando). A publicação é 100% automática; o
*abastecimento dos cards* segue manual.

### 5. Custo do Anthropic
Todo tick replaneja cada card aprovado, e cards sem legenda podem chamar o Claude.
Com muitos cards isso é custo + latência a cada 5 min. Se virar problema, dá pra
separar o "report" (frequente) do "publish" (frequente) do replanejamento pesado.

---

## Validação pós-deploy (checklist)

- [ ] Cron rodou com `DRY_RUN=1` e logou as tasks **sem publicar**.
- [ ] Painel "Orgânico" do Cortex atualizou (a rota `/ingest` aceitou o bearer
      token — ela é token-auth, não sessão).
- [ ] Service Account lê Drive/Docs e tem acesso ao bucket `turbo-ig-rehost`.
- [ ] `DRY_RUN=0` e **um** post real saiu no horário do card (confira que o
      comentário `[agente:postado v1]` apareceu na task e que NÃO duplicou).
- [ ] Lembrete de rotação do token Meta criado (~50 dias).

---

## TikTok (quando for a hora)
O TikTok guarda os tokens em `.cache/tiktok_tokens.json` — que **some a cada
deploy** na Render (disco efêmero). Antes de subir o TikTok num cron, mova o
refresh token pra um lugar persistente (banco/secret). O resto do orquestrador
(`agente/main_tiktok.py`) já existe.
