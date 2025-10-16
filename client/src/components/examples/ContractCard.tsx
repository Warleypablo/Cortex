import ContractCard from '../ContractCard';

export default function ContractCardExample() {
  return (
    <ContractCard
      module="Design Services"
      service="Criação de artes e layouts"
      type="Recorrente"
      value={5200}
      startDate="2024-06-04"
    />
  );
}