import { fetchClientes, updateClienteStatus, appendToTrackingSheet } from './sheets';
import { getMetricasGA4 } from './ga4';
import { getMetricasGoogleAds } from './googleAds';
import { getMetricasMetaAds } from './metaAds';
import { copyTemplate, fillPlaceholders } from './slides';
import { TEMPLATE_IDS } from './types';
import type { 
  AutoReportCliente, 
  AutoReportJob, 
  PeriodoReferencia, 
  PlaceholderMap,
  MetricasGA4,
  MetricasGoogleAds,
  MetricasMetaAds
} from './types';

const activeJobs: Map<string, AutoReportJob> = new Map();

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}%`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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

function calcularVariacao(atual: number, anterior: number): string {
  if (anterior === 0) return atual > 0 ? '+100%' : '0%';
  const variacao = ((atual - anterior) / anterior) * 100;
  const sinal = variacao >= 0 ? '+' : '';
  return `${sinal}${variacao.toFixed(1).replace('.', ',')}%`;
}

function buildPlaceholders(
  cliente: AutoReportCliente,
  periodos: { atual: PeriodoReferencia; anterior: PeriodoReferencia },
  metricas: {
    ga4Atual: MetricasGA4;
    ga4Anterior: MetricasGA4;
    googleAds: MetricasGoogleAds;
    metaAds: MetricasMetaAds;
  }
): PlaceholderMap {
  const placeholders: PlaceholderMap = {};

  placeholders['cliente'] = cliente.cliente;
  placeholders['data_relatorio'] = new Date().toLocaleDateString('pt-BR');
  placeholders['periodo_atual'] = periodos.atual.label;
  placeholders['periodo_anterior'] = periodos.anterior.label;
  placeholders['gestor'] = cliente.gestor;
  placeholders['squad'] = cliente.squad;

  placeholders['ga4_sessoes'] = formatNumber(metricas.ga4Atual.sessoes);
  placeholders['ga4_usuarios'] = formatNumber(metricas.ga4Atual.usuarios);
  placeholders['ga4_novos_usuarios'] = formatNumber(metricas.ga4Atual.novoUsuarios);
  placeholders['ga4_taxa_rejeicao'] = formatPercent(metricas.ga4Atual.taxaRejeicao * 100);
  placeholders['ga4_duracao_media'] = formatDuration(metricas.ga4Atual.duracaoMedia);
  placeholders['ga4_conversoes'] = formatNumber(metricas.ga4Atual.conversoes);
  placeholders['ga4_receita'] = formatCurrency(metricas.ga4Atual.receita);

  placeholders['ga4_var_sessoes'] = calcularVariacao(metricas.ga4Atual.sessoes, metricas.ga4Anterior.sessoes);
  placeholders['ga4_var_usuarios'] = calcularVariacao(metricas.ga4Atual.usuarios, metricas.ga4Anterior.usuarios);
  placeholders['ga4_var_conversoes'] = calcularVariacao(metricas.ga4Atual.conversoes, metricas.ga4Anterior.conversoes);
  placeholders['ga4_var_receita'] = calcularVariacao(metricas.ga4Atual.receita, metricas.ga4Anterior.receita);

  const topCanais = metricas.ga4Atual.canais.slice(0, 5);
  topCanais.forEach((canal, i) => {
    placeholders[`ga4_canal_${i + 1}_nome`] = canal.nome;
    placeholders[`ga4_canal_${i + 1}_sessoes`] = formatNumber(canal.sessoes);
    placeholders[`ga4_canal_${i + 1}_conversoes`] = formatNumber(canal.conversoes);
  });

  placeholders['gads_impressoes'] = formatNumber(metricas.googleAds.impressoes);
  placeholders['gads_cliques'] = formatNumber(metricas.googleAds.cliques);
  placeholders['gads_ctr'] = formatPercent(metricas.googleAds.ctr);
  placeholders['gads_cpc'] = formatCurrency(metricas.googleAds.cpc);
  placeholders['gads_custo'] = formatCurrency(metricas.googleAds.custo);
  placeholders['gads_conversoes'] = formatNumber(metricas.googleAds.conversoes);
  placeholders['gads_custo_conversao'] = formatCurrency(metricas.googleAds.custoPorConversao);
  placeholders['gads_roas'] = metricas.googleAds.roas.toFixed(2).replace('.', ',');

  const topCampanhasGoogle = metricas.googleAds.campanhas.slice(0, 5);
  topCampanhasGoogle.forEach((camp, i) => {
    placeholders[`gads_camp_${i + 1}_nome`] = camp.nome;
    placeholders[`gads_camp_${i + 1}_impressoes`] = formatNumber(camp.impressoes);
    placeholders[`gads_camp_${i + 1}_cliques`] = formatNumber(camp.cliques);
    placeholders[`gads_camp_${i + 1}_custo`] = formatCurrency(camp.custo);
    placeholders[`gads_camp_${i + 1}_conversoes`] = formatNumber(camp.conversoes);
  });

  placeholders['meta_impressoes'] = formatNumber(metricas.metaAds.impressoes);
  placeholders['meta_alcance'] = formatNumber(metricas.metaAds.alcance);
  placeholders['meta_cliques'] = formatNumber(metricas.metaAds.cliques);
  placeholders['meta_ctr'] = formatPercent(metricas.metaAds.ctr);
  placeholders['meta_cpc'] = formatCurrency(metricas.metaAds.cpc);
  placeholders['meta_cpm'] = formatCurrency(metricas.metaAds.cpm);
  placeholders['meta_custo'] = formatCurrency(metricas.metaAds.custo);
  placeholders['meta_conversoes'] = formatNumber(metricas.metaAds.conversoes);
  placeholders['meta_custo_conversao'] = formatCurrency(metricas.metaAds.custoPorConversao);
  placeholders['meta_roas'] = metricas.metaAds.roas.toFixed(2).replace('.', ',');

  const topCampanhasMeta = metricas.metaAds.campanhas.slice(0, 5);
  topCampanhasMeta.forEach((camp, i) => {
    placeholders[`meta_camp_${i + 1}_nome`] = camp.nome;
    placeholders[`meta_camp_${i + 1}_impressoes`] = formatNumber(camp.impressoes);
    placeholders[`meta_camp_${i + 1}_alcance`] = formatNumber(camp.alcance);
    placeholders[`meta_camp_${i + 1}_cliques`] = formatNumber(camp.cliques);
    placeholders[`meta_camp_${i + 1}_custo`] = formatCurrency(camp.custo);
    placeholders[`meta_camp_${i + 1}_conversoes`] = formatNumber(camp.conversoes);
  });

  return placeholders;
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

    console.log(`[AutoReport] Métricas coletadas. Gerando relatório...`);

    const templateId = TEMPLATE_IDS[cliente.categoria] || process.env.TEMPLATE_RELATORIO_ID || '';
    
    if (!templateId) {
      throw new Error(`Template não configurado para categoria: ${cliente.categoria}`);
    }

    const folderId = process.env.RELATORIO_FOLDER_ID;
    const { presentationId, presentationUrl } = await copyTemplate(templateId, cliente.cliente, folderId);

    const placeholders = buildPlaceholders(cliente, periodos, {
      ga4Atual,
      ga4Anterior,
      googleAds,
      metaAds,
    });

    await fillPlaceholders(presentationId, placeholders);

    const agora = new Date().toLocaleString('pt-BR');
    await updateClienteStatus(cliente.rowIndex, 'CONCLUÍDO', agora);

    job.status = 'concluido';
    job.presentationId = presentationId;
    job.presentationUrl = presentationUrl;
    job.concluidoEm = new Date();
    activeJobs.set(jobId, job);

    console.log(`[AutoReport] Relatório gerado: ${presentationUrl}`);

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
    if (!cliente.gerar) continue;
    if (!cliente.categoria) continue;

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
