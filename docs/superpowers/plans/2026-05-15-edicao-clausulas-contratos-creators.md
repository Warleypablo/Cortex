# Edição de Cláusulas — Contratos Creators — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao clicar "Enviar para Assinatura", exibir modal com as 12 cláusulas do contrato em accordion, permitindo edição individual antes de confirmar o envio.

**Architecture:** O backend expõe um novo endpoint GET que retorna os textos das cláusulas como JSON. A função `gerarContratoCreatorPDF` recebe um parâmetro opcional `clausulasOverride` para substituir textos. O frontend exibe um modal com accordion; ao confirmar, envia os overrides junto com a requisição de envio.

**Tech Stack:** TypeScript, React, React Query, Radix UI Accordion, shadcn Dialog, Tailwind CSS, PDFKit (backend), Express.

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `server/routes/creators.ts` | Modificar `gerarContratoCreatorPDF` (aceitar overrides), adicionar `gerarTextosClausulas`, novo endpoint GET `/clausulas`, modificar endpoint POST `enviar-assinatura` |
| `client/src/components/RevisarClausulasModal.tsx` | Criar — modal com accordion de cláusulas |
| `client/src/pages/Creators.tsx` | Modificar — substituir chamadas diretas de envio pelo modal, adaptar mutation |

---

## Task 1: Backend — `gerarTextosClausulas` + endpoint GET `/clausulas`

**Files:**
- Modify: `server/routes/creators.ts` (após linha 372, antes de `registerCreatorsRoutes`)
- Modify: `server/routes/creators.ts` (dentro de `registerCreatorsRoutes`, antes da linha do endpoint `preview-pdf`)

- [ ] **Step 1: Adicionar interface `ClausulaTexto` e função `gerarTextosClausulas`**

Inserir após a função `valorPorExtenso` (linha ~372), antes de `// ── Routes ──`:

