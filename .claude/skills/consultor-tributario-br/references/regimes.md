# Regimes tributários — Simples Nacional, Lucro Presumido, Lucro Real

Referência para os eixos 1 (regime ótimo), 2 (Fator R) e 9 (folha/pró-labore).
Valores vigentes na data de escrita (jul/2026) — confirmar vigência antes de afirmar em relatório.

## Simples Nacional (LC 123/2006, alterada pela LC 155/2016)

- **Teto:** R$ 4,8 mi de receita bruta em 12 meses (RBT12). Ultrapassou o teto em até 20% → exclusão no ano seguinte; acima de 20% → exclusão retroativa ao mês seguinte.
- **Sublimite:** R$ 3,6 mi. Acima dele, **ISS e ICMS saem do DAS** e passam a ser apurados por fora (regime normal), o que muda a conta do regime na faixa 3,6–4,8 mi.
- **Alíquota efetiva:** `(RBT12 × Alíq_nominal − Parcela_a_Deduzir) / RBT12`, aplicada sobre a receita do mês.
- **Distribuição de lucros:** isenta de IRPF até o limite da presunção (32%/8% etc. sobre a receita, menos o IRPJ devido), salvo se houver contabilidade completa demonstrando lucro maior (aí o lucro contábil inteiro pode ser distribuído isento) — art. 14 LC 123.

### Tabelas (6 faixas de RBT12, iguais para todos os anexos)

Faixas: 1ª até 180.000 · 2ª 180.000,01–360.000 · 3ª 360.000,01–720.000 · 4ª 720.000,01–1.800.000 · 5ª 1.800.000,01–3.600.000 · 6ª 3.600.000,01–4.800.000

**Anexo I — Comércio** (alíquota nominal | parcela a deduzir)
| Faixa | Nominal | PD (R$) |
|---|---|---|
| 1ª | 4,00% | 0 |
| 2ª | 7,30% | 5.940 |
| 3ª | 9,50% | 13.860 |
| 4ª | 10,70% | 22.500 |
| 5ª | 14,30% | 87.300 |
| 6ª | 19,00% | 378.000 |

**Anexo II — Indústria**
| Faixa | Nominal | PD (R$) |
|---|---|---|
| 1ª | 4,50% | 0 |
| 2ª | 7,80% | 5.940 |
| 3ª | 10,00% | 13.860 |
| 4ª | 11,20% | 22.500 |
| 5ª | 14,70% | 85.500 |
| 6ª | 30,00% | 720.000 |

**Anexo III — Serviços "leves"** (e serviços do Anexo V quando Fator R ≥ 28%)
| Faixa | Nominal | PD (R$) |
|---|---|---|
| 1ª | 6,00% | 0 |
| 2ª | 11,20% | 9.360 |
| 3ª | 13,50% | 17.640 |
| 4ª | 16,00% | 35.640 |
| 5ª | 21,00% | 125.640 |
| 6ª | 33,00% | 648.000 |

**Anexo IV — Construção, limpeza, vigilância, advocacia** (CPP/INSS patronal fica FORA do DAS)
| Faixa | Nominal | PD (R$) |
|---|---|---|
| 1ª | 4,50% | 0 |
| 2ª | 9,00% | 8.100 |
| 3ª | 10,20% | 12.420 |
| 4ª | 14,00% | 39.780 |
| 5ª | 22,00% | 183.780 |
| 6ª | 33,00% | 828.000 |

**Anexo V — Serviços "intelectuais"** (quando Fator R < 28%)
| Faixa | Nominal | PD (R$) |
|---|---|---|
| 1ª | 15,50% | 0 |
| 2ª | 18,00% | 4.500 |
| 3ª | 19,50% | 9.900 |
| 4ª | 20,50% | 17.100 |
| 5ª | 23,00% | 62.100 |
| 6ª | 30,50% | 540.000 |

### Fator R (LC 123, art. 18, §§ 5º-J e 5º-M)

`Fator R = Folha de salários 12m / RBT12`

