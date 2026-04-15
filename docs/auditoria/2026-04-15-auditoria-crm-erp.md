# Auditoria CRM → ERP — 2026-04-15

> Diagnóstico end-to-end do funil Bitrix → ClickUp → Conta Azul. Janela: últimos 12 meses. Multi-empresa unificada (Turbo Partners + PEIXOTO DEBBANE).

## 🎯 Headline

**R$ 10.495.223,52 deixados na mesa nos últimos 12 meses** (estimativa worst case, soma de todas as categorias com impacto financeiro).

2238 cadastros bagunçados sem impacto financeiro direto, mas que sustentam o vazamento.

## 🔥 Top 5 Vazamentos por R$ Impacto

| # | Categoria | Ocorrências | R$ Impacto | Ação |
|---|---|---:|---:|---|
| 1 | Deals ganhos sem CNPJ no Bitrix | 407 | R$ 7.149.365,10 | Comercial: preencher CNPJ retroativo nos deals listados. |
| 2 | MRR contratado ≠ MRR cobrado (sub-cobrança) | 42 | R$ 821.517,28 | Financeiro: revisar contratos e ajustar valor cobrado. |
| 3 | Valor pontual no Bitrix sem parcela pontual no CAZ | 80 | R$ 790.152,00 | Financeiro: cobrar valor pontual retroativo. |
| 4 | Contratos encerrados com parcelas ainda abertas (risco jurídico) | 203 | R$ 630.167,36 | Financeiro: cancelar parcelas indevidas imediatamente. |
| 5 | Inadimplência pós-churn > 90 dias | 161 | R$ 409.374,03 | Financeiro: provisionar como perda ou negativar. |

## ⚡ 3 Ações de Maior ROI Imediato

1. **Tornar CNPJ obrigatório no Bitrix antes de mover pra "Negócio Ganho"** — bloqueia futuros vazamentos da categoria 01 (raiz do problema). Esforço: baixo. Recupera: ~R$ 7.149.365,10 de potencial nos próximos 12 meses.
2. **Auditar caso a caso os deals da categoria 02** — clientes vendidos com CNPJ válido mas sem cadastro no CAZ. Lista no CSV anexo. Esforço: médio. Recupera: R$ 68.100,00.
3. **Cancelar parcelas indevidas de contratos encerrados (categoria 09)** — risco jurídico imediato, 203 casos. Esforço: baixo. Mitigação: R$ 630.167,36 de exposição.

## Metodologia

- **Janela:** 12 meses, capada nos multiplicadores temporais.
- **"Deal ganho":** `stage_name` em ('Negócio Ganho', 'Negócios Fechados') nas pipelines 0 (Geral) e 12 (Cross Sell e Upsell). Universo: 611 deals.
- **Multi-empresa:** Turbo Partners + PEIXOTO DEBBANE unificadas (cliente "existe" se aparece em qualquer das duas).
- **CNPJ normalizado:** `LPAD(REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g'), 14, '0')` aplicado nas 3 fontes.
- **Recorrente:** `tipo_fatura` está vazio em 100% das parcelas (bug ETL); usamos categoria `03.01.01 Receita de Serviços` como proxy.
- **Estimativas são teto (worst case)**, não previsão. Cada caso precisa ser validado antes de virar planilha de cobrança.

## Achados de estrutura (smoking guns)

1. **DATABASE.md desatualizado:** `crm_deal` tem colunas `cnpj`, `valor_recorrente`, `valor_pontual`, `closer`, `sdr`, `funil`, `empresa`, `data_fechamento`, `produtos`, `stage_semantic` que não estão documentadas.
2. **`crm_deal.stage_semantic` está vazio em ~99,9% dos deals** — campo deveria ter S/F/P. Provável bug de ETL.
3. **Pipeline "Pós-Ganho" → stage "Subir/Ajustar Cobrança"** existe com 101 deals e zero CNPJ. Literalmente "fila pra dar entrada no financeiro" sem o dado mais básico.
4. **`caz_parcelas.tipo_fatura` 100% NULL** — coluna existe mas nunca foi populada. Impossível distinguir recorrente de pontual sem heurística.
5. **`crm_deal.empresa` 100% vazio nos deals ganhos** — não dá pra direcionar deal → empresa CAZ.

## 🩸 Vazamento de caixa — R$ 7.497.665,10 de impacto

### Categoria 1 — Deals ganhos sem CNPJ no Bitrix

**Problema:** Deals em "Negócio Ganho" (pipeline 0) ou "Negócios Fechados" (pipeline 12) sem CNPJ preenchido. Sem CNPJ é fisicamente impossível casar com o ERP.

**Total:** 407 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 7.149.365,10 (worst case)

**Ação sugerida:** Comercial: preencher CNPJ retroativo nos deals listados. Curto prazo: tornar campo obrigatório nos stages de fechamento.

**Top 10 piores:**

| id_deal | title | company_name | contact_name | closer | sdr | data_fechamento_ou_modify | valor_recorrente | valor_pontual | meses_aberto | impacto_estimado_rs | link_bitrix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 9426 | Phooto |  | Fabio Zausner None | 34 | 12 | Mon Oct 13 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 25000.00 | 0.00 | 6 | 150000.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/9426/ |
| 4390 | [Creators] Vestcasa \| Rafael Rafael | Vestcasa | Rafael Rafael | 34 | 12 | Fri Oct 31 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 22500.00 | 0.00 | 5 | 112500.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/4390/ |
| 3370 | Laboratório Tommasi |  | [HubSpot] Tais Bulgareli | 1 |  | Mon Dec 08 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 25000.00 | 0.00 | 4 | 100000.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/3370/ |
| 14190 | [Creators] Beautyin \| Cristiana Arcangeli | Beautyin | Cristiana Arcangeli Arcangeli | 1 | 12 | Tue Dec 16 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 21500.00 | 20000.00 | 3 | 84500.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/14190 |
| 4588 | Bioroots | Bioroots | Thiago None | 1 | 22 | Tue Sep 30 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 10295.00 | 15000.00 | 6 | 76770.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/4588/ |
| 12108 | Bluzz Saúde |  | Rodrigo None | 56 | 56 | Mon Nov 03 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 13800.00 | 0.00 | 5 | 69000.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/12108 |
| 7024 | [Creators] Authentic Nutri \| Mateus Mateus | Authentic Nutri | Mateus Mateus | 18 | 16 | Thu Oct 09 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 11475.00 | 0.00 | 6 | 68850.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/7024/ |
| 12866 | Calebito |  | Patrícia Luziê | 36 | 16 | Fri Nov 28 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 16500.00 | 0.00 | 4 | 66000.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/12866 |
| 10270 | Emesa |  | Pedro None | 36 | 22 | Thu Oct 30 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 9000.00 | 20000.00 | 5 | 65000.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/10270 |
| 7500 | [Creators] Trevisan+ \| Camila trevisan | Trevisan+ | Camila trevisan | 34 | 28 | Tue Sep 30 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 10000.00 | 3000.00 | 6 | 63000.00 | https://turbopartners.bitrix24.com.br/crm/deal/details/7500/ |

