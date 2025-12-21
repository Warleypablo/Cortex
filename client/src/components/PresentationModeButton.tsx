import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tv, Play } from "lucide-react";
import { useLocation } from "wouter";

const DASHBOARDS = [
  { id: "closers", label: "Closers", description: "Ranking e métricas de closers" },
  { id: "sdrs", label: "SDRs", description: "Ranking e métricas de SDRs" },
];

export default function PresentationModeButton() {
  const [open, setOpen] = useState(false);
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>(["closers", "sdrs"]);
  const [rotationInterval, setRotationInterval] = useState("30");
  const [, setLocation] = useLocation();

  const handleStart = () => {
    sessionStorage.setItem("presentationConfig", JSON.stringify({
      dashboards: selectedDashboards,
      interval: parseInt(rotationInterval) * 1000
    }));
    setOpen(false);
    setLocation("/dashboard/comercial/apresentacao");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-presentation-mode">
          <Tv className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modo Apresentação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">Dashboards para exibir:</label>
            {DASHBOARDS.map(d => (
              <div key={d.id} className="flex items-start space-x-3">
                <Checkbox
                  id={`dashboard-${d.id}`}
                  checked={selectedDashboards.includes(d.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedDashboards([...selectedDashboards, d.id]);
                    } else {
                      setSelectedDashboards(selectedDashboards.filter(id => id !== d.id));
                    }
                  }}
                  data-testid={`checkbox-dashboard-${d.id}`}
                />
                <div className="grid gap-0.5 leading-none">
                  <label htmlFor={`dashboard-${d.id}`} className="text-sm font-medium cursor-pointer">
                    {d.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Intervalo de rotação:</label>
            <Select value={rotationInterval} onValueChange={setRotationInterval}>
              <SelectTrigger data-testid="select-rotation-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 segundos</SelectItem>
                <SelectItem value="20">20 segundos</SelectItem>
                <SelectItem value="30">30 segundos</SelectItem>
                <SelectItem value="60">1 minuto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleStart} 
            disabled={selectedDashboards.length === 0}
            className="w-full"
            data-testid="button-start-presentation"
          >
            <Play className="mr-2 h-4 w-4" />
            Iniciar Apresentação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
