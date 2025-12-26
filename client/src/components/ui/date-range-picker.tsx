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
      <PopoverContent className={cn("w-auto p-0 z-[100]", className)} align={align} sideOffset={4}>
        <div className="flex">
          <ScrollArea className="border-r border-border max-h-[280px]">
            <div className="p-1.5 space-y-0.5 w-[100px]">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "w-full text-left px-2 py-1 text-[11px] rounded transition-colors",
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
          
          <div className="p-1.5">
            <Calendar
              mode="range"
              selected={value}
              onSelect={handleCalendarSelect}
              numberOfMonths={1}
              month={month}
              onMonthChange={setMonth}
              locale={ptBR}
              weekStartsOn={0}
              captionLayout="dropdown-buttons"
              fromYear={2020}
              toYear={2030}
              classNames={{
                months: "flex flex-col",
                month: "space-y-1",
                caption: "flex justify-center pt-0.5 relative items-center text-xs",
                caption_label: "hidden",
                caption_dropdowns: "flex gap-1",
                dropdown: "bg-background border rounded px-1 py-0.5 text-[10px]",
                dropdown_month: "font-medium",
                dropdown_year: "font-medium",
                nav: "flex items-center gap-0.5",
                nav_button: "h-5 w-5 bg-transparent p-0 hover:bg-muted rounded",
                nav_button_previous: "absolute left-0",
                nav_button_next: "absolute right-0",
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell: "text-muted-foreground w-6 font-normal text-[10px]",
                row: "flex w-full",
                cell: "text-center text-[10px] p-0 relative",
                day: "h-6 w-6 p-0 font-normal hover:bg-muted rounded transition-colors text-[10px]",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "bg-primary/20",
                day_hidden: "invisible",
              }}
            />
            
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-border gap-1">
              <div className="flex items-center gap-1 text-[10px]">
                <span className="px-1.5 py-0.5 bg-muted rounded">
                  {value?.from ? format(value.from, "dd/MM/yy") : "Início"}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">
                  {value?.to ? format(value.to, "dd/MM/yy") : "Fim"}
                </span>
              </div>
              <Button size="sm" className="h-6 text-[10px] px-2" onClick={handleApply} data-testid="button-apply-date-range">
                OK
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
