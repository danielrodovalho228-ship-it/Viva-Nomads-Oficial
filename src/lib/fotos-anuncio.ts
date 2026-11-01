/**
 * Fotos do anúncio que podem ir para `property_photos`: só arquivos do bucket
 * público `property-photos` NA PASTA DO PRÓPRIO DONO (o upload grava em
 * `<userId>/<uuid>.<ext>`). Descarta blob: do modo demonstração, URLs de fora e
 * repetidas. Máximo de 40 (o mesmo do editor; rolo da câmera, ordem 04e2fe5e).
 */
export const MAX_FOTOS_ANUNCIO = 40;

export function fotosDoDono(urls: readonly unknown[], ownerId: string): string[] {
  const pasta = `/storage/v1/object/public/property-photos/${ownerId}/`;
  const vistas = new Set<string>();
  const ok: string[] = [];
  for (const u of urls) {
    if (typeof u !== "string" || vistas.has(u)) continue;
    let url: URL;
    try {
      url = new URL(u);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || !url.pathname.startsWith(pasta)) continue;
    vistas.add(u);
    ok.push(u);
    if (ok.length >= MAX_FOTOS_ANUNCIO) break;
  }
  return ok;
}

/** URLs das fotos guardadas no rascunho (`draft_data.photos` = [{ url }]). */
export function urlsDoRascunho(data: unknown): unknown[] {
  const fotos = (data as { photos?: unknown } | null)?.photos;
  if (!Array.isArray(fotos)) return [];
  return fotos.map((f) => (f && typeof f === "object" ? (f as { url?: unknown }).url : f));
}

/**
 * E308: a capa do rascunho pelo `draft_data` — a 1ª foto do bucket na pasta do próprio dono, ou null. Só para EXIBIR:
 * aceita http e https (o Storage local do laboratório é http); gravar em `property_photos` segue `fotosDoDono` (https).
 */
export function capaDoDraftData(data: unknown, ownerId: string): string | null {
  const pasta = `/storage/v1/object/public/property-photos/${ownerId}/`;
  for (const u of urlsDoRascunho(data)) {
    if (typeof u !== "string") continue;
    try {
      const url = new URL(u);
      if ((url.protocol === "https:" || url.protocol === "http:") && url.pathname.startsWith(pasta)) return u;
    } catch {
      /* não é URL: ignora */
    }
  }
  return null;
}
