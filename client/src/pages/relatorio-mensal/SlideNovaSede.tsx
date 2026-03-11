interface Props {
  imageSrc: string;
  titulo: string;
  subtitulo: string;
}

export default function SlideNovaSede({ imageSrc, titulo, subtitulo }: Props) {
  return (
    <div className="w-full h-full bg-zinc-950 text-white flex flex-col" style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div className="mb-3 shrink-0">
        <h2 className="text-2xl font-bold tracking-tight">{titulo}</h2>
        <p className="text-zinc-400 text-sm mt-1">{subtitulo}</p>
      </div>

      {/* Image container */}
      <div className="flex-1 min-h-0 flex items-center justify-center rounded-xl overflow-hidden bg-zinc-900/40 border border-zinc-800">
        <img
          src={imageSrc}
          alt={titulo}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  );
}
