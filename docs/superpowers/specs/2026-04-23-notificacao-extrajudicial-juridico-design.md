# Notificação Extrajudicial no Funil Jurídico — Design (Fase 1)

**Data:** 2026-04-23
**Autor:** Warleypablo + Claude
**Status:** Aprovado para implementação
**Módulo:** `JuridicoClientes` (rota `/juridico/clientes`)

---

## 1. Contexto e Objetivo

Na página de Clientes Inadimplentes (`JuridicoClientes`), cada cliente pode ter um procedimento jurídico associado. Quando o procedimento é `notificacao`, o time jurídico precisa gerar uma **Notificação Extrajudicial de Cobrança** formal com os dados do devedor substituídos em um template padrão e enviar para o email do cliente.

Esta spec cobre a **Fase 1**: gerar a notificação com substituição de variáveis e permitir copiar o texto ou abrir o cliente de email do sistema operacional via `mailto:`. O envio server-side, log de auditoria, geração de PDF e templates variados ficam para a **Fase 2**.

## 2. Escopo

### 2.1 Dentro do escopo (Fase 1)

- Botão "Gerar Notificação" no card do cliente, visível apenas quando `procedimentoJuridico === 'notificacao'`.
- Modal com formulário de preenchimento dos campos ausentes no banco (número do contrato, data de assinatura, nome do serviço, endereço e email) + preview editável.
- Função pura que substitui variáveis no template fixo.
- Ação primária: "Copiar texto" (clipboard).
- Ação secundária: "Abrir no email" (via `mailto:`).
- Incluir `email` e `endereco` da tabela `"Conta Azul".caz_clientes` no payload de `GET /api/juridico/clientes`.

### 2.2 Fora do escopo (Fase 2)

- Envio server-side de email (SMTP/Resend/SendGrid).
- Log de auditoria de notificações enviadas.
- Histórico por cliente na UI.
- Geração de PDF.
- Múltiplos templates de notificação (protesto, ação judicial, etc.).

## 3. Arquitetura

### 3.1 Fluxo

```
Card cliente (procedimentoJuridico=notificacao)
  └── [Botão "Gerar Notificação"]
        └── Abre NotificacaoExtrajudicialModal
              ├── Form (inputs pré-preenchidos do banco + editáveis)
              ├── Preview editável (gerado por renderizarNotificacao())
              └── [Copiar texto] | [Abrir no email] | [Fechar]
```

### 3.2 Backend

Arquivo: `server/routes/juridico.ts`

Alteração única: no endpoint `GET /api/juridico/clientes`, adicionar `LEFT JOIN "Conta Azul".caz_clientes` (ou equivalente já existente) e incluir `email` e `endereco` no SELECT e no payload.

**Novos campos no tipo `ClienteInadimplente`:**

```ts
interface ClienteInadimplente {
  // ... campos existentes
  email: string | null;
  endereco: string | null;
}
```

Nenhum endpoint novo. Nenhuma mutação no banco.

### 3.3 Frontend

**Arquivos:**

| Arquivo | Ação |
|---|---|
| `server/routes/juridico.ts` | Modificar — incluir `email` e `endereco` no SELECT/payload |
| `client/src/pages/JuridicoClientes.tsx` | Modificar — adicionar botão condicional + estado do modal |
| `client/src/components/juridico/NotificacaoExtrajudicialModal.tsx` | Criar |
| `client/src/lib/notificacao-extrajudicial.ts` | Criar — função pura de substituição |
| `client/src/lib/notificacao-extrajudicial.test.ts` | Criar — testes unitários |

## 4. Componente: NotificacaoExtrajudicialModal

### 4.1 Props

```ts
interface NotificacaoExtrajudicialModalProps {
  cliente: ClienteJuridico;
  open: boolean;
  onClose: () => void;
}
```

### 4.2 Estrutura visual

Usa o componente `Dialog` do shadcn (padrão já adotado na página).

- **Header:** `Notificação Extrajudicial de Cobrança — {nomeCliente}`
- **Corpo (scroll vertical):**
  - **Alert amarelo** (só se `cliente.email` ausente): "Email não cadastrado em caz_clientes. Preencha manualmente abaixo para continuar."
  - **Seção "Dados do Notificado"** (grid 2 colunas, responsivo 1 em mobile):
    - Input: Email do notificado (pré-preenchido de `cliente.email`)
    - Textarea curto: Endereço completo (pré-preenchido de `cliente.endereco`)
    - Input: Número do contrato (vazio; texto livre)
    - Input date: Data de assinatura do contrato
  - **Seção "Dados do Contrato"**:
    - Input: Nome do serviço contratado (pré-preenchido de `cliente.servicos`)
  - **Seção "Preview da Notificação"**:
    - Textarea grande (min-h ~500px, fonte mono, editável)
    - Botão "Restaurar do formulário" (só visível após edição manual do preview)
- **Footer:**
  - Botão primário: **Copiar texto** (ícone Copy, feedback via toast)
  - Botão secundário: **Abrir no email** (ícone Mail, desabilitado se email inválido)
  - Botão ghost: **Fechar**

