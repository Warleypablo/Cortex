import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
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

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };
  return { isFullscreen, toggle };
}

export default function TvLeaderboard() {
  const now = useRelogio();
  const { isFullscreen, toggle } = useFullscreen();
  const { data, isLoading, error, dataUpdatedAt, rankingsLoading, rankingsError } =
    useTvLeaderboardData();

  return (
    <div className="dark fixed inset-0 z-[100] bg-zinc-950 text-white flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📺</span>
          <span className="text-zinc-300 text-lg uppercase tracking-wider">Forcell</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-white text-xl font-semibold">
            {now.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' })}
          </div>
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 text-sm transition-colors"
            title={isFullscreen ? 'Sair do modo apresentação' : 'Modo apresentação (tela cheia)'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Apresentação'}</span>
          </button>
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
            screens={[
              <TelaSquads data={data} />,
              <TelaPessoas
                data={data}
                rankingsLoading={rankingsLoading}
                rankingsError={rankingsError}
              />,
            ]}
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
