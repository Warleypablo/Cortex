# Skill `consultor-tributario-br` — Design

**Data:** 2026-07-02
**Status:** Aprovado (intake + design validados com o usuário)

## Objetivo

Skill do Claude Code que atua como consultor tributário/contábil especialista em
legislação brasileira. Audita a operação do grupo (multi-CNPJ, multi-produto) para
encontrar onde há pagamento de imposto a mais — isenções não aproveitadas,
bitributação, créditos não recuperados, regime subótimo, retenções erradas — e
gera relatório contábil completo com plano de ação para redução **lícita** da
carga tributária (só elisão, nunca evasão).

## Decisões de intake (aprovadas)

1. **Fonte de dados:** banco Cortex como fonte de primeira classe (somente
   leitura) para faturamento/receita; documentos enviados pelo usuário para o que
   o banco não tem (guias, SPED, XMLs, folha, contratos).
2. **Portabilidade:** corpo da skill genérico; contexto da Turbo isolado em
   `references/contexto-empresa.md` e `references/cortex-db.md` (remover esses 2
   arquivos = skill distribuível).
3. **Instalação:** `/Users/mac0267/Cortex/.claude/skills/consultor-tributario-br/`
   (versionada no git) + `.zip` empacotado ao final.
4. **Entregáveis e insumos:** SEMPRE em `~/Documents/Tributario/<competencia>/`,
   fora do repo (git-autopush automático + histórico já precisou de limpeza por
   CSV sensível). A skill proíbe copiar documento fiscal para o working tree.
5. **Cálculos:** calculadora determinística `scripts/calc-regimes.ts` (npx tsx);
   o modelo interpreta e monta cenários, o script faz a aritmética progressiva.

## Estrutura de arquivos

```
.claude/skills/consultor-tributario-br/
├── SKILL.md                  # fluxo das 3 fases + salvaguardas + navegação
├── references/
│   ├── regimes.md            # Simples (anexos I–V, tabelas, Fator R, sublimite 4,8mi), Presumido, Real
│   ├── creditos.md           # PIS/COFINS não cumulativo, ICMS/CIAP, IPI, ICMS-ST (ressarcimento)
│   ├── retencoes.md          # IRRF, CSRF 4,65%, INSS, ISS (LC 116, local de incidência)
│   ├── reforma-2026.md       # cronograma CBS/IBS 2026–2033, alíquota-teste 0,9%+0,1%, dupla conformidade, Simples 2027+
│   ├── checklist-intake.md   # documentos por prioridade + por que cada um
│   ├── contexto-empresa.md   # perfil do grupo Turbo (CNPJs, produtos, PJs, aquisição compartilhada)
│   └── cortex-db.md          # queries somente-leitura prontas + gotchas do banco
├── scripts/
│   └── calc-regimes.ts       # calculadora determinística: JSON in → comparativo 3 regimes + memória de cálculo
└── assets/
    └── template-relatorio.md # template fixo do relatório (10 seções)
```

## Comportamento

### Fase 1 — Triagem e coleta
- Interativa: pede insumos um bloco por vez, começando pelo mais importante,
  explicando **por que** precisa de cada item. Não trava se faltar algo — marca
  "a confirmar" e segue.
- Antes de pedir planilha de faturamento, oferece puxar do banco Cortex
  (SELECT only): receita por CNPJ/produto/mês via `caz_vendas` (histórico,
  emitido) e `caz_parcelas` (caixa, desde set/2025).
- Mantém checklist de documentos com status: recebido / pendente / a confirmar.
- Aceita XML, PDF, CSV, planilhas. Prioridade: cadastro e regime → faturamento →
  NF saída → NF entrada → guias pagas → SPED → pessoal/PJ → contábil → retenções.

### Fase 2 — Análise (12 eixos)
Formato fixo por achado: **situação atual → oportunidade → base legal
(lei/artigo/IN) → estimativa de impacto em R$ → nível de risco → ação**.

1. Regime tributário ótimo (recalcular nos 3 regimes via calc-regimes.ts;
   sublimite do Simples R$ 4,8 mi e efeitos ICMS/ISS)
2. Fator R e enquadramento de atividade (folha ≥ 28% → Anexo V→III)
3. Créditos não aproveitados (PIS/COFINS não cumulativo, ICMS/CIAP, IPI, CBS/IBS)
4. Bitributação / duplicidade (ISS prestador×tomador, retenção dupla, ST
   retributado, PIS/COFINS sobre receita não tributável)
5. Retenções na fonte (IRRF, CSRF 4,65%, INSS, ISS; retenções a compensar)
6. Isenções/benefícios não aproveitados (alíquota zero por NCM, incentivos
   setoriais/regionais — sempre confirmar vigência via WebSearch)
