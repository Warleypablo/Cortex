import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarIcon, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, startOfYear, subMonths, differenceInCalendarDays } from "date-fns";
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
        label: "Últimos 3 dias",
        getValue: () => {
          const today = new Date();
          return { from: subDays(today, 2), to: today };
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

interface ComparePreset {
  label: string;
  getValue: (range: DateRange) => DateRange | undefined;
}

const COMPARE_PRESETS: ComparePreset[] = [
  {
    label: 'Período anterior',
    getValue: (range: DateRange) => {
      if (!range.from || !range.to) return undefined;
      const diff = differenceInCalendarDays(range.to, range.from);
      const prevEnd = subDays(range.from, 1);
      const prevStart = subDays(prevEnd, diff);
      return { from: prevStart, to: prevEnd };
    },
  },
  {
    label: 'Mês anterior',
    getValue: (range: DateRange) => {
      if (!range.from || !range.to) return undefined;
      const prevMonthStart = startOfMonth(subMonths(range.from, 1));
      const prevMonthEnd = endOfMonth(subMonths(range.from, 1));
      return { from: prevMonthStart, to: prevMonthEnd };
    },
  },
  {
    label: 'Mesmo período ano anterior',
    getValue: (range: DateRange) => {
      if (!range.from || !range.to) return undefined;
      const prevYearFrom = new Date(range.from);
      prevYearFrom.setFullYear(prevYearFrom.getFullYear() - 1);
      const prevYearTo = new Date(range.to);
      prevYearTo.setFullYear(prevYearTo.getFullYear() - 1);
      return { from: prevYearFrom, to: prevYearTo };
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
  compareEnabled?: boolean;
  compareRange?: DateRange;
  onCompareChange?: (enabled: boolean, range: DateRange | undefined) => void;
  showCompare?: boolean;
}

const PINNED_PRESETS_KEY = 'date-range-picker-pinned-presets';

function getPinnedPresets(): string[] {
  try {
    const stored = localStorage.getItem(PINNED_PRESETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function togglePinnedPreset(label: string): string[] {
  const pinned = getPinnedPresets();
  const idx = pinned.indexOf(label);
  if (idx >= 0) {
    pinned.splice(idx, 1);
  } else {
    pinned.push(label);
  }
  localStorage.setItem(PINNED_PRESETS_KEY, JSON.stringify(pinned));
  return pinned;
}

export function DateRangePicker({
  value,
  onChange,
  className,
  triggerClassName,
  disabled = false,
  placeholder = "Selecione um período",
  align = "start",
  compareEnabled,
  compareRange,
  onCompareChange,
  showCompare = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(value?.from || new Date());
  const [compareActive, setCompareActive] = useState(!!compareEnabled);
  const [internalCompareRange, setInternalCompareRange] = useState<DateRange | undefined>(compareRange);
  const [pinnedLabels, setPinnedLabels] = useState<string[]>(getPinnedPresets);

  useEffect(() => {
    setCompareActive(!!compareEnabled);
  }, [compareEnabled]);

  useEffect(() => {
    setInternalCompareRange(compareRange);
  }, [compareRange]);

  const displayText = useMemo(() => {
    if (!value?.from) return placeholder;
    if (!value.to) {
      return format(value.from, "d MMM yyyy", { locale: ptBR });
    }
    const fromYear = value.from.getFullYear();
    const toYear = value.to.getFullYear();
    if (fromYear === toYear) {
      return `${format(value.from, "d MMM", { locale: ptBR })} - ${format(value.to, "d MMM yyyy", { locale: ptBR })}`;
    }
    return `${format(value.from, "d MMM yyyy", { locale: ptBR })} - ${format(value.to, "d MMM yyyy", { locale: ptBR })}`;
  }, [value, placeholder]);

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getValue();
    onChange(range);
    setSelectedPreset(preset.label);
    if (range.from) {
      setMonth(range.from);
    }
    if (compareActive && range?.from && range?.to) {
      const newCompare = COMPARE_PRESETS[0].getValue(range);
      setInternalCompareRange(newCompare);
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    onChange(range);
    setSelectedPreset(null);
    if (compareActive && range?.from && range?.to) {
      const newCompare = COMPARE_PRESETS[0].getValue(range);
      setInternalCompareRange(newCompare);
    }
  };

  const handleApply = () => {
    if (showCompare && onCompareChange) {
      onCompareChange(compareActive, compareActive ? internalCompareRange : undefined);
    }
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
        <div className="flex flex-col">
          <div className="flex">
            <ScrollArea className="border-r border-border h-[320px]">
              <div className="p-2 w-[130px]">
                {pinnedLabels.length > 0 && (
                  <div className="mb-3 pb-2 border-b border-border">
                    <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-2">
                      Fixados
                    </div>
                    <div className="space-y-0">
                      {pinnedLabels.map((label) => {
                        const preset = DEFAULT_PRESETS.find(p => p.label === label);
                        if (!preset) return null;
                        return (
                          <div key={`pinned-${label}`} className="flex items-center group">
                            <button
                              onClick={() => handlePresetClick(preset)}
                              className={cn(
                                "flex-1 text-left px-2 py-1.5 text-xs whitespace-nowrap rounded-md transition-colors",
                                selectedPreset === label
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "hover:bg-muted"
                              )}
                            >
                              {label}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setPinnedLabels(togglePinnedPreset(label)); }}
                              className="p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1"
                              title="Desafixar"
                            >
                              <PinOff className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {PRESET_SECTIONS.map((section, idx) => (
                  <div key={section.title} className={cn(idx > 0 && "mt-3")}>
                    <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-2">
                      {section.title}
                    </div>
                    <div className="space-y-0">
                      {section.presets.map((preset) => (
                        <div key={preset.label} className="flex items-center group">
                          <button
                            onClick={() => handlePresetClick(preset)}
                            className={cn(
                              "flex-1 text-left px-2 py-1.5 text-xs whitespace-nowrap rounded-md transition-colors",
                              selectedPreset === preset.label
                                ? "bg-primary text-primary-foreground font-medium"
                                : "hover:bg-muted"
                            )}
                            data-testid={`preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {preset.label}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPinnedLabels(togglePinnedPreset(preset.label)); }}
                            className={cn(
                              "p-0.5 rounded hover:bg-muted shrink-0 mr-1 transition-opacity",
                              pinnedLabels.includes(preset.label)
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            )}
                            title={pinnedLabels.includes(preset.label) ? "Desafixar" : "Fixar"}
                          >
                            <Pin className={cn(
                              "h-3 w-3",
                              pinnedLabels.includes(preset.label)
                                ? "text-primary"
                                : "text-muted-foreground"
                            )} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-3 flex flex-col">
              <Calendar
                mode="range"
                selected={value}
                onSelect={handleCalendarSelect}
                numberOfMonths={2}
                month={month}
                onMonthChange={setMonth}
                locale={ptBR}
                weekStartsOn={0}
                captionLayout="dropdown-buttons"
                fromYear={2020}
                toYear={2030}
                classNames={{
                  months: "flex flex-row gap-6",
                  month: "space-y-2",
                  caption: "flex justify-center pb-1 relative items-center px-8",
                  caption_label: "hidden",
                  caption_dropdowns: "flex gap-2 items-center",
                  dropdown: "bg-transparent border-none text-[12px] cursor-pointer hover:text-primary font-semibold appearance-none px-0 py-0",
                  dropdown_month: "",
                  dropdown_year: "",
                  nav: "flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 hover:bg-muted rounded-md transition-colors flex items-center justify-center",
                  nav_button_previous: "absolute left-0",
                  nav_button_next: "absolute right-0",
                  table: "w-full border-collapse mt-1",
                  head_row: "flex",
                  head_cell: "text-muted-foreground w-8 font-medium text-[11px]",
                  row: "flex w-full mt-0.5",
                  cell: "text-center text-xs p-0 relative",
                  day: "h-8 w-8 p-0 font-normal hover:bg-muted rounded-md transition-colors text-xs",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary font-medium",
                  day_today: "bg-accent text-accent-foreground font-semibold",
                  day_outside: "text-muted-foreground opacity-40",
                  day_disabled: "text-muted-foreground opacity-40",
                  day_range_middle: "bg-primary/15 rounded-none",
                  day_hidden: "invisible",
                }}
              />

              {showCompare && (
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compareActive}
                      onChange={(e) => {
                        setCompareActive(e.target.checked);
                        if (!e.target.checked) {
                          setInternalCompareRange(undefined);
                          if (onCompareChange) onCompareChange(false, undefined);
                        } else if (value?.from && value?.to) {
                          const defaultCompare = COMPARE_PRESETS[0].getValue(value);
                          setInternalCompareRange(defaultCompare);
                          if (onCompareChange) onCompareChange(true, defaultCompare);
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-xs font-medium">Comparar</span>
                  </label>
                  {compareActive && (
                    <div className="flex items-center gap-2">
                      <select
                        value={COMPARE_PRESETS.findIndex((p) => {
                          const pr = value ? p.getValue(value) : undefined;
                          return pr && internalCompareRange?.from &&
                            pr.from?.toDateString() === internalCompareRange.from?.toDateString() &&
                            pr.to?.toDateString() === internalCompareRange.to?.toDateString();
                        })}
                        onChange={(e) => {
                          const idx = parseInt(e.target.value);
                          if (idx >= 0 && value) {
                            const newRange = COMPARE_PRESETS[idx].getValue(value);
                            setInternalCompareRange(newRange);
                            if (onCompareChange) onCompareChange(true, newRange);
                          }
                        }}
                        className="bg-muted border border-border rounded px-2 py-1 text-[11px] font-medium dark:bg-zinc-800 min-w-[140px]"
                      >
                        {COMPARE_PRESETS.map((preset, idx) => (
                          <option key={preset.label} value={idx}>{preset.label}</option>
                        ))}
                      </select>
                      <span className="px-2 py-1 bg-muted border border-border rounded text-[11px] font-medium min-w-[80px] text-center">
                        {internalCompareRange?.from ? format(internalCompareRange.from, "dd/MM/yy") : "—"}
                      </span>
                      <span className="px-2 py-1 bg-muted border border-border rounded text-[11px] font-medium min-w-[80px] text-center">
                        {internalCompareRange?.to ? format(internalCompareRange.to, "dd/MM/yy") : "—"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end px-3 py-2 border-t border-border gap-2">
            <Button variant="ghost" size="sm" className="h-7 px-3 text-xs" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-7 px-4 text-xs" onClick={handleApply} data-testid="button-apply-date-range">
              Atualizar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DEFAULT_PRESETS, PRESET_SECTIONS, COMPARE_PRESETS };
export type { Preset, PresetSection, DateRangePickerProps, ComparePreset };
