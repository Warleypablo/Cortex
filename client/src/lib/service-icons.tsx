import {
  Target,
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
  Sparkles,
  Zap,
  Settings,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

export type ServiceIconMapping = {
  icon: LucideIcon;
  color: string;
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const servicePatterns: Array<{ pattern: RegExp; mapping: ServiceIconMapping }> = [
  {
    pattern: /\bperformance\b|\bperfomance\b|\bperfromance\b/i,
    mapping: { icon: Target, color: "text-blue-500" },
  },
  {
    pattern: /\btrafego\b/i,
    mapping: { icon: Target, color: "text-blue-500" },
  },
  {
    pattern: /\binbound\b/i,
    mapping: { icon: Megaphone, color: "text-purple-500" },
  },
  {
    pattern: /\bsocial\s*media\b|\bredes\s*sociais\b/i,
    mapping: { icon: Share2, color: "text-pink-500" },
  },
  {
    pattern: /\bcreators?\b/i,
    mapping: { icon: Video, color: "text-rose-500" },
  },
  {
    pattern: /\bcrm\b/i,
    mapping: { icon: Users, color: "text-teal-500" },
  },
  {
    pattern: /\be-?mail\b|\bemail\s*mkt\b|\bemail\s*marketing\b/i,
    mapping: { icon: Mail, color: "text-yellow-500" },
  },
  {
    pattern: /\be-?commerce\b|\becommerce\b|\bmarketplace\b/i,
    mapping: { icon: ShoppingCart, color: "text-emerald-500" },
  },
  {
    pattern: /\blanding\s*page\b|\blading\s*page\b/i,
    mapping: { icon: Code, color: "text-cyan-500" },
  },
  {
    pattern: /\bsite\b/i,
    mapping: { icon: Code, color: "text-cyan-500" },
  },
  {
    pattern: /\bblog\b/i,
    mapping: { icon: FileText, color: "text-slate-500" },
  },
  {
    pattern: /\bautomacao\b|\breportana\b|\bbroadcast\b|\bregua\b/i,
    mapping: { icon: Zap, color: "text-orange-500" },
  },
  {
    pattern: /\bseo\b/i,
    mapping: { icon: TrendingUp, color: "text-green-500" },
  },
  {
    pattern: /\bfotos?\b|\bfotografia\b|\bimagens?\b|\bcaptacao\b/i,
    mapping: { icon: Camera, color: "text-amber-500" },
  },
  {
    pattern: /\bconsultoria\b/i,
    mapping: { icon: Users, color: "text-purple-500" },
  },
  {
    pattern: /\baccount\s*manager\b|\bcomunidade\b/i,
    mapping: { icon: Users, color: "text-purple-500" },
  },
  {
    pattern: /\bgestao\b/i,
    mapping: { icon: Users, color: "text-purple-500" },
  },
  {
    pattern: /\bimplantacao\b|\bimplementacao\b|\bfee\b|\bgameplan\b/i,
    mapping: { icon: Settings, color: "text-gray-500" },
  },
  {
    pattern: /\banalytics\b|\bdashboard\b|\bcro\b/i,
    mapping: { icon: BarChart3, color: "text-red-500" },
  },
  {
    pattern: /\bagente\s*(de\s*)?(ia|ai)\b/i,
    mapping: { icon: Sparkles, color: "text-fuchsia-500" },
  },
  {
    pattern: /\bid\s*visual\b|\bidentidade\s*visual\b|\bbrandbook\b/i,
    mapping: { icon: Sparkles, color: "text-indigo-500" },
  },
  {
    pattern: /\brotulos?\b/i,
    mapping: { icon: PenTool, color: "text-violet-500" },
  },
  {
    pattern: /\bcriativos?\b|\bcriacao\b|\bartes?\b|\bflyers?\b|\bpanfletos?\b|\bcatalogo\b|\bapresentacao\b|\bpacote\b|\bconteudo\b/i,
    mapping: { icon: PenTool, color: "text-violet-500" },
  },
];

export function getServiceIcon(serviceName: string): ServiceIconMapping {
  const normalizedName = normalizeString(serviceName.trim());
  
  for (const { pattern, mapping } of servicePatterns) {
    if (pattern.test(normalizedName)) {
      return mapping;
    }
  }
  
  return {
    icon: Sparkles,
    color: "text-muted-foreground",
  };
}
