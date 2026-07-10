import fotoRodrigoPimenta from "@assets/novo-rodrigo-pimenta.png";
import fotoRichardAnderson from "@assets/novo-richard-anderson.png";
import fotoBrenoMoscardini from "@assets/novo-breno-moscardini.png";
import fotoLeonardoKruger from "@assets/novo-leonardo-kruger.png";

// ─────────────────────────────────────────────────────────────────────────────
// Kit compartilhado dos slides de gente do deck trimestral (Novos + Aniversários,
// Aniversário de Empresa). Espelha a lógica de fotos manuais do slide mensal
// (SlideNovosAniversariantes) — colaboradores cuja foto do Google é silhueta
// genérica (ou ausente). O match exige TODOS os tokens (2+) para evitar colisão
// com homônimos. Ver memória reference_fotos_nome_clickup_rh.
// ─────────────────────────────────────────────────────────────────────────────
const FOTOS_MANUAIS: { tokens: string[]; foto: string }[] = [
  { tokens: ["rodrigo", "pimenta"], foto: fotoRodrigoPimenta },
  { tokens: ["richard", "anderson"], foto: fotoRichardAnderson },
  { tokens: ["breno", "moscardini"], foto: fotoBrenoMoscardini },
  { tokens: ["leonardo", "kruger"], foto: fotoLeonardoKruger },
];

function normalizarNome(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function fotoManual(nome: string): string | null {
  const tokens = normalizarNome(nome).split(/\s+/).filter(Boolean);
  const match = FOTOS_MANUAIS.find((o) => o.tokens.every((t) => tokens.includes(t)));
  return match ? match.foto : null;
}

function initials(nome: string): string {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

/** Avatar redondo no tom da seção "people" (rosa→roxo). Foto manual > foto do banco > iniciais. */
export function PessoaAvatar({ nome, fotoUrl, px = 56 }: { nome: string; fotoUrl: string | null; px?: number }) {
  const foto = fotoManual(nome) ?? fotoUrl;
  const style = { width: px, height: px };
  if (foto) {
    return (
      <img
        src={foto}
        alt={nome}
        style={style}
        className="rounded-full object-cover ring-2 ring-white/10 shadow-lg shadow-pink-500/10 shrink-0"
        referrerPolicy="no-referrer"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div
      style={{ ...style, fontSize: Math.max(px * 0.32, 11) }}
      className="rounded-full bg-gradient-to-br from-pink-500/80 to-violet-600/80 ring-2 ring-white/10 shadow-lg shadow-pink-500/10 flex items-center justify-center font-bold text-white/90 shrink-0"
    >
      {initials(nome)}
    </div>
  );
}
