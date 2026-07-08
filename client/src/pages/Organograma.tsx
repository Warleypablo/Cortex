import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";

// Organograma — Modelo Operacional 2026.
// A tela inteira é um HTML autocontido (5 abas: Estrutura, Organograma Vivo,
// Carteira, Como Operar, Jornada do Cliente) servido pelo endpoint autenticado
// /api/geg/organograma-modelo-2026 e embutido aqui via iframe. O HTML tem
// dark mode e persistência (localStorage) próprios, independentes do Cortex.
// Versão anterior desta página (organograma vivo do RH) está no histórico do git.

export default function Organograma() {
  usePageTitle("Organograma");
  useSetPageInfo("Organograma", "Modelo Operacional 2026 da Turbo Partners");

  return (
    <div className="h-full w-full">
      <iframe
        src="/api/geg/organograma-modelo-2026"
        title="Modelo Operacional 2026"
        className="h-full w-full border-0"
      />
    </div>
  );
}
