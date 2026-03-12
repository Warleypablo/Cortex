import teamPhoto from "@assets/image.png";

export default function SlideEncerramento() {
  return (
    <div className="w-full h-full text-white flex flex-col items-center justify-center relative overflow-hidden" style={{ padding: "24px 32px", background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <img
        src={teamPhoto}
        alt="Time Turbo Partners"
        className="relative z-10"
        style={{ maxWidth: "85%", maxHeight: "calc(100% - 100px)", objectFit: "contain", borderRadius: "16px" }}
      />
      <h2 className="relative z-10 mt-6 text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
        Vamos com Turbo!
      </h2>
    </div>
  );
}
