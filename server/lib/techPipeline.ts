import { getProjetoIdsDoTrimestre } from "./techDash";

// ─────────────────────────────────────────────────────────────────────────────
// Painel "Tempo por Status" dos Projetos Tech.
//
// Metodologia (engenharia reversa do painel do time de Tech, validada contra o
// Q1/2026 — os 17 números batem ao decimal):
//   • universo = projetos ENTREGUES no trimestre (ids vêm do tech-dash);
//   • para cada projeto, o tempo em cada um dos 7 status do pipeline vem do
//     endpoint `time_in_status` do ClickUp (wall-clock, em dias corridos);
//   • a média de um status divide pela quantidade TOTAL de projetos do trimestre,
//     não pelos que passaram por ele — um projeto que pulou o status conta 0 dia.
//     (Foi isso que fez a média bater: 26,8d "por visita" vs 21,3d "por projeto".)
//   • tempo total do projeto = soma dos 7 status; média e mediana sobre esse total;
//   • "entregue no prazo" = tempoTotal convertido em dias ÚTEIS (×5/7) ≤ prazo do
//     tipo (config.deadlinesBusinessDays do tech-dash).
//
// ⚠️ NÃO usamos "Clickup".cup_projetos_tech* aqui: a tabela está defasada (só 9 dos
// 44 projetos do Q2 têm `tipo`). O `Tipo` vem do custom field da própria task.
// ⚠️ Também não dá para usar "Clickup".cup_status_history: a sync morreu em 13/03/2026.
// ─────────────────────────────────────────────────────────────────────────────

const CLICKUP_API = "https://api.clickup.com/api/v2";
const LISTA_PROJETOS_TECH = "217091334"; // lista "Projetos Tech" no ClickUp
const CONFIG_URL = "https://tech-dash.pages.dev/data/config.json";

// ⚠️ A API do ClickUp é LENTA: listar as 585 tasks (6 páginas) leva ~18s e buscar as
// 44 tasks do tri uma a uma leva ~7s. Bloquear o endpoint do deck nisso é inviável.
// Por isso o painel é servido em stale-while-revalidate: a requisição NUNCA espera —
// devolve o cache (mesmo velho) e dispara o refresh em background. `warmTechPipeline`
// aquece o cache no boot, então na prática o primeiro acesso já encontra dado fresco.
const TTL_PAINEL = 60 * 60 * 1000;      // o painel só muda quando um projeto é entregue
const TTL_TIPOS = 6 * 60 * 60 * 1000;   // o tipo de um projeto praticamente não muda
const TIMEOUT_MS = 20_000;              // a listagem do ClickUp é pesada (6 páginas)
const ESPERA_MAX_MS = 4_000;            // teto que o endpoint aceita esperar por um tri frio

/** Meta do time para entregas no prazo. Vem do painel de origem, não do banco. */
const META_NO_PRAZO_PCT = 90;

export interface TechPipelineStatus {
  status: string;   // "design review"
  label: string;    // "Design Review"
  color: string;    // "#008844"
  dias: number;     // média sobre TODOS os projetos do tri
}

export interface TechPipelineTipo {
  tipo: string;
  projetos: number;
  dias: number;                    // média do tempo total
  prazoDiasUteis: number | null;   // null quando o tipo não tem prazo definido
  dentroDoPrazo: boolean | null;
}

export interface TechPipelineData {
  disponivel: boolean;
  fonte: string;
  projetos: number;
  tipos: number;
  tempoMedioDias: number;
  tempoMedianoDias: number;
  statusMaisLento: string;         // label
  porStatus: TechPipelineStatus[];
  porTipo: TechPipelineTipo[];
  noPrazo: { projetos: number; total: number; pct: number; meta: number };
}

const INDISPONIVEL: TechPipelineData = {
  disponivel: false, fonte: "ClickUp + tech-dash", projetos: 0, tipos: 0,
  tempoMedioDias: 0, tempoMedianoDias: 0, statusMaisLento: "",
  porStatus: [], porTipo: [], noPrazo: { projetos: 0, total: 0, pct: 0, meta: META_NO_PRAZO_PCT },
};

// ─── Fetch helpers ───

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: ctrl.signal, headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const j = await resp.json();
    if (j?.err) throw new Error(`ClickUp: ${j.err}`);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

