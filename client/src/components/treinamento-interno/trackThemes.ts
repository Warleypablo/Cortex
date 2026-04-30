import {
  TrendingUp, Sparkles, Cpu, Headphones, Palette,
  Briefcase, PhoneCall, Hash, Camera, Folder,
  type LucideIcon,
} from 'lucide-react';

export type TrackTheme = {
  color: string;          // gradient classes (Tailwind)
  bgIcon: string;         // background da pílula do ícone
  textIcon: string;       // cor do ícone
  icon: LucideIcon;
};

export const TRACK_THEMES: Record<string, TrackTheme> = {
  'Performance':  { color: 'from-orange-500 to-amber-400', bgIcon: 'bg-orange-500/20', textIcon: 'text-orange-600 dark:text-orange-400', icon: TrendingUp },
  'IA':           { color: 'from-purple-500 to-violet-400', bgIcon: 'bg-purple-500/20', textIcon: 'text-purple-600 dark:text-purple-400', icon: Sparkles },
  'Tech':         { color: 'from-blue-500 to-cyan-400',     bgIcon: 'bg-blue-500/20',   textIcon: 'text-blue-600 dark:text-blue-400',   icon: Cpu },
  'CX/CS':        { color: 'from-emerald-500 to-green-400', bgIcon: 'bg-emerald-500/20',textIcon: 'text-emerald-600 dark:text-emerald-400', icon: Headphones },
  'Designer':     { color: 'from-pink-500 to-rose-400',     bgIcon: 'bg-pink-500/20',   textIcon: 'text-pink-600 dark:text-pink-400',   icon: Palette },
  'Comercial':    { color: 'from-indigo-500 to-blue-400',   bgIcon: 'bg-indigo-500/20', textIcon: 'text-indigo-600 dark:text-indigo-400', icon: Briefcase },
  'Pré-vendas':   { color: 'from-teal-500 to-cyan-400',     bgIcon: 'bg-teal-500/20',   textIcon: 'text-teal-600 dark:text-teal-400',   icon: PhoneCall },
  'Social media': { color: 'from-fuchsia-500 to-pink-400',  bgIcon: 'bg-fuchsia-500/20',textIcon: 'text-fuchsia-600 dark:text-fuchsia-400', icon: Hash },
  'Creators':     { color: 'from-amber-500 to-yellow-400',  bgIcon: 'bg-amber-500/20',  textIcon: 'text-amber-600 dark:text-amber-400', icon: Camera },
};

export const DEFAULT_TRACK_THEME: TrackTheme = {
  color: 'from-gray-500 to-slate-400',
  bgIcon: 'bg-gray-500/20',
  textIcon: 'text-gray-600 dark:text-gray-400',
  icon: Folder,
};

export function getTrackTheme(nome: string): TrackTheme {
  return TRACK_THEMES[nome] || DEFAULT_TRACK_THEME;
}
