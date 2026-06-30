/**
 * Opção A: clona o conjunto do Bali (SHALLOW copy = só a config, SEM anúncio) N vezes na campanha
 * Distribuição de Conteúdo, renomeando cada cópia por conteúdo (NN sequencial). Tudo PAUSED.
 * O anúncio (selecionar o post do IG) o Caio cria na UI — o token não tem permissão de página/IG,
 * e o deep copy quebra na referência ao post orgânico do Instagram.
 *
 *   npx tsx subir-distribuicao-conjuntos.ts        # DRY: mostra os nomes/números
 *   npx tsx subir-distribuicao-conjuntos.ts --go   # clona de verdade
 */
import "dotenv/config";
import { metaGet, metaPostForm } from "../../server/services/adsCreation/metaApi";

const BALI_ADSET = "120243474649070450"; // 58 - [IG] [Aberto] Bali
const CAMP = "120211269781870450"; // [TP] [Tráfego] [ABO] [Distribuição] - Distribuição de Conteúdo

// nome curto do conjunto ↔ task do ClickUp (subtask "Impulsionar conteúdo")
// Lote 30/06/2026 — conteúdo vem da task-mãe (parent) de cada subtask.
const CONTENTS = [
  { content: "Afiliado Tiktok", task: "86aj9phn8" },
  { content: "Como criar um perfil no tiktok do zero", task: "86ahuegar" },
  { content: "Roas alto? Travou nos 50k?", task: "86ahubfpu" },
  { content: "O maior evento sobre criação de conteúdo do ES", task: "86ahbye4j" },
];

const go = process.argv.includes("--go");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // próximo NN da campanha (nomes são "NN - [IG] [Aberto] ...")
  const sets = await metaGet(`${CAMP}/adsets`, { fields: "name", limit: "400" });
  const existingNames = (sets.data ?? []).map((s) => (s.name ?? "").toLowerCase());
  let max = 0;
  for (const n of existingNames) {
    const m = /^\s*(\d{1,3})\s*-/.exec(n);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  // idempotência: pula conteúdo cujo nome já existe (retry-safe, sem duplicar)
  let nn = max;
  const plan: { content: string; task: string; nn: number; name: string }[] = [];
  for (const c of CONTENTS) {
    if (existingNames.some((n) => n.includes(c.content.toLowerCase()))) {
      console.log(`  ⏭  já existe (pulando): ${c.content}`);
      continue;
    }
    nn += 1;
    plan.push({ ...c, nn, name: `${nn} - [IG] [Aberto] ${c.content}` });
  }

  console.log(`\nMaior NN atual: ${max}. Conjuntos a criar (clone do Bali, SÓ config, PAUSED):\n`);
  for (const p of plan) console.log(`  • ${p.name}   (task ${p.task})`);
  console.log(`\nmodo: ${go ? "🔴 CLONAR" : "DRY (não cria nada)"}`);
  if (!plan.length) {
    console.log("Nada a criar — todos já existem.");
    process.exit(0);
  }
  if (!go) {
    console.log(`(DRY) Rode com --go pra clonar os ${plan.length} conjuntos.`);
    process.exit(0);
  }

  const out: { nn: number; name: string; id: string; task: string }[] = [];
  for (const p of plan) {
    const cp = await metaPostForm(`${BALI_ADSET}/copies`, { deep_copy: false, status_option: "PAUSED" });
    const newId = cp.copied_adset_id || cp.copied_ad_set_id || cp.id;
    if (!newId) throw new Error("copy sem id: " + JSON.stringify(cp));
    await metaPostForm(String(newId), { name: p.name });
    out.push({ nn: p.nn, name: p.name, id: String(newId), task: p.task });
    console.log(`  ✅ ${p.name} → conjunto ${newId} (PAUSED)`);
    await sleep(1500);
  }

  console.log(`\n===== RESULTADO =====`);
  for (const o of out) console.log(`${o.nn} | ${o.id} | ${o.name}`);
  const acc = (process.env.META_DEFAULT_AD_ACCOUNT_ID || "").replace("act_", "");
  console.log(`\nGerenciador: https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acc}&selected_campaign_ids=${CAMP}`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
