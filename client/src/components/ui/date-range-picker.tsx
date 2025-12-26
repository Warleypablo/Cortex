import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
        <div className="flex max-h-[400px]">
          <ScrollArea className="border-r border-border">
            <div className="p-2 space-y-0.5 min-w-[130px]">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors",
                    selectedPreset === preset.label
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted"
                  )}
                  data-testid={`preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </ScrollArea>
          
          <div className="p-2">
            <Calendar
              mode="range"
              selected={value}
              onSelect={handleCalendarSelect}
              numberOfMonths={numberOfMonths}
              month={month}
              onMonthChange={setMonth}
              locale={ptBR}
              weekStartsOn={0}
              captionLayout="dropdown-buttons"
              fromYear={2020}
              toYear={2030}
              classNames={{
                caption: "flex justify-center pt-1 relative items-center text-sm",
                caption_label: "hidden",
                caption_dropdowns: "flex gap-1",
                dropdown: "bg-background border rounded px-1 py-0.5 text-xs",
                dropdown_month: "font-medium",
                dropdown_year: "font-medium",
                nav: "flex items-center gap-1",
                nav_button: "h-6 w-6 bg-transparent p-0 hover:bg-muted rounded",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell: "text-muted-foreground w-7 font-normal text-[0.7rem]",
                row: "flex w-full",
                cell: "text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
                day: "h-7 w-7 p-0 font-normal hover:bg-muted rounded-md transition-colors",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "bg-primary/20",
                day_hidden: "invisible",
              }}
            />
            
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border gap-2">
              <div className="flex items-center gap-1 text-xs">
                <div className="px-2 py-1 bg-muted rounded text-center min-w-[90px]">
                  {value?.from ? format(value.from, "dd/MM/yy", { locale: ptBR }) : "Início"}
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="px-2 py-1 bg-muted rounded text-center min-w-[90px]">
                  {value?.to ? format(value.to, "dd/MM/yy", { locale: ptBR }) : "Fim"}
                </div>
              </div>
              <Button size="sm" className="h-7 text-xs" onClick={handleApply} data-testid="button-apply-date-range">
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DEFAULT_PRESETS };
export type { Preset, DateRangePickerProps };
