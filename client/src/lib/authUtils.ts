export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function isForbiddenError(error: Error): boolean {
  return /^403: .*Forbidden/.test(error.message);
}

// Map of page routes to their permission slugs
export const PAGE_PERMISSIONS: Record<string, string> = {
  "/": "clientes",
  "/contratos": "contratos",
  "/colaboradores": "colaboradores",
  "/colaboradores/analise": "colaboradores-analise",
  "/patrimonio": "patrimonio",
  "/ferramentas": "ferramentas",
  "/visao-geral": "visao-geral",
  "/dashboard/financeiro": "dashboard-financeiro",
  "/dashboard/geg": "dashboard-geg",
  "/dashboard/retencao": "dashboard-retencao",
  "/dashboard/dfc": "dashboard-dfc",
  "/usuarios": "usuarios",
};

export function getPageSlugFromRoute(route: string): string {
  return PAGE_PERMISSIONS[route] || "";
}
