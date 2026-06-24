# Spec: Acesso Restrito a Colaboradores (sem salário)

## Objetivo

Criar a permissão `gg.colaboradores_restrito` que concede acesso à aba de Colaboradores mas omite todos os dados de salário — na listagem, detalhe, exportação e análise.

---

## Nova Permissão

**Chave:** `gg.colaboradores_restrito`
**Label:** `"Colaboradores (sem salário)"`
**Categoria:** GG (Gestão de Gente)

Usuários com essa chave podem acessar `/colaboradores` e `/colaboradores/analise`, mas nunca recebem o campo `salario` em nenhuma resposta da API.

Usuários com `gg.colaboradores` continuam vendo tudo (sem mudança).

---

## Arquitetura

### Detecção de "modo restrito"

Um usuário está em modo restrito quando:
- Tem `gg.colaboradores_restrito` em `allowedRoutes` **E**
- NÃO tem `gg.colaboradores` em `allowedRoutes`

(Admin tem acesso total independente.)

### Backend — Helper de permissão

Função `isRestrictedColaboradoresAccess(req)` em `server/routes/colaboradores.ts`:
```ts
function isRestrictedColaboradoresAccess(req): boolean {
  const routes = req.user?.allowedRoutes ?? [];
  return routes.includes('gg.colaboradores_restrito') &&
         !routes.includes('gg.colaboradores') &&
         req.user?.role !== 'admin';
}
```

Aplicada em todos os endpoints que retornam dados de colaboradores. Quando verdadeiro, o campo `salario` é deletado do objeto antes de serializar.

### Endpoints afetados

| Endpoint | Ação |
|----------|------|
| `GET /api/colaboradores` | `delete colaborador.salario` em cada item |
| `GET /api/colaboradores/:id` | `delete colaborador.salario` |
| `POST /api/colaboradores/exportar-excel` | Remove coluna `Salário` do export |
| `GET /api/colaboradores/analise-geral` | Remove `salarioTotal` e campos derivados |

### Frontend — Detecção de modo restrito

Hook `useIsColaboradoresRestrito()` em `client/src/hooks/useIsColaboradoresRestrito.ts`:
```ts
export function useIsColaboradoresRestrito(): boolean {
  const { user } = useAuth();
  if (!user || user.role === 'admin') return false;
  return user.allowedRoutes?.includes('gg.colaboradores_restrito') &&
         !user.allowedRoutes?.includes('gg.colaboradores');
}
```

Consumido em `Colaboradores.tsx` e `DetailColaborador.tsx` para ocultar:
- Coluna "Salário" na tabela
- Campo salário no formulário de criação/edição
- Total de salários no footer da tabela
- Salário no detalhe do colaborador

### Roteamento — Acesso com ambas as permissões

O `ROUTE_TO_PERMISSION` mapeia uma rota para uma única chave. Como dois keys precisam dar acesso a `/colaboradores`, a função `hasAccess` em `AuthContext.tsx` recebe uma verificação extra: se o usuário tem `gg.colaboradores_restrito`, também concede acesso às rotas de colaboradores.

Alternativamente, adicionar entrada adicional em `PERMISSION_TO_ROUTES` para mapear `gg.colaboradores_restrito → ['/colaboradores', '/colaboradores/analise']`, e modificar `hasAccess` para iterar todas as permissões do usuário e checar as rotas de cada uma.

**Decisão:** Modificar `hasAccess` para checar todos os `allowedRoutes` do usuário contra `PERMISSION_TO_ROUTES` em vez de fazer lookup reverso pela rota. Isso é mais correto e extensível.

### Nav-config — Registro da nova permissão

Mudanças em `shared/nav-config.ts`:
1. `PERMISSION_KEYS.GG.COLABORADORES_RESTRITO = 'gg.colaboradores_restrito'`
2. `PERMISSION_LABELS['gg.colaboradores_restrito'] = 'Colaboradores (sem salário)'`
3. `PERMISSION_CATEGORIES.GG` inclui `'gg.colaboradores_restrito'`
4. `PERMISSION_TO_ROUTES['gg.colaboradores_restrito'] = ['/colaboradores', '/colaboradores/analise']`

### UI de gerenciamento de usuários

A nova permissão aparece automaticamente na seção GG do `AdminUsuarios.tsx` por ser adicionada a `PERMISSION_CATEGORIES.GG`. Nenhuma mudança de UI necessária além do registro no nav-config.

---

## O que NÃO muda

- Usuários com `gg.colaboradores` — sem impacto
- Admins — sem impacto
- Formulário de criação/edição de colaborador — campo salário oculto para usuário restrito (não edita salário), mas a API de escrita não é afetada (só leitura é restrita)
- Análise de colaboradores (`/colaboradores/analise`) — acessível, mas métricas de salário omitidas

---

## Escopo

- 5 arquivos modificados: `nav-config.ts`, `routes/colaboradores.ts`, `contexts/AuthContext.tsx`, `pages/Colaboradores.tsx`, `pages/DetailColaborador.tsx`
- 1 arquivo criado: `hooks/useIsColaboradoresRestrito.ts`
