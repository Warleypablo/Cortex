# Notas Fiscais Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dashboard inside Financeiro that extracts values from PDF invoices (notas fiscais), stores results in the database, and displays KPIs, charts, per-category/per-provider breakdowns, and a conciliation view against Conta Azul.

**Architecture:** Upload PDFs or scan a local folder → extract text with `pdf-parse` → match values via regex patterns (ported from Python script) → store in `cortex_core.notas_fiscais` → serve via REST endpoints → render on a React dashboard with Recharts.

**Tech Stack:** pdf-parse (text extraction), multer (file upload), Express routes, PostgreSQL (cortex_core schema), React + Recharts + Tailwind + shadcn/ui.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install pdf-parse and multer**

```bash
npm install pdf-parse multer @types/multer
```

**Step 2: Verify installation**

```bash
cat package.json | grep -E "pdf-parse|multer"
```

Expected: both packages listed in dependencies.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pdf-parse and multer for NF processing"
```

---

## Task 2: Create database table

**Files:**
- Modify: `server/db.ts` — add `initializeNotasFiscaisTable()` function
- Modify: `server/index.ts` or wherever DB init functions are called

**Step 1: Add table initialization function to `server/db.ts`**

Add after the last `export async function initialize*` function:

```typescript
export async function initializeNotasFiscaisTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.notas_fiscais (
        id SERIAL PRIMARY KEY,
        mes VARCHAR(20) NOT NULL,
        mes_num INTEGER NOT NULL,
        ano INTEGER NOT NULL DEFAULT 2026,
        categoria VARCHAR(50) NOT NULL,
        arquivo VARCHAR(500) NOT NULL,
        prestador VARCHAR(255),
        valor_brl NUMERIC(18,2),
        moeda_original VARCHAR(5) DEFAULT 'BRL',
        padrao_usado VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',
        cnpj_prestador VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(ano, mes_num, categoria, arquivo)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_notas_fiscais_ano_mes
      ON cortex_core.notas_fiscais(ano, mes_num)
    `);
    console.log('[database] notas_fiscais table initialized');
  } catch (error) {
    console.error('[database] Error initializing notas_fiscais table:', error);
  }
}
```

**Step 2: Call the init function at startup**

Find where other `initialize*` functions are called (likely `server/index.ts` or the startup sequence in `server/routes.ts`) and add:

```typescript
await initializeNotasFiscaisTable();
```

**Step 3: Commit**

```bash
git add server/db.ts server/index.ts
git commit -m "feat(nf): create cortex_core.notas_fiscais table"
```

---

## Task 3: Port PDF extraction engine to TypeScript

**Files:**
- Create: `server/services/nfExtractor.ts`

This is the core engine, ported from `attached_assets/2026/extrair_notas.py`. It must reproduce all ~30 regex patterns for BRL and USD value extraction.

**Step 1: Create `server/services/nfExtractor.ts`**

```typescript
/**
 * NF Value Extraction Engine
 * Ported from attached_assets/2026/extrair_notas.py
 * Extracts monetary values from PDF invoice text using regex patterns.
 */
import pdf from "pdf-parse";

const CAMBIO_USD_BRL = 6.0;

// ---- Value Parsers ----

export function parseBRL(valueStr: string): number | null {
  if (!valueStr) return null;
  let cleaned = valueStr.trim().replace(/\s/g, "");
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts[parts.length - 1].length > 2) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }
  const val = parseFloat(cleaned);
  if (isNaN(val) || val < 0) return null;
  return val;
}

export function parseUSD(valueStr: string): number | null {
  if (!valueStr) return null;
  const cleaned = valueStr.trim().replace(/[\s,$]/g, "");
  const val = parseFloat(cleaned);
  if (isNaN(val) || val < 0) return null;
  return val;
}

function smartParseValue(raw: string): number | null {
  if (!raw) return null;
  if (raw.includes(",") && raw.includes(".")) {
    const commaPos = raw.lastIndexOf(",");
    const dotPos = raw.lastIndexOf(".");
    return commaPos < dotPos ? parseUSD(raw) : parseBRL(raw);
  }
  return parseBRL(raw);
}

// ---- Regex Patterns ----
// Each: [regex, currency, description]

type PatternEntry = [RegExp, string, string];

const PATTERNS_BRL: PatternEntry[] = [
  // GRUPO 1: Valor Líquido (prioridade máxima)
  [/Valor\s+L[ií]quido\s+da\s+NFS-?e\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Liquido da NFS-e (mesma linha)"],
  [/Valor\s+L[ií]quido\s+da\s+NFS-?e\s*[-\s]*R\$([\d.,]+)/is, "BRL", "Valor Liquido da NFS-e (prox linha)"],
  [/VALOR\s+L[IÍ]QUIDO\s+DA\s+NOTA\s+FISCAL\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Liquido da Nota Fiscal"],
  [/VALOR\s+L[IÍ]QUIDO\s*[:=]\s*R\$\s*([\d.,]+)/i, "BRL", "VALOR LIQUIDO"],
  [/Valor\s+l[ií]quido\s*=\s*R\$\s*([\d.,]+)/i, "BRL", "Valor liquido = R$"],
  [/Vl\.\s*L[ií]quido\s+(?:da\s+)?Nota\s+Fiscal\s*R?\$?\s*([\d.,]+)/i, "BRL", "Vl. Liquido da Nota Fiscal"],
  [/Valor\s+L[ií]quido\s+([\d][\d.,]*)/i, "BRL", "Valor Liquido (sem R$)"],

  // GRUPO 2: Valor Total da Nota / NFS-e
  [/VALOR\s+TOTAL\s+RECEBIDO\s*=?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Total Recebido"],
  [/VALOR\s+TOTAL\s+DA\s+NOTA\s+FISCAL\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Total da Nota Fiscal"],
  [/Valor\s+Total\s+dos\s+Servi[çc]os\s*\n\s*([\d.,]+)/i, "BRL", "Valor Total dos Servicos (prox linha)"],
  [/Valor\s+Total\s+da\s+Nota\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Total da Nota (com R$)"],
  [/Valor\s+Total\s+da\s+Nota\s*[:=]\s*([\d][\d.,]*)/i, "BRL", "Valor Total da Nota (sem R$)"],
  [/Valor\s+Total\s+da\s+NFS-?e\s+([\d.,]+)/i, "BRL", "Valor Total da NFS-e (inline)"],
  [/VALOR\s+TOTAL\s+DO\s+SERVI[CÇ]O\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor Total do Servico"],
  [/Valor\s+Total\s+do\s+Documento\s*[:=]?\s*R?\$?\s*([\d.,]+)/i, "BRL", "Valor Total do Documento"],

  // GRUPO 3: Formatos concatenados (Vitória)
  [/VALORTOTALDANFS-?E.*?R\$([\d.,]+)/is, "BRL", "VALORTOTALDANFS-E (Vitoria)"],
  [/Valordoservi[çc]o.*?R\$([\d.,]+)/is, "BRL", "ValordoServico (Vitoria)"],

  // GRUPO 4: NFS-e Vila Velha / Cariacica
  [/VALOR\s+TOTAL\s+DA\s+NFS-?E.*?R\$([\d.,]+)/is, "BRL", "VALOR TOTAL DA NFS-E (espacos)"],
  [/Valor\s+do\s+Servi[çc]o\s+Desconto\s+Condicionado.*?R\$([\d.,]+)/is, "BRL", "Valor do Servico (Vila Velha)"],

  // GRUPO 5: Faturas e contas
  [/Valor\s+fatura\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor fatura"],
  [/Valor\s+devido\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Valor devido"],
  [/Total\s+a\s+Pagar\s*[-:=]?\s*R?\$?\s*([\d.,]+)/i, "BRL", "Total a Pagar"],
  [/Total\s+a\s+Recolher\s*[:=]?\s*R\$\s*([\d.,]+)/i, "BRL", "Total a Recolher"],
  [/TOTAL\s+A\s+PAGAR\s*([\d.,]+)/i, "BRL", "TOTAL A PAGAR"],
  [/Valor\s+Total\s*[:=]\s*R?\$?\s*([\d.,]+)/i, "BRL", "Valor Total"],
  [/\nValor:\s*([\d.,]+)/i, "BRL", "Valor: (boleto)"],

  // GRUPO 6: EDP energia
  [/(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/\d{4}\s+\d{2}\/\d{2}\/\d{4}\s+R\$\s*([\d.,]+)/i, "BRL", "EDP Energia"],

  // GRUPO 8: Boleto (quantidade + R$)
  [/\n1\s+R\$\s*([\d.,]+)/i, "BRL", "Boleto (1 R$)"],
];

const PATTERNS_USD: PatternEntry[] = [
  [/Amount\s+due\s*\$?\s*([\d.,]+)/i, "USD", "Amount due (USD)"],
  [/Total\s+amount\s*([\d.,]+)\s*USD/i, "USD", "Total amount USD"],
];

// ---- Main Extraction ----

export function extractValueFromText(text: string): { valor: number | null; moeda: string; padrao: string } {
  if (!text) return { valor: null, moeda: "", padrao: "" };

  // Try BRL patterns first
  for (const [pattern, currency, desc] of PATTERNS_BRL) {
    const match = pattern.exec(text);
    if (match) {
      const value = smartParseValue(match[1]);
      if (value !== null && value > 0) {
        return { valor: value, moeda: "BRL", padrao: desc };
      }
    }
  }

  // Try USD patterns
  for (const [pattern, currency, desc] of PATTERNS_USD) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseUSD(match[1]);
      if (value !== null && value > 0) {
        return { valor: Math.round(value * CAMBIO_USD_BRL * 100) / 100, moeda: "USD", padrao: desc };
      }
    }
  }

  // Fallback: Valor Líquido in table header, value in data line
  const vlHeader = /Valor\s+L[ií]quido\s*\n([\d.,\s]+)/i.exec(text);
  if (vlHeader) {
    const numbers = vlHeader[1].trim().match(/[\d.,]+/g);
    if (numbers) {
      const value = smartParseValue(numbers[numbers.length - 1]);
      if (value !== null && value > 0) return { valor: value, moeda: "BRL", padrao: "Valor Liquido (tabela, ultimo)" };
    }
  }

  // Fallback: NFe - VALOR TOTAL DA NOTA followed by multiple R$
  const nfeMatch = /VALOR\s+TOTAL\s+DA\s+NOTA\s*\n(.*)/i.exec(text);
  if (nfeMatch) {
    const allValues = [...nfeMatch[1].matchAll(/R\$\s*([\d.,]+)/g)].map(m => m[1]);
    if (allValues.length > 0) {
      const value = smartParseValue(allValues[allValues.length - 1]);
      if (value !== null && value > 0) return { valor: value, moeda: "BRL", padrao: "VALOR TOTAL DA NOTA (NFe ultimo)" };
    }
  }

  // Fallback: Valor Total do Documento on next line
  const dasMatch = /Valor\s+Total\s+do\s+Documento\s*\n\s*([\d.,]+)/i.exec(text);
  if (dasMatch) {
    const value = smartParseValue(dasMatch[1]);
    if (value !== null && value > 0) return { valor: value, moeda: "BRL", padrao: "Valor Total do Documento (prox linha)" };
  }

  // Fallback: largest R$ in text (excluding tributo/multa/juros lines)
  let bestVal = 0;
  for (const line of text.split("\n")) {
    const ll = line.toLowerCase();
    if (["tributo", "multa", "juros", "aproximado", "vencimento"].some(k => ll.includes(k))) continue;
    for (const m of line.matchAll(/R\$\s*([\d.]+,\d{2})/g)) {
      const v = smartParseValue(m[1]);
      if (v && v > bestVal) bestVal = v;
    }
  }
  if (bestVal > 0) return { valor: bestVal, moeda: "BRL", padrao: "Maior R$ encontrado (fallback)" };

  return { valor: null, moeda: "", padrao: "" };
}

// ---- PDF Processing ----

export async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; status: string }> {
  try {
    const data = await pdf(buffer);
    if (data.text && data.text.trim().length > 0) {
      return { text: data.text, status: "OK" };
    }
    return { text: "", status: "SEM_TEXTO" };
  } catch (e: any) {
    const msg = String(e.message || "").toLowerCase();
    if (msg.includes("password") || msg.includes("encrypt")) {
      return { text: "", status: "PROTEGIDO" };
    }
    return { text: "", status: `ERRO: ${e.message}` };
  }
}

export function extractPrestadorFromFilename(filename: string): string {
  // Pattern: "NOME COMPLETO - Nfs XX.pdf" or "NOME - algo.pdf"
  const match = filename.match(/^(.+?)\s*-\s*/);
  return match ? match[1].trim() : filename.replace(/\.pdf$/i, "").trim();
}
```

**Step 2: Verify the module compiles**

```bash
npx tsc --noEmit server/services/nfExtractor.ts 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add server/services/nfExtractor.ts
git commit -m "feat(nf): port PDF extraction engine from Python to TypeScript"
```

---

## Task 4: Create backend endpoints

**Files:**
- Modify: `server/routes.ts` — add NF endpoints after the OKR section
- The endpoints use the extractor from Task 3

**Step 1: Add endpoints to `server/routes.ts`**

Add these after the OKR/BP section, before the closing of `registerRoutes`:

```typescript
// ==================== NOTAS FISCAIS ====================

import multer from "multer";
const nfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/notas-fiscais/upload — Upload and process PDF files
app.post("/api/notas-fiscais/upload", isAuthenticated, nfUpload.array("files", 50), async (req, res) => {
  try {
    const { extractTextFromPDF, extractValueFromText, extractPrestadorFromFilename } = await import("./services/nfExtractor");
    const { mes, mes_num, categoria, ano } = req.body;
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: "No files uploaded" });

    const results = [];
    for (const file of files) {
      const { text, status: pdfStatus } = await extractTextFromPDF(file.buffer);
      let valor: number | null = null;
      let moeda = "";
      let padrao = "";
      let status = pdfStatus;

      if (pdfStatus === "OK") {
        const extracted = extractValueFromText(text);
        valor = extracted.valor;
        moeda = extracted.moeda;
        padrao = extracted.padrao;
        if (valor === null) status = "VALOR NÃO ENCONTRADO";
      }

      const prestador = extractPrestadorFromFilename(file.originalname);

      await db.execute(sql`
        INSERT INTO cortex_core.notas_fiscais (mes, mes_num, ano, categoria, arquivo, prestador, valor_brl, moeda_original, padrao_usado, status)
        VALUES (${mes}, ${parseInt(mes_num)}, ${parseInt(ano || "2026")}, ${categoria}, ${file.originalname}, ${prestador}, ${valor}, ${moeda}, ${padrao}, ${status})
        ON CONFLICT (ano, mes_num, categoria, arquivo) DO UPDATE SET
          valor_brl = EXCLUDED.valor_brl, moeda_original = EXCLUDED.moeda_original,
          padrao_usado = EXCLUDED.padrao_usado, status = EXCLUDED.status, prestador = EXCLUDED.prestador,
          created_at = NOW()
      `);
      results.push({ arquivo: file.originalname, valor_brl: valor, status, prestador });
    }
    res.json({ processed: results.length, results });
  } catch (error) {
    console.error("[api] Error uploading NFs:", error);
    res.status(500).json({ error: "Failed to process uploaded files" });
  }
});

// POST /api/notas-fiscais/scan-local — Scan local folder (admin only)
app.post("/api/notas-fiscais/scan-local", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { extractTextFromPDF, extractValueFromText, extractPrestadorFromFilename } = await import("./services/nfExtractor");
    const fs = await import("fs/promises");
    const path = await import("path");

    const baseDir = path.default.join(process.cwd(), "attached_assets", "2026");
    const monthDirs = (await fs.default.readdir(baseDir, { withFileTypes: true }))
      .filter(d => d.isDirectory() && /^\d{2}\s*-\s*/.test(d.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    let totalProcessed = 0;
    let totalErrors = 0;

    for (const monthDir of monthDirs) {
      const mesNum = parseInt(monthDir.name.substring(0, 2));
      const monthPath = path.default.join(baseDir, monthDir.name);
      const catDirs = (await fs.default.readdir(monthPath, { withFileTypes: true }))
        .filter(d => d.isDirectory());

      for (const catDir of catDirs) {
        const catPath = path.default.join(monthPath, catDir.name);
        const files = (await fs.default.readdir(catPath))
          .filter(f => f.toLowerCase().endsWith(".pdf"));

        for (const filename of files) {
          const filePath = path.default.join(catPath, filename);
          const buffer = await fs.default.readFile(filePath);
          const { text, status: pdfStatus } = await extractTextFromPDF(buffer);

          let valor: number | null = null;
          let moeda = "";
          let padrao = "";
          let status = pdfStatus;

          if (pdfStatus === "OK") {
            const extracted = extractValueFromText(text);
            valor = extracted.valor;
            moeda = extracted.moeda;
            padrao = extracted.padrao;
            if (valor === null) status = "VALOR NÃO ENCONTRADO";
          }

          const prestador = extractPrestadorFromFilename(filename);

          await db.execute(sql`
            INSERT INTO cortex_core.notas_fiscais (mes, mes_num, ano, categoria, arquivo, prestador, valor_brl, moeda_original, padrao_usado, status)
            VALUES (${monthDir.name}, ${mesNum}, 2026, ${catDir.name}, ${filename}, ${prestador}, ${valor}, ${moeda}, ${padrao}, ${status})
            ON CONFLICT (ano, mes_num, categoria, arquivo) DO UPDATE SET
              valor_brl = EXCLUDED.valor_brl, moeda_original = EXCLUDED.moeda_original,
              padrao_usado = EXCLUDED.padrao_usado, status = EXCLUDED.status, prestador = EXCLUDED.prestador,
              created_at = NOW()
          `);

          if (status === "OK") totalProcessed++;
          else totalErrors++;
        }
      }
    }

    res.json({ success: true, totalProcessed, totalErrors, total: totalProcessed + totalErrors });
  } catch (error) {
    console.error("[api] Error scanning local NFs:", error);
    res.status(500).json({ error: "Failed to scan local folder" });
  }
});

// GET /api/notas-fiscais/dashboard — Aggregated data for dashboard
app.get("/api/notas-fiscais/dashboard", isAuthenticated, async (req, res) => {
  try {
    const ano = parseInt(req.query.ano as string) || 2026;

    const [resumoMensal, resumoCategoria, topPrestadores, totais, erros] = await Promise.all([
      db.execute(sql`
        SELECT mes, mes_num, COUNT(*) as qtd, SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END) as total,
          SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) as ok_count,
          SUM(CASE WHEN status != 'OK' THEN 1 ELSE 0 END) as erro_count
        FROM cortex_core.notas_fiscais WHERE ano = ${ano}
        GROUP BY mes, mes_num ORDER BY mes_num
      `),
      db.execute(sql`
        SELECT categoria, COUNT(*) as qtd, SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END) as total,
          SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) as ok_count
        FROM cortex_core.notas_fiscais WHERE ano = ${ano}
        GROUP BY categoria ORDER BY total DESC
      `),
      db.execute(sql`
        SELECT prestador, COUNT(*) as qtd, SUM(valor_brl) as total
        FROM cortex_core.notas_fiscais WHERE ano = ${ano} AND status = 'OK'
        GROUP BY prestador ORDER BY total DESC LIMIT 20
      `),
      db.execute(sql`
        SELECT COUNT(*) as total_nfs,
          SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) as total_ok,
          SUM(CASE WHEN status != 'OK' THEN 1 ELSE 0 END) as total_erros,
          COALESCE(SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END), 0) as valor_total,
          COALESCE(AVG(CASE WHEN status = 'OK' THEN valor_brl END), 0) as valor_medio
        FROM cortex_core.notas_fiscais WHERE ano = ${ano}
      `),
      db.execute(sql`
        SELECT id, mes, categoria, arquivo, status, prestador
        FROM cortex_core.notas_fiscais WHERE ano = ${ano} AND status != 'OK'
        ORDER BY mes_num, categoria, arquivo
      `)
    ]);

    res.json({
      resumoMensal: resumoMensal.rows,
      resumoCategoria: resumoCategoria.rows,
      topPrestadores: topPrestadores.rows,
      totais: totais.rows[0],
      erros: erros.rows
    });
  } catch (error) {
    console.error("[api] Error fetching NF dashboard:", error);
    res.status(500).json({ error: "Failed to fetch NF dashboard" });
  }
});

// GET /api/notas-fiscais/detalhado — Full list with filters
app.get("/api/notas-fiscais/detalhado", isAuthenticated, async (req, res) => {
  try {
    const ano = parseInt(req.query.ano as string) || 2026;
    const result = await db.execute(sql`
      SELECT id, mes, mes_num, categoria, arquivo, prestador, valor_brl, moeda_original, status, created_at
      FROM cortex_core.notas_fiscais
      WHERE ano = ${ano}
      ORDER BY mes_num, categoria, arquivo
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("[api] Error fetching NF detalhado:", error);
    res.status(500).json({ error: "Failed to fetch NF details" });
  }
});

