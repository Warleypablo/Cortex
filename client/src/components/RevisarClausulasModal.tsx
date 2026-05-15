import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pencil, X, Check, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ClausulaTexto {
  index: number;
  titulo: string;
  texto: string;
}

interface RevisarClausulasModalProps {
  contratoId: number | null;
  creatorNome: string;
  open: boolean;
  onClose: () => void;
  onConfirmar: (clausulasEditadas: Record<number, string>) => void;
  isPending: boolean;
}

export function RevisarClausulasModal({
  contratoId,
  creatorNome,
  open,
  onClose,
  onConfirmar,
  isPending,
}: RevisarClausulasModalProps) {
  const [textosEditados, setTextosEditados] = useState<Record<number, string>>({});
  const [clausulaEditando, setClausulaEditando] = useState<number | null>(null);
  const [textoRascunho, setTextoRascunho] = useState("");

  const { data: clausulas = [], isLoading } = useQuery<ClausulaTexto[]>({
    queryKey: ["/api/creators/contratos", contratoId, "clausulas"],
    queryFn: async () => {
      const res = await fetch(`/api/creators/contratos/${contratoId}/clausulas`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar cláusulas");
      return res.json();
    },
    enabled: open && contratoId !== null,
  });

  const iniciarEdicao = (clausula: ClausulaTexto) => {
    setClausulaEditando(clausula.index);
    setTextoRascunho(textosEditados[clausula.index] ?? clausula.texto);
  };

  const salvarEdicao = (index: number) => {
    setTextosEditados(prev => ({ ...prev, [index]: textoRascunho }));
    setClausulaEditando(null);
  };

  const cancelarEdicao = () => {
    setClausulaEditando(null);
    setTextoRascunho("");
  };

  const handleConfirmar = () => {
    onConfirmar(textosEditados);
  };

  const handleClose = () => {
    setTextosEditados({});
    setClausulaEditando(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Revisar Cláusulas — {creatorNome}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {clausulas.map((clausula) => {
                const editado = clausulaEditando !== clausula.index && textosEditados[clausula.index] !== undefined;
                const emEdicao = clausulaEditando === clausula.index;

                return (
                  <AccordionItem key={clausula.index} value={String(clausula.index)}>
                    <AccordionTrigger className="text-sm font-medium text-left gap-2">
                      <span className="flex-1 text-left">{clausula.titulo}</span>
                      {editado && (
                        <Badge variant="secondary" className="text-xs shrink-0 mr-2">
                          Editada
                        </Badge>
                      )}
                    </AccordionTrigger>
                    <AccordionContent>
                      {emEdicao ? (
                        <div className="space-y-2">
                          <Textarea
                            value={textoRascunho}
                            onChange={(e) => setTextoRascunho(e.target.value)}
                            rows={10}
                            className="text-sm font-mono resize-y"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelarEdicao}
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => salvarEdicao(clausula.index)}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Salvar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {textosEditados[clausula.index] ?? clausula.texto}
                          </p>
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => iniciarEdicao(clausula)}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>

        <DialogFooter className="border-t pt-4 mt-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={isPending || isLoading}>
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Confirmar e Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