```typescript
export interface ClausulaTexto {
  index: number;
  titulo: string;
  texto: string;
}

export function gerarTextosClausulas(data: ContratoCreatorPDFData): ClausulaTexto[] {
  const { contrato } = data;
  const valorNum = parseFloat((contrato.valor_remuneracao || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  const valorFormatado = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorExtenso = valorPorExtenso(valorNum);
  const prazoEntrega = 3;
  const prazoExtenso = numeroPorExtenso(prazoEntrega);
  const prazoAjustes = 3;
  const prazoAjustesExtenso = numeroPorExtenso(prazoAjustes);
  const clienteNome = contrato.cliente_nome || 'do cliente';
  const entregas = (contrato.descricao_servicos || '').split(/\n|;/).map(s => s.trim()).filter(Boolean);

  return [
    {
      index: 0,
      titulo: 'CLÁUSULA 1 - OBJETO',
      texto: [
        `1.1 O presente contrato tem por objeto a prestação de serviços de criação de conteúdo audiovisual publicitário, bem como a cessão de direitos de imagem e de utilização do conteúdo produzido, destinados à divulgação da marca ${clienteNome}.`,
        '1.2 O conteúdo deverá observar as diretrizes constantes no briefing de campanha, que passa a integrar o presente contrato como documento complementar.',
        '1.3 A CONTRATADA compromete-se a produzir:',
        ...(contrato.qtd_videos ? [`- ${contrato.qtd_videos} (${numeroPorExtenso(contrato.qtd_videos)}) vídeo(s) de conteúdo`] : []),
        ...(contrato.qtd_variacoes_gancho ? [`- ${contrato.qtd_variacoes_gancho} (${numeroPorExtenso(contrato.qtd_variacoes_gancho)}) variação(ões) de gancho`] : []),
        ...entregas.map(e => `- ${e}`),
      ].join('\n\n'),
    },
    {
      index: 1,
      titulo: 'CLÁUSULA 2 - DAS OBRIGAÇÕES DA CONTRATADA',
      texto: [
        '2.1. A CONTRATADA obriga-se a produzir o conteúdo objeto deste contrato em estrita conformidade com as diretrizes, orientações e especificações constantes no briefing de campanha fornecido pela CONTRATANTE, o qual passa a integrar o presente instrumento para todos os fins de direito.',
        '2.2. O conteúdo produzido deverá atender a padrões mínimos de qualidade técnica e editorial compatíveis com a finalidade publicitária da campanha, devendo observar, entre outros aspectos, adequada captação de áudio, iluminação suficiente para a correta visualização do produto, enquadramento apropriado da imagem e fidelidade às informações e características do produto ou serviço divulgado.',
        '2.3. A CONTRATADA compromete-se, ainda, a conduzir a produção do conteúdo de forma diligente e profissional, abstendo-se de realizar quaisquer manifestações, condutas ou inserções que possam comprometer a reputação, a imagem institucional ou os interesses comerciais da CONTRATANTE ou da marca objeto da campanha.',
        '2.4. A CONTRATANTE poderá solicitar ajustes técnicos ou editoriais no material entregue sempre que verificar desconformidade com o briefing, com os padrões de qualidade exigidos ou com as diretrizes da campanha, hipótese em que a CONTRATADA deverá proceder às adequações necessárias, sem custo adicional, nos termos deste contrato.',
      ].join('\n\n'),
    },
    {
      index: 2,
      titulo: 'CLÁUSULA 3 – DAS OBRIGAÇÕES DA CONTRATANTE',
      texto: [
        '3.1. Compete à CONTRATANTE fornecer à CONTRATADA todas as informações necessárias à adequada execução do conteúdo contratado, incluindo, entre outras, orientações relativas ao produto, forma de utilização, características, diferenciais e demais elementos relevantes para a correta elaboração do material.',
        '3.2. Constitui obrigação da CONTRATANTE encaminhar à CONTRATADA o(s) produto(s) objeto da campanha dentro do prazo previamente acordado entre as partes, de modo a não comprometer o cronograma de produção do conteúdo.',
        '3.3. A CONTRATANTE deverá disponibilizar à CONTRATADA o briefing da campanha, bem como quaisquer diretrizes, orientações ou materiais complementares necessários à correta execução do conteúdo.',
      ].join('\n\n'),
    },
    {
      index: 3,
      titulo: 'CLÁUSULA 4 – DO PRAZO DE ENTREGA',
      texto: [
        `4.1 A CONTRATADA obriga-se a produzir e entregar o conteúdo audiovisual previsto no briefing no prazo máximo de ${String(prazoEntrega).padStart(2, '0')} (${prazoExtenso}) dias corridos, contados do recebimento do produto objeto da campanha, comprovado por registro de entrega ou confirmação eletrônica.`,
        '4.2 É dever da CONTRATADA observar fielmente as condições descritas no OBJETO do presente contrato e seguir detalhamentos do Briefing de Conteúdos;',
        '4.3 Eventual prorrogação do prazo somente será admitida mediante concordância expressa da CONTRATANTE.',
        '4.4. O atraso injustificado na entrega do conteúdo contratado sujeitará a CONTRATADA ao pagamento de multa moratória no valor de R$ 150,00 (cento e cinquenta reais) por dia de atraso, limitada ao montante máximo equivalente a 10 (dez) vezes o valor da remuneração contratada, sem prejuízo:\n\nI – da possibilidade de rescisão imediata do contrato por inadimplemento;\nII – da cobrança de eventuais perdas e danos, nos termos dos arts. 389, 395 e 402 do Código Civil;\nIII – da obrigação de restituição de eventuais valores antecipados.',
      ].join('\n\n'),
    },
    {
      index: 4,
      titulo: 'CLÁUSULA 5 – DA AVALIAÇÃO, CORREÇÃO E REGRAVAÇÃO DO CONTEÚDO',
      texto: [
        '5.1. O conteúdo produzido será submetido à avaliação da CONTRATANTE, que verificará sua conformidade com o briefing, com as diretrizes da campanha e com os padrões técnicos exigidos.',
        '5.2. Caso o material apresentado não esteja em conformidade com as especificações da campanha ou apresente inconsistências técnicas ou editoriais, a CONTRATADA obriga-se a realizar as correções ou regravações necessárias.',
        '5.3. As adequações poderão compreender, entre outras medidas:\n\nI – regravação total ou parcial do conteúdo;\nII – correção de falas ou informações veiculadas;\nIII – ajustes técnicos de áudio, iluminação ou enquadramento;\nIV – adequação do roteiro às diretrizes da campanha.',
        `5.4. A nova versão do conteúdo deverá ser entregue no prazo máximo de ${String(prazoAjustes).padStart(2, '0')} (${prazoAjustesExtenso}) dias corridos, contados da solicitação de ajustes pela CONTRATANTE.`,
      ].join('\n\n'),
    },
    {
      index: 5,
      titulo: 'CLÁUSULA 6 – DOS PRODUTOS ENVIADOS PARA GRAVAÇÃO',
      texto: [
        '6.1. Os produtos enviados pela CONTRATANTE destinam-se exclusivamente à produção do conteúdo objeto deste contrato.',
        '6.2. A CONTRATADA será responsável pela guarda, conservação e utilização adequada dos produtos desde o momento do recebimento até a conclusão da campanha.',
        '6.3. A CONTRATADA responderá por eventuais danos, extravio ou deterioração dos produtos decorrentes de culpa, negligência ou uso inadequado.',
      ].join('\n\n'),
    },
    {
      index: 6,
      titulo: 'CLÁUSULA 7 – DA CESSÃO DE DIREITOS DE IMAGEM E CONTEÚDO',
      texto: [
        '7.1. A CONTRATADA autoriza a utilização de sua imagem, voz, nome e demais elementos de identificação pessoal pela CONTRATANTE, exclusivamente para fins de divulgação da campanha objeto deste contrato.',
        '7.2. A autorização de uso será válida pelo prazo de 12 (doze) meses, contado da aprovação final do conteúdo.',
        '7.3. Nos termos da Lei nº 9.610/1998, a CONTRATADA cede à CONTRATANTE os direitos patrimoniais de utilização do conteúdo produzido, limitados às finalidades e ao período previstos neste contrato.',
      ].join('\n\n'),
    },
    {
      index: 7,
      titulo: 'CLÁUSULA 8 – DA REMUNERAÇÃO',
      texto: [
        `8.1. Pela execução dos serviços objeto deste contrato, a CONTRATADA receberá a remuneração total de ${valorFormatado} (${valorExtenso}), além dos produtos utilizados para a gravação do conteúdo.`,
        '8.2. O pagamento da remuneração prevista neste contrato será realizado somente após a aprovação final do material pela CONTRATANTE, considerando-se eventuais ajustes ou alterações que forem solicitadas.',
        '8.3. A nota fiscal somente poderá ser emitida pela CONTRATADA após a aprovação do conteúdo pelo responsável designado pela CONTRATANTE.',
        '8.4. Após a emissão da nota fiscal, o pagamento será efetuado pela CONTRATANTE no prazo de até 07 (sete) dias úteis, contados do seu recebimento e da validação final do conteúdo entregue.',
      ].join('\n\n'),
    },
    {
      index: 8,
      titulo: 'CLÁUSULA 9 – DA CONFIDENCIALIDADE',
      texto: [
        '9.1. A CONTRATADA compromete-se a manter absoluto sigilo sobre quaisquer informações relacionadas à campanha, produtos, estratégias de marketing ou materiais promocionais fornecidos pela CONTRATANTE.',
        '9.2. É vedada a divulgação antecipada de produtos, campanhas ou quaisquer informações que ainda não tenham sido tornadas públicas.',
        '9.3. O descumprimento desta cláusula sujeitará a CONTRATADA ao pagamento de multa equivalente a 10 (dez) vezes o valor da remuneração contratada, sem prejuízo da indenização por eventuais danos.',
      ].join('\n\n'),
    },
    {
      index: 9,
      titulo: 'CLÁUSULA 10 – DA RESCISÃO',
      texto: [
        '10.1. Caso a CONTRATADA promova a rescisão do presente contrato sem justa causa antes da conclusão das obrigações assumidas, ficará sujeita ao pagamento de multa compensatória equivalente a 05 (cinco) vezes o valor total da remuneração contratada, sem prejuízo da reparação de eventuais prejuízos adicionais suportados pela CONTRATANTE.',
        'Parágrafo Primeiro. Esta ficará igualmente obrigada a devolver à CONTRATANTE, no prazo máximo de 03 (três) dias corridos, contados da comunicação da rescisão, todos os produtos que lhe tenham sido enviados para fins de produção do conteúdo.',
        '10.2. O não cumprimento do prazo de devolução previsto na cláusula anterior sujeitará a CONTRATADA ao pagamento de multa adicional diária de 20% (vinte por cento) equivalente ao valor do produto retido, até a efetiva devolução do produto, sem prejuízo da cobrança do valor integral correspondente ao bem caso este não seja restituído.',
      ].join('\n\n'),
    },
    {
      index: 10,
      titulo: 'CLÁUSULA 11 – DA NATUREZA JURÍDICA DA RELAÇÃO',
      texto: [
        '11.1. O presente contrato possui natureza estritamente civil, inexistindo vínculo empregatício entre as partes.',
        '11.2. A CONTRATADA atuará com autonomia técnica e organizacional, inexistindo relação de subordinação jurídica.',
      ].join('\n\n'),
    },
    {
      index: 11,
      titulo: 'CLÁUSULA 12 – DO FORO',
      texto: '12.1. Para dirimir quaisquer controvérsias decorrentes deste contrato, as partes elegem o Foro da Comarca de Vitória, Estado do Espírito Santo, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
    },
  ];
}
```

