import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  usePatchProposal,
  type OptimizationProposal,
} from "@/hooks/useAdsOptimization";

interface AdSetOption {
  adsetId: string;
  adsetName: string;
}
interface AdOption {
  adId: string;
  adName: string;
  adsetId: string;
}

interface Props {
  proposal: OptimizationProposal;
  open: boolean;
  onClose: () => void;
}

const ENTITY_LABEL: Record<"campaign" | "adset" | "ad", string> = {
  campaign: "Campanha",
  adset: "Ad Set",
  ad: "Anúncio",
};

export function EditProposalSheet({ proposal, open, onClose }: Props) {
  const isCampaignProposal = proposal.proposedEntityType === "campaign";

  const [action, setAction] = useState<"pause" | "reactivate" | "skip">(
    proposal.proposedAction,
  );
  const [entityType, setEntityType] = useState<"campaign" | "adset" | "ad">(
    proposal.proposedEntityType,
  );
  const [entityId, setEntityId] = useState<string>(proposal.proposedEntityId);
  const [entityName, setEntityName] = useState<string>(
    proposal.proposedEntityName ?? proposal.proposedEntityId,
  );
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      setAction(proposal.proposedAction);
      setEntityType(proposal.proposedEntityType);
      setEntityId(proposal.proposedEntityId);
      setEntityName(proposal.proposedEntityName ?? proposal.proposedEntityId);
      setNotes("");
    }
  }, [open, proposal]);

  // Carrega ad sets da campanha quando o usuário quer descer o nível.
  const { data: adsets } = useQuery<AdSetOption[]>({
    queryKey: [
      "/api/meta-ads/adsets",
      { campaignId: isCampaignProposal ? proposal.proposedEntityId : "" },
    ],
    enabled: open && isCampaignProposal,
  });

  const [selectedAdsetForAds, setSelectedAdsetForAds] = useState<string | null>(
    null,
  );
  const { data: ads } = useQuery<AdOption[]>({
    queryKey: ["/api/meta-ads/ads", { adsetId: selectedAdsetForAds ?? "" }],
    enabled: open && !!selectedAdsetForAds,
  });

  const patchMutation = usePatchProposal();

  function handleSave() {
    patchMutation.mutate(
      {
        id: proposal.id,
        batchId: proposal.batchId,
        status: "edited",
        finalEntityType: entityType,
        finalEntityId: entityId,
        finalEntityName: entityName,
        finalAction: action,
        editNotes: notes || undefined,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar proposta</DialogTitle>
          <DialogDescription>
            Ajuste a ação ou troque a entidade alvo (ex: descer da campanha
            para um ad set específico).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm">Ação</Label>
            <Select
              value={action}
              onValueChange={(v) =>
                setAction(v as "pause" | "reactivate" | "skip")
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pause">Pausar</SelectItem>
                <SelectItem value="skip">
                  Pular (aprovado mas não executa)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Entidade alvo</Label>
            <div className="mt-1 rounded-md border border-border bg-muted/40 p-2 text-sm">
              <div className="font-medium">
                {ENTITY_LABEL[entityType]}: {entityName}
              </div>
              <div className="text-muted-foreground text-xs">
                ID: {entityId}
              </div>
            </div>

            {isCampaignProposal && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Para descer o nível da ação, escolha um ad set ou ad
                  específico abaixo.
                </p>
                <Select
                  value={
                    entityType === "adset" || entityType === "ad"
                      ? entityId
                      : ""
                  }
                  onValueChange={(v) => {
                    const found = adsets?.find((a) => a.adsetId === v);
                    if (found) {
                      setEntityType("adset");
                      setEntityId(v);
                      setEntityName(found.adsetName);
                      setSelectedAdsetForAds(v);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar ad set..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(adsets ?? []).map((a) => (
                      <SelectItem key={a.adsetId} value={a.adsetId}>
                        {a.adsetName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedAdsetForAds && (ads ?? []).length > 0 && (
                  <Select
                    onValueChange={(v) => {
                      const found = ads?.find((x) => x.adId === v);
                      if (found) {
                        setEntityType("ad");
                        setEntityId(v);
                        setEntityName(found.adName);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="(opcional) selecionar ad específico..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(ads ?? []).map((x) => (
                        <SelectItem key={x.adId} value={x.adId}>
                          {x.adName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm">Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Por que você editou? (registrado no histórico)"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={patchMutation.isPending}>
            {patchMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Salvar edição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
