# Créditos tributários — PIS/COFINS, ICMS, IPI, ICMS-ST

Referência para os eixos 3 (créditos não aproveitados), 4 (duplicidade) e 8 (ICMS-ST).

## PIS/COFINS não cumulativo (Lei 10.637/2002 e Lei 10.833/2003, art. 3º)

**Só existe no Lucro Real.** Alíquotas 1,65% + 7,6%; créditos calculados às mesmas alíquotas sobre:

| Crédito | Base legal / nota |
|---|---|
| **Insumos** | Art. 3º, II — conceito definido pelo STJ no **REsp 1.221.170/PR** (repetitivo, 2018): critério da **essencialidade ou relevância** para a atividade. Para prestadoras de serviço: tudo essencial à execução do serviço (softwares operacionais, dados, terceirizados aplicados na entrega — PJ que executa parte do serviço é discussão de insumo, selo MODERADO) |
| **Energia elétrica** | Art. 3º, III — integral, qualquer atividade |
| **Aluguéis de prédios, máquinas e equipamentos pagos a PJ** | Art. 3º, IV — vedado se o bem já pertenceu à empresa |
| **Arrendamento mercantil (leasing)** | Art. 3º, V |
| **Depreciação de máquinas/equipamentos e edificações** | Art. 3º, VI–VII. Máquinas novas: crédito **imediato/integral** no mês da aquisição (Lei 11.774/2008, art. 1º, XII — aquisições desde jul/2012). Muita empresa ainda usa 1/48 ou não toma |
| **Frete na operação de venda** (suportado pelo vendedor) e armazenagem | Art. 3º, IX |
| **Frete/seguro na compra** | Compõe custo de aquisição do bem creditável |
| **Devoluções de venda** | Art. 3º, VIII |
| **PIS/COFINS-Importação** | Lei 10.865/2004, art. 15 |
| **Créditos extemporâneos** | Últimos **5 anos**, via retificação da EFD-Contribuições (sem correção Selic na via administrativa de aproveitamento; restituição via PER/DCOMP tem Selic) |

**Onde procurar na EFD-Contribuições:**
- **Bloco C** (notas de entrada): CSTs 70/71/72/73/74/75/98/99 (sem crédito) em itens que deveriam ser 50–56 (com crédito) — erro de parametrização de ERP é a fonte nº 1.
- **Bloco A** (serviços tomados): serviços creditáveis não escriturados.
- **Registros F100/F120/F130**: energia, aluguéis, leasing, depreciação — se estão vazios/magros, há dinheiro na mesa.
- **Bloco D**: fretes (CT-e).

**Vedações (não deixar o usuário criar passivo):** mão de obra paga a pessoa física (art. 3º, §2º, I); bens/serviços com alíquota zero na aquisição; **revenda de monofásicos** (combustíveis, fármacos, cosméticos, autopeças, bebidas frias — a revenda não gera crédito, e tomar crédito aqui é autuação certa). Sempre rodar o check inverso: créditos tomados indevidamente.

**Receitas com alíquota zero/monofásicas na saída:** verificar por NCM se produtos vendidos têm alíquota zero de PIS/COFINS (ex.: cesta básica, livros) ou são monofásicos — pagar 9,25% sobre receita monofásica já tributada na indústria é duplicidade clássica do varejo/distribuição.

## ICMS (LC 87/1996 — Lei Kandir)

| Crédito | Nota |
|---|---|
| Entradas de mercadorias/insumos | Regra geral, art. 20 |
| **Ativo imobilizado (CIAP)** | 1/48 por mês, proporcional às saídas tributadas (art. 20, §5º) |
| **Energia elétrica** | Só quando consumida no processo industrial, ou proporcional à exportação (art. 33, II) — prorrogações sucessivas para uso geral; confirmar redação vigente |
| Comunicação | Restrito (art. 33, IV) — confirmar vigência |
| **Crédito acumulado de exportação** | Imunidade na saída + manutenção do crédito das entradas (art. 21, §2º) — pode ser transferível conforme UF |

**ICMS-ST — recuperação (eixo 8):**
- **RE 593.849/MG (Tema 201, STF, 2016):** contribuinte substituído tem direito à **restituição do ICMS-ST pago a maior quando a base de cálculo efetiva da operação for inferior à presumida** (venda real < MVA presumida). Estados regulamentaram procedimentos próprios (ex.: SP Portaria CAT; MG e-Ressarcimento) — verificar UF.
- O inverso também vale em vários estados: **complemento** quando vender acima da base presumida — mapear o risco junto com a oportunidade.
- Duplicidade clássica: mercadoria com ST já recolhido sendo tributada de novo na saída (CFOP/CST errados — saída de ST é CST 60/CSOSN 500).
- Varejista do **Simples** que revende itens com ST: a receita dessas revendas deve ser **segregada no PGDAS-D** como "com substituição tributária" para não pagar ICMS de novo dentro do DAS — erro muito comum.

## IPI

Não cumulativo por natureza (CF art. 153, §3º, II): crédito das entradas de insumos industrializados. Só relevante para indústria/equiparados. Exportação: crédito presumido de IPI como ressarcimento de PIS/COFINS (Lei 9.363/1996), quando aplicável.

## CBS/IBS (a partir da transição — ver reforma-2026.md)

O IVA dual adota **crédito financeiro amplo**: praticamente toda aquisição com CBS/IBS destacado gera crédito (exceções: uso e consumo pessoal). Em 2026 (ano-teste) os valores são informativos; a partir de 2027 (CBS) o mapa de créditos muda completamente — despesas hoje sem crédito de PIS/COFINS (ex.: serviços administrativos no cumulativo) passam a gerar crédito. Mapear por produto/linha de despesa no eixo 11.

## Recuperação retroativa (eixo 10)

- **Prazo:** 5 anos do pagamento indevido (CTN art. 168).
- **Vias:** retificação da obrigação (EFD/PGDAS-D/DCTF) + **PER/DCOMP** (restituição ou compensação) para tributos federais; pedido administrativo próprio para ICMS (UF) e ISS (município).
- Compensação de tributo federal só com débitos federais (Lei 9.430, art. 74); vedações do art. 74, §3º (ex.: estimativas).
- Retificação malfeita = malha/autuação → recomendação sempre com selo e validação do contador.
