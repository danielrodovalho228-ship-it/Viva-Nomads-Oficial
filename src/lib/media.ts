/*
  Fotografia REAL do projeto (arquivos em /public/images, servidos localmente).
  Substituiu a curadoria interina do Unsplash. Trocar por novas fotos é só
  substituir o arquivo correspondente em public/images/.
*/

const H = "/images/home";
const A = "/images/auth";
const B = "/images/busca";
const D = "/images/dashboard";
const I = "/images/imoveis";
const C = "/cadastro";

/** Placeholder blur neutro (skeleton suave) — evita CLS e flash forte. */
export const BRAND_BLUR =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#eef1f5"/></svg>`
  ).toString("base64");

export const PHOTOS = {
  // A — Home
  heroProfessional: `${H}/home-hero-chegada.webp`,
  homeOffice: `${H}/home-diferencial-homeoffice.webp`,
  condominio: `${H}/home-condominio-tranquilo.webp`,
  ownerKeys: `${H}/home-proprietarios-chaves.webp`,
  // B — Busca
  buscaHero: `${B}/busca-hero-villa.webp`,
  personas: {
    executivos: `${H}/persona-executivo.webp`,
    saude: `${H}/persona-saude.webp`,
    familias: `${H}/persona-familia.webp`,
    nomades: `${H}/persona-nomade.webp`,
  },
  // C — Auth
  authLogin: `${A}/auth-login-side.webp`,
  authSignup: `${A}/auth-signup-side.webp`,
  // D/E — Dashboards
  dashTenant: `${D}/dash-inquilino-welcome.webp`,
  dashOwner: `${D}/dash-prop-onboarding.webp`,
  // Cadastro de imóvel (wizard — rodada 15)
  cadastro: {
    welcome: `${C}/boas-vindas.webp`,
    uploadEmpty: `${C}/upload-vazio.webp`,
    workspace: `${C}/home-office.webp`,
  },
  // Estados / OG (imagens reais geradas)
  emptyTenant: "/images/empty-inquilino-reservas.webp",
  emptyOwner: "/images/empty-prop-imoveis.webp",
  error404: "/images/error-404.webp",
  ogDefault: "/images/og-default.webp",
  // B — Galerias dos imóveis (fotos de ambiente)
  galleryRooms: [
    `${I}/placeholder-imovel-fachada.webp`,
    `${I}/placeholder-imovel-sala.webp`,
    `${I}/placeholder-imovel-quarto.webp`,
    `${I}/placeholder-imovel-cozinha.webp`,
    `${I}/placeholder-imovel-banheiro.webp`,
  ],
} as const;

/**
 * Fotos REAIS por imóvel (demo), na ordem de exibição — a primeira é a capa.
 * Arquivos em /public/images/imoveis/ube/. Geradas sob medida para cada anúncio.
 */
