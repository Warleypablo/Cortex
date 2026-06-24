# Design: Dashboard de Notas Fiscais

## Problema
As notas fiscais emitidas contra a Turbo Partners são processadas manualmente via script Python local. Não há visibilidade centralizada no Cortex.

## Solução
Dashboard web dentro de Financeiro no Cortex que extrai valores de PDFs de NFs, armazena no banco, e exibe com visualizações ricas + conciliação com Conta Azul.

## 1. Banco de dados

Tabela `cortex_core.notas_fiscais`:
- `id SERIAL PK`, `mes VARCHAR(20)`, `mes_num INTEGER`, `ano INTEGER`
- `categoria VARCHAR(50)`, `arquivo VARCHAR(500)`, `prestador VARCHAR(255)`
- `valor_brl NUMERIC(18,2)`, `moeda_original VARCHAR(5)`, `padrao_usado VARCHAR(100)`
- `status VARCHAR(50)`, `cnpj_prestador VARCHAR(20)`, `created_at TIMESTAMP`

## 2. Backend (TypeScript)

### PDF Extraction Engine
- Portar lógica do `extrair_notas.py` para TypeScript
- Usar `pdf-parse` (npm) para extrair texto
- Recriar ~30 regex patterns BRL + USD
- Funções: `parseBRL()`, `parseUSD()`, `extractValueFromText()`
- Extrair prestador do nome do arquivo (antes do " - Nfs")

### Endpoints
- `POST /api/notas-fiscais/upload` — upload multipart (mês + categoria)
- `POST /api/notas-fiscais/scan-local` — admin: processa attached_assets/2026
- `GET /api/notas-fiscais/dashboard` — agregações para KPIs e gráficos
- `GET /api/notas-fiscais/detalhado` — lista com filtros
- `GET /api/notas-fiscais/conciliacao` — cruza NFs com caz_parcelas

## 3. Frontend

### KPI Cards
- Total NFs processadas, Total com erro, Valor total, Valor médio

### Gráficos
- Barras: evolução mensal
- Pizza/treemap: distribuição por categoria
- Ranking: top prestadores por valor total

### Tabelas
- Detalhado com filtros (mês, categoria, status, prestador)
- Conciliação: NFs x Conta Azul (matched/unmatched)
- Erros: NFs não processadas

### Entrada de dados
- Upload drag-and-drop (mês + categoria)
- Botão admin "Processar Pasta Local"

## 4. Navegação
- Nova página `/dashboard/notas-fiscais` dentro de Financeiro
