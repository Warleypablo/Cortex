import { ShoppingBag } from "lucide-react";
import SlideLayout from "./SlideLayout";
import storePrint from "@assets/turbo-store.png";
import storeQr from "@assets/turbo-store-qr.jpeg";

export default function SlideTurboStore() {
  return (
    <SlideLayout section="commerce" padding="48px 56px">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl"
          style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)" }}
        >
          <ShoppingBag className="w-6 h-6 text-cyan-300" />
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Turbo Store</h1>
          <p className="text-zinc-400 text-lg">Nossa loja oficial está no ar</p>
        </div>
      </div>

      {/* Body: screenshot em moldura de navegador + QR card */}
      <div className="flex-1 flex items-center gap-10 min-h-0">
        {/* Screenshot do site numa moldura de navegador */}
        <div
          className="flex-1 rounded-2xl overflow-hidden border border-white/10"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}
        >
          {/* Barra do navegador */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.06] border-b border-white/10">
            <span className="w-3 h-3 rounded-full bg-red-400/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
            <span className="w-3 h-3 rounded-full bg-green-400/80" />
            <div className="ml-3 flex-1 max-w-md px-3 py-1 rounded-md bg-white/[0.06] text-xs text-zinc-400 truncate">
              turbostore.com.br
            </div>
          </div>
          <img src={storePrint} alt="Turbo Store" className="w-full object-cover object-top" />
        </div>

        {/* QR card */}
        <div className="flex flex-col items-center shrink-0">
          <div
            className="w-56 h-56 bg-white/95 rounded-2xl flex items-center justify-center p-4"
            style={{ boxShadow: "0 0 40px rgba(34,211,238,0.25)" }}
          >
            <img src={storeQr} alt="QR Code da loja" className="w-full h-full object-contain" />
          </div>
          <p className="mt-5 text-center text-lg font-semibold text-cyan-300">Escaneie para</p>
          <p className="text-center text-lg font-semibold text-cyan-300">acessar a loja</p>
        </div>
      </div>
    </SlideLayout>
  );
}
