import { useState } from "react";
import type React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

// ── Exported interface ───────────────────────────────────────────────────────

export interface Servico {
  produto: string | null;
  status: string | null;
  responsavel: string | null;
}

// ── Form constants ───────────────────────────────────────────────────────────

const MOTIVOS_CANCELAMENTO = [
  'Resultado abaixo do esperado',
  'Custo × benefício não justifica',
  'Mudança de estratégia interna',
  'Insatisfação com o atendimento',
  'Crise financeira / corte de custos',
  'Encerramento da empresa',
  'Outro',
];

const PONTOS_MELHORIA = [
  'Comunicação com o time',
  'Frequência das entregas',
  'Qualidade dos materiais',
  'Resultados e métricas apresentados',
  'Suporte e atendimento',
  'Transparência nas estratégias',
  'Relação custo-benefício',
];

const PROXIMO_PASSO_OPCOES = [
  'Farei as ações internamente',
  'Contratarei outro fornecedor',
  'Vou pausar os investimentos',
  'Ainda não decidi',
];

const RETORNO_OPCOES = [
  'Sim, com certeza',
  'Talvez, dependendo das condições',
  'Provavelmente não',
];

const URGENCIAS_CANCELAMENTO = [
  { value: 'imediato', label: 'Imediato' },
  { value: 'fim_periodo', label: 'No final do período contratado' },
  { value: 'a_combinar', label: 'A combinar' },
];

