export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export const CLIENT_STATUS_OPTIONS: SelectOption[] = [
  { value: "triagem", label: "Triagem" },
  { value: "onboarding", label: "Onboarding" },
  { value: "ativo", label: "Ativo" },
  { value: "em cancelamento", label: "Em Cancelamento" },
  { value: "pausado", label: "Pausado" },
  { value: "cancelado/inativo", label: "Cancelado/Inativo" },
  { value: "entregue", label: "Entregue" },
];

export const CLIENT_STATUS_ACTIVE_VALUES = ["triagem", "onboarding", "ativo", "em cancelamento"];
export const CLIENT_STATUS_OPERATING_VALUES = ["ativo", "onboarding", "triagem"];

export const COLLABORATOR_STATUS_OPTIONS: SelectOption[] = [
  { value: "Vai Começar", label: "Vai Começar" },
  { value: "Ativo", label: "Ativo" },
  { value: "Dispensado", label: "Dispensado" },
  { value: "Em Desligamento", label: "Em Desligamento" },
];

export const BUSINESS_TYPE_OPTIONS: SelectOption[] = [
  { value: "ecommerce", label: "Ecommerce", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  { value: "lead", label: "Lead", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "info", label: "Info", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
];

export const ACCOUNT_STATUS_OPTIONS: SelectOption[] = [
  { value: "saudavel", label: "Saudável", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { value: "requer_atencao", label: "Requer Atenção", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "insatisfeito", label: "Insatisfeito", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
];

export const CLUSTER_OPTIONS: SelectOption[] = [
  { value: "1", label: "NFNC", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  { value: "2", label: "Regulares", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "3", label: "Chaves", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { value: "4", label: "Imperdíveis", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
];

export const CLUSTER_MAP: Record<string, string> = {
  "1": "NFNC",
  "2": "Regulares",
  "3": "Chaves",
  "4": "Imperdíveis",
};

export const SQUAD_OPTIONS: SelectOption[] = [
  { value: "0", label: "Supreme" },
  { value: "1", label: "Forja" },
  { value: "2", label: "Revo" },
  { value: "3", label: "Nitro" },
  { value: "4", label: "Apex" },
  { value: "5", label: "Fast" },
  { value: "6", label: "Lumina" },
];

export const SQUAD_MAP: Record<string, string> = {
  "0": "Supreme",
  "1": "Forja",
  "2": "Revo",
  "3": "Nitro",
  "4": "Apex",
  "5": "Fast",
  "6": "Lumina",
};

export const CONTRACT_STATUS_OPTIONS: SelectOption[] = [
  { value: "ativo", label: "Ativo" },
  { value: "onboarding", label: "Onboarding" },
  { value: "triagem", label: "Triagem" },
  { value: "cancelado/inativo", label: "Cancelado/Inativo" },
  { value: "pausado", label: "Pausado" },
  { value: "em cancelamento", label: "Em Cancelamento" },
  { value: "entregue", label: "Entregue" },
];

export const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export const COMMUNICATION_TYPE_OPTIONS: SelectOption[] = [
  { value: "email", label: "Email" },
  { value: "telefone", label: "Telefone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "reuniao", label: "Reunião" },
  { value: "nota", label: "Nota" },
];

export function getClusterLabel(cluster: string | null | undefined): string {
  if (!cluster) return "Não definido";
  return CLUSTER_MAP[cluster] || cluster;
}

export function getSquadLabel(squad: string | null | undefined): string {
  if (!squad) return "Não definido";
  return SQUAD_MAP[squad] || squad;
}

export function getBusinessTypeInfo(tipo: string | null | undefined): { label: string; color: string } {
  if (!tipo) return { label: "Não definido", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
  const option = BUSINESS_TYPE_OPTIONS.find(o => o.value.toLowerCase() === tipo.toLowerCase());
  return option ? { label: option.label, color: option.color || "" } : { label: tipo, color: "bg-gray-100 text-gray-600" };
}

export function getAccountStatusInfo(status: string | null | undefined): { label: string; color: string } {
  if (!status) return { label: "Não definido", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
  const normalizedStatus = status.toLowerCase().replace(/[_\s]/g, '');
  const option = ACCOUNT_STATUS_OPTIONS.find(o => {
    const normalizedValue = o.value.replace(/[_\s]/g, '');
    return normalizedValue === normalizedStatus;
  });
  return option ? { label: option.label, color: option.color || "" } : { label: status, color: "bg-gray-100 text-gray-600" };
}

export function getClusterInfo(cluster: string | null | undefined): { label: string; color: string } {
  if (!cluster) return { label: "Não definido", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
  const option = CLUSTER_OPTIONS.find(o => o.value === cluster || o.label.toLowerCase() === cluster.toLowerCase());
  return option ? { label: option.label, color: option.color || "" } : { label: cluster, color: "bg-gray-100 text-gray-600" };
}
