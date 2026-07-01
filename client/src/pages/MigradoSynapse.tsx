import { Link } from "wouter";
import { ArrowRightLeft, Sparkles, ArrowLeft } from "lucide-react";

/**
 * Tela de bloqueio visual para as áreas de G&G migradas para o Synapse.
 *
 * NÃO é um bloqueio de segurança — é apenas um aviso visual que impede o uso
 * das telas de G&G dentro do Cortex. Para reativar essas telas, basta remover
 * o guard `isGegBlocked` em client/src/App.tsx (as rotas e componentes
 * originais continuam intactos).
 */
export default function MigradoSynapse() {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* brilho decorativo de fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        />

        <div className="relative flex flex-col items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <ArrowRightLeft className="h-7 w-7 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Área migrada para o Synapse
            </h1>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
              Todas as telas de <span className="font-semibold text-gray-900 dark:text-white">G&amp;G</span> foram
              movidas para o <span className="font-semibold text-primary">Synapse</span>. Acesse-as por lá — esta
              versão dentro do Cortex está temporariamente indisponível.
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/10">
            <Sparkles className="h-3.5 w-3.5" />
            Novo lar das telas de Gente &amp; Gestão
          </div>

          <Link
            href="/"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            data-testid="link-voltar-inicio"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
