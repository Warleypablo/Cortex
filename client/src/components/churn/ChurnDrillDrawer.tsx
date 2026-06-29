import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils";
import { type ChurnContract } from "./types";
import { DrawerSubMotivo } from "./drawer/DrawerSubMotivo";
import { DrawerContratosTable } from "./drawer/DrawerContratosTable";
import { DrawerVozCliente } from "./drawer/DrawerVozCliente";
import { DrawerTiming } from "./drawer/DrawerTiming";

export interface ChurnDrillDrawerProps {
  open: boolean;
  titulo: string;
  contratos: ChurnContract[];
  onClose: () => void;
  onToggleAbono: (taskId: string, abonar: boolean) => void;
  pendingIds: Set<string>;
  abonadoOverrides: Record<string, boolean>;
}

type ActiveTab = "contratos" | "submotivo" | "voz" | "timing";

const TABS: { key: ActiveTab; label: string }[] = [
  { key: "contratos", label: "Contratos" },
  { key: "submotivo", label: "Submotivo" },
  { key: "voz", label: "Voz do Cliente" },
  { key: "timing", label: "Timing" },
];

export function ChurnDrillDrawer({
  open,
  titulo,
  contratos,
  onClose,
  onToggleAbono,
  pendingIds,
  abonadoOverrides,
}: ChurnDrillDrawerProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>("contratos");

  // Reset tab to "contratos" when the slice changes (titulo or open state)
  useEffect(() => {
    setActiveTab("contratos");
  }, [titulo, open]);

  const totalMrr = contratos.reduce((sum, c) => sum + (c.valorr ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-gray-900 dark:text-white text-lg font-semibold">
            {titulo}
          </SheetTitle>
          <SheetDescription className="text-gray-500 dark:text-zinc-400 text-sm">
            {contratos.length} contrato{contratos.length !== 1 ? "s" : ""}
            {" · "}
            MRR perdido:{" "}
            <span className="font-medium text-red-600 dark:text-red-400">
              {formatCurrency(totalMrr)}
            </span>
          </SheetDescription>
        </SheetHeader>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-zinc-700 mb-4 -mx-1 px-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-white border border-b-0 border-gray-200 dark:border-zinc-700 -mb-px"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Contratos */}
        {activeTab === "contratos" && (
          <DrawerContratosTable
            contratos={contratos}
            onToggleAbono={onToggleAbono}
            pendingIds={pendingIds}
            abonadoOverrides={abonadoOverrides}
          />
        )}

        {/* Tab: Submotivo — gráficos lado a lado e, abaixo, os contratos perdidos */}
        {activeTab === "submotivo" && (
          <div className="space-y-5">
            <DrawerSubMotivo contratos={contratos} />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Contratos perdidos
              </p>
              <DrawerContratosTable
                contratos={contratos}
                onToggleAbono={onToggleAbono}
                pendingIds={pendingIds}
                abonadoOverrides={abonadoOverrides}
              />
            </div>
          </div>
        )}

        {/* Tab: Voz do Cliente — AI query gated on tab being active AND drawer open */}
        {activeTab === "voz" && (
          <DrawerVozCliente
            contratos={contratos}
            enabled={open && activeTab === "voz"}
          />
        )}

        {/* Tab: Timing */}
        {activeTab === "timing" && (
          <DrawerTiming contratos={contratos} />
        )}
      </SheetContent>
    </Sheet>
  );
}
