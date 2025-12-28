import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Users,
  UserCircle,
  FileText,
  Receipt,
  FolderKanban,
  Loader2,
  Key,
  Lock,
  GraduationCap,
  Wrench,
  Building2,
  Gift,
  Clock,
  X,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { SearchResponse, SearchResult, SearchEntityType } from "@shared/schema";

const RECENT_SEARCHES_KEY = "global-search-recent";
const MAX_RECENT_SEARCHES = 5;

const ENTITY_CONFIG: Record<SearchEntityType, { label: string; icon: typeof Users; color: string }> = {
  cliente: { label: "Clientes", icon: Users, color: "text-blue-500" },
  colaborador: { label: "Colaboradores", icon: UserCircle, color: "text-green-500" },
  contrato: { label: "Contratos", icon: FileText, color: "text-purple-500" },
  cobranca: { label: "Cobranças", icon: Receipt, color: "text-orange-500" },
  projeto: { label: "Projetos", icon: FolderKanban, color: "text-cyan-500" },
  acesso: { label: "Acessos", icon: Key, color: "text-yellow-500" },
  credencial: { label: "Credenciais", icon: Lock, color: "text-red-500" },
  conhecimento: { label: "Conhecimentos", icon: GraduationCap, color: "text-indigo-500" },
  ferramenta: { label: "Ferramentas", icon: Wrench, color: "text-slate-500" },
  patrimonio: { label: "Patrimônio", icon: Building2, color: "text-emerald-500" },
  beneficio: { label: "Benefícios", icon: Gift, color: "text-pink-500" },
};

const QUICK_SEARCHES = [
  { label: "Clientes ativos", query: "ativo", icon: Users },
  { label: "Contratos recentes", query: "contrato", icon: FileText },
  { label: "Colaboradores", query: "colaborador", icon: UserCircle },
];

interface RecentSearch {
  query: string;
  timestamp: number;
  resultCount?: number;
}

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

