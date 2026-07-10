# Perfil Comportamental (DISC) na aba G&G

**Data:** 2026-07-10
**Autor:** Warleypablo + Claude
**Status:** Aprovado (design) — aguardando revisão do spec

## Contexto & objetivo

A aba **G&G** (Gente & Gestão, rotas `/gg/*` + `/dashboard/geg`) hoje reúne Colaboradores,
Recrutamento, Pesquisas (E-NPS), Patrimônio, Férias e Organograma. Queremos adicionar um
**teste de perfil comportamental DISC** inspirado no de referência
(https://www.mrcoach.com.br/teste-perfil-comportamental-disc.php), para **autoconhecimento
dos colaboradores internos**, com o resultado salvo no perfil de cada pessoa e um **mapa DISC
do time** para a G&G.

### Decisões estruturantes (validadas com o usuário)

1. **Público:** colaboradores internos (logados). Autoconhecimento. Resultado salvo e vinculado à pessoa.
2. **Formato:** igual ao Mr. Coach (simples) — **40 perguntas**, cada uma com **4 palavras**,
   escolha única ("Qual palavra melhor te descreve?"). Cada palavra pontua um fator D/I/S/C.
3. **Resultado:** completo — gráfico dos 4 fatores + perfil dominante nomeado (arquétipo) +
   textos descritivos (pontos fortes, como se comunicar, pontos de atenção).
4. **Visão G&G:** mapa DISC do time (lista de colaboradores + perfil dominante + distribuição + filtros).
5. **Privacidade:** resultado **visível para o time todo** (qualquer colaborador logado vê o dos colegas) → **uma única permissão `GG.DISC`** cobre teste, meu resultado, mapa e resultado alheio. Admin faz bypass.

### Fora de escopo (YAGNI)

- Tela de "objetivo do teste" do Mr. Coach (recrutamento/curiosidade/etc.) — público é fixo.
- Uso para candidatos/recrutamento (fase futura, se necessário — a engine já permite).
- Distinção perfil natural × adaptado (só existe no formato de escolha forçada, que não usamos).

## Metodologia DISC

- Fatores: **D**ominância, **I**nfluência, e**S**tabilidade, **C**onformidade.
- Banco: **40 grupos de 4 palavras**. **Cada grupo tem exatamente uma palavra de cada fator**
  (D, I, S, C) → cada fator aparece exatamente 40× no banco e cada resposta soma +1 a um fator.
- Pontuação: conta as escolhas por fator (0–40 cada, soma = 40) → percentual = contagem/40 (soma = 100%).
- **Dominante** = fator com maior contagem; **secundário** = 2º maior. Empate: ordem canônica D > I > S > C.
- Arquétipos: **D = Executor, I = Comunicador, S = Planejador, C = Analista**.
  Headline combina dominante+secundário (ex.: "Executor-Comunicador").

### Fonte única: `shared/disc.ts`

Módulo puro (sem I/O), importado no client e no server:

- `DISC_PERGUNTAS`: array de 40 itens `{ id, opcoes: [{ palavra, fator }] × 4 }`.
- `DISC_ARQUETIPOS`: por fator, `{ nome, tagline, pontosFortes[], comunicacao[], atencao[] }`.
- `computeDiscResult(respostas: Fator[]): { scoreD, scoreI, scoreS, scoreC, percentuais, dominante, secundario }`.
  Recebe o array de fatores escolhidos (um por pergunta) e devolve o resultado calculado.
- O **server recalcula** o resultado a partir das respostas cruas — nunca confia no cálculo do client.

## Modelo de dados

Tabela nova `inhire.rh_disc_resultados` (espelha o padrão do E-NPS `inhire.rh_nps`), criada em
**local E prod** (regra do projeto: aplicar schema nos dois ambientes):

| coluna | tipo | nota |
|--------|------|------|
| `id` | serial PK | |
| `user_id` | varchar(100) | = `auth_users.id` (quem fez) |
| `colaborador_id` | integer null | = `rh_pessoal.id`, resolvido no envio (join p/ squad/nome/foto) |
| `respostas` | jsonb | array de 40 fatores escolhidos (auditoria) |
| `score_d` / `score_i` / `score_s` / `score_c` | integer | contagem por fator |
| `perfil_dominante` | varchar(1) | D/I/S/C |
| `perfil_secundario` | varchar(1) | D/I/S/C |
| `criado_em` | timestamp | default now() |

- **Retake = histórico:** cada envio insere uma linha nova. "Resultado atual" = a mais recente por `user_id`.
- Definição Drizzle em `shared/schema.ts` (mesmo bloco do `rhNps`), com `insert*Schema` e tipos.
- Migration SQL em `migrations/` criando a tabela (idempotente, `CREATE TABLE IF NOT EXISTS`),
  aplicada em local e prod.

## Identidade / vínculo

- Usuário logado: `req.user` (auth_users) → `user_id` = `req.user.id`, nome/foto de `auth_users`.
- Vínculo com colaborador: `rh_pessoal.user_id = auth_users.id`; fallback por email
  (`rh_pessoal.email_turbo = auth_users.email`). Dá `colaborador_id`, `squad`, `cargo`.
- Colaborador não encontrado: grava mesmo assim com `colaborador_id = null` (aparece no mapa como "sem squad").

## Endpoints — `server/routes/disc.ts`

Registrados sob `/api` (auth já aplicada globalmente). Todos exigem `GG.DISC` (admin bypass).

- `POST /api/gg/disc/resultado` — body `{ respostas: Fator[] }` (40 itens). Resolve usuário/colaborador,
  **recalcula o score no server** via `computeDiscResult`, grava linha, retorna o resultado completo.
  Valida com Zod (array de 40 fatores válidos).
- `GET /api/gg/disc/meu` — último resultado do usuário atual (ou `null` se nunca fez).
- `GET /api/gg/disc/mapa` — lista de colaboradores com o resultado mais recente
  (nome, foto, squad, dominante+secundário, data) + distribuição do time (contagem/percentual por fator)
  + lista de quem ainda não fez (colaboradores ativos sem resultado).
- `GET /api/gg/disc/resultado/:userId` — resultado completo de uma pessoa (para o mapa abrir o detalhe).

## Client — páginas e componentes

### Rotas (App.tsx)
- `/gg/disc` → `DiscTeste.tsx` (todo colaborador).
- `/gg/disc/mapa` → `DiscMapa.tsx` (mapa do time).

### `DiscTeste.tsx`
Máquina de estados: **intro → wizard → resultado**.
- **Intro:** o que é o DISC, ~3 min, sem certo/errado. Se já existe resultado (`GET /meu`),
  abre direto no resultado com botão "Refazer teste".
- **Wizard (`DiscWizard`):** uma pergunta por tela, 4 palavras (botões/cards selecionáveis),
  barra de progresso "Pergunta X de 40", voltar/avançar, avança ao escolher. Ao concluir,
  `POST /resultado` e transiciona para o resultado.
- **Resultado (`DiscResultado`):** componente reutilizável (ver abaixo).

### `DiscResultado` (componente compartilhado)
Usado em DiscTeste (próprio), MeuPerfil e no detalhe do mapa. Recebe o objeto de resultado.
- Gráfico dos 4 fatores: **barras horizontais** + toggle **radar** (Recharts).
- Card do perfil dominante: arquétipo, tagline, headline dominante-secundário.
- Blocos: **Pontos fortes**, **Como se comunicar com você**, **Pontos de atenção** (de `DISC_ARQUETIPOS`).

### `DiscMapa.tsx`
- Cards de distribuição do time (nº e % de D/I/S/C).
- Tabela de colaboradores (foto, nome, squad, dominante+secundário, data) com **filtro por squad**
  e **por perfil**; clicar abre o `DiscResultado` da pessoa (drawer/modal via `GET /resultado/:userId`).
- Seção "Ainda não fizeram" para cobrança.

### `MeuPerfil.tsx`
Card com resumo do próprio DISC (mini-gráfico + arquétipo) ou CTA "Faça seu teste" (link `/gg/disc`).

## Navegação & permissões

- `shared/nav-config.ts`:
  - `PERMISSION_KEYS.GG.DISC = 'gg.disc'`.
  - Itens no grupo G&G: **"Perfil Comportamental (DISC)"** → `/gg/disc` e **"Mapa DISC do Time"** → `/gg/disc/mapa` (ambos `GG.DISC`).
  - `ROUTE_PERMISSIONS`: `/gg/disc` e `/gg/disc/mapa` → `GG.DISC`.
- Ambas as rotas via `ProtectedRoute` no `App.tsx`.

## Temas
Dark/light obrigatório em todas as telas (`dark:` variants; cores dos fatores fixas mas legíveis nos dois modos).

## Testes
- `computeDiscResult`: pontuação correta, soma 100%, empate resolvido pela ordem canônica, todos-de-um-fator.
- Validação do banco `DISC_PERGUNTAS`: 40 grupos, cada grupo com exatamente 4 opções e os 4 fatores
  distintos (um por fator), sem palavra vazia/duplicada; total de exatamente 40 palavras por fator.
- (Local) `npx tsc --noEmit` limpo; validar telas em dark e light.

## Arquivos afetados

**Novos:**
- `shared/disc.ts`
- `client/src/pages/DiscTeste.tsx`
- `client/src/pages/DiscMapa.tsx`
- `client/src/components/disc/DiscWizard.tsx`
- `client/src/components/disc/DiscResultado.tsx`
- `server/routes/disc.ts`
- `migrations/NNNN_rh_disc_resultados.sql`
- testes: `shared/disc.test.ts`

**Editados:**
- `shared/schema.ts` (tabela `rhDiscResultados` + tipos)
- `shared/nav-config.ts` (permissão + itens de nav + ROUTE_PERMISSIONS)
- `client/src/App.tsx` (2 rotas)
- `client/src/pages/MeuPerfil.tsx` (card de resumo)
- `server/routes.ts` ou `server/index` (registrar o router de disc)

## Ordem de implementação (para o plano)

1. `shared/disc.ts` (banco + arquétipos + scoring) + teste.
2. Schema Drizzle + migration (local e prod).
3. `server/routes/disc.ts` + registro.
4. `DiscResultado` + `DiscWizard`.
5. `DiscTeste.tsx` + rota.
6. `DiscMapa.tsx` + rota.
7. Nav + permissões + ROUTE_PERMISSIONS.
8. Card no MeuPerfil.
9. Verificação (tsc, dark/light, fluxo ponta-a-ponta).
