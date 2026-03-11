interface Props {
  imageSrc: string;
  titulo: string;
  subtitulo: string;
}

export default function SlideNovaSede({ imageSrc, titulo, subtitulo }: Props) {
  return (
    <div className="w-full h-full bg-zinc-950 text-white flex flex-col items-center justify-center" style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold tracking-tight">{titulo}</h2>
        <p className="text-zinc-400 text-sm mt-1">{subtitulo}</p>
      </div>

      {/* Image */}
      <img
        src={imageSrc}
        alt={titulo}
        style={{ maxWidth: "100%", maxHeight: "calc(100% - 80px)", objectFit: "contain", borderRadius: "12px" }}
      />
    </div>
  );
}
