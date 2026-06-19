import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreativeVocab, useUpsertVocab } from "@/hooks/useCreatives";

const KINDS: { value: string; label: string }[] = [
  { value: "angulo", label: "Ângulos (hook)" },
  { value: "produto", label: "Produtos" },
  { value: "persona", label: "Personas" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Tela de manutenção das listas controladas (vocabulário) que alimentam os dropdowns. */
export function VocabConfigDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState("angulo");
  const [label, setLabel] = useState("");
  const { data: vocab, isLoading } = useCreativeVocab();
  const upsert = useUpsertVocab();

  const items = vocab?.byKind?.[kind] ?? [];

  const add = async () => {
    const lbl = label.trim();
    if (!lbl) return;
    const value = slugify(lbl);
    if (!value) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({ kind, value, label: lbl, sortOrder: (items.length + 1) * 10 });
      setLabel("");
      toast({ title: `Adicionado: ${lbl}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Listas controladas (vocabulário)</DialogTitle>
          <DialogDescription>
            Essas listas alimentam os dropdowns do criativo e o ranking de inteligência. Edite
            conforme aprende — começou semeada, refina com o tempo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Lista</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!isLoading && items.length === 0 && (
              <span className="text-sm text-muted-foreground">Lista vazia.</span>
            )}
            {items.map((it) => (
              <Badge key={it.id} variant="secondary" className="text-sm">
                {it.label}
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{it.value}</span>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Novo valor (ex: Prova social)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add} disabled={upsert.isPending || !label.trim()}>
              {upsert.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
          {label.trim() && (
            <p className="text-xs text-muted-foreground">
              Slug: <code>{slugify(label)}</code>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
