/**
 * Cliente mínimo da ClickUp API v2 para o pipeline de Anúncios.
 * Mesma autenticação usada no resto do repo (server/routes/fca.ts,
 * scripts/sync-tech-clickup.ts): header `Authorization: <CLICKUP_API_KEY>` (token cru).
 */
import "dotenv/config";
import { CLICKUP_TOKEN } from "./config";

const BASE = "https://api.clickup.com/api/v2";

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: CLICKUP_TOKEN };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value?: unknown;
  type_config?: { options?: Array<{ id: string; name?: string; label?: string; orderindex?: number }> };
}

export interface ClickUpAssignee {
  id: number;
  username?: string;
  email?: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: string | { status: string };
  description?: string;
  text_content?: string;
  parent?: string | null;
  url: string;
  custom_fields: ClickUpCustomField[];
  assignees?: ClickUpAssignee[];
}

/** Normaliza o status (a API às vezes devolve objeto, às vezes string). */
export function statusName(t: ClickUpTask): string {
  return typeof t.status === "string" ? t.status : t.status?.status ?? "";
}

/** A task está atribuída a este usuário? (id do ClickUp, ex.: Caio = 111964992). */
export function hasAssignee(t: ClickUpTask, userId: string | number): boolean {
  const target = String(userId);
  return (t.assignees ?? []).some((a) => String(a.id) === target);
}

/** Lista tasks de uma lista filtrando por status (paginado). */
export async function listTasksByStatus(
  listId: string,
  statuses: string[],
  includeClosed = false,
): Promise<ClickUpTask[]> {
  const out: ClickUpTask[] = [];
  for (let page = 0; page < 25; page++) {
    const u = new URL(`${BASE}/list/${listId}/task`);
    u.searchParams.set("page", String(page));
    u.searchParams.set("include_closed", String(includeClosed));
    u.searchParams.set("subtasks", "true");
    for (const s of statuses) u.searchParams.append("statuses[]", s);
    const r = await fetch(u.toString(), { headers: headers() });
    if (!r.ok) throw new Error(`ClickUp list ${listId} ${r.status}: ${await r.text()}`);
    const data = (await r.json()) as { tasks?: ClickUpTask[]; last_page?: boolean };
    const tasks = data.tasks ?? [];
    out.push(...tasks);
    if (data.last_page || tasks.length === 0) break;
  }
  return out;
}

/** Pega uma task com custom fields. */
export async function getTask(taskId: string): Promise<ClickUpTask> {
  const r = await fetch(`${BASE}/task/${taskId}?include_subtasks=true`, { headers: headers() });
  if (!r.ok) throw new Error(`ClickUp get task ${taskId} ${r.status}: ${await r.text()}`);
  return (await r.json()) as ClickUpTask;
}

export async function getComments(taskId: string): Promise<Array<{ comment_text: string }>> {
  const r = await fetch(`${BASE}/task/${taskId}/comment`, { headers: headers() });
  if (!r.ok) throw new Error(`ClickUp comments ${taskId} ${r.status}: ${await r.text()}`);
  const data = (await r.json()) as { comments?: Array<{ comment_text: string }> };
  return data.comments ?? [];
}

export async function addComment(taskId: string, text: string): Promise<void> {
  const r = await fetch(`${BASE}/task/${taskId}/comment`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ comment_text: text, notify_all: false }),
  });
  if (!r.ok) throw new Error(`ClickUp comment ${taskId} ${r.status}: ${await r.text()}`);
}

export async function setStatus(taskId: string, status: string): Promise<void> {
  const r = await fetch(`${BASE}/task/${taskId}`, {
    method: "PUT",
    headers: headers(true),
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error(`ClickUp setStatus ${taskId} ${r.status}: ${await r.text()}`);
}

// ---------- helpers de custom field ----------

function field(task: ClickUpTask, fieldId: string): ClickUpCustomField | undefined {
  return task.custom_fields?.find((f) => f.id === fieldId);
}

/** Valor cru de um campo text/short_text/currency (string) ou null. */
export function cfText(task: ClickUpTask, fieldId: string): string | null {
  const f = field(task, fieldId);
  if (!f || f.value == null || f.value === "") return null;
  return String(f.value);
}

/** Nomes resolvidos de um campo dropdown/labels (value = id(s) da opção). */
export function cfLabels(task: ClickUpTask, fieldId: string): string[] {
  const f = field(task, fieldId);
  if (!f || f.value == null) return [];
  const opts = f.type_config?.options ?? [];
  const values = Array.isArray(f.value) ? f.value : [f.value];
  return values.map((v) => {
    const o = opts.find((o) => o.id === v || o.orderindex === v);
    return o?.name ?? o?.label ?? String(v);
  });
}
