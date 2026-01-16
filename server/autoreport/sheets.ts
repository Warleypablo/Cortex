import { getSheetsClient } from './credentials';
import type { AutoReportCliente } from './types';

function extractSheetId(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error(`Invalid Google Sheets URL: ${url}`);
  }
  return match[1];
}

export async function fetchMetasFromPainel(linkPainel: string): Promise<{ metaFaturamento: number; metaInvestimento: number }> {
  if (!linkPainel) {
    return { metaFaturamento: 0, metaInvestimento: 0 };
  }

  try {
    const sheets = getSheetsClient();
    const spreadsheetId = extractSheetId(linkPainel);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:Z',
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return { metaFaturamento: 0, metaInvestimento: 0 };
    }

    const headers = rows[0].map((h: string) => h?.toString().toLowerCase().trim() || '');
    
    const metaFatCol = headers.findIndex((h: string) => 
      h.includes('meta') && (h.includes('fat') || h.includes('faturamento'))
    );
    const metaInvCol = headers.findIndex((h: string) => 
      h.includes('meta') && (h.includes('inv') || h.includes('investimento'))
    );

    let metaFaturamento = 0;
    let metaInvestimento = 0;

    if (rows.length > 1) {
      const dataRow = rows[1];
      
      if (metaFatCol >= 0 && dataRow[metaFatCol]) {
        const val = dataRow[metaFatCol].toString().replace(/[R$\s.]/g, '').replace(',', '.');
        metaFaturamento = parseFloat(val) || 0;
      }
      
      if (metaInvCol >= 0 && dataRow[metaInvCol]) {
        const val = dataRow[metaInvCol].toString().replace(/[R$\s.]/g, '').replace(',', '.');
        metaInvestimento = parseFloat(val) || 0;
      }
    }

    console.log(`[AutoReport] Metas do painel: Fat=${metaFaturamento}, Inv=${metaInvestimento}`);
    return { metaFaturamento, metaInvestimento };
  } catch (error: any) {
    console.error(`[AutoReport] Erro ao buscar metas do painel:`, error.message);
    return { metaFaturamento: 0, metaInvestimento: 0 };
  }
}

export async function fetchClientes(): Promise<AutoReportCliente[]> {
  const sheets = getSheetsClient();
  const sheetUrl = process.env.CENTRAL_SHEET_URL;
  const tabName = process.env.CENTRAL_TAB_NAME || 'Automacao-Report';

  if (!sheetUrl) {
    throw new Error('CENTRAL_SHEET_URL not configured');
  }

  const spreadsheetId = extractSheetId(sheetUrl);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:Z`,
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((h: string) => h?.toString().toLowerCase().trim() || '');
  
  const colIndex = (name: string): number => {
    const variations: Record<string, string[]> = {
      'gerar': ['gerar?', 'gerar'],
      'cliente': ['cliente', 'nome'],
      'categoria': ['categoria'],
      'linkpainel': ['link painel', 'linkpainel', 'painel'],
      'linkpasta': ['link pasta', 'linkpasta', 'pasta'],
      'idgoogleads': ['id google ads', 'idgoogleads', 'google ads'],
      'idmetaads': ['id meta ads', 'idmetaads', 'meta ads', 'id meta'],
      'idga4': ['id ga4', 'idga4', 'ga4'],
      'gestor': ['gestor'],
      'squad': ['squad'],
      'status': ['status', 'status (auto)'],
      'ultimageracao': ['ultima vez gerado (auto)', 'ultimageracao', 'ultima geracao'],
    };

    const targets = variations[name] || [name];
    for (const target of targets) {
      const idx = headers.findIndex((h: string) => h === target || h.includes(target));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const clientes: AutoReportCliente[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const gerarVal = row[colIndex('gerar')]?.toString().toLowerCase() || '';
    const gerar = gerarVal === 'sim' || gerarVal === 'true' || gerarVal === '1' || gerarVal === 'x';

    const categoriaRaw = row[colIndex('categoria')]?.toString().toLowerCase().trim() || '';
    let categoria: AutoReportCliente['categoria'] = '';
    if (categoriaRaw.includes('ecommerce') || categoriaRaw.includes('e-commerce')) {
      categoria = 'ecommerce';
    } else if (categoriaRaw.includes('lead') && categoriaRaw.includes('com')) {
      categoria = 'lead_com_site';
    } else if (categoriaRaw.includes('lead') && categoriaRaw.includes('sem')) {
      categoria = 'lead_sem_site';
    } else if (categoriaRaw.includes('lead')) {
      categoria = 'lead_sem_site';
    }

    clientes.push({
      rowIndex: i + 1,
      gerar,
      cliente: row[colIndex('cliente')]?.toString() || '',
      categoria,
      linkPainel: row[colIndex('linkpainel')]?.toString() || '',
      linkPasta: row[colIndex('linkpasta')]?.toString() || '',
      idGoogleAds: row[colIndex('idgoogleads')]?.toString() || '',
      idMetaAds: row[colIndex('idmetaads')]?.toString() || '',
      idGa4: row[colIndex('idga4')]?.toString() || '',
      gestor: row[colIndex('gestor')]?.toString() || '',
      squad: row[colIndex('squad')]?.toString() || '',
      status: row[colIndex('status')]?.toString() || '',
      ultimaGeracao: row[colIndex('ultimageracao')]?.toString() || '',
    });
  }

  return clientes;
}

export async function updateClienteStatus(
  rowIndex: number, 
  status: string, 
  ultimaGeracao?: string
): Promise<void> {
  const sheets = getSheetsClient();
  const sheetUrl = process.env.CENTRAL_SHEET_URL;
  const tabName = process.env.CENTRAL_TAB_NAME || 'Automacao-Report';

  if (!sheetUrl) return;

  const spreadsheetId = extractSheetId(sheetUrl);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!1:1`,
  });

  const headers = response.data.values?.[0]?.map((h: string) => h?.toString().toLowerCase().trim() || '') || [];
  
  const statusCol = headers.findIndex((h: string) => h.includes('status'));
  const ultimaGeracaoCol = headers.findIndex((h: string) => h.includes('ultima'));

  const updates: { range: string; values: string[][] }[] = [];

  if (statusCol >= 0) {
    const colLetter = String.fromCharCode(65 + statusCol);
    updates.push({
      range: `${tabName}!${colLetter}${rowIndex}`,
      values: [[status]],
    });
  }

  if (ultimaGeracao && ultimaGeracaoCol >= 0) {
    const colLetter = String.fromCharCode(65 + ultimaGeracaoCol);
    updates.push({
      range: `${tabName}!${colLetter}${rowIndex}`,
      values: [[ultimaGeracao]],
    });
  }

  for (const update of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: update.range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: update.values },
    });
  }
}

export async function appendToTrackingSheet(
  trackingSheetId: string,
  data: {
    gestor: string;
    squad: string;
    cliente: string;
    categoria: string;
    linkPasta: string;
    linkReport: string;
    status: string;
  }
): Promise<void> {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: trackingSheetId,
    range: 'A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        data.gestor,
        data.squad,
        data.cliente,
        data.categoria,
        data.linkPasta ? `=HYPERLINK("${data.linkPasta}", "Pasta")` : '',
        data.linkReport ? `=HYPERLINK("${data.linkReport}", "Relatório")` : '',
        data.status,
      ]],
    },
  });
}
