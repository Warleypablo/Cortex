import { getDriveClient, getSlidesClient } from './credentials';
import type { 
  PlaceholderMap, 
  AutoReportCliente, 
  MetricasGA4, 
  MetricasGoogleAds, 
  MetricasMetaAds,
  PeriodoReferencia 
} from './types';
import { TEMPLATE_IDS } from './types';
import * as fs from 'fs';
import * as path from 'path';

// Cache para IDs de templates uploadados pelo service account
const uploadedTemplateCache: Record<string, string> = {};

// Mapeia categoria para arquivo PPTX local
const LOCAL_PPTX_TEMPLATES: Record<string, string> = {
  'ecommerce': 'attached_assets/[ECOM_TEMPLATE]_Auto_Report_Semanal_1768573133921.pptx',
  'lead_com_site': '', // Adicionar quando disponível
  'lead_sem_site': '', // Adicionar quando disponível
};

async function ensureTemplateUploaded(categoria: string): Promise<string> {
  // Se já temos o ID em cache, retornar
  if (uploadedTemplateCache[categoria]) {
    console.log(`[AutoReport Slides] Usando template em cache para ${categoria}: ${uploadedTemplateCache[categoria]}`);
    return uploadedTemplateCache[categoria];
  }
  
  const drive = getDriveClient();
  
  // Verificar se já existe um template uploadado pelo service account
  const templateName = `_TURBO_TEMPLATE_${categoria.toUpperCase()}`;
  
  const searchResponse = await drive.files.list({
    q: `name='${templateName}' and mimeType='application/vnd.google-apps.presentation' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  
  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    const existingId = searchResponse.data.files[0].id!;
    uploadedTemplateCache[categoria] = existingId;
    console.log(`[AutoReport Slides] Template ${categoria} encontrado no Drive: ${existingId}`);
    return existingId;
  }
  
  // Se não existe, fazer upload do PPTX local
  const localPath = LOCAL_PPTX_TEMPLATES[categoria];
  if (!localPath || !fs.existsSync(localPath)) {
    // Fallback: tentar usar o ID do env var (Google Slides original)
    const envTemplateId = TEMPLATE_IDS[categoria];
    if (envTemplateId) {
      console.log(`[AutoReport Slides] Arquivo local não encontrado para ${categoria}, tentando template do Drive: ${envTemplateId}`);
      return envTemplateId;
    }
    throw new Error(`Template PPTX local não encontrado para categoria: ${categoria}`);
  }
  
  console.log(`[AutoReport Slides] Fazendo upload do template ${categoria} de ${localPath}...`);
  
  const fileContent = fs.readFileSync(localPath);
  
  const uploadResponse = await drive.files.create({
    requestBody: {
      name: templateName,
      mimeType: 'application/vnd.google-apps.presentation', // Converte PPTX para Slides
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      body: fs.createReadStream(localPath),
    },
    fields: 'id',
  });
  
  const newId = uploadResponse.data.id!;
  uploadedTemplateCache[categoria] = newId;
  console.log(`[AutoReport Slides] Template ${categoria} uploadado com sucesso: ${newId}`);
  
  return newId;
}

function formatCurrency(value: number): string {
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number): string {
  return value.toFixed(2).replace('.', ',') + '%';
}

function calcVariation(atual: number, anterior: number): number {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
}

function formatVariation(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(1).replace('.', ',') + '%';
}

export async function copyTemplate(
  templateId: string,
  clienteName: string,
  folderId?: string
): Promise<{ presentationId: string; presentationUrl: string }> {
  const drive = getDriveClient();
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
  const fileName = `Relatório ${clienteName} - ${dateStr}`;

  const copyResponse = await drive.files.copy({
    fileId: templateId,
    supportsAllDrives: true,
    supportsTeamDrives: true,
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
    },
  });

  const presentationId = copyResponse.data.id!;
  const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

  return { presentationId, presentationUrl };
}

export async function fillPlaceholders(
  presentationId: string,
  placeholders: PlaceholderMap
): Promise<void> {
  const slides = getSlidesClient();

  const requests: any[] = [];

  for (const [key, value] of Object.entries(placeholders)) {
    const placeholder = `{{${key}}}`;
    const textValue = String(value);

    requests.push({
      replaceAllText: {
        containsText: {
          text: placeholder,
          matchCase: false,
        },
        replaceText: textValue,
      },
    });
  }

  if (requests.length === 0) return;

  const batchSize = 50;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: batch,
      },
    });
  }
}

export async function replaceImage(
  presentationId: string,
  imageObjectId: string,
  imageUrl: string
): Promise<void> {
  const slides = getSlidesClient();

  await slides.presentations.batchUpdate({
    presentationId,
    requestBody: {
      requests: [
        {
          replaceImage: {
            imageObjectId,
            url: imageUrl,
            imageReplaceMethod: 'CENTER_CROP',
          },
        },
      ],
    },
  });
}

export async function deleteSlide(
  presentationId: string,
  slideObjectId: string
): Promise<void> {
  const slides = getSlidesClient();

  await slides.presentations.batchUpdate({
    presentationId,
    requestBody: {
      requests: [
        {
          deleteObject: {
            objectId: slideObjectId,
          },
        },
      ],
    },
  });
}

export async function getSlideObjectIds(
  presentationId: string
): Promise<{ slideId: string; elements: { objectId: string; type: string; name?: string }[] }[]> {
  const slides = getSlidesClient();

  const presentation = await slides.presentations.get({
    presentationId,
  });

  const result: { slideId: string; elements: { objectId: string; type: string; name?: string }[] }[] = [];

  for (const slide of presentation.data.slides || []) {
    const elements: { objectId: string; type: string; name?: string }[] = [];

    for (const element of slide.pageElements || []) {
      if (element.image) {
        elements.push({
          objectId: element.objectId!,
          type: 'image',
          name: element.title || undefined,
        });
      } else if (element.shape?.shapeType === 'TEXT_BOX') {
        elements.push({
          objectId: element.objectId!,
          type: 'textbox',
        });
      }
    }

    result.push({
      slideId: slide.objectId!,
      elements,
    });
  }

  return result;
}

interface SlidesReportData {
  cliente: AutoReportCliente;
  periodos: { atual: PeriodoReferencia; anterior: PeriodoReferencia };
  ga4Atual: MetricasGA4;
  ga4Anterior: MetricasGA4;
  googleAds: MetricasGoogleAds;
  metaAds: MetricasMetaAds;
}

export async function generateSlidesReport(data: SlidesReportData): Promise<{
  presentationId: string;
  presentationUrl: string;
  fileName: string;
}> {
  const { cliente, periodos, ga4Atual, ga4Anterior, googleAds, metaAds } = data;
  
  const investTotal = googleAds.custo + metaAds.custo;
  const convTotal = googleAds.conversoes + metaAds.conversoes;
  const roas = investTotal > 0 ? ga4Atual.receita / investTotal : 0;
  const cpa = convTotal > 0 ? investTotal / convTotal : 0;
  
  const receitaVar = calcVariation(ga4Atual.receita, ga4Anterior.receita);
  const sessoesVar = calcVariation(ga4Atual.sessoes, ga4Anterior.sessoes);
  const usuariosVar = calcVariation(ga4Atual.usuarios, ga4Anterior.usuarios);
  const convVar = calcVariation(ga4Atual.conversoes, ga4Anterior.conversoes);
  
  const googlePct = investTotal > 0 ? (googleAds.custo / investTotal) * 100 : 50;
  const metaPct = investTotal > 0 ? (metaAds.custo / investTotal) * 100 : 50;
  
  // Selecionar template baseado na categoria do cliente
  const categoria = cliente.categoria || 'ecommerce';
  
  // Garantir que o template esteja disponível (upload se necessário)
  const templateId = await ensureTemplateUploaded(categoria);
  
  console.log(`[AutoReport Slides] Copiando template ${categoria}: ${templateId}`);
  
  const { presentationId, presentationUrl } = await copyTemplate(
    templateId,
    cliente.cliente,
    cliente.linkPasta ? extractFolderId(cliente.linkPasta) : undefined
  );
  
  const placeholders: PlaceholderMap = {
    cliente: cliente.cliente,
    periodo: periodos.atual.label,
    periodo_atual: periodos.atual.label,
    periodo_anterior: periodos.anterior.label,
    
    investimento_total: formatCurrency(investTotal),
    receita: formatCurrency(ga4Atual.receita),
    roas: roas.toFixed(2).replace('.', ','),
    cpa: formatCurrency(cpa),
    
    receita_variacao: formatVariation(receitaVar),
    
    sessoes: formatNumber(ga4Atual.sessoes),
    sessoes_variacao: formatVariation(sessoesVar),
    usuarios: formatNumber(ga4Atual.usuarios),
    usuarios_variacao: formatVariation(usuariosVar),
    conversoes: formatNumber(ga4Atual.conversoes),
    conversoes_variacao: formatVariation(convVar),
    
    taxa_rejeicao: formatPercent(ga4Atual.taxaRejeicao),
    duracao_media: formatDuration(ga4Atual.duracaoMedia),
    
    google_ads_custo: formatCurrency(googleAds.custo),
    google_ads_impressoes: formatNumber(googleAds.impressoes),
    google_ads_cliques: formatNumber(googleAds.cliques),
    google_ads_ctr: formatPercent(googleAds.ctr),
    google_ads_cpc: formatCurrency(googleAds.cpc),
    google_ads_conversoes: formatNumber(googleAds.conversoes),
    google_ads_roas: googleAds.roas.toFixed(2).replace('.', ','),
    google_ads_percentual: googlePct.toFixed(0) + '%',
    
    meta_ads_custo: formatCurrency(metaAds.custo),
    meta_ads_impressoes: formatNumber(metaAds.impressoes),
    meta_ads_alcance: formatNumber(metaAds.alcance),
    meta_ads_cliques: formatNumber(metaAds.cliques),
    meta_ads_ctr: formatPercent(metaAds.ctr),
    meta_ads_cpc: formatCurrency(metaAds.cpc),
    meta_ads_cpm: formatCurrency(metaAds.cpm),
    meta_ads_conversoes: formatNumber(metaAds.conversoes),
    meta_ads_roas: metaAds.roas.toFixed(2).replace('.', ','),
    meta_ads_percentual: metaPct.toFixed(0) + '%',
    
    gestor: cliente.gestor || '',
    squad: cliente.squad || '',
    categoria: getCategoriaLabel(cliente.categoria),
    
    data_geracao: new Date().toLocaleDateString('pt-BR'),
  };
  
  await fillPlaceholders(presentationId, placeholders);
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
  const fileName = `Relatório ${cliente.cliente} - ${dateStr}.pptx`;
  
  return {
    presentationId,
    presentationUrl,
    fileName,
  };
}

function extractFolderId(url: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
}

function getCategoriaLabel(categoria: string): string {
  switch (categoria) {
    case 'ecommerce': return 'E-commerce';
    case 'lead_com_site': return 'Lead (Com Site)';
    case 'lead_sem_site': return 'Lead (Sem Site)';
    default: return categoria || 'Não definida';
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}
