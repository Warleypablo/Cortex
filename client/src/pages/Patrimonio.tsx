export default function Patrimonio() {
  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Patrimônio</h1>
          <p className="text-muted-foreground">Gerencie o patrimônio da empresa</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-8">
          <div className="text-center text-muted-foreground">
            <p data-testid="text-placeholder">Módulo de patrimônio em construção</p>
            <p className="text-sm mt-2" data-testid="text-description">Em breve você poderá gerenciar todos os ativos por aqui</p>
          </div>
        </div>
      </div>
    </div>
  );
}
