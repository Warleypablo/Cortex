#!/bin/bash
# Re-publica UMA task no horário agendado (chamado pelo launchd), IGNORANDO a
# checagem de idempotência. Usado quando o card já foi marcado POSTADO mas
# queremos repostar de propósito (ex.: criativo corrigido). Mesmo esqueleto do
# scheduled_publish.sh, mas chama scripts/republish.py (resolve a pasta pelo
# slug e publica direto).
#
# Uso: scheduled_republish.sh <task_id> <MES> <slug> <caption_file> <launchd_label|->
#   task_id        : id da task no ClickUp
#   MES            : mês em maiúsculo (ex.: JUNHO) — usado pra achar a pasta no Drive
#   slug           : TURBO_<slug> da pasta do post
#   caption_file   : arquivo com a legenda
#   launchd_label  : label do LaunchAgent p/ auto-remoção após rodar, ou "-"
#
# ATENÇÃO: republish.py NÃO tem idempotência (reposta sempre). Pra evitar
# repostagem dupla caso o launchd dispare 2x, este wrapper grava um sentinela
# .cache/republish_<task>.done após o 1º sucesso e recusa repetir.
set -uo pipefail

PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH"
cd "$PROJ" || { echo "cd falhou"; exit 1; }

TASK="${1:?task_id obrigatório}"
MES="${2:?mes obrigatório}"
SLUG="${3:?slug obrigatório}"
CAPFILE="${4:?caption_file obrigatório}"
LABEL="${5:--}"

mkdir -p "$PROJ/logs" "$PROJ/.cache"
LOG="$PROJ/logs/scheduled_republish_${TASK}.log"
DONE="$PROJ/.cache/republish_${TASK}.done"

{
  echo "════════ $(date '+%Y-%m-%d %H:%M:%S %Z') — republish $TASK ($SLUG) ════════"
  rc=1
  if [ -f "$DONE" ]; then
    echo "⏭  sentinela $DONE já existe — task já republicada antes; NÃO repito."
    rc=0
  elif [ ! -f "$CAPFILE" ]; then
    echo "❌ caption_file não encontrado: $CAPFILE — abortado (Turbo nunca sobe sem legenda)"
  else
    # Retry: a Graph API às vezes dá socket.timeout transitório. publish_carousel
    # só chama media_publish DEPOIS de montar todos os containers, então uma falha
    # ANTES disso não publicou nada — re-tentar é seguro (não duplica).
    for attempt in 1 2 3; do
      echo "── tentativa $attempt/3 ──"
      DRY_RUN=0 python3 scripts/republish.py "$TASK" "$MES" "$SLUG" "$CAPFILE"
      rc=$?
      echo "── tentativa $attempt exit code: $rc ──"
      if [ "$rc" -eq 0 ]; then
        date '+%Y-%m-%d %H:%M:%S %Z' > "$DONE"
        echo "✅ sentinela criada: $DONE"
        break
      fi
      [ "$attempt" -lt 3 ] && { echo "   aguardando 30s antes de re-tentar..."; sleep 30; }
    done
    [ "$rc" -ne 0 ] && echo "🛑 FALHOU após 3 tentativas — post NÃO saiu. Rodar manualmente."
  fi
} >> "$LOG" 2>&1

# Auto-remoção do LaunchAgent: SÓ em caso de sucesso (rc=0). Se falhou, deixa o
# agente carregado pra investigar — melhor um erro visível que um post fantasma.
if [ "$LABEL" != "-" ] && [ "${rc:-1}" -eq 0 ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
  rm -f "$HOME/Library/LaunchAgents/$LABEL.plist" 2>/dev/null
fi

exit 0
