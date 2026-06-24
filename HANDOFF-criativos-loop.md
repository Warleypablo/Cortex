# Loop de Inteligência de Criativos — guia do projeto

> Branch `feature/criativos-intelligence-loop` (stacked no PR #277). Worktree roda na porta **3004** (`./dev.sh`).

## 1. Objetivo
Fechar o ciclo: **roteiro → task ClickUp → Biblioteca → ad no Meta → performance → ranking → próximo roteiro**, com os dados se preenchendo sozinhos.

**Definição de "pronto":** um roteiro novo vira ad e, em D+1, já aparece na Biblioteca com ângulo/persona/performance, alimentando o ranking — sem ninguém digitar.

## 2. Como funciona (arquitetura)
```
DIA 0 (skill turbo-ads-workflow): roteiro Doc + pasta Drive + task ClickUp
  └─► POST /api/growth/creative-batches  (cabeçalho do lote, keyed por driveFolderId)
        { nomeAd(=Big Idea), produto, roteiroUrl, clickupTaskId, modules:{hooks:{h1:{angulo}}} }

DIAS DEPOIS (edição → "subir ad"): arquivos no Drive nomeados ...-h#-b#-c#-v#
  └─► bulkInsertStubs: 1 linha/arquivo na Biblioteca
        persona/proporção ← nome · angulo ← código h# + batch · produto/roteiro ← herda do batch
  └─► createAd no Meta → ad_id + ad_name = "TP#### - ..."
        └─► linkAdsByName: liga tpId ↔ ad_id pelo prefixo TP## (no sync do Meta)

LEITURA: creative_ad_links → meta_insights_daily + Bitrix.crm_deal (utm_content = ad_id)
        • performance por TP   • ranking por ângulo/persona/tipo/produto
```

## 3. Arquivos-chave
**Backend** (`server/`)
- `shared/schema.ts` — tabelas `creative_batches`, `creative_ad_links`, `creative_vocab` + colunas em `creatives_library`.
- `services/adsCreation/creativesRepo.ts` — Biblioteca: CRUD, parser de nome (`parseFileNameConvention`), `bulkInsertStubs`, `listCreativesWithSpend` (filtro "Só com investimento").
- `services/adsCreation/creativeBatchesRepo.ts` — cabeçalho de batch + vocabulário + `resolveModuleFields` (h# → ângulo).
- `services/adsCreation/creativeAdLinker.ts` — `linkAdsByName` (tpId ↔ ad_id por nome).
- `services/adsCreation/creativePerformanceRepo.ts` — read-back (performance por TP + ranking). **MQL/CAC alinhados ao `growth.ts`.**
- `services/metaAdsSync.ts` — passo 7 chama o linker no fim do sync.
- `routes/creatives.ts` — endpoints (`/creatives`, `/creative-batches`, `/creative-vocab`, `/creative-performance`, `/creative-ranking`).
- `routes/ads-creation.ts` — herança do batch no `buildStub`.

**Frontend** (`client/src/`)
- `pages/CriativosBiblioteca.tsx` — página com abas Biblioteca/Inteligência.
- `components/criativos/biblioteca/` — `CreativeFormSheet`, `RankingPanel`, `VocabConfigDialog`.
- `hooks/useCreatives.ts` — hooks de dados.
- `lib/creativePerfFormat.ts` — formatadores + presets de janela.

**Migração:** `migrations/2026-06-18-creative-intelligence-loop.sql` (aditiva, idempotente — **já aplicada no banco de prod**).

## 4. Status
**Pronto e testado contra produção:**
- ✅ Schema + migração · captura (batch + parser) · linker (1.496 criativos vinculados).
- ✅ Read-back (performance por TP + ranking), MQL/CAC iguais à aba Criativos.
- ✅ UI: abas, janela (7/30/90/365d + **Todos**), colunas (Invest/Hook%/Hold%/CTR/Leads/MQL/%MQL/Vendas/CAC/ROAS), coluna Links (roteiro/Drive/preview), filtro **Só com investimento**, form, config de vocab.

**Falta:**
- ⏳ **Skill** (`turbo-ads-workflow`, repo `chief-of-staff`): passo `POST /creative-batches` + convenção de nome. **É o que fecha o loop automático.** (depende da convenção de nome)
- ⏳ Pós-merge do #277: re-apontar PR pra main + re-verificar read-back vs `growth.ts` novo.

## 5. Decisões em aberto
- 🔸 **Convenção de nome do arquivo** (`...-h#-b#-c#-v#`) — alinhar com o time de edição. *(única disciplina manual)*
- 🔸 **Lista de ângulos definitiva** (hoje semeada, editável na UI ⚙️).
- 🔸 **Quando o #277 mergeia** — o loop só vai pra main depois dele (a Biblioteca só existe no #277).
- 🔸 Quem enxerga a Inteligência (hoje restrito a 3 e-mails em `routes/creatives.ts` → `APPROVER_EMAILS`).

## 6. Limitações conhecidas (números reais)
- **Só 123 de 2.901 ads estão ATIVOS** — o resto pausado. Em janela recente a maioria mostra zero (use "Todos" + filtro "Só com investimento").
- **Atribuição de vendas no histórico é parcial:** dos 1.307 criativos com gasto, ~430 têm leads e 62 têm vendas (33%). Ads antigos nem sempre carregavam `utm_content=ad_id`. **Métricas pagas (hook/CTR) são confiáveis; CAC/ROAS histórico é mais fino. Daqui pra frente fica completo.**
- **Ângulo legado sujo:** criativos antigos têm ângulo em texto livre → ranking por ângulo só fica bom com criativos novos (via skill).
- Link em tempo de criação não é imediato — o `name_match` no sync cobre tudo, com latência até o próximo sync.

## 7. Como rodar e testar
```bash
cd /Users/ichino/Projects/Cortex/Cortex-criativos-intelligence-loop
./dev.sh          # http://localhost:3004
```
Testar na UI (logado, e-mail approver): aba **Biblioteca** → janela "Todos" + "Só com investimento" → buscar `TP546` (deve mostrar ~R$148k, hook 19,7%, MQL, CAC, ROAS). Aba **Inteligência** → ranking por persona (ex: Lucas ~29% MQL).

Smoke test de lógica (sem UI): `npx tsx scripts/test-creative-loop.ts`.

## 8. Release
1. Validar no preview. 2. Fechar decisões da seção 5. 3. Construir a skill. 4. #277 mergeia → re-apontar PR pra main + re-verificar read-back. 5. Mergear. 6. Skill no ar + time treinado na convenção. 7. Acompanhar 1-2 semanas.
