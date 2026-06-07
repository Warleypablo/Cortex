import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SlideProps } from "@/pages/FechamentoSemanal";
import turboLogo from "@assets/logo-branca.png";

export default function SlideCapaSemana({ semanaInicio, semanaFim }: SlideProps) {
  const inicio = parseISO(semanaInicio);
  const fim = parseISO(semanaFim);
  const periodoLabel = `${format(inicio, "dd 'de' MMMM", { locale: ptBR })} – ${format(fim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;

  return (
    <div className="h-full flex flex-col items-center justify-center bg-zinc-950 text-white px-12">
      <img src={turboLogo} alt="Turbo" className="h-16 mb-12 opacity-90" />
      <h1 className="text-7xl font-bold tracking-tight text-center mb-6">
        Fechamento Semanal
      </h1>
      <p className="text-2xl text-zinc-400 font-medium text-center">{periodoLabel}</p>
      <div className="mt-16 w-24 h-1 bg-emerald-500 rounded-full" />
    </div>
  );
}