- [ ] **Step 2: Adicionar endpoint GET `/api/creators/contratos/:id/clausulas`**

Inserir dentro de `registerCreatorsRoutes`, imediatamente antes do endpoint `GET /api/creators/contratos/:id/preview-pdf` (linha ~666):

```typescript
  // GET /api/creators/contratos/:id/clausulas — Retorna textos das cláusulas como JSON
  app.get("/api/creators/contratos/:id/clausulas", async (req, res) => {
    try {
      const contratoId = parseInt(req.params.id);
      const result = await db.execute(sql`
        SELECT cc.*, c.nome, c.cpf, c.cnpj, c.email, c.endereco
        FROM cortex_core.contratos_creators cc
        JOIN cortex_core.creators c ON c.id = cc.creator_id
        WHERE cc.id = ${contratoId}
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }
      const row = result.rows[0] as any;
      const clausulas = gerarTextosClausulas({
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, email: row.email || undefined, endereco: row.endereco },
        contrato: {
          cargo: row.cargo || 'prestador de serviços',
          descricao_servicos: row.descricao_servicos || 'conforme acordado entre as partes',
          valor_remuneracao: row.valor_remuneracao?.toString() || '0',
          duracao_meses: row.duracao_meses || 6,
          data_inicio: row.data_inicio || '',
          data_fim: row.data_fim || '',
          qtd_videos: row.qtd_videos || undefined,
          qtd_variacoes_gancho: row.qtd_variacoes_gancho || undefined,
          unidade_prazo: row.unidade_prazo || 'meses',
          cliente_nome: row.cliente_nome || undefined,
          prazo_entrega_dias: row.prazo_entrega_dias || undefined,
        },
      });
      res.json(clausulas);
    } catch (error: any) {
      console.error("[creators] Erro ao gerar cláusulas:", error);
      res.status(500).json({ error: error.message });
    }
  });