**CSV completo:** [csv/01-deals-ganhos-sem-cnpj.csv](2026-04-15/csv/01-deals-ganhos-sem-cnpj.csv) (407 linhas)

### Categoria 2 — Deals ganhos com CNPJ válido mas sem cliente no Conta Azul

**Problema:** Deal tem CNPJ, CNPJ validou no módulo 11, mas não existe cliente correspondente em nenhuma das duas empresas do CAZ.

**Total:** 14 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 68.100,00 (worst case)

**Ação sugerida:** Financeiro: criar cadastro do cliente no CAZ e iniciar cobrança.

**Top 10 piores:**

| id_deal | cnpj_normalizado | title | company_name | melhor_match_caz | similaridade | valor_recorrente | valor_pontual | impacto_estimado_rs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 30606 | 29780968000160 | Marcos Zeni |  | 027 Kicks - Luiz Eduardo Camatta | 0.000 | 0.00 | 30000.00 | 30000.00 |
| 26100 | 50255532000360 | Sleepo | sleepo | (SLEEPO MODAS LTDA) | 0.389 | 0.00 | 12800.00 | 12800.00 |
| 28432 | 25073624000160 | [Creators] Vinik Importadora \| Andre Jerusalmy | Vinik Importadora | MW IMPORTADORA | 0.571 | 2000.00 | 6300.00 | 8300.00 |
| 23830 | 00000063029927 | Solum |  | 027 Kicks - Luiz Eduardo Camatta | 0.000 | 0.00 | 7000.00 | 7000.00 |
| 29978 | 32111654000189 | [Creators] Zonacriativa \| Ahmad Ahmad | Zonacriativa | ZIVA | 0.200 | 0.00 | 5000.00 | 5000.00 |
| 27178 | 58189562000105 | MineralPro |  | 027 Kicks - Luiz Eduardo Camatta | 0.000 | 2500.00 | 3000.00 | 3000.00 |
| 25058 | 04336068000105 | CG engenharia |  | 027 Kicks - Luiz Eduardo Camatta | 0.000 | 0.00 | 2000.00 | 2000.00 |
| 31876 | 00000123456789 | teste10 |  | 027 Kicks - Luiz Eduardo Camatta | 0.000 | 0 | 0 | 0.00 |
| 31738 | 00000123456789 | teste5 |  | 027 Kicks - Luiz Eduardo Camatta | 0.000 | 0 | 0 | 0.00 |
| 31796 | 45352826000158 | [Geral] Neon Seguros \| Vinícius Vinícius | Neon Seguros | CLUBE P A S I DE SEGUROS | 0.276 | 2500.00 | 0.00 | 0.00 |

**CSV completo:** [csv/02-deals-ganhos-sem-cliente-caz.csv](2026-04-15/csv/02-deals-ganhos-sem-cliente-caz.csv) (14 linhas)

### Categoria 3 — Deals ganhos com cliente no CAZ mas sem parcela aberta há 90 dias

**Problema:** Cadastro existe mas ninguém criou a primeira parcela (ou a recorrência foi pausada e esquecida).

**Total:** 9 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 19.988,00 (worst case)

**Ação sugerida:** Financeiro: validar contrato e gerar parcelas pendentes.

**Top 10 piores:**

| id_deal | cnpj | cliente_caz_nome | ultima_parcela_data | meses_sem_cobranca | valor_recorrente | impacto_estimado_rs |
| --- | --- | --- | --- | --- | --- | --- |
| 21900 | 30504910000172 | Organix (JOAO CICERO DA SILVA NETO) |  | 2 | 3997.00 | 7994.00 |
| 23408 | 54117020000176 | W2GO (WHERE2GO SERVICOS NA INTERNET LTDA) |  | 2 | 2997.00 | 5994.00 |
| 29100 | 57775388000110 | (VIGGI LTDA) |  | 1 | 5000.00 | 5000.00 |
| 24712 | 55529395000106 | NOWAY C.O. | Thu Feb 27 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 1 | 1000.00 | 1000.00 |
| 27368 | 47246066000120 | BREADY |  | 2 | 0.00 | 0.00 |
| 30788 | 36604519000126 | Multas.ai (EASY SERVICOS ESPECIALIZADOS CHAPECO LTDA) |  | 0 | 0.00 | 0.00 |
| 27368 | 47246066000120 | HEVO BREADY |  | 2 | 0.00 | 0.00 |
| 20792 | 57322486000100 | NEVERDIE COMERCIO DE ALIMENTOS E BEBIDAS LTDA |  | 3 | 0.00 | 0.00 |
| 27368 | 47246066000120 | HEVO BREADY | Fri Dec 05 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 4 | 0.00 | 0.00 |

**CSV completo:** [csv/03-deals-com-cliente-sem-parcela.csv](2026-04-15/csv/03-deals-com-cliente-sem-parcela.csv) (9 linhas)

### Categoria 4 — Contratos ativos no ClickUp sem cliente no Conta Azul

**Problema:** Caminho alternativo do mesmo vazamento: contratos que entraram direto na operação sem passar pelo CRM.

**Total:** 20 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 126.528,00 (worst case)

**Ação sugerida:** CS + Financeiro: validar e cadastrar.

**Top 10 piores:**

