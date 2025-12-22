import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Client, Credential, InsertClient, InsertCredential, AccessLog } from "@shared/schema";
import { insertClientSchema, insertCredentialSchema } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Eye, EyeOff, Copy, Edit, Trash2, ExternalLink, Key, Lock, Loader2, ChevronDown, ChevronRight, Building2, History } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type ClientWithCredentialCount = Client & { credential_count: number };
type ClientWithCredentials = Client & { credentials: Credential[] };

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

function AddClientDialog({ onSuccess }: { onSuccess?: (client: Client) => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createLog = useCreateLog();

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      additionalInfo: "",
    },
  });

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
      setOpen(false);
      form.reset();
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

  const onSubmit = (data: InsertClient) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Preencha os dados do novo cliente. O campo Nome é obrigatório.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-client-name" placeholder="Nome do cliente" />
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
                    <Input {...field} value={field.value || ""} data-testid="input-client-cnpj" placeholder="00.000.000/0000-00" />
                  </FormControl>
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
                onClick={() => setOpen(false)}
                data-testid="button-cancel-client"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
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
  const { toast } = useToast();
  const createLog = useCreateLog();

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: client.name || "",
      cnpj: client.cnpj || "",
      additionalInfo: client.additionalInfo || "",
    },
  });

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
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertClient) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações do cliente {client.name}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                onClick={() => onOpenChange(false)}
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
      <TableCell>{credential.username || "-"}</TableCell>
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

function ClientCredentialsSection({ 
  clientId, 
  clientName 
}: { 
  clientId: string;
  clientName: string;
}) {
  const [addCredentialOpen, setAddCredentialOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [deletingCredential, setDeletingCredential] = useState<Credential | null>(null);
  const { toast } = useToast();
  const createLog = useCreateLog();

  const { data: clientWithCredentials, isLoading } = useQuery<ClientWithCredentials>({
    queryKey: ["/api/acessos/clients", clientId],
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await apiRequest("DELETE", `/api/acessos/credentials/${credentialId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/logs"] });
      if (deletingCredential) {
        createLog.mutate({
          action: "delete_credential",
          entityType: "credential",
          entityId: deletingCredential.id,
          entityName: deletingCredential.platform,
          clientId,
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

  const credentials = clientWithCredentials?.credentials || [];

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
          <span className="text-sm font-medium">Credenciais ({credentials.length})</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddCredentialOpen(true)}
          data-testid={`button-add-credential-${clientId}`}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Credencial
        </Button>
      </div>

      {credentials.length === 0 ? (
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
            {credentials.map((credential) => (
              <CredentialRow
                key={credential.id}
                credential={credential}
                clientId={clientId}
                clientName={clientName}
                onEdit={() => setEditingCredential(credential)}
                onDelete={() => setDeletingCredential(credential)}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <AddCredentialDialog
        clientId={clientId}
        clientName={clientName}
        open={addCredentialOpen}
        onOpenChange={setAddCredentialOpen}
      />

      {editingCredential && (
        <EditCredentialDialog
          credential={editingCredential}
          clientId={clientId}
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

function ClientsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const createLog = useCreateLog();

  const { data: clients = [], isLoading } = useQuery<ClientWithCredentialCount[]>({
    queryKey: ["/api/acessos/clients"],
  });

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

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.name?.toLowerCase().includes(query) ||
        client.cnpj?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const toggleExpand = (clientId: string) => {
    setExpandedClient(expandedClient === clientId ? null : clientId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-clients"
          />
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">
            {searchQuery ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </p>
          <p className="text-sm">
            {searchQuery 
              ? "Tente buscar por outro termo" 
              : "Adicione seu primeiro cliente clicando no botão acima"}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead className="text-center">Credenciais</TableHead>
                <TableHead>Data Criação</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <Fragment key={client.id}>
                  <TableRow 
                    className="cursor-pointer hover-elevate"
                    onClick={() => toggleExpand(client.id)}
                    data-testid={`row-client-${client.id}`}
                  >
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-6 w-6">
                        {expandedClient === client.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{formatCNPJ(client.cnpj)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {client.credential_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(client.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingClient(client)}
                          data-testid={`button-edit-client-${client.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeletingClient(client)}
                          data-testid={`button-delete-client-${client.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedClient === client.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <ClientCredentialsSection 
                          clientId={client.id} 
                          clientName={client.name}
                        />
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

export default function Acessos() {
  useSetPageInfo("Acessos", "Gerenciamento de credenciais de clientes");

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Clientes e Credenciais
              </CardTitle>
              <CardDescription>
                Gerencie os acessos e credenciais dos clientes
              </CardDescription>
            </div>
            <AddClientDialog />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="clientes">
            <TabsList className="mb-4">
              <TabsTrigger value="clientes" data-testid="tab-clientes">
                <Building2 className="w-4 h-4 mr-2" />
                Clientes
              </TabsTrigger>
              <TabsTrigger value="logs" data-testid="tab-logs">
                <History className="w-4 h-4 mr-2" />
                Logs
              </TabsTrigger>
            </TabsList>
            <TabsContent value="clientes">
              <ClientsTab />
            </TabsContent>
            <TabsContent value="logs">
              <LogsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