```

- [ ] **Step 3: Reiniciar servidor e testar endpoint manualmente**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev &
sleep 3
curl -s http://localhost:3000/api/creators/contratos/1/clausulas | jq '.[0]'
```

Resultado esperado:
```json
{
  "index": 0,
  "titulo": "CLÁUSULA 1 - OBJETO",
  "texto": "1.1 O presente contrato tem por objeto..."
}
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/creators.ts
git commit -m "feat(creators): endpoint GET /clausulas retorna textos das cláusulas como JSON

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Backend — Modificar `gerarContratoCreatorPDF` + endpoint `enviar-assinatura`

**Files:**
- Modify: `server/routes/creators.ts` — função `gerarContratoCreatorPDF` (linha ~96) e endpoint POST `enviar-assinatura` (linha ~710)

- [ ] **Step 1: Alterar assinatura de `gerarContratoCreatorPDF` e adicionar helper `renderOverride`**

Alterar a linha 96 de:
```typescript
export async function gerarContratoCreatorPDF({ creator, contrato }: ContratoCreatorPDFData): Promise<Buffer> {
```
para:
```typescript
export async function gerarContratoCreatorPDF(
  { creator, contrato }: ContratoCreatorPDFData,
  clausulasOverride?: Record<number, string>
): Promise<Buffer> {
```

Logo após a definição do helper `romanItem` (linha ~133), adicionar:

```typescript
  const renderOverride = (texto: string) => {
    texto.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      if (line.startsWith('- ')) bullet(line.slice(2));
      else if (/^[IVX]+\s*[–-]/.test(line)) romanItem(line);
      else p(line, { spacing: 0.5 });
    });
    doc.moveDown(0.5);
  };
