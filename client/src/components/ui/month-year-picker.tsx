import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MonthYearPickerProps {
  value: { month: number; year: number };
  onChange: (value: { month: number; year: number }) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function MonthYearPicker({
  value,
  onChange,
  minYear = 2020,
  maxYear = new Date().getFullYear() + 2,
  className,
  triggerClassName,
  disabled = false,
}: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.year);

  const displayText = useMemo(() => {
    return `${MESES[value.month - 1]} ${value.year}`;
  }, [value]);

  const handleMonthSelect = (month: number) => {
    onChange({ month, year: viewYear });
    setOpen(false);
  };

  const handlePrevYear = () => {
    if (viewYear > minYear) {
      setViewYear(viewYear - 1);
    }
  };

  const handleNextYear = () => {
    if (viewYear < maxYear) {
      setViewYear(viewYear + 1);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("justify-start text-left font-normal gap-2", triggerClassName)}
          data-testid="button-month-year-picker"
        >
          <Calendar className="h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[280px] p-4", className)} align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevYear}
              disabled={viewYear <= minYear}
              data-testid="button-prev-year"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold" data-testid="text-year">{viewYear}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextYear}
              disabled={viewYear >= maxYear}
              data-testid="button-next-year"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {MESES_CURTOS.map((mes, idx) => {
              const monthNum = idx + 1;
              const isSelected = value.month === monthNum && value.year === viewYear;
              return (
                <Button
                  key={mes}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9",
                    isSelected && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => handleMonthSelect(monthNum)}
                  data-testid={`button-month-${monthNum}`}
                >
                  {mes}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { MESES, MESES_CURTOS };
