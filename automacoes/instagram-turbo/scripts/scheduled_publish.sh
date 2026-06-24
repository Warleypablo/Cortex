#!/bin/bash
# Publica UMA task do agente no horário agendado (chamado pelo launchd).
#
# Uso: scheduled_publish.sh <task_id> <caption_file|-> <launchd_label|->
#   task_id        : id da task no ClickUp
#   caption_file   : arquivo com a legenda p/ --caption-override, ou "-" p/ usar
#                    a legenda automática (Doc do card)
#   launchd_label  : label do LaunchAgent p/ auto-remoção após rodar, ou "-"
#
# Idempotência: o próprio agente recusa re-postar uma task já marcada POSTADO,
# então mesmo que dispare 2x não duplica.
set -uo pipefail

# Raiz do projeto resolvida a partir do próprio script (à prova de renome/move).
PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH"
cd "$PROJ" || { echo "cd falhou"; exit 1; }

TASK="${1:?task_id obrigatório}"
CAPFILE="${2:--}"
LABEL="${3:--}"

mkdir -p "$PROJ/logs"
LOG="$PROJ/logs/scheduled_${TASK}.log"

{
  echo "════════ $(date '+%Y-%m-%d %H:%M:%S %Z') — publicando $TASK ════════"
  if [ "$CAPFILE" != "-" ] && [ -f "$CAPFILE" ]; then
    echo "legenda: override de $CAPFILE"
    DRY_RUN=0 python3 -m agente.main --task-id "$TASK" --force-now \
      --caption-override "$(cat "$CAPFILE")"
  else
    echo "legenda: automática (Doc do card)"
    DRY_RUN=0 python3 -m agente.main --task-id "$TASK" --force-now
  fi
  rc=$?
  echo "════════ exit code: $rc ════════"
} >> "$LOG" 2>&1

# Auto-remoção do LaunchAgent (dispara só uma vez)
if [ "$LABEL" != "-" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
  rm -f "$HOME/Library/LaunchAgents/$LABEL.plist" 2>/dev/null
fi

exit 0