7. Enquadramento fiscal (NCM, item LC 116/2003, CNAE, CST/CSOSN)
8. ICMS-ST (ressarcimento/restituição/complemento base presumida × real)
9. Folha e PJ (INSS patronal, risco de reclassificação de vínculo,
   pró-labore × distribuição de lucros)
10. Recuperação retroativa 5 anos (PER/DCOMP, prescrição)
11. Reforma Tributária 2026–2033 (obrigatório: alíquota-teste CBS 0,9% + IBS
    0,1% compensável com PIS/COFINS, destaque em nota, obrigações acessórias,
    créditos financeiros do IVA dual, dupla conformidade, decisão Simples 2027+)
12. Consistência das obrigações acessórias (notas × apurações × SPED × guias)

### Fase 3 — Relatório
- Markdown no template fixo de 10 seções (assets/template-relatorio.md);
  conversão a PDF via Chromium headless/Playwright quando disponível.
- Toda estimativa em R$ com memória de cálculo e premissas (Anexo 10).
- Salvo em `~/Documents/Tributario/<competencia>/`.

Template (estrutura fixa): 1. Sumário executivo (economia potencial R$/ano e %,
top 5 achados, confiança/risco global) · 2. Perfil da operação · 3. Diagnóstico
por eixo · 4. Bitributação e duplicidades · 5. Créditos e recuperáveis (5 anos) ·
6. Comparativo de regime · 7. Reforma Tributária · 8. Plano de ação priorizado
(quick wins × estruturais, matriz esforço×retorno, responsável, prazo) ·
9. Ressalvas e limitações · 10. Anexos (memórias de cálculo).

## Calculadora (`scripts/calc-regimes.ts`)

- Input: JSON com receita 12m (RBT12) por atividade/anexo, folha 12m (incl.
  pró-labore), custos creditáveis, despesas, ISS/ICMS aplicáveis.
- Output: alíquota efetiva por anexo do Simples (fórmula (RBT12×Aliq−PD)/RBT12),
  Fator R (com e sem), verificação de sublimite, Lucro Presumido (bases 8%/12%/32%,
  PIS/COFINS cumulativo 3,65%), Lucro Real estimado (IRPJ 15%+10% adicional,
  CSLL 9%, PIS/COFINS não cumulativo 9,25% com créditos) — com memória de cálculo
  linha a linha.
- Executável via `npx tsx` (repo já tem tsx). Sem dependências novas.

## Salvaguardas (dentro do SKILL.md)

- **Só elisão lícita** — nunca sonegação, nota fria, simulação; distinguir
  elisão × evasão explicitamente.
- **Base legal obrigatória** — sem base sólida, marcar "a confirmar com o contador".
- **Selo de risco por recomendação**: planejamento seguro / moderado /
  agressivo-litigioso.
- **Não substitui profissional** — abre e fecha com aviso; validar com contador/
  advogado tributarista; checar vigência via WebSearch antes de afirmar.
- **Conservadorismo** — estimativas em faixa (mín–máx) quando houver incerteza.
- **Dados sensíveis** — insumos/relatórios só em `~/Documents/Tributario/`;
  nunca copiar documento fiscal para o repo; banco só leitura.

## Frontmatter (description)

Gatilhos abrangentes (a skill costuma subtriggerar): tributos, impostos, notas
fiscais, DAS, DARF, SPED, Simples Nacional, Lucro Presumido, Lucro Real, ICMS,
ISS, PIS, COFINS, IRPJ, CSLL, créditos tributários, retenções, Reforma
Tributária, CBS, IBS, redução de carga tributária, auditoria fiscal, elisão,
recuperação de impostos, PER/DCOMP, Fator R, bitributação.

## Testes de aceite

1. "Estou no Simples, faturei R$ 3,2 mi no ano dividido em dois produtos, tenho
   6 PJs. Onde estou pagando imposto a mais?" → deve acionar Fator R, comparativo
   de regimes, risco de reclassificação PJ, e pedir os documentos certos.
2. "Aqui está meu EFD-Contribuições e as notas de entrada — quais créditos de
   PIS/COFINS eu não estou aproveitando?" → eixo 3, com base legal por crédito.
3. "Faço serviço para clientes em três estados e desconfio que estou pagando ISS
   em duplicidade." → eixo 4, LC 116 art. 3º (local de incidência), retenções.

Rodar os 3 via subagente, apresentar resultados ao usuário, iterar, empacotar
`.zip`.

## Fora de escopo

- Parsers programáticos de XML NF-e/SPED (o modelo lê e extrai; máquina completa
  fica para uma v2 se necessário).
- Integração com e-CAC/Receita Federal.
- Escrita em qualquer tabela do banco.
