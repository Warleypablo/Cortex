# TikTok orgânico — setup & operação

Entrypoint **separado** do Instagram: `agente/main_tiktok.py`. Reusa todo o
pipeline de leitura (ClickUp → Drive → Doc) e só troca a publicação. O IG
(`agente/main.py`) **não é tocado**.

> ⚠️ Pré-requisito compartilhado: o **Bloco B** do `CHECKLIST-EXECUCAO.md`
> (token ClickUp, Service Account do Google compartilhada com a pasta dos meses)
> precisa estar pronto — é o mesmo plumbing que o IG usa. Sem ele, o TikTok
> também não roda.

## 1. App no TikTok (o gargalo — começar já)
1. [developers.tiktok.com](https://developers.tiktok.com) → criar app.
2. Adicionar produto **Content Posting API**.
3. Scopes: `user.info.basic`, `video.upload` (rascunho), `video.publish` (direct).
4. Registrar a **Redirect URI** (HTTPS) do OAuth.
5. Copiar **Client Key/Secret** → `.env`:
   ```
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   TIKTOK_REDIRECT_URI=https://...
   ```
6. **Auditoria do app**: só é necessária pra **Direct Post público**. Sem
   auditoria dá pra operar em **rascunho** (inbox) ou direct **SELF_ONLY**.

## 2. Autorizar a conta da Turbo (OAuth, uma vez)
```bash
python3 -m agente.tiktok auth-url            # abre o link, autoriza na conta TikTok da Turbo
python3 -m agente.tiktok exchange --code <CODE_DA_URL_DE_RETORNO>
python3 -m agente.tiktok whoami              # confirma token + conta
```
Tokens ficam em `.cache/tiktok_tokens.json` e renovam sozinhos (refresh_token ~365d).

## 3. Lista do TikTok no ClickUp
```
CLICKUP_LIST_ID_TIKTOK=<id da lista do TikTok>
TIKTOK_POST_MODE=draft          # draft (default) | direct
TIKTOK_PRIVACY_LEVEL=SELF_ONLY  # só p/ direct
```

## 4. Rodar
```bash
DRY_RUN=1 python3 -m agente.main_tiktok                  # dry-run (não publica)
DRY_RUN=1 python3 -m agente.main_tiktok --task-id <id>   # debug de 1 card
DRY_RUN=0 python3 -m agente.main_tiktok --task-id <id> --force-now   # publica agora (rascunho)
DRY_RUN=0 python3 -m agente.main_tiktok --task-id <id> --direct      # força direct (precisa auditoria p/ público)
```

## Limitações conhecidas (MVP)
- **Só vídeo** (reels/single de vídeo). Carrossel/foto são pulados (TikTok photo
  mode não implementado).
- **Rascunho não aplica legenda** — o `inbox/init` do TikTok não aceita título;
  a pessoa digita ao publicar. Legenda automática só no modo **direct**.
- **Direct sem `creator_info/query`** — pra direct público em conformidade total
  falta o pré-check de privacidade/comment-duet-stitch. Implementar antes do
  go-live público.
- **Idempotência**: reusa o marker `[agente:postado v1]`. Como TikTok e IG ficam
  em listas diferentes, não há colisão. (Se um dia o mesmo card for pra IG *e*
  TikTok, criar marker por plataforma.)
