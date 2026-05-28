import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

type PostRow = {
  ig_media_id: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_type: string | null;
  posted_at: string | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  total_interactions: number;
  engagers: number;
};

type Analytics = { posts: PostRow[]; funnel: { stage: string; n: number }[] };

const STAGE_LABEL: Record<string, string> = {
  engajador: "Engajadores",
  oportunidade: "Oportunidades",
  negocio: "Negócios",
};

export default function SocialMedia() {
  const { data, isLoading } = useQuery<Analytics>({ queryKey: ["/api/crm-instagram/analytics"] });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const posts = data?.posts || [];
  const funnel = data?.funnel || [];

  return (
    <div className="space-y-6">
      {/* Funil resumido */}
      <div className="grid grid-cols-3 gap-3">
        {["engajador", "oportunidade", "negocio"].map((s) => {
          const n = funnel.find((f) => f.stage === s)?.n || 0;
          return (
            <div key={s} className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
              <div className="text-xs text-gray-500 dark:text-zinc-400">{STAGE_LABEL[s]}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{n}</div>
            </div>
          );
        })}
      </div>

      {/* Tabela de posts */}
      <div className="rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
            <tr>
              <th className="text-left p-3 font-medium">Post</th>
              <th className="text-right p-3 font-medium">Alcance</th>
              <th className="text-right p-3 font-medium">Coment.</th>
              <th className="text-right p-3 font-medium">Interações</th>
              <th className="text-right p-3 font-medium">Engajadores no garimpo</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.ig_media_id} className="border-t border-gray-100 dark:border-zinc-800">
                <td className="p-3 max-w-xs">
                  <a href={p.permalink || "#"} target="_blank" rel="noreferrer"
                     className="text-gray-900 dark:text-white hover:underline line-clamp-1">
                    {p.caption?.slice(0, 60) || p.ig_media_id}
                  </a>
                  <div className="text-xs text-gray-400">
                    {p.posted_at ? new Date(p.posted_at).toLocaleDateString("pt-BR") : ""} · {p.media_type}
                  </div>
                </td>
                <td className="p-3 text-right text-gray-700 dark:text-zinc-300">{p.reach?.toLocaleString("pt-BR")}</td>
                <td className="p-3 text-right text-gray-700 dark:text-zinc-300">{p.comments?.toLocaleString("pt-BR")}</td>
                <td className="p-3 text-right text-gray-700 dark:text-zinc-300">{p.total_interactions?.toLocaleString("pt-BR")}</td>
                <td className="p-3 text-right font-semibold text-gray-900 dark:text-white">{Number(p.engagers).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Sem posts coletados ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
