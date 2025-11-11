import {
  Megaphone,
  TrendingUp,
  Mail,
  Users,
  Code,
  PenTool,
  BarChart3,
  Share2,
  Video,
  Camera,
  FileText,
  ShoppingCart,
  Target,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type ServiceIconMapping = {
  icon: LucideIcon;
  color: string;
};

export const serviceIconMap: Record<string, ServiceIconMapping> = {
  "Tráfego Pago": {
    icon: Target,
    color: "text-blue-500",
  },
  "Tráfego": {
    icon: Target,
    color: "text-blue-500",
  },
  "SEO": {
    icon: TrendingUp,
    color: "text-green-500",
  },
  "Social Media": {
    icon: Share2,
    color: "text-pink-500",
  },
  "Redes Sociais": {
    icon: Share2,
    color: "text-pink-500",
  },
  "Email Marketing": {
    icon: Mail,
    color: "text-yellow-500",
  },
  "E-mail Marketing": {
    icon: Mail,
    color: "text-yellow-500",
  },
  "Inbound Marketing": {
    icon: Megaphone,
    color: "text-purple-500",
  },
  "Inbound": {
    icon: Megaphone,
    color: "text-purple-500",
  },
  "Criação de Conteúdo": {
    icon: PenTool,
    color: "text-orange-500",
  },
  "Conteúdo": {
    icon: PenTool,
    color: "text-orange-500",
  },
  "Design": {
    icon: Sparkles,
    color: "text-indigo-500",
  },
  "Desenvolvimento": {
    icon: Code,
    color: "text-cyan-500",
  },
  "Dev": {
    icon: Code,
    color: "text-cyan-500",
  },
  "Web": {
    icon: Code,
    color: "text-cyan-500",
  },
  "Analytics": {
    icon: BarChart3,
    color: "text-red-500",
  },
  "Análise de Dados": {
    icon: BarChart3,
    color: "text-red-500",
  },
  "CRM": {
    icon: Users,
    color: "text-teal-500",
  },
  "Vídeo": {
    icon: Video,
    color: "text-rose-500",
  },
  "Fotografia": {
    icon: Camera,
    color: "text-amber-500",
  },
  "Copywriting": {
    icon: FileText,
    color: "text-slate-500",
  },
  "E-commerce": {
    icon: ShoppingCart,
    color: "text-emerald-500",
  },
};

export function getServiceIcon(serviceName: string): ServiceIconMapping {
  const normalizedName = serviceName.trim();
  
  const exactMatch = serviceIconMap[normalizedName];
  if (exactMatch) {
    return exactMatch;
  }
  
  const lowerCaseName = normalizedName.toLowerCase();
  for (const [key, value] of Object.entries(serviceIconMap)) {
    if (key.toLowerCase() === lowerCaseName) {
      return value;
    }
  }
  
  return {
    icon: Sparkles,
    color: "text-muted-foreground",
  };
}
