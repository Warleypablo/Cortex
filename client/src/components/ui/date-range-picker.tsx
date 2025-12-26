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
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, startOfYear, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface Preset {
  label: string;
  getValue: () => DateRange;
}

interface PresetSection {
  title: string;
  presets: Preset[];
}

const currentYear = new Date().getFullYear();

const PRESET_SECTIONS: PresetSection[] = [
  {
    title: "Períodos",
    presets: [
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
        label: "Últimos 30 dias",
        getValue: () => {
          const today = new Date();
          return { from: subDays(today, 29), to: today };
        },
      },
      {
        label: "Últimos 90 dias",
        getValue: () => {
          const today = new Date();
          return { from: subDays(today, 89), to: today };
        },
      },
      {
        label: "Mês passado",
        getValue: () => {
          const lastMonth = subMonths(new Date(), 1);
          return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        },
      },
    ],
  },
  {
    title: "Trimestres",
    presets: [
      {
        label: "Q1",
        getValue: () => ({ from: new Date(currentYear, 0, 1), to: new Date(currentYear, 2, 31) }),
      },
      {
        label: "Q2",
        getValue: () => ({ from: new Date(currentYear, 3, 1), to: new Date(currentYear, 5, 30) }),
      },
      {
        label: "Q3",
        getValue: () => ({ from: new Date(currentYear, 6, 1), to: new Date(currentYear, 8, 30) }),
      },
      {
        label: "Q4",
        getValue: () => ({ from: new Date(currentYear, 9, 1), to: new Date(currentYear, 11, 31) }),
      },
    ],
  },
  {
    title: "Meses",
    presets: [
      {
        label: "Janeiro",
        getValue: () => ({ from: new Date(currentYear, 0, 1), to: new Date(currentYear, 0, 31) }),
      },
      {
        label: "Fevereiro",
        getValue: () => ({ from: new Date(currentYear, 1, 1), to: new Date(currentYear, 1, 29) }),
      },
      {
        label: "Março",
        getValue: () => ({ from: new Date(currentYear, 2, 1), to: new Date(currentYear, 2, 31) }),
      },
      {
        label: "Abril",
        getValue: () => ({ from: new Date(currentYear, 3, 1), to: new Date(currentYear, 3, 30) }),
      },
      {
        label: "Maio",
        getValue: () => ({ from: new Date(currentYear, 4, 1), to: new Date(currentYear, 4, 31) }),
      },
      {
        label: "Junho",
        getValue: () => ({ from: new Date(currentYear, 5, 1), to: new Date(currentYear, 5, 30) }),
      },
      {
        label: "Julho",
        getValue: () => ({ from: new Date(currentYear, 6, 1), to: new Date(currentYear, 6, 31) }),
      },
      {
        label: "Agosto",
        getValue: () => ({ from: new Date(currentYear, 7, 1), to: new Date(currentYear, 7, 31) }),
      },
      {
        label: "Setembro",
        getValue: () => ({ from: new Date(currentYear, 8, 1), to: new Date(currentYear, 8, 30) }),
      },
      {
        label: "Outubro",
        getValue: () => ({ from: new Date(currentYear, 9, 1), to: new Date(currentYear, 9, 31) }),
      },
      {
        label: "Novembro",
        getValue: () => ({ from: new Date(currentYear, 10, 1), to: new Date(currentYear, 10, 30) }),
      },
      {
        label: "Dezembro",
        getValue: () => ({ from: new Date(currentYear, 11, 1), to: new Date(currentYear, 11, 31) }),
      },
    ],
  },
];

// Flatten all presets for backwards compatibility
const DEFAULT_PRESETS: Preset[] = PRESET_SECTIONS.flatMap(section => section.presets);

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
  className,
  triggerClassName,
  disabled = false,
  placeholder = "Selecione um período",
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
          <ScrollArea className="border-r border-border h-[400px]">
            <div className="p-3 w-[140px]">
              {PRESET_SECTIONS.map((section, idx) => (
                <div key={section.title} className={cn(idx > 0 && "mt-4")}>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    {section.title}
                  </div>
                  <div className="space-y-0.5">
                    {section.presets.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => handlePresetClick(preset)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                          selectedPreset === preset.label
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-muted"
                        )}
                        data-testid={`preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className="p-4">
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
                month: "space-y-3",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "hidden",
                caption_dropdowns: "flex gap-2",
                dropdown: "bg-background border rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted font-medium",
                dropdown_month: "",
                dropdown_year: "",
                nav: "flex items-center gap-1",
                nav_button: "h-8 w-8 bg-transparent p-0 hover:bg-muted rounded-md transition-colors",
                nav_button_previous: "absolute left-0",
                nav_button_next: "absolute right-0",
                table: "w-full border-collapse mt-2",
                head_row: "flex",
                head_cell: "text-muted-foreground w-10 font-medium text-sm",
                row: "flex w-full mt-1",
                cell: "text-center text-sm p-0 relative",
                day: "h-10 w-10 p-0 font-normal hover:bg-muted rounded-md transition-colors",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary font-medium",
                day_today: "bg-accent text-accent-foreground font-semibold",
                day_outside: "text-muted-foreground opacity-40",
                day_disabled: "text-muted-foreground opacity-40",
                day_range_middle: "bg-primary/15 rounded-none",
                day_hidden: "invisible",
              }}
            />
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="px-3 py-1.5 bg-muted rounded-md font-medium">
                  {value?.from ? format(value.from, "dd/MM/yy") : "Início"}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="px-3 py-1.5 bg-muted rounded-md font-medium">
                  {value?.to ? format(value.to, "dd/MM/yy") : "Fim"}
                </span>
              </div>
              <Button size="sm" className="h-8 px-4" onClick={handleApply} data-testid="button-apply-date-range">
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DEFAULT_PRESETS, PRESET_SECTIONS };
export type { Preset, PresetSection, DateRangePickerProps };
