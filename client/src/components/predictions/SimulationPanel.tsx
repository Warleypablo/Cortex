// client/src/components/predictions/SimulationPanel.tsx
import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  format: (value: number) => string; // ex: (v) => `${v}%` or (v) => `R$ ${v}`
}

interface SimulationPanelProps {
  sliders: SliderConfig[];
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  deltaLabel?: string;
  deltaValue?: string;
}

export function SimulationPanel({ sliders, values, onChange, deltaLabel, deltaValue }: SimulationPanelProps) {
  const handleChange = useCallback((key: string, val: number[]) => {
    onChange({ ...values, [key]: val[0] });
  }, [values, onChange]);

  const handleReset = useCallback(() => {
    const defaults: Record<string, number> = {};
    for (const s of sliders) {
      defaults[s.key] = s.defaultValue;
    }
    onChange(defaults);
  }, [sliders, onChange]);

  const hasChanges = sliders.some(s => values[s.key] !== s.defaultValue);

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          Simulador What-If
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {sliders.map((s) => (
          <div key={s.key} className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-zinc-400">{s.label}</span>
              <span className={`font-mono font-medium ${
                values[s.key] !== s.defaultValue
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {s.format(values[s.key])}
              </span>
            </div>
            <Slider
              value={[values[s.key]]}
              min={s.min}
              max={s.max}
              step={s.step}
              onValueChange={(val) => handleChange(s.key, val)}
            />
          </div>
        ))}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
            className="text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Resetar
          </Button>
          {deltaLabel && deltaValue && hasChanges && (
            <div className="text-right">
              <div className="text-[10px] text-gray-500 dark:text-zinc-500">{deltaLabel}</div>
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{deltaValue}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