interface TechDashConfig {
  pipelineStatuses: string[];
  pipelineLabels: Record<string, string>;
  statusColors: Record<string, string>;
  deadlinesBusinessDays: Record<string, number>;
}

let configCache: { data: TechDashConfig; at: number } | null = null;
async function fetchConfig(): Promise<TechDashConfig> {
  if (configCache && Date.now() - configCache.at < TTL_TIPOS) return configCache.data;
  const data = (await fetchJson(CONFIG_URL)) as TechDashConfig;
  if (!data?.pipelineStatuses?.length) throw new Error("config.json inesperado");
  configCache = { data, at: Date.now() };
  return data;
}

/** id da task → tipo do projeto (custom field "Tipo", um drop_down). */
let tiposCache: { data: Record<string, string>; at: number } | null = null;
async function fetchTipos(apiKey: string): Promise<Record<string, string>> {
  if (tiposCache && Date.now() - tiposCache.at < TTL_TIPOS) return tiposCache.data;
  const out: Record<string, string> = {};
  for (let page = 0; page < 12; page++) {
    const j = await fetchJson(
      `${CLICKUP_API}/list/${LISTA_PROJETOS_TECH}/task?include_closed=true&subtasks=false&page=${page}`,
      { Authorization: apiKey },
    );
    const tasks: any[] = j.tasks ?? [];
    if (tasks.length === 0) break;
    for (const t of tasks) {
      const f = (t.custom_fields ?? []).find((x: any) => x.name === "Tipo");
      if (!f || f.value == null) continue;
      const opts: any[] = f.type_config?.options ?? [];
      const nome = opts.find((o) => o.orderindex === f.value)?.name ?? opts[f.value]?.name;
      if (nome) out[t.id] = nome;
    }
    if (j.last_page) break;
  }
  tiposCache = { data: out, at: Date.now() };
  return out;
}

/** ClickUp aceita até 100 task_ids por chamada de bulk_time_in_status. */
async function fetchTimeInStatus(apiKey: string, ids: string[]): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const qs = lote.map((id) => `task_ids%5B%5D=${encodeURIComponent(id)}`).join("&");
    const j = await fetchJson(`${CLICKUP_API}/task/bulk_time_in_status/task_ids?${qs}`, { Authorization: apiKey });
    Object.assign(out, j);
  }
  return out;
}

// ─── Cálculo ───

const DIAS_POR_MINUTO = 1 / 60 / 24;

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = ord.length / 2;
  return ord.length % 2 ? ord[Math.floor(meio)] : (ord[meio - 1] + ord[meio]) / 2;
}

const painelCache: Record<string, { data: TechPipelineData; at: number }> = {};
const emVoo = new Map<string, Promise<TechPipelineData>>();

/**
 * Serve o painel SEM bloquear: devolve o cache (mesmo vencido) e dispara o refresh em
 * background. Só retorna INDISPONIVEL quando nunca houve dado para o trimestre.
 */
export async function getTechPipeline(ano: number, quarter: number): Promise<TechPipelineData> {
  const chave = `${ano}-Q${quarter}`;
  const hit = painelCache[chave];
  if (hit && Date.now() - hit.at < TTL_PAINEL) return hit.data;

  const refresh = agendarRefresh(chave, ano, quarter);
  if (hit) return hit.data; // stale enquanto revalida

  // Sem cache (trimestre não aquecido): espera só um pouco. Se o ClickUp não responder
  // a tempo, a slide mostra o aviso e o refresh segue em background — o próximo acesso
  // já encontra o dado. Assim o deck nunca fica pendurado 20s numa API externa.
  return Promise.race([
    refresh.catch(() => INDISPONIVEL),
    new Promise<TechPipelineData>((r) => setTimeout(() => r(INDISPONIVEL), ESPERA_MAX_MS)),
  ]);
}

/** Aquece o cache no boot, para o primeiro acesso ao deck já achar dado fresco. */
export function warmTechPipeline(ano: number, quarter: number): void {
  const chave = `${ano}-Q${quarter}`;
  agendarRefresh(chave, ano, quarter).catch(() => {});
}