```

- [ ] **Step 2: Envolver cada cláusula com verificação de override**

Para cada uma das 12 cláusulas, substituir o bloco que começa com `heading('CLÁUSULA N ...')` pelo padrão abaixo. Os índices são 0 a 11 (na ordem em que as cláusulas aparecem na função).

**Padrão para Cláusula 1 (index 0)** — substituir de `// ── CLÁUSULA 1 - OBJETO ──` até `doc.moveDown(0.5)` (ao final dos bullets):

```typescript
  // ── CLÁUSULA 1 - OBJETO ──
  heading('CLÁUSULA 1 - OBJETO');
  if (clausulasOverride?.[0]) {
    renderOverride(clausulasOverride[0]);
  } else {
    p(`1.1 O presente contrato tem por objeto a prestação de serviços de criação de conteúdo audiovisual publicitário, bem como a cessão de direitos de imagem e de utilização do conteúdo produzido, destinados à divulgação da marca ${clienteNome}.`, { spacing: 0.5 });
    p('1.2 O conteúdo deverá observar as diretrizes constantes no briefing de campanha, que passa a integrar o presente contrato como documento complementar.', { spacing: 0.5 });
    p('1.3 A CONTRATADA compromete-se a produzir:', { spacing: 0.3 });
    if (contrato.qtd_videos) {
      bullet(`${contrato.qtd_videos} (${numeroPorExtenso(contrato.qtd_videos)}) vídeo(s) de conteúdo`);
    }
    if (contrato.qtd_variacoes_gancho) {
      bullet(`${contrato.qtd_variacoes_gancho} (${numeroPorExtenso(contrato.qtd_variacoes_gancho)}) variação(ões) de gancho`);
    }
    const entregas = contrato.descricao_servicos.split(/\n|;/).map(s => s.trim()).filter(Boolean);
    if (entregas.length > 0) {
      for (const entrega of entregas) { bullet(entrega); }
    } else if (!contrato.qtd_videos && !contrato.qtd_variacoes_gancho) {
      bullet('Conteúdo conforme briefing de campanha.');
    }
    doc.moveDown(0.5);
  }
```

**Padrão para Cláusulas 2 a 12 (índices 1 a 11):**

O procedimento é idêntico para as 11 cláusulas restantes: adicionar `heading(...)` + `if/else` ao redor do bloco existente, sem alterar nada dentro do `else`. Não há código novo no `else` — o código original permanece intacto.

Para cada cláusula, o resultado final fica:

```typescript
  heading('<TITULO DA CLÁUSULA>');  // já existia — não alterar
  if (clausulasOverride?.[N]) {
    renderOverride(clausulasOverride[N]);
  } else {
    // aqui fica o bloco original de p(), bullet(), romanItem() exatamente como está hoje
  }
```

Mapeamento de índices (N) para cada `heading()` existente no arquivo:

| N | Heading exato no código (procurar com Ctrl+F) |
|---|----------------------------------------------|
| 1 | `'CLÁUSULA 2 - DAS OBRIGAÇÕES DA CONTRATADA'` |
| 2 | `'CLÁUSULA 3 – DAS OBRIGAÇÕES DA CONTRATANTE'` |
| 3 | `'CLÁUSULA 4 – DO PRAZO DE ENTREGA'` |
| 4 | `'CLÁUSULA 5 – DA AVALIAÇÃO, CORREÇÃO E REGRAVAÇÃO DO CONTEÚDO'` |
| 5 | `'CLÁUSULA 6 – DOS PRODUTOS ENVIADOS PARA GRAVAÇÃO'` |
| 6 | `'CLÁUSULA 7 – DA CESSÃO DE DIREITOS DE IMAGEM E CONTEÚDO'` |
| 7 | `'CLÁUSULA 8 – DA REMUNERAÇÃO'` |
| 8 | `'CLÁUSULA 9 – DA CONFIDENCIALIDADE'` |
| 9 | `'CLÁUSULA 10 – DA RESCISÃO'` |
| 10 | `'CLÁUSULA 11 – DA NATUREZA JURÍDICA DA RELAÇÃO'` |
| 11 | `'CLÁUSULA 12 – DO FORO'` |

