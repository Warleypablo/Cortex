# Padrão de Tags do GoHighLevel — Turbo Partners

> **Status**: vigente a partir da migração de tags executada em 2026-05-23.
> **Fonte de verdade**: `shared/ghl-broadcast/tag-migration-map.ts`.
> **Audiência**: equipe de Marketing, Growth, Comercial e quem mantém forms, automações e integrações que escrevem tags no GHL.

Este documento descreve o padrão único de nomenclatura de tags GHL da Turbo. Toda origem que cria ou adiciona tag em contato (LP forms, GHL Workflows, Bitrix→GHL sync, n8n, integrações externas) **deve** emitir tags seguindo este padrão. Tags fora do padrão poluem a base, quebram filtros do BASE_TAG_MAP e exigem migrações futuras.

---

## Filosofia

Toda tag responde a **uma** das 10 categorias abaixo. Sem categoria, sem tag — não há tag "solta".

**Categorias canônicas (cobrem 90% dos casos):**

| Categoria | O que representa | Exemplos |
|---|---|---|
| `[lead]` | Funil de origem do lead — onde ele entrou | `[lead]_creators`, `[lead]_ecommerce` |
| `[segmento]` | Vertical/nicho do contato | `[segmento]_ecommerce`, `[segmento]_industria` |
| `[faturamento]` | Faixa de receita do negócio do contato | `[faturamento]_30k_50k`, `[faturamento]_500k_1mi` |
| `[status]` | Estado atual no pipeline | `[status]_mql`, `[status]_cliente`, `[status]_congelado` |

**Categorias auxiliares preservadas (casos específicos):**

| Categoria | O que representa | Exemplos |
|---|---|---|
| `[sequencia]` | Está participando de uma automação/sequência ativa | `[sequencia]_indique_e_ganhe` |
| `[evento]` | Inscrição em workshop/bootcamp/evento | `[evento]_workshop_300k_19_03` |
| `[motivo]` | Razão de descarte/perda | `[motivo]_sumiu`, `[motivo]_sem_urgencia` |
| `[mg]` | Material gratuito baixado (lead magnet) | `[mg]_calendario_2025`, `[mg]_email_mkt` |
| `[funnels]` | Etapa de funil de produto/serviço | `[funnels]_teste_gratis`, `[funnels]_compra_efetuada` |
| `[produto]` | Interesse/interação com produto Turbo específico | `[produto]_protocolo_lucro_turbinado_pix_gerado` |

---

## Formato obrigatório

```
[categoria]_valor_em_snake_case
```

### Regras

1. **Categoria entre colchetes**, sempre minúscula, sempre uma das 10 listadas acima.
2. **Separador entre categoria e valor**: `_` (underscore). Nunca espaço, nunca `-`.
3. **Valor em snake_case**: minúsculo, dígitos e `_`. Sem acento, sem `/`, sem `®`, sem `+`, sem espaço.
4. **Categoria sozinha (sem valor)** só é válida quando faz sentido semântico — porém, evitar; preferir sempre adicionar valor.
5. **Eventos de funil no sufixo**: para `[produto]` e `[funnels]`, eventos válidos são `_carrinho_abandonado`, `_pix_gerado`, `_compra_efetuada`. Sem sufixo = tem interesse/iniciou.

### Exemplos válidos

```
[lead]_creators
[lead]_estruturacao_comercial
[segmento]_ecommerce
[segmento]_agencia_marketing
[faturamento]_100k_500k
[faturamento]_30mi_plus
[status]_mql
[status]_congelado
[sequencia]_nutricao_geral
[evento]_workshop_black_friday_25
[motivo]_sem_urgencia
[mg]_design_email
[funnels]_compra_efetuada
[produto]_protocolo_lucro_turbinado
[produto]_protocolo_lucro_turbinado_pix_gerado
```

### Exemplos INVÁLIDOS (anti-padrões)

| ❌ Errado | ✅ Correto | Por quê |
|---|---|---|
| `[faturamento] r$0 - r$30.000` | `[faturamento]_0_30k` | sem espaço/R$/pontuação no nome |
| `[segmento]_indústria` | `[segmento]_industria` | sem acento |
| `[lead]_e-commerce` | `[lead]_ecommerce` | sem hífen |
| `[metodologia asca®]` | `[produto]_metodologia_asca` | sem `®`, sem espaço, categoria correta |
| `creators` | `[lead]_creators` | sempre com categoria |
| `[mql]` | `[status]_mql` | status precisa do prefixo `[status]` |
| `abaixo de 100k` | `[faturamento]_0_100k` | sempre prefixado |
| `lead_flashcrm` | `[lead]_flashcrm` | categoria entre colchetes |
| `forms`, `prax`, `teste` | (apagar — não criar tags sem categoria) | sem categoria = inválido |

