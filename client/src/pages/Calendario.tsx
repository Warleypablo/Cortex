import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, MapPin, Clock, User, PartyPopper, Target, GraduationCap, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

interface TurboEvento {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: string;
  dataInicio: string;
  dataFim: string | null;
  local: string | null;
  organizadorId: number | null;
  organizadorNome: string | null;
  cor: string | null;
  criadoEm: string;
  criadoPor: string | null;
}

const EVENT_TYPES = [
  { value: "confraternizacao", label: "Confraternização", icon: PartyPopper, color: "#ec4899" },
  { value: "reuniao_resultado", label: "Reunião de Resultado", icon: Target, color: "#3b82f6" },
  { value: "workshop", label: "Workshop", icon: GraduationCap, color: "#22c55e" },
  { value: "outro", label: "Outro", icon: CalendarIcon, color: "#f97316" },
];

const getEventTypeInfo = (tipo: string) => {
  return EVENT_TYPES.find((t) => t.value === tipo) || EVENT_TYPES[3];
};

function EventForm({ 
  evento, 
  onClose, 
  selectedDate 
}: { 
  evento?: TurboEvento; 
  onClose: () => void; 
  selectedDate?: Date;
}) {
  const { toast } = useToast();
  const isEdit = !!evento;
  
  const [titulo, setTitulo] = useState(evento?.titulo || "");
  const [descricao, setDescricao] = useState(evento?.descricao || "");
  const [tipo, setTipo] = useState(evento?.tipo || "outro");
  const [dataInicio, setDataInicio] = useState(
    evento?.dataInicio 
      ? format(parseISO(evento.dataInicio), "yyyy-MM-dd'T'HH:mm")
      : selectedDate 
        ? format(selectedDate, "yyyy-MM-dd") + "T09:00"
        : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [dataFim, setDataFim] = useState(
    evento?.dataFim 
      ? format(parseISO(evento.dataFim), "yyyy-MM-dd'T'HH:mm")
      : ""
  );
  const [local, setLocal] = useState(evento?.local || "");
  
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/calendario/eventos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendario/eventos"] });
      toast({ title: "Evento criado com sucesso!" });
      onClose();
    },
    onError: () => {
      toast({ title: "Erro ao criar evento", variant: "destructive" });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/calendario/eventos/${evento?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendario/eventos"] });
      toast({ title: "Evento atualizado com sucesso!" });
      onClose();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar evento", variant: "destructive" });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const typeInfo = getEventTypeInfo(tipo);
    const data = {
      titulo,
      descricao: descricao || null,
      tipo,
      dataInicio: new Date(dataInicio).toISOString(),
      dataFim: dataFim ? new Date(dataFim).toISOString() : null,
      local: local || null,
      cor: typeInfo.color,
    };
    
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };
  
  const isPending = createMutation.isPending || updateMutation.isPending;
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="titulo">Título *</Label>
        <Input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nome do evento"
          required
          data-testid="input-evento-titulo"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="tipo">Tipo de Evento</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger data-testid="select-evento-tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dataInicio">Data/Hora Início *</Label>
          <Input
            id="dataInicio"
            type="datetime-local"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            required
            data-testid="input-evento-data-inicio"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataFim">Data/Hora Fim</Label>
          <Input
            id="dataFim"
            type="datetime-local"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            data-testid="input-evento-data-fim"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="local">Local</Label>
        <Input
          id="local"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Local do evento"
          data-testid="input-evento-local"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes do evento..."
          rows={3}
          data-testid="input-evento-descricao"
        />
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending || !titulo} data-testid="button-salvar-evento">
          {isPending ? "Salvando..." : isEdit ? "Atualizar" : "Criar Evento"}
        </Button>
      </div>
    </form>
  );
}

