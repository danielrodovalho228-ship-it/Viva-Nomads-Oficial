/**
 * Tour em vídeo do anúncio (ordem 6f964617, tela 7): só provedores permitidos,
 * validados no servidor ao salvar e de novo na hora de mostrar.
 */
const HOSTS_YOUTUBE = ["youtube.com", "www.youtube.com", "m.youtube.com"];
const HOSTS_VIMEO = ["vimeo.com", "www.vimeo.com"];

/** Marca da 1ª peça da galeria quando o anúncio tem vídeo. */
export const ITEM_VIDEO = "__video__";

/** Endereço de incorporação (iframe) ou null se o provedor não é permitido. */
export function resolverVideoTour(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const idSeguro = (id: string | null | undefined) => (id && /^[\w-]{3,64}$/.test(id) ? id : null);
  if (host === "youtu.be") {
    const id = idSeguro(u.pathname.slice(1));
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (HOSTS_YOUTUBE.includes(host)) {
    const id = idSeguro(u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop());
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (HOSTS_VIMEO.includes(host)) {
    const id = idSeguro(u.pathname.split("/").filter(Boolean).pop());
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

export function videoTourPermitido(url: string | null | undefined): boolean {
  return resolverVideoTour(url) !== null;
}

/** Lista da galeria: o vídeo (se válido) vem primeiro; o resto são as fotos. */
export function itensDaGaleria(photos: string[], videoUrl?: string | null): string[] {
  return videoTourPermitido(videoUrl) ? [ITEM_VIDEO, ...photos] : photos;
}