const NOTAS_CONFIG = [
  { value: 1, emoji: '😞', label: 'Péssimo', activeClass: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { value: 2, emoji: '😕', label: 'Ruim',    activeClass: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
  { value: 3, emoji: '😐', label: 'Regular', activeClass: 'bg-amber-500/15 border-amber-500/35 text-amber-300' },
  { value: 4, emoji: '🙂', label: 'Bom',     activeClass: 'bg-lime-500/15 border-lime-500/35 text-lime-300' },
  { value: 5, emoji: '😊', label: 'Ótimo',   activeClass: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300' },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function CheckRow({
  label,
  checked,
  onChange,
  isDark,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  isDark: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
          checked
            ? 'bg-red-500/15 border-red-500/40'
            : isDark
              ? 'bg-zinc-800 border-white/[0.12] group-hover:border-white/25'
              : 'bg-gray-100 border-gray-300 group-hover:border-gray-400'
        }`}
      >
        {checked && <Check className="w-2.5 h-2.5 text-red-400" />}
      </div>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span
        className={`text-sm transition-colors ${
          checked
            ? isDark ? 'text-white/80' : 'text-gray-900'
            : isDark
              ? 'text-white/40 group-hover:text-white/60'
              : 'text-gray-400 group-hover:text-gray-600'
        }`}
      >
        {label}
      </span>
    </label>
  );
}

function RadioRow({
  value,
  label,
  selected,
  onChange,
  isDark,
}: {
  value: string;
  label: string;
  selected: boolean;
  onChange: () => void;
  isDark: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
          selected
            ? 'bg-amber-500/15 border-amber-500/40'
            : isDark
              ? 'bg-zinc-800 border-white/[0.12] group-hover:border-white/25'
              : 'bg-gray-100 border-gray-300 group-hover:border-gray-400'
        }`}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-amber-400" />}
      </div>
      <input type="radio" className="sr-only" checked={selected} onChange={onChange} />
      <span
        className={`text-sm transition-colors ${
          selected
            ? isDark ? 'text-white/80' : 'text-gray-900'
            : isDark
              ? 'text-white/40 group-hover:text-white/60'
              : 'text-gray-400 group-hover:text-gray-600'
        }`}
      >
        {label}
      </span>
    </label>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function CancelamentoModal({ servico, onClose }: { servico: Servico; onClose: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const queryClient = useQueryClient();
  const [nota, setNota] = useState<number | null>(null);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [pontosMelhoria, setPontosMelhoria] = useState<string[]>([]);
  const [proximoPasso, setProximoPasso] = useState('');
  const [retorno, setRetorno] = useState('');
  const [urgencia, setUrgencia] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  function toggle(list: string[], set: (v: string[]) => void, item: string) {
    set(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!motivos.length) { setError('Selecione ao menos um motivo.'); return; }
    if (!urgencia) { setError('Informe a urgência do cancelamento.'); return; }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/portal-cliente/solicitacao-cancelamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto: servico.produto,
          nota,
          motivos,
          pontosMelhoria: pontosMelhoria.length > 0 ? pontosMelhoria : null,
          proximoPasso: proximoPasso || null,
          retorno: retorno || null,
          urgencia,
          detalhe: detalhe.trim() || null,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Erro ao enviar'); return; }
      queryClient.invalidateQueries({ queryKey: ['/api/portal-cliente/chat'] });
      setEnviado(true);
    } catch {
      setError('Erro ao conectar');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`border rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50 overflow-hidden ${
          isDark
            ? 'bg-zinc-900 border-white/[0.10]'
            : 'bg-white border-gray-200'
        }`}
      >

        {enviado ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <p className={`font-semibold ${isDark ? 'text-white/85' : 'text-gray-900'}`}>
                Solicitação enviada!
              </p>
              <p className={`text-sm leading-relaxed max-w-xs ${isDark ? 'text-white/35' : 'text-gray-500'}`}>
                Nossa equipe recebeu o pedido de cancelamento e entrará em contato em breve.
              </p>
            </div>
            <button
              onClick={onClose}
              className={`mt-1 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                isDark
                  ? 'bg-white/[0.07] hover:bg-white/[0.12] text-white/55 hover:text-white/80 border-white/[0.08]'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 border-gray-200'
              }`}
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              className={`px-5 py-4 border-b flex items-start justify-between gap-3 shrink-0 ${
                isDark ? 'border-white/[0.07]' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${isDark ? 'text-white/90' : 'text-gray-900'}`}>
                    Solicitar Cancelamento
                  </p>
                  <p className={`text-xs mt-0.5 line-clamp-1 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                    {servico.produto ?? 'Serviço'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  isDark
                    ? 'text-white/25 hover:text-white/60 hover:bg-white/5'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className={`overflow-y-auto divide-y ${isDark ? 'divide-white/[0.05]' : 'divide-gray-100'}`}
              style={{ maxHeight: 'calc(85vh - 130px)' }}
            >

              {/* 1 — Satisfação geral */}
              <div className="p-5 space-y-3">
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/35' : 'text-gray-400'}`}>
                  Satisfação geral com o serviço
                </p>
                <div className="flex gap-2">
                  {NOTAS_CONFIG.map(({ value, emoji, label, activeClass }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNota(nota === value ? null : value)}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
                        nota === value
                          ? activeClass
                          : isDark
                            ? 'bg-zinc-800/60 border-white/[0.08] text-white/25 hover:border-white/20 hover:text-white/50'
                            : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                      }`}
                    >
                      <span className="text-xl leading-none">{emoji}</span>
                      <span className="text-[10px]">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2 — Motivos */}
              <div className="p-5 space-y-3">
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/35' : 'text-gray-400'}`}>
                  Motivo do cancelamento <span className="text-red-400/60">*</span>
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {MOTIVOS_CANCELAMENTO.map(m => (
                    <CheckRow
                      key={m}
                      label={m}
                      checked={motivos.includes(m)}
                      onChange={() => toggle(motivos, setMotivos, m)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>

              {/* 3 — O que poderia melhorar */}
              <div className="p-5 space-y-3">
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/35' : 'text-gray-400'}`}>
                  O que poderia ter sido melhor?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PONTOS_MELHORIA.map(m => (
                    <CheckRow
                      key={m}
                      label={m}
                      checked={pontosMelhoria.includes(m)}
                      onChange={() => toggle(pontosMelhoria, setPontosMelhoria, m)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>

              {/* 4 — Próximo passo */}
              <div className="p-5 space-y-3">
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/35' : 'text-gray-400'}`}>
                  Qual será o próximo passo?
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {PROXIMO_PASSO_OPCOES.map(o => (
                    <RadioRow
                      key={o}
                      value={o}
                      label={o}
                      selected={proximoPasso === o}
                      onChange={() => setProximoPasso(proximoPasso === o ? '' : o)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>

              {/* 5 — Consideraria voltar */}
              <div className="p-5 space-y-3">
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/35' : 'text-gray-400'}`}>
                  Consideraria voltar no futuro?
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {RETORNO_OPCOES.map(o => (
                    <RadioRow
                      key={o}
                      value={o}
                      label={o}
                      selected={retorno === o}
                      onChange={() => setRetorno(retorno === o ? '' : o)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>

              {/* 6 — Urgência */}
              <div className="p-5 space-y-3">
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/35' : 'text-gray-400'}`}>
                  Urgência do cancelamento <span className="text-red-400/60">*</span>
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {URGENCIAS_CANCELAMENTO.map(u => (
                    <RadioRow
                      key={u.value}
                      value={u.value}
                      label={u.label}
                      selected={urgencia === u.value}
                      onChange={() => setUrgencia(u.value)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>

              {/* 7 — Observações */}
              <div className="p-5 space-y-2.5">
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/35' : 'text-gray-400'}`}>
                  Observações{' '}
                  <span className={`font-normal normal-case ${isDark ? 'text-white/20' : 'text-gray-300'}`}>(opcional)</span>
                </p>
                <textarea
                  value={detalhe}
                  onChange={e => setDetalhe(e.target.value)}
                  placeholder="Alguma mensagem final para o nosso time?"
                  rows={3}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none resize-none transition-colors ${
                    isDark
                      ? 'bg-zinc-800 border-white/[0.08] text-white/75 placeholder:text-white/20 focus:border-red-500/25'
                      : 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-300 focus:border-red-300'
                  }`}
                />
              </div>

              {/* Footer */}
              <div className={`p-5 space-y-3 ${isDark ? 'bg-zinc-900/60' : 'bg-gray-50/80'}`}>
                {error && <p className="text-red-400/80 text-xs">{error}</p>}
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                      isDark
                        ? 'bg-zinc-800 hover:bg-zinc-700/80 text-white/40 hover:text-white/60 border-white/[0.07]'
                        : 'bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-700 border-gray-200'
                    }`}
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 hover:bg-red-500/18 text-red-400 transition-colors border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {sending ? 'Enviando...' : 'Enviar Solicitação'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
