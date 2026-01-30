# 🤖 Claude.md - Documentação Completa de Dados

## 📊 Visão Geral

Este projeto utiliza uma arquitetura de dados robusta com banco externo
ao Replit, hospedado no **Google Cloud Platform (GCP)**.
O objetivo é integrar dados financeiros do **Conta Azul** com dados
operacionais do **ClickUp**, permitindo análises financeiras,
operacionais e de performance de clientes e contratos.

---

## 🏗️ Arquitetura

- Banco hospedado no **Google Cloud SQL**
- Integração entre:
  - **Conta Azul** (financeiro)
  - **ClickUp** (operações / contratos)
- Relacionamento principal via **CNPJ do cliente**
- Estrutura preparada para análises:
  - Receita recorrente
  - Receita pontual
  - Inadimplência
  - Churn
  - Saúde da conta

---

## 🗄️ Schemas

---

# 📘 Conta Azul

## caz_parcelas

Tabela de faturas e receitas do Conta Azul (integração via API).

**Colunas principais:**
- `id_parcela` - ID único da parcela
- `cnpj_cliente` - CNPJ do cliente (chave de relacionamento)
- `nome_cliente` - Nome do cliente
- `data_emissao` - Data de emissão da fatura
- `data_vencimento` - Data de vencimento
- `data_pagamento` - Data de pagamento (se pago)
- `valor` - Valor da parcela
- `status` - Status da parcela (ex: "PAGO", "PENDENTE", "VENCIDO")
- `tipo` - Tipo de receita ("RECORRENTE" ou "PONTUAL")
- `categoria` - Categoria da receita
- `descricao` - Descrição da parcela
- `observacoes` - Observações adicionais

---

## 🎯 Diretrizes de Desenvolvimento

### Suporte a Temas (Dark/Light Mode)
**SEMPRE** adaptar componentes para suportar ambos os temas usando o padrão:
```tsx
import { useTheme } from "@/components/ThemeProvider";

// Cores para modo claro e escuro
className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
className="border-gray-200 dark:border-zinc-700"
className="text-gray-600 dark:text-zinc-400"
```

### Padrões de Código
- Usar TypeScript para type safety
- Componentes React funcionais com hooks
- Tailwind CSS para estilização
- Recharts para visualizações de dados
- React Query para gerenciamento de estado servidor

### Nomenclatura
- Componentes: PascalCase (ex: `EvolucaoMensal.tsx`)
- Funções: camelCase (ex: `formatCurrencyNoDecimals`)
- Constantes: UPPER_SNAKE_CASE (ex: `SQUAD_COLORS`)
- Arquivos: kebab-case ou PascalCase para componentes

### Commits
- Mensagens claras e descritivas
- Sempre incluir: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`
- Focar no "porquê" não apenas no "o quê"

---

## 📝 Notas Importantes

- **Sempre** verificar compatibilidade com tema claro/escuro
- **Nunca** hardcodar cores - usar classes Tailwind com dark: variant
- **Sempre** usar formatadores de moeda para valores monetários
- **Testar** em ambos os modos de tema antes de considerar completo
