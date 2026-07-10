/**
 * Passo 3/3 — Cria os 4 conjuntos + 18 ads PAREADOS (9x16+4x5) do lote
 * "Cliente Novo x Cliente da Base" (Lucas, CRM) na campanha CBO de teste JÁ EXISTENTE.
 *   Campanha `120252008224000450` (CBO, PAUSED) — NÃO cria campanha, só adiciona conjuntos.
 *   Split: b1(h01-05 / h06-09) + b2(h01-05 / h06-09). Config + COPY clonados do irmão CLONE_ADSET.
 *   Conjuntos SEM budget (CBO manda na campanha). Match de vídeo ESTRITO por nome. Tudo PAUSED.
 *
 *   npx tsx scripts/ads/subir-crm-clientenovo-ads.ts        # DRY (descobre + mostra plano)
 *   npx tsx scripts/ads/subir-crm-clientenovo-ads.ts --go   # cria conjuntos + ads
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, inArray } from "drizzle-orm";
import { metaGet, metaPostForm } from "../../server/services/adsCreation/metaApi";
import {
  findPairedVideosByExactName, createPairedVideoAdsBatched, withBackoff,
  type PairTarget, type PairedAdSpec, type ReusedCopy,
} from "../../server/services/adsCreation/lotUploader";
import { PAIRS, CAMPAIGN, CLONE_ADSET, NN_FLOOR, GROUPS, conjName, type Group } from "./crm-clientenovo.data";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const DEFAULT_PAGE = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const DEFAULT_IG = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";
const go = process.argv.includes("--go");
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };

type Ad = PairedAdSpec & { body: number; hook: number };

(async () => {
  if (!ACC) throw new Error("META_DEFAULT_AD_ACCOUNT_ID não setado");

  // 1) Biblioteca dos 18 criativos (por driveFileId do 9x16)
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    inArray(creativesLibrary.driveFileId, PAIRS.map((p) => p.drive9x16)),
  ));
  const byDrive = new Map(rows.map((r) => [r.driveFileId!, r]));

  // 2) descobre os vídeos pareados no Gerenciador (estrito + early-exit)
  const targets: PairTarget[] = [];
  const pairByTp = new Map<string, { body: number; hook: number; finalName: string }>();
  const preWarns: string[] = [];
  for (const p of PAIRS) {
    const r = byDrive.get(p.drive9x16);
    if (!r) { preWarns.push(`b${p.body}h${p.hook} (${p.base}): sem linha na Biblioteca — rode o planilha`); continue; }
    targets.push({ key: r.tpId, base: r.nomeDrive ?? p.base });
    pairByTp.set(r.tpId, { body: p.body, hook: p.hook, finalName: r.nomeFinal });
  }
  const { pairs, pagesRead, foundAll } = await findPairedVideosByExactName(ACC, targets);
  console.log(`Descoberta: ${pagesRead} página(s) de advideos · achou todos: ${foundAll ? "sim" : "NÃO"}`);

  // 3) monta ads prontos
  const ready: Ad[] = [];
  const warns = [...preWarns];
  for (const t of targets) {
    const p = pairs.get(t.key)!;
    const m = pairByTp.get(t.key)!;
    if (!p?.v9 || !p?.v4) { warns.push(`${t.key} (${t.base}): falta ${!p?.v9 ? "9x16" : "4x5"} no Gerenciador`); continue; }
    if (p.dup9 > 1 || p.dup4 > 1) warns.push(`${t.key}: duplicata 9x16x${p.dup9} 4x5x${p.dup4} (peguei id determinístico)`);
    ready.push({ tpId: t.key, finalName: m.finalName, v9: p.v9, v45: p.v4, body: m.body, hook: m.hook });
  }

  // 4) copy/link/UTM do conjunto de referência (funil CRM)
  const refAds = await withBackoff("GET ref creative", () => metaGet(`${CLONE_ADSET}/ads`, { fields: "creative{asset_feed_spec,url_tags,object_story_spec}", limit: "1" }));
  const refCre = refAds.data?.[0]?.creative ?? {};
  const afs = refCre.asset_feed_spec ?? {}, oss = refCre.object_story_spec ?? {}, vd = oss.video_data ?? {};
  let urlTags: string | undefined = refCre.url_tags;
  if (urlTags) urlTags = urlTags.replace(/hsa_grp=\d+/, "hsa_grp={{adset.id}}").replace(/hsa_ad=\d+/, "hsa_ad={{ad.id}}");
  const copy: ReusedCopy = {
    message: afs.bodies?.[0]?.text || vd.message || "",
    title: afs.titles?.[0]?.text || vd.title,
    link: afs.link_urls?.[0]?.website_url || vd.call_to_action?.value?.link || vd.link_description || "",
    cta: afs.call_to_action_types?.[0] || vd.call_to_action?.type || "LEARN_MORE",
    urlTags, pageId: oss.page_id ?? DEFAULT_PAGE, ig: oss.instagram_actor_id ?? oss.instagram_user_id ?? DEFAULT_IG,
  };

  // 5) agrupa nos 4 conjuntos + resolve NN (idempotente por matchToken)
  const existing = await withBackoff("GET adsets camp", () => metaGet(`${CAMPAIGN}/adsets`, { fields: "id,name", limit: "400" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  let nn = Math.max(NN_FLOOR, ...existingSets.map((s) => nnOf(s.name)));
  const plan: { g: Group; name: string; existingId: string | null; ads: Ad[] }[] = [];
  for (const g of GROUPS) {
    const ads = ready.filter((a) => a.body === g.body && a.hook >= g.hookMin && a.hook <= g.hookMax).sort((x, y) => x.hook - y.hook);
    if (ads.length > 5) warns.push(`${g.key}: ${ads.length} ads (>5) — revisar split`);
    const found = existingSets.find((s) => (s.name ?? "").includes(g.matchToken));
    const name = found?.name ?? conjName(++nn, g);
    plan.push({ g, name, existingId: found?.id ?? null, ads });
  }

  // ---- relatório ----
  console.log(`\nCampanha ${CAMPAIGN} (CBO existente) · ${plan.length} conjuntos · clone do irmão ${CLONE_ADSET}`);
  console.log(`Copy (${copy.message.length} chars): "${copy.message.slice(0, 90).replace(/\n/g, " ")}…" · link ${copy.link} · cta ${copy.cta}`);
  for (const c of plan) {
    console.log(`\n• ${c.existingId ? "↩︎ existe " + c.existingId : "NOVO"} — ${c.name} (${c.ads.length} ads)`);
    for (const a of c.ads) console.log(`    ${a.finalName}  [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  const totalAds = plan.reduce((s, c) => s + c.ads.length, 0);
  console.log(`\nTotal: ${plan.length} conjuntos · ${totalAds} ads pareados · modo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }

  // ---- guardas ----
  if (!copy.message || !copy.link) throw new Error(`copy/link do conjunto de ref (${CLONE_ADSET}) vieram vazios`);
  if (totalAds !== PAIRS.length) throw new Error(`esperava ${PAIRS.length} ads, montei ${totalAds} — rode upload/planilha antes (${warns.join(" | ")})`);

  // config de clone (CBO → sem budget/bid no conjunto)
  const cfg = await withBackoff("GET config ref", () => metaGet(CLONE_ADSET, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting,destination_type" }));

  let totalCreated = 0;
  const allErrors: string[] = [];
  for (const c of plan) {
    let adsetId = c.existingId;
    if (!adsetId) {
      const created = await withBackoff(`create conj ${c.g.key}`, () => metaPostForm(`${ACC}/adsets`, {
        name: c.name, campaign_id: CAMPAIGN,
        optimization_goal: cfg.optimization_goal, billing_event: cfg.billing_event,
        promoted_object: cfg.promoted_object, attribution_spec: cfg.attribution_spec, targeting: cfg.targeting,
        ...(cfg.destination_type && cfg.destination_type !== "UNDEFINED" ? { destination_type: cfg.destination_type } : {}),
        status: "PAUSED",
      }));
      if (!created.id) throw new Error(`conjunto "${c.name}" sem id`);
      adsetId = created.id;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${c.name}`);
    } else {
      console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${c.name}`);
    }

    const adsNow = await withBackoff(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);
    const toCreate = c.ads.filter((a) => !names.some((n) => n.startsWith(`${a.tpId} `) || n === a.finalName));
    const skipped = c.ads.length - toCreate.length;
    if (skipped) console.log(`  ↩︎ ${skipped} ad(s) já existiam — pulados`);
    if (!toCreate.length) continue;

    const { adIds, errors } = await createPairedVideoAdsBatched(ACC, adsetId, toCreate, copy);
    adIds.forEach((id, i) => console.log(`  ✅ ${toCreate[i]?.tpId ?? "?"} → ad ${id} (PAUSED, 9x16+4x5)`));
    errors.forEach((e) => console.log(`  ⛔ ${e}`));
    totalCreated += adIds.length;
    allErrors.push(...errors);
  }

  console.log(`\nResumo: ${totalCreated} ad(s) criado(s) nesse run (tudo PAUSED)${allErrors.length ? ` · ${allErrors.length} erro(s)` : ""}.`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMPAIGN}`);
  process.exit(allErrors.length ? 1 : 0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