export const PROPERTY_PHOTOS: Record<string, string[]> = {
  "ube-001": [
    `${I}/ube/ube-001-sala.webp`,
    `${I}/ube/ube-001-home-office.webp`,
    `${I}/ube/ube-001-quarto-1.webp`,
    `${I}/ube/ube-001-quarto-2.webp`,
    `${I}/ube/ube-001-cozinha.webp`,
    `${I}/ube/ube-001-banheiro.webp`,
    `${I}/ube/ube-001-varanda.webp`,
    `${I}/ube/ube-001-fachada.webp`,
  ],
  "ube-002": [
    `${I}/ube/ube-002-ambiente.webp`,
    `${I}/ube/ube-002-trabalho.webp`,
    `${I}/ube/ube-002-cozinha.webp`,
    `${I}/ube/ube-002-banheiro.webp`,
    `${I}/ube/ube-002-vista.webp`,
    `${I}/ube/ube-002-fachada.webp`,
  ],
  "ube-003": [
    `${I}/ube/ube-003-sala.webp`,
    `${I}/ube/ube-003-quarto-1.webp`,
    `${I}/ube/ube-003-quarto-2.webp`,
    `${I}/ube/ube-003-quarto-3.webp`,
    `${I}/ube/ube-003-cozinha.webp`,
    `${I}/ube/ube-003-banheiro.webp`,
    `${I}/ube/ube-003-quintal.webp`,
    `${I}/ube/ube-003-fachada.webp`,
  ],
  "ube-004": [
    `${I}/ube/ube-004-sala.webp`,
    `${I}/ube/ube-004-fachada.webp`,
  ],
  "ube-005": [
    `${I}/ube/ube-005-sala.webp`,
    `${I}/ube/ube-005-quarto.webp`,
  ],
  "ube-006": [
    `${I}/ube/ube-006-sala.webp`,
    `${I}/ube/ube-006-home-office.webp`,
    `${I}/ube/ube-006-quarto.webp`,
  ],
  "ube-007": [
    `${I}/ube/ube-007-ambiente.webp`,
    `${I}/ube/ube-007-cozinha.webp`,
  ],
  "ube-008": [
    `${I}/ube/ube-008-sala.webp`,
    `${I}/ube/ube-008-quarto.webp`,
    `${I}/ube/ube-008-quintal.webp`,
  ],
  "ube-009": [
    `${I}/ube/ube-009-sala.webp`,
    `${I}/ube/ube-009-mesa-estudos.webp`,
  ],
  "ube-010": [
    `${I}/ube/ube-010-sala.webp`,
    `${I}/ube/ube-010-quarto.webp`,
  ],
  "ube-011": [
    `${I}/ube/ube-011-ambiente.webp`,
    `${I}/ube/ube-011-mesa-estudos.webp`,
  ],
  "ube-012": [
    `${I}/ube/ube-012-sala.webp`,
    `${I}/ube/ube-012-home-office.webp`,
  ],
  "ube-013": [
    `${I}/ube/ube-013-sala.webp`,
    `${I}/ube/ube-013-quarto.webp`,
    `${I}/ube/ube-013-quintal.webp`,
  ],
  "ube-014": [
    `${I}/ube/ube-014-sala.webp`,
    `${I}/ube/ube-014-quarto.webp`,
    `${I}/ube/ube-014-varanda-gourmet.webp`,
  ],
  "ube-015": [
    `${I}/ube/ube-015-ambiente.webp`,
    `${I}/ube/ube-015-cozinha.webp`,
  ],
};

/**
 * Monta uma galeria com `n` fotos ciclando os ambientes disponíveis.
 * Demonstra a galeria adaptável e os tiers de qualidade enquanto as fotos
 * reais não são enviadas (mínimo de 8 por anúncio — rodada 11).
 */
export function gallery(n: number): string[] {
  const base = PHOTOS.galleryRooms;
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

/**
 * Galeria de um imóvel específico com `n` fotos, ciclando as fotos reais do
 * próprio anúncio (a capa sempre em primeiro). Mantém os tiers de qualidade
 * (derivados da contagem) enquanto exibe imagens reais; cai para os ambientes
 * genéricos se o imóvel ainda não tiver fotos próprias.
 */
export function galleryFor(propertyId: string, n: number): string[] {
  const real = PROPERTY_PHOTOS[propertyId];
  if (real && real.length > 0) {
    return Array.from({ length: n }, (_, i) => real[i % real.length]);
  }
  // Fallback ilustrativo (ambientes genéricos): rotaciona o início por um hash do
  // id para que imóveis sem fotos próprias não mostrem todos a MESMA capa.
  const base = PHOTOS.galleryRooms;
  let h = 0;
  for (let i = 0; i < propertyId.length; i++) h = (h * 31 + propertyId.charCodeAt(i)) >>> 0;
  const off = h % base.length;
  return Array.from({ length: n }, (_, i) => base[(i + off) % base.length]);
}

/**
 * Foto de CAPA (miniatura) de um imóvel: usa a 1ª foto real do anúncio quando
 * existe; senão, uma foto de ambiente determinística pelo id (nunca quebra, e o
 * mesmo imóvel mostra sempre a mesma capa).
 */
export function coverPhoto(propertyId: string, photos?: string[]): string {
  if (photos && photos.length > 0) return photos[0];
  const real = PROPERTY_PHOTOS[propertyId];
  if (real && real.length > 0) return real[0];
  let h = 0;
  for (let i = 0; i < propertyId.length; i++) h = (h * 31 + propertyId.charCodeAt(i)) >>> 0;
  return PHOTOS.galleryRooms[h % PHOTOS.galleryRooms.length];
}
