# Checklist de intake — documentos, prioridade e porquês

Regras de condução:
- Peça **um bloco por vez**, na ordem abaixo. Explique o porquê de cada item ao pedir.
- Nunca trave: item indisponível → status `a confirmar`, siga com o que tem, lacuna vai para a seção 9 do relatório.
- Mantenha `checklist.md` no diretório de trabalho com status por item: `recebido` / `pendente` / `a confirmar`.
- Formatos aceitos: XML (ideal p/ notas), PDF, CSV, XLSX, TXT (SPED). Extraia o que der; aponte o que não conseguiu ler.
- No ambiente Cortex: bloco 2 (faturamento) sai do banco (ver `cortex-db.md`) — peça só a confirmação.

## Bloco 1 — Cadastro e regime (sem isso não há análise)
| Item | Por quê |
|---|---|
| Contrato social / última alteração | Atividades reais, quadro societário (impedimentos ao Simples), capital |
| Cartão CNPJ de CADA entidade do grupo | CNAEs registrados × atividade real (eixo 7); matriz/filiais |
| Regime tributário atual de cada CNPJ | Define quais eixos se aplicam (créditos só no Real; Fator R só no Simples…) |
| Alíquota de ISS e município de cada sede | Denominador de qualquer comparação de regime |

## Bloco 2 — Faturamento
| Item | Por quê |
|---|---|
| Receita mensal últimos 12m, por CNPJ e por produto/atividade | RBT12 → faixa do Simples, Fator R, comparativo de regimes, segregação por anexo |

## Bloco 3 — Notas fiscais de saída (NF-e/NFS-e, preferir XML)
| Item | Por quê |
|---|---|
| XMLs (ou relatório) das notas emitidas 12m | Item da LC 116/NCM usado (eixo 7), retenções destacadas (eixo 5), destaque CBS/IBS 2026 (eixo 11), município de incidência do ISS (eixo 4) |

## Bloco 4 — Notas de entrada
| Item | Por quê |
|---|---|
| XMLs de compras/insumos/serviços tomados 12m | Mapa de créditos (eixo 3), CSTs errados, retenções feitas como tomador |

## Bloco 5 — Guias pagas
| Item | Por quê |
|---|---|
| DAS (Simples) ou DARFs (PIS/COFINS/IRPJ/CSLL/IRRF), GARE/GNRE (ICMS), guias de ISS — 12m+ | O que foi efetivamente pago × o que era devido = duplicidades e indébitos (eixos 4 e 10) |

## Bloco 6 — SPED e escrituração
| Item | Por quê |
|---|---|
| EFD-Contribuições (.txt) | Blocos A/C/F: créditos não escriturados (eixo 3) |
| EFD ICMS/IPI, ECD, ECF | Cruzamentos de consistência (eixo 12), CIAP, apurações |
| PGDAS-D (extratos) | Anexo aplicado, segregação de receitas, retenções informadas |
| Memórias de apuração mensais | Como o contador chega no número — onde mora o erro sistemático |

## Bloco 7 — Pessoal
| Item | Por quê |
|---|---|
| Folha resumida 12m (salários + encargos + FGTS) | Fator R (eixo 2), INSS patronal (eixo 9) |
| Pró-labore de cada sócio | Fator R + otimização pró-labore × lucros (eixo 9) |
| Contratos PJ (quantos, valores, escopo) | Risco de pejotização + custo de migração p/ CLT na conta do Fator R |
| Distribuição de lucros 12m | Limite de isenção, regra vigente de tributação de dividendos |

## Bloco 8 — Contábil
| Item | Por quê |
|---|---|
| Plano de contas + balancete/DRE 12m | Estrutura de custos p/ simular Lucro Real; despesas creditáveis (F100); margem real |

## Bloco 9 — Retenções (comprovantes)
| Item | Por quê |
|---|---|
| Informes de retenções sofridas (IRRF/CSRF/INSS/ISS) e DIRF/EFD-Reinf | Retido × compensado na apuração (eixo 5) — retenção não compensada é perda silenciosa |
| Retenções feitas como tomador | Passivo (não reteve o que devia) ou indébito (reteve o que não devia) |