---

## Mapeamento de origens → tag canônica

Toda origem que adiciona tag em contato precisa ser auditada e ajustada para emitir no padrão novo.

### Origens conhecidas

| Origem | O que ela escreve hoje | O que deve escrever | Como ajustar |
|---|---|---|---|
| **LP forms** (pages.turbopartners + landing pages) | Adiciona `[lead]_<funil>` + `[faturamento] r$X - r$Y` | `[lead]_<funil>` + `[faturamento]_<faixa>` | Ajustar campo "Tags" do form no GHL ou no provedor da LP. Verificar mapeamento da resposta "Qual seu faturamento?" → tag no formato novo. |
| **GHL Workflows que adicionam tag** | Ação "Add Contact Tag" usando nome antigo | Mesmo nome no padrão novo | Para cada workflow ativo, abrir e editar a ação "Add Contact Tag" para usar o nome canônico. |
| **Bitrix → GHL sync** (se aplicável) | Tag de status do deal vira tag do contato | `[status]_<estado>` | Conferir webhook/script de sync (procurar por strings de tag). |
| **n8n / integrações externas** | Tags conforme configurado | Padrão novo | Buscar nodes com `tag` ou referência a tag, atualizar valores. |
| **Inbox manual da equipe** | Adição manual via GHL UI | Padrão novo | Treinar equipe; quando precisar de tag nova, consultar este doc. |

### Checklist pós-migração

Para cada workflow GHL **publicado** (lista em `out/ghl-workflows-published.txt`), abrir no painel e revisar:

- [ ] Triggers que usam "Contact Tag" → atualizar nome da tag se ainda no formato antigo
- [ ] Conditions/Filters que referenciam tag → idem
- [ ] Ações "Add Contact Tag" / "Remove Contact Tag" → idem
- [ ] Após ajustar: salvar e republicar

Para cada Smart List / segmentação no painel GHL:

- [ ] Abrir e ver filtros de tag
- [ ] Reaplicar com tag no formato novo

---

## Como criar uma tag NOVA

Antes de criar uma tag inédita:

1. **Verifica reuso**: a semântica já existe em alguma das tags listadas em `tag-migration-map.ts`? Se sim, reutilize.
2. **Escolha a categoria**: cabe em alguma das 10? Se não cabe, **não crie** — peça pra revisar o padrão (provavelmente está faltando contexto ou a tag deveria ser custom field).
3. **Defina o valor em snake_case** seguindo as regras acima.
4. **Documente**: adicione a entrada nova em `shared/ghl-broadcast/tag-migration-map.ts` (com `oldTag === newTag` quando não há tag antiga equivalente).
5. **Comunique** a equipe se for relevante pra outras automações.

---

## Tags válidas pós-migração

Lista completa das ~60 tags válidas após a migração, agrupadas por categoria. Para a lista derivada em runtime, ver `VALID_TAGS` em `shared/ghl-broadcast/tag-standard.ts`.

### `[lead]` (origem do funil)

- `[lead]_geral`
- `[lead]_creators`
- `[lead]_criadores`
- `[lead]_geteducacao`
- `[lead]_ecommerce`
- `[lead]_ia`
- `[lead]_academia`
- `[lead]_calculadora`
- `[lead]_estruturacao_comercial`
- `[lead]_flashcrm`
- `[lead]_gestao_comunidade`
- `[lead]_odonto`
- `[lead]_implantacao_funil_vendas`
- `[lead]_turbonews`

### `[segmento]` (vertical)

- `[segmento]_ecommerce`
- `[segmento]_servico`
- `[segmento]_industria`
- `[segmento]_es` (regional Espírito Santo)
- `[segmento]_afiliado_dropshipper`
- `[segmento]_agencia_marketing`
- `[segmento]_educacao`
- `[segmento]_financas`
- `[segmento]_food_service`
- `[segmento]_odonto`
- `[segmento]_turismo`
- `[segmento]_energia_solar`
- `[segmento]_franquia`
- `[segmento]_imobiliaria`
- `[segmento]_telecom`

### `[faturamento]` (faixa de receita)