| id_subtask | cup_cliente_nome | cnpj_clickup | servico | valorr | valorp | data_inicio | meses_aberto | impacto_estimado_rs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 86a65bgzx | Munay | 00000934812522 | Ecommerce | 0.00 | 15000.00 | Tue Jan 07 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 12 | 15000.00 |
| 86af51fak | Sleepo | 50255532000360 | Creators Pontual | 0.00 | 12747.00 | Fri Feb 06 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 2 | 12747.00 |
| 86afqavfh | LAB Genesis [PADOCA CURSOS] | 26164816000144 | Estruturação Estratégica | 0.00 | 10000.00 | Wed Feb 25 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 1 | 10000.00 |
| 86a6u4pq9 | BADBOYZ | 00012096092744 | Creators Pontual | 0.00 | 10000.00 | Tue Feb 18 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 12 | 10000.00 |
| 86afqavg4 | LAB Genesis [PADOCA CURSOS] | 26164816000144 | 1ª Entrega - Creators | 0.00 | 9497.00 | Wed Feb 25 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 1 | 9497.00 |
| 86ac0dpve | Brain Experts | 45398843000126 | ID visual | 0.00 | 8000.00 | Mon Sep 22 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 6 | 8000.00 |
| 86a886ppu | KIMASTER E KUBB | 15561338000190 | Creators Pontual | 0.00 | 6500.00 | Mon Apr 28 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 11 | 6500.00 |
| 86ag2nffk | Vinik Importadora | 25073624000160 | Creators Pontual - Starter | 0.00 | 6300.00 | Tue Mar 10 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 1 | 6300.00 |
| 86a63n2uk | Audens | 02246919400010 | Performance | 0.00 | 6000.00 | Thu Jan 02 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 12 | 6000.00 |
| 86a63n2vh | Audens | 02246919400010 | E-mail Marketing | 0.00 | 6000.00 | Thu Jan 02 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 12 | 6000.00 |

**CSV completo:** [csv/04-contratos-cup-sem-cliente-caz.csv](2026-04-15/csv/04-contratos-cup-sem-cliente-caz.csv) (20 linhas)

### Categoria 5 — Contratos ativos no ClickUp sem parcela recorrente nos últimos 60 dias

**Problema:** Cliente existe nos dois sistemas, contrato ativo, mas a recorrência mensal não está sendo gerada.

**Total:** 457 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 133.684,00 (worst case)

**Ação sugerida:** Financeiro: investigar por que parou de gerar e regularizar.

**Top 10 piores:**

| id_subtask | cliente | cnpj | servico | valorr | ultima_parcela_recorrente | dias_desde | impacto_estimado_rs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 86ad3bu1y | Celip | 61778555000153 | Creators Recorrente | 5000.00 | Tue Feb 10 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 64 | 10000.00 |
| 86acc9u0n | Autenticoco | 46788800000110 | Creators Recorrente - Scale | 3000.00 | Mon Jan 05 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 100 | 6000.00 |
| 86a60bvke | Allo Esquadrias | 28334004000125 | Performance | 3000.00 | Thu Feb 27 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 412 | 6000.00 |
| 86ad09h4t | Reset | 52390607000129 | Creators Personalizado (Escopo no briefing) | 3000.00 | Wed Jan 21 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 84 | 6000.00 |
| 86a60cdx5 | APD | 12709340000175 | Performance | 2997.00 |  | 0 | 5994.00 |
| 86a61646t | Core | 11063576000114 | Performance | 2997.00 |  | 0 | 5994.00 |
| 86adaedgy | Mpiton.IA | 00027470440097 | Gestão de performance - Starter | 2997.00 | Tue Dec 02 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 134 | 5994.00 |
| 86a83r8cy | OATZ | 47366383000180 | Social Media | 2697.00 |  | 0 | 5394.00 |
| 86a61534k | Pedrazul Editora | 17235167000134 | Performance | 2500.00 | Thu Feb 27 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 412 | 5000.00 |
| 86a8yenvz | OATZ | 47366383000180 | Performance | 2497.00 |  | 0 | 4994.00 |

**CSV completo:** [csv/05-contratos-cup-sem-recorrente.csv](2026-04-15/csv/05-contratos-cup-sem-recorrente.csv) (457 linhas)

## 💧 Sub-cobrança — R$ 1.611.669,28 de impacto

### Categoria 6 — MRR contratado ≠ MRR cobrado (sub-cobrança)

**Problema:** Diferença positiva entre cup_contratos.valorr e a média mensal das parcelas recorrentes do cliente nos últimos 6 meses.

**Total:** 42 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 821.517,28 (worst case)

**Ação sugerida:** Financeiro: revisar contratos e ajustar valor cobrado.

**Top 10 piores:**

| id_subtask | cliente | cnpj | valorr_contratado | mrr_cobrado_avg | diff_mensal | meses | impacto_estimado_rs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 86aeeht2u | Wave Wellness/Troffe | 56986493000135 | 8997.00 | 4998.00 | 3999.00 | 12 | 47988.00 |
| 86a60bvke | Allo Esquadrias | 28334004000125 | 3000.00 | 0.00 | 3000.00 | 12 | 36000.00 |
| 86a61646t | Core | 11063576000114 | 2997.00 | 0.00 | 2997.00 | 12 | 35964.00 |
| 86a60cdx5 | APD | 12709340000175 | 2997.00 | 0.00 | 2997.00 | 12 | 35964.00 |
| 86aczvb2y | CG Engenharia Ltda | 14636703000115 | 3497.00 | 524.61 | 2972.39 | 12 | 35668.68 |
| 86a83r8cy | OATZ | 47366383000180 | 2697.00 | 0.00 | 2697.00 | 12 | 32364.00 |
| 86ack9tah | Primo Suplementos | 22483207000105 | 2597.00 | 0.00 | 2597.00 | 12 | 31164.00 |
| 86a61534k | Pedrazul Editora | 17235167000134 | 2500.00 | 0.00 | 2500.00 | 12 | 30000.00 |
| 86a8yenvz | OATZ | 47366383000180 | 2497.00 | 0.00 | 2497.00 | 12 | 29964.00 |
| 86a94jdqp | Wonderlev | 39299898000186 | 2197.00 | 0.00 | 2197.00 | 12 | 26364.00 |

**CSV completo:** [csv/06-mrr-contratado-vs-cobrado.csv](2026-04-15/csv/06-mrr-contratado-vs-cobrado.csv) (42 linhas)

### Categoria 7 — Valor pontual no Bitrix sem parcela pontual no CAZ

**Problema:** Deals com valor_pontual > 0 que não geraram cobrança pontual no CAZ na janela ±60 dias do fechamento.

