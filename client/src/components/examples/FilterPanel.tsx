import { useState } from 'react';
import FilterPanel from '../FilterPanel';

export default function FilterPanelExample() {
  const [selectedSquads, setSelectedSquads] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleSquadChange = (squad: string, checked: boolean) => {
    if (checked) {
      setSelectedSquads([...selectedSquads, squad]);
    } else {
      setSelectedSquads(selectedSquads.filter(s => s !== squad));
    }
  };

  const handleServiceChange = (service: string, checked: boolean) => {
    if (checked) {
      setSelectedServices([...selectedServices, service]);
    } else {
      setSelectedServices(selectedServices.filter(s => s !== service));
    }
  };

  const handleClearFilters = () => {
    setSelectedSquads([]);
    setSelectedServices([]);
  };

  return (
    <FilterPanel
      selectedSquads={selectedSquads}
      selectedServices={selectedServices}
      onSquadChange={handleSquadChange}
      onServiceChange={handleServiceChange}
      onClearFilters={handleClearFilters}
    />
  );
}