function getRecentSearches(): RecentSearch[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string, resultCount?: number): void {
  try {
    const searches = getRecentSearches();
    const filtered = searches.filter((s) => s.query.toLowerCase() !== query.toLowerCase());
    const newSearch: RecentSearch = { query, timestamp: Date.now(), resultCount };
    const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

function removeRecentSearch(query: string): void {
  try {
    const searches = getRecentSearches();
    const filtered = searches.filter((s) => s.query.toLowerCase() !== query.toLowerCase());
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore localStorage errors
  }
}

function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

function highlightText(text: string, query: string): JSX.Element {
  if (!query || query.length < 2) return <>{text}</>;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-primary rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">Nenhum resultado encontrado</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Não encontramos resultados para "{query}"
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Tente buscar por nome, CNPJ, ou palavras-chave
      </p>
    </div>
  );
}

function InitialState({
  recentSearches,
  onSelectRecent,
  onClearRecent,
  onRemoveRecent,
  onQuickSearch,
}: {
  recentSearches: RecentSearch[];
  onSelectRecent: (query: string) => void;
  onClearRecent: () => void;
  onRemoveRecent: (query: string) => void;
  onQuickSearch: (query: string) => void;
}) {
  return (
    <div className="py-2">
      {recentSearches.length > 0 && (
        <CommandGroup>
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3 w-3" />
              Pesquisas recentes
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onClearRecent();
              }}
              data-testid="button-clear-recent-searches"
            >
              Limpar
            </Button>
          </div>
          {recentSearches.map((search) => (
            <CommandItem
              key={search.query}
              value={search.query}
              onSelect={() => onSelectRecent(search.query)}
              className="group cursor-pointer"
              data-testid={`recent-search-${search.query}`}
            >
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{search.query}</span>
              {search.resultCount !== undefined && (
                <Badge variant="secondary" className="ml-auto mr-2 text-xs">
                  {search.resultCount}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="invisible h-5 w-5 group-hover:visible"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveRecent(search.query);
                }}
                data-testid={`button-remove-recent-${search.query}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      <CommandGroup>
        <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-2">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Pesquisas rápidas</span>
        </div>
        {QUICK_SEARCHES.map((quick) => {
          const Icon = quick.icon;
          return (
            <CommandItem
              key={quick.query}
              value={`quick-${quick.query}`}
              onSelect={() => onQuickSearch(quick.query)}
              className="cursor-pointer"
              data-testid={`quick-search-${quick.query}`}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{quick.label}</span>
              <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
            </CommandItem>
          );
        })}
      </CommandGroup>

      <CommandSeparator className="my-2" />

      <div className="px-3 py-2 text-center text-xs text-muted-foreground">
        <p>Digite pelo menos 2 caracteres para pesquisar</p>
        <p className="mt-1">
          Busque por clientes, colaboradores, contratos, acessos e mais
        </p>
      </div>
    </div>
  );
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (open) {
      setRecentSearches(getRecentSearches());
    }
  }, [open]);

  useEffect(() => {
    if (data && debouncedQuery.length >= 2 && data.results.length > 0) {
      saveRecentSearch(debouncedQuery, data.total);
    }
  }, [data, debouncedQuery]);

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

  const handleSelectRecent = useCallback((query: string) => {
    setInputValue(query);
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const handleRemoveRecent = useCallback((query: string) => {
    removeRecentSearch(query);
    setRecentSearches((prev) => prev.filter((s) => s.query !== query));
  }, []);

  const handleQuickSearch = useCallback((query: string) => {
    setInputValue(query);
  }, []);

  const handleClearInput = useCallback(() => {
    setInputValue("");
    inputRef.current?.focus();
  }, []);

  const groupedResults = useMemo(() => {
    if (!data?.results) return null;
    return data.results.reduce(
      (acc, result) => {
        if (!acc[result.entity]) {
          acc[result.entity] = [];
        }
        acc[result.entity].push(result);
        return acc;
      },
      {} as Record<SearchEntityType, SearchResult[]>
    );
  }, [data?.results]);

  const totalResults = data?.total ?? 0;
  const showInitialState = !isLoading && debouncedQuery.length < 2;
  const showLoading = isLoading && debouncedQuery.length >= 2;
  const showEmpty = !isLoading && !isError && debouncedQuery.length >= 2 && totalResults === 0;
  const showResults = !isLoading && !isError && debouncedQuery.length >= 2 && totalResults > 0;

  return (
    <>
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-blue-500 to-primary rounded-lg opacity-30 group-hover:opacity-60 blur-sm transition-all duration-500 animate-pulse" />
        <Button
          variant="outline"
          className="relative h-9 w-full justify-start rounded-md text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64 bg-background border-primary/30 hover:border-primary/60 transition-all duration-300"
          onClick={() => setOpen(true)}
          data-testid="button-global-search"
        >
          <Search className="mr-2 h-4 w-4 text-primary" />
          <span className="hidden lg:inline-flex">Pesquisar...</span>
          <span className="inline-flex lg:hidden">Pesquisar</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border border-primary/20 bg-primary/10 px-1.5 font-mono text-[10px] font-medium text-primary sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="relative">
          <CommandInput
            ref={inputRef}
            placeholder="Pesquisar clientes, colaboradores, contratos..."
            value={inputValue}
            onValueChange={setInputValue}
            data-testid="input-global-search"
          />
          {inputValue && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2"
              onClick={handleClearInput}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <CommandList className="max-h-[400px]">
          {isError && (
            <div className="py-6 text-center">
              <p className="text-sm text-destructive">Erro ao realizar a pesquisa.</p>
              <p className="text-xs text-muted-foreground">Tente novamente em alguns segundos.</p>
            </div>
          )}

          {showLoading && <SearchSkeleton />}

          {showEmpty && <EmptyState query={debouncedQuery} />}

          {showInitialState && (
            <InitialState
              recentSearches={recentSearches}
              onSelectRecent={handleSelectRecent}
              onClearRecent={handleClearRecent}
              onRemoveRecent={handleRemoveRecent}
              onQuickSearch={handleQuickSearch}
            />
          )}

          {showResults && groupedResults && (
            <>
              {Object.entries(groupedResults).map(([entity, results]) => {
                const config = ENTITY_CONFIG[entity as SearchEntityType];
                const Icon = config.icon;
                return (
                  <CommandGroup
                    key={entity}
                    heading={
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Icon className={`h-3 w-3 ${config.color}`} />
                          {config.label}
                        </span>
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {results.length}
                        </Badge>
                      </div>
                    }
                  >
                    {results.slice(0, 5).map((result) => (
                      <CommandItem
                        key={`${result.entity}-${result.id}`}
                        value={`${result.label} ${result.description || ""}`}
                        onSelect={() => handleSelect(result)}
                        className="cursor-pointer group"
                        data-testid={`search-result-${result.entity}-${result.id}`}
                      >
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <div className="flex flex-1 flex-col overflow-hidden">
                          <span className="truncate font-medium">
                            {highlightText(result.label, debouncedQuery)}
                          </span>
                          {result.description && (
                            <span className="truncate text-xs text-muted-foreground">
                              {highlightText(result.description, debouncedQuery)}
                            </span>
                          )}
                        </div>
                        {result.meta?.status && (
                          <Badge
                            variant="outline"
                            className={`ml-2 text-[10px] ${
                              result.meta.status.toLowerCase().includes("ativo")
                                ? "border-green-500/30 bg-green-500/10 text-green-600"
                                : result.meta.status.toLowerCase().includes("cancelad")
                                ? "border-red-500/30 bg-red-500/10 text-red-600"
                                : "border-muted"
                            }`}
                          >
                            {result.meta.status}
                          </Badge>
                        )}
                        <ArrowRight className="invisible h-4 w-4 text-muted-foreground group-hover:visible" />
                      </CommandItem>
                    ))}
                    {results.length > 5 && (
                      <div className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                        +{results.length - 5} mais resultados
                      </div>
                    )}
                  </CommandGroup>
                );
              })}
            </>
          )}
        </CommandList>

        {(showResults || showEmpty) && (
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {totalResults} resultado{totalResults !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">↵</kbd>
                selecionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">esc</kbd>
                fechar
              </span>
            </div>
          </div>
        )}
      </CommandDialog>
    </>
  );
}
