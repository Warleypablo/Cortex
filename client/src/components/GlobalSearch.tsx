import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Search, Users, UserCircle, FileText, Receipt, FolderKanban, Loader2, Key, Lock, GraduationCap, Wrench, Building2, Gift } from "lucide-react";
import type { SearchResponse, SearchResult, SearchEntityType } from "@shared/schema";

const ENTITY_CONFIG: Record<SearchEntityType, { label: string; icon: typeof Users }> = {
  cliente: { label: "Clientes", icon: Users },
  colaborador: { label: "Colaboradores", icon: UserCircle },
  contrato: { label: "Contratos", icon: FileText },
  cobranca: { label: "Cobranças", icon: Receipt },
  projeto: { label: "Projetos", icon: FolderKanban },
  acesso: { label: "Acessos", icon: Key },
  credencial: { label: "Credenciais", icon: Lock },
  conhecimento: { label: "Conhecimentos", icon: GraduationCap },
  ferramenta: { label: "Ferramentas", icon: Wrench },
  patrimonio: { label: "Patrimônio", icon: Building2 },
  beneficio: { label: "Benefícios", icon: Gift },
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [, setLocation] = useLocation();

  const debouncedQuery = useDebounce(inputValue, 300);

  const { data, isLoading, isError } = useQuery<SearchResponse>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?query=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setInputValue("");
      setLocation(result.route);
    },
    [setLocation]
  );

  const groupedResults = data?.results.reduce(
    (acc, result) => {
      if (!acc[result.entity]) {
        acc[result.entity] = [];
      }
      acc[result.entity].push(result);
      return acc;
    },
    {} as Record<SearchEntityType, SearchResult[]>
  );

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-md text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
        data-testid="button-global-search"
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Pesquisar...</span>
        <span className="inline-flex lg:hidden">Pesquisar</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Pesquisar clientes, acessos, conhecimentos, ferramentas..."
          value={inputValue}
          onValueChange={setInputValue}
          data-testid="input-global-search"
        />
        <CommandList>
          {isLoading && debouncedQuery.length >= 2 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {isError && (
            <CommandEmpty>Erro ao realizar a pesquisa. Tente novamente.</CommandEmpty>
          )}

          {!isLoading && !isError && debouncedQuery.length >= 2 && data?.results.length === 0 && (
            <CommandEmpty>Nenhum resultado encontrado para "{debouncedQuery}".</CommandEmpty>
          )}

          {!isLoading && debouncedQuery.length < 2 && (
            <CommandEmpty>Digite pelo menos 2 caracteres para pesquisar.</CommandEmpty>
          )}

          {groupedResults &&
            Object.entries(groupedResults).map(([entity, results]) => {
              const config = ENTITY_CONFIG[entity as SearchEntityType];
              const Icon = config.icon;
              return (
                <CommandGroup key={entity} heading={config.label}>
                  {results.map((result) => (
                    <CommandItem
                      key={`${result.entity}-${result.id}`}
                      value={`${result.label} ${result.description || ""}`}
                      onSelect={() => handleSelect(result)}
                      className="cursor-pointer"
                      data-testid={`search-result-${result.entity}-${result.id}`}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>{result.label}</span>
                        {result.description && (
                          <span className="text-xs text-muted-foreground">
                            {result.description}
                          </span>
                        )}
                      </div>
                      {result.meta?.status && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {result.meta.status}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
