import { QrCode, MessageCircleQuestion, Smartphone } from "lucide-react";
import turboLogo from "@assets/logo-branca.png";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { entranceWith, DeckKeyframes } from "./deck-kit";

// ─────────────────────────────────────────────────────────────────────────────
// Slide de QR / Q&A. Usado duas vezes no deck:
//   • variant="abertura" — logo após o Mantra: a plateia escaneia cedo e já manda
//     perguntas enquanto o reporte roda.
//   • variant="qa" — último slide: o momento de responder.
//
// ⚠️ O QR ainda não chegou. Quando chegar, salve em `client/src/assets/qr-qa.png`,
// descomente o import abaixo e aponte QR_SRC para ele. É o único ponto de troca.
// ─────────────────────────────────────────────────────────────────────────────
// import qrCode from "@assets/qr-qa.png";
const QR_SRC: string | null = null;

const ACCENT = "#22d3ee";

/** O QR vai num card BRANCO: código escuro sobre fundo escuro não é escaneável. */
function QrFrame({ delayMs }: { delayMs: number }) {
  return (
    <div {...entranceWith(delayMs)}>
      <div
        className="rounded-3xl p-5 bg-white"
        style={{ boxShadow: `0 0 60px ${ACCENT}55, 0 0 0 1px ${ACCENT}66` }}
      >
        {QR_SRC ? (
          <img src={QR_SRC} alt="QR code para enviar perguntas" className="block" style={{ width: 260, height: 260 }} />
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-400"
            style={{ width: 260, height: 260 }}
          >
            <QrCode className="w-16 h-16" strokeWidth={1.25} />
            <p className="text-xs font-semibold tracking-widest uppercase">QR code</p>
            <p className="text-[10px] text-zinc-400">aguardando imagem</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SlideQrTrimestre({ variant }: { variant: "abertura" | "qa" }) {
  const isQa = variant === "qa";

  return (
    <SlideLayout section={isQa ? "closing" : "intro"} padding="48px 64px">
      <DeckKeyframes />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Topo: logo, como nos demais slides rituais */}
        <div {...entranceWith(0, "shrink-0")}>
          <img src={turboLogo} alt="Turbo Partners" className="h-7 object-contain" />
        </div>

        <div className="flex-1 flex items-center justify-center gap-20 min-h-0">
          {/* Texto */}
          <div className="max-w-[520px]">
            <div {...entranceWith(80, "flex items-center gap-2.5 mb-4")}>
              <MessageCircleQuestion className="w-4 h-4" style={{ color: ACCENT }} />
              <span className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: ACCENT }}>
                {isQa ? "Perguntas & Respostas" : "Participe"}
              </span>
            </div>

            <h1
              {...entranceWith(160, "font-black text-white leading-[0.95] tracking-tight", { fontSize: isQa ? 108 : 62 })}
            >
              {isQa ? (
                <>
                  Q<span style={{ color: ACCENT }}>&</span>A
                </>
              ) : (
                <>
                  Mande sua <span style={{ color: ACCENT }}>pergunta</span>
                </>
              )}
            </h1>

            <p {...entranceWith(240, "text-lg text-zinc-400 mt-5 leading-relaxed")}>
              {isQa
                ? "Vamos responder as perguntas enviadas ao longo da apresentação. Ainda dá tempo de mandar a sua."
                : "Aponte a câmera do celular para o QR code e envie sua pergunta a qualquer momento. Respondemos todas no Q&A, no final."}
            </p>

            <div {...entranceWith(320, "flex items-center gap-2.5 mt-7 text-zinc-500")}>
              <Smartphone className="w-4 h-4 shrink-0" />
              <span className="text-sm">Aponte a câmera — não precisa de app</span>
            </div>

            {/* Régua decorativa, igual ao ritual de abertura/encerramento */}
            <div
              {...entranceWith(400, "mt-8 h-[3px] rounded-full", { width: 180, background: `linear-gradient(90deg, ${ACCENT}, transparent)` })}
            />
          </div>

          {/* QR */}
          <QrFrame delayMs={200} />
        </div>
      </div>
    </SlideLayout>
  );
}
