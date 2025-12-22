import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Course, InsertCourse } from "@shared/schema";
import { insertCourseSchema, courseStatusEnum } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Search, Plus, Eye, EyeOff, Copy, Edit, Trash2, ExternalLink, Loader2, ChevronDown, ChevronRight, GraduationCap, BookOpen } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  ativo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  vitalicio: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cancelado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  sem_status: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  vitalicio: "Vitalício",
  cancelado: "Cancelado",
  sem_status: "Sem Status",
};

function AddCourseDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertCourse>({
    resolver: zodResolver(insertCourseSchema),
    defaultValues: {
      nome: "",
      status: "sem_status",
      temaPrincipal: "",
      plataforma: "",
      url: "",
      login: "",
      senha: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCourse) => {
      const response = await apiRequest("POST", "/api/conhecimentos", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimentos"] });
      toast({
        title: "Curso adicionado",
        description: "O curso foi adicionado com sucesso.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar curso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCourse) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-course">
          <Plus className="w-4 h-4 mr-2" />
          Novo Curso
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Curso</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo curso. O campo Nome é obrigatório.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-course-nome" placeholder="Nome do curso" />
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
                  <Select onValueChange={field.onChange} value={field.value || "sem_status"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-course-status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {courseStatusEnum.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabels[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="temaPrincipal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tema Principal</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-course-tema" placeholder="Ex: Marketing Digital" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="plataforma"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plataforma</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-course-plataforma" placeholder="Ex: Hotmart, Udemy" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de Acesso</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-course-url" placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Login</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-course-login" placeholder="Email ou usuário" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="senha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} type="password" data-testid="input-course-senha" placeholder="Senha de acesso" />
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
                data-testid="button-cancel-course"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-course"
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

function EditCourseDialog({
  course,
  open,
  onOpenChange,
}: {
  course: Course;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<InsertCourse>({
    resolver: zodResolver(insertCourseSchema),
    defaultValues: {
      nome: course.nome || "",
      status: course.status || "sem_status",
      temaPrincipal: course.temaPrincipal || "",
      plataforma: course.plataforma || "",
      url: course.url || "",
      login: course.login || "",
      senha: course.senha || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertCourse) => {
      const response = await apiRequest("PATCH", `/api/conhecimentos/${course.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimentos"] });
      toast({
        title: "Curso atualizado",
        description: "O curso foi atualizado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar curso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCourse) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Curso</DialogTitle>
          <DialogDescription>
            Atualize as informações do curso {course.nome}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-course-nome" />
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
                  <Select onValueChange={field.onChange} value={field.value || "sem_status"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-course-status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {courseStatusEnum.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabels[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="temaPrincipal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tema Principal</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-course-tema" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="plataforma"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plataforma</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-course-plataforma" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de Acesso</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-course-url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Login</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-course-login" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="senha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} type="password" data-testid="input-edit-course-senha" />
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
                data-testid="button-cancel-edit-course"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-submit-edit-course"
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

function CourseCard({
  course,
  onEdit,
  onDelete,
}: {
  course: Course;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

  return (
    <Card
      className="hover-elevate cursor-pointer"
      data-testid={`card-course-${course.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GraduationCap className="w-5 h-5 text-muted-foreground shrink-0" />
            <CardTitle className="text-base truncate">{course.nome}</CardTitle>
          </div>
          <Badge className={statusColors[course.status || "sem_status"]} variant="secondary">
            {statusLabels[course.status || "sem_status"]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {course.temaPrincipal && (
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {course.temaPrincipal}
            </span>
          )}
          {course.plataforma && (
            <Badge variant="outline" className="text-xs">
              {course.plataforma}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-course-${course.id}`}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 mr-1" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-1" />
            )}
            Credenciais
          </Button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              data-testid={`button-edit-course-${course.id}`}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              data-testid={`button-delete-course-${course.id}`}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="pt-2 border-t space-y-2">
            {course.url && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">URL:</span>
                <a
                  href={course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                  data-testid={`link-course-url-${course.id}`}
                >
                  Acessar <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {course.login && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Login:</span>
                <div className="flex items-center gap-1">
                  <span data-testid={`text-course-login-${course.id}`}>{course.login}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(course.login!, "Login")}
                    data-testid={`button-copy-login-${course.id}`}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
            {course.senha && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Senha:</span>
                <div className="flex items-center gap-1">
                  <span data-testid={`text-course-senha-${course.id}`}>
                    {showPassword ? course.senha : "••••••••"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid={`button-toggle-senha-${course.id}`}
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(course.senha!, "Senha")}
                    data-testid={`button-copy-senha-${course.id}`}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Conhecimentos() {
  useSetPageInfo("Conhecimentos", "Gerenciamento de cursos e formações");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [temaFilter, setTemaFilter] = useState<string>("all");
  const [plataformaFilter, setPlataformaFilter] = useState<string>("all");
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  const { toast } = useToast();

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["/api/conhecimentos"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/conhecimentos/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimentos"] });
      toast({
        title: "Curso excluído",
        description: "O curso foi excluído com sucesso.",
      });
      setDeletingCourse(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir curso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uniqueTemas = useMemo(() => {
    const temas = new Set(courses.map((c) => c.temaPrincipal).filter(Boolean));
    return Array.from(temas).sort();
  }, [courses]);

  const uniquePlataformas = useMemo(() => {
    const plataformas = new Set(courses.map((c) => c.plataforma).filter(Boolean));
    return Array.from(plataformas).sort();
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        !search ||
        course.nome?.toLowerCase().includes(search.toLowerCase()) ||
        course.temaPrincipal?.toLowerCase().includes(search.toLowerCase()) ||
        course.plataforma?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || course.status === statusFilter;
      const matchesTema = temaFilter === "all" || course.temaPrincipal === temaFilter;
      const matchesPlataforma = plataformaFilter === "all" || course.plataforma === plataformaFilter;

      return matchesSearch && matchesStatus && matchesTema && matchesPlataforma;
    });
  }, [courses, search, statusFilter, temaFilter, plataformaFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-courses">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cursos..."
              className="pl-9 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-courses"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {courseStatusEnum.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={temaFilter} onValueChange={setTemaFilter}>
            <SelectTrigger className="w-40" data-testid="select-filter-tema">
              <SelectValue placeholder="Tema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Temas</SelectItem>
              {uniqueTemas.map((tema) => (
                <SelectItem key={tema} value={tema!}>
                  {tema}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={plataformaFilter} onValueChange={setPlataformaFilter}>
            <SelectTrigger className="w-40" data-testid="select-filter-plataforma">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Plataformas</SelectItem>
              {uniquePlataformas.map((plataforma) => (
                <SelectItem key={plataforma} value={plataforma!}>
                  {plataforma}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AddCourseDialog />
      </div>

      {filteredCourses.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-courses">
          <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Nenhum curso encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search || statusFilter !== "all" || temaFilter !== "all" || plataformaFilter !== "all"
              ? "Tente ajustar os filtros"
              : "Adicione seu primeiro curso clicando no botão acima"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={() => setEditingCourse(course)}
              onDelete={() => setDeletingCourse(course)}
            />
          ))}
        </div>
      )}

      {editingCourse && (
        <EditCourseDialog
          course={editingCourse}
          open={!!editingCourse}
          onOpenChange={(open) => !open && setEditingCourse(null)}
        />
      )}

      <AlertDialog open={!!deletingCourse} onOpenChange={(open) => !open && setDeletingCourse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Curso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o curso "{deletingCourse?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-course">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCourse && deleteMutation.mutate(deletingCourse.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-course"
            >
              {deleteMutation.isPending ? (
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
