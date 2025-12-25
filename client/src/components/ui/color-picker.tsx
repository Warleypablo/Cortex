import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColorOption {
  id: string;
  name: string;
  bgClass: string;
  textClass: string;
  darkBgClass?: string;
  darkTextClass?: string;
}

// Cores pré-definidas baseadas nas cores usadas nos squads e produtos do ClickUp
export const COLOR_PALETTE: ColorOption[] = [
  // Vermelhos/Laranjas
  { id: "red", name: "Vermelho", bgClass: "bg-red-600", textClass: "text-white", darkBgClass: "dark:bg-red-700", darkTextClass: "dark:text-white" },
  { id: "red-dark", name: "Vermelho Escuro", bgClass: "bg-red-800", textClass: "text-white", darkBgClass: "dark:bg-red-900", darkTextClass: "dark:text-white" },
  { id: "orange", name: "Laranja", bgClass: "bg-orange-500", textClass: "text-white", darkBgClass: "dark:bg-orange-600", darkTextClass: "dark:text-white" },
  { id: "orange-dark", name: "Laranja Escuro", bgClass: "bg-orange-600", textClass: "text-white", darkBgClass: "dark:bg-orange-700", darkTextClass: "dark:text-white" },
  { id: "amber", name: "Âmbar", bgClass: "bg-amber-500", textClass: "text-black", darkBgClass: "dark:bg-amber-400", darkTextClass: "dark:text-black" },
  
  // Amarelos
  { id: "yellow", name: "Amarelo", bgClass: "bg-yellow-400", textClass: "text-black", darkBgClass: "dark:bg-yellow-500", darkTextClass: "dark:text-black" },
  { id: "yellow-light", name: "Amarelo Claro", bgClass: "bg-yellow-300", textClass: "text-black", darkBgClass: "dark:bg-yellow-400", darkTextClass: "dark:text-black" },
  
  // Verdes
  { id: "green", name: "Verde", bgClass: "bg-green-500", textClass: "text-white", darkBgClass: "dark:bg-green-600", darkTextClass: "dark:text-white" },
  { id: "green-light", name: "Verde Claro", bgClass: "bg-green-400", textClass: "text-black", darkBgClass: "dark:bg-green-500", darkTextClass: "dark:text-black" },
  { id: "green-dark", name: "Verde Escuro", bgClass: "bg-green-700", textClass: "text-white", darkBgClass: "dark:bg-green-800", darkTextClass: "dark:text-white" },
  { id: "emerald", name: "Esmeralda", bgClass: "bg-emerald-500", textClass: "text-white", darkBgClass: "dark:bg-emerald-600", darkTextClass: "dark:text-white" },
  { id: "teal", name: "Turquesa", bgClass: "bg-teal-500", textClass: "text-white", darkBgClass: "dark:bg-teal-600", darkTextClass: "dark:text-white" },
  
  // Azuis
  { id: "blue", name: "Azul", bgClass: "bg-blue-600", textClass: "text-white", darkBgClass: "dark:bg-blue-700", darkTextClass: "dark:text-white" },
  { id: "blue-light", name: "Azul Claro", bgClass: "bg-blue-400", textClass: "text-white", darkBgClass: "dark:bg-blue-500", darkTextClass: "dark:text-white" },
  { id: "blue-dark", name: "Azul Escuro", bgClass: "bg-blue-800", textClass: "text-white", darkBgClass: "dark:bg-blue-900", darkTextClass: "dark:text-white" },
  { id: "sky", name: "Céu", bgClass: "bg-sky-500", textClass: "text-white", darkBgClass: "dark:bg-sky-600", darkTextClass: "dark:text-white" },
  { id: "cyan", name: "Ciano", bgClass: "bg-cyan-500", textClass: "text-black", darkBgClass: "dark:bg-cyan-600", darkTextClass: "dark:text-white" },
  
  // Roxos/Violetas
  { id: "purple", name: "Roxo", bgClass: "bg-purple-600", textClass: "text-white", darkBgClass: "dark:bg-purple-700", darkTextClass: "dark:text-white" },
  { id: "purple-light", name: "Roxo Claro", bgClass: "bg-purple-400", textClass: "text-white", darkBgClass: "dark:bg-purple-500", darkTextClass: "dark:text-white" },
  { id: "violet", name: "Violeta", bgClass: "bg-violet-600", textClass: "text-white", darkBgClass: "dark:bg-violet-700", darkTextClass: "dark:text-white" },
  { id: "indigo", name: "Índigo", bgClass: "bg-indigo-600", textClass: "text-white", darkBgClass: "dark:bg-indigo-700", darkTextClass: "dark:text-white" },
  
  // Rosas/Magentas
  { id: "pink", name: "Rosa", bgClass: "bg-pink-500", textClass: "text-white", darkBgClass: "dark:bg-pink-600", darkTextClass: "dark:text-white" },
  { id: "pink-light", name: "Rosa Claro", bgClass: "bg-pink-400", textClass: "text-black", darkBgClass: "dark:bg-pink-500", darkTextClass: "dark:text-white" },
  { id: "fuchsia", name: "Fúcsia", bgClass: "bg-fuchsia-500", textClass: "text-white", darkBgClass: "dark:bg-fuchsia-600", darkTextClass: "dark:text-white" },
  { id: "rose", name: "Rosé", bgClass: "bg-rose-500", textClass: "text-white", darkBgClass: "dark:bg-rose-600", darkTextClass: "dark:text-white" },
  
  // Neutros
  { id: "gray", name: "Cinza", bgClass: "bg-gray-500", textClass: "text-white", darkBgClass: "dark:bg-gray-600", darkTextClass: "dark:text-white" },
  { id: "gray-light", name: "Cinza Claro", bgClass: "bg-gray-300", textClass: "text-black", darkBgClass: "dark:bg-gray-400", darkTextClass: "dark:text-black" },
  { id: "gray-dark", name: "Cinza Escuro", bgClass: "bg-gray-700", textClass: "text-white", darkBgClass: "dark:bg-gray-800", darkTextClass: "dark:text-white" },
  { id: "slate", name: "Ardósia", bgClass: "bg-slate-600", textClass: "text-white", darkBgClass: "dark:bg-slate-700", darkTextClass: "dark:text-white" },
  { id: "zinc", name: "Zinco", bgClass: "bg-zinc-600", textClass: "text-white", darkBgClass: "dark:bg-zinc-700", darkTextClass: "dark:text-white" },
  { id: "black", name: "Preto", bgClass: "bg-black", textClass: "text-white", darkBgClass: "dark:bg-zinc-900", darkTextClass: "dark:text-white" },
];

