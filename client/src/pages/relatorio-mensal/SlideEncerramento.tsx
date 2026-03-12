import teamPhoto from "@assets/image.png";
import SlideLayout from "./SlideLayout";

export default function SlideEncerramento() {
  return (
    <SlideLayout section="closing" showLogo={false} padding="24px 32px">
      <div className="flex-1 flex flex-col items-center justify-center">
        <img
          src={teamPhoto}
          alt="Time Turbo Partners"
          style={{ maxWidth: "85%", maxHeight: "calc(100% - 100px)", objectFit: "contain", borderRadius: "16px" }}
        />
        <h2 className="mt-6 text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Vamos com Turbo!
        </h2>
      </div>
    </SlideLayout>
  );
}
