import { useEffect, useState } from 'react';
import { TvRotator } from '@/components/tv-leaderboard/TvRotator';
import { TelaSquads } from '@/components/tv-leaderboard/TelaSquads';
import { TelaPessoas } from '@/components/tv-leaderboard/TelaPessoas';
import { useTvLeaderboardData } from '@/hooks/useTvLeaderboardData';

function useRelogio() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TvLeaderboard() {
  const now = useRelogio();
  const { data, isLoading, error, dataUpdatedAt } = useTvLeaderboardData();

  return (
    <div className="dark fixed inset-0 bg-zinc-950 text-white flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📺</span>
          <span className="text-zinc-300 text-lg uppercase tracking-wider">Forcell</span>
        </div>
        <div className="text-white text-xl font-semibold">
          {now.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' })}
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center h-full text-zinc-400 text-2xl">
            Carregando…
          </div>
        )}
        {error && !data && (
          <div className="flex items-center justify-center h-full text-red-400 text-2xl">
            Falha ao carregar dados
          </div>
        )}
        {data && (
          <TvRotator
            intervalMs={30000}
            screens={[<TelaSquads data={data} />, <TelaPessoas data={data} />]}
          />
        )}
      </main>

      {data && (
        <footer className="px-6 py-1 text-zinc-500 text-xs text-right">
          Última atualização: {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')}
        </footer>
      )}
    </div>
  );
}
