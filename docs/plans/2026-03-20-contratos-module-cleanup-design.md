# Design: Limpeza Visual + Features do ContratosModule

**Data:** 2026-03-20
**Abordagem:** Limpeza Cirúrgica (Abordagem A)
**Arquivo alvo:** `client/src/pages/ContratosModule.tsx` (144KB, `/contratos-module`)

## Contexto

- **Quem usa:** Time comercial
- **Para quê:** Criar contratos de serviços vendidos
- **Foco real:** Aba "Novo Contrato" — as outras 4 abas são secundárias
- **Problemas:** Visual poluído ("frufru"), faltam templates e duplicação de contratos

## 1. Limpeza Visual

| Elemento | Hoje | Depois |
|----------|------|--------|
| Dashboard cards | 13+ cards com gradientes e ícones repetidos | 4 KPIs em linha simples (Total, Ativos, Receita, Rascunhos) — sem gradiente, sem ícone decorativo |
| Tab bar | 5 abas com cores diferentes por aba | 5 abas monocromáticas, aba ativa com underline simples |
| Stat cards nas abas | 4 cards coloridos no topo de cada aba | Remover — a informação já está na tabela |
| Badges de status | OK | Manter — são úteis e com bom contraste |
| Ícones | DollarSign, Users, FileText repetidos 6x+ por tela | Um ícone por contexto, sem ícones decorativos em cards |
| Botões duplicados | "Nova Entidade" aparece 2x | Um botão só, na barra de ações |
| Detalhe do contrato | 3 cards de valor + mesma info na tabela de itens | Uma linha resumo no topo + tabela de itens com totais |
| Gradientes | bg-gradient-to-r em quase todo card/header | Removidos — backgrounds sólidos com bg-card |

**Princípio:** Se um elemento não ajuda o comercial a criar ou encontrar um contrato, ele sai.

## 2. Templates de Contrato

### Banco de dados
- Tabela `cortex_core.contrato_templates`
- Colunas: `id`, `nome`, `descricao`, `itens_template` (JSONB), `ativo`, `created_at`, `updated_at`

### UX
- Antes do formulário na aba "Novo Contrato", etapa de seleção com cards simples
- Card "Em branco" sempre presente como primeira opção
- Ao selecionar → formulário pré-preenchido com itens do template
- Todos os campos editáveis depois (template = ponto de partida)

### Gestão
- Na aba "Serviços", seção "Templates" abaixo da lista de serviços
- CRUD simples: criar template selecionando serviços/planos + valores padrão
- Alternativa: botão "Salvar como template" no formulário de Novo Contrato

Sem versionamento, sem aprovação. É só um atalho de preenchimento.

## 3. Duplicar Contrato

### Acesso
- Botão "Duplicar" nas ações de cada linha na aba "Contratos"
- Também na tela de detalhe do contrato (ao lado de Editar e Gerar PDF)

### Comportamento
- Abre aba "Novo Contrato" com campos pré-preenchidos do contrato original
- Número do contrato: gerado novo automaticamente
- Status: volta para "rascunho"
- Datas: ficam em branco (forçar definir novas)
- Cliente, serviços, valores, pagamento: tudo copiado
- Sem modal intermediário — clicou, vai direto pro formulário