### 4.3 Estado interno

```ts
const [form, setForm] = useState({
  email: cliente.email ?? "",
  endereco: cliente.endereco ?? "",
  numeroContrato: "",
  dataContrato: "",
  nomeServico: cliente.servicos ?? "",
});
const [previewEditado, setPreviewEditado] = useState<string | null>(null);
const [manualEdit, setManualEdit] = useState(false);

const previewGerado = useMemo(
  () => renderizarNotificacao({ cliente, form }),
  [cliente, form]
);

const preview = manualEdit && previewEditado !== null ? previewEditado : previewGerado;
```

Regras:
- Enquanto `manualEdit === false`, o preview espelha `previewGerado` em tempo real.
- Ao primeiro `onChange` do textarea, `manualEdit` vira `true` e o texto é congelado em `previewEditado`.
- Botão "Restaurar do formulário" faz `setManualEdit(false); setPreviewEditado(null)`.

### 4.4 Validação

- Botão **Copiar texto**: sempre habilitado.
- Botão **Abrir no email**: habilitado apenas quando `form.email` passa em regex simples de email (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
- Nenhum input tem validação bloqueante — texto livre para não atrapalhar casos especiais.

### 4.5 Ação "Abrir no email"

```ts
const mailtoUrl = `mailto:${encodeURIComponent(form.email)}`
  + `?subject=${encodeURIComponent("Notificação Extrajudicial de Cobrança - TURBO PARTNERS")}`
  + `&body=${encodeURIComponent(preview)}`;

if (encodeURIComponent(preview).length > 1800) {
  toast({
    title: "Texto muito longo para mailto",
    description: "Use 'Copiar texto' e cole no cliente de email.",
  });
  return;
}
window.location.href = mailtoUrl;
```

Limite de 1800 caracteres codificados é conservador para compatibilidade com Outlook desktop.

## 5. Função `renderizarNotificacao`

Arquivo: `client/src/lib/notificacao-extrajudicial.ts`

Função pura, testável isoladamente, sem side effects.

### 5.1 Assinatura

```ts
interface RenderizarInput {
  cliente: ClienteJuridico;
  form: {
    email: string;
    endereco: string;
    numeroContrato: string;
    dataContrato: string;  // ISO yyyy-mm-dd do input date
    nomeServico: string;
  };
}

function renderizarNotificacao(input: RenderizarInput): string;
```

### 5.2 Variáveis derivadas

| Variável | Origem | Regra |
|---|---|---|
| `nomeNotificada` | `cliente.empresa` (fallback: `cliente.nomeCliente` quando `empresa` for null/vazio) | Uppercase no template |
| `cnpjNotificada` | `cliente.cnpj` | Formatado `XX.XXX.XXX/XXXX-XX`; se null → `[CNPJ NÃO INFORMADO]` |
| `enderecoNotificada` | `form.endereco` | Se vazio → `[ENDEREÇO NÃO INFORMADO]` |
| `mesesEmAtraso` | `parcelas[].dataVencimento` | Meses/anos únicos, ordenados, formato `"janeiro/2026, fevereiro/2026 e março/2026"` |
| `anoPrincipal` | Ano com mais parcelas em atraso (empate → maior) | Número |
| `anoPrincipalExtenso` | Conversão do `anoPrincipal` via lookup manual para anos 2025–2030 | Ex: `"Dois Mil e Vinte e Seis"` |
| `valoresDescricao` | `parcelas[].naoPago` (saldo devedor atual, não o valor bruto original) | Ver §5.3 |
| `dataAssinatura` | `form.dataContrato` | Formatado `dd/mm/aaaa`; se vazio → `[DATA DO CONTRATO]` |
| `numeroContrato` | `form.numeroContrato` | Se vazio → `[Nº DO CONTRATO]` |
| `nomeServico` | `form.nomeServico` | Se vazio → `[NOME DO SERVIÇO]` |
| `dataEmissao` | Data atual | Formatado `dd/mm/aaaa` |
| `cidadeEmissao` | Constante `"Vitória/ES"` | — |

### 5.3 Regra híbrida de valores (§3.3.2 do design)

```
Se todas as parcelas têm o mesmo valor (tolerância R$ 0,01):
  valoresDescricao = `no valor de R$ {valor} cada uma`
Caso contrário:
  valoresDescricao = `sendo {lista formatada}`
  onde lista = "R$ X com vencimento em dd/mm/aaaa, R$ Y com vencimento em dd/mm/aaaa e R$ Z com vencimento em dd/mm/aaaa"
```

Valor por extenso entre parênteses é **opcional** — só inclui se a lib `extenso` estiver disponível. Fallback: omite o extenso.

### 5.4 Template

String literal com placeholders `${}` — sem Handlebars/Mustache (não agrega valor). Conteúdo fiel ao template fornecido pelo usuário, com adaptações:

- Cabeçalho fixo da TURBO PARTNERS com CNPJ 42.100.292/0001-84.
- Trecho da notificada usa `nomeNotificada`, `cnpjNotificada`, `enderecoNotificada`.
- Trecho do débito usa `mesesEmAtraso`, `anoPrincipal`, `anoPrincipalExtenso`.
- Trecho do contrato usa `dataAssinatura`, `nomeServico`, `numeroContrato`, `valoresDescricao`.
- Trecho da lei (art. 726 CPC, art. 43 §3º CDC) é fixo.
- Assinatura: `Vitória/ES  {dataEmissao}.`

## 6. UI: botão no card

Arquivo: `client/src/pages/JuridicoClientes.tsx`

Adicionar dentro do bloco "Linha 3: Botões de Ação" (atualmente entre linhas ~1184 e ~1241), antes do botão "Atualizar":

```tsx
{item.contexto?.procedimentoJuridico === "notificacao" && (
  <Button
    size="default"
    variant="outline"
    className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 flex-1 sm:flex-none min-w-[100px]"
    onClick={() => setNotificacaoCliente(item)}
    data-testid={`button-notificacao-${index}`}
  >
    <Mail className="h-4 w-4 mr-1.5 sm:mr-2" />
    <span className="hidden xs:inline">Gerar Notificação</span>
    <span className="xs:hidden">Notificar</span>
  </Button>
)}
```

Novo estado no componente:

```ts
const [notificacaoCliente, setNotificacaoCliente] = useState<ClienteJuridico | null>(null);
```

Renderização do modal ao final do JSX:

```tsx
{notificacaoCliente && (
  <NotificacaoExtrajudicialModal
    cliente={notificacaoCliente}
    open={!!notificacaoCliente}
    onClose={() => setNotificacaoCliente(null)}
  />
)}
```

Importar `Mail` de `lucide-react` e o modal novo.

## 7. Edge cases

| Caso | Comportamento |
|---|---|
| Cliente sem email em `caz_clientes` | Alert amarelo no topo do modal; input vazio editável; "Abrir no email" desabilitado até preencher email válido |
| Cliente sem endereço em `caz_clientes` | Input vazio; preview mostra `[ENDEREÇO NÃO INFORMADO]` até preencher |
| Parcelas em anos diferentes (ex: dez/2025 + jan/2026) | Cada mês aparece com seu ano; `anoPrincipal` = ano com mais parcelas |
| Parcelas com valores iguais | Usa formato "cada uma" |
| Parcelas com valores diferentes | Usa formato de lista detalhada |
| Texto > 1800 chars no `mailto:` | Botão "Abrir no email" mostra toast pedindo pra usar "Copiar texto" |
| Usuário edita o preview manualmente | Edição manual preservada; form continua editável mas não sobrescreve texto até clicar em "Restaurar do formulário" |
| Cliente sem CNPJ | Preview mostra `[CNPJ NÃO INFORMADO]` |
| Ano fora de 2025–2030 | Placeholder `[ANO POR EXTENSO]` — pode ser expandido depois |

## 8. Testing

### 8.1 Unitários

Arquivo: `client/src/lib/notificacao-extrajudicial.test.ts`

Casos obrigatórios:
1. `mesesEmAtraso` formata corretamente parcelas no mesmo ano
2. `mesesEmAtraso` formata corretamente parcelas em anos diferentes
3. Formato "cada uma" quando valores iguais
4. Formato "lista detalhada" quando valores diferentes
5. Template final inclui todas as variáveis substituídas
6. Placeholders `[...]` aparecem quando dados estão ausentes
7. Função é determinística (mesma entrada → mesma saída, exceto pela data de emissão)

### 8.2 Manual (obrigatório antes de PR)

- Abrir modal em cliente com `procedimentoJuridico = 'notificacao'`
- Conferir pré-preenchimento de email e endereço
- Editar inputs → preview atualiza em tempo real
- Editar preview manualmente → inputs continuam editáveis mas não sobrescrevem
- Clicar "Restaurar do formulário" → texto reseta para o derivado do form
- "Copiar texto" → colar em editor, conferir formato
- "Abrir no email" → cliente de email abre com destinatário, assunto e corpo corretos
- Testar com cliente **sem email** no banco → alert amarelo aparece
- Dark mode e light mode
- Mobile (responsive)

### 8.3 Não testados (Fase 2)

Envio real de email, geração de PDF, log de auditoria, histórico de notificações enviadas.

## 9. Plano de Fase 2 (referência)

Não faz parte desta spec, mas para contexto:

- Endpoint `POST /api/juridico/clientes/:id/notificacoes/enviar` que dispara email via serviço (Resend sugerido).
- Tabela `cortex_core.juridico_notificacoes_enviadas` para auditoria (id, cliente_id, email_destinatario, corpo, enviado_em, enviado_por, status).
- Histórico por cliente na área expandida do card.
- Geração de PDF anexado ao email.
- Templates adicionais: protesto, ação judicial.

## 10. Referências

- Arquivo principal: `client/src/pages/JuridicoClientes.tsx:1036-1241` (card atual)
- Endpoint: `server/routes/juridico.ts` (`GET /api/juridico/clientes`)
- Schema: `"Conta Azul".caz_clientes` (colunas `email`, `endereco`, `cnpj`)
- Template fornecido: ver mensagem original do usuário (2026-04-23)
