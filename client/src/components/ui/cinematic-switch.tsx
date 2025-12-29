"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";

interface CinematicSwitchProps {
  defaultValue?: boolean;
  onChange?: (value: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  className?: string;
}

export default function CinematicSwitch({
  defaultValue = false,
  onChange,
  onLabel = "ON",
  offLabel = "OFF",
  className,
}: CinematicSwitchProps) {
  const [isOn, setIsOn] = useState(defaultValue);

  const handleToggle = () => {
    const newValue = !isOn;
    setIsOn(newValue);
    onChange?.(newValue);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-2xl bg-muted/50 border border-border backdrop-blur-sm shadow-xl cursor-pointer",
        className
      )}
      onClick={handleToggle}
      data-testid="cinematic-switch"
    >
      <span
        className={cn(
          "text-xs font-bold tracking-wider transition-colors duration-300",
          !isOn ? "text-muted-foreground" : "text-muted-foreground/40"
        )}
      >
        {offLabel}
      </span>

      <motion.div
        className="relative w-16 h-8 rounded-full shadow-inner"
        initial={false}
        animate={{
          backgroundColor: isOn ? "hsl(var(--primary))" : "hsl(var(--muted))",
        }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="absolute top-1 left-1 w-6 h-6 rounded-full border border-white/10 shadow-md"
          initial={false}
          animate={{
            x: isOn ? 32 : 0,
            backgroundColor: isOn ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          whileTap={{ scale: 0.9 }}
        >
          <div className="absolute top-1 left-1.5 w-2 h-1 bg-white/30 rounded-full blur-[1px]" />
        </motion.div>
      </motion.div>

      <span
        className={cn(
          "text-xs font-bold tracking-wider transition-colors duration-300",
          isOn ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" : "text-muted-foreground/40"
        )}
      >
        {onLabel}
      </span>
    </div>
  );
}

export { CinematicSwitch };
export type { CinematicSwitchProps };
