# ads-pipeline — ClickUp → Biblioteca → Conjuntos Meta (PAUSED) → WhatsApp

Quando um criativo é gravado, editado e **aprovado** na lista **Anúncios** do ClickUp, este
pipeline prepara tudo no Meta **menos o upload do vídeo** (a conta é dev-tier, sem quota pra
upload) e te avisa no WhatsApp pra você fazer o upload manual no Gerenciador.

## O que ele faz, por lote

1. Lê as tasks da lista `Anúncios` no status **`aprovado`**.
2. **Filtra** o que é criativo de verdade (nome `vv-/img-/car-` ou `Tipo Task = Criativo*`) —
   ignora etapas de produção que também ficam em `aprovado` (Edição, Design, "Editar criativos").
3. Lê os campos da task → resolve campanha (Funil), público, verba, pasta do Drive, Range dos TPs.
4. Pelos TPs, lê os criativos na **Biblioteca** (`cortex_core.creatives_library`) p/ pegar
   `nome_final`, personagem e hooks.
5. Cria o **conjunto PAUSED** no Meta clonando a config do conjunto-template (targeting,
   otimização, pixel) — **sem criar ads/subir vídeo**. Nomenclatura padrão Turbo.
6. Manda **WhatsApp** (Evolution/TurboZap) pedindo o upload dos criativos no Gerenciador, já
   com a lista de `nome_final` pra nomear cada ad.
7. **Comenta** na task com o marcador `[ads-pipeline:preparado]` (idempotência) e, se
   `ADS_PIPELINE_DONE_STATUS` estiver setado, move o status.

## Como rodar

```bash
npx tsx pipeline-clickup-ads.ts                 # DRY-RUN: varre e mostra o plano (não escreve nada)
npx tsx pipeline-clickup-ads.ts --task 86xxxx   # DRY-RUN de uma task específica
npx tsx pipeline-clickup-ads.ts --live          # EXECUTA (cria conjuntos, manda WhatsApp, comenta)
```

Padrão é **dry-run**. `--live` só escreve quando você manda.

## Contrato dos campos no ClickUp (lista Anúncios)

Pra um lote ser processado **corretamente**, a task do criativo precisa ter:

| Dado | Onde | Obrigatório | Sem ele… |
|---|---|---|---|
| Nome no padrão `vv-/img-/car-…` | nome da task | sim (gatilho do filtro) | a task é ignorada como "não-criativo" |
| **Funil** (ex: Creators) | custom field `Funil` | sim | sem campanha alvo → não cria conjunto |
| **Range dos TPs** (ex: `TP1616-TP1618`) | custom field `Range dos TPs` | recomendado | personagem/hooks/nome_final saem do nome (chute) |
| Pasta do Drive | link na **descrição** | recomendado | WhatsApp vai sem o link dos criativos |
| **Verba** | custom field `Verba destinada pro teste` | não | usa R$20/dia padrão |
| Público | custom field `Público alvo` | não | usa "Aberto" |

Mapa Funil → campanha/template fica em `config.ts` (`FUNIL_TARGETS`), tudo sobrescrevível por env.

## ⚠️ Higiene de status (importante)

O status `aprovado` **acumula tasks já subidas** se elas não forem movidas pra `upado`/`postado`
depois do upload. Hoje (2026-06-18) os 5 lotes em `aprovado` são 3 etapas de produção + 2
criativos que **já estão no ar** (conjuntos 142–148, subidos pelos scripts one-off). O pipeline
marca a task com `[ads-pipeline:preparado]` pra não reprocessar o que ELE já tocou, mas não
reconhece o que foi subido manualmente/por script. **Regra de ouro: mover a task pra `upado`
assim que subir o criativo** — assim `aprovado` = realmente pendente.

## Go-live checklist

- [ ] Definir `ADS_PIPELINE_WPP_DEST` (E.164 com 55, ex: `5527…`) e `ADS_PIPELINE_WPP_INSTANCE`.
- [ ] Limpar os `aprovado` stale (mover 142–148 já subidos pra `upado`).
- [ ] Garantir o contrato de campos num lote NOVO de teste.
- [ ] Rodar `--task <id>` em dry-run, conferir o conjunto/mensagem, então `--task <id> --live`.
- [ ] Conferir no Gerenciador; se for teste, apagar o conjunto órfão.
- [ ] (Opcional) agendar (cron/loop) a varredura periódica da lista.

## Arquivos

- `config.ts` — env, IDs de campo, mapa Funil→campanha/template.
- `clickupClient.ts` — cliente ClickUp v2 (list/get/comment/status + helpers de custom field).
- `pipeline.ts` — parsing, planejamento, execução (gated por dry-run), mensagem.
- `../../../pipeline-clickup-ads.ts` — entrypoint CLI.
