import SlideLayout from "./SlideLayout";

interface Props {
  titulo?: string;
  subtitulo?: string;
  imageUrl?: string;
}

export default function SlideCustom({ titulo, subtitulo, imageUrl }: Props) {
  return (
    <SlideLayout section="closing" padding="24px 32px">
      <div className="flex-1 flex flex-col items-center justify-center">
        {titulo && (
          <div className="mb-4 text-center">
            <h2 className="text-2xl font-bold tracking-tight">{titulo}</h2>
            {subtitulo && <p className="text-zinc-400 text-sm mt-1">{subtitulo}</p>}
          </div>
        )}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={titulo || "Custom slide"}
            style={{ maxWidth: "100%", maxHeight: titulo ? "calc(100% - 80px)" : "100%", objectFit: "contain", borderRadius: "12px" }}
          />
        )}
      </div>
    </SlideLayout>
  );
}