Cada heading chama `doc.moveDown(...)` ao final do bloco — esse `moveDown` deve ficar dentro do `else`, preservando o comportamento original. Os índices mapeiam:

| Cláusula | Índice | Heading no código |
|----------|--------|-------------------|
| CLÁUSULA 3 | 2 | `'CLÁUSULA 3 – DAS OBRIGAÇÕES DA CONTRATANTE'` |
| CLÁUSULA 4 | 3 | `'CLÁUSULA 4 – DO PRAZO DE ENTREGA'` |
| CLÁUSULA 5 | 4 | `'CLÁUSULA 5 – DA AVALIAÇÃO...'` |
| CLÁUSULA 6 | 5 | `'CLÁUSULA 6 – DOS PRODUTOS...'` |
| CLÁUSULA 7 | 6 | `'CLÁUSULA 7 – DA CESSÃO...'` |
| CLÁUSULA 8 | 7 | `'CLÁUSULA 8 – DA REMUNERAÇÃO'` |
| CLÁUSULA 9 | 8 | `'CLÁUSULA 9 – DA CONFIDENCIALIDADE'` |
| CLÁUSULA 10 | 9 | `'CLÁUSULA 10 – DA RESCISÃO'` |
| CLÁUSULA 11 | 10 | `'CLÁUSULA 11 – DA NATUREZA JURÍDICA...'` |
| CLÁUSULA 12 | 11 | `'CLÁUSULA 12 – DO FORO'` |

- [ ] **Step 3: Modificar endpoint `POST /api/creators/contratos/:id/enviar-assinatura` para aceitar `clausulasEditadas`**

No endpoint (linha ~710), logo após `const contratoId = parseInt(req.params.id);`, adicionar:

```typescript
    const clausulasEditadas: Record<number, string> | undefined = req.body?.clausulasEditadas;
```

Em seguida, na chamada a `gerarContratoCreatorPDF` neste endpoint (linha ~747), alterar:

```typescript
      const pdfBuffer = await gerarContratoCreatorPDF({
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, email: row.email || undefined, endereco: row.endereco },
        contrato: {
          cargo: row.cargo || 'prestador de serviços',
          descricao_servicos: row.descricao_servicos || 'conforme acordado entre as partes',
          valor_remuneracao: row.valor_remuneracao?.toString() || '0',
          duracao_meses: row.duracao_meses || 6,
          data_inicio: row.data_inicio || '',
          data_fim: row.data_fim || '',
          qtd_videos: row.qtd_videos || undefined,
          qtd_variacoes_gancho: row.qtd_variacoes_gancho || undefined,
          unidade_prazo: row.unidade_prazo || 'meses',
          cliente_nome: row.cliente_nome || undefined,
          prazo_entrega_dias: row.prazo_entrega_dias || undefined,
        }
      });
```

para:

```typescript
      const pdfBuffer = await gerarContratoCreatorPDF({
        creator: { nome: row.nome, cpf: row.cpf, cnpj: row.cnpj, email: row.email || undefined, endereco: row.endereco },
        contrato: {
          cargo: row.cargo || 'prestador de serviços',
          descricao_servicos: row.descricao_servicos || 'conforme acordado entre as partes',
          valor_remuneracao: row.valor_remuneracao?.toString() || '0',
          duracao_meses: row.duracao_meses || 6,
          data_inicio: row.data_inicio || '',
          data_fim: row.data_fim || '',
          qtd_videos: row.qtd_videos || undefined,
          qtd_variacoes_gancho: row.qtd_variacoes_gancho || undefined,
          unidade_prazo: row.unidade_prazo || 'meses',
          cliente_nome: row.cliente_nome || undefined,
          prazo_entrega_dias: row.prazo_entrega_dias || undefined,
        }
      }, clausulasEditadas);
```

- [ ] **Step 4: Reiniciar servidor e verificar que o preview-pdf ainda funciona**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev &
sleep 3
# Abrir no browser: http://localhost:3000 → aba Contratos Creators → visualizar PDF de um contrato existente
# PDF deve ser gerado sem erros
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/creators.ts
git commit -m "feat(creators): gerarContratoCreatorPDF aceita clausulasOverride para personalizar PDF

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Frontend — Criar `RevisarClausulasModal`

