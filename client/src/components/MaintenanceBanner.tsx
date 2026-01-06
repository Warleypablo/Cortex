import { useState, useEffect } from "react";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { onMaintenanceChange, MaintenanceInfo } from "@/lib/queryClient";

export function MaintenanceBanner() {
  const [maintenance, setMaintenance] = useState<MaintenanceInfo | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    const unsubscribe = onMaintenanceChange((info) => {
      setMaintenance(info);
    });

    // Also check status on mount
    fetch("/api/maintenance/status")
      .then(res => res.json())
      .then((data: MaintenanceInfo) => {
        if (data.isInMaintenance) {
          setMaintenance(data);
        }
      })
      .catch(() => {});

    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!maintenance?.isInMaintenance || !maintenance.remainingMinutes) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      if (!maintenance.remainingMinutes) return;
      
      const mins = Math.max(0, maintenance.remainingMinutes);
      if (mins <= 0) {
        setCountdown("em breve");
        // Try to reload after maintenance ends
        setTimeout(() => {
          window.location.reload();
        }, 30000);
      } else if (mins < 60) {
        setCountdown(`${mins} minuto${mins === 1 ? "" : "s"}`);
      } else {
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        setCountdown(`${hours}h ${remainingMins}min`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [maintenance]);

  if (!maintenance?.isInMaintenance) {
    return null;
  }

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] p-4 bg-background/95 backdrop-blur">
      <Alert variant="default" className="max-w-2xl mx-auto border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <AlertTitle className="text-amber-600 dark:text-amber-400 font-semibold">
          Sistema em Atualização
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="text-sm text-muted-foreground mb-3">
            {maintenance.message}
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>Janela: {maintenance.windowStart} - {maintenance.windowEnd}</span>
            </div>
            {countdown && (
              <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Retorna em: {countdown}
              </div>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleRefresh}
              className="ml-auto"
              data-testid="button-refresh-maintenance"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