**Total:** 80 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 790.152,00 (worst case)

**Ação sugerida:** Financeiro: cobrar valor pontual retroativo.

**Top 10 piores:**

| id_deal | cliente | cnpj | valor_pontual_deal | data_fechamento | parcela_proxima_encontrada | impacto_estimado_rs |
| --- | --- | --- | --- | --- | --- | --- |
| 25200 | [Comercial] Colcho ads \| Pedro Nogueira | 42586182000174 | 50000.00 | Fri Feb 20 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 50000.00 |
| 23782 | [Comercial] Energy MT \| Marcel Pascoski | 32613370000190 | 40000.00 | Fri Feb 20 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 40000.00 |
| 30606 | Marcos Zeni | 29780968000160 | 30000.00 | Mon Apr 13 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 30000.00 |
| 32250 | Terramazonia | 46243258000110 | 28000.00 | Wed Mar 25 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 28000.00 |
| 29010 | Colmeia | 44383939000158 | 27000.00 | Fri Feb 27 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 27000.00 |
| 28548 | [Geral] Zavii - Drink Lucia \| Victor Ramos | 58056226000194 | 25497.00 | Mon Mar 09 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 25497.00 |
| 27298 | [Comercial] Umeda Engenharia \| Thaylison Umeda | 52229217000171 | 24000.00 | Fri Feb 27 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 24000.00 |
| 25914 | [Creators] MenoCare \| Luiz Nakoneczny | 47229298000170 | 22000.00 | Thu Apr 02 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 22000.00 |
| 28226 | COMU | 51595147000102 | 21600.00 | Mon Feb 23 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 21600.00 |
| 30558 | [Ecommerce] Gallri \| Natalie  | 52659110000163 | 21500.00 | Tue Mar 31 2026 00:00:00 GMT-0300 (Brasilia Standard Time) |  | 21500.00 |

**CSV completo:** [csv/07-valor-pontual-sem-parcela.csv](2026-04-15/csv/07-valor-pontual-sem-parcela.csv) (80 linhas)

### Categoria 8 — Reajustes contratados não refletidos no faturamento (exploratório)

✅ Nenhum problema encontrado.

## 🪦 Pós-churn — R$ 1.039.541,39 de impacto

### Categoria 9 — Contratos encerrados com parcelas ainda abertas (risco jurídico)

**Problema:** Cobrança ativa em cliente que já cancelou. Risco jurídico/reputação.

**Total:** 203 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 630.167,36 (worst case)

**Ação sugerida:** Financeiro: cancelar parcelas indevidas imediatamente.

**Top 10 piores:**

| cliente | cnpj | data_encerramento | parcela_id | parcela_vencimento | valor_bruto | status_parcela |
| --- | --- | --- | --- | --- | --- | --- |
| Phooto | 17836901000110 | Mon Dec 01 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 197199c4-34a2-4089-a7c6-e4c6be47ea27 | Mon Apr 20 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 22247.00 | PENDENTE |
| FG Bolsas | 00000000000001 | Wed May 31 2023 00:00:00 GMT-0300 (Brasilia Standard Time) | 220cc124-5e97-4e99-a5e1-e12e5f07b256 | Fri Apr 10 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 13860.00 | ATRASADO |
| Calebito | 48860430000100 | Tue Apr 07 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 233b5b56-7f4a-4be8-bab9-5a276b4114ce | Fri Jun 05 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 13250.00 | PENDENTE |
| Clean Whey | 26935491000156 | Wed Apr 01 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 5d17f151-a060-47fc-b3ff-da65c873b7e4 | Mon May 25 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 11992.50 | PENDENTE |
| Clean Whey | 26935491000156 | Wed Apr 01 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | df3e79e4-30e4-478a-b7b9-2d863de66479 | Thu Jun 25 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 11992.50 | PENDENTE |
| Francis Life | 53028446000190 | Fri Jan 30 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 408bd221-4ed0-40c1-8d56-03f0af9cc55d | Tue May 05 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 9997.00 | PENDENTE |
| Francis Life | 53028446000190 | Fri Jan 30 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 22cade49-2291-4dde-a245-c43839ca0032 | Fri Jun 05 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 9997.00 | PENDENTE |
| Lavira | 00044156544877 | Mon Mar 30 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 18564694-048f-4bd3-8df2-c6eb30625eab | Fri Jun 05 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 8497.00 | PENDENTE |
| Bem de mim | 61913830000102 | Thu Mar 26 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 8dc7be59-a088-4ed4-918b-15b4617f3d94 | Mon May 25 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 8297.00 | PENDENTE |
| Bem de mim | 61913830000102 | Thu Mar 26 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 69348138-eff8-442a-a377-abff495616d3 | Thu Jun 25 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 8297.00 | PENDENTE |

**CSV completo:** [csv/09-encerrados-com-parcelas-abertas.csv](2026-04-15/csv/09-encerrados-com-parcelas-abertas.csv) (203 linhas)

### Categoria 10 — Inadimplência pós-churn > 90 dias

**Problema:** Parcelas não pagas há mais de 90 dias de clientes já encerrados — provisão de perda real.

**Total:** 161 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 409.374,03 (worst case)

**Ação sugerida:** Financeiro: provisionar como perda ou negativar.

**Top 10 piores:**

| cliente | cnpj | data_encerramento | parcela_id | vencimento | nao_pago | dias_atraso |
| --- | --- | --- | --- | --- | --- | --- |
| Lahza | 56300677000108 | Mon Nov 17 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | a40d7dbb-f39a-4770-b92a-9b358763e0d4 | Sun Nov 30 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 11820.00 | 136 |
| Crilancha | 46520941000157 | Thu Feb 05 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | abfe0247-06ab-4a4f-9a85-534ef279dc3b | Mon Dec 15 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 9491.00 | 121 |
| Mandoaê | 46520941000157 | Thu Feb 05 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 369b6ac4-4332-436c-9ae7-d6557068d498 | Thu Jan 15 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 9491.00 | 90 |
| Mandoaê | 46520941000157 | Thu Feb 05 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | abfe0247-06ab-4a4f-9a85-534ef279dc3b | Mon Dec 15 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 9491.00 | 121 |
| Crilancha | 46520941000157 | Thu Feb 05 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 369b6ac4-4332-436c-9ae7-d6557068d498 | Thu Jan 15 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 9491.00 | 90 |
| Barba de Respeito | 34366677000240 | Thu Mar 13 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 912fb26a-8cd5-4925-8a25-879f6b43b5de | Sun Feb 16 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 8500.00 | 423 |
| Patchá | 52481399000173 | Tue Mar 11 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 7b1a4ddf-9530-4e17-8522-3e9648733a4c | Fri Apr 11 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 6994.00 | 369 |
| Patchá | 52481399000173 | Tue Mar 11 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 022e14aa-7222-4636-8b1a-4c980dea3848 | Mon Mar 10 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 6994.00 | 401 |
| Películas Fácil | 26901179000141 | Wed May 21 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 1607634e-876c-4fa6-a14f-06bc60924442 | Mon May 26 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 6402.50 | 324 |
| Barba de Respeito | 34366677000240 | Thu Mar 13 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 4e42ead1-15b7-476d-a271-a8d977c66497 | Thu Jan 23 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 6200.00 | 447 |

