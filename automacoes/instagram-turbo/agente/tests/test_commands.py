"""Consumidor de comandos do painel (agente/commands.py), com fakes nos limites.

Sem rede, sem credenciais, sem publicar de verdade: troca panel_client, state_sink
e o caminho de publicação por dublês e checa o controle de fluxo (ack/report).
"""
from agente import commands
from agente import main as core


class FakePlan:
    def __init__(self, ready=True, error=None, skip_reason=None, tipo="reels"):
        self.error = error
        self.skip_reason = skip_reason
        self.tipo_post = tipo
        self.task_id = "t1"
        self.task_name = "Post X"
        self.mes = "JUNHO"
        self.turbo_slug = "TURBO_x"
        self.posting_date = None
        self.slot_now = None
        self.asset_count = 1
        self.legenda_source = "doc"
        self.legenda_len = 50
        self.legenda_empty = False
        self._ready = ready

    @property
    def is_ready_to_publish(self):
        return self._ready


class FakeExec:
    def __init__(self, media="IG123", link="http://x", error=None):
        self.ig_media_id = media
        self.permalink = link
        self.error = error


class Rec:
    def __init__(self):
        self.acks = []
        self.reports = []
        self.pending = []
        self.due = []
        self.exec_calls = 0

    def pull_pending(self, platform):
        return list(self.pending)

    def get_due(self, platform):
        return list(self.due)

    def ack(self, cid, status, result=None, error=None):
        self.acks.append((cid, status, result, error))
        return True


def _wire(rec, plan, exec_result=None):
    commands.panel_client.pull_pending = rec.pull_pending
    commands.panel_client.get_due = rec.get_due
    commands.panel_client.ack = rec.ack
    commands.state_sink.report_posts = lambda platform, posts: rec.reports.append((platform, posts))
    commands._plan = lambda tid: plan

    def fake_exec(*a, **k):
        rec.exec_calls += 1
        return exec_result or FakeExec()
    core.execute_plan = fake_exec


def _statuses(rec, cid):
    return [a[1] for a in rec.acks if a[0] == cid]


def test_publish_now_dry_run_nao_publica():
    rec = Rec(); _wire(rec, FakePlan(ready=True))
    rec.pending = [{"id": 1, "action": "publish_now", "clickupTaskId": "t1", "payload": {}}]
    commands.consume("instagram", run_id="r", dry_run=True)
    assert rec.exec_calls == 0, "dry-run NÃO pode chamar execute_plan"
    assert _statuses(rec, 1) == ["running", "done"], _statuses(rec, 1)


def test_publish_now_real_publica_e_reporta():
    rec = Rec(); _wire(rec, FakePlan(ready=True), FakeExec(media="IG999", link="http://post"))
    rec.pending = [{"id": 2, "action": "publish_now", "clickupTaskId": "t1", "payload": {}}]
    commands.consume("instagram", run_id="r", dry_run=False)
    assert rec.exec_calls == 1, "modo real deve publicar"
    assert _statuses(rec, 2) == ["running", "done"]
    done = [a for a in rec.acks if a[0] == 2 and a[1] == "done"][0]
    assert done[2]["media_id"] == "IG999"
    assert rec.reports and rec.reports[-1][1][0]["state"] == "publicado"


def test_publish_now_nao_pronto_falha():
    rec = Rec(); _wire(rec, FakePlan(ready=False, skip_reason="sem assets"))
    rec.pending = [{"id": 3, "action": "publish_now", "clickupTaskId": "t1", "payload": {}}]
    commands.consume("instagram", run_id="r", dry_run=False)
    assert rec.exec_calls == 0
    assert _statuses(rec, 3) == ["running", "failed"]


def test_schedule_grava_scheduled_at_e_da_done():
    rec = Rec(); _wire(rec, FakePlan(ready=True))
    rec.pending = [{"id": 4, "action": "schedule", "clickupTaskId": "t1",
                    "payload": {"scheduled_at": "2099-01-01T12:00:00Z"}}]
    commands.consume("instagram", run_id="r", dry_run=True)
    plat, posts = rec.reports[-1]
    assert posts[0]["scheduled_at"] == "2099-01-01T12:00:00Z"
    assert posts[0]["state"] == "agendado"
    assert _statuses(rec, 4) == ["done"]


def test_cancel_limpa_scheduled_at():
    rec = Rec(); _wire(rec, FakePlan(ready=True))
    rec.pending = [{"id": 5, "action": "cancel_schedule", "clickupTaskId": "t1", "payload": {}}]
    commands.consume("instagram", run_id="r", dry_run=True)
    posts = rec.reports[-1][1]
    assert posts[0]["scheduled_at"] is None, "cancel manda scheduled_at=None (limpa no ingest)"
    assert posts[0]["state"] == "aprovado"
    assert _statuses(rec, 5) == ["done"]


def test_acao_desconhecida_nao_quebra():
    rec = Rec(); _wire(rec, FakePlan(ready=True))
    rec.pending = [{"id": 6, "action": "approve_caption", "clickupTaskId": "t1", "payload": {}}]
    commands.consume("instagram", run_id="r", dry_run=True)
    assert _statuses(rec, 6) == ["done"]  # reconhece e segue


def test_publish_due_dry_run_nao_publica():
    rec = Rec(); _wire(rec, FakePlan(ready=True))
    rec.due = [{"clickupTaskId": "t1", "platform": "instagram"}]
    n = commands.publish_due("instagram", run_id="r", dry_run=True)
    assert rec.exec_calls == 0 and n == 0


def test_publish_due_real_publica():
    rec = Rec(); _wire(rec, FakePlan(ready=True))
    rec.due = [{"clickupTaskId": "t1", "platform": "instagram"}]
    n = commands.publish_due("instagram", run_id="r", dry_run=False)
    assert rec.exec_calls == 1 and n == 1
