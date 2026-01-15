import { fetchClientes, updateClienteStatus, appendToTrackingSheet } from './sheets';
import { getMetricasGA4 } from './ga4';
import { getMetricasGoogleAds } from './googleAds';
import { getMetricasMetaAds } from './metaAds';
import { generatePdfReport } from './pdf';
import { uploadPdfToDrive, getFolderIdFromUrl } from './drive';
import type { 
  AutoReportCliente, 
  AutoReportJob, 
  PeriodoReferencia, 
  MetricasGA4,
  MetricasGoogleAds,
  MetricasMetaAds
} from './types';

const activeJobs: Map<string, AutoReportJob> = new Map();

function calcularPeriodoSemanal(): { atual: PeriodoReferencia; anterior: PeriodoReferencia } {
  const hoje = new Date();
  const diaSemana = hoje.getDay();
  
  const fimSemanaAtual = new Date(hoje);
  fimSemanaAtual.setDate(hoje.getDate() - diaSemana);
  fimSemanaAtual.setHours(23, 59, 59, 999);
  
  const inicioSemanaAtual = new Date(fimSemanaAtual);
  inicioSemanaAtual.setDate(fimSemanaAtual.getDate() - 6);
  inicioSemanaAtual.setHours(0, 0, 0, 0);

  const fimSemanaAnterior = new Date(inicioSemanaAtual);
  fimSemanaAnterior.setDate(inicioSemanaAtual.getDate() - 1);
  fimSemanaAnterior.setHours(23, 59, 59, 999);
  
  const inicioSemanaAnterior = new Date(fimSemanaAnterior);
  inicioSemanaAnterior.setDate(fimSemanaAnterior.getDate() - 6);
  inicioSemanaAnterior.setHours(0, 0, 0, 0);

  return {
    atual: {
      inicio: inicioSemanaAtual,
      fim: fimSemanaAtual,
      label: `${inicioSemanaAtual.toLocaleDateString('pt-BR')} a ${fimSemanaAtual.toLocaleDateString('pt-BR')}`,
    },
    anterior: {
      inicio: inicioSemanaAnterior,
      fim: fimSemanaAnterior,
      label: `${inicioSemanaAnterior.toLocaleDateString('pt-BR')} a ${fimSemanaAnterior.toLocaleDateString('pt-BR')}`,
    },
  };
}

export async function listarClientes(): Promise<AutoReportCliente[]> {
  return fetchClientes();
}

export async function gerarRelatorio(cliente: AutoReportCliente): Promise<AutoReportJob> {
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

    const periodos = calcularPeriodoSemanal();

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

    console.log(`[AutoReport] PDF gerado: ${fileName}. Fazendo upload...`);

    const folderId = await getFolderIdFromUrl(cliente.linkPasta) || process.env.RELATORIO_FOLDER_ID;
    
    const { fileId, fileUrl } = await uploadPdfToDrive(buffer, fileName, folderId || undefined);

    const agora = new Date().toLocaleString('pt-BR');
    await updateClienteStatus(cliente.rowIndex, 'CONCLUÍDO', agora);

    job.status = 'concluido';
    job.presentationId = fileId;
    job.presentationUrl = fileUrl;
    job.concluidoEm = new Date();
    activeJobs.set(jobId, job);

    console.log(`[AutoReport] Relatório PDF enviado: ${fileUrl}`);

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

export async function gerarRelatoriosEmLote(clientes: AutoReportCliente[]): Promise<AutoReportJob[]> {
  const jobs: AutoReportJob[] = [];

  for (const cliente of clientes) {
    if (!cliente.categoria) {
      console.log(`[AutoReport] Pulando ${cliente.cliente}: categoria não definida`);
      continue;
    }

    const job = await gerarRelatorio(cliente);
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