**CSV completo:** [csv/10-inadimplencia-pos-churn.csv](2026-04-15/csv/10-inadimplencia-pos-churn.csv) (161 linhas)

## 🪪 Saúde de cadastro

### Categoria 11 — Duplicatas de CNPJ em cup_clientes

**Problema:** Mesmo CNPJ aparece em mais de um registro de cup_clientes.

**Total:** 17 ocorrências

**Ação sugerida:** CS: deduplicar manualmente.

**Top 10 piores:**

| cnpj | ids_clickup_array | nomes_array | count |
| --- | --- | --- | --- |
| 30442901000102 | 1224002,1224097,1224098 | AJ cosméticos,Trizzi,Naturelle | 3 |
| 43551923000144 | 1223585,1223586,1223775 | Metodo Facefit,Exercício em Casa,Orgânic Beauty | 3 |
| 51468720000117 | 1223292,1223294,1223295 | Fenix Beauty,Cristiane Alencar,Macho Alfa | 3 |
| 09039492000101 | 1223642,1223650 | Código 1,Estúdio Plugado | 2 |
| 15082919000149 | 1223463,1223696 | Mobgran,Glyvio | 2 |
| 21102007000194 | 1223676,1224045 | WOW,Central do Franqueado | 2 |
| 21962719000183 | 1224055,1224127 | Universidade paralela,Casa Bernardi - Giórgia Dentista | 2 |
| 27479498000173 | 1223391,1223402 | ORIS,Produteca | 2 |
| 00000000000001 | 1223312,1224154 | Saltz Michelson,FG Bolsas | 2 |
| 28442758000107 | 1223618,1223620 | Living Proof,Br&Co | 2 |

**CSV completo:** [csv/11-duplicatas-cnpj-cup.csv](2026-04-15/csv/11-duplicatas-cnpj-cup.csv) (17 linhas)

### Categoria 12 — Duplicatas de CNPJ em caz_clientes

**Problema:** Mesmo CNPJ aparece em mais de um registro de caz_clientes (considerando ambas as empresas).

**Total:** 154 ocorrências

**Ação sugerida:** Financeiro: mesclar cadastros.

**Top 10 piores:**

| cnpj | ids_caz_array | nomes_array | empresas_array | count |
| --- | --- | --- | --- | --- |
| 42100292000184 | 3cd797fd-e571-4c90-9549-82463567cfe6,8c8bc21b-0f8f-4977-9717 | TURBO PARTNERS,TURBO PARTNERS,TURBO PARTNERS,TURBO PARTNERS, | Turbo Partners,Turbo Partners,Turbo Partners,Turbo Partners, | 6 |
| 00014180296705 | a050a5e0-5721-4e01-b81c-f884b15c9ce9,4364a89a-c5b9-4084-a58e | Rodrigo Queiroz,Rodrigo Queiroz Santos,Rodrigo Queiroz Santo | Turbo Partners,Turbo Partners,Turbo Partners,PEIXOTO DEBBANE | 4 |
| 10573521000191 | 3b485e05-2c74-4286-baa0-2796249c9bee,c2c46c8f-0647-4e40-9067 | MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA,Mercado Pago,MERC | Turbo Partners,PEIXOTO DEBBANE,PEIXOTO DEBBANE | 3 |
| 00008494700480 | 6dc21988-a5e6-4b30-b914-3dc0bd7d8d9d,76d66529-7dda-4099-96d9 | MICHEL MARQUES DA SILVA DOS SANTOS,MICHEL MARQUES DA SILVA D | Turbo Partners,Turbo Partners,Turbo Partners | 3 |
| 00000000000003 | 72324684-3656-4dcd-b1d7-cb8c08b6d10e,3f5fb1b5-f45f-400b-bed9 | ANSWERTHEP,IOF DE FINANCIAMENTO,STHUB STEVO TECH | Turbo Partners,Turbo Partners,Turbo Partners | 3 |
| 15699640000109 | 3c0975fb-4eab-4f8d-b89e-4850814f8c88,7de247c9-f274-4996-9831 | Yampi Desenvolvimento de Softwares Ltda,YAMPI DESENVOLVIMENT | Turbo Partners,Turbo Partners,PEIXOTO DEBBANE | 3 |
| 35736675000188 | 6e16cb20-5e76-4f2a-888b-f39df01b036d,596c052a-1d0b-408d-b945 | Hair Concept,Rvd Beleza Ltda Me,RVD BELEZA LTDA ME | Turbo Partners,Turbo Partners,Turbo Partners | 3 |
| 00017881135786 | e7e3623a-9eef-468d-97e8-8d30aa81e4ae,bb256357-505a-4a9f-89cc | Daniel Vivas,Daniel Vivas,Daniel Vivas | Turbo Partners,Turbo Partners,PEIXOTO DEBBANE | 3 |
| 36882195000279 | 1273bc27-6639-4c52-8365-6744e86a597b,ef52f8bc-889b-4c0a-9dbc | BROTA COMPANY,Brota Company,Brota Company | Turbo Partners,Turbo Partners,Turbo Partners | 3 |
| 47246066000120 | 884d7397-514c-4451-877e-576fd3b86fc6,217ce457-c8e6-4809-a3b9 | BREADY,HEVO BREADY,HEVO BREADY | Turbo Partners,Turbo Partners,PEIXOTO DEBBANE | 3 |

