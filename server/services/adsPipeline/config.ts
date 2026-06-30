/**
 * Configuração do pipeline: ClickUp (lista "Anúncios", status `aprovado`)
 *   → Biblioteca de Criativos  → Conjuntos PAUSED no Meta  → aviso por WhatsApp.
 *
 * O upload dos VÍDEOS/criativos continua manual (a conta Meta é dev-tier e a quota
 * não aguenta os uploads pela API). Aqui só preparamos a estrutura: cadastro/leitura
 * na Biblioteca + criação dos conjuntos com a nomenclatura certa, e mandamos o WhatsApp
 * pedindo o upload no Gerenciador.
 *
 * Defaults dos IDs Meta vêm do fluxo real `subir-ana-bastidores.ts` (campanha Creators
 * ABO teste). Tudo é sobrescrevível por env, então dá pra apontar pra outra campanha
 * sem mexer no código.
 */
import "dotenv/config";

/** Estado de runtime mutável — o entrypoint liga/desliga o dry-run via flag `--live`. */
export const runtime = {
  /** dry-run = NÃO escreve em Meta/Biblioteca/ClickUp/WhatsApp. Ligado por padrão (seguro). */
  dryRun: process.env.ADS_PIPELINE_DRY_RUN !== "0",
};

// ---------- ClickUp ----------
export const CLICKUP_TOKEN = process.env.CLICKUP_API_KEY || "";
/** Lista "Anúncios" em GROWTH › GROWTH (descoberta via API). */
export const ANUNCIOS_LIST_ID = process.env.CLICKUP_ANUNCIOS_LIST_ID || "901305784866";
/** Status-gatilho real das subtasks "Subir ad" (minúsculo, com espaço). */
export const TRIGGER_STATUS = process.env.ADS_PIPELINE_TRIGGER_STATUS || "to do";
/** Para onde mover a subtask depois de subir. Default "upado". Vazio = não move (só comenta). */
export const DONE_STATUS = process.env.ADS_PIPELINE_DONE_STATUS || "upado";
/** Marcador de idempotência no comentário — evita reprocessar o mesmo lote. */
export const PROCESSED_MARKER = "[ads-pipeline:preparado]";
/** Marcador para lote criado mas com upload pendente (cota dev-tier). */
export const AWAITING_UPLOAD_MARKER = "[ads-pipeline:aguardando-upload-manual]";

// ---------- Gatilho da automação semanal ----------
// As tasks-gatilho são SUBTASKS "(X) Subir ad" / "Subir anúncio" atribuídas ao Caio.
// Os campos do lote (Funil/Público/Verba/Range TPs/Drive) moram na task MÃE.
/** Assignee que marca a subtask-gatilho (Caio Malini). Sinal estável além do nome. */
export const TRIGGER_ASSIGNEE_ID = process.env.ADS_AUTOMATION_ASSIGNEE_ID || "111964992";
/** Regex do nome da subtask-gatilho (default: contém "subir"). */
export const TRIGGER_NAME_RE = new RegExp(process.env.ADS_AUTOMATION_NAME_RE || "subir", "i");
/** Ler os campos do lote da task MÃE (subtasks "Subir ad" vêm vazias). */
export const USE_PARENT_FIELDS = process.env.ADS_AUTOMATION_USE_PARENT !== "0";
/** Teto de lotes por execução (blast radius). 0 = sem limite. */
export const MAX_LOTES = parseInt(process.env.ADS_AUTOMATION_MAX_LOTES || "0", 10) || 0;
/** Campo labels "Formato" (Meta Ads / YouTube) — p/ pular lotes YouTube. Vazio = não filtra. */
export const FIELD_FORMATO_PLATAFORMA = process.env.ADS_AUTOMATION_FORMATO_PLATAFORMA_FIELD || "";

// ---------- Meta ----------
export const META_ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID || "";
export const META_PAGE_ID = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
export const META_IG_USER_ID = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

// ---------- WhatsApp (Evolution/TurboZap) ----------
/** Destino (E.164, só dígitos, com 55). Ex.: "5527981111621". TODO: confirmar número. */
export const WPP_DEST = process.env.ADS_PIPELINE_WPP_DEST || "";
export const WPP_INSTANCE: "financeiro" | "juridico" =
  (process.env.ADS_PIPELINE_WPP_INSTANCE as "financeiro" | "juridico") || "financeiro";

// ---------- Custom field IDs da lista "Anúncios" ----------
// (descobertos via clickup_get_custom_fields na lista 901305784866)
export const FIELD = {
  funil: "b036cff5-6866-45d5-b1a4-19366e32a532", // labels: Creators, Gestão de Comunidade, ...
  publicoAlvo: "463dbaf9-28dd-443b-bd1c-49519b246d7d", // text
  verba: "7921dc4b-4bd3-45fd-b306-30fcda103f31", // currency BRL ("Verba destinada pro teste")
  rangeTPs: "a20d03dc-93f4-4cc6-b90b-3a84991f0548", // short_text ("Range dos TPs", ex: TP1616-TP1618)
  formato: "2bc24904-6062-43f4-ad39-ff9b275307c2", // dropdown VÍDEO/ESTÁTICO/CARROSSEL
  cta: "4d459470-badf-4456-8081-1d3a8282a62a", // dropdown
  angulo: "2f8ae858-2493-45aa-88d3-21c1de6ae92f", // dropdown
  tipoTask: "32e80635-667b-4c27-95df-80d284e445d0", // dropdown ("Criativo Video", "Criativo Estatico"...)
} as const;

// ---------- Mapa Funil → campanha/conjunto-template Meta ----------
export interface FunilTarget {
  /** Campanha Meta onde os conjuntos são criados. */
  campaignId: string;
  /** Conjunto de referência: a config (targeting/otimização/pixel) é clonada dele. */
  templateAdsetId: string;
  /** Verba/dia padrão (centavos) quando a task não traz o campo "Verba". */
  defaultDailyBudgetCents: number;
}

export const FUNIL_TARGETS: Record<string, FunilTarget> = {
  // Defaults reais do fluxo Creators ABO teste (ref: subir-ana-bastidores.ts).
  Creators: {
    campaignId: process.env.ADS_PIPELINE_CREATORS_CAMP || "120215204345090450",
    templateAdsetId: process.env.ADS_PIPELINE_CREATORS_TEMPLATE_ADSET || "120249587099640450",
    defaultDailyBudgetCents: 2000, // R$20/dia
  },
};

// Estende FUNIL_TARGETS via env (JSON: { "Gestão de Comunidade": { campaignId, templateAdsetId,
// defaultDailyBudgetCents } }) sem mexer no código — evita lote travar por funil não mapeado.
(() => {
  const raw = process.env.ADS_PIPELINE_FUNIL_TARGETS_JSON;
  if (!raw) return;
  try {
    const extra = JSON.parse(raw) as Record<string, FunilTarget>;
    for (const [k, v] of Object.entries(extra)) FUNIL_TARGETS[k] = v;
  } catch (e) {
    console.warn("[ads-pipeline] ADS_PIPELINE_FUNIL_TARGETS_JSON inválido:", (e as Error).message);
  }
})();

/** Resolve a campanha/template a partir do label de Funil do ClickUp. */
export function resolveFunilTarget(funil: string | null | undefined): FunilTarget | null {
  if (!funil) return null;
  // match case-insensitive pelo primeiro token (ex: "Creators")
  const key = Object.keys(FUNIL_TARGETS).find(
    (k) => k.toLowerCase() === funil.trim().toLowerCase(),
  );
  return key ? FUNIL_TARGETS[key] : null;
}
