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
export function capaDoDraftData(data: unknown, ownerId: string, existentes: ReadonlySet<string> | null = null): string | null {
  const pasta = `/storage/v1/object/public/property-photos/${ownerId}/`;
  for (const u of urlsDoRascunho(data)) {
    if (typeof u !== "string") continue;
    // E308 (causa raiz): arquivo que já não existe no bucket não vira capa (seria imagem quebrada).
    if (!soFotosExistentes([u], existentes).length) continue;
    try {
      const url = new URL(u);
      if ((url.protocol === "https:" || url.protocol === "http:") && url.pathname.startsWith(pasta)) return u;
    } catch {
      /* não é URL: ignora */
    }
  }
  return null;
}

/** Caminho no bucket `property-photos` a partir da URL pública (sem `?…`, decodificado); null se não é do bucket. */
export function caminhoNoBucketFotos(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const marca = "/object/public/property-photos/";
  const i = url.indexOf(marca);
  if (i < 0) return null;
  let c: string;
  try {
    c = decodeURIComponent(url.slice(i + marca.length).split("?")[0]);
  } catch {
    return null;
  }
  return c && !c.includes("..") ? c : null;
}

/**
 * E308 (causa raiz, 01/11): só as fotos cujo arquivo AINDA EXISTE no bucket. `existentes` = caminhos presentes no
 * bucket (null = não deu para conferir → não filtra nada). URL que não é do bucket passa como está.
 */
export function soFotosExistentes(urls: readonly string[], existentes: ReadonlySet<string> | null): string[] {
  if (!existentes) return [...urls];
  return urls.filter((u) => {
    const c = caminhoNoBucketFotos(u);
    return c === null || existentes.has(c);
  });
}

/**
 * E426 (01/11): o rascunho reaberto no assistente sem as fotos cujo arquivo já saiu do bucket (eram miniaturas
 * quebradas no Passo 2 e na prévia). Só `photos` muda; foto fora do bucket fica; `existentes` null = não filtra. O
 * próximo salvamento grava o rascunho já limpo (e a sincronização tira as linhas órfãs de property_photos).
 */
export function rascunhoSemFotosApagadas<T>(data: T, existentes: ReadonlySet<string> | null): T {
  if (!existentes || !data || typeof data !== "object") return data;
  const fotos = (data as { photos?: unknown }).photos;
  if (!Array.isArray(fotos)) return data;
  const ficam = fotos.filter((f) => {
    const url = f && typeof f === "object" ? (f as { url?: unknown }).url : f;
    return typeof url !== "string" || soFotosExistentes([url], existentes).length > 0;
  });
  return ficam.length === fotos.length ? data : ({ ...(data as object), photos: ficam } as T);
}
