import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";
import qrCode from "@assets/Group 7385.png";
import SlideLayout from "./SlideLayout";

export default function SlideQRCode() {
  return (
    <SlideLayout section="intro" showLogo={false} padding="48px">
      <div className="flex-1 flex flex-col items-center justify-center">
        <img src={turboLogo} alt="Turbo Partners" className="h-10 object-contain mb-8 opacity-60" />

        <h2 className="text-2xl font-bold mb-2">Q&A</h2>
        <p className="text-zinc-400 mb-8">Escaneie o QR Code para enviar sua pergunta</p>

        <div className="w-64 h-64 bg-white/95 rounded-2xl flex items-center justify-center p-4" style={{ boxShadow: "0 0 40px rgba(139,92,246,0.2)" }}>
          <img src={qrCode} alt="QR Code" className="w-full h-full object-contain" />
        </div>
      </div>
    </SlideLayout>
  );
}
