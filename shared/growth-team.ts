// Emails do time de Growth com acesso ao "Configurar valores" do UTM Builder.
// Não precisam ser admins do Cortex — esta lista libera apenas a gestão de
// vocabulário UTM (cadastro de campaign/term).
export const GROWTH_TEAM_EMAILS = new Set<string>([
  "caio.malini@turbopartners.com.br",
  "esther.fiorio@turbopartners.com.br",
  "lucas.pereira@turbopartners.com.br",
  "vinicius.ichino@turbopartners.com.br",
]);

export function isGrowthTeam(email?: string | null): boolean {
  if (!email) return false;
  return GROWTH_TEAM_EMAILS.has(email.toLowerCase().trim());
}
