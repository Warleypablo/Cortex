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

interface MultiSelectProps {
  options: string[];
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
  
  console.log("[MultiSelect RENDER] placeholder:", placeholder, "selected:", selected, "length:", selected.length);

  const handleToggle = (value: string) => {
    console.log("[MultiSelect] handleToggle called with:", value);
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    console.log("[MultiSelect] calling onChange with:", newSelected);
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

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="flex flex-wrap gap-1 flex-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selected.map((value) => (
                <Badge
                  key={value}
                  variant="secondary"
                  className="mr-1"
                  data-testid={`badge-selected-${value}`}
                >
                  {value}
                  <span
                    className="ml-1 rounded-full outline-none hover:bg-accent cursor-pointer inline-flex items-center justify-center"
                    onMouseDown={(e) => handleRemove(value, e)}
                    data-testid={`button-remove-${value}`}
                    role="button"
                    aria-label={`Remove ${value}`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
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
                {filteredOptions.map((option) => (
                  <div
                    key={option}
                    className="flex items-center space-x-2 rounded-md p-2 hover-elevate active-elevate-2 cursor-pointer"
                    data-testid={`option-${option}`}
                  >
                    <Checkbox
                      checked={selected.includes(option)}
                      data-testid={`checkbox-${option}`}
                      onCheckedChange={() => handleToggle(option)}
                    />
                    <span 
                      className="flex-1 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(option);
                      }}
                    >
                      {option}
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
