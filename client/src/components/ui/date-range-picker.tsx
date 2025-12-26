import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, subWeeks, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface Preset {
  label: string;
  getValue: () => DateRange;
}

const DEFAULT_PRESETS: Preset[] = [
  {
    label: "Hoje",
    getValue: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
  {
    label: "Ontem",
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: yesterday, to: yesterday };
    },
  },
  {
    label: "Essa semana",
    getValue: () => {
      const today = new Date();
      return { from: startOfWeek(today, { weekStartsOn: 0 }), to: today };
    },
  },
  {
    label: "Esse mês",
    getValue: () => {
      const today = new Date();
      return { from: startOfMonth(today), to: today };
    },
  },
  {
    label: "Esse ano",
    getValue: () => {
      const today = new Date();
      return { from: startOfYear(today), to: today };
    },
  },
  {
    label: "Últimos 7 dias",
    getValue: () => {
      const today = new Date();
      return { from: subDays(today, 6), to: today };
    },
  },
  {
    label: "Últimos 14 dias",
    getValue: () => {
      const today = new Date();
      return { from: subDays(today, 13), to: today };
    },
  },
  {
    label: "Últimos 30 dias",
    getValue: () => {
      const today = new Date();
      return { from: subDays(today, 29), to: today };
    },
  },
  {
    label: "Semana passada",
    getValue: () => {
      const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 });
      const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 });
      return { from: lastWeekStart, to: lastWeekEnd };
    },
  },
  {
    label: "Mês passado",
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    },
  },
];

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  presets?: Preset[];
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  numberOfMonths?: number;
  align?: "start" | "center" | "end";
}

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  className,
  triggerClassName,
  disabled = false,
  placeholder = "Selecione um período",
  numberOfMonths = 2,
  align = "start",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(value?.from || new Date());

  const displayText = useMemo(() => {
    if (!value?.from) return placeholder;
    if (!value.to) {
      return format(value.from, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    return `${format(value.from, "d 'de' MMMM 'de' yyyy", { locale: ptBR })} - ${format(value.to, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
  }, [value, placeholder]);

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getValue();
    onChange(range);
    setSelectedPreset(preset.label);
    if (range.from) {
      setMonth(range.from);
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    onChange(range);
    setSelectedPreset(null);
  };

  const handleApply = () => {
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal gap-2 min-w-[280px]",
            !value && "text-muted-foreground",
            triggerClassName
          )}
          data-testid="button-date-range-picker"
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0 z-[100]", className)} align={align} sideOffset={8}>
        <div className="flex">
          <div className="border-r border-border p-3 space-y-1 min-w-[160px]">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                  selectedPreset === preset.label
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "hover:bg-muted"
                )}
                data-testid={`preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          
          <div className="p-3">
            <Calendar
              mode="range"
              selected={value}
              onSelect={handleCalendarSelect}
              numberOfMonths={numberOfMonths}
              month={month}
              onMonthChange={setMonth}
              locale={ptBR}
              weekStartsOn={0}
            />
            
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <div className="px-3 py-1.5 bg-muted rounded-md min-w-[140px] text-center">
                  {value?.from ? format(value.from, "d 'de' MMM 'de' yyyy", { locale: ptBR }) : "Data inicial"}
                </div>
                <span className="text-muted-foreground">-</span>
                <div className="px-3 py-1.5 bg-muted rounded-md min-w-[140px] text-center">
                  {value?.to ? format(value.to, "d 'de' MMM 'de' yyyy", { locale: ptBR }) : "Data final"}
                </div>
              </div>
              <Button size="sm" onClick={handleApply} data-testid="button-apply-date-range">
                Aplicar
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              Fuso horário das datas: Horário de São Paulo
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DEFAULT_PRESETS };
export type { Preset, DateRangePickerProps };