- **Folha inclui:** salários CLT, encargos (INSS patronal recolhido), FGTS e **pró-labore**. **NÃO inclui pagamento a PJ** nem distribuição de lucros.
- **≥ 28%** → atividades do Anexo V são tributadas pelo **Anexo III**.
- Atividades sujeitas ao Fator R (V↔III): consultoria, publicidade/marketing, tecnologia/desenvolvimento, engenharia, auditoria, economia, medicina, jornalismo, academias (algumas), clínicas, fisioterapia, intermediação de negócios etc.
- Atividades **sempre Anexo III** (independem de Fator R): manutenção/reparos, agências de viagem, escritórios contábeis, laboratórios, transporte municipal, **produções cinematográficas, audiovisuais, artísticas e culturais** (art. 18, §5º-B, IX) — relevante para produção de conteúdo.
- **Armadilha do pró-labore:** subir pró-labore para atingir 28% gera IRPF (tabela progressiva, até 27,5%) + INSS 11% do sócio (até o teto) + 20% patronal? — no Simples (exceto Anexo IV) a CPP está dentro do DAS, então o custo marginal é IRPF + INSS segurado. Simule com `calc-regimes.ts` os dois cenários antes de recomendar.
- **Segregação por atividade:** cada receita é tributada pelo anexo da SUA atividade (PGDAS-D permite segregar). Receita classificada no anexo errado nos últimos 5 anos → retificar PGDAS-D + restituição eletrônica no e-CAC.

### Impedimentos ao Simples (checar sempre)
Sócio PJ, sócio domiciliado no exterior, participação do titular em outra empresa com receita global > teto, atividades vedadas (financeiras etc.), débitos sem exigibilidade suspensa.

## Lucro Presumido (RIR/2018; Lei 9.249/1995 arts. 15 e 20)

- **Elegibilidade:** receita até R$ 78 mi/ano.
- **Base presumida IRPJ:** 8% (comércio/indústria), 32% (serviços em geral), 16% (transporte de passageiros), 1,6% (revenda de combustíveis). Serviços com receita anual ≤ R$ 120 mil (exceto profissão regulamentada) podem usar 16%.
- **Base presumida CSLL:** 12% (comércio) / 32% (serviços).
- **IRPJ:** 15% sobre a base + **adicional de 10%** sobre o que exceder R$ 60 mil/trimestre (R$ 20 mil/mês).
- **CSLL:** 9% sobre a base.
- **PIS/COFINS cumulativos:** 0,65% + 3,00% = **3,65%** sobre a receita, **sem créditos**.
- **ISS:** por fora, 2%–5% conforme município e item da LC 116.
- **INSS patronal:** por fora — 20% (empresa) + RAT 1–3% + terceiros ~5,8% sobre folha CLT; 20% sobre pró-labore.
- **Distribuição de lucros:** isenta de IRPF na pessoa física (confirmar vigência — reforma do IR pode ter alterado; ver eixo 11/notícias).
- Carga típica serviços (sem ISS): 3,65% + IRPJ ~4,8%+adicional + CSLL 2,88% ≈ **11,3%–14,5%** + ISS.

## Lucro Real (obrigatório > R$ 78 mi ou atividades específicas)

- **IRPJ/CSLL** sobre lucro contábil ajustado (adições/exclusões): 15% + adicional 10% / 9%.
- **PIS/COFINS não cumulativos:** 1,65% + 7,6% = **9,25%** sobre receita, **com créditos** (ver `creditos.md`). É o único regime com créditos de PIS/COFINS.
- **Prejuízo fiscal:** compensável com lucros futuros, trava de 30% do lucro do período.
- **JCP (juros sobre capital próprio):** dedutível — confirmar vigência (houve propostas de extinção).
- Vale a pena quando: margem apertada ou prejuízo, muitos custos creditáveis, ou benefícios (Lei do Bem exige Real).

## Heurística de comparação (validar sempre com calc-regimes.ts)

| Perfil | Tendência |
|---|---|
| Serviços, folha ≥ 28% da receita | Simples Anexo III costuma ganhar |
| Serviços, folha baixa (muitos PJs) | Anexo V ~15,5–21% → Presumido costuma empatar ou ganhar (11–19% c/ ISS + INSS patronal baixo) |
| Margem líquida < ~32% (serviços) | Real pode bater Presumido |
| RBT12 entre 3,6 e 4,8 mi | Simples perde atratividade (sublimite: ISS/ICMS por fora) |
| Exportação de serviços | PIS/COFINS/ISS podem ter tratamento favorecido fora do Simples |
