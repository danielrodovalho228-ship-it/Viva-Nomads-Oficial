/**
 * Leads de exemplo (fallback do modo demonstração e do build sem banco).
 * Arquivo SÓ deles: as telas importam as funções puras de `lead-types.ts`, e os leads fictícios não podem ir junto no
 * JavaScript do painel (E744, família do E975/E980). Só o servidor (`leads.ts`) e o seed do modo demonstração
 * (`lib/demo/seed.ts`, carregado sob demanda) importam este arquivo.
 */
import type { Lead } from "./lead-types";

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
