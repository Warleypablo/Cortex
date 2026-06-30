#!/bin/bash
# Publica UM reel no horário agendado (chamado pelo launchd), via
# scripts/publish_reel_once.py (que já tem retry interno no container do vídeo).
# Mesmo esqueleto do scheduled_publish.sh, com sentinela anti-duplicata.
#
# Uso: scheduled_reel.sh <task_id> <folder_id> <caption_file> <launchd_label|->
#
# Roda o publisher UMA vez (sem retry no wrapper): o publisher já re-tenta o
# passo frágil (container) e blinda o _publish, então re-rodar o script inteiro
# poderia duplicar. Auto-remove o LaunchAgent só em caso de sucesso.
set -uo pipefail

PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH"
cd "$PROJ" || { echo "cd falhou"; exit 1; }

TASK="${1:?task_id obrigatório}"
FOLDER="${2:?folder_id obrigatório}"
CAPFILE="${3:?caption_file obrigatório}"
LABEL="${4:--}"

mkdir -p "$PROJ/logs" "$PROJ/.cache"
LOG="$PROJ/logs/scheduled_reel_${TASK}.log"
DONE="$PROJ/.cache/reel_${TASK}.done"

rc=1
{
  echo "════════ $(date '+%Y-%m-%d %H:%M:%S %Z') — reel $TASK ════════"
  if [ -f "$DONE" ]; then
    echo "⏭  sentinela $DONE já existe — reel já publicado antes; NÃO repito."
    rc=0
  elif [ ! -f "$CAPFILE" ]; then
    echo "❌ caption_file não encontrado: $CAPFILE — abortado (nunca sobe sem legenda)"
  else
    DRY_RUN=0 python3 scripts/publish_reel_once.py "$TASK" "$FOLDER" "$CAPFILE"
    rc=$?
    echo "════════ exit code: $rc ════════"
    if [ "$rc" -eq 0 ]; then
      date '+%Y-%m-%d %H:%M:%S %Z' > "$DONE"
      echo "✅ sentinela criada: $DONE"
    else
      echo "🛑 publisher falhou (rc=$rc) — reel pode NÃO ter saído. Conferir log/feed."
    fi
  fi
} >> "$LOG" 2>&1

# Auto-remoção do LaunchAgent: só em sucesso. Se falhou, deixo carregado p/ investigar.
if [ "$LABEL" != "-" ] && [ "${rc:-1}" -eq 0 ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
  rm -f "$HOME/Library/LaunchAgents/$LABEL.plist" 2>/dev/null
fi

exit 0
