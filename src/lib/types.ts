/** Tipos centrais do domínio Viva Nomads. */

export type UserRole = "owner" | "tenant" | "admin";

export type PropertyStatus = "draft" | "active" | "paused";

export type WorkspaceType = "coworking" | "meeting_room" | "cafe";

/** Regime de despesas de consumo (Atualização 6). */
export type UtilitiesMode = "fixed" | "real";

export interface Workspace {
  name: string;
  type: WorkspaceType;
  distanceM: number;
}

export interface Property {
  id: string;
  title: string;
  description: string;
  propertyType: string; // Apartamento, Casa, Studio...
  city: string;
  state: string;
  neighborhood: string; // região aproximada (público)
  exactAddress?: string; // endereço exato (liberado após aceite — LGPD)
  lat: number;
  lng: number;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  minPeriodDays: number;
  monthlyPrice: number;
  // Despesas de consumo (Atualização 6)
  utilitiesMode: UtilitiesMode;
  utilitiesEstimate: number; // R$/mês (regime fixo)
  utilitiesOverageMargin: number; // % de tolerância antes de cobrança complementar
  // Diferenciais para o público profissional (Atualizações 7 e 10)
  issuesInvoice: boolean; // emite Nota Fiscal
  acceptsInsurance: boolean; // aceita seguro-fiança
  rating: number; // média de avaliações (0–5)
  reviewCount: number;
  status: PropertyStatus;
  workReadyBadge: boolean;
  workScore: number;
  photos: string[]; // placeholders por enquanto
  amenities: string[];
  workFeatures: string[];
  nearbyWorkspaces: Workspace[];
  ownerName: string;
}

/** Perfil de público-alvo exibido na home. */
export interface Persona {
  id: string;
  title: string;
  text: string;
  period: string;
  icon: string; // nome do ícone lucide
}