**CSV completo:** [csv/12-duplicatas-cnpj-caz.csv](2026-04-15/csv/12-duplicatas-cnpj-caz.csv) (154 linhas)

### Categoria 13 — Clientes em cup_clientes sem CNPJ

**Problema:** Cadastro de cliente sem CNPJ — impossível casar com CAZ.

**Total:** 2 ocorrências

**Ação sugerida:** CS: completar cadastro.

**Top 10 piores:**

| id | nome | status | responsavel |
| --- | --- | --- | --- |
| 1.223.052 | AGCT | ativo | André Musso |
| 1.223.866 | Whatsapp Marketing | cancelado/inativo | Lucas Antunes |

**CSV completo:** [csv/13-cup-sem-cnpj.csv](2026-04-15/csv/13-cup-sem-cnpj.csv) (2 linhas)

### Categoria 14 — Clientes em caz_clientes sem CNPJ

✅ Nenhum problema encontrado.

### Categoria 15 — CNPJs malformados em qualquer fonte

**Problema:** CNPJs preenchidos que não passam na validação módulo 11.

**Total:** 1011 ocorrências

**Ação sugerida:** Corrigir nas três fontes.

**Top 10 piores:**

| fonte | id | cnpj_invalido | motivo |
| --- | --- | --- | --- |
| caz_clientes | 949148 | 18181537777 | comprimento != 14 |
| caz_clientes | 949149 | 66746647234 | comprimento != 14 |
| caz_clientes | 949169 | SEM-DOC-7c52cedf-7fe2-42fd-bd6f-6db700f69aa8 | comprimento != 14 |
| caz_clientes | 949173 | SEM-DOC-fc3de6b9-95a6-43d7-850c-12be0d5d2e2e | comprimento != 14 |
| caz_clientes | 949174 | SEM-DOC-ce13165e-5e32-4c40-9f1f-b02f98f5e01a | comprimento != 14 |
| caz_clientes | 949179 | SEM-DOC-3387be6e-5139-41da-8289-64fb34e2138d | comprimento != 14 |
| caz_clientes | 949184 | SEM-DOC-44d7f255-288d-4de8-8ba3-66de698414ed | comprimento != 14 |
| caz_clientes | 949188 | SEM-DOC-6d46f7d5-f95c-444b-9baa-8c1dd82808e3 | comprimento != 14 |
| caz_clientes | 949191 | 09691880725 | comprimento != 14 |
| caz_clientes | 949193 | SEM-DOC-f1e9644f-ce17-4dde-85b2-dcf15d68d46f | comprimento != 14 |

**CSV completo:** [csv/15-cnpjs-malformados.csv](2026-04-15/csv/15-cnpjs-malformados.csv) (1011 linhas)

### Categoria 16 — Mesmo CNPJ, nomes muito divergentes entre ClickUp e CAZ

**Problema:** Similaridade de nomes < 0.3 via pg_trgm — sinal de cadastro errado em um dos dois lados.

**Total:** 627 ocorrências

**Ação sugerida:** CS+Financeiro: investigar e padronizar nome.

**Top 10 piores:**

| cnpj | nome_clickup | nome_caz | similaridade |
| --- | --- | --- | --- |
| 44075058000170 | Xis | SHI MODAS LTDA | 0.000 |
| 44347878000173 | Solution | EDUARDO AUGUSTO DE MELO 02310545139 | 0.000 |
| 00004087578259 | ICCO Sol | GABRIEL LIMA DE OLIVEIRA FLORENÇO | 0.000 |
| 00004674026121 | MasterHub | Valeska Silva de Andrade | 0.000 |
| 00005160985433 | Hasher | Fabrício Marques Nicolau | 0.000 |
| 64509752000165 | Calculadora Obra Certa | M2 Hub Digital (LUCAS RIBEIRO DA SILVA LTDA) | 0.000 |
| 00007441724970 | Ziyon | Djonatha Martins Gomes | 0.000 |
| 00008379976827 | KYNDS | Aventis (JOSE ELIAS MANSUR) | 0.000 |
| 00011116835738 | Orbby | Priscila Nunes Jaffe Zacharias | 0.000 |
| 00011611907403 | Use Kong | Guilherme Anjos | 0.000 |

**CSV completo:** [csv/16-nomes-divergentes-cup-caz.csv](2026-04-15/csv/16-nomes-divergentes-cup-caz.csv) (627 linhas)

## 🔄 Status divergente — R$ 346.347,75 de impacto

### Categoria 17 — Cliente inativo no ClickUp ainda recebendo parcelas

**Problema:** Parcela quitada > 30 dias após cancelamento no ClickUp. Pode indicar cobrança indevida ou falta de baixa no CRM.

**Total:** 183 ocorrências &nbsp;·&nbsp; **Impacto estimado:** R$ 346.347,75 (worst case)

**Ação sugerida:** CS: validar e dar baixa correta.

**Top 10 piores:**

| cliente | cnpj | status_cup | data_inativacao_estimada | parcela_id | data_quitacao | valor_pago |
| --- | --- | --- | --- | --- | --- | --- |
| Abetopine  | 52322964000150 | cancelado/inativo | Wed May 14 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 4775cafb-2c30-46b3-8640-28e85528801f | Wed Sep 03 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 1672.83 |
| Alloe | 31941662000190 | cancelado/inativo | Thu Oct 16 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 18e78316-f35c-4ea5-8093-2b2eec228c94 | Mon Feb 09 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 2953.03 |
| Alloe | 31941662000190 | cancelado/inativo | Thu Oct 16 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | c3fac78a-3407-4d33-b09d-330104c733ca | Mon Feb 09 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 2953.03 |
| AM2 Suplementos | 57412826000185 | cancelado/inativo | Mon May 05 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 057445c7-62b7-43d4-a54a-b3abdf3153f0 | Tue Sep 02 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 1425.63 |
| AM2 Suplementos | 57412826000185 | cancelado/inativo | Mon May 05 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 5767bddb-f1cf-48b0-8959-d8e31c96949a | Thu Oct 23 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 1425.63 |
| AM2 Suplementos | 57412826000185 | cancelado/inativo | Mon May 05 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | a3427392-2d04-411a-bc46-7eefd5717bd0 | Fri Aug 08 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 1425.63 |
| AM2 Suplementos | 57412826000185 | cancelado/inativo | Mon May 05 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | becf5fa6-14e4-43dc-992f-55c8ad43b33e | Tue Nov 18 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 1425.62 |
| AM2 Suplementos | 57412826000185 | cancelado/inativo | Mon May 05 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | d33ae295-74a4-42ad-80cb-73b623baad11 | Thu Oct 30 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 1425.63 |
| Amalfi Gelateria | 62404604000150 | cancelado/inativo | Tue Jan 06 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 69cfbbfc-71d5-4d52-930e-dd857c713ab5 | Wed Feb 25 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 2000.00 |
| Amalfi Gelateria | 62404604000150 | cancelado/inativo | Tue Jan 06 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 9933c66b-0ecc-409b-9f31-ec57026fcdb5 | Thu Feb 26 2026 00:00:00 GMT-0300 (Brasilia Standard Time) | 2000.00 |

