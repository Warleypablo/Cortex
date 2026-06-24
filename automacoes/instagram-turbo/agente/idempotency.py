"""
Idempotência + lockfile.

Sem banco de dados. A verdade sobre "já postei essa task?" vive nos
comentários da task no ClickUp, via marcador textual.

Convenções de marcadores (procurados em comment.text, case-insensitive):

  [agente:postado v1]           → task já publicada com sucesso
  [agente:pendente-aprovacao]   → legenda gerada por Claude aguardando OK
  [agente:erro]                 → houve erro na última tentativa (não bloqueia
                                  reprocesso, só serve de histórico)
  [agente:skip]                 → humano marcou pra não processar

O lockfile `.cache/.lock` evita runs concorrentes (PID + timestamp).
Se o lock for de um PID que não existe mais (crash), é sobrescrito.
"""
from __future__ import annotations
import os
import re
import signal
import time
from dataclasses import dataclass
from pathlib import Path

from agente.config import PROJECT_ROOT


CACHE_DIR = PROJECT_ROOT / ".cache"
LOCK_PATH = CACHE_DIR / ".lock"

# --- marcadores ---
MARKER_POSTED = "[agente:postado v1]"
MARKER_PENDING = "[agente:pendente-aprovacao]"
MARKER_ERROR = "[agente:erro]"
MARKER_SKIP = "[agente:skip]"

_MARKER_RE = re.compile(r"\[agente:([a-z0-9\-]+(?:\s+v\d+)?)\]", re.IGNORECASE)


@dataclass
class TaskStatus:
    posted: bool
    pending_approval: bool
    skipped: bool
    last_error: bool


def inspect_comments(comments: list) -> TaskStatus:
    """
    Recebe list[Comment] (agente.clickup.Comment) e retorna status.
    """
    posted = pending = skipped = err = False
    for c in comments:
        txt = (c.text or "").lower()
        if MARKER_POSTED.lower() in txt:
            posted = True
        if MARKER_PENDING.lower() in txt:
            pending = True
        if MARKER_SKIP.lower() in txt:
            skipped = True
        if MARKER_ERROR.lower() in txt:
            err = True
    return TaskStatus(posted=posted, pending_approval=pending, skipped=skipped, last_error=err)


def should_process(status: TaskStatus) -> tuple[bool, str]:
    """
    Decide se deve processar a task. Retorna (processar?, motivo).
    """
    if status.skipped:
        return False, "marcado [agente:skip]"
    if status.posted:
        return False, "já postado ([agente:postado v1])"
    if status.pending_approval:
        return False, "aguardando aprovação humana ([agente:pendente-aprovacao])"
    return True, "ok"


# --- lockfile ---

def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        # existe mas é de outro usuário — trata como vivo
        return True


class LockHeld(RuntimeError):
    pass


class Lock:
    """
    Context manager. Cria .cache/.lock com PID+timestamp.
    Se já existir e o PID estiver vivo → LockHeld.
    Se PID estiver morto (crash) → rouba o lock.
    """

    def __init__(self, path: Path = LOCK_PATH):
        self.path = path
        self.acquired = False

    def __enter__(self) -> "Lock":
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            try:
                raw = self.path.read_text(encoding="utf-8").strip()
                parts = raw.split("|", 1)
                other_pid = int(parts[0])
            except (ValueError, OSError):
                other_pid = -1
            if other_pid > 0 and _pid_alive(other_pid):
                raise LockHeld(
                    f"lockfile ativo ({self.path}) — PID {other_pid} ainda está rodando"
                )
            # stale — sobrescreve
        self.path.write_text(f"{os.getpid()}|{int(time.time())}", encoding="utf-8")
        self.acquired = True
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self.acquired:
            try:
                self.path.unlink()
            except FileNotFoundError:
                pass
