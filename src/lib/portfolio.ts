/**
 * Carteira consolidada do operador / Plano Gestor (Atualização 12).
 *
 * Visão de ocupação de múltiplos imóveis (próprios e operados/sublocados),
 * contratos a vencer e receita mensal. Dados de exemplo enquanto a carteira
 * real não é alimentada pelo Supabase.
 */

export type PortfolioStatus = "occupied" | "vacant";
export type OwnershipKind = "own" | "subleased";

export interface PortfolioUnit {
  id: string;
  title: string;
  neighborhood: string;
  ownership: OwnershipKind;
  status: PortfolioStatus;
  monthlyRent: number; // receita do contrato vigente (0 se vago)
  tenantName?: string;
  contractEndsInDays?: number; // dias até o fim do contrato (se ocupado)
}

export const SAMPLE_PORTFOLIO: PortfolioUnit[] = [
  {
    id: "ube-001",
    title: "Studio mobiliado no Centro",
    neighborhood: "Centro",
    ownership: "own",
    status: "occupied",
    monthlyRent: 2900,
    tenantName: "Dra. Helena Prado",
    contractEndsInDays: 22,
  },
  {
    id: "ube-002",
    title: "Apartamento 2 quartos no Fundinho",
    neighborhood: "Fundinho",
    ownership: "own",
    status: "occupied",
    monthlyRent: 3600,
    tenantName: "Eng. Rafael Lima",
    contractEndsInDays: 54,
  },
  {
    id: "ube-003",
    title: "Cobertura no Santa Mônica",
    neighborhood: "Santa Mônica",
    ownership: "subleased",
    status: "occupied",
    monthlyRent: 4200,
    tenantName: "Família Moreira",
    contractEndsInDays: 78,
  },
  {
    id: "ube-004",
    title: "Flat mobiliado no Tibery",
    neighborhood: "Tibery",
    ownership: "subleased",
    status: "vacant",
    monthlyRent: 0,
  },
  {
    id: "ube-005",
    title: "Apartamento na Granja Marileusa",
    neighborhood: "Granja Marileusa",
    ownership: "own",
    status: "occupied",
    monthlyRent: 3300,
    tenantName: "Marina Costa",
    contractEndsInDays: 120,
  },
  {
    id: "ube-006",
    title: "Kitnet no Brasil",
    neighborhood: "Bairro Brasil",
    ownership: "subleased",
    status: "vacant",
    monthlyRent: 0,
  },
];

export interface PortfolioMetrics {
  total: number;
  occupied: number;
  vacant: number;
  occupancyPct: number;
  monthlyRevenue: number;
  ownCount: number;
  subleasedCount: number;
  ownRevenue: number;
  subleasedRevenue: number;
  expiring30: PortfolioUnit[];
  expiring60: PortfolioUnit[];
  expiring90: PortfolioUnit[];
}

export function portfolioMetrics(units: PortfolioUnit[]): PortfolioMetrics {
  const occupied = units.filter((u) => u.status === "occupied");
  const vacant = units.filter((u) => u.status === "vacant");
  const monthlyRevenue = units.reduce((sum, u) => sum + u.monthlyRent, 0);

  const own = units.filter((u) => u.ownership === "own");
  const subleased = units.filter((u) => u.ownership === "subleased");

  const inWindow = (max: number) =>
    occupied
      .filter((u) => u.contractEndsInDays != null && u.contractEndsInDays <= max)
      .sort((a, b) => (a.contractEndsInDays ?? 0) - (b.contractEndsInDays ?? 0));

  const expiring30 = inWindow(30);
  const expiring60 = inWindow(60).filter((u) => (u.contractEndsInDays ?? 0) > 30);
  const expiring90 = inWindow(90).filter((u) => (u.contractEndsInDays ?? 0) > 60);

  return {
    total: units.length,
    occupied: occupied.length,
    vacant: vacant.length,
    occupancyPct: units.length ? Math.round((occupied.length / units.length) * 100) : 0,
    monthlyRevenue,
    ownCount: own.length,
    subleasedCount: subleased.length,
    ownRevenue: own.reduce((s, u) => s + u.monthlyRent, 0),
    subleasedRevenue: subleased.reduce((s, u) => s + u.monthlyRent, 0),
    expiring30,
    expiring60,
    expiring90,
  };
}