function EventCard({ evento, onEdit }: { evento: TurboEvento; onEdit: () => void }) {
  const { toast } = useToast();
  const typeInfo = getEventTypeInfo(evento.tipo);
  const TypeIcon = typeInfo.icon;
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/calendario/eventos/${evento.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendario/eventos"] });
      toast({ title: "Evento excluído" });
    },
  });
  
  const eventDate = parseISO(evento.dataInicio);
  
  return (
    <Card className="hover-elevate cursor-pointer group" data-testid={`card-evento-${evento.id}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${evento.cor || typeInfo.color}20` }}
          >
            <TypeIcon className="w-5 h-5" style={{ color: evento.cor || typeInfo.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm truncate" data-testid={`text-evento-titulo-${evento.id}`}>
                {evento.titulo}
              </h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    data-testid={`button-evento-menu-${evento.id}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit} data-testid={`button-editar-evento-${evento.id}`}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => deleteMutation.mutate()} 
                    className="text-red-600"
                    data-testid={`button-excluir-evento-${evento.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{format(eventDate, "HH:mm", { locale: ptBR })}</span>
              {evento.local && (
                <>
                  <MapPin className="w-3 h-3 ml-2" />
                  <span className="truncate">{evento.local}</span>
                </>
              )}
            </div>
            <Badge 
              variant="outline" 
              className="mt-2 text-[10px]"
              style={{ borderColor: evento.cor || typeInfo.color, color: evento.cor || typeInfo.color }}
            >
              {typeInfo.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Calendario() {
  usePageTitle("Calendário");
  const { setPageInfo } = usePageInfo();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<TurboEvento | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  
  useEffect(() => {
    setPageInfo("Calendário Turbo", "Eventos, confraternizações e reuniões");
  }, [setPageInfo]);
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const { data: eventos = [], isLoading } = useQuery<TurboEvento[]>({
    queryKey: ["/api/calendario/eventos", format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
  });
  
  const filteredEventos = useMemo(() => {
    if (filterType === "all") return eventos;
    return eventos.filter((e) => e.tipo === filterType);
  }, [eventos, filterType]);
  
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const daysArray = eachDayOfInterval({ start, end });
    
    const startDayOfWeek = start.getDay();
    const prefixDays = Array(startDayOfWeek).fill(null);
    
    return [...prefixDays, ...daysArray];
  }, [currentMonth]);
  
  const getEventsForDay = (day: Date) => {
    return filteredEventos.filter((e) => isSameDay(parseISO(e.dataInicio), day));
  };
  
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];
  
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  
  const handleDayClick = (day: Date | null) => {
    if (day) setSelectedDay(day);
  };
  
  const handleAddEvent = () => {
    setEditingEvento(null);
    setIsDialogOpen(true);
  };
  
  const handleEditEvent = (evento: TurboEvento) => {
    setEditingEvento(evento);
    setIsDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEvento(null);
  };
  
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    return filteredEventos
      .filter((e) => parseISO(e.dataInicio) >= today)
      .sort((a, b) => parseISO(a.dataInicio).getTime() - parseISO(b.dataInicio).getTime())
      .slice(0, 5);
  }, [filteredEventos]);
  
  const eventTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    eventos.forEach((e) => {
      counts[e.tipo] = (counts[e.tipo] || 0) + 1;
    });
    return counts;
  }, [eventos]);

  return (
    <div className="p-6 space-y-6" data-testid="page-calendario">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Calendário Turbo</h1>
          <p className="text-muted-foreground text-sm">Eventos, confraternizações e reuniões da equipe</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddEvent} data-testid="button-novo-evento">
              <Plus className="w-4 h-4 mr-2" />
              Novo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingEvento ? "Editar Evento" : "Novo Evento"}</DialogTitle>
            </DialogHeader>
            <EventForm 
              evento={editingEvento || undefined} 
              onClose={handleCloseDialog} 
              selectedDate={selectedDay || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filterType === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("all")}
          data-testid="filter-all"
        >
          Todos ({eventos.length})
        </Button>
        {EVENT_TYPES.map((t) => (
          <Button
            key={t.value}
            variant={filterType === t.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(t.value)}
            className="gap-2"
            data-testid={`filter-${t.value}`}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label} ({eventTypeCounts[t.value] || 0})
          </Button>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg capitalize" data-testid="text-current-month">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handlePrevMonth} data-testid="button-prev-month">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleNextMonth} data-testid="button-next-month">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              
              {isLoading ? (
                Array(35).fill(0).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))
              ) : (
                days.map((day, i) => {
                  if (!day) {
                    return <div key={`empty-${i}`} className="aspect-square" />;
                  }
                  
                  const dayEvents = getEventsForDay(day);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const isCurrentDay = isToday(day);
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDayClick(day)}
                      className={`aspect-square p-1 rounded-md text-sm transition-colors relative flex flex-col items-center justify-start hover-elevate ${
                        isSelected 
                          ? "bg-primary text-primary-foreground" 
                          : isCurrentDay
                            ? "bg-accent"
                            : "hover:bg-muted"
                      } ${!isSameMonth(day, currentMonth) ? "text-muted-foreground" : ""}`}
                      data-testid={`day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <span className={`${isCurrentDay && !isSelected ? "font-bold" : ""}`}>
                        {format(day, "d")}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                          {dayEvents.slice(0, 3).map((e) => (
                            <div
                              key={e.id}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: e.cor || getEventTypeInfo(e.tipo).color }}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                {selectedDay 
                  ? format(selectedDay, "d 'de' MMMM", { locale: ptBR })
                  : "Selecione um dia"
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDay ? (
                selectedDayEvents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDayEvents.map((evento) => (
                      <EventCard 
                        key={evento.id} 
                        evento={evento} 
                        onEdit={() => handleEditEvent(evento)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum evento neste dia
                  </p>
                )
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Clique em um dia para ver os eventos
                </p>
              )}
              
              {selectedDay && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={handleAddEvent}
                  data-testid="button-add-event-day"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar evento
                </Button>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Próximos Eventos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : upcomingEvents.length > 0 ? (
                <div className="space-y-2">
                  {upcomingEvents.map((evento) => {
                    const typeInfo = getEventTypeInfo(evento.tipo);
                    const TypeIcon = typeInfo.icon;
                    const eventDate = parseISO(evento.dataInicio);
                    
                    return (
                      <div 
                        key={evento.id} 
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedDay(eventDate);
                          setCurrentMonth(eventDate);
                        }}
                        data-testid={`upcoming-${evento.id}`}
                      >
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${evento.cor || typeInfo.color}20` }}
                        >
                          <TypeIcon className="w-4 h-4" style={{ color: evento.cor || typeInfo.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{evento.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(eventDate, "d MMM", { locale: ptBR })} às {format(eventDate, "HH:mm")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum evento futuro
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
