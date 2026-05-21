import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCreativeOptions,
  useCreateCreative,
  useUpdateCreative,
  useDeleteCreative,
  type Creative,
  type CreativePayload,
} from "@/hooks/useCreatives";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  creative: Creative | null;
  onClose: () => void;
}

const EMPTY: CreativePayload = {
  nomeDrive: "",
  linkDrive: "",
  driveFileId: "",
  angulo: "",
  etapaFunil: "",
  dataPostagem: "",
  produto: "",
  plataforma: "",
  personagem: "",
  tipoAd: "",
  observacao: "",
  adValidado: false,
};

function extractFileIdFromDriveLink(link: string): string {
  if (!link) return "";
  const m1 = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return "";
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function buildNomeFinalPreview(tpId: string, p: CreativePayload): string {
  return [tpId, p.nomeDrive, formatDateBr(p.dataPostagem || null)]
    .filter(Boolean)
    .join(" - ");
}

export function CreativeFormSheet({ open, mode, creative, onClose }: Props) {
  const { toast } = useToast();
  const { data: options } = useCreativeOptions();
  const createMut = useCreateCreative();
  const updateMut = useUpdateCreative();
  const deleteMut = useDeleteCreative();

  const [form, setForm] = useState<CreativePayload>(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && creative) {
      setForm({
        nomeDrive: creative.nomeDrive,
        linkDrive: creative.linkDrive ?? "",
        driveFileId: creative.driveFileId ?? "",
        angulo: creative.angulo ?? "",
        etapaFunil: creative.etapaFunil ?? "",
        dataPostagem: creative.dataPostagem
          ? new Date(creative.dataPostagem).toISOString().slice(0, 10)
          : "",
        produto: creative.produto ?? "",
        plataforma: creative.plataforma ?? "",
        personagem: creative.personagem ?? "",
        tipoAd: creative.tipoAd ?? "",
        observacao: creative.observacao ?? "",
        adValidado: creative.adValidado ?? false,
      });
    } else {
      setForm({ ...EMPTY, dataPostagem: todayIso() });
    }
  }, [open, mode, creative]);

  const update = <K extends keyof CreativePayload>(key: K, value: CreativePayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Auto-extract driveFileId quando o link muda
  useEffect(() => {
    const id = extractFileIdFromDriveLink(form.linkDrive ?? "");
    if (id && id !== form.driveFileId) {
      setForm((f) => ({ ...f, driveFileId: id }));
    }
  }, [form.linkDrive]);

  const previewTpId = mode === "edit" && creative ? creative.tpId : "TP??";
  const previewNomeFinal = useMemo(
    () => buildNomeFinalPreview(previewTpId, form),
    [previewTpId, form],
  );

  const isSaving = createMut.isPending || updateMut.isPending;
  const isDeleting = deleteMut.isPending;

  const validate = (): string | null => {
    if (!form.nomeDrive?.trim()) return "Nome Drive é obrigatório";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Validação", description: err, variant: "destructive" });
      return;
    }
    const payload: CreativePayload = {
      ...form,
      nomeDrive: form.nomeDrive.trim(),
      linkDrive: form.linkDrive?.trim() || null,
      driveFileId: form.driveFileId?.trim() || null,
      angulo: form.angulo?.trim() || null,
      etapaFunil: form.etapaFunil?.trim() || null,
      dataPostagem: form.dataPostagem || null,
      produto: form.produto?.trim() || null,
      plataforma: form.plataforma?.trim() || null,
      personagem: form.personagem?.trim() || null,
      tipoAd: form.tipoAd?.trim() || null,
      observacao: form.observacao?.trim() || null,
    };
    try {
      if (mode === "edit" && creative) {
        await updateMut.mutateAsync({ id: creative.id, patch: payload });
        toast({ title: "Criativo atualizado" });
      } else {
        const created = await createMut.mutateAsync(payload);
        toast({ title: `Criativo criado: ${created.tpId}` });
      }
      onClose();
    } catch (e: any) {
      toast({
        title: "Erro ao salvar",
        description: e.message ?? String(e),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (mode !== "edit" || !creative) return;
    if (!confirm(`Apagar criativo ${creative.tpId}? Será marcado como excluído (soft delete).`)) {
      return;
    }
    try {
      await deleteMut.mutateAsync(creative.id);
      toast({ title: "Criativo apagado" });
      onClose();
    } catch (e: any) {
      toast({
        title: "Erro ao apagar",
        description: e.message ?? String(e),
        variant: "destructive",
      });
    }
  };

  // Helper p/ select com autocomplete + opção "outro"
  const optionSelect = (
    label: string,
    field: keyof CreativePayload,
    items: string[],
  ) => {
    const value = (form[field] as string) ?? "";
    const isCustom = value && !items.includes(value);
    return (
      <div className="space-y-1">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Select
            value={isCustom ? "__custom__" : value || "__none__"}
            onValueChange={(v) => {
              if (v === "__none__") update(field, "" as any);
              else if (v === "__custom__") update(field, " " as any);
              else update(field, v as any);
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={`Selecione ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Vazio —</SelectItem>
              {items.map((it) => (
                <SelectItem key={it} value={it}>
                  {it}
                </SelectItem>
              ))}
              <SelectItem value="__custom__">+ Novo valor...</SelectItem>
            </SelectContent>
          </Select>
          {(isCustom || value === " ") && (
            <Input
              className="flex-1"
              placeholder="Digite novo valor"
              value={value === " " ? "" : value}
              onChange={(e) => update(field, e.target.value as any)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSaving && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? `Editar criativo ${creative?.tpId}` : "Novo criativo"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Edite os campos abaixo. O Nome Final é regenerado automaticamente."
              : "Cadastre um novo criativo na biblioteca da Turbo."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Drive */}
          <div className="grid gap-2">
            <Label>Link do Drive</Label>
            <Input
              placeholder="https://drive.google.com/file/d/..."
              value={form.linkDrive ?? ""}
              onChange={(e) => update("linkDrive", e.target.value)}
            />
            <p className="text-xs text-gray-500">
              File ID detectado: {form.driveFileId || "—"}
            </p>
          </div>

          <div className="grid gap-2">
            <Label>
              Nome Drive <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="ex: vsl-novosclientes (sem extensão)"
              value={form.nomeDrive ?? ""}
              onChange={(e) => update("nomeDrive", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {optionSelect("Personagem", "personagem", options?.personagem ?? [])}
            {optionSelect("Produto", "produto", options?.produto ?? [])}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {optionSelect("Plataforma", "plataforma", options?.plataforma ?? [])}
            {optionSelect("Tipo de AD", "tipoAd", options?.tipoAd ?? [])}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <Label>Ângulo</Label>
              <Input
                value={form.angulo ?? ""}
                onChange={(e) => update("angulo", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Data Postagem</Label>
              <Input
                type="date"
                value={form.dataPostagem ?? ""}
                onChange={(e) => update("dataPostagem", e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox
                id="adValidado"
                checked={form.adValidado ?? false}
                onCheckedChange={(v) => update("adValidado", v === true)}
              />
              <Label htmlFor="adValidado">Ad validado</Label>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Observação</Label>
            <Textarea
              rows={2}
              value={form.observacao ?? ""}
              onChange={(e) => update("observacao", e.target.value)}
            />
          </div>

          {/* Preview Nome Final */}
          <div className="rounded-md bg-gray-100 dark:bg-zinc-800 p-3 space-y-1">
            <p className="text-xs text-gray-600 dark:text-zinc-400 uppercase tracking-wide">
              Nome Final (gerado automaticamente)
            </p>
            <p className="font-mono text-sm break-all">{previewNomeFinal || "—"}</p>
            {mode === "create" && (
              <p className="text-xs text-gray-500">
                O ID TP definitivo é atribuído ao salvar.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-between sm:justify-between">
          {mode === "edit" ? (
            <Button
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Apagar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "edit" ? "Salvar alterações" : "Criar criativo"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
