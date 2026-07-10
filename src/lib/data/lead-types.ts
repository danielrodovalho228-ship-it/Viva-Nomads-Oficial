/**
 * Tipos e utilitários puros de Lead (sem dependências de servidor).
 * Importável tanto por componentes cliente quanto por server components.
 */

export type Light = "green" | "yellow" | "red";

export interface Lead {
  id: string;
  name: string; // só primeiro nome (identidade pós-aceite: nada de contato aqui)
  property: string;
  category: string;
  riskCategories: string[];
  light: Light;
  verified: boolean;
  desiredPeriodDays?: number; // período pretendido (para o resumo em uma linha)
  budgetMatch?: boolean; // orçamento compatível com o aluguel
  // PRIVACIDADE: telefone/e-mail/LinkedIn NÃO entram aqui. O proprietário
  // decide pelo perfil de risco e responde pela plataforma (conversa já aberta).
}

/** Rótulo curto do semáforo (para o resumo em uma linha). */
export const LIGHT_SHORT: Record<Light, string> = {
  green: "perfil limpo",
  yellow: "atenção",
  red: "alto risco",
};

/**
 * Pontua o lead para ordenação por qualidade (menor = melhor): verificados e
 * de perfil verde no topo, depois orçamento compatível.
 */
export function leadScore(l: Lead): number {
  const lightOrder = l.light === "green" ? 0 : l.light === "yellow" ? 1 : 2;
  return (l.verified ? 0 : 100) + lightOrder * 10 + (l.budgetMatch ? 0 : 1);
}

/** Resumo do candidato em uma linha. */
export function leadSummary(l: Lead): string {
  const parts = [l.category, LIGHT_SHORT[l.light]];
  if (l.desiredPeriodDays) parts.push(`quer ${l.desiredPeriodDays} dias`);
  if (l.budgetMatch !== undefined) parts.push(l.budgetMatch ? "orçamento ok" : "orçamento a confirmar");
  return parts.join(" · ");
}

/** Leads de exemplo (fallback do modo demonstração). */
export const SAMPLE_LEADS: Lead[] = [
  {
    id: "1",
    name: "Ana C.",
    property: "Apto Santa Mônica",
    category: "Médica · residência",
    riskCategories: ["Identidade OK", "Sem ações relevantes"],
    light: "green",
    verified: true,
    desiredPeriodDays: 90,
    budgetMatch: true,
  },
  {
    id: "2",
    name: "Rafael L.",
    property: "Studio Centro",
    category: "Executivo em transferência",
    riskCategories: ["Identidade OK"],
    light: "green",
    verified: true,
    desiredPeriodDays: 60,
    budgetMatch: true,
  },
  {
    id: "3",
    name: "Júlia M.",
    property: "Apto Santa Mônica",
    category: "Nômade digital",
    riskCategories: ["Verificação pendente"],
    light: "yellow",
    verified: false,
    desiredPeriodDays: 30,
    budgetMatch: false,
  },
];
