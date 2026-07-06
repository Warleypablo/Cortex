/**
 * Sobe os ads do lote "Esther - UGCs x Anuncios" (TP1751-1770) na campanha CBO QUENTE de
 * Creators ([TP] [Leads] [CBO] [QUENTE] [Creators] - Campanha de conversão), padrão Turbo:
 * 4 conjuntos (b1 h01-05, b1 h06-10, b2 h01-05, b2 h06-10), 5 ads pareados 9x16+4x5 cada.
 *
 * - Resolve a campanha PELO NOME (evita ID errado — existe também a "Campanha de teste")
 * - Clona config + copy/link/UTM do conjunto irmão de maior NN com ads na MESMA campanha
 * - Posições do criativo derivadas do targeting clonado (IG-only vs FB+IG)
 * - Criação PAUSED e idempotente; ativação é passo separado e explícito (--activate)
 *
 *   npx tsx scripts/ads/subir-esther-ugcs-ads.ts             # DRY (descobre + mostra plano)
 *   npx tsx scripts/ads/subir-esther-ugcs-ads.ts --go        # cria (PAUSED)
 *   npx tsx scripts/ads/subir-esther-ugcs-ads.ts --activate  # ativa conjuntos + ads do lote
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, gte, lte, sql } from "drizzle-orm";
import { metaGet, metaPostForm } from "../../server/services/adsCreation/metaApi";
import { findPairedVideosByExactName, withBackoff, type PairTarget } from "../../server/services/adsCreation/lotUploader";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP_NAME = "[TP] [Leads] [CBO] [QUENTE] [Creators] - Campanha de conversão";
const CAMP_NAME_FALLBACK = "[CBO] [QUENTE] [Creators]"; // substring, caso o nome exato mude
const TEMA = "UGCs x Anuncios";
const PERSONA = "Esther";
const TP_START = 1751;
const TP_END = 1770;
const DEFAULT_PAGE = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const DEFAULT_IG = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

const ADVANTAGE_PLUS_OPT_OUT = {
  creative_features_spec: {
    image_touchups: { enroll_status: "OPT_OUT" },
    image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
    image_uncrop: { enroll_status: "OPT_OUT" },
    text_optimizations: { enroll_status: "OPT_OUT" },
    inline_comment: { enroll_status: "OPT_OUT" },
    audio: { enroll_status: "OPT_OUT" },
    image_animation: { enroll_status: "OPT_OUT" },
  },
};

const go = process.argv.includes("--go");
const activate = process.argv.includes("--activate");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad2 = (n: number) => String(n).padStart(2, "0");
const norm = (s: string) => (s ?? "").trim().toLowerCase();
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };
const bhOf = (base: string) => { const m = /^b(\d+)h(\d+)/i.exec(base); return m ? { b: +m[1], h: +m[2] } : { b: 0, h: 0 }; };

// Meta exige `explore` junto de `explore_home`. Garante o par no targeting clonado.
function fixTargeting(t: any) {
  if (!t) return t;
  const ig: string[] | undefined = Array.isArray(t.instagram_positions) ? [...t.instagram_positions] : undefined;
  if (ig && ig.includes("explore_home") && !ig.includes("explore")) ig.push("explore");
  return { ...t, ...(ig ? { instagram_positions: ig } : {}) };
}

interface Reused { message: string; title?: string; link: string; cta: string; urlTags?: string; pageId: string; ig: string }

// Regras de posicionamento seguem as plataformas do conjunto clonado (IG-only ou FB+IG).
function customizationRules(igOnly: boolean) {
  if (igOnly) return [
    { customization_spec: { publisher_platforms: ["instagram"], instagram_positions: ["story", "reels"] }, label: "9" },
    { customization_spec: { publisher_platforms: ["instagram"], instagram_positions: ["stream", "profile_feed", "explore", "explore_home", "ig_search"] }, label: "4" },
  ];
  return [
    { customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"] }, label: "9" },
    { customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["feed"], instagram_positions: ["stream", "profile_feed"] }, label: "4" },
  ];
}

function pairedCreativeParams(tpId: string, nomeFinal: string, v9: string, v45: string, r: Reused, igOnly: boolean) {
  const LBL_9 = `lbl_9x16_${tpId}`;
  const LBL_4 = `lbl_4x5_${tpId}`;
  const rules = customizationRules(igOnly).map((rule) => ({
    customization_spec: rule.customization_spec,
    video_label: { name: rule.label === "9" ? LBL_9 : LBL_4 },
  }));
  return {
    name: `Criativo: ${nomeFinal}`,
    object_story_spec: { page_id: r.pageId, instagram_user_id: r.ig },
    asset_feed_spec: {
      bodies: [{ text: r.message }],
      ...(r.title ? { titles: [{ text: r.title }] } : {}),
      link_urls: [{ website_url: r.link }],
      call_to_action_types: [r.cta],
      ad_formats: ["SINGLE_VIDEO"],
      videos: [
        { video_id: v9, adlabels: [{ name: LBL_9 }] },
        { video_id: v45, adlabels: [{ name: LBL_4 }] },
      ],
      asset_customization_rules: rules,
    },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    contextual_multi_ads: { enroll_status: "OPT_OUT" },
    ...(r.urlTags ? { url_tags: r.urlTags } : {}),
  };
}

async function resolveCampaign(): Promise<{ id: string; name: string; status: string }> {
  const res = await withBackoff("GET campaigns", () =>
    metaGet(`${ACC}/campaigns`, { fields: "id,name,status,effective_status", limit: "200" }),
  );
  const camps: { id: string; name: string; status: string }[] = res.data ?? [];
  const exact = camps.filter((c) => norm(c.name) === norm(CAMP_NAME));
  if (exact.length === 1) return exact[0];
  const fuzzy = camps.filter((c) => norm(c.name).includes(norm(CAMP_NAME_FALLBACK)));
  if (fuzzy.length === 1) return fuzzy[0];
  const list = (exact.length ? exact : fuzzy).map((c) => `  ${c.id} — ${c.name}`).join("\n");
  throw new Error(`Campanha não resolvida (exatas=${exact.length}, fuzzy=${fuzzy.length}):\n${list || "  (nenhuma candidata)"}`);
}

(async () => {
  if (!ACC) throw new Error("META_DEFAULT_AD_ACCOUNT_ID não setado");

  // 0) campanha pelo nome
  const camp = await resolveCampaign();
  console.log(`Campanha: ${camp.id} — ${camp.name} (${camp.status})`);

  // 1) conjuntos existentes na campanha (NN corrido + idempotência + ativação)
  const existing = await withBackoff("GET adsets camp", () =>
    metaGet(`${camp.id}/adsets`, { fields: "id,name,status,effective_status", limit: "400" }),
  );
  const existingSets: { id: string; name: string; status: string }[] = existing.data ?? [];
  const loteSufixo = `[${PERSONA}] - ${TEMA}`;
  const loteSets = existingSets.filter((s) => (s.name ?? "").includes(loteSufixo));

  // ---------- MODO ATIVAÇÃO ----------
  if (activate) {
    if (!loteSets.length) throw new Error(`Nenhum conjunto "${loteSufixo}" na campanha — rode com --go antes.`);
    console.log(`\nAtivando lote "${loteSufixo}": ${loteSets.length} conjunto(s)...`);
    let adsOn = 0, setsOn = 0;
    for (const s of loteSets) {
      const adsRes = await withBackoff(`GET ads ${s.id}`, () => metaGet(`${s.id}/ads`, { fields: "id,name,status", limit: "200" }));
      const ads: { id: string; name: string; status: string }[] = adsRes.data ?? [];
      for (const a of ads) {
        if (a.status === "ACTIVE") { console.log(`  ↻ ad já ativo: ${a.name}`); continue; }
        await withBackoff(`activate ad ${a.id}`, () => metaPostForm(a.id, { status: "ACTIVE" }));
        console.log(`  ✅ ad ATIVO: ${a.name}`);
        adsOn++;
        await sleep(2000);
      }
      if (s.status !== "ACTIVE") {
        await withBackoff(`activate adset ${s.id}`, () => metaPostForm(s.id, { status: "ACTIVE" }));
        console.log(`✅ conjunto ATIVO: ${s.name}`);
        setsOn++;
        await sleep(2000);
      } else {
        console.log(`↻ conjunto já ativo: ${s.name}`);
      }
    }
    console.log(`\nResumo ativação: ${setsOn} conjunto(s) + ${adsOn} ad(s) ativados. Campanha segue ${camp.status}.`);
    process.exit(0);
  }

  // ---------- MODO CRIAÇÃO (DRY / --go) ----------
  // 2) Biblioteca TP1751-1770
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    gte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, TP_START),
    lte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, TP_END),
  ));
  if (rows.length !== 20) throw new Error(`Esperava 20 linhas TP${TP_START}-TP${TP_END}, achei ${rows.length}`);

  // 3) vídeos no Gerenciador (match estrito por nome, early-exit)
  const targets: PairTarget[] = rows.map((r) => ({ key: r.tpId, base: r.nomeDrive ?? "" }));
  const { pairs, pagesRead, foundAll } = await findPairedVideosByExactName(ACC, targets);
  console.log(`Descoberta advideos: ${pagesRead} página(s) · achou todos: ${foundAll ? "sim" : "NÃO"}`);

  type Ad = { body: number; hook: number; tpId: string; nomeFinal: string; v9: string; v45: string };
  const ready: Ad[] = [];
  const warns: string[] = [];
  for (const r of rows) {
    const p = pairs.get(r.tpId)!;
    const { b, h } = bhOf(r.nomeDrive ?? "");
    if (!p.v9 || !p.v4) { warns.push(`${r.tpId} (b${b}h${h}): falta ${!p.v9 ? "9x16" : "4x5"} no Gerenciador`); continue; }
    if (p.dup9 > 1 || p.dup4 > 1) warns.push(`${r.tpId}: duplicata 9x16 x${p.dup9} 4x5 x${p.dup4}`);
    ready.push({ body: b, hook: h, tpId: r.tpId, nomeFinal: r.nomeFinal, v9: p.v9, v45: p.v4 });
  }

  // 4) conjunto irmão de referência: maior NN com pelo menos 1 ad (config + copy)
  let cloneAdset: { id: string; name: string } | null = null;
  let refCre: any = {};
  for (const s of [...existingSets].sort((a, b) => nnOf(b.name) - nnOf(a.name))) {
    if ((s.name ?? "").includes(loteSufixo)) continue; // não clonar de nós mesmos
    const refAds = await withBackoff(`GET ads ${s.id}`, () =>
      metaGet(`${s.id}/ads`, { fields: "creative{asset_feed_spec,url_tags,object_story_spec}", limit: "1" }),
    );
    if (refAds.data?.length) { cloneAdset = s; refCre = refAds.data[0].creative ?? {}; break; }
  }
  if (!cloneAdset) throw new Error("Nenhum conjunto com ads na campanha pra clonar config/copy — me diga qual usar.");

  const afs = refCre.asset_feed_spec ?? {}, oss = refCre.object_story_spec ?? {}, vd = oss.video_data ?? {};
  let urlTags: string | undefined = refCre.url_tags;
  if (urlTags) urlTags = urlTags.replace(/hsa_grp=\d+/, "hsa_grp={{adset.id}}").replace(/hsa_ad=\d+/, "hsa_ad={{ad.id}}");
  const reused: Reused = {
    message: afs.bodies?.[0]?.text || vd.message || "",
    title: afs.titles?.[0]?.text || vd.title,
    link: afs.link_urls?.[0]?.website_url || vd.call_to_action?.value?.link || "",
    cta: afs.call_to_action_types?.[0] || vd.call_to_action?.type || "LEARN_MORE",
    urlTags,
    pageId: oss.page_id ?? DEFAULT_PAGE,
    ig: oss.instagram_actor_id ?? oss.instagram_user_id ?? DEFAULT_IG,
  };

  const cfg = await withBackoff("GET config clone", () =>
    metaGet(cloneAdset.id, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting,destination_type" }),
  );
  const platforms: string[] = cfg.targeting?.publisher_platforms ?? [];
  const igOnly = platforms.length > 0 && !platforms.includes("facebook");

  // 5) monta 4 conjuntos: por body, split h01-05 / h06-10
  let nn = Math.max(0, ...existingSets.map((s) => nnOf(s.name)));
  const bodies = [...new Set(ready.map((a) => a.body))].sort((a, b) => a - b);
  const plan: { name: string; existingId: string | null; ads: Ad[] }[] = [];
  for (const b of bodies) {
    for (const grp of [ready.filter((a) => a.body === b && a.hook <= 5), ready.filter((a) => a.body === b && a.hook >= 6)]) {
      if (!grp.length) continue;
      grp.sort((x, y) => x.hook - y.hook);
      const lo = pad2(Math.min(...grp.map((x) => x.hook)));
      const hi = pad2(Math.max(...grp.map((x) => x.hook)));
      const sufixoConj = `${loteSufixo} - h${lo} a h${hi} | b${b} | c1`;
      const found = existingSets.find((s) => (s.name ?? "").includes(sufixoConj));
      const name = found?.name ?? `${++nn} - [IG] [Aberto] [Stories & Feed & Reels] ${sufixoConj}`;
      plan.push({ name, existingId: found?.id ?? null, ads: grp });
    }
  }

  // ---- relatório ----
  console.log(`\n${TEMA} · ${plan.length} conjunto(s) · clone: ${cloneAdset.id} — ${cloneAdset.name}`);
  console.log(`Copy (${reused.message.length} chars): "${reused.message.slice(0, 90).replace(/\n/g, " ")}…"`);
  console.log(`Link: ${reused.link}  ·  CTA: ${reused.cta}  ·  UTM: ${reused.urlTags ? "sim" : "—"}  ·  page ${reused.pageId} / ig ${reused.ig}`);
  console.log(`Config: opt=${cfg.optimization_goal} · billing=${cfg.billing_event} · dest=${cfg.destination_type ?? "—"} · pixel=${cfg.promoted_object?.pixel_id ?? "—"}/${cfg.promoted_object?.custom_event_type ?? "—"} · plataformas=${platforms.join(",") || "?"} (${igOnly ? "IG-only" : "FB+IG"})`);
  for (const c of plan) {
    console.log(`\n• ${c.existingId ? "↩︎ existe " + c.existingId : "NOVO"} — ${c.name} (${c.ads.length} ads)`);
    for (const a of c.ads) console.log(`    ${a.nomeFinal}  [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  const totalAds = plan.reduce((s, c) => s + c.ads.length, 0);
  console.log(`\nTotal: ${plan.length} conjuntos · ${totalAds} ads pareados · modo: ${go ? "🔴 CRIAR (PAUSED)" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar; depois --activate pra ativar."); process.exit(0); }
  if (!reused.message || !reused.link) throw new Error(`copy/link do irmão vieram vazios (msg=${reused.message.length} link=${reused.link})`);
  if (totalAds !== 20) throw new Error(`esperava 20 ads, montei ${totalAds} — revisar match antes de criar`);

  // 6) cria (PAUSED)
  let createdAds = 0, createdSets = 0;
  for (const c of plan) {
    let adsetId = c.existingId;
    if (!adsetId) {
      const created = await withBackoff(`create conj`, () =>
        metaPostForm(`${ACC}/adsets`, {
          name: c.name, campaign_id: camp.id,
          optimization_goal: cfg.optimization_goal, billing_event: cfg.billing_event,
          promoted_object: cfg.promoted_object, attribution_spec: cfg.attribution_spec, targeting: fixTargeting(cfg.targeting),
          ...(cfg.destination_type && cfg.destination_type !== "UNDEFINED" ? { destination_type: cfg.destination_type } : {}),
          status: "PAUSED",
        }),
      );
      if (!created.id) throw new Error(`conjunto "${c.name}" sem id`);
      adsetId = created.id; createdSets++;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${c.name}`);
    } else {
      console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${c.name}`);
    }

    const adsNow = await withBackoff(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);
    for (const a of c.ads) {
      if (names.some((n) => n.startsWith(`${a.tpId} `) || n === a.nomeFinal)) { console.log(`  ↩︎ ${a.tpId} já existe`); continue; }
      const cre = await withBackoff(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(a.tpId, a.nomeFinal, a.v9, a.v45, reused, igOnly)));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await withBackoff(`ad ${a.tpId}`, () => metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }));
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, 9x16+4x5)`);
      createdAds++;
      await sleep(8000);
    }
  }

  console.log(`\nResumo: ${createdSets} conjunto(s) + ${createdAds} ad(s) criados (PAUSED). Rode com --activate pra ativar.`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${camp.id}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
