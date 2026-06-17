/*
  Seção 8 do documento mestre — fluxo de garantia, verificação e contrato.
  A plataforma é CONECTADORA: verifica (CAF), cota garantia (seguradora) e
  documenta (ZapSign). Nunca é locadora, fiadora ou garantidora.
*/

export type TrafficLight = "green" | "yellow" | "red";
export type GuaranteeType = "seguro_fianca" | "caucao" | "titulo_cap";
export type Insurer = "porto" | "junto";
export type CostParty = "owner" | "tenant";

/** Resultado do laudo CAF (mock até integrar a API). */
export interface CafResult {
  light: TrafficLight;
  identity: boolean;
  liveness: boolean;
  document: boolean;
  notes: string[];
  coversForeigners: boolean; // CRNM/RNE
}

export const TRAFFIC_LIGHT_META: Record<
  TrafficLight,
  { label: string; emoji: string; tone: string; ring: string }
> = {
  green: { label: "Perfil limpo", emoji: "🟢", tone: "text-emerald-700 bg-emerald-50", ring: "ring-emerald-200" },
  yellow: { label: "Pontos de atenção", emoji: "🟡", tone: "text-amber-700 bg-amber-50", ring: "ring-amber-200" },
  red: { label: "Alto risco", emoji: "🔴", tone: "text-red-700 bg-red-50", ring: "ring-red-200" },
};

/** Opções de garantia locatícia. Apenas UMA pode ser escolhida (art. 42). */
export const GUARANTEE_OPTIONS: {
  id: GuaranteeType;
  name: string;
  recommended?: boolean;
  summary: string;
  pros: string[];
  cons: string[];
}[] = [
  {
    id: "seguro_fianca",
    name: "Seguro-fiança",
    recommended: true,
    summary:
      "Apólice paga pelo inquilino, com o proprietário como beneficiário. Cobre aluguel, condomínio, IPTU e danos.",
    pros: ["Cobertura ampla (até ~30x o aluguel)", "Sem depósito alto de entrada", "Ideal para contratos longos"],
    cons: ["Custo ~1,2 a 2,5x o aluguel anual, parcelado", "Sujeito a análise de crédito"],
  },
  {
    id: "caucao",
    name: "Caução",
    summary:
      "Depósito de até 3 meses de aluguel em conta vinculada, devolvido ao fim se não houver pendências.",
    pros: ["Baixa burocracia", "Sem análise de crédito", "Devolvido ao inquilino no fim"],
    cons: ["Proteção limitada ao valor depositado (máx. 3 meses, art. 38)"],
  },
  {
    id: "titulo_cap",
    name: "Título de capitalização",
    summary:
      "Alternativa à caução: o inquilino adquire um título que serve de lastro para eventuais débitos.",
    pros: ["Sem depósito imediato em conta vinculada", "Resgatável ao fim do contrato"],
    cons: ["Rentabilidade baixa", "Cobertura limitada ao valor do título"],
  },
];

/** Seguradoras parceiras para cotação de seguro-fiança (8.3). */
export const INSURERS: { id: Insurer; name: string; note: string }[] = [
  { id: "porto", name: "Porto Seguro", note: "Fiança Locatícia Essencial · análise de crédito refinada" },
  { id: "junto", name: "Junto Seguros", note: "Fiança locatícia · forte no segmento corporativo" },
];

/** Itens do rateio de custos do contrato (8.5). Padrão legal sugerido. */
export const COST_SPLIT_ITEMS: { key: string; label: string; default: CostParty }[] = [
  { key: "agua", label: "Água", default: "tenant" },
  { key: "luz", label: "Luz / energia", default: "tenant" },
  { key: "condominio", label: "Condomínio", default: "tenant" },
  { key: "iptu", label: "IPTU", default: "owner" },
  { key: "seguro_patrimonial", label: "Seguro patrimonial (incêndio)", default: "owner" },
];

/** Gera uma cotação simulada de seguro-fiança a partir do aluguel. */
export function simulateQuote(insurer: Insurer, monthlyRent: number) {
  const factor = insurer === "porto" ? 1.45 : 1.6; // múltiplo do aluguel anual
  const annual = monthlyRent * 12;
  const total = Math.round(annual * (factor / 12)); // custo anual aproximado da apólice
  return {
    insurer,
    annualCost: total,
    monthlyInstallment: Math.round(total / 12),
    coverage: monthlyRent * 30,
  };
}
