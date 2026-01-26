import { useState, useMemo, Fragment, useEffect } from "react";
import { usePersistentFilters } from "@/hooks/use-persistent-filters";
import { usePageTitle } from "@/hooks/use-page-title";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Client, Credential, InsertClient, InsertCredential, AccessLog, ClientStatus } from "@shared/schema";
import { insertClientSchema, insertCredentialSchema } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Eye, EyeOff, Copy, Edit, Trash2, ExternalLink, Key, Lock, Loader2, ChevronDown, ChevronRight, Building2, History, ArrowUpDown, Check, ChevronsUpDown, UserPlus, Wand2, Link2, X, Zap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/ui/table-skeleton";

type ClientWithCredentialCount = Client & { credential_count: number; cazClienteId?: number | null; platforms?: string[] };
type ClientWithCredentials = Client & { credentials: Credential[] };

type AggregatedClient = ClientWithCredentialCount & {
  aggregatedIds: string[];
  aggregatedPlatforms: string[];
  aggregatedCredentialCount: number;
  displayName: string;
};

type LogActionType = 'view_password' | 'copy_password' | 'add_credential' | 'edit_credential' | 'delete_credential' | 'add_client' | 'edit_client' | 'delete_client';

interface CreateLogParams {
  action: LogActionType;
  entityType: string;
  entityId?: string;
  entityName?: string;
  clientId?: string;
  clientName?: string;
  details?: string;
}

const ACTION_LABELS: Record<LogActionType, string> = {
  view_password: "visualizou senha",
  copy_password: "copiou senha",
  add_credential: "adicionou credencial",
  edit_credential: "editou credencial",
  delete_credential: "removeu credencial",
  add_client: "adicionou cliente",
  edit_client: "editou cliente",
  delete_client: "removeu cliente",
};

const ACTION_BADGE_VARIANTS: Record<LogActionType, "default" | "secondary" | "destructive" | "outline"> = {
  view_password: "outline",
  copy_password: "secondary",
  add_credential: "default",
  edit_credential: "secondary",
  delete_credential: "destructive",
  add_client: "default",
  edit_client: "secondary",
  delete_client: "destructive",
};

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}

