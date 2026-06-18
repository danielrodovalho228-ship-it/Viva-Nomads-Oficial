/*
  Seção 8 do documento mestre — fluxo de garantia, verificação e contrato.
  A plataforma é CONECTADORA: verifica (CAF), cota garantia (seguradora) e
  documenta (ZapSign). Nunca é locadora, fiadora ou garantidora.
*/

export type TrafficLight = "green" | "yellow" | "red";
export type GuaranteeType = "seguro_fianca" | "caucao" | "titulo_cap";
export type Insurer = "porto" | "junto";
export type CostParty = "owner" | "tenant";

/**
 * Resultado da verificação de identidade (semáforo de risco).
 * `demo: true` enquanto a integração real não está ativa — não confundir um
 * laudo simulado com um verdadeiro. ("CAF" é o nome do fornecedor, usado só
 * internamente; na interface usamos "verificação de identidade".)
 */
export interface CafResult {
  light: TrafficLight;
  identity: boolean;
  liveness: boolean;
  document: boolean;
  notes: string[];
  coversForeigners: boolean; // CRNM/RNE
  demo?: boolean; // laudo de demonstração (sem verificação real rodando)
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
  { id: "porto", name: "Porto Seguro", note: "Fiança Locatícia Premium · cobertura ampla" },
  { id: "junto", name: "Junto Seguros", note: "Fiança locatícia · enxuta e rápida" },
];

/** Cobertura detalhada por seguradora (Atualização 15.1) — comparação real. */
export interface InsurerCoverage {
  aluguelAtraso: boolean;
  condominio: boolean;
  iptu: boolean;
  danos: boolean;
  multas: boolean;
  pintura: boolean;
  assistencia: boolean;
  analise: string; // prazo/velocidade de aprovação
}

/** Linhas da tabela de comparação, na ordem de exibição. */
export const COVERAGE_ROWS: { key: keyof Omit<InsurerCoverage, "analise">; label: string }[] = [
  { key: "aluguelAtraso", label: "Aluguel em atraso" },
  { key: "condominio", label: "Condomínio" },
  { key: "iptu", label: "IPTU" },
  { key: "danos", label: "Danos ao imóvel" },
  { key: "multas", label: "Multas contratuais" },
  { key: "pintura", label: "Pintura" },
  { key: "assistencia", label: "Assistência (chaveiro, encanador, elétrica)" },
];

export const INSURER_COVERAGE: Record<Insurer, InsurerCoverage> = {
  // Porto: cobre mais (e custa um pouco mais) — custo-benefício para quem quer proteção total.
  porto: {
    aluguelAtraso: true,
    condominio: true,
    iptu: true,
    danos: true,
    multas: true,
    pintura: true,
    assistencia: true,
    analise: "até 48h",
  },
  // Junto: mais barata e rápida, porém com cobertura enxuta.
  junto: {
    aluguelAtraso: true,
    condominio: true,
    iptu: false,
    danos: true,
    multas: false,
    pintura: false,
    assistencia: false,
    analise: "até 24h",
  },
};

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
  // Porto cobre mais e custa um pouco mais; Junto é mais barata e enxuta.
  const factor = insurer === "porto" ? 1.6 : 1.35; // múltiplo do aluguel anual
  const annual = monthlyRent * 12;
  const total = Math.round(annual * (factor / 12)); // custo anual aproximado da apólice
  return {
    insurer,
    annualCost: total,
    monthlyInstallment: Math.round(total / 12),
    coverage: monthlyRent * 30,
  };
}
