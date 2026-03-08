# Design: Relatórios Jurídicos — Dashboard + Export PDF

**Data:** 2026-03-08
**Status:** Aprovado

## Contexto

A advogada precisa frequentemente gerar relatórios para a diretoria sobre o status jurídico da empresa. Hoje isso é feito manualmente. A solução cria uma página dedicada com dashboard interativo (self-service) + export PDF para compartilhar em reuniões.

## Decisões

- **Página nova:** `/juridico/relatorios` com permissão `jur.relatorios`
- **PDF client-side:** jsPDF + html2canvas (já instalados no projeto)
- **Endpoint agregado:** Um endpoint que consolida dados de múltiplas tabelas
- **4 abas:** Resumo Executivo, Inadimplência, Processos, Contratos

## Estrutura de Abas

### Aba 1 — Resumo Executivo
- Seletor de período (mês/ano)
- KPIs: Total inadimplentes, Valor em risco, Acordos no mês, Taxa recuperação (%), Processos ativos, Valor em processos
- Gráfico: Evolução mensal inadimplência (valor + qty)
- Gráfico: Distribuição por procedimento (pie)
- Gráfico: Funil de recuperação
- Botão "Exportar PDF"

### Aba 2 — Inadimplência Detalhada
- Tabela: Cliente, CNPJ, Valor, Dias atraso, Procedimento, Status
- Filtros: procedimento, status, faixa de valor
- Totalizadores no rodapé
- Botão "Exportar PDF"

### Aba 3 — Processos Judiciais
- KPIs: Total, Ativos, Valor risco, Encerrados no período
- Tabela: CNJ, Cliente, Natureza, Status, Comarca, Valor
- Gráficos: Natureza e Status distribution
- Botão "Exportar PDF"

### Aba 4 — Contratos
- KPIs: Contratos ativos, Vencendo em 30/60/90 dias
- Tabela: Contratos próximos do vencimento
- Botão "Exportar PDF"

## Endpoint

```
GET /api/juridico/relatorios?tipo=resumo|inadimplencia|processos|contratos&periodo=2026-03
```

Agrega dados de: `juridico_clientes`, `juridico_processos`, `caz_parcelas`, `cup_contratos`.

## PDF Generation (Client-Side)

- jsPDF + html2canvas para capturar visualmente a aba
- Header: logo + data + título
- Footer: "Gerado por Cortex — Confidencial"
- Landscape A4 para melhor fit de tabelas

## Navegação

- Novo item no sidebar: "Relatórios" com ícone `FileBarChart`
- Nova permission key: `jur.relatorios`
- Posição: após "Assistente IA", antes de "Clientes Inadimplentes"

## Dependências

Já instaladas: `jspdf@4.2.0`, `html2canvas@1.4.1`, `date-fns@3.6.0`