function agendarRefresh(chave: string, ano: number, quarter: number): Promise<TechPipelineData> {
  const jaRodando = emVoo.get(chave);
  if (jaRodando) return jaRodando;
  const p = calcular(ano, quarter)
    .then((data) => {
      if (data.disponivel) painelCache[chave] = { data, at: Date.now() };
      return data;
    })
    .finally(() => emVoo.delete(chave));
  emVoo.set(chave, p);
  return p;
}

async function calcular(ano: number, quarter: number): Promise<TechPipelineData> {
  const chave = `${ano}-Q${quarter}`;
  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    console.warn("[techPipeline] CLICKUP_API_KEY ausente — painel de pipeline indisponível");
    return INDISPONIVEL;
  }

  try {
    const ids = await getProjetoIdsDoTrimestre(ano, quarter);
    if (ids.length === 0) return INDISPONIVEL;

    const [config, tipos, tempos] = await Promise.all([
      fetchConfig(),
      fetchTipos(apiKey),
      fetchTimeInStatus(apiKey, ids),
    ]);

    const PIPE = config.pipelineStatuses.map((s) => s.trim().toLowerCase());
    const N = Object.keys(tempos).length;
    if (N === 0) return INDISPONIVEL;

    const somaPorStatus: Record<string, number> = {};
    const totais: number[] = [];
    const porTipoMap = new Map<string, number[]>();

    for (const [id, t] of Object.entries(tempos)) {
      const historico = [...((t as any).status_history ?? []), ...((t as any).current_status ? [(t as any).current_status] : [])];
      let total = 0;
      for (const h of historico) {
        const st = (h.status ?? "").trim().toLowerCase();
        if (!PIPE.includes(st)) continue;
        const dias = (h.total_time?.by_minute ?? 0) * DIAS_POR_MINUTO;
        somaPorStatus[st] = (somaPorStatus[st] ?? 0) + dias;
        total += dias;
      }
      totais.push(total);
      const tipo = tipos[id] ?? "Sem tipo";
      if (!porTipoMap.has(tipo)) porTipoMap.set(tipo, []);
      porTipoMap.get(tipo)!.push(total);
    }

    const porStatus: TechPipelineStatus[] = PIPE.map((st) => ({
      status: st,
      label: config.pipelineLabels[st] ?? st,
      color: config.statusColors[st] ?? "#71717a",
      dias: (somaPorStatus[st] ?? 0) / N,
    }));

    const maisLento = porStatus.reduce((a, b) => (a.dias >= b.dias ? a : b), porStatus[0]);

    const porTipo: TechPipelineTipo[] = Array.from(porTipoMap.entries())
      .map(([tipo, arr]) => {
        const dias = arr.reduce((a, b) => a + b, 0) / arr.length;
        const prazo = config.deadlinesBusinessDays[tipo] ?? null;
        return {
          tipo,
          projetos: arr.length,
          dias,
          prazoDiasUteis: prazo,
          dentroDoPrazo: prazo == null ? null : dias * 5 / 7 <= prazo,
        };
      })
      .sort((a, b) => b.dias - a.dias);

    // "No prazo" só considera projetos de tipos COM prazo definido — igual ao painel,
    // que rotula o card com "N projetos com prazo".
    const comPrazo = Array.from(porTipoMap.entries())
      .filter(([tipo]) => config.deadlinesBusinessDays[tipo] != null)
      .flatMap(([tipo, arr]) => arr.map((total) => ({ total, prazo: config.deadlinesBusinessDays[tipo] })));
    const noPrazoN = comPrazo.filter((p) => p.total * 5 / 7 <= p.prazo).length;

    const data: TechPipelineData = {
      disponivel: true,
      fonte: "ClickUp + tech-dash",
      projetos: N,
      tipos: porTipoMap.size,
      tempoMedioDias: totais.reduce((a, b) => a + b, 0) / N,
      tempoMedianoDias: mediana(totais),
      statusMaisLento: maisLento?.label ?? "",
      porStatus,
      porTipo,
      noPrazo: {
        projetos: noPrazoN,
        total: comPrazo.length,
        pct: comPrazo.length > 0 ? (noPrazoN / comPrazo.length) * 100 : 0,
        meta: META_NO_PRAZO_PCT,
      },
    };

    return data;
  } catch (err: any) {
    // O deck não pode quebrar por causa de uma API externa: a slide mostra um aviso.
    console.warn(`[techPipeline] ${chave} indisponível: ${err?.message ?? err}`);
    return INDISPONIVEL;
  }
}
