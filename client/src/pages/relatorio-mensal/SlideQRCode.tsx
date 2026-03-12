import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";
import qrCode from "@assets/Group 7385.png";

export default function SlideQRCode() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white p-12 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <img src={turboLogo} alt="Turbo Partners" className="relative z-10 h-10 object-contain mb-8 opacity-60" />

      <h2 className="relative z-10 text-2xl font-bold mb-2">Q&A</h2>
      <p className="relative z-10 text-zinc-400 mb-8">Escaneie o QR Code para enviar sua pergunta</p>

      <div className="relative z-10 w-64 h-64 bg-white rounded-2xl flex items-center justify-center p-4">
        <img src={qrCode} alt="QR Code" className="w-full h-full object-contain" />
      </div>
    </div>
  );
}
