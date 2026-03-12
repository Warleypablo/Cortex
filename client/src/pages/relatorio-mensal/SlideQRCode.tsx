import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

export default function SlideQRCode() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white p-12 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <img src={turboLogo} alt="Turbo Partners" className="relative z-10 h-10 object-contain mb-8 opacity-60" />

      <h2 className="relative z-10 text-2xl font-bold mb-2">Q&A</h2>
      <p className="relative z-10 text-zinc-400 mb-8">Escaneie o QR Code para enviar sua pergunta</p>

      <div className="relative z-10 w-64 h-64 bg-white rounded-2xl flex items-center justify-center">
        <div className="text-zinc-400 text-sm text-center p-4">
          <svg className="w-32 h-32 mx-auto mb-2 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm14 3h.01M17 14h.01M14 14h3v3h-3v-3zm0 4h3v3h-3v-3zm4-4h3v3h-3v-3zm0 4h3v3h-3v-3z" />
          </svg>
          QR Code em breve
        </div>
      </div>

      <p className="relative z-10 text-zinc-500 text-sm mt-6">Link será configurado em breve</p>
    </div>
  );
}