// GET /api/notas-fiscais/conciliacao — Cross NFs with Conta Azul
app.get("/api/notas-fiscais/conciliacao", isAuthenticated, async (req, res) => {
  try {
    const ano = parseInt(req.query.ano as string) || 2026;

    // NF totals by month
    const nfByMonth = await db.execute(sql`
      SELECT mes_num, SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END) as nf_total
      FROM cortex_core.notas_fiscais WHERE ano = ${ano}
      GROUP BY mes_num ORDER BY mes_num
    `);

    // Conta Azul despesas by month
    const cazByMonth = await db.execute(sql`
      SELECT EXTRACT(MONTH FROM data_vencimento::date) as mes_num,
        SUM(COALESCE(valor_pago::numeric, valor_liquido::numeric, 0)) as caz_total
      FROM "Conta Azul".caz_parcelas
      WHERE tipo_evento = 'DESPESA'
        AND EXTRACT(YEAR FROM data_vencimento::date) = ${ano}
      GROUP BY EXTRACT(MONTH FROM data_vencimento::date)
      ORDER BY mes_num
    `);

    // NF totals by category
    const nfByCat = await db.execute(sql`
      SELECT categoria, SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END) as nf_total
      FROM cortex_core.notas_fiscais WHERE ano = ${ano}
      GROUP BY categoria ORDER BY nf_total DESC
    `);

    res.json({
      nfByMonth: nfByMonth.rows,
      cazByMonth: cazByMonth.rows,
      nfByCategory: nfByCat.rows
    });
  } catch (error) {
    console.error("[api] Error fetching NF conciliacao:", error);
    res.status(500).json({ error: "Failed to fetch conciliation data" });
  }
});

