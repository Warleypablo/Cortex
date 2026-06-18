import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Células editáveis na própria tabela da Biblioteca de Criativos.
// Cada célula commita a mudança (onBlur / onValueChange) sem abrir modal.

const INVISIVEL =
  "h-8 border-transparent bg-transparent shadow-none hover:border-input focus:border-input px-2";

export function InlineText({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string | null | undefined;
  onCommit: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);

  const commit = () => {
    const next = draft.trim();
    if (next !== (value ?? "")) onCommit(next === "" ? null : next);
  };

  return (
    <Input
      value={draft}
      placeholder={placeholder ?? "—"}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value ?? "");
          e.currentTarget.blur();
        }
      }}
      className={cn(INVISIVEL, className)}
    />
  );
}

const EMPTY = "__none__";

export function InlineSelect({
  value,
  options,
  onCommit,
  placeholder,
  className,
}: {
  value: string | null | undefined;
  options: string[];
  onCommit: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select
      value={value || EMPTY}
      onValueChange={(v) => onCommit(v === EMPTY ? null : v)}
    >
      <SelectTrigger className={cn(INVISIVEL, "text-sm", className)}>
        <SelectValue placeholder={placeholder ?? "—"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY}>—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function toInputDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function InlineDate({
  value,
  onCommit,
  className,
}: {
  value: string | Date | null | undefined;
  onCommit: (v: string | null) => void;
  className?: string;
}) {
  const iso = toInputDate(value);
  const [draft, setDraft] = useState(iso);
  useEffect(() => setDraft(iso), [iso]);

  const commit = () => {
    if (draft !== iso) onCommit(draft === "" ? null : draft);
  };

  return (
    <Input
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      className={cn(INVISIVEL, "w-[140px]", className)}
    />
  );
}

export function InlineValidado({
  value,
  onCommit,
}: {
  value: boolean | null | undefined;
  onCommit: (v: boolean) => void;
}) {
  const validado = !!value;
  return (
    <button type="button" onClick={() => onCommit(!validado)} title="Clique pra alternar">
      {validado ? (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 cursor-pointer">
          Validado
        </Badge>
      ) : (
        <Badge variant="outline" className="cursor-pointer">
          Pendente
        </Badge>
      )}
    </button>
  );
}