**Files:**
- Create: `client/src/components/RevisarClausulasModal.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pencil, X, Check, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ClausulaTexto {
  index: number;
  titulo: string;
  texto: string;
}

interface RevisarClausulasModalProps {
  contratoId: number | null;
  creatorNome: string;
  open: boolean;
  onClose: () => void;
  onConfirmar: (clausulasEditadas: Record<number, string>) => void;
  isPending: boolean;
}

export function RevisarClausulasModal({
  contratoId,
  creatorNome,
  open,
  onClose,
  onConfirmar,
  isPending,
}: RevisarClausulasModalProps) {
  const [textosEditados, setTextosEditados] = useState<Record<number, string>>({});
  const [clausulaEditando, setClausulaEditando] = useState<number | null>(null);
  const [textoRascunho, setTextoRascunho] = useState("");

  const { data: clausulas = [], isLoading } = useQuery<ClausulaTexto[]>({
    queryKey: ["/api/creators/contratos", contratoId, "clausulas"],
    queryFn: async () => {
      const res = await fetch(`/api/creators/contratos/${contratoId}/clausulas`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar cláusulas");
      return res.json();
    },
    enabled: open && contratoId !== null,
  });

  const iniciarEdicao = (clausula: ClausulaTexto) => {
    setClausulaEditando(clausula.index);
    setTextoRascunho(textosEditados[clausula.index] ?? clausula.texto);
  };

  const salvarEdicao = (index: number) => {
    setTextosEditados(prev => ({ ...prev, [index]: textoRascunho }));
    setClausulaEditando(null);
  };

  const cancelarEdicao = () => {
    setClausulaEditando(null);
    setTextoRascunho("");
  };

  const handleConfirmar = () => {
    onConfirmar(textosEditados);
  };

  const handleClose = () => {
    setTextosEditados({});
    setClausulaEditando(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Revisar Cláusulas — {creatorNome}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {clausulas.map((clausula) => {
                const editado = clausulaEditando !== clausula.index && textosEditados[clausula.index] !== undefined;
                const emEdicao = clausulaEditando === clausula.index;

                return (
                  <AccordionItem key={clausula.index} value={String(clausula.index)}>
                    <AccordionTrigger className="text-sm font-medium text-left gap-2">
                      <span className="flex-1 text-left">{clausula.titulo}</span>
                      {editado && (
                        <Badge variant="secondary" className="text-xs shrink-0 mr-2">
                          Editada
                        </Badge>
                      )}
                    </AccordionTrigger>
                    <AccordionContent>
                      {emEdicao ? (
                        <div className="space-y-2">
                          <Textarea
                            value={textoRascunho}
                            onChange={(e) => setTextoRascunho(e.target.value)}
                            rows={10}
                            className="text-sm font-mono resize-y"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelarEdicao}
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => salvarEdicao(clausula.index)}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Salvar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {textosEditados[clausula.index] ?? clausula.texto}
                          </p>
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => iniciarEdicao(clausula)}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>

        <DialogFooter className="border-t pt-4 mt-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={isPending || isLoading}>
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Confirmar e Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar que o arquivo TypeScript compila sem erros**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep RevisarClausulasModal
```

Resultado esperado: nenhuma saída (sem erros).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RevisarClausulasModal.tsx
git commit -m "feat(creators): componente RevisarClausulasModal com accordion de cláusulas

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Frontend — Wiring do modal em `Creators.tsx`

**Files:**
- Modify: `client/src/pages/Creators.tsx`

- [ ] **Step 1: Adicionar import do modal**

No topo do arquivo, após os imports existentes, adicionar:

```typescript
import { RevisarClausulasModal } from "@/components/RevisarClausulasModal";
```

- [ ] **Step 2: Adicionar estado do modal**

Próximo aos outros estados do componente (após linha ~303), adicionar:

```typescript
  const [revisarClausulas, setRevisarClausulas] = useState<{
    contratoId: number;
    creatorNome: string;
  } | null>(null);
```

- [ ] **Step 3: Modificar a mutation `enviarAssinatura` para aceitar `clausulasEditadas`**

