import { useEffect, useState, type ReactNode } from 'react';

type Props = { screens: ReactNode[]; intervalMs?: number };

export function TvRotator({ screens, intervalMs = 30000 }: Props) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (screens.length <= 1) return;
    const tick = 100;
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += tick;
      setProgress(Math.min(100, (elapsed / intervalMs) * 100));
      if (elapsed >= intervalMs) {
        setIndex((i) => (i + 1) % screens.length);
        elapsed = 0;
        setProgress(0);
      }
    }, tick);
    return () => clearInterval(id);
  }, [intervalMs, screens.length]);

  return (
    <div className="relative h-full w-full">
      <div key={index} className="h-full w-full animate-[fadeIn_400ms_ease-in-out]">
        {screens[index]}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
        <div
          className="h-full bg-primary transition-all duration-100"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}
