import ClientsTable from '../ClientsTable';

export default function ClientsTableExample() {
  const mockClients = [
    {
      id: "1",
      name: "Ensinando Tecnologia e Intermediação Ltda",
      squad: "Performance" as const,
      services: ["Performance" as const, "Comunicação" as const, "Tech" as const],
      ltv: 43400,
      status: "active" as const,
      startDate: "2024-06-04"
    },
    {
      id: "2",
      name: "Tech Solutions Brasil",
      squad: "Tech" as const,
      services: ["Tech" as const, "Performance" as const],
      ltv: 65000,
      status: "active" as const,
      startDate: "2024-03-15"
    },
    {
      id: "3",
      name: "Marketing Pro Agency",
      squad: "Comunicação" as const,
      services: ["Comunicação" as const],
      ltv: 28500,
      status: "active" as const,
      startDate: "2024-08-20"
    }
  ];

  return (
    <ClientsTable 
      clients={mockClients}
      onClientClick={(id) => console.log('Cliente clicado:', id)}
    />
  );
}