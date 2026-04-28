# Spec: Widget "Quem está fora hoje" na Homepage

**Data:** 2026-04-28
**Status:** Aprovado
**Autor:** Warley + Claude

## Contexto

A página inicial (`client/src/pages/Homepage.tsx`) tem um grid com 4 widgets (`MeusClientes`, `AlertasWidget`, `MiniCalendar`, `AniversariantesWidget`). O `MiniCalendar` mostra "Próximos Eventos" da tabela `cortex_core.turbo_eventos`, mas é pouco usado.

Em contrapartida, o sistema já registra indisponibilidades dos colaboradores em `cortex_core.unavailability_requests` (alimentado pela página `/calendario-ferias`). Saber rapidamente quem está fora hoje é informação útil pra qualquer colaborador que abre a home (planejar reuniões, entender ausências em squads, etc.).

## Objetivo

Substituir o widget "Próximos Eventos" por um widget **"Quem está fora hoje"** que lista, de forma simples e escaneável, os colaboradores com indisponibilidade aprovada ativa na data corrente.

## Requisitos

### Funcionais
- Listar colaboradores com `status = 'aprovado'` cuja janela `data_inicio..data_fim` engloba a data atual.
- Para cada um: avatar (foto ou iniciais) + nome + data de retorno ("volta em DD/MM").
- Ordem alfabética por nome.
- Sem distinção de motivo (férias, folga, atestado — tudo agrupado como "fora").
- Estado vazio amigável: "Ninguém está fora hoje 🎉".
- Botão "Ver todos" no header navega pra `/calendario-ferias`.
- Contador de pessoas fora ao lado do título (badge discreto).

### Não-funcionais
- Suporte a dark/light mode usando o padrão do projeto (`dark:` Tailwind variants).
- Cache de 5 minutos no React Query (`staleTime: 5 * 60 * 1000`).
- Falha silenciosa: se a request falhar, mostra estado vazio (não derruba a home).

### Fora de escopo
- Filtros por squad/motivo/período no widget (a página `/calendario-ferias` já tem isso).
- Mostrar quem volta em breve ou quem sai em breve.
- Mostrar motivo da ausência.

## Design

### Backend

**Novo endpoint:** `GET /api/unavailability-requests/today`

```sql
SELECT
  ur.id,
  ur.colaborador_id,
  ur.colaborador_nome,
  ur.data_fim
FROM cortex_core.unavailability_requests ur
WHERE ur.status = 'aprovado'
  AND CURRENT_DATE BETWEEN ur.data_inicio AND ur.data_fim
ORDER BY ur.colaborador_nome ASC;
```

**Resposta:**
```ts
type QuemEstaForaItem = {
  id: number;
  colaboradorId: number;
  nome: string;
  dataFim: string; // ISO YYYY-MM-DD
};
```

**Cleanup no `home-overview`:**
- Remover o bloco que busca `proximosEventos` em `server/routes.ts` (linhas ~9786-9805 e a inclusão em `9921`).
- Remover o campo `proximosEventos` do payload retornado.

### Frontend

**Novo componente:** `client/src/components/QuemEstaForaWidget.tsx`

Estrutura:
```tsx
type Props = {
  userPhotos?: Record<number, string>; // colaboradorId → URL da foto
};

function QuemEstaForaWidget({ userPhotos }: Props) {
  const { data, isLoading } = useQuery<QuemEstaForaItem[]>({
    queryKey: ['/api/unavailability-requests/today'],
    staleTime: 5 * 60 * 1000,
  });
  // ...
}
```

Layout do card:
- Header: ícone (`UserMinus` ou `Plane` do lucide-react) + título "Quem está fora hoje" + badge com a contagem + botão "Ver todos".
- Conteúdo:
  - **Loading:** 3 skeletons de linha.
  - **Empty:** mensagem centralizada "Ninguém está fora hoje 🎉".
  - **Lista:** scroll interno (mesma altura do card 400px do grid). Cada item: avatar 40px + coluna com nome (`font-medium`) e linha menor (`text-muted-foreground text-sm`) "volta em DD/MM" (formatado com `date-fns/format` + `ptBR`).
- Hover sutil em cada linha (mesma classe usada nos outros widgets).

**Avatar:** mesmo padrão do `AniversariantesWidget`. Recebe `userPhotos` (já carregado no Homepage para os aniversariantes); cai pra `<Avatar>` com iniciais quando não houver foto.

### Integração na Homepage

Em `client/src/pages/Homepage.tsx`:
- Remover o componente local `MiniCalendar` (linhas ~239-311).
- Remover o campo `proximosEventos` da interface `HomeOverview` (linha ~96).
- Substituir `<MiniCalendar eventos={...} />` (linha 904) por `<QuemEstaForaWidget userPhotos={userPhotos} />`.
- Remover imports não usados (`Clock`, `MapPin` se forem só do MiniCalendar — verificar antes).

## Estados de erro

- Falha de rede no endpoint `/today`: o componente trata como lista vazia (mostra estado "Ninguém está fora hoje").
- Servidor: sem tratamento especial — endpoint retorna `[]` em qualquer erro de leitura, com log no console (`console.error("[unavailability-today]")`).

## Validação manual

1. Inserir manualmente uma `unavailability_request` com `status='aprovado'` e janela englobando hoje → deve aparecer no widget.
2. Sem nenhuma indisponibilidade ativa → estado vazio.
3. Click em "Ver todos" → navega pra `/calendario-ferias`.
4. Verificar dark mode + light mode.
5. Confirmar que `MiniCalendar` foi removido sem quebrar build.
6. Confirmar que o endpoint `home-overview` continua funcionando após remoção do `proximosEventos`.

## Mudanças resumidas

**Server:**
- `server/routes.ts`: novo endpoint `GET /api/unavailability-requests/today`; remover bloco `proximosEventos` de `/api/home-overview`.

**Client:**
- `client/src/components/QuemEstaForaWidget.tsx`: novo arquivo.
- `client/src/pages/Homepage.tsx`: remover `MiniCalendar`, ajustar tipo `HomeOverview`, integrar novo widget.
