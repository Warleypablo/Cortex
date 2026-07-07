import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResponsaveisDisponiveis } from "../hooks";

interface CelulaResponsavelProps {
  metricaKey: string;
  /** Dono automático calculado a partir dos dados (ex.: squad de churn). Quando presente,
     a célula é somente-leitura — não faz sentido sobrescrever um dado derivado. */
  responsavelAuto?: string;
  /** Última atribuição manual salva (GET /api/scorecard/responsaveis), quando a métrica
     não tem dono automático. */
  responsavelManual?: string | null;
  /** Disparado ao escolher um responsável no dropdown. A persistência (PUT, Task 3's
     useSalvarResponsaveis) é responsabilidade do componente pai. */
  onEditResponsavel: (metricaKey: string, valor: string) => void;
}

/** Célula "Responsável" do Scorecard (coluna do modo foco). Duas situações:
   1. Métrica com dono automático → texto simples, não editável.
   2. Sem dono automático → texto clicável que vira um <Select> com os responsáveis reais
      (carteira de contratos ativos, `GET /api/capacity-metas/responsaveis`); ao escolher,
      fecha o editor e propaga a escolha via `onEditResponsavel`. */
export function CelulaResponsavel({ metricaKey, responsavelAuto, responsavelManual, onEditResponsavel }: CelulaResponsavelProps) {
  const [editando, setEditando] = useState(false);
  const { data: opcoes } = useResponsaveisDisponiveis();

  if (responsavelAuto) {
    return <span className="text-sm text-muted-foreground" data-testid={`text-responsavel-auto-${metricaKey}`}>{responsavelAuto}</span>;
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="text-left text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        data-testid={`button-editar-responsavel-${metricaKey}`}
      >
        {responsavelManual || "— definir"}
      </button>
    );
  }

  return (
    <Select
      defaultOpen
      value={responsavelManual ?? undefined}
      onValueChange={(valor) => {
        onEditResponsavel(metricaKey, valor);
        setEditando(false);
      }}
      onOpenChange={(aberto) => { if (!aberto) setEditando(false); }}
    >
      <SelectTrigger className="h-7 w-[170px] text-xs" data-testid={`select-responsavel-${metricaKey}`}>
        <SelectValue placeholder="Selecionar…" />
      </SelectTrigger>
      <SelectContent>
        {(opcoes ?? []).map((r) => (
          <SelectItem key={r.responsavel} value={r.responsavel}>{r.responsavel}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
