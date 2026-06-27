/** Tipos centrais do domínio Viva Nomads. */

import type { InternetTier } from "./internet";

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

/** Categorias de comodidades exibidas na página (rodada de enriquecimento). */
export type AmenityCategory = "trabalho" | "cozinha" | "conforto" | "edificio" | "seguranca";

export interface AmenityGroup {
  category: AmenityCategory;
  items: string[];
}

/** Categorias de proximidades úteis para o público profissional. */
export type ProximityCategory = "saude" | "educacao" | "trabalho" | "mercado" | "transporte";

export interface Proximity {
  category: ProximityCategory;
  name: string;
  note?: string; // ex.: "10 min a pé"
}

export interface Review {
  author: string; // primeiro nome
  rating: number; // 0–5
  comment: string;
  date?: string; // ISO
}

/** Perfil público do proprietário (bloco de confiança). */
export interface OwnerProfile {
  name: string;
  avatarUrl?: string;
  memberSince?: string; // ISO — "no Viva Nomads desde…"
  responseRate?: number; // 0–100
  verified?: boolean;
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
  // Taxa de limpeza/preparação (Bloco B — rodada 5)
  prepFee: number; // limpeza profunda antes da entrada (única, obrigatória)
  checkoutCleaningEnabled: boolean; // limpeza de saída opcional
  checkoutCleaningFee: number; // valor da limpeza de saída, se ativa
  // Diferenciais para o público profissional (Atualizações 7 e 10)
  issuesInvoice: boolean; // emite Nota Fiscal
  acceptsInsurance: boolean; // aceita seguro-fiança
  rating: number; // média de avaliações (0–5)
  reviewCount: number;
  status: PropertyStatus;
  // Selos em camadas (Atualização 11)
  readyToLiveBadge: boolean; // selo base "Pronto para Morar"
  readyToLiveScore: number; // 0–100
  tagHomeOffice: boolean; // etiqueta "Para trabalhar de casa"
  tagWorkLocated: boolean; // etiqueta "Bem localizado para trabalho"
  tagCondoApproved: boolean; // etiqueta "Aceito em condomínio"
  // Perfil operador (Atualização 12)
  ownershipType: "own" | "subleased";
  subleaseAuthorized?: boolean;
  // Qualidade do anúncio (rodada 11) — derivado da quantidade de fotos
  qualityTier?: "padrao" | "completo" | "premium";
  videoUrl?: string; // walk-through em vídeo — reduz o atrito de alugar sem visita
  photos: string[]; // placeholders por enquanto
  amenities: string[];
  workFeatures: string[];
  internetTier?: InternetTier; // qualidade da internet por categoria de uso (rodada 20)
  nearbyWorkspaces: Workspace[];
  ownerName: string;
  createdAt?: string; // data de cadastro (ISO) — ordenação "Adicionados recentemente"
  // ── Enriquecimento da página (todos opcionais; a seção some quando ausente) ──
  parkingSpots?: number; // vagas
  condoFee?: number; // condomínio (R$/mês), separado das contas de consumo
  availableFrom?: string; // ISO — "disponível a partir de"
  furnished?: boolean; // mobiliado
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  childrenAllowed?: boolean;
  maxGuests?: number;
  availableUntil?: string; // ISO — "disponível até"
  maxPeriodDays?: number; // duração máxima
  checkinAfter?: string; // ex.: "14:00"
  checkoutBefore?: string; // ex.: "11:00"
  amenityGroups?: AmenityGroup[]; // comodidades por categoria
  garantiasAceitas?: string[]; // modalidades aceitas (caucao, titulo, …) — filtro
  proximities?: Proximity[]; // pontos úteis na região
  reviews?: Review[]; // avaliações reais
  owner?: OwnerProfile; // perfil de confiança do proprietário
}

/** Perfil de público-alvo exibido na home. */
export interface Persona {
  id: string;
  title: string;
  text: string;
  period: string;
  icon: string; // nome do ícone lucide
}
