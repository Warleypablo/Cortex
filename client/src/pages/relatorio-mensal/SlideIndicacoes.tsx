import { Gift } from "lucide-react";

export default function SlideIndicacoes() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white p-12">
      <Gift className="h-16 w-16 text-emerald-500 mb-6" />
      <h2 className="text-3xl font-bold mb-2">Indicações</h2>
      <p className="text-zinc-400 text-lg mb-8">Valores de indicações pontuais e recorrentes</p>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center max-w-lg">
        <p className="text-zinc-500 text-base">
          Em breve: dados de indicações recebidas, contratos fechados por indicação e valores recorrentes e pontuais.
        </p>
      </div>
    </div>
  );
}
