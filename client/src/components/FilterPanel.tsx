import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface FilterPanelProps {
  selectedSquads: string[];
  selectedServices: string[];
  onSquadChange: (squad: string, checked: boolean) => void;
  onServiceChange: (service: string, checked: boolean) => void;
  onClearFilters: () => void;
}

export default function FilterPanel({
  selectedSquads,
  selectedServices,
  onSquadChange,
  onServiceChange,
  onClearFilters
}: FilterPanelProps) {
  const squads = [
    { id: "Performance", label: "Performance", emoji: "📊" },
    { id: "Comunicação", label: "Comunicação", emoji: "💬" },
    { id: "Tech", label: "Tech", emoji: "💻" }
  ];

  const services = [
    { id: "Performance", label: "Performance", emoji: "📊" },
    { id: "Comunicação", label: "Comunicação", emoji: "💬" },
    { id: "Tech", label: "Tech", emoji: "💻" }
  ];

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-4">Filtrar por Squad</h3>
          <div className="space-y-3">
            {squads.map((squad) => (
              <div key={squad.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`squad-${squad.id}`}
                  checked={selectedSquads.includes(squad.id)}
                  onCheckedChange={(checked) => onSquadChange(squad.id, checked as boolean)}
                  data-testid={`filter-squad-${squad.id}`}
                />
                <Label
                  htmlFor={`squad-${squad.id}`}
                  className="text-sm font-normal cursor-pointer flex items-center gap-2"
                >
                  <span>{squad.emoji}</span>
                  {squad.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4">Filtrar por Serviços</h3>
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`service-${service.id}`}
                  checked={selectedServices.includes(service.id)}
                  onCheckedChange={(checked) => onServiceChange(service.id, checked as boolean)}
                  data-testid={`filter-service-${service.id}`}
                />
                <Label
                  htmlFor={`service-${service.id}`}
                  className="text-sm font-normal cursor-pointer flex items-center gap-2"
                >
                  <span>{service.emoji}</span>
                  {service.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={onClearFilters}
            data-testid="button-clear-filters"
          >
            Limpar Filtros
          </Button>
        </div>
      </div>
    </Card>
  );
}