import type { AutoReportCliente } from './types';
import { classifyClientStatus } from './utils';

export type StatusKind = 'pendente' | 'gerado' | 'erro' | 'inativo';

export const STATUS_CLASSES: Record<StatusKind, {
  bg: string;
  text: string;
  border: string;
  borderLeft: string;
  borderLeftSelected: string;
  iconColor: string;
  numberColor: string;
}> = {
  pendente: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    borderLeft: 'border-l-amber-500',
    borderLeftSelected: 'border-l-amber-600 dark:border-l-amber-400',
    iconColor: 'text-amber-600 dark:text-amber-400',
    numberColor: 'text-amber-600 dark:text-amber-400',
  },
  gerado: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    borderLeft: 'border-l-emerald-500',
    borderLeftSelected: 'border-l-emerald-600 dark:border-l-emerald-400',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    numberColor: 'text-emerald-600 dark:text-emerald-400',
  },
  erro: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    borderLeft: 'border-l-red-500',
    borderLeftSelected: 'border-l-red-600 dark:border-l-red-400',
    iconColor: 'text-red-600 dark:text-red-400',
    numberColor: 'text-red-600 dark:text-red-400',
  },
  inativo: {
    bg: 'bg-gray-50 dark:bg-zinc-900',
    text: 'text-gray-500 dark:text-zinc-400',
    border: 'border-gray-200 dark:border-zinc-700',
    borderLeft: 'border-l-gray-300 dark:border-l-zinc-700',
    borderLeftSelected: 'border-l-gray-400 dark:border-l-zinc-600',
    iconColor: 'text-gray-500 dark:text-zinc-500',
    numberColor: 'text-gray-700 dark:text-zinc-300',
  },
};

export type PlatformKind = 'GA4' | 'Ads' | 'Meta';

const NOT_CONFIGURED_CHIP =
  'border border-dashed border-gray-300 text-gray-400 bg-transparent dark:border-zinc-700 dark:text-zinc-600';

export const PLATFORM_CLASSES: Record<PlatformKind, {
  configured: string;
  notConfigured: string;
}> = {
  GA4: {
    configured:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800',
    notConfigured: NOT_CONFIGURED_CHIP,
  },
  Ads: {
    configured:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    notConfigured: NOT_CONFIGURED_CHIP,
  },
  Meta: {
    configured:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
    notConfigured: NOT_CONFIGURED_CHIP,
  },
};

/**
 * Mapeia o resultado de classifyClientStatus para o StatusKind usado na paleta.
 * - 'pendentes' -> 'pendente'
 * - 'gerados' -> 'gerado'
 * - 'com_erro' -> 'erro'
 *
 * Note: classifyClientStatus today only returns those 3 values, but we keep
 * a defensive default of 'inativo' for type-safety should StatusTab change.
 */
export function clientStatusKind(
  cliente: AutoReportCliente,
  periodStart: Date | undefined
): StatusKind {
  const tab = classifyClientStatus(cliente, periodStart);
  switch (tab) {
    case 'pendentes':
      return 'pendente';
    case 'gerados':
      return 'gerado';
    case 'com_erro':
      return 'erro';
    case 'todos':
    default:
      return 'inativo';
  }
}
