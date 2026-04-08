import { useState } from "react";
import { ChevronsUpDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type OptionItem = string | { value: string; label: string };

function normalizeOption(opt: OptionItem): { value: string; label: string } {
  return typeof opt === 'string' ? { value: opt, label: opt } : opt;
}

interface MultiSelectProps {
  options: OptionItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecione itens...",
  emptyText = "Nenhum item encontrado",
  searchPlaceholder = "Buscar...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedOptions = options.map(normalizeOption);

  const handleToggle = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== value));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLabelForValue = (value: string): string => {
    const found = normalizedOptions.find(o => o.value === value);
    return found ? found.label : value;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-9 h-auto",
            className
          )}
          data-testid="button-multi-select-trigger"
        >
          <div className="flex flex-nowrap gap-1 flex-1 overflow-hidden">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : selected.length === 1 ? (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 max-w-[calc(100%-20px)] truncate shrink"
                data-testid={`badge-selected-${selected[0]}`}
              >
                <span className="truncate">{getLabelForValue(selected[0])}</span>
                <span
                  className="ml-1 rounded-full outline-none hover:bg-accent cursor-pointer inline-flex items-center justify-center shrink-0"
                  onMouseDown={(e) => handleRemove(selected[0], e)}
                  data-testid={`button-remove-${selected[0]}`}
                  role="button"
                  aria-label={`Remove ${getLabelForValue(selected[0])}`}
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 shrink-0"
              >
                {selected.length} selecionados
                <span
                  className="ml-1 rounded-full outline-none hover:bg-accent cursor-pointer inline-flex items-center justify-center"
                  onMouseDown={handleClearAll}
                  role="button"
                  aria-label="Clear all"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {selected.length > 0 && (
              <span
                onClick={handleClearAll}
                className="rounded-full outline-none hover:bg-accent p-1 cursor-pointer inline-flex items-center justify-center"
                data-testid="button-clear-all"
                role="button"
                aria-label="Clear all"
              >
                <X className="h-4 w-4" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              data-testid="input-multi-select-search"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <ScrollArea className="h-64">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              <div className="p-2">
                {filteredOptions.map((opt) => (
                  <div
                    key={opt.value}
                    className="flex items-center space-x-2 rounded-md p-2 hover-elevate active-elevate-2 cursor-pointer"
                    data-testid={`option-${opt.value}`}
                  >
                    <Checkbox
                      checked={selected.includes(opt.value)}
                      data-testid={`checkbox-${opt.value}`}
                      onCheckedChange={() => handleToggle(opt.value)}
                    />
                    <span
                      className="flex-1 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(opt.value);
                      }}
                    >
                      {opt.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
