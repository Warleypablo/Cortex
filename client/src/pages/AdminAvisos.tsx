import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Info,
  AlertTriangle,
  CheckCircle,
  Zap,
  ExternalLink,
  Calendar,
  Eye,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";

interface Aviso {
  id: number;
  titulo: string;
  mensagem: string;
  tipo: string;
  cor: string;
  icone: string | null;
  link_texto: string | null;
  link_url: string | null;
  ativo: boolean;
  ordem: number;
  data_inicio: string | null;
  data_fim: string | null;
  criado_em: string;
  criado_por: string | null;
}

const tiposAviso = [
  { value: 'info', label: 'Informativo', icon: Info, color: 'bg-blue-500' },
  { value: 'alerta', label: 'Alerta', icon: AlertTriangle, color: 'bg-amber-500' },
  { value: 'sucesso', label: 'Sucesso', icon: CheckCircle, color: 'bg-emerald-500' },
  { value: 'urgente', label: 'Urgente', icon: Zap, color: 'bg-red-500' },
];

function AvisoForm({ 
  aviso, 
  onSave, 
  onCancel,
  isLoading,
}: { 
  aviso?: Aviso | null; 
  onSave: (data: Partial<Aviso>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    titulo: aviso?.titulo || '',
    mensagem: aviso?.mensagem || '',
    tipo: aviso?.tipo || 'info',
    cor: aviso?.cor || '#f97316',
    linkTexto: aviso?.link_texto || '',
    linkUrl: aviso?.link_url || '',
    ativo: aviso?.ativo !== false,
    ordem: aviso?.ordem || 0,
    dataInicio: aviso?.data_inicio ? format(new Date(aviso.data_inicio), "yyyy-MM-dd'T'HH:mm") : '',
    dataFim: aviso?.data_fim ? format(new Date(aviso.data_fim), "yyyy-MM-dd'T'HH:mm") : '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      titulo: formData.titulo,
      mensagem: formData.mensagem,
      tipo: formData.tipo,
      cor: formData.cor,
      link_texto: formData.linkTexto || null,
      link_url: formData.linkUrl || null,
      ativo: formData.ativo,
      ordem: formData.ordem,
      data_inicio: formData.dataInicio || null,
      data_fim: formData.dataFim || null,
    } as any);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="titulo">Título *</Label>
        <Input
          id="titulo"
          value={formData.titulo}
          onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
          placeholder="Título do aviso"
          required
          data-testid="input-aviso-titulo"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mensagem">Mensagem *</Label>
        <Textarea
          id="mensagem"
          value={formData.mensagem}
          onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
          placeholder="Mensagem do aviso"
          required
          rows={3}
          data-testid="input-aviso-mensagem"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select
            value={formData.tipo}
            onValueChange={(value) => setFormData({ ...formData, tipo: value })}
          >
            <SelectTrigger data-testid="select-aviso-tipo">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {tiposAviso.map((tipo) => (
                <SelectItem key={tipo.value} value={tipo.value}>
                  <div className="flex items-center gap-2">
                    <tipo.icon className="w-4 h-4" />
                    {tipo.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ordem">Ordem</Label>
          <Input
            id="ordem"
            type="number"
            value={formData.ordem}
            onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
            min={0}
            data-testid="input-aviso-ordem"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="linkTexto">Texto do Link (opcional)</Label>
          <Input
            id="linkTexto"
            value={formData.linkTexto}
            onChange={(e) => setFormData({ ...formData, linkTexto: e.target.value })}
            placeholder="Saiba mais"
            data-testid="input-aviso-link-texto"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="linkUrl">URL do Link (opcional)</Label>
          <Input
            id="linkUrl"
            value={formData.linkUrl}
            onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
            placeholder="https://..."
            data-testid="input-aviso-link-url"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dataInicio">Data de Início (opcional)</Label>
          <Input
            id="dataInicio"
            type="datetime-local"
            value={formData.dataInicio}
            onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
            data-testid="input-aviso-data-inicio"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dataFim">Data de Fim (opcional)</Label>
          <Input
            id="dataFim"
            type="datetime-local"
            value={formData.dataFim}
            onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
            data-testid="input-aviso-data-fim"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="ativo"
          checked={formData.ativo}
          onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
          data-testid="switch-aviso-ativo"
        />
        <Label htmlFor="ativo">Aviso ativo</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-aviso">
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save-aviso">
          {isLoading ? 'Salvando...' : aviso ? 'Salvar alterações' : 'Criar aviso'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function AdminAvisos() {
  usePageTitle("Gerenciar Avisos | Turbo Cortex");

  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAviso, setEditingAviso] = useState<Aviso | null>(null);

  const { data: avisos, isLoading } = useQuery<Aviso[]>({
    queryKey: ['/api/avisos'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Aviso>) => {
      return apiRequest('POST', '/api/avisos', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/avisos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/avisos/ativos'] });
      toast({ title: 'Aviso criado com sucesso!' });
      setDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Erro ao criar aviso', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Aviso> }) => {
      return apiRequest('PUT', `/api/avisos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/avisos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/avisos/ativos'] });
      toast({ title: 'Aviso atualizado com sucesso!' });
      setDialogOpen(false);
      setEditingAviso(null);
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar aviso', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/avisos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/avisos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/avisos/ativos'] });
      toast({ title: 'Aviso excluído com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir aviso', variant: 'destructive' });
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      const aviso = avisos?.find(a => a.id === id);
      if (!aviso) return;
      
      return apiRequest('PUT', `/api/avisos/${id}`, { ...aviso, ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/avisos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/avisos/ativos'] });
    },
  });

  const handleSave = (data: Partial<Aviso>) => {
    if (editingAviso) {
      updateMutation.mutate({ id: editingAviso.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (aviso: Aviso) => {
    setEditingAviso(aviso);
    setDialogOpen(true);
  };

  const handleNewAviso = () => {
    setEditingAviso(null);
    setDialogOpen(true);
  };

  const getTipoInfo = (tipo: string) => {
    return tiposAviso.find(t => t.value === tipo) || tiposAviso[0];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5" />
              Avisos
            </CardTitle>
            <CardDescription>
              Gerencie os avisos que aparecem no topo da página inicial para todos os colaboradores
            </CardDescription>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewAviso} data-testid="button-new-aviso">
                <Plus className="w-4 h-4 mr-2" />
                Novo Aviso
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingAviso ? 'Editar Aviso' : 'Novo Aviso'}
                </DialogTitle>
                <DialogDescription>
                  {editingAviso 
                    ? 'Edite as informações do aviso abaixo' 
                    : 'Preencha as informações do novo aviso'}
                </DialogDescription>
              </DialogHeader>
              <AvisoForm
                aviso={editingAviso}
                onSave={handleSave}
                onCancel={() => {
                  setDialogOpen(false);
                  setEditingAviso(null);
                }}
                isLoading={createMutation.isPending || updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          {avisos && avisos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum aviso cadastrado</p>
              <p className="text-sm">Clique em "Novo Aviso" para criar o primeiro</p>
            </div>
          ) : (
            <div className="space-y-3">
              {avisos?.map((aviso) => {
                const tipoInfo = getTipoInfo(aviso.tipo);
                const TipoIcon = tipoInfo.icon;
                
                return (
                  <div
                    key={aviso.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border ${aviso.ativo ? 'bg-muted/30' : 'bg-muted/10 opacity-60'}`}
                    data-testid={`aviso-item-${aviso.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <div className={`p-2 rounded-full ${tipoInfo.color} text-white`}>
                        <TipoIcon className="w-4 h-4" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{aviso.titulo}</h4>
                        <Badge variant={aviso.ativo ? "default" : "secondary"}>
                          {aviso.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant="outline">{tipoInfo.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{aviso.mensagem}</p>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {aviso.link_url && (
                          <span className="flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {aviso.link_texto || 'Link'}
                          </span>
                        )}
                        {(aviso.data_inicio || aviso.data_fim) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {aviso.data_inicio && format(new Date(aviso.data_inicio), 'dd/MM/yyyy')}
                            {aviso.data_inicio && aviso.data_fim && ' - '}
                            {aviso.data_fim && format(new Date(aviso.data_fim), 'dd/MM/yyyy')}
                          </span>
                        )}
                        <span>Ordem: {aviso.ordem}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleAtivoMutation.mutate({ id: aviso.id, ativo: !aviso.ativo })}
                        title={aviso.ativo ? 'Desativar' : 'Ativar'}
                        data-testid={`button-toggle-aviso-${aviso.id}`}
                      >
                        {aviso.ativo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(aviso)}
                        data-testid={`button-edit-aviso-${aviso.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-aviso-${aviso.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O aviso "{aviso.titulo}" será excluído permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(aviso.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
