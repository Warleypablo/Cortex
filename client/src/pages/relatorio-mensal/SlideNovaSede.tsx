interface Props {
  imageSrc: string;
  titulo: string;
  subtitulo: string;
}

export default function SlideNovaSede({ imageSrc, titulo, subtitulo }: Props) {
  return (
    <div className="w-full h-full text-white flex flex-col items-center justify-center relative overflow-hidden" style={{ padding: "24px 32px", background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      {/* Header */}
      <div className="relative z-10 mb-4 text-center">
        <h2 className="text-2xl font-bold tracking-tight">{titulo}</h2>
        <p className="text-zinc-400 text-sm mt-1">{subtitulo}</p>
      </div>

      {/* Image */}
      <img
        src={imageSrc}
        alt={titulo}
        className="relative z-10"
        style={{ maxWidth: "100%", maxHeight: "calc(100% - 80px)", objectFit: "contain", borderRadius: "12px" }}
      />
    </div>
  );
}
