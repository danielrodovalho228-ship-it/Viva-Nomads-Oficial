/** Tipos centrais do domínio Viva Nomads. */

export type UserRole = "owner" | "tenant" | "admin";

export type PropertyStatus = "draft" | "active" | "paused";

export type WorkspaceType = "coworking" | "meeting_room" | "cafe";

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
  neighborhood: string;
  lat: number;
  lng: number;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  minPeriodDays: number;
  monthlyPrice: number;
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
