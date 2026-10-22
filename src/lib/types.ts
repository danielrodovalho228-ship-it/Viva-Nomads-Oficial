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
  /** Resposta pública do proprietário (0128), se houver. */
  reply?: string;
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
  /** Custo total do mês (calcularTotalMensal): preenchido na /buscar para filtro, ordem e pino. */
  totalMes?: number;
  /** Equivalente mensal que o dono informou ter no Airbnb (opcional; 0130). Só o dono lê de volta no editor. */
  airbnbMonthlyPrice?: number;
  /** Selo "Preço justo": aluguel abaixo do Airbnb informado (coluna gerada da 0130). */
  precoJusto?: boolean;
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
  ownershipType: "own" | "subleased" | "managed";
  subleaseAuthorized?: boolean;
  /** Dono: o documento da operação (autorização/procuração) já está anexado (0091). */
  autorizacaoAnexada?: boolean;
  /** Privacidade e acesso declarados pelo anunciante (0116). Indefinido = banco sem a coluna. */
  privacidade?: import("./anuncio/privacidade").Privacidade;
  // Qualidade do anúncio (rodada 11) — derivado da quantidade de fotos
  qualityTier?: "padrao" | "completo" | "premium";
  videoUrl?: string; // walk-through em vídeo — reduz o atrito de alugar sem visita
  photos: string[]; // placeholders por enquanto
  amenities: string[];
  /** Chaves de filtro da busca (wifi/cozinha/garagem/lavar) — lista pública carrega só estas (ordem 583d2e71). */
  comodidadesFiltro?: string[];
  workFeatures: string[];
  internetTier?: InternetTier; // qualidade da internet por categoria de uso (rodada 20)
  nearbyWorkspaces: Workspace[];
  ownerName: string;
  ownerId?: string; // dono do imóvel (para saber se o visitante é o próprio dono)
  createdAt?: string; // data de cadastro (ISO) — ordenação "Adicionados recentemente"
  // ── Enriquecimento da página (todos opcionais; a seção some quando ausente) ──
  parkingSpots?: number; // vagas
  condoFee?: number; // condomínio (R$/mês), separado das contas de consumo
  descricaoGeradaPorIa?: boolean; // auditoria: descrição gerada por IA
  availableFrom?: string; // ISO — "disponível a partir de"
  furnished?: boolean; // mobiliado
  petsAllowed?: boolean;
  /** Regras detalhadas de pets (espécies, porte, quantidade, reforço de Caução). */
  petsRegras?: import("@/lib/anuncio/pets-regras").RegrasPets;
  /** Pacote de limpeza durante a estadia (ordem 4c74ac38; requer migração 0144). */
  limpezaEstadia?: import("@/lib/anuncio/limpeza-estadia").LimpezaEstadia;
  /** Negociação pública (aceita? itens; desconto por estadia longa) — prompt 17 §8, requer 0152. */
  negociacao?: import("@/lib/anuncio/negociacao").Negociacao;
  /** Velocidade da internet informada pelo dono (Mbps), opcional — requer 0152. */
  internetMbps?: number;
  /** Internet MEDIDA no imóvel (Prompt 57): a última medição validada do dono, vigente. Nunca a do morador. */
  internetMedida?: import("@/lib/internet-medida").Medicao;
  smokingAllowed?: boolean;
  childrenAllowed?: boolean;
  maxGuests?: number;
  availableUntil?: string; // ISO — "disponível até"
  maxPeriodDays?: number; // duração máxima
  checkinAfter?: string; // ex.: "14:00"
  checkoutBefore?: string; // ex.: "11:00"
  amenityGroups?: AmenityGroup[]; // comodidades por categoria
  faixasAceitas?: string[]; // faixas de prazo aceitas (temporada, media_estadia, longa)
  garantiasAceitas?: string[]; // garantias aceitas (caucao_avista, caucao_parcelada, titulo, seguro_fianca)
  proximities?: Proximity[]; // pontos úteis na região (texto manual)
  /** Proximidades Google curadas — só place_id (nome/distância resolvidos em runtime). */
  googlePlaces?: { placeId: string; categoria: string; rotulo?: string }[];
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
