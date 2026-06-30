/**
 * Entrypoint do pipeline ClickUp (Anúncios/`aprovado`) → Biblioteca → Conjuntos Meta (PAUSED) → WhatsApp.
 *
 *   npx tsx scripts/ads/pipeline-clickup-ads.ts                # dry-run: varre a lista, mostra o plano (não escreve nada)
 *   npx tsx scripts/ads/pipeline-clickup-ads.ts --task 86xxxx  # dry-run de UMA task específica (qualquer status)
 *   npx tsx scripts/ads/pipeline-clickup-ads.ts --live         # EXECUTA de verdade (cria conjuntos, manda WhatsApp, comenta)
 *   npx tsx scripts/ads/pipeline-clickup-ads.ts --task 86xxxx --live
 *
 * Por padrão é DRY-RUN (seguro). Use `--live` só quando quiser escrever em Meta/ClickUp/WhatsApp.
 */
import "dotenv/config";
import * as cfg from "../../server/services/adsPipeline/config";
import { runOverList, runSingleTask, type LotePlan } from "../../server/services/adsPipeline/pipeline";

function printPlan(plan: LotePlan, i: number) {
  const verba = (plan.verbaCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  console.log(`\n${"─".repeat(70)}`);
  console.log(`[${i}] ${plan.taskName}  (${plan.status})  ${plan.taskUrl}`);
  if (!plan.isCreative) {
    console.log(`    ⏭  pulado: ${plan.skipReason}`);
    return;
  }
  if (plan.alreadyProcessed) {
    console.log(`    ⏭  já processado (marcador ${cfg.PROCESSED_MARKER} no comentário) — pulado.`);
    return;
  }
  console.log(`    Funil:      ${plan.funil ?? "—"}  →  campanha ${plan.target?.campaignId ?? "NÃO MAPEADA"}`);
  console.log(`    Público:    ${plan.publico}`);
  console.log(`    Verba:      ${verba}/dia`);
  console.log(`    Drive:      ${plan.driveFolderUrl ?? "—"}`);
  console.log(`    TPs:        ${plan.tpIds.join(", ") || "—"}`);
  console.log(`    Conjunto:   ${plan.conjuntoNome || "— (sem campanha mapeada)"}`);
  if (plan.nomeFinais.length) {
    console.log(`    Anúncios (nome_final):`);
    for (const nf of plan.nomeFinais) console.log(`        ‣ ${nf}`);
  }
  if (plan.warnings.length) {
    console.log(`    ⚠️  ${plan.warnings.join("\n        ")}`);
  }
  if (plan.result) {
    console.log(`    ✅ EXECUTADO: conjunto=${plan.result.adsetId ?? "—"} wpp=${plan.result.whatsappSent ?? false} comentou=${plan.result.commented ?? false}`);
  }
  console.log(`    ── WhatsApp que ${cfg.runtime.dryRun ? "seria" : "foi"} enviado ──`);
  console.log(
    plan.whatsappText
      .split("\n")
      .map((l) => `    │ ${l}`)
      .join("\n"),
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--live")) cfg.runtime.dryRun = false;
  const taskFlagIdx = args.indexOf("--task");
  const singleTaskId = taskFlagIdx >= 0 ? args[taskFlagIdx + 1] : null;

  // sanity de env
  if (!cfg.CLICKUP_TOKEN) {
    console.error("❌ CLICKUP_API_KEY ausente no .env");
    process.exit(1);
  }

  console.log(`\n🤖 ads-pipeline  |  modo: ${cfg.runtime.dryRun ? "DRY-RUN (não escreve nada)" : "🔴 LIVE"}`);
  console.log(`   lista Anúncios: ${cfg.ANUNCIOS_LIST_ID}  |  gatilho: status "${cfg.TRIGGER_STATUS}"`);
  if (!cfg.runtime.dryRun && !cfg.WPP_DEST)
    console.log(`   ⚠️  ADS_PIPELINE_WPP_DEST vazio — em --live o WhatsApp não vai sair.`);

  let plans: LotePlan[];
  if (singleTaskId) {
    console.log(`   alvo: task única ${singleTaskId}`);
    plans = [await runSingleTask(singleTaskId)];
  } else {
    plans = await runOverList();
  }

  if (plans.length === 0) {
    console.log(`\n✅ Nenhum lote em "${cfg.TRIGGER_STATUS}" agora. Nada a fazer.`);
  } else {
    plans.forEach((p, i) => printPlan(p, i + 1));
    console.log(`\n${"─".repeat(70)}`);
    console.log(`Total: ${plans.length} lote(s).`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
