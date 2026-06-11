# BP 2026 — Orçado × Realizado (Parte 10: sub-aba Capacity)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Partes 7–9 (branch `feature/bp2026-metricas-gerais`, PR #248). Quinta sub-aba.

## Escopo

Sub-aba **"Capacity"** espelhando os blocos de dimensionamento da aba CSV da planilha (Gestores de Performance e Designers), 9 linhas:

| Linha | metrica | Unidade | Direção | Realizado |
|---|---|---|---|---|
| Contratos Performance (**destaque**) | `cap_contratos_performance` | int | maior | reuso da série `contratos_performance` (snapshot por produto, Parte 8) |
| Gestores necessários | `gestores_necessarios` | dec | neutro | contratos reais ÷ capacity orçada do mês (linha 13, =12) |
| Gestores atuais | `gestores_atuais` | int | neutro | Inhire `TRIM(cargo)='Gestor de Performance'` ativos no fim do mês |
| Necessidade de contratar (gestores) | `necessidade_gestores` | dec | neutro | necessários − atuais (negativo = folga); orçado derivado: orc necessários − orc atuais |
| Contratos por gestor | `contratos_por_gestor` | dec | neutro (nota) | contratos reais ÷ gestores atuais reais |
| Designers necessários | `designers_necessarios` | dec | neutro | contratos ÷ capacity designers orçada (linha 55, =26) |
| Designers atuais | `designers_atuais` | int | neutro (nota) | Inhire `TRIM(cargo)='Designer'` |
| Contas por designer | `contas_por_designer` | dec | neutro | contratos ÷ designers atuais |

(8 linhas exibidas + a de contratos = 9. "Necessidade de contratar" não existe como linha seedada — derivada nas duas pontas.)

Notas: contratos_por_gestor — "Capacity planejada: 12 contratos/gestor. Acima do orçado = eficiência, mas risco de churn por sobrecarga."; designers_atuais — "Conta todos com cargo Designer no Inhire — pode incluir designers fora da operação de Performance."

## Decisões
- **Unidade nova `dec`** (1 casa decimal) em `fmtValor` — necessários/razões são fracionários.
- Capacities seedadas como métricas (`capacity_gestores`, `capacity_designers`) e usadas como divisor — sem hardcode de 12/26.
- A série de contratos Performance flui do `montarRevenue` para o handler (o módulo passa a retornar `{ linhas, contratosPerformancePorMes }` OU o handler extrai da linha `contratos_performance` do retorno — decisão de implementação: **extrair da linha retornada** (`revenue.find(l => l.metrica === 'contratos_performance').meses`), zero mudança no módulo revenue).
- Direções neutras (dimensionamento não é bom/ruim linear); contratos = maior_melhor.

## Seed
+8 métricas da aba CSV, `col_inicial=4` (D..O = jan..dez): linhas 13→capacity_gestores, 14→gestores_necessarios, 15→gestores_atuais, 17→contratos_por_gestor, 55→capacity_designers, 56→designers_necessarios, 57→designers_atuais, 59→contas_por_designer. Anti-drift (extraído 2026-06-10): 144.0 / 217.017081 / 258.0 / 121.090493 / 312.0 / 100.16173 / 281.36058 (designers_atuais 111.0). Total: 64 métricas.

## API
`server/routes/bp2026.capacity.ts` (padrão dos módulos 7–9): `montarCapacity({db, orcado, contratosPerformance, mesCorrente, mesFechado})`:
- 1 query Inhire (generate_series 1..12, COUNT FILTER por cargo: 'Gestor de Performance', 'Designer', fim do mês — mesmo padrão da query de pessoas da Parte 7).
- Derivadas null-safe: necessários = contratos ÷ capacity_orc; razões = contratos ÷ atuais; necessidade = necessários − atuais.
- YTDs: posições (estoque) para contratos/atuais; razões recalculadas na posição do mês fechado; necessidade idem.
- Payload: `capacity: LinhaReceita[]`; 5ª tab "Capacity".

## Erros e casos-limite
- Atuais 0 → razões null; capacity orçada 0 → necessários null; meses futuros null; mês corrente posição atual.

## Workflow
Mesma branch/PR #248; subagent-driven com revisão; visual dark/light.
