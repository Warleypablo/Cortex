# Contexto do grupo (Turbo) — ponto de partida do intake

Arquivo específico deste ambiente (remover ao distribuir a skill). Dados observados no banco
em jul/2026 — **confirmar tudo no intake**; isto acelera a Fase 1, não a substitui.

## Entidades (campo `empresa` em "Conta Azul".caz_parcelas)

| Entidade | Observações |
|---|---|
| **TURBO PARTNERS** | Principal; receita ~R$ 1,0–1,4 mi/mês (2026). Serviços de marketing/growth. Regime: a confirmar |
| **TURBO FILIAL** | Empresa nova, fatura desde jun/2026 (~R$ 565 mil no 1º mês). CNPJ/regime: a confirmar. Gotcha: NÃO aparece em caz_receber, e caz_bancos cria contas-fantasma dela (ver cortex-db.md) |
| **PEIXOTO DEBBANE** | ~R$ 80–250 mil/mês. Atividade/relação societária: a confirmar |

## Modelo de negócio

- **Serviços recorrentes (MRR)** + **entregas pontuais**; contratos no ClickUp (`valorr` recorrente, `valorp` pontual).
- **Produtos** (campo `produto` em cup_contratos): Performance, Social Media, Creators, SEO Full, Site/Landing Page, Ecommerce, CRO, Consultoria de Performance, Estruturação Comercial/Estratégica, CRM de Vendas, Agente IA, Dashboard, Gestão de Comunidade, Account Management, TikTok Shop, entre outros.
- Serviços intelectuais de marketing/publicidade/consultoria → no Simples cairiam tipicamente no **Anexo V com Fator R** (eixo 2 é central). Produção de conteúdo/audiovisual pode ser Anexo III direto (art. 18, §5º-B, IX) — investigar a natureza real de cada produto.
- **Contratação PJ relevante** (creators, operadores) → Fator R baixo + risco de pejotização (eixo 9).
- **Time de aquisição compartilhado** entre produtos/entidades → atenção a rateio de despesas entre CNPJs (dedutibilidade, preços entre partes relacionadas, selo MODERADO em rearranjos).

## Perguntas de intake específicas do grupo

1. Regime tributário e CNAEs de cada um dos 3 CNPJs?
2. Por que a TURBO FILIAL foi criada (segregação de atividade? benefício? limite de regime?) — a resposta define riscos e oportunidades de reorganização.
3. Serviços entre empresas do grupo são faturados? Como (nota, contrato, preço)?
4. Onde estão os PJs contratados (qual CNPJ paga) e qual o gasto mensal total com PJ?
5. Municípios de sede das 3 entidades e alíquotas de ISS.
