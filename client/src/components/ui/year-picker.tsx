import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface YearPickerProps {
  value: number;
  onChange: (year: number) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
  disabled?: boolean;
}

export function YearPicker({
  value,
  onChange,
  minYear = 2020,
  maxYear = new Date().getFullYear() + 2,
  className,
  disabled = false,
}: YearPickerProps) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= minYear}
        data-testid="button-prev-year"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        disabled={disabled}
        className="justify-start text-left font-normal gap-2 min-w-[100px]"
        data-testid="button-year-picker"
      >
        <Calendar className="h-4 w-4" />
        {value}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= maxYear}
        data-testid="button-next-year"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
