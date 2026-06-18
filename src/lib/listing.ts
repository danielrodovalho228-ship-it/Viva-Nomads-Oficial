/**
 * Qualidade do anúncio (rodada 11) — mínimo de fotos e tiers de destaque.
 * Plataforma curada: anúncio bem fotografado passa seriedade e ganha prioridade.
 */

export type QualityTier = "padrao" | "completo" | "premium";

/** Mínimo obrigatório de fotos para publicar. */
export const MIN_PHOTOS = 8;

/** Ambientes sugeridos (guia, não obrigatórios individualmente). */
export const SUGGESTED_ROOMS = [
  "Sala / estar",
  "Quarto(s)",
  "Cozinha",
  "Banheiro",
  "Home office / trabalho",
  "Fachada / prédio",
  "Área externa / varanda",
  "Detalhe diferencial",
];

/** Tier de qualidade a partir da contagem de fotos. */
export function tierFromPhotoCount(count: number): QualityTier {
  if (count >= 20) return "premium";
  if (count >= 12) return "completo";
  return "padrao";
}

export const TIER_META: Record<
  QualityTier,
  { label: string; tone: string; priority: number }
> = {
  padrao: { label: "Anúncio padrão", tone: "bg-surface-2 text-muted", priority: 0 },
  completo: { label: "Anúncio completo", tone: "bg-blue-50 text-blue-700", priority: 1 },
  premium: { label: "Anúncio premium", tone: "bg-champagne text-night", priority: 2 },
};

/**
 * Pontuação de completude do anúncio (0–100): fotos + descrição + selos.
 * Incentiva o proprietário a completar — quanto mais completo, mais visível.
 */
export function listingQuality(input: {
  photoCount: number;
  hasDescription: boolean;
  readyToLiveBadge: boolean;
}): number {
  // Fotos valem até 60 (satura em 20 fotos), descrição 20, selo 20.
  const photoScore = Math.min(60, Math.round((input.photoCount / 20) * 60));
  const descScore = input.hasDescription ? 20 : 0;
  const badgeScore = input.readyToLiveBadge ? 20 : 0;
  return Math.min(100, photoScore + descScore + badgeScore);
}

/** Prioridade de ordenação na busca somando tier (e, opcionalmente, plano). */
export function searchPriority(tier: QualityTier): number {
  return TIER_META[tier].priority;
}
