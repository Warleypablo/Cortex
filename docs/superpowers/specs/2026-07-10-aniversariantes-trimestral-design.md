# Spec — Slides de aniversariantes no Reporte Trimestral

**Data:** 2026-07-10
**Branch:** `feature/churn-medio-mensal-squad` (branch de trabalho do deck trimestral)
**Autor:** Warleypablo + Claude

## Objetivo

Trazer para o deck `/reports/trimestral` os slides de gente que já existem no reporte
mensal — **Novos Colaboradores + Aniversários do Mês** e **Aniversário de Empresa** —
recriados com a identidade visual do deck trimestral (deck-kit), posicionados na abertura,
**depois do QR e antes da Capa do trimestre**.

Bônus no mesmo escopo: **ativar o QR code do Q3** (arquivo já entregue) no slide de QR/Q&A.

## Decisões (validadas com o usuário 2026-07-10)

1. **Aniversários do Mês (vida)** = aniversariantes do **mês de apresentação** (mês seguinte
   ao fim do tri). Para Q2/2026 → **julho/2026** (14 pessoas ativas). Mesma régua que o
   mensal usa (`nextMesDados`).
2. **Novos Colaboradores** = admitidos **no último mês do fechamento do trimestre** (não o
   trimestre inteiro). Para Q2 → **junho/2026**. É o análogo do "mês de dados" do mensal.
3. **Aniversário de Empresa** = **whitelist fixa: apenas Thiago Folador e Matheus Scalfoni**
   (ambos admitidos 25/07/2024 → 2 anos em 2026). Sem a whitelist, a régua natural
   (admissão em julho) traria também Victor Peixoto (C-Level), Karoline (G&G) e Matheus Pin
   (UIUX) — por isso a curadoria explícita é obrigatória.
4. **Visual**: recriar com deck-kit trimestral (section `people`, entrance stagger), não
   reusar os componentes do mensal.
5. **Posição**: `Mantra → QR → [Novos+Aniversários] → [Aniversário de Empresa] → Capa Q2 → Visão…`
6. **QR**: ativa nos **dois** usos do `SlideQrTrimestre` (abertura + Q&A) — mesma URL.

## Régua de datas (backend)

Derivada de `w = buildQuarterWindow(trimestre)`:

- **Mês de apresentação**: mês/ano de `w.dataEnd` (1º dia após o tri).
  `mesApr = Number(w.dataEnd.slice(5,7))`, `anoApr = Number(w.dataEnd.slice(0,4))`.
  Q2 → `2026-07-01` → julho/2026. Determinístico: o reporte de Q2 sempre mostra julho,
  independente de quando é aberto.
- **Último mês do tri**: `ultimoMes = w.startMonth + 2` (Q2: 4→6 = junho), ano = `w.ano`.
- Label do mês de apresentação: `${MESES_PT[mesApr-1]} ${anoApr}` → "Julho 2026".

## Arquitetura

### Backend — `server/routes/reportsTrimestral.ts`
3 queries novas (Promise.all próprio, ou anexadas a um bloco existente), espelhando as
queries 1–3 do mensal (`relatorioMensalSlides.ts` L258-316), incluindo os 3 LEFT JOINs de
foto em `cortex_core.auth_users` (a_id / a_turbo / a_pessoal):

1. **Novos** — `WHERE EXTRACT(MONTH FROM admissao)=ultimoMes AND EXTRACT(YEAR FROM admissao)=w.ano AND status='Ativo'`.
2. **Aniversariantes (vida)** — `WHERE EXTRACT(MONTH FROM aniversario)=mesApr AND status='Ativo'`, `dia = EXTRACT(DAY FROM aniversario)`.
3. **Aniversário de empresa** — `WHERE EXTRACT(MONTH FROM admissao)=mesApr AND EXTRACT(YEAR FROM admissao)<anoApr AND status='Ativo' AND (lower(nome) LIKE '%folador%' OR lower(nome) LIKE '%scalfoni%')`, `anosDeEmpresa = anoApr - EXTRACT(YEAR FROM admissao)`.

Whitelist como constante documentada no topo do arquivo:
```ts
// Aniversário de empresa do deck trimestral: curadoria explícita (só estes aparecem).
// A régua natural (admissão no mês de apresentação) traria também C-Level/G&G/UIUX.
const ANIVERSARIO_EMPRESA_WHITELIST = ["folador", "scalfoni"];
```

Novo campo no `res.json`:
```ts
pessoas: {
  mesLabel: string,                 // "Julho 2026"
  novos: NovoColaborador[],
  aniversariantes: Aniversariante[],
  aniversariosEmpresa: AniversarioEmpresa[],
}
```

### Tipos — `client/src/pages/relatorio-trimestral/types.ts`
- Importar `NovoColaborador`, `Aniversariante`, `AniversarioEmpresa` de `../relatorio-mensal/types` (reuso).
- `export interface PessoasTrimestral { mesLabel: string; novos: NovoColaborador[]; aniversariantes: Aniversariante[]; aniversariosEmpresa: AniversarioEmpresa[] }`.
- Adicionar `pessoas: PessoasTrimestral` a `RelatorioTrimestralData`.

### Slides novos (deck-kit, section `people`)
- `SlideNovosAniversariantesTrimestre.tsx` — dois blocos (Novos Colaboradores / Aniversários
  do Mês) com `SlideLayout section="people"`, `SlideHeader`, `entrance(i*delay)` stagger,
  grid de cards com Avatar (foto do banco + fallback iniciais). Reaproveitar a lógica de
  `FOTOS_MANUAIS`/`fotoManual` do slide mensal para as silhuetas conhecidas.
- `SlideAniversarioEmpresaTrimestre.tsx` — cards centralizados com foto, cargo e badge
  "N anos", entrance stagger, mesmo section `people`.

### `client/src/pages/RelatorioTrimestral.tsx`
- Importar os 2 slides.
- Union `TrimSlot` ganha `{ type: "novos-aniversarios" } | { type: "aniversario-empresa" }`.
- Inserir os 2 slots **entre `{ type: "qr" }` e `{ type: "capa" }`**.
- 2 novos `case` no `renderSlide()`, passando `data.pessoas`.

### QR — `SlideQrTrimestre.tsx` + asset
- Salvar `QR Code for q3.png` → `client/src/assets/qr-qa.png`.
- Descomentar `import qrCode from "@assets/qr-qa.png"` e setar `const QR_SRC = qrCode`.
- Afeta ambos os usos (abertura + Q&A) sem mais mudanças.

## Verificação

- `npx tsc --noEmit` limpo.
- Endpoint `GET /api/reports/trimestral?trimestre=2026-Q2` retorna `pessoas` com:
  - `aniversariantes.length === 14` (vida julho);
  - `aniversariosEmpresa` = exatamente 2 (Folador + Scalfoni), `anosDeEmpresa === 2`;
  - `novos` = admitidos em junho/2026.
- Browser: navegar o deck de Q2 e conferir os 2 slides na posição correta + QR renderizando.
- Dark mode (deck é sempre dark).

## Fora de escopo
- Não mexer no reporte mensal.
- Não alterar a régua de aniversariantes/empresa dos outros trimestres além do que a fórmula
  determinística já produz (whitelist de empresa vale para qualquer tri).
