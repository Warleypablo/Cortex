import { Line, LineChart, ResponsiveContainer } from 'recharts';
import type { BadgePessoa, RankingPessoa, RankingMetrica } from './types';

function formatValor(metrica: RankingMetrica, valor: number) {
  if (metrica === 'nrr') return `${valor.toFixed(1)}%`;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function tendenciaTexto(pct: number): { texto: string; cor: string } | null {
  if (Math.abs(pct) < 0.5) return null;
  if (pct > 0) return { texto: `▲${pct.toFixed(0)}%`, cor: 'text-emerald-400' };
  return { texto: `▼${Math.abs(pct).toFixed(0)}%`, cor: 'text-red-400' };
}

const BADGE_INFO: Record<BadgePessoa, { icone: string; titulo: string; cor: string }> = {
  streak: { icone: '🔥', titulo: '3 meses em alta', cor: 'text-orange-400' },
  'sem-churn': { icone: '🛡️', titulo: 'Zero churn no período', cor: 'text-emerald-400' },
  'top-crescimento': { icone: '🚀', titulo: 'Top crescimento', cor: 'text-amber-400' },
};

function corDaPosicao(pos: number): string {
  // Gradiente do azul (4º) ao roxo (15º) — visualiza distância do topo
  if (pos <= 5) return 'from-cyan-500 to-blue-600';
  if (pos <= 8) return 'from-blue-500 to-indigo-600';
  if (pos <= 11) return 'from-indigo-500 to-purple-600';
  return 'from-purple-500 to-fuchsia-600';
}

export function RankingListaItem({
  pessoa,
  metrica,
}: {
  pessoa: RankingPessoa;
  metrica: RankingMetrica;
}) {
  const tend = tendenciaTexto(pessoa.tendenciaPct);
  const sparkData = pessoa.sparkline.map((v, i) => ({ i, v }));
  const corBadge = corDaPosicao(pessoa.posicaoAtual);

  return (
    <li className="group flex items-center gap-3 px-2 py-2 rounded-lg odd:bg-zinc-900/40 even:bg-transparent hover:bg-zinc-800/40 border-b border-zinc-800/40 transition-colors">
      {/* Badge gradiente da posição */}
      <span
        className={`flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br ${corBadge} text-white text-xs font-black shrink-0 shadow-md`}
      >
        {pessoa.posicaoAtual}
      </span>

      {/* Avatar com ring colorido da squad */}
      <span
        className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden ring-2"
        style={{ backgroundColor: pessoa.corSquad, boxShadow: `0 0 8px ${pessoa.corSquad}40` }}
        aria-hidden
      >
        {pessoa.avatarUrl ? (
          <img src={pessoa.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          iniciais(pessoa.nome)
        )}
      </span>

      <span className="flex-1 text-white truncate text-sm font-medium">{pessoa.nome}</span>

      <span className="flex items-center gap-1 w-20 justify-end" aria-label="conquistas">
        {pessoa.badges.map((b) => (
          <span
            key={b}
            className={`text-lg ${BADGE_INFO[b].cor} drop-shadow-[0_0_6px_currentColor]`}
            title={BADGE_INFO[b].titulo}
          >
            {BADGE_INFO[b].icone}
          </span>
        ))}
      </span>

      <span
        className="text-[10px] px-2 py-0.5 rounded-full text-white whitespace-nowrap max-w-[110px] truncate font-medium"
        style={{ backgroundColor: pessoa.corSquad }}
      >
        {pessoa.squad}
      </span>

      <div className="w-16 h-7 shrink-0">
        {sparkData.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={pessoa.tendenciaPct >= 0 ? '#34d399' : '#f87171'}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-700 text-xs">—</div>
        )}
      </div>

      <span className={`text-xs w-14 text-right font-bold ${tend?.cor ?? 'text-zinc-600'}`}>
        {tend?.texto ?? '—'}
      </span>

      <span className="text-white font-black w-24 text-right text-sm tracking-tight">
        {formatValor(metrica, pessoa.valor)}
      </span>
    </li>
  );
}