**CSV completo:** [csv/17-cup-inativo-com-parcelas.csv](2026-04-15/csv/17-cup-inativo-com-parcelas.csv) (183 linhas)

### Categoria 18 — Cliente ativo no ClickUp sem parcela há > 6 meses

**Problema:** Sintoma de churn não registrado — provavelmente já cancelou na prática mas o CRM não foi atualizado.

**Total:** 71 ocorrências

**Ação sugerida:** CS: validar status real.

**Top 10 piores:**

| cliente | cnpj | status_cup | ultima_parcela | meses_desde | valorr_clickup |
| --- | --- | --- | --- | --- | --- |
| Push Pow | 39691470000265 | entregue | Thu May 15 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 11 | 0.00 |
| Coco Leve | 40019982000188 | entregue | Thu Jun 05 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 10 | 0.00 |
| Iórus Professional | 59904633000177 | entregue | Fri Jun 13 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 10 | 0.00 |
| Natalia Guarçoni | 28922285000137 | entregue | Sun May 25 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 10 | 0.00 |
| Patta | 52058363000181 | entregue | Sun May 25 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 10 | 0.00 |
| Plamev | 17745307000114 | entregue | Tue Jun 10 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 10 | 0.00 |
| Lawe | 40610072000175 | entregue | Fri Jun 20 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 9 | 0.00 |
| Proezo | 39261596000119 | entregue | Wed Jul 02 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 9 | 0.00 |
| Menozen | 28548910000122 | entregue | Fri Jun 27 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 9 | 0.00 |
| Palácio dos Brinquedos | 55695230000104 | entregue | Mon Jun 16 2025 00:00:00 GMT-0300 (Brasilia Standard Time) | 9 | 0.00 |

**CSV completo:** [csv/18-cup-ativo-sem-parcela-6m.csv](2026-04-15/csv/18-cup-ativo-sem-parcela-6m.csv) (71 linhas)

## 🪞 Cross-CRM

### Categoria 19 — Deal perdido no Bitrix mas cliente ativo no ClickUp

✅ Nenhum problema encontrado.

### Categoria 20 — Cliente ativo no ClickUp sem deal correspondente no Bitrix

**Problema:** Origem desconhecida — possível comissionamento órfão.

**Total:** 322 ocorrências

**Ação sugerida:** Comercial: rastrear origem.

**Top 10 piores:**

| id_task | cliente | cnpj | valorr | vendedor | data_inicio |
| --- | --- | --- | --- | --- | --- |
| 86adtbh39 | Grupo Tommasi | 28133312000192 | 25000.00 | João Guarçoni Duarte | Mon Dec 08 2025 00:00:00 GMT-0300 (Brasilia Standard Time) |
| 86acg54ad | Phooto | 17836901000110 | 25000.00 | Daniel Giestas | Mon Oct 13 2025 00:00:00 GMT-0300 (Brasilia Standard Time) |
| 86acypgy6 | Vestcasa | 35157295000199 | 22500.00 |  | Fri Oct 31 2025 00:00:00 GMT-0300 (Brasilia Standard Time) |
| 86aaqq1gy | Monvitta | 55047905000109 | 16782.00 | Daniel Giestas | Mon Aug 04 2025 00:00:00 GMT-0300 (Brasilia Standard Time) |
| 86ad0e9qr | Bluzz Saúde | 54557861000102 | 13744.00 | André Musso | Mon Nov 03 2025 00:00:00 GMT-0300 (Brasilia Standard Time) |
| 86ac6fp41 | Bioroots | 69970143000122 | 11191.00 |  | Tue Sep 30 2025 00:00:00 GMT-0300 (Brasilia Standard Time) |
| 86acnyr16 | Noova | 63262465000130 | 10297.00 | Arthur Zon | Mon Oct 20 2025 00:00:00 GMT-0300 (Brasilia Standard Time) |
| 86adjjk5n | Moulin- WellPet | 07335134000102 | 9997.00 | Arthur Zon | Fri Nov 28 2025 00:00:00 GMT-0300 (Brasilia Standard Time) |
| 86a5qd3v0 | Espanta Febre - Elevion | 24662773000100 | 9500.00 | João Guarçoni Duarte | Thu Dec 26 2024 00:00:00 GMT-0300 (Brasilia Standard Time) |
| 86acx4c9p | Emesa | 56958256000160 | 8997.00 | Fabio Richard  | Wed Oct 29 2025 00:00:00 GMT-0300 (Brasilia Standard Time) |

**CSV completo:** [csv/20-cup-ativo-sem-deal.csv](2026-04-15/csv/20-cup-ativo-sem-deal.csv) (322 linhas)

## 🔭 Cobertura de dado

### Categoria 21 — % de CNPJ preenchido por pipeline no Bitrix

**Problema:** Cobertura de CNPJ por pipeline. Smoking gun.

**Total:** 12 ocorrências

**Ação sugerida:** Bitrix admin: tornar CNPJ obrigatório.

**Top 10 piores:**

| category_id | category_name | total | com_cnpj | pct |
| --- | --- | --- | --- | --- |
| 4 | Inbound | 7793 | 0 | 0.0 |
| 2 | Outbound | 3487 | 966 | 27.7 |
| 0 | Geral | 2824 | 231 | 8.2 |
| 6 | Bot SDR | 1391 | 0 | 0.0 |
| 14 | BootCamps | 321 | 0 | 0.0 |
| 16 | Growth Master (Boot Performance) | 139 | 0 | 0.0 |
| 22 | Estruturação Comercial | 126 | 0 | 0.0 |
| 8 | Pós-Ganho | 103 | 0 | 0.0 |
| 14 | BootCamp Creators | 50 | 0 | 0.0 |
| 12 | Cross Sell e Upsell | 42 | 1 | 2.4 |

