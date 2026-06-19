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
