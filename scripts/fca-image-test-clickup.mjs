// Teste ponta-a-ponta do FCA v5: cria task → sobe PNG via multipart (REST ClickUp)
// → embute a imagem INLINE no markdown_description + FATO/CAUSA/AÇÃO.
// Espelha o que o endpoint /api/fca/run vai fazer. Uso: node scripts/fca-image-test-clickup.mjs
import { readFileSync } from 'fs';

const PNG = '/private/tmp/claude-501/-Users-ichino-Projects-Cortex-Cortex/3641c4cb-0caa-4c53-a635-c86e29bea92a/scratchpad/fca-creators-meta-7d.png';
const env = readFileSync('/Users/ichino/Projects/Cortex/Cortex/.env', 'utf8');
const TOKEN = env.match(/^CLICKUP_API_KEY=(.+)$/m)[1].trim();
const LIST = '901322140780';           // Relatórios de mídia
const ICHINO = 55120346;
const API = 'https://api.clickup.com/api/v2';

// 1) cria a task (descrição provisória — atualiza depois com a URL da imagem)
const created = await (await fetch(`${API}/list/${LIST}/task`, {
  method: 'POST',
  headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '[TESTE v5] FCA Creators × Meta — imagem inline',
    markdown_description: '_gerando…_',
    assignees: [ICHINO],
  }),
})).json();
console.log('task criada:', created.id, created.url);

// 2) sobe o PNG via multipart → devolve a URL clickup-attachments.com
const buf = readFileSync(PNG);
const fd = new FormData();
fd.append('attachment', new Blob([buf], { type: 'image/png' }), 'fca-creators-meta-7d.png');
const att = await (await fetch(`${API}/task/${created.id}/attachment`, {
  method: 'POST',
  headers: { Authorization: TOKEN },   // sem Content-Type: o FormData define o boundary
  body: fd,
})).json();
console.log('imagem enviada:', att.url);

// 3) monta a descrição final com a imagem INLINE (![](url)) + FATO/CAUSA/AÇÃO
const md = `# [FCA] Creators × Meta Ads — 7D (23–29/jun)

**Período:** 23/06 a 29/06 — Últimos 7D

![Orçado × Realizado — Aprofundado · Creators × Meta · 7D](${att.url})

### Fato

*   **%RA MQL: 13,8% → −54% abaixo do orçado** (meta 30%) 🔴
*   **No-show Não-MQL: 40% → 8× a meta** (meta 5%) 🔴

### Causa

**O que está BOM (topo saudável — descarta Growth):**

*   **CPMQL R$ 159 vs R$ 182 (−12,7%)** 🟢 → mídia entrega MQL barato.
*   **% MQL 48,2% vs 40% (+20,5%)** 🟢 → qualidade do lead ótima.
*   **Tx Conversão da Página 17% vs 15%** 🟢 → LP convertendo acima do orçado.

**Onde está o gargalo:**

1.  **%RA MQL 13,8% vs 30% (−54%)** 🔴 — vilão principal. O MQL bom chega, mas mais da metade não é atendido/agendado.
2.  **No-show Não-MQL 40% vs 5%** 🔴 — de quem agenda, boa parte não comparece.

**Leitura:** o problema não é Growth (mídia barata e qualifica bem) — é **pré-vendas não atendendo/confirmando**. O funil quebra no atendimento, não no topo.

### Ação

- [ ] **Escalar pra pré-vendas (maior alavanca):** 1:1 com o responsável levando o %RA MQL 13,8%; acordar SLA de atendimento.
- [ ] **Atacar no-show:** confirmação D-1 + lembrete no dia da reunião.
- [ ] **Proteger o topo:** manter o que segura CPMQL/%MQL — não mexer na mídia.
- [ ] _Hipótese p/ próxima FCA: "subindo %RA pra 30%, os MQLs viram reunião e o CAC cai" — a próxima cobra._

🤖 FCA v5 — imagem do Aprofundado renderizada + FATO/CAUSA/AÇÃO`;

await fetch(`${API}/task/${created.id}`, {
  method: 'PUT',
  headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ markdown_description: md }),
});
console.log('\n✅ pronto →', created.url);