function formatCNPJ(cnpj: string | null | undefined) {
  if (!cnpj) return "-";
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function useCreateLog() {
  return useMutation({
    mutationFn: async (params: CreateLogParams) => {
      await apiRequest("POST", "/api/acessos/logs", params);
    },
  });
}

interface CazCliente {
  id: number;
  name: string;
  cnpj: string | null;
  status: ClientStatus;
  hasCredentials: boolean;
}

function AddClientDialog({ onSuccess }: { onSuccess?: (client: Client) => void }) {
  const [open, setOpen] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCazClient, setSelectedCazClient] = useState<CazCliente | null>(null);
  const [mode, setMode] = useState<'select' | 'manual'>('select');
  const { toast } = useToast();
  const createLog = useCreateLog();

  const { data: cazClientes = [], isLoading: isLoadingCaz } = useQuery<CazCliente[]>({
    queryKey: ["/api/acessos/caz-clientes", searchQuery],
    queryFn: async () => {
      const url = searchQuery 
        ? `/api/acessos/caz-clientes?search=${encodeURIComponent(searchQuery)}`
        : "/api/acessos/caz-clientes";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      status: "ativo",
      additionalInfo: "",
    },
  });

  useEffect(() => {
    if (selectedCazClient) {
      form.setValue("name", selectedCazClient.name);
      form.setValue("cnpj", selectedCazClient.cnpj || "");
      form.setValue("status", selectedCazClient.status);
    }
  }, [selectedCazClient, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await apiRequest("POST", "/api/acessos/clients", data);
      return await response.json();
    },
    onSuccess: (client: Client) => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/logs"] });
      createLog.mutate({
        action: "add_client",
        entityType: "client",
        entityId: client.id,
        entityName: client.name,
      });
      toast({
        title: "Cliente adicionado",
        description: "O cliente foi adicionado com sucesso.",
      });
      handleClose();
      onSuccess?.(client);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setOpen(false);
    setSelectedCazClient(null);
    setMode('select');
    setSearchQuery("");
    form.reset();
  };

  const handleSelectClient = (client: CazCliente) => {
    setSelectedCazClient(client);
    setComboboxOpen(false);
  };

  const handleSwitchToManual = () => {
    setMode('manual');
    setSelectedCazClient(null);
    form.reset({
      name: "",
      cnpj: "",
      status: "ativo",
      additionalInfo: "",
    });
  };

  const handleSwitchToSelect = () => {
    setMode('select');
    setSelectedCazClient(null);
    form.reset({
      name: "",
      cnpj: "",
      status: "ativo",
      additionalInfo: "",
    });
  };

  const onSubmit = (data: InsertClient) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-client">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Cliente</DialogTitle>
          <DialogDescription>
            Selecione um cliente existente ou adicione um novo manualmente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-2 mb-4">
          <Button
            type="button"
            variant={mode === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={handleSwitchToSelect}
            className="flex-1"
            data-testid="button-mode-select"
          >
            <Search className="w-4 h-4 mr-2" />
            Selecionar Existente
          </Button>
          <Button
            type="button"
            variant={mode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={handleSwitchToManual}
            className="flex-1"
            data-testid="button-mode-manual"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Adicionar Novo
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === 'select' && (
              <div className="space-y-2">
                <FormLabel>Buscar Cliente</FormLabel>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between"
                      data-testid="combobox-select-client"
                    >
                      {selectedCazClient ? selectedCazClient.name : "Selecione um cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Buscar cliente..." 
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        data-testid="input-search-caz-client"
                      />
                      <CommandList>
                        {isLoadingCaz ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : cazClientes.length === 0 ? (
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {cazClientes.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.id.toString()}
                                onSelect={() => !client.hasCredentials && handleSelectClient(client)}
                                disabled={client.hasCredentials}
                                className={cn(client.hasCredentials && "opacity-50 cursor-not-allowed")}
                                data-testid={`item-caz-client-${client.id}`}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCazClient?.id === client.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{client.name}</span>
                                    {client.hasCredentials && (
                                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                        <Key className="w-3 h-3 mr-1" />
                                        Cadastrado
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {client.cnpj && <span>{formatCNPJ(client.cnpj)}</span>}
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-xs",
                                      client.status === 'ativo' 
                                        ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                                    )}>
                                      {client.status === 'ativo' ? 'Ativo' : 'Cancelado'}
                                    </span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      data-testid="input-client-name" 
                      placeholder="Nome do cliente"
                      disabled={mode === 'select' && !!selectedCazClient}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      value={field.value || ""} 
                      data-testid="input-client-cnpj" 
                      placeholder="00.000.000/0000-00"
                      disabled={mode === 'select' && !!selectedCazClient}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || "ativo"}
                    disabled={mode === 'select' && !!selectedCazClient}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-client-status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additionalInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Informações Adicionais</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      value={field.value || ""} 
                      data-testid="input-client-info" 
                      placeholder="Informações adicionais sobre o cliente"
                      className="resize-none"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel-client"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || (mode === 'select' && !selectedCazClient)}
                data-testid="button-submit-client"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  "Adicionar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditClientDialog({ 
  client, 
  open, 
  onOpenChange 
}: { 
  client: Client; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCazClient, setSelectedCazClient] = useState<CazCliente | null>(null);
  const { toast } = useToast();
  const createLog = useCreateLog();

  const { data: cazClientes = [], isLoading: isLoadingCaz } = useQuery<CazCliente[]>({
    queryKey: ["/api/acessos/caz-clientes", searchQuery],
    queryFn: async () => {
      const url = searchQuery 
        ? `/api/acessos/caz-clientes?search=${encodeURIComponent(searchQuery)}`
        : "/api/acessos/caz-clientes";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    enabled: open,
  });

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: client.name || "",
      cnpj: client.cnpj || "",
      status: (client.status as ClientStatus) || "ativo",
      additionalInfo: client.additionalInfo || "",
      linkedClientCnpj: client.linkedClientCnpj || "",
    },
  });

  // Reset form when client changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: client.name || "",
        cnpj: client.cnpj || "",
        status: (client.status as ClientStatus) || "ativo",
        additionalInfo: client.additionalInfo || "",
        linkedClientCnpj: client.linkedClientCnpj || "",
      });
      // If client is already linked, try to find the linked client
      if (client.linkedClientCnpj) {
        setSelectedCazClient({
          id: 0,
          name: client.name,
          cnpj: client.linkedClientCnpj,
          status: client.status as ClientStatus,
          hasCredentials: true,
        });
      } else {
        setSelectedCazClient(null);
      }
    }
  }, [open, client, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await apiRequest("PATCH", `/api/acessos/clients/${client.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/logs"] });
      createLog.mutate({
        action: "edit_client",
        entityType: "client",
        entityId: client.id,
        entityName: client.name,
      });
      toast({
        title: "Cliente atualizado",
        description: "O cliente foi atualizado com sucesso.",
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setSelectedCazClient(null);
    setSearchQuery("");
  };

  const handleSelectClient = (cazClient: CazCliente) => {
    setSelectedCazClient(cazClient);
    setComboboxOpen(false);
    // Update form with linked client CNPJ
    form.setValue("linkedClientCnpj", cazClient.cnpj || "");
  };

  const handleUnlinkClient = () => {
    setSelectedCazClient(null);
    form.setValue("linkedClientCnpj", "");
  };

  const onSubmit = (data: InsertClient) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? onOpenChange(true) : handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações do cliente ou vincule a um cliente do Conta Azul.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Link to Conta Azul Client Section */}
            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Vincular ao Conta Azul
              </FormLabel>
              {selectedCazClient ? (
                <div className="flex items-center justify-between p-3 rounded-md border bg-muted/50">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{selectedCazClient.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCNPJ(selectedCazClient.cnpj || "")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleUnlinkClient}
                    data-testid="button-unlink-client"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between"
                      data-testid="combobox-link-client"
                    >
                      Selecione um cliente para vincular...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Buscar cliente..." 
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        data-testid="input-search-link-client"
                      />
                      <CommandList>
                        <CommandEmpty>
                          {isLoadingCaz ? "Carregando..." : "Nenhum cliente encontrado."}
                        </CommandEmpty>
                        <CommandGroup>
                          {cazClientes.map((cazClient) => (
                            <CommandItem
                              key={cazClient.id}
                              value={cazClient.name}
                              onSelect={() => handleSelectClient(cazClient)}
                              className="cursor-pointer"
                              data-testid={`option-link-client-${cazClient.id}`}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{cazClient.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatCNPJ(cazClient.cnpj || "")}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              <p className="text-xs text-muted-foreground">
                Vincular permite associar este cliente aos dados do Conta Azul para relatórios integrados.
              </p>
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-client-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-client-cnpj" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || "ativo"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-client-status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additionalInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Informações Adicionais</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      value={field.value || ""} 
                      data-testid="input-edit-client-info"
                      className="resize-none"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel-edit-client"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-submit-edit-client"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddCredentialDialog({ 
  clientId, 
  clientName,
  open, 
  onOpenChange 
}: { 
  clientId: string;
  clientName: string;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const createLog = useCreateLog();

  const form = useForm<InsertCredential>({
    resolver: zodResolver(insertCredentialSchema),
    defaultValues: {
      clientId,
      platform: "",
      username: "",
      password: "",
      accessUrl: "",
      observations: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCredential) => {
      const response = await apiRequest("POST", "/api/acessos/credentials", data);
      return await response.json();
    },
    onSuccess: (credential: Credential) => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/logs"] });
      createLog.mutate({
        action: "add_credential",
        entityType: "credential",
        entityId: credential.id,
        entityName: credential.platform,
        clientId,
        clientName,
      });
      toast({
        title: "Credencial adicionada",
        description: "A credencial foi adicionada com sucesso.",
      });
      onOpenChange(false);
      form.reset({ clientId, platform: "", username: "", password: "", accessUrl: "", observations: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar credencial",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCredential) => {
    createMutation.mutate({ ...data, clientId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Credencial</DialogTitle>
          <DialogDescription>
            Adicione uma nova credencial para {clientName}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plataforma *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-credential-platform" placeholder="Ex: Meta Ads, Google Ads, etc." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-credential-username" placeholder="Nome de usuário ou email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} type="password" data-testid="input-credential-password" placeholder="Senha de acesso" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accessUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de Acesso</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-credential-url" placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      value={field.value || ""} 
                      data-testid="input-credential-observations"
                      className="resize-none"
                      rows={2}
                      placeholder="Informações adicionais sobre esta credencial"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-credential"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-credential"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  "Adicionar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditCredentialDialog({ 
  credential,
  clientId,
  clientName,
  open, 
  onOpenChange 
}: { 
  credential: Credential;
  clientId: string;
  clientName: string;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const createLog = useCreateLog();

  const form = useForm<InsertCredential>({
    resolver: zodResolver(insertCredentialSchema),
    defaultValues: {
      clientId: credential.clientId,
      platform: credential.platform || "",
      username: credential.username || "",
      password: credential.password || "",
      accessUrl: credential.accessUrl || "",
      observations: credential.observations || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertCredential) => {
      const response = await apiRequest("PATCH", `/api/acessos/credentials/${credential.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/logs"] });
      createLog.mutate({
        action: "edit_credential",
        entityType: "credential",
        entityId: credential.id,
        entityName: credential.platform,
        clientId,
        clientName,
      });
      toast({
        title: "Credencial atualizada",
        description: "A credencial foi atualizada com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar credencial",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCredential) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Credencial</DialogTitle>
          <DialogDescription>
            Atualize as informações da credencial para {credential.platform}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plataforma *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-credential-platform" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-credential-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} type="password" data-testid="input-edit-credential-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accessUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de Acesso</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-credential-url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      value={field.value || ""} 
                      data-testid="input-edit-credential-observations"
                      className="resize-none"
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-credential"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-submit-edit-credential"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialRow({ 
  credential, 
  clientId,
  clientName,
  onEdit, 
  onDelete 
}: { 
  credential: Credential;
  clientId: string;
  clientName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const createLog = useCreateLog();

  const handleTogglePassword = () => {
    if (!showPassword) {
      createLog.mutate({
        action: "view_password",
        entityType: "credential",
        entityId: credential.id,
        entityName: credential.platform,
        clientId,
        clientName,
      });
    }
    setShowPassword(!showPassword);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    createLog.mutate({
      action: "copy_password",
      entityType: "credential",
      entityId: credential.id,
      entityName: credential.platform,
      clientId,
      clientName,
    });
    toast({ 
      title: "Copiado!", 
      description: "Senha copiada para a área de transferência" 
    });
  };

  return (
    <TableRow data-testid={`row-credential-${credential.id}`}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-muted-foreground" />
          {credential.platform}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{credential.username || "-"}</span>
          {credential.username && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(credential.username || "");
                createLog.mutate({
                  action: "copy_password",
                  entityType: "credential",
                  entityId: credential.id,
                  entityName: `${credential.platform} (usuário)`,
                  clientId,
                  clientName,
                });
                toast({ 
                  title: "Copiado!", 
                  description: "Usuário copiado para a área de transferência" 
                });
              }}
              data-testid={`button-copy-username-${credential.id}`}
            >
              <Copy className="w-4 h-4" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">
            {showPassword ? credential.password : "••••••••"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleTogglePassword}
            data-testid={`button-toggle-password-${credential.id}`}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          {credential.password && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => copyToClipboard(credential.password || "")}
              data-testid={`button-copy-password-${credential.id}`}
            >
              <Copy className="w-4 h-4" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        {credential.accessUrl ? (
          <a
            href={credential.accessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
            data-testid={`link-url-${credential.id}`}
          >
            Acessar <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          "-"
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            data-testid={`button-edit-credential-${credential.id}`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            data-testid={`button-delete-credential-${credential.id}`}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface TurboToolItem {
  id: string;
  platform: string;
  username: string | null;
  password: string | null;
  accessUrl: string | null;
  observations: string | null;
}

function EditTurboToolItemDialog({
  tool,
  open,
  onOpenChange,
}: {
  tool: TurboToolItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [username, setUsername] = useState(tool.username || "");
  const [password, setPassword] = useState(tool.password || "");
  const [accessUrl, setAccessUrl] = useState(tool.accessUrl || "");

  useEffect(() => {
    if (open) {
      setUsername(tool.username || "");
      setPassword(tool.password || "");
      setAccessUrl(tool.accessUrl || "");
    }
  }, [open, tool]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/ferramentas/tools/${tool.id}`, {
        login: username,
        password: password,
        site: accessUrl,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/turbo-tools"] });
      toast({
        title: "Ferramenta atualizada",
        description: "As credenciais foram atualizadas com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Credencial - {tool.platform}</DialogTitle>
          <DialogDescription>
            Atualize as informações de acesso desta ferramenta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <FormLabel>Usuário / Email</FormLabel>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Email ou usuário de acesso"
              data-testid="input-edit-turbo-username"
            />
          </div>
          <div className="space-y-2">
            <FormLabel>Senha</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha de acesso"
              data-testid="input-edit-turbo-password"
            />
          </div>
          <div className="space-y-2">
            <FormLabel>Link de Acesso</FormLabel>
            <Input
              value={accessUrl}
              onChange={(e) => setAccessUrl(e.target.value)}
              placeholder="https://..."
              data-testid="input-edit-turbo-url"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-turbo-edit"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            data-testid="button-save-turbo-edit"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TurboToolItemsSection() {
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTool, setEditingTool] = useState<TurboToolItem | null>(null);
  const { toast } = useToast();

  const { data: tools = [], isLoading } = useQuery<TurboToolItem[]>({
    queryKey: ["/api/acessos/turbo-tools"],
  });

  const filteredTools = tools.filter(tool => 
    tool.platform.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tool.username && tool.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ 
      title: "Copiado!", 
      description: "Senha copiada para a área de transferência" 
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/30">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <span className="font-medium">Turbo Tools ({filteredTools.length}/{tools.length})</span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ferramenta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-turbo-tools"
          />
        </div>
      </div>

      {filteredTools.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{searchQuery ? "Nenhuma ferramenta encontrada" : "Nenhuma ferramenta cadastrada"}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plataforma</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Senha</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTools.map((tool) => (
              <TableRow key={tool.id} data-testid={`row-turbo-tool-${tool.id}`}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    {tool.platform}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{tool.username || "-"}</span>
                    {tool.username && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(tool.username || "");
                          toast({ 
                            title: "Copiado!", 
                            description: "Usuário copiado para a área de transferência" 
                          });
                        }}
                        data-testid={`button-copy-username-turbo-${tool.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">
                      {visiblePasswords.has(tool.id) ? tool.password : "••••••••"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => togglePassword(tool.id)}
                      data-testid={`button-toggle-password-turbo-${tool.id}`}
                    >
                      {visiblePasswords.has(tool.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    {tool.password && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(tool.password || "");
                          toast({ 
                            title: "Copiado!", 
                            description: "Senha copiada para a área de transferência" 
                          });
                        }}
                        data-testid={`button-copy-password-turbo-${tool.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {tool.accessUrl && tool.accessUrl !== "#" ? (
                    <a
                      href={tool.accessUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                      data-testid={`link-url-turbo-${tool.id}`}
                    >
                      Acessar <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingTool(tool)}
                    data-testid={`button-edit-turbo-${tool.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editingTool && (
        <EditTurboToolItemDialog
          tool={editingTool}
          open={!!editingTool}
          onOpenChange={(open) => !open && setEditingTool(null)}
        />
      )}
    </div>
  );
}

function ClientCredentialsSection({ 
  clientIds, 
  clientName,
  primaryClientId
}: { 
  clientIds: string[];
  clientName: string;
  primaryClientId: string;
}) {
  const [addCredentialOpen, setAddCredentialOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [deletingCredential, setDeletingCredential] = useState<Credential | null>(null);
  const { toast } = useToast();
  const createLog = useCreateLog();

  const sortedIds = [...clientIds].sort().join(',');
  const { data: batchData, isLoading } = useQuery<ClientWithCredentials[]>({
    queryKey: ["/api/acessos/clients/batch", sortedIds],
    queryFn: async () => {
      const response = await fetch(`/api/acessos/clients/batch?ids=${encodeURIComponent(sortedIds)}`);
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const allCredentials = batchData?.flatMap(client => client.credentials || []) || [];

  const deleteCredentialMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await apiRequest("DELETE", `/api/acessos/credentials/${credentialId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients/batch", sortedIds] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/logs"] });
      if (deletingCredential) {
        createLog.mutate({
          action: "delete_credential",
          entityType: "credential",
          entityId: deletingCredential.id,
          entityName: deletingCredential.platform,
          clientId: primaryClientId,
          clientName,
        });
      }
      toast({
        title: "Credencial removida",
        description: "A credencial foi removida com sucesso.",
      });
      setDeletingCredential(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover credencial",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-muted/30 p-4 border-t">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Credenciais ({allCredentials.length})</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddCredentialOpen(true)}
          data-testid={`button-add-credential-${primaryClientId}`}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Credencial
        </Button>
      </div>

      {allCredentials.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma credencial cadastrada</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plataforma</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Senha</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allCredentials.map((credential) => (
              <CredentialRow
                key={credential.id}
                credential={credential}
                clientId={primaryClientId}
                clientName={clientName}
                onEdit={() => setEditingCredential(credential)}
                onDelete={() => setDeletingCredential(credential)}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <AddCredentialDialog
        clientId={primaryClientId}
        clientName={clientName}
        open={addCredentialOpen}
        onOpenChange={setAddCredentialOpen}
      />

      {editingCredential && (
        <EditCredentialDialog
          credential={editingCredential}
          clientId={primaryClientId}
          clientName={clientName}
          open={!!editingCredential}
          onOpenChange={(open) => !open && setEditingCredential(null)}
        />
      )}

      <AlertDialog 
        open={!!deletingCredential} 
        onOpenChange={(open) => !open && setDeletingCredential(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a credencial para {deletingCredential?.platform}? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-credential">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCredential && deleteCredentialMutation.mutate(deletingCredential.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-credential"
            >
              {deleteCredentialMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface AIMatch {
  acessosId: string;
  acessosName: string;
  cazId?: number;
  cazCnpj: string;
  cazNome: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

function AIMatchDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<AIMatch[]>([]);
  const [appliedMatches, setAppliedMatches] = useState<Set<string>>(new Set());
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [applyingAll, setApplyingAll] = useState(false);
  const { toast } = useToast();

  const fetchMatchesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/acessos/ai-match-clients");
      return await response.json();
    },
    onSuccess: (data: { matches: AIMatch[] }) => {
      setMatches(data.matches || []);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao buscar matches",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applyMatchMutation = useMutation({
    mutationFn: async ({ acessosId, cazCnpj }: { acessosId: string; cazCnpj: string }) => {
      const response = await apiRequest("POST", "/api/acessos/apply-match", { acessosId, cazCnpj });
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients"] });
      setAppliedMatches(prev => new Set([...Array.from(prev), variables.acessosId]));
      toast({
        title: "Match aplicado",
        description: "O cliente foi vinculado com sucesso.",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao aplicar match",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setMatches([]);
      setAppliedMatches(new Set());
      setConfidenceFilter('all');
      fetchMatchesMutation.mutate();
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">Alta</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">Média</Badge>;
      case 'low':
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">Baixa</Badge>;
    }
  };

  // Filter matches by confidence
  const filteredMatches = matches.filter(m => {
    if (confidenceFilter === 'all') return true;
    return m.confidence === confidenceFilter;
  });

  // Count matches by confidence
  const highCount = matches.filter(m => m.confidence === 'high' && !appliedMatches.has(m.acessosId)).length;
  const mediumCount = matches.filter(m => m.confidence === 'medium' && !appliedMatches.has(m.acessosId)).length;
  const lowCount = matches.filter(m => m.confidence === 'low' && !appliedMatches.has(m.acessosId)).length;

  // Apply all matches of a specific confidence level
  const handleApplyAll = async (confidence: 'high' | 'medium' | 'low') => {
    const matchesToApply = matches.filter(
      m => m.confidence === confidence && !appliedMatches.has(m.acessosId)
    );
    
    if (matchesToApply.length === 0) {
      toast({
        title: "Nenhum match para aplicar",
        description: `Não há matches de confiança ${confidence === 'high' ? 'alta' : confidence === 'medium' ? 'média' : 'baixa'} pendentes.`,
      });
      return;
    }

    setApplyingAll(true);
    let successCount = 0;
    let errorCount = 0;

    for (const match of matchesToApply) {
      try {
        await apiRequest("POST", "/api/acessos/apply-match", { 
          acessosId: match.acessosId, 
          cazCnpj: match.cazCnpj 
        });
        setAppliedMatches(prev => new Set([...Array.from(prev), match.acessosId]));
        successCount++;
      } catch {
        errorCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients"] });
    setApplyingAll(false);

    toast({
      title: "Matches aplicados em lote",
      description: `${successCount} vinculados com sucesso${errorCount > 0 ? `, ${errorCount} com erro` : ''}.`,
    });
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-ai-match">
          <Wand2 className="w-4 h-4 mr-2" />
          Vincular Clientes por IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Vincular Clientes por IA
          </DialogTitle>
          <DialogDescription>
            Matches sugeridos pela IA entre clientes de Acessos e Conta Azul. Filtre por nível de confiança e aplique individualmente ou em lote.
          </DialogDescription>
        </DialogHeader>

        {/* Confidence Filter Tabs */}
        {!fetchMatchesMutation.isPending && matches.length > 0 && (
          <div className="flex flex-col gap-3 pb-2 border-b">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Filtrar:</span>
              <Button
                size="sm"
                variant={confidenceFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setConfidenceFilter('all')}
                data-testid="filter-all"
              >
                Todos ({matches.filter(m => !appliedMatches.has(m.acessosId)).length})
              </Button>
              <Button
                size="sm"
                variant={confidenceFilter === 'high' ? 'default' : 'outline'}
                onClick={() => setConfidenceFilter('high')}
                className={confidenceFilter !== 'high' ? "border-green-500/50 text-green-600 dark:text-green-400 hover:bg-green-500/10" : "bg-green-600 hover:bg-green-700"}
                data-testid="filter-high"
              >
                Alta ({highCount})
              </Button>
              <Button
                size="sm"
                variant={confidenceFilter === 'medium' ? 'default' : 'outline'}
                onClick={() => setConfidenceFilter('medium')}
                className={confidenceFilter !== 'medium' ? "border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10" : "bg-yellow-600 hover:bg-yellow-700"}
                data-testid="filter-medium"
              >
                Média ({mediumCount})
              </Button>
              <Button
                size="sm"
                variant={confidenceFilter === 'low' ? 'default' : 'outline'}
                onClick={() => setConfidenceFilter('low')}
                className={confidenceFilter !== 'low' ? "border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/10" : "bg-red-600 hover:bg-red-700"}
                data-testid="filter-low"
              >
                Baixa ({lowCount})
              </Button>
            </div>

            {/* Bulk Apply Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Vincular em lote:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApplyAll('high')}
                disabled={applyingAll || highCount === 0}
                className="border-green-500/50 text-green-600 dark:text-green-400 hover:bg-green-500/10"
                data-testid="apply-all-high"
              >
                {applyingAll ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                Alta ({highCount})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApplyAll('medium')}
                disabled={applyingAll || mediumCount === 0}
                className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                data-testid="apply-all-medium"
              >
                {applyingAll ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                Média ({mediumCount})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApplyAll('low')}
                disabled={applyingAll || lowCount === 0}
                className="border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                data-testid="apply-all-low"
              >
                {applyingAll ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                Baixa ({lowCount})
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {fetchMatchesMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analisando clientes com IA...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos...</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Link2 className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-medium">Nenhum match encontrado</p>
              <p className="text-sm">Todos os clientes já estão vinculados ou não há correspondências</p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-medium">Nenhum match com essa confiança</p>
              <p className="text-sm">Tente outro filtro ou todos os matches dessa categoria já foram aplicados</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {filteredMatches.map((match) => {
                const isApplied = appliedMatches.has(match.acessosId);
                return (
                  <Card 
                    key={match.acessosId} 
                    className={cn(isApplied && "opacity-60")}
                    data-testid={`match-card-${match.acessosId}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{match.acessosName}</span>
                            <Link2 className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-primary">{match.cazNome}</span>
                            {getConfidenceBadge(match.confidence)}
                          </div>
                          <p className="text-sm text-muted-foreground">{match.reason}</p>
                        </div>
                        <Button
                          size="sm"
                          disabled={isApplied || applyMatchMutation.isPending || applyingAll}
                          onClick={() => applyMatchMutation.mutate({ 
                            acessosId: match.acessosId, 
                            cazCnpj: match.cazCnpj 
                          })}
                          data-testid={`button-apply-match-${match.acessosId}`}
                        >
                          {isApplied ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Aplicado
                            </>
                          ) : applyMatchMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Aplicar"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-close-ai-match">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogsTab() {
  const { data: logs = [], isLoading } = useQuery<AccessLog[]>({
    queryKey: ["/api/acessos/logs"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum log registrado</p>
        <p className="text-sm">Os logs de atividade aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Credencial</TableHead>
            <TableHead>Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
              <TableCell className="text-sm">{formatDateTime(log.createdAt)}</TableCell>
              <TableCell className="text-sm">{log.userName || log.userEmail || "-"}</TableCell>
              <TableCell>
                <Badge variant={ACTION_BADGE_VARIANTS[log.action as LogActionType] || "default"}>
                  {ACTION_LABELS[log.action as LogActionType] || log.action}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{log.clientName || "-"}</TableCell>
              <TableCell className="text-sm">{log.entityType === "credential" ? log.entityName : "-"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{log.details || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type SortField = 'name' | 'status' | 'credential_count';
type SortDirection = 'asc' | 'desc';

interface CupCliente {
  cnpj: string;
  nome: string;
}

function ClientsTab() {
  const [searchQuery, setSearchQuery] = usePersistentFilters("acessos-search", "");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showOnlyLinked, setShowOnlyLinked] = usePersistentFilters("acessos-linked-only", true);
  const [statusFilter, setStatusFilter] = usePersistentFilters<"todos" | "ativos" | "inativos">("acessos-status-filter", "ativos");
  const { toast } = useToast();
  const createLog = useCreateLog();

  const { data: clients = [], isLoading } = useQuery<ClientWithCredentialCount[]>({
    queryKey: ["/api/acessos/clients"],
  });

  const { data: cupClientes = [] } = useQuery<CupCliente[]>({
    queryKey: ["/api/acessos/cup-clientes"],
  });

  const getCupClienteName = (cnpj: string | null) => {
    if (!cnpj) return null;
    const cupClient = cupClientes.find(c => c.cnpj === cnpj);
    return cupClient?.nome || cnpj;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('client');
    if (clientId && clients.length > 0) {
      const clientExists = clients.some(c => c.id === clientId);
      if (clientExists) {
        setExpandedClient(clientId);
        setTimeout(() => {
          const element = document.querySelector(`[data-testid="row-client-${clientId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        window.history.replaceState({}, '', '/acessos');
      }
    }
  }, [clients]);

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest("DELETE", `/api/acessos/clients/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/logs"] });
      if (deletingClient) {
        createLog.mutate({
          action: "delete_client",
          entityType: "client",
          entityId: deletingClient.id,
          entityName: deletingClient.name,
        });
      }
      toast({
        title: "Cliente removido",
        description: "O cliente e suas credenciais foram removidos com sucesso.",
      });
      setDeletingClient(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const isTurboClient = (name: string | null | undefined) => {
    return name?.toLowerCase().trim() === 'turbo partners';
  };

  const normalizeClientName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const sortedAndFilteredClients = useMemo((): AggregatedClient[] => {
    const clientsToProcess = showOnlyLinked && !searchQuery
      ? clients.filter((client) => client.cazClienteId != null)
      : clients;

    const groupedByName = new Map<string, ClientWithCredentialCount[]>();
    
    clientsToProcess.forEach(client => {
      const normalizedName = normalizeClientName(client.name);
      if (!groupedByName.has(normalizedName)) {
        groupedByName.set(normalizedName, []);
      }
      groupedByName.get(normalizedName)!.push(client);
    });

    const aggregated: AggregatedClient[] = [];
    
    groupedByName.forEach((clientGroup) => {
      const primary = clientGroup.reduce((best, current) => {
        if (current.status === 'ativo' && best.status !== 'ativo') return current;
        if ((current.credential_count || 0) > (best.credential_count || 0)) return current;
        return best;
      }, clientGroup[0]);

      const allIds = clientGroup.map(c => c.id);
      const allPlatforms = Array.from(new Set(clientGroup.flatMap(c => c.platforms || [])));
      const totalCredentials = clientGroup.reduce((sum, c) => sum + (c.credential_count || 0), 0);
      const hasActiveStatus = clientGroup.some(c => c.status === 'ativo');
      const hasLinked = clientGroup.some(c => c.cazClienteId != null);
      const linkedCnpj = clientGroup.find(c => c.linkedClientCnpj)?.linkedClientCnpj;

      aggregated.push({
        ...primary,
        id: allIds.join(','),
        aggregatedIds: allIds,
        aggregatedPlatforms: allPlatforms,
        aggregatedCredentialCount: totalCredentials,
        credential_count: totalCredentials,
        platforms: allPlatforms,
        status: hasActiveStatus ? 'ativo' : 'cancelado',
        cazClienteId: hasLinked ? (primary.cazClienteId || clientGroup.find(c => c.cazClienteId)?.cazClienteId) : null,
        linkedClientCnpj: linkedCnpj || null,
        displayName: primary.name || '',
      });
    });

    let filtered = aggregated;
    
    if (statusFilter === "ativos") {
      filtered = filtered.filter(client => client.status === 'ativo');
    } else if (statusFilter === "inativos") {
      filtered = filtered.filter(client => client.status !== 'ativo');
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (client) =>
          client.name?.toLowerCase().includes(query) ||
          client.cnpj?.toLowerCase().includes(query) ||
          (client.aggregatedPlatforms && client.aggregatedPlatforms.some(platform => 
            platform.toLowerCase().includes(query)
          ))
      );
    }
    
    const statusOrder: Record<string, number> = {
      'ativo': 0,
      'cancelado': 1,
    };
    
    return [...filtered].sort((a, b) => {
      const aIsTurbo = isTurboClient(a.name);
      const bIsTurbo = isTurboClient(b.name);
      
      if (aIsTurbo && !bIsTurbo) return -1;
      if (!aIsTurbo && bIsTurbo) return 1;
      
      let aVal: any;
      let bVal: any;
      
      switch (sortField) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'status':
          aVal = statusOrder[a.status || 'ativo'] ?? 99;
          bVal = statusOrder[b.status || 'ativo'] ?? 99;
          break;
        case 'credential_count':
          aVal = a.aggregatedCredentialCount || 0;
          bVal = b.aggregatedCredentialCount || 0;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [clients, searchQuery, sortField, sortDirection, showOnlyLinked, statusFilter]);

  const toggleExpand = (clientId: string) => {
    setExpandedClient(expandedClient === clientId ? null : clientId);
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium"
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      {children}
      <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === field ? 'opacity-100' : 'opacity-50'}`} />
    </Button>
  );

  if (isLoading) {
    return <TableSkeleton rows={10} columns={5} />;
  }

  const linkedCount = clients.filter(c => c.cazClienteId != null).length;
  const totalCount = clients.length;
  const activeCount = sortedAndFilteredClients.filter(c => c.status === 'ativo').length;
  const inactiveCount = sortedAndFilteredClients.filter(c => c.status !== 'ativo').length;

  return (
    <>
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Building2 className="w-3.5 h-3.5" />
              Total de Clientes
            </div>
            <div className="text-2xl font-bold">{totalCount}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Link2 className="w-3.5 h-3.5" />
              Linkados ao TP
            </div>
            <div className="text-2xl font-bold text-primary">{linkedCount}</div>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-medium mb-1">
              <Check className="w-3.5 h-3.5" />
              Ativos
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</div>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive text-xs font-medium mb-1">
              <X className="w-3.5 h-3.5" />
              Inativos
            </div>
            <div className="text-2xl font-bold text-destructive">{inactiveCount}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por empresa ou plataforma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-clients"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Vínculo:</span>
              <div className="flex rounded-md border p-0.5 bg-muted/30">
                <Button
                  variant={showOnlyLinked && !searchQuery ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-7 px-2.5 text-xs", !showOnlyLinked && "hover:bg-transparent")}
                  onClick={() => setShowOnlyLinked(true)}
                  disabled={!!searchQuery}
                  data-testid="filter-linked"
                >
                  <Link2 className="w-3 h-3 mr-1" />
                  Linkados
                </Button>
                <Button
                  variant={!showOnlyLinked && !searchQuery ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-7 px-2.5 text-xs", showOnlyLinked && "hover:bg-transparent")}
                  onClick={() => setShowOnlyLinked(false)}
                  disabled={!!searchQuery}
                  data-testid="filter-all"
                >
                  Todos
                </Button>
              </div>
            </div>
            
            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status:</span>
              <div className="flex rounded-md border p-0.5 bg-muted/30">
                <Button
                  variant={statusFilter === "ativos" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 px-2.5 text-xs",
                    statusFilter === "ativos" && "bg-green-600 hover:bg-green-700",
                    statusFilter !== "ativos" && "hover:bg-transparent"
                  )}
                  onClick={() => setStatusFilter("ativos")}
                  data-testid="filter-ativos"
                >
                  Ativos
                </Button>
                <Button
                  variant={statusFilter === "inativos" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 px-2.5 text-xs",
                    statusFilter === "inativos" && "bg-destructive hover:bg-destructive/90",
                    statusFilter !== "inativos" && "hover:bg-transparent"
                  )}
                  onClick={() => setStatusFilter("inativos")}
                  data-testid="filter-inativos"
                >
                  Inativos
                </Button>
                <Button
                  variant={statusFilter === "todos" ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-7 px-2.5 text-xs", statusFilter !== "todos" && "hover:bg-transparent")}
                  onClick={() => setStatusFilter("todos")}
                  data-testid="filter-status-todos"
                >
                  Todos
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {searchQuery && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Buscando por "{searchQuery}" em empresas e plataformas ({sortedAndFilteredClients.length} resultados)</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setSearchQuery("")}
          >
            <X className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          Exibindo <span className="font-medium text-foreground">{sortedAndFilteredClients.length}</span> clientes
          {statusFilter !== "todos" && (
            <span> ({statusFilter === "ativos" ? "ativos" : "inativos"})</span>
          )}
        </p>
      </div>

      {sortedAndFilteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium">
            {searchQuery 
              ? "Nenhum cliente encontrado" 
              : statusFilter === "inativos"
                ? "Nenhum cliente inativo"
                : statusFilter === "ativos"
                  ? "Nenhum cliente ativo"
                  : showOnlyLinked 
                    ? "Nenhum cliente linkado" 
                    : "Nenhum cliente cadastrado"}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {searchQuery 
              ? "Tente buscar por outro termo" 
              : showOnlyLinked
                ? "Use a aba 'Vincular Clientes' para linkar clientes do Turbo Partners"
                : "Adicione seu primeiro cliente clicando no botão acima"}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>
                  <SortableHeader field="name">Empresa</SortableHeader>
                </TableHead>
                <TableHead>Plataformas</TableHead>
                <TableHead>
                  <SortableHeader field="status">Status</SortableHeader>
                </TableHead>
                <TableHead className="text-center">
                  <SortableHeader field="credential_count">Credenciais</SortableHeader>
                </TableHead>
                <TableHead className="w-[100px] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredClients.map((client, index) => (
                <Fragment key={client.id}>
                  <TableRow 
                    className={cn(
                      "cursor-pointer transition-colors group",
                      isTurboClient(client.name) && "bg-primary/5",
                      expandedClient === client.id && "bg-muted/50",
                      index % 2 === 0 ? "bg-background" : "bg-muted/20"
                    )}
                    onClick={() => toggleExpand(client.id)}
                    data-testid={`row-client-${client.id}`}
                  >
                    <TableCell className="py-3">
                      <div className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                        expandedClient === client.id ? "bg-primary/10" : "bg-muted group-hover:bg-muted/80"
                      )}>
                        {expandedClient === client.id ? (
                          <ChevronDown className="w-4 h-4 text-primary" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                          isTurboClient(client.name) 
                            ? "bg-primary text-primary-foreground" 
                            : client.status === 'ativo'
                              ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                              : "bg-muted text-muted-foreground"
                        )}>
                          {client.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{client.name}</span>
                            {isTurboClient(client.name) && (
                              <Badge variant="default" className="text-xs shrink-0">
                                Turbo
                              </Badge>
                            )}
                          </div>
                          {client.linkedClientCnpj && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link 
                                  href={`/cliente/${encodeURIComponent(client.linkedClientCnpj)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
                                  data-testid={`link-client-page-${client.id}`}
                                >
                                  <Link2 className="w-3 h-3" data-testid={`icon-linked-${client.id}`} />
                                  <span className="truncate max-w-[180px]">{getCupClienteName(client.linkedClientCnpj)}</span>
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Ver página do cliente</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {client.platforms && client.platforms.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                          {client.platforms.slice(0, 3).map((platform, idx) => {
                            const isMatch = searchQuery && platform.toLowerCase().includes(searchQuery.toLowerCase());
                            return (
                              <Badge 
                                key={idx} 
                                variant="outline" 
                                className={cn(
                                  "text-xs font-normal",
                                  isMatch && "border-primary bg-primary/10 text-primary font-medium"
                                )}
                              >
                                {platform}
                              </Badge>
                            );
                          })}
                          {client.platforms.length > 3 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-xs cursor-help">
                                  +{client.platforms.length - 3}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{client.platforms.slice(3).join(", ")}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Sem plataformas</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {!isTurboClient(client.name) && (
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                          client.status === 'ativo' 
                            ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                            : "bg-destructive/10 text-destructive"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            client.status === 'ativo' ? "bg-green-500" : "bg-destructive"
                          )} />
                          {client.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <div className="inline-flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-md">
                        <Key className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{client.credential_count || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingClient(client)}
                              data-testid={`button-edit-client-${client.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar cliente</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingClient(client)}
                              data-testid={`button-delete-client-${client.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir cliente</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedClient === client.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        {isTurboClient(client.name) ? (
                          <TurboToolItemsSection />
                        ) : (
                          <ClientCredentialsSection 
                            clientIds={client.aggregatedIds} 
                            clientName={client.name}
                            primaryClientId={client.aggregatedIds[0]}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editingClient && (
        <EditClientDialog
          client={editingClient}
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
        />
      )}

      <AlertDialog 
        open={!!deletingClient} 
        onOpenChange={(open) => !open && setDeletingClient(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente {deletingClient?.name}? 
              Todas as credenciais associadas também serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-client">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingClient && deleteClientMutation.mutate(deletingClient.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-client"
            >
              {deleteClientMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type TurboAccessItem = {
  id: number;
  platform: string;
  username: string;
  password: string;
  accessUrl: string | null;
  observations: string | null;
};

function TurboTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());
  const [editingTool, setEditingTool] = useState<TurboAccessItem | null>(null);
  const [deletingTool, setDeletingTool] = useState<TurboAccessItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: tools = [], isLoading } = useQuery<TurboAccessItem[]>({
    queryKey: ["/api/acessos/turbo-tools"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<TurboAccessItem, 'id'>) => {
      const response = await apiRequest("POST", "/api/acessos/turbo-tools", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/turbo-tools"] });
      toast({ title: "Ferramenta adicionada", description: "A ferramenta foi adicionada com sucesso." });
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<TurboAccessItem> & { id: number }) => {
      const response = await apiRequest("PATCH", `/api/acessos/turbo-tools/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/turbo-tools"] });
      toast({ title: "Ferramenta atualizada", description: "A ferramenta foi atualizada com sucesso." });
      setEditingTool(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/acessos/turbo-tools/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/turbo-tools"] });
      toast({ title: "Ferramenta removida", description: "A ferramenta foi removida com sucesso." });
      setDeletingTool(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    },
  });

  const togglePassword = (id: number) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
  };

  const filteredTools = useMemo(() => {
    if (!searchQuery) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(tool => 
      (tool.platform && tool.platform.toLowerCase().includes(query)) ||
      (tool.username && tool.username.toLowerCase().includes(query)) ||
      (tool.accessUrl && tool.accessUrl.toLowerCase().includes(query))
    );
  }, [tools, searchQuery]);

  const TurboToolItemForm = ({ tool, onSubmit, onCancel, isPending }: { 
    tool?: TurboAccessItem; 
    onSubmit: (data: Omit<TurboAccessItem, 'id'>) => void; 
    onCancel: () => void;
    isPending: boolean;
  }) => {
    const [platform, setPlatform] = useState(tool?.platform || "");
    const [username, setUsername] = useState(tool?.username || "");
    const [password, setPassword] = useState(tool?.password || "");
    const [accessUrl, setAccessUrl] = useState(tool?.accessUrl || "");
    const [observations, setObservations] = useState(tool?.observations || "");

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit({ platform, username, password, accessUrl: accessUrl || null, observations: observations || null });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Plataforma *</label>
          <Input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="Ex: Google Workspace" required data-testid="input-turbo-platform" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Login/Usuário *</label>
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Email ou usuário" required data-testid="input-turbo-username" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Senha *</label>
          <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" required data-testid="input-turbo-password" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">URL de Acesso</label>
          <Input value={accessUrl} onChange={e => setAccessUrl(e.target.value)} placeholder="https://..." data-testid="input-turbo-url" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Observações</label>
          <Textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Notas adicionais" data-testid="input-turbo-observations" />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-turbo">Cancelar</Button>
          <Button type="submit" disabled={isPending} data-testid="button-save-turbo">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ferramentas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-turbo"
          />
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-turbo-tool">
              <Plus className="w-4 h-4 mr-2" />
              Nova Ferramenta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Ferramenta Turbo</DialogTitle>
              <DialogDescription>Adicione uma nova credencial de ferramenta interna.</DialogDescription>
            </DialogHeader>
            <TurboToolItemForm 
              onSubmit={(data) => createMutation.mutate(data)} 
              onCancel={() => setIsAddDialogOpen(false)}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <TableSkeleton columns={5} rows={5} />
      ) : filteredTools.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhuma ferramenta encontrada</p>
          <p className="text-sm">Adicione ferramentas internas da Turbo Partners</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plataforma</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Senha</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTools.map((tool) => (
              <TableRow key={tool.id} data-testid={`row-turbo-${tool.id}`}>
                <TableCell className="font-medium">{tool.platform}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{tool.username}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(tool.username)} data-testid={`button-copy-username-${tool.id}`}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">
                      {visiblePasswords.has(tool.id) ? tool.password : "••••••••"}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePassword(tool.id)} data-testid={`button-toggle-password-${tool.id}`}>
                      {visiblePasswords.has(tool.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(tool.password)} data-testid={`button-copy-password-${tool.id}`}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {tool.accessUrl ? (
                    <a href={tool.accessUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Acessar
                    </a>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTool(tool)} data-testid={`button-edit-turbo-${tool.id}`}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingTool(tool)} data-testid={`button-delete-turbo-${tool.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!editingTool} onOpenChange={() => setEditingTool(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Ferramenta</DialogTitle>
            <DialogDescription>Atualize as informações da ferramenta.</DialogDescription>
          </DialogHeader>
          {editingTool && (
            <TurboToolItemForm 
              tool={editingTool}
              onSubmit={(data) => updateMutation.mutate({ id: editingTool.id, ...data })} 
              onCancel={() => setEditingTool(null)}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingTool} onOpenChange={() => setDeletingTool(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ferramenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a ferramenta "{deletingTool?.platform}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingTool && deleteMutation.mutate(deletingTool.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Acessos() {
  usePageTitle("Acessos");
  useSetPageInfo("Acessos", "Gerenciamento de credenciais de clientes");

  return (
    <div className="p-6 space-y-6" data-testid="page-acessos">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-primary" />
            </div>
            Acessos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie credenciais e logins de clientes em diferentes plataformas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AIMatchDialog />
          <AddClientDialog />
        </div>
      </div>
      
      <Card>
        <Tabs defaultValue="clientes">
          <CardHeader className="pb-0">
            <TabsList className="w-fit">
              <TabsTrigger value="clientes" data-testid="tab-clientes" className="gap-2">
                <Building2 className="w-4 h-4" />
                Clientes
              </TabsTrigger>
              <TabsTrigger value="turbo" data-testid="tab-turbo" className="gap-2">
                <Zap className="w-4 h-4" />
                Turbo
              </TabsTrigger>
              <TabsTrigger value="logs" data-testid="tab-logs" className="gap-2">
                <History className="w-4 h-4" />
                Histórico
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-6">
            <TabsContent value="clientes" className="m-0">
              <ClientsTab />
            </TabsContent>
            <TabsContent value="turbo" className="m-0">
              <TurboTab />
            </TabsContent>
            <TabsContent value="logs" className="m-0">
              <LogsTab />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