// DELETE /api/notas-fiscais/reset — Admin: clear all NFs for re-scan
app.delete("/api/notas-fiscais/reset", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const ano = parseInt(req.query.ano as string) || 2026;
    await db.execute(sql`DELETE FROM cortex_core.notas_fiscais WHERE ano = ${ano}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[api] Error resetting NFs:", error);
    res.status(500).json({ error: "Failed to reset NFs" });
  }
});
```

**Step 2: Add multer import at the top of routes.ts** (near other imports).

**Step 3: Verify server starts without errors**

```bash
npx tsx server/index.ts
```

**Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "feat(nf): add CRUD endpoints for notas fiscais"
```

---

## Task 5: Register page in navigation and routes

**Files:**
- Modify: `shared/nav-config.ts` — add permission key, route mapping, nav item, label
- Modify: `client/src/App.tsx` — add lazy import and Route

**Step 1: Add to `shared/nav-config.ts`**

1. In `PERMISSION_KEYS.FIN`, add: `NOTAS_FISCAIS: 'fin.notas_fiscais'`
2. In `ROUTE_TO_PERMISSION`, add: `'/dashboard/notas-fiscais': PERMISSION_KEYS.FIN.NOTAS_FISCAIS`
3. In `NAV_ITEMS` Financeiro section, add item: `{ title: 'Notas Fiscais', url: '/dashboard/notas-fiscais', icon: 'FileText', permissionKey: PERMISSION_KEYS.FIN.NOTAS_FISCAIS }`
4. In `PERMISSION_LABELS`, add: `[PERMISSION_KEYS.FIN.NOTAS_FISCAIS]: 'Financeiro - Notas Fiscais'`

**Step 2: Add to `client/src/App.tsx`**

1. Add lazy import: `const NotasFiscais = lazyWithRetry(() => import("@/pages/NotasFiscais"));`
2. Add Route (in the Financeiro group):
```tsx
<Route path="/dashboard/notas-fiscais">{() => <ProtectedRoute path="/dashboard/notas-fiscais" component={NotasFiscais} />}</Route>
```

**Step 3: Commit**

```bash
git add shared/nav-config.ts client/src/App.tsx
git commit -m "feat(nf): register NotasFiscais page in nav and routes"
```

---

## Task 6: Create frontend dashboard page

**Files:**
- Create: `client/src/pages/NotasFiscais.tsx`

This is the main dashboard page. It should include:

1. **KPI Cards** — Total NFs, Total Valor, Valor Médio, Taxa de Erro
2. **Evolução Mensal** — BarChart (Recharts) total por mês
3. **Distribuição por Categoria** — PieChart ou BarChart horizontal
4. **Top Prestadores** — Table ranking por valor
5. **Upload & Scan** — Botão upload + botão admin scan local
6. **Aba Detalhado** — Table com filtros
7. **Aba Erros** — NFs com problemas
8. **Aba Conciliação** — NFs vs Conta Azul por mês

The page follows existing patterns: Recharts, Tailwind, shadcn/ui, dark mode, `useQuery`, `apiRequest`.

**Key implementation notes:**
- Use `Tabs` component for: Visão Geral | Detalhado | Erros | Conciliação
- KPI cards use same pattern as DashboardFinanceiro (gradient, icons)
- Dark mode: always use `dark:` Tailwind variants
- Format values with `formatCurrencyNoDecimals` or inline `Intl.NumberFormat`
- Upload dialog uses `Dialog` + native `input[type=file]` with multiple
- Scan local button only visible for `user?.role === "admin"`

**Step 1: Create `client/src/pages/NotasFiscais.tsx`** with the full implementation.

**Step 2: Verify it renders**

Start the dev server and navigate to `/dashboard/notas-fiscais`. The page should load (empty state since no data yet).

**Step 3: Commit**

```bash
git add client/src/pages/NotasFiscais.tsx
git commit -m "feat(nf): add NotasFiscais dashboard page"
```

---

## Task 7: Test end-to-end with local scan

**Step 1: Trigger the local scan**

Navigate to the dashboard as admin and click "Processar Pasta Local". This should:
- Scan `attached_assets/2026/` recursively
- Process all PDFs (Jan, Feb, Mar)
- Insert results into `cortex_core.notas_fiscais`
- Refresh the dashboard with real data

**Step 2: Verify data appears**

- KPI cards should show totals
- Monthly chart shows Jan/Feb/Mar
- Category breakdown shows Fixo, Freelancer, etc.
- Top prestadores shows names extracted from filenames
- Errors tab shows any PDFs that couldn't be parsed

**Step 3: Test upload**

Upload a single PDF via the upload dialog. Verify it appears in the detalhado list.

**Step 4: Final commit + push**

```bash
git add -A
git commit -m "feat(nf): notas fiscais dashboard complete"
git push
```

---

## Verification Checklist

- [ ] `pdf-parse` and `multer` installed
- [ ] `cortex_core.notas_fiscais` table created on startup
- [ ] Extraction engine matches Python script's regex patterns
- [ ] Local scan processes PDFs from `attached_assets/2026/`
- [ ] Upload endpoint accepts multipart PDFs
- [ ] Dashboard shows KPIs, charts, tables
- [ ] Conciliation tab crosses NFs with Conta Azul
- [ ] Dark mode works on all components
- [ ] Page registered in nav under Financeiro
- [ ] Admin-only features gated by role check