// Função para gerar classe de cor completa
export function getColorClasses(colorOption: ColorOption): string {
  const classes = [colorOption.bgClass, colorOption.textClass];
  if (colorOption.darkBgClass) classes.push(colorOption.darkBgClass);
  if (colorOption.darkTextClass) classes.push(colorOption.darkTextClass);
  return classes.join(" ");
}

// Função para encontrar opção de cor por classes
export function findColorOption(colorClasses: string): ColorOption | undefined {
  if (!colorClasses) return undefined;
  
  // Procura pela cor que tem o bgClass correspondente
  return COLOR_PALETTE.find(color => {
    return colorClasses.includes(color.bgClass);
  });
}

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  previewLabel?: string;
}

export function ColorPicker({ value, onChange, label = "Cor", previewLabel = "Preview" }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedColor = findColorOption(value);
  
  const handleSelect = (color: ColorOption) => {
    const colorClasses = getColorClasses(color);
    onChange(colorClasses);
  };
  
  const handleClear = () => {
    onChange("");
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {/* Cor selecionada */}
      <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
        <span className="text-sm text-muted-foreground min-w-16">{previewLabel}:</span>
        {value ? (
          <Badge className={value}>{previewLabel}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground italic">Nenhuma cor selecionada</span>
        )}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-clear-color"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Paleta de cores */}
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Selecione uma cor:</span>
        <div className="grid grid-cols-6 gap-2 p-2 border rounded-md max-h-[200px] overflow-y-auto">
          {COLOR_PALETTE.map((color) => {
            const colorClasses = getColorClasses(color);
            const isSelected = value === colorClasses;
            
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => handleSelect(color)}
                className={cn(
                  "relative w-full aspect-square rounded-md transition-all",
                  colorClasses,
                  "hover:ring-2 hover:ring-offset-2 hover:ring-primary",
                  isSelected && "ring-2 ring-offset-2 ring-primary"
                )}
                title={color.name}
                data-testid={`color-option-${color.id}`}
              >
                {isSelected && (
                  <Check className="absolute inset-0 m-auto h-4 w-4" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Nome da cor selecionada */}
      {selectedColor && (
        <span className="text-xs text-muted-foreground">
          Cor selecionada: <strong>{selectedColor.name}</strong>
        </span>
      )}
    </div>
  );
}
