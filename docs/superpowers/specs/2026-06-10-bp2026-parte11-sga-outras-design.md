# BP 2026 — Orçado × Realizado (Parte 11: sub-abas SG&A e Outras Receitas)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Partes 7–10 (branch `feature/bp2026-metricas-gerais`, PR #248). Sexta e sétima sub-abas.

## Escopo

Duas sub-abas pequenas espelhando os detalhamentos da planilha.

### Sub-aba "SG&A" (9 linhas)

| Linha | metrica | Orçado (aba SG&A, col C..N) | Realizado (caixa, mesmo regime do DRE) |
|---|---|---|---|
| SG&A total (**destaque**) | `sga_total_detalhe` | derivado: soma das 8 sub-linhas | derivado: soma das 8 |
| UZK | `sga_uzk` | linha 7 | `06.09%` (Pro-labore) |
| Backoffice | `sga_backoffice` | linha 8 | `06.08%` (Financeiro/Dados/G&G/Jurídico) |
| Software | `sga_software` | linha 9 | `06.10.01%` (Softwares Gerencial) |
| Ocupação | `sga_ocupacao` | linha 10 | `06.02%` |
| Benefício Caju | — (reuso `beneficio_total_empresa`) | linha 11 (já seedada na P7) | `06.10.04%` (TOTAL, sem rateio) |
| Premiações | `sga_premiacoes` | linha 12 | `06.10.08%` (Uniformes, Brindes e Premiações) |
| Eventos e Brindes Internos | `sga_eventos` | linha 13 | `06.10.06%` (Confraternizações) |
| Outras despesas | `sga_outras` | linha 14 | `06.01% / 06.03% / 06.10.02% / 06.10.03% / 06.10.07%` |

Todas `menor_melhor`, unidade brl, fluxo. **NOTA no total** (obrigatória): "Visão da aba SG&A da planilha — difere da linha SG&A do DRE: aqui o Caju entra integral (no DRE é rateado com CSV) e Software entra aqui (no DRE está em CSV Stack)." Notas de aproximação: Premiações ("a categoria inclui uniformes e brindes") e Eventos ("mapeado para Confraternizações").

Validação executada (prod, total 2026 por categoria): 06.09 → 496.842; 06.08 → 195.574; 06.10.01 → 221.064; 06.02 → 250.528; 06.10.04 → 327.620; 06.10.08 → 54.232; 06.10.06 → 33.351; resto → ~139.6k. Sanity planilha: soma das 8 sub-linhas jan = 298.446 = B6 exato.

### Sub-aba "Outras Receitas" (4 linhas)

| Linha | metrica | Orçado | Realizado (competência, mesmo regime do DRE) |
|---|---|---|---|
| Outras Receitas total (**destaque**) | `or_total_detalhe` | derivado: soma das 3 | derivado: soma das 3 |
| Receita Variável | `or_receita_variavel` | aba Outras Receitas linha 3 | `03.02%` (Variáveis e Rebates) |
| Stack Digital | `or_stack_digital` | linha 7 | `03.03%` (Yampi/Shopify/Funnels) |
| Demais (Mentoria, Infoproduto, Turbooh…) | `or_demais` | derivado: `outras_receitas` (Overview) − variável − stack | `04.01% / 04.03%` |

Todas `maior_melhor`, brl, fluxo. **Invariante: soma das 3 = célula Outras Receitas do DRE por construção** (mesmos predicados, mesmo regime). Nota em Demais: "Mentoria, Infoproduto e Turbooh não têm categorias próprias no Conta Azul — agrupados com rendimentos e demais receitas (04.x)."

## Seed
+9 métricas: `sga_uzk` (960000), `sga_backoffice` (616000), `sga_software` (565344), `sga_ocupacao` (404840), `sga_premiacoes` (60000), `sga_eventos` (180000), `sga_outras` (213032) — aba "SG&A", linhas 7-14 exceto 11, col default 3; `or_receita_variavel` (120000), `or_stack_digital` (78000) — aba "Outras Receitas", linhas 3 e 7, col default 3. Total: 73 métricas. (Caju orçado reusa `beneficio_total_empresa`, soma 736000, já seedada.)

## API
- `bp2026.predicados.ts`: +8 predicados de sub-linha (sga_uzk, sga_backoffice, sga_software, sga_ocupacao, sga_premiacoes, sga_eventos, sga_outras_sub; or_variavel = `03.02%`, or_stack = `03.03%`, or_demais = `04.01% OR 04.03%`) — derivados dos existentes, sem alterar os do DRE.
- `server/routes/bp2026.detalhamentos.ts` (novo): `montarDetalhamentos({db, orcado, mesCorrente, mesFechado})` → `{ sga: Linha[], outrasReceitas: Linha[] }`.
  - SG&A: 8 chamadas a `somaDespesaCaixaPorMes` (helper já existente em bp2026.ts — exportar) com os predicados novos; total = soma.
  - Outras: 1 query por competência com 3 agregações condicionais (mesma forma da query de outras receitas do DRE — replicar regime exato).
  - YTDs: fluxo (soma) em tudo, via `calcYtd`.
- Payload: `sgaDetalhe` e `outrasDetalhe`; 6ª tab "SG&A" e 7ª "Outras Receitas" (sem onCellClick).

## Erros e casos-limite
Padrão das partes anteriores: meses futuros null; mês corrente parcial `?? 0`; mesFechado 0 → YTD null.

## Workflow
Mesma branch/PR #248; subagent-driven com revisão; visual dark/light.