- `[faturamento]_0_30k`
- `[faturamento]_30k_50k`
- `[faturamento]_50k_100k`
- `[faturamento]_100k_500k`
- `[faturamento]_500k_1mi`
- `[faturamento]_1mi_5mi`
- `[faturamento]_5mi_15mi`
- `[faturamento]_15mi_30mi`
- `[faturamento]_30mi_plus`
- `[faturamento]_0_100k_legacy` (legado — não criar novas)

### `[status]` (pipeline)

- `[status]_mql`
- `[status]_cliente`
- `[status]_congelado`
- `[status]_descartados`
- `[status]_churn`
- `[status]_perdido`
- `[status]_nao_convidar`
- `[status]_blacklist`

### `[sequencia]` (automações ativas)

- `[sequencia]_indique_e_ganhe`
- `[sequencia]_levantaramao`
- `[sequencia]_levantaramao_ia`
- `[sequencia]_nutricao_geral`
- `[sequencia]_nutricao_ecommerce`
- `[sequencia]_nutricao_ia`

### `[evento]` (workshops/bootcamps)

- `[evento]_ecommerce_es_2025`
- `[evento]_workshop_300k_19_03`
- `[evento]_workshop_300k_19_02`
- `[evento]_growth_masterclass_1`
- `[evento]_workshop_black_friday_25`
- `[evento]_workshop_estrategias_americanas_25_09`
- `[evento]_bootcamp_performance`
- `[evento]_bootcamp_vendas`
- `[evento]_convite_totvz`

### `[motivo]` (razões de descarte)

- `[motivo]_sumiu`
- `[motivo]_nao_tinha_budget`
- `[motivo]_descartado_fit`
- `[motivo]_perdi_outra_agencia`
- `[motivo]_projeto_futuro`
- `[motivo]_erro_negociacao`
- `[motivo]_nao_encaixa`
- `[motivo]_sem_interesse`
- `[motivo]_ja_tem_agencia`
- `[motivo]_pequeno`
- `[motivo]_pessoa_errada`
- `[motivo]_sem_urgencia`
- `[motivo]_gatekeeper`
- `[motivo]_trafego_proprio`
- `[motivo]_agencia_marketing`
- `[motivo]_sem_tempo`
- `[motivo]_fat_menor_30k`
- `[motivo]_duplicado`
- `[motivo]_nicho_black`
- `[motivo]_empresa_fechada`
- `[motivo]_sem_contato`

### `[mg]` (materiais gratuitos)

- `[mg]_calendario_2025`
- `[mg]_calendario_2024`
- `[mg]_roteiros_creators`
- `[mg]_email_mkt`
- `[mg]_design_conversao`
- `[mg]_design_email`
- `[mg]_nomenclatura_criativos`
- `[mg]_time_vendas`
- `[mg]_planilha_criativo`
- `[mg]_ui_ux`
- `[mg]_acelerando_motor`
- `[mg]_habilidades_comercial`
- `[mg]_emailmkt_alta_conversao`

### `[funnels]` (etapas de funil de produto/serviço)

- `[funnels]_teste_gratis`
- `[funnels]_compra_efetuada`
- `[funnels]_plano_free`
- `[funnels]_plano_pro`
- `[funnels]_plano_business`
- `[funnels]_reuniao_realizada`
- `[funnels]_reuniao_agendada`

### `[produto]` (interesse em produtos Turbo)

Sufixos válidos: `_carrinho_abandonado`, `_pix_gerado`, `_compra_efetuada` (ou sem sufixo).

- `[produto]_protocolo_lucro_turbinado`
- `[produto]_229_ganchos_hipnoticos`
- `[produto]_criando_anuncios_ia`
- `[produto]_formula_anuncios_lucrativos`
- `[produto]_metodologia_asca`

---

## Manutenção deste documento

Este doc é gerado parcialmente a partir de `shared/ghl-broadcast/tag-migration-map.ts`. Quando adicionar tag nova:

1. Editar `tag-migration-map.ts` adicionando a entrada.
2. Adicionar a tag em `VALID_TAGS` (auto-derivado).
3. Adicionar manualmente a tag na seção correspondente deste doc.
4. Se for categoria nova (não esperado), atualizar `VALID_CATEGORIES` em `tag-standard.ts` e a lista no início deste doc.

Histórico da migração inicial em `/Users/ichino/.claude/plans/quero-padronizar-essas-tags-dreamy-journal.md`.