**CSV completo:** [csv/21-pct-cnpj-por-pipeline.csv](2026-04-15/csv/21-pct-cnpj-por-pipeline.csv) (12 linhas)

### Categoria 22 — % de stage_semantic preenchido por pipeline

**Problema:** Bug de ETL — campo deveria estar populado com S/F/P, mas está vazio em ~99,9% dos deals.

**Total:** 12 ocorrências

**Ação sugerida:** Tech: investigar ETL Bitrix.

**Top 10 piores:**

| category_id | category_name | total | com_semantic | pct |
| --- | --- | --- | --- | --- |
| 4 | Inbound | 7793 | 5 | 0.06 |
| 2 | Outbound | 3487 | 6 | 0.17 |
| 0 | Geral | 2824 | 6 | 0.21 |
| 6 | Bot SDR | 1391 | 0 | 0.00 |
| 14 | BootCamps | 321 | 0 | 0.00 |
| 16 | Growth Master (Boot Performance) | 139 | 0 | 0.00 |
| 22 | Estruturação Comercial | 126 | 0 | 0.00 |
| 8 | Pós-Ganho | 103 | 0 | 0.00 |
| 14 | BootCamp Creators | 50 | 0 | 0.00 |
| 12 | Cross Sell e Upsell | 42 | 0 | 0.00 |

**CSV completo:** [csv/22-pct-stage-semantic.csv](2026-04-15/csv/22-pct-stage-semantic.csv) (12 linhas)

### Categoria 23 — Top campos críticos vazios em cada sistema

**Problema:** Visão geral dos buracos de dado.

**Total:** 10 ocorrências

**Ação sugerida:** Cada área: priorizar preenchimento.

**Top 10 piores:**

| campo | vazios | total | pct_vazio |
| --- | --- | --- | --- |
| crm_deal.empresa | 16279 | 16279 | 100.0 |
| crm_deal.stage_semantic | 16262 | 16279 | 99.9 |
| crm_deal.cnpj | 15081 | 16279 | 92.6 |
| cup_contratos.valorr | 980 | 2417 | 40.5 |
| cup_clientes.vendedor | 135 | 1281 | 10.5 |
| cup_clientes.responsavel | 79 | 1281 | 6.2 |
| cup_clientes.cnpj | 2 | 1281 | 0.2 |
| cup_contratos.data_inicio | 0 | 2417 | 0.0 |
| caz_clientes.cnpj | 0 | 3131 | 0.0 |
| crm_deal.data_fechamento | 6 | 16279 | 0.0 |

**CSV completo:** [csv/23-campos-criticos-vazios.csv](2026-04-15/csv/23-campos-criticos-vazios.csv) (10 linhas)


## Próximos Passos Recomendados

Ordenado por ROI (impacto × facilidade de execução):

1. **[Cat 1] Deals ganhos sem CNPJ no Bitrix** — R$ 7.149.365,10 potencial. Comercial: preencher CNPJ retroativo nos deals listados. Curto prazo: tornar campo obrigatório nos stages de fechamento.
2. **[Cat 6] MRR contratado ≠ MRR cobrado (sub-cobrança)** — R$ 821.517,28 potencial. Financeiro: revisar contratos e ajustar valor cobrado.
3. **[Cat 7] Valor pontual no Bitrix sem parcela pontual no CAZ** — R$ 790.152,00 potencial. Financeiro: cobrar valor pontual retroativo.
4. **[Cat 9] Contratos encerrados com parcelas ainda abertas (risco jurídico)** — R$ 630.167,36 potencial. Financeiro: cancelar parcelas indevidas imediatamente.
5. **[Cat 10] Inadimplência pós-churn > 90 dias** — R$ 409.374,03 potencial. Financeiro: provisionar como perda ou negativar.
6. **[Cat 17] Cliente inativo no ClickUp ainda recebendo parcelas** — R$ 346.347,75 potencial. CS: validar e dar baixa correta.
7. **[Cat 5] Contratos ativos no ClickUp sem parcela recorrente nos últimos 60 dias** — R$ 133.684,00 potencial. Financeiro: investigar por que parou de gerar e regularizar.
8. **[Cat 4] Contratos ativos no ClickUp sem cliente no Conta Azul** — R$ 126.528,00 potencial. CS + Financeiro: validar e cadastrar.

## Sub-tasks de remediação sugeridas (não implementadas aqui)

- `[ETL]` Investigar por que `crm_deal.stage_semantic` está vazio em ~99,9% dos deals
- `[ETL]` Investigar por que `caz_parcelas.tipo_fatura` está 100% NULL
- `[DOC]` Atualizar `DATABASE.md` com colunas reais de `crm_deal`
- `[BITRIX]` Tornar CNPJ obrigatório nos stages de fechamento ("Negócio Ganho", "Negócios Fechados")
- `[BITRIX]` Preencher campo `empresa` nos deals para permitir routing por empresa
- `[ClickUp]` Validar CNPJ no momento de criação do cliente (módulo 11)

## Anexo — Limitações conhecidas

1. Estimativas são **teto** (worst case), não previsão. Cada caso precisa ser validado individualmente antes de virar cobrança real.
2. **Categoria 08 (reajustes) é exploratória** — pode vir com falsos positivos altos.
3. Comissionamento por venda errada **não está coberto** (fora de escopo).
4. **Cobrança paralela fora do CAZ** (Pix sem registro) não é detectável — pode aparecer aqui como falso positivo de vazamento.
5. **Pipelines do Bitrix além de 0 e 12** (BootCamps, Pós-Ganho, Outbound, Inbound) **não entram** no universo de "ganho" desta auditoria por decisão do escopo.
6. **Auditoria de despesas** (`tipo_evento='DESPESA'`) está fora — escopo é receita.
7. **Validação módulo 11 de CNPJ** na categoria 15 está em modo grosso (length+repetidos). Validação completa fica para evolução do script.

---

_Gerado por `scripts/auditoria-crm-erp.ts` em 2026-04-15T00:26:47.891Z._
