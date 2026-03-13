import { parse, formatDistanceToNow, format, isValid, isBefore, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AutoReportCliente, StatusTab } from './types';
import type { DateRange } from 'react-day-picker';

export function parseUltimaGeracao(value: string): Date | null {
  if (!value || !value.trim()) return null;
  let parsed = parse(value.trim(), 'dd/MM/yyyy, HH:mm:ss', new Date());
  if (isValid(parsed)) return parsed;
  parsed = parse(value.trim(), 'dd/MM/yyyy HH:mm:ss', new Date());
  if (isValid(parsed)) return parsed;
  parsed = parse(value.trim(), 'dd/MM/yyyy', new Date());
  if (isValid(parsed)) return parsed;
  return null;
}

export function formatRelativeTime(value: string): string {
  const date = parseUltimaGeracao(value);
  if (!date) return 'nunca';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

export function isOverdue(value: string): boolean {
  const date = parseUltimaGeracao(value);
  if (!date) return true;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return isBefore(date, sevenDaysAgo);
}

export function classifyClientStatus(
  cliente: AutoReportCliente,
  periodStart: Date | undefined
): StatusTab {
  if (cliente.status?.toLowerCase().includes('erro')) {
    return 'com_erro';
  }
  const lastGen = parseUltimaGeracao(cliente.ultimaGeracao);
  if (!lastGen) return 'pendentes';
  if (periodStart && isBefore(lastGen, periodStart)) return 'pendentes';
  return 'gerados';
}

export function getCategoriaLabel(categoria: string): string {
  switch (categoria) {
    case 'ecommerce': return 'E-commerce';
    case 'lead_com_site': return 'Lead c/ Site';
    case 'lead_sem_site': return 'Lead s/ Site';
    default: return categoria || 'N/D';
  }
}

export function getCategoriaBadgeVariant(categoria: string): "default" | "secondary" | "outline" {
  switch (categoria) {
    case 'ecommerce': return 'default';
    case 'lead_com_site': return 'secondary';
    case 'lead_sem_site': return 'outline';
    default: return 'outline';
  }
}

export function getDefaultDateRange(): DateRange {
  const hoje = new Date();
  const inicioSemanaPassada = startOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });
  const fimSemanaPassada = endOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });
  return { from: inicioSemanaPassada, to: fimSemanaPassada };
}

export function formatDateRange(dateRange: DateRange | undefined): string {
  if (!dateRange?.from) return 'Selecionar periodo';
  if (!dateRange.to) return format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR });
  return `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`;
}
