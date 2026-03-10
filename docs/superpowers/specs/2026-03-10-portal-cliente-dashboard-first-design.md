# Portal do Cliente — Dashboard-First Redesign

**Data:** 2026-03-10
**Status:** Aprovado
**Escopo:** Portal externo do cliente (`/portal-cliente`)
**Publico:** PMEs (pequenos empresarios)

---

## Contexto

O Portal do Cliente atual (`PortalCliente.tsx`, 1600+ linhas) e um arquivo monolitico com 4 modulos (Performance, Financeiro, Servicos, Atendimento). Problemas identificados:

1. **Arquivo monolitico** — 1600+ linhas, dificil de manter, re-renders desnecessarios
2. **Chat duplicado** — `ChatModuloCliente` e `ChatFlutuante` sao quase identicos (~200 linhas duplicadas)
3. **UX inadequada para PMEs** — abre direto em "Performance", sem visao geral, dados cadastrais escondidos em Financeiro
4. **StatusBadge sem dark/light** — cores hardcodadas para dark mode
5. **Mobile fraco** — tabela de faturas com grid 6 colunas nao se adapta
6. **Sem indicadores de acao** — nenhum alerta visual para faturas atrasadas ou mensagens nao lidas

---

## Decisoes

| Decisao | Escolha | Justificativa |
|---------|---------|---------------|
| Abordagem | Dashboard-First | PMEs querem visao rapida do status da conta |
| Estrutura | Componentes modulares | Reduz monolito de 1600 para ~200 linhas no orquestrador |
| Navegacao | Tabs horizontais + Dashboard como home | Familiar para o publico, nao precisa sidebar |
| Chat | Componente unificado com variantes | Elimina duplicacao de ~200 linhas |
| Perfil | Modulo separado | Dados cadastrais nao pertencem ao Financeiro |

---

## Arquitetura de Componentes

```
client/src/pages/
  PortalCliente.tsx              -> Orquestrador (~200 linhas): auth, header, nav, lazy load

client/src/components/portal/
  PortalDashboard.tsx            -> Dashboard home com KPIs, alertas e atalhos
  PortalFinanceiro.tsx           -> Faturas, resumo financeiro, filtros
  PortalServicos.tsx             -> Lista de servicos, botao cancelar
  PortalChat.tsx                 -> Chat unificado (variant: 'page' | 'floating')
  PortalPerfil.tsx               -> Dados cadastrais, email/tel editaveis, senha, tema
  CancelamentoModal.tsx          -> Modal de cancelamento (extraido)
  StatusBadge.tsx                -> Badge reutilizavel com dark/light
```

---

## Dashboard (Tela Principal)

### KPIs (4 cards)

| KPI | Fonte | Visual |
|-----|-------|--------|
| Proximo vencimento | Primeira fatura pendente por data | Valor + data, neutro |
| Faturas atrasadas | Count + soma de faturas ATRASADO/VENCIDO | Vermelho se > 0, verde se 0 |
| Servicos ativos | Count de servicos com status ativo | Verde |
| Mensagens nao lidas | Count de mensagens do chat nao lidas | Badge azul se > 0 |

### Alertas Automaticos

- Fatura atrasada -> banner vermelho com link "Ver detalhes" -> Financeiro
- Mensagens nao lidas -> banner azul com link -> Atendimento
- Servico pausado -> banner amarelo com info

### Acoes Rapidas

Grid 2x3 com botoes grandes:
- Ver Performance -> modulo Performance
- Ver Faturas -> modulo Financeiro
- Meus Servicos -> modulo Servicos
- Falar com Suporte -> modulo Atendimento
- Meu Perfil -> modulo Perfil

### Ultimas Faturas

Preview das 3 ultimas faturas com link "Ver todas" -> Financeiro.

### Endpoint

```
GET /api/portal-cliente/dashboard

Response: {
  proximoVencimento: { valor: number, data: string } | null,
  faturasAtrasadas: { count: number, total: number },
  servicosAtivos: number,
  mensagensNaoLidas: number,
  ultimasFaturas: Fatura[] (limit 3),
  alertas: Array<{ tipo: 'atrasado'|'mensagem'|'pausado', mensagem: string }>
}
```

---

## Melhorias nos Modulos

### Financeiro
- Remover dados cadastrais (mover para Perfil)
- Adicionar filtro por status: Todas / Pendentes / Pagas / Atrasadas
- Mobile: cards empilhados em vez de grid 6 colunas
- Banner de destaque para faturas atrasadas no topo

### Servicos
- Extrair para componente proprio (sem mudancas funcionais)
- Modal de cancelamento -> `CancelamentoModal.tsx`

### Chat
- Unificar em `PortalChat` com prop `variant`
- `variant='page'` -> altura total, usado no modulo Atendimento
- `variant='floating'` -> posicao fixa, canto inferior direito
- Badge no FAB com count de mensagens nao lidas
- Manter polling de 3s

### Performance
- Manter lazy loading atual (`PortalPerformance`)
- Sem mudancas

### Perfil (Novo)
- Dados cadastrais: empresa, CNPJ (readonly)
- Email, telefone (editaveis, mover do Financeiro)
- Alterar senha
- Toggle tema dark/light

---

## Navegacao

```
[Home] [Performance] [Financeiro] [Servicos] [Atendimento] [Perfil]
```

- Dashboard como tab padrao ao entrar
- Clicar em KPI card navega para modulo correspondente
- FAB de chat sempre visivel (exceto no modulo Atendimento)

---

## Dark/Light Mode

Todos os componentes novos devem usar o padrao do projeto:
```tsx
className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
```

StatusBadge refatorado para suportar ambos os temas.

---

## Fora de Escopo

- NPS/Feedback (epico separado)
- Base de conhecimento/FAQ (epico separado)
- Notificacoes push/email (epico separado)
- Alteracao de autenticacao (magic link, etc.)