Substituir o `mutationFn` atual (linha ~420):

```typescript
  const enviarAssinatura = useMutation({
    mutationFn: async (contratoId: number) => {
      const res = await apiRequest("POST", `/api/creators/contratos/${contratoId}/enviar-assinatura`);
      return res.json();
    },
```

por:

```typescript
  const enviarAssinatura = useMutation({
    mutationFn: async ({ contratoId, clausulasEditadas }: { contratoId: number; clausulasEditadas: Record<number, string> }) => {
      const body = Object.keys(clausulasEditadas).length > 0 ? { clausulasEditadas } : undefined;
      const res = await apiRequest("POST", `/api/creators/contratos/${contratoId}/enviar-assinatura`, body);
      return res.json();
    },
```

- [ ] **Step 4: Atualizar `onSuccess` e `onError` da mutation**

No `onSuccess` a variável `data` já vem corretamente. Não há mudança necessária no body de `onSuccess`/`onError`. Apenas adicionar o reset do modal:

```typescript
    onSuccess: (data: any) => {
      toast({ title: "Contrato enviado!", description: `Email: ${data.emailEnviado}` });
      queryClient.invalidateQueries({ queryKey: ["/api/creators/contratos/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creators", selectedCreator?.id, "contratos"] });
      setContratoDialogOpen(false);
      setContratoCriadoId(null);
      setRevisarClausulas(null); // fechar modal
    },
```

- [ ] **Step 5: Substituir os 3 botões "Enviar" por abertura do modal**

**Botão 1 — Tab "Todos os Contratos" (linha ~776):**

Substituir:
```typescript
onClick={() => enviarAssinatura.mutate(ct.id)}
```
por:
```typescript
onClick={() => setRevisarClausulas({ contratoId: ct.id, creatorNome: ct.creator_nome })}
```

**Botão 2 — Tab por Creator — cards de contratos (linha ~923):**

Substituir:
```typescript
onClick={() => enviarAssinatura.mutate(ct.id)}
```
por:
```typescript
onClick={() => setRevisarClausulas({ contratoId: ct.id, creatorNome: selectedCreator?.nome ?? '' })}
```

**Botão 3 — Dialog de criação de contrato (linha ~1057):**

Substituir:
```typescript
onClick={() => enviarAssinatura.mutate(contratoCriadoId)}
```
por:
```typescript
onClick={() => {
  if (contratoCriadoId) {
    setRevisarClausulas({ contratoId: contratoCriadoId, creatorNome: selectedCreator?.nome ?? '' });
  }
}}
```

- [ ] **Step 6: Adicionar o `<RevisarClausulasModal>` no JSX**

Imediatamente antes do `</div>` final do componente (ou antes do último `</>` do return), adicionar:

```tsx
      <RevisarClausulasModal
        contratoId={revisarClausulas?.contratoId ?? null}
        creatorNome={revisarClausulas?.creatorNome ?? ''}
        open={revisarClausulas !== null}
        onClose={() => setRevisarClausulas(null)}
        onConfirmar={(clausulasEditadas) => {
          if (revisarClausulas) {
            enviarAssinatura.mutate({ contratoId: revisarClausulas.contratoId, clausulasEditadas });
          }
        }}
        isPending={enviarAssinatura.isPending}
      />
```

- [ ] **Step 7: Verificar compilação TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep -E "error|Creators"
```

Resultado esperado: nenhum erro.

- [ ] **Step 8: Testar no browser**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev
```

Abrir `http://localhost:3000`, navegar até a aba **Contratos Creators**:

1. Clicar em "Enviar" em um contrato com status `rascunho`
2. Modal deve abrir com título "Revisar Cláusulas — [Nome do Creator]"
3. Todas as 12 cláusulas aparecem colapsadas no accordion
4. Expandir cláusula → texto aparece + botão "Editar"
5. Clicar "Editar" → textarea com o texto da cláusula
6. Editar o texto → clicar "Salvar" → badge "Editada" aparece no header
7. Clicar "Confirmar e Enviar" → spinner aparece, contrato é enviado, modal fecha

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/Creators.tsx
git commit -m "feat(creators): modal de revisão de cláusulas antes do envio para assinatura

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Push e PR**

```bash
git push origin HEAD
```
