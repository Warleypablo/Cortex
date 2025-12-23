import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, X, Trash2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SelectWithAddOption {
  id: number;
  nome: string;
  emoji?: string | null;
}

interface SelectWithAddProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectWithAddOption[];
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  isAdmin?: boolean;
  apiEndpoint: string;
  queryKey: string[];
  displayEmoji?: boolean;
  testIdPrefix?: string;
}

export function SelectWithAdd({
  value,
  onValueChange,
  options,
  isLoading = false,
  placeholder = "Selecione uma opção",
  disabled = false,
  isAdmin = false,
  apiEndpoint,
  queryKey,
  displayEmoji = false,
  testIdPrefix = "select-with-add",
}: SelectWithAddProps) {
  const { toast } = useToast();
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);

  const addMutation = useMutation({
    mutationFn: async (nome: string) => {
      const response = await apiRequest("POST", apiEndpoint, { nome });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Item adicionado",
        description: `"${data.nome}" foi adicionado com sucesso.`,
      });
      setNewItemName("");
      setAddPopoverOpen(false);
      onValueChange(data.nome);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `${apiEndpoint}/${id}`);
      return id;
    },
    onSuccess: (id) => {
      const deletedOption = options.find((opt) => opt.id === id);
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Item removido",
        description: deletedOption
          ? `"${deletedOption.nome}" foi removido.`
          : "Item removido com sucesso.",
      });
      if (value && deletedOption && value === deletedOption.nome) {
        onValueChange("");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddSubmit = () => {
    const trimmedName = newItemName.trim();
    if (!trimmedName) return;
    
    const exists = options.some(
      (opt) => opt.nome.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      toast({
        title: "Item já existe",
        description: `"${trimmedName}" já está na lista.`,
        variant: "destructive",
      });
      return;
    }
    
    addMutation.mutate(trimmedName);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSubmit();
    }
    if (e.key === "Escape") {
      setAddPopoverOpen(false);
      setNewItemName("");
    }
  };

  const getDisplayValue = (option: SelectWithAddOption) => {
    if (displayEmoji && option.emoji) {
      return `${option.emoji} ${option.nome}`;
    }
    return option.nome;
  };

  return (
    <div className="flex gap-1 items-center">
      <Select onValueChange={onValueChange} value={value || undefined} disabled={disabled}>
        <SelectTrigger
          className="flex-1"
          data-testid={`${testIdPrefix}-trigger`}
        >
          <SelectValue placeholder={isLoading ? "Carregando..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.nome}>
              {getDisplayValue(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isAdmin && (
        <>
          <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={disabled || addMutation.isPending}
                data-testid={`${testIdPrefix}-add-button`}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="space-y-2">
                <p className="text-sm font-medium">Adicionar novo</p>
                <div className="flex gap-1">
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nome do item"
                    className="flex-1"
                    autoFocus
                    data-testid={`${testIdPrefix}-add-input`}
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleAddSubmit}
                    disabled={!newItemName.trim() || addMutation.isPending}
                    data-testid={`${testIdPrefix}-add-confirm`}
                  >
                    {addMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={disabled || options.length === 0}
                data-testid={`${testIdPrefix}-delete-button`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
              <div className="space-y-2">
                <p className="text-sm font-medium">Remover item</p>
                <p className="text-xs text-muted-foreground">
                  Clique no item para remover da lista
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {options.map((option) => (
                    <div
                      key={option.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md hover-elevate cursor-pointer",
                        deleteMutation.isPending && "opacity-50 pointer-events-none"
                      )}
                      onClick={() => deleteMutation.mutate(option.id)}
                      data-testid={`${testIdPrefix}-delete-item-${option.id}`}
                    >
                      <span className="text-sm truncate flex-1">
                        {getDisplayValue(option)}
                      </span>
                      <X className="h-4 w-4 text-destructive flex-shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}
