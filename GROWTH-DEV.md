# Growth Module - Guia de Desenvolvimento

> **ATENÇÃO: Este módulo está sob responsabilidade de um desenvolvedor em treinamento.**
> Todas as alterações devem seguir rigorosamente as regras abaixo.

---

## REGRAS OBRIGATÓRIAS — LEIA ANTES DE QUALQUER COISA

### 1. NUNCA faça push direto na `main`
- Você **NÃO TEM PERMISSÃO** para commitar ou fazer push na branch `main`.
- Todo trabalho deve ser feito na branch `feature/growth-dev` ou em sub-branches dela.

### 2. SEMPRE abra Pull Request
- Quando terminar uma feature ou correção, abra um **Pull Request** de `feature/growth-dev` para `main`.
- O PR **só pode ser aprovado e mergeado por @Warleypablo (Warley)**.
- Nenhum outro membro pode aprovar merges na main.

### 3. NÃO mexa em arquivos fora do módulo Growth
- Você tem acesso a TODO o código para rodar o projeto, mas **só pode alterar os arquivos listados abaixo**.
- Alterar qualquer arquivo fora do escopo terá o PR **rejeitado automaticamente**.

### 4. Acesso ao banco de dados é RESTRITO
- Suas credenciais de banco só permitem acesso às tabelas de Growth (Meta Ads, Bitrix deals, Growth AI).
- Você **NÃO tem acesso** a dados financeiros, RH, contratos, churn ou clientes.
- **NÃO tente** criar usuários, acessar outros schemas ou burlar permissões.

---

## Branch: `feature/growth-dev`

```bash
# Clonar o projeto
git clone -b feature/growth-dev https://github.com/Warleypablo/Cortex.git
cd Cortex
npm install

# Configurar .env (credenciais fornecidas separadamente)
# Rodar
npm run dev
# Acessa em http://localhost:3000
```

---

## Arquivos permitidos (SOMENTE estes)

### Frontend (React + TypeScript)
| Arquivo | Descrição |
|---------|-----------|
| `client/src/pages/GrowthOrcadoRealizado.tsx` | Orçado x Realizado (metas, comparação, filtros) |
| `client/src/pages/GrowthAI.tsx` | Growth AI Chat (assistente inteligente) |
| `client/src/pages/GrowthVisaoGeral.tsx` | Visão Geral de Growth |
| `client/src/pages/PerformancePlataformas.tsx` | Performance por Plataforma |
| `client/src/pages/Criativos.tsx` | Criativos |

### Backend (Express + TypeScript)
| Arquivo | Descrição |
|---------|-----------|
| `server/routes/growth.ts` | Endpoints de Growth (Ads, MQL, Não-MQL, Budgets, Funis) |
| `server/routes/growth-ai.ts` | Endpoints do Growth AI Chat |
| `server/services/growthAiTools.ts` | Tools de dados para o AI |
| `server/services/metaAdsSync.ts` | Sync de dados do Meta Ads |

### Componentes compartilhados (editar com cuidado)
| Arquivo | Descrição |
|---------|-----------|
| `client/src/components/ui/date-range-picker.tsx` | DateRangePicker (usado em outras telas também) |
| `shared/nav-config.ts` | Navegação — só alterar a seção Growth |

### PROIBIDO alterar
- `server/routes.ts` (arquivo principal de rotas)
- `server/db.ts`, `server/storage.ts` (banco de dados)
- `server/auth/*` (autenticação)
- Qualquer arquivo fora da lista acima

---

## Padrões de código

### Commits
Usar **Conventional Commits**:
```
feat(growth): adiciona filtro de UTM source
fix(growth): corrige cálculo de CPL por campanha
style(growth): ajusta layout dos cards hero
refactor(growth): extrai componente de tabela de métricas
```

### Dark/Light Mode
**SEMPRE** usar `dark:` variants do Tailwind:
```tsx
// CORRETO
className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"

// ERRADO — nunca hardcodar cores
className="bg-white text-black"
```

### TypeScript
- Sempre tipar props e retornos
- Usar `interface` para objetos, `type` para unions
- Não usar `any` sem justificativa

---

## Dados disponíveis

| Schema | Tabela | Acesso | Descrição |
|--------|--------|--------|-----------|
| `meta_ads` | `meta_insights_daily` | Leitura/Escrita | Métricas diárias do Meta Ads |
| `meta_ads` | `meta_campaigns` | Leitura/Escrita | Campanhas |
| `meta_ads` | `meta_adsets` | Leitura/Escrita | Conjuntos de anúncios |
| `meta_ads` | `meta_ads` | Leitura/Escrita | Anúncios individuais |
| `meta_ads` | `meta_creatives` | Leitura/Escrita | Criativos |
| `meta_ads` | `growth_budgets` | Leitura/Escrita | Metas orçadas por mês/funil |
| `"Bitrix"` | `crm_deal` | **Somente leitura** | Leads, deals, vendas |
| `cortex_core` | `growth_ai_*` | Leitura/Escrita | Conversas do Growth AI |
| `google_ads` | `*` | **Somente leitura** | Dados Google Ads |

---

## Endpoints principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/growth/orcado-realizado/mql` | Métricas MQL (leads, reuniões, vendas) |
| GET | `/api/growth/orcado-realizado/nao-mql` | Métricas Não-MQL |
| GET | `/api/growth/orcado-realizado/ads` | Métricas de Ads (investimento, impressões, cliques) |
| GET | `/api/growth/orcado-realizado/budgets` | Metas orçadas |
| PUT | `/api/growth/orcado-realizado/budgets` | Salvar metas |
| GET | `/api/growth/orcado-realizado/funis` | Lista de funis disponíveis |
| POST | `/api/growth-ai/chat` | Chat do Growth AI |
| GET | `/api/growth-ai/conversas` | Listar conversas AI |

---

## Fluxo de trabalho

```
1. Fazer alterações na branch feature/growth-dev
2. Commitar com Conventional Commits
3. Push para origin/feature/growth-dev
4. Abrir Pull Request para main no GitHub
5. Aguardar aprovação de @Warleypablo
6. Warley faz o merge após revisão
```

**Dúvidas? Fale com Warley antes de implementar.**
