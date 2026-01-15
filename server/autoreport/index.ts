import { fetchClientes, updateClienteStatus, appendToTrackingSheet } from './sheets';
import { getMetricasGA4 } from './ga4';
import { getMetricasGoogleAds } from './googleAds';
import { getMetricasMetaAds } from './metaAds';
import { generatePdfReport } from './pdf';
import type { 
  AutoReportCliente, 
  AutoReportJob, 
  PeriodoReferencia, 
  MetricasGA4,
  MetricasGoogleAds,
  MetricasMetaAds
} from './types';

const activeJobs: Map<string, AutoReportJob> = new Map();
const pdfBuffers: Map<string, { buffer: Buffer; fileName: string; createdAt: Date }> = new Map();

export function getPdfBuffer(jobId: string): { buffer: Buffer; fileName: string } | null {
  const data = pdfBuffers.get(jobId);
  if (!data) return null;
  return { buffer: data.buffer, fileName: data.fileName };
}

setInterval(() => {
  const now = Date.now();
  for (const [jobId, data] of pdfBuffers.entries()) {
    if (now - data.createdAt.getTime() > 30 * 60 * 1000) {
      pdfBuffers.delete(jobId);
    }
  }
}, 5 * 60 * 1000);

function calcularPeriodos(dataInicio?: string, dataFim?: string): { atual: PeriodoReferencia; anterior: PeriodoReferencia } {
  let inicioAtual: Date;
  let fimAtual: Date;

  if (dataInicio && dataFim) {
    inicioAtual = new Date(dataInicio);
    inicioAtual.setHours(0, 0, 0, 0);
    fimAtual = new Date(dataFim);
    fimAtual.setHours(23, 59, 59, 999);
  } else {
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    fimAtual = new Date(hoje);
    fimAtual.setDate(hoje.getDate() - diaSemana);
    fimAtual.setHours(23, 59, 59, 999);
    inicioAtual = new Date(fimAtual);
    inicioAtual.setDate(fimAtual.getDate() - 6);
    inicioAtual.setHours(0, 0, 0, 0);
  }

  const duracaoDias = Math.ceil((fimAtual.getTime() - inicioAtual.getTime()) / (1000 * 60 * 60 * 24));
  
  const fimAnterior = new Date(inicioAtual);
  fimAnterior.setDate(inicioAtual.getDate() - 1);
  fimAnterior.setHours(23, 59, 59, 999);
  
  const inicioAnterior = new Date(fimAnterior);
  inicioAnterior.setDate(fimAnterior.getDate() - duracaoDias + 1);
  inicioAnterior.setHours(0, 0, 0, 0);

  return {
    atual: {
      inicio: inicioAtual,
      fim: fimAtual,
      label: `${inicioAtual.toLocaleDateString('pt-BR')} a ${fimAtual.toLocaleDateString('pt-BR')}`,
    },
    anterior: {
      inicio: inicioAnterior,
      fim: fimAnterior,
      label: `${inicioAnterior.toLocaleDateString('pt-BR')} a ${fimAnterior.toLocaleDateString('pt-BR')}`,
    },
  };
}

export async function listarClientes(): Promise<AutoReportCliente[]> {
  return fetchClientes();
}

export async function gerarRelatorio(cliente: AutoReportCliente, dataInicio?: string, dataFim?: string): Promise<AutoReportJob> {
  const jobId = `${cliente.cliente}-${Date.now()}`;
  
  const job: AutoReportJob = {
    id: jobId,
    clienteNome: cliente.cliente,
    categoria: cliente.categoria,
    status: 'processando',
    criadoEm: new Date(),
  };
  
  activeJobs.set(jobId, job);

  try {
    await updateClienteStatus(cliente.rowIndex, 'PROCESSANDO');

    const periodos = calcularPeriodos(dataInicio, dataFim);

    console.log(`[AutoReport] Coletando métricas para ${cliente.cliente}...`);

    const [ga4Atual, ga4Anterior, googleAds, metaAds] = await Promise.all([
      getMetricasGA4(cliente.idGa4, periodos.atual),
      getMetricasGA4(cliente.idGa4, periodos.anterior),
      getMetricasGoogleAds(cliente.idGoogleAds, periodos.atual),
      getMetricasMetaAds(cliente.idMetaAds, periodos.atual),
    ]);

    console.log(`[AutoReport] Métricas coletadas. Gerando PDF...`);

    const { buffer, fileName } = await generatePdfReport({
      cliente,
      periodos,
      ga4Atual,
      ga4Anterior,
      googleAds,
      metaAds,
    });

    console.log(`[AutoReport] PDF gerado: ${fileName}`);

    pdfBuffers.set(jobId, { buffer, fileName, createdAt: new Date() });

    const downloadUrl = `/api/autoreport/download/${encodeURIComponent(jobId)}`;

    const agora = new Date().toLocaleString('pt-BR');
    await updateClienteStatus(cliente.rowIndex, 'CONCLUÍDO', agora);

    job.status = 'concluido';
    job.downloadUrl = downloadUrl;
    job.fileName = fileName;
    job.concluidoEm = new Date();
    activeJobs.set(jobId, job);

    console.log(`[AutoReport] Relatório pronto para download: ${downloadUrl}`);

    return job;

  } catch (error: any) {
    console.error(`[AutoReport] Erro ao gerar relatório:`, error);
    
    await updateClienteStatus(cliente.rowIndex, `ERRO: ${error.message}`);
    
    job.status = 'erro';
    job.mensagem = error.message;
    job.concluidoEm = new Date();
    activeJobs.set(jobId, job);

    return job;
  }
}

export async function gerarRelatoriosEmLote(clientes: AutoReportCliente[], dataInicio?: string, dataFim?: string): Promise<AutoReportJob[]> {
  const jobs: AutoReportJob[] = [];

  for (const cliente of clientes) {
    if (!cliente.categoria) {
      console.log(`[AutoReport] Pulando ${cliente.cliente}: categoria não definida`);
      continue;
    }

    const job = await gerarRelatorio(cliente, dataInicio, dataFim);
    jobs.push(job);

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return jobs;
}

export function getJobStatus(jobId: string): AutoReportJob | undefined {
  return activeJobs.get(jobId);
}

export function getAllJobs(): AutoReportJob[] {
  return Array.from(activeJobs.values()).sort((a, b) => 
    b.criadoEm.getTime() - a.criadoEm.getTime()
  );
}
