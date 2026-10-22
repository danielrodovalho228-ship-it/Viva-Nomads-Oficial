import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
  Fotos do anúncio (Prompt 58): a foto sai com o anúncio (ou quando o dono a tira); o hash perceptual fica (antifraude,
  exceção aprovada) em fotos_anuncio_hash, sem chave estrangeira. Cada arquivo apagado vai ao livro de eliminações.
*/
const BUCKET = "property-photos";
const MARCA = `/object/public/${BUCKET}/`;

/** Caminho no bucket a partir da URL pública (null se a URL não é do bucket). */
export function caminhoDaFotoPublica(url: string): string | null {
  const i = url.indexOf(MARCA);
  if (i < 0) return null;
  const c = decodeURIComponent(url.slice(i + MARCA.length).split("?")[0]);
  return c && !c.includes("..") ? c : null;
}

/** Liga os hashes das fotos (gravados no envio) ao imóvel. */
export async function ligarHashesAoImovel(admin: SupabaseClient | null, propertyId: string, urls: readonly string[]): Promise<void> {
  const caminhos = urls.map(caminhoDaFotoPublica).filter((c): c is string => !!c);
  if (!admin || !caminhos.length) return;
  await admin.from("fotos_anuncio_hash").update({ property_id: propertyId }).in("caminho", caminhos).is("property_id", null).then(
    () => undefined,
    () => undefined,
  );
}

/** Apaga do bucket as fotos que saíram do anúncio e registra no livro. Best-effort: nunca derruba quem chamou. */
export async function apagarFotosDoAnuncio(admin: SupabaseClient | null, urls: readonly string[], teste = false): Promise<number> {
  const caminhos = [...new Set(urls.map(caminhoDaFotoPublica).filter((c): c is string => !!c))];
  if (!admin || !caminhos.length) return 0;
  try {
    const { error } = await admin.storage.from(BUCKET).remove(caminhos);
    if (error) throw new Error(error.message);
    await admin
      .from("eliminacoes_registro")
      .insert(caminhos.map((c) => ({ origem: `bucket:${BUCKET}`, ref_id: c, tipo: "property-photos", motivo: "decisao", modo: "apagado", teste })));
    return caminhos.length;
  } catch (e) {
    await admin.from("eliminacoes_alertas").insert({ item: "property-photos", erro: String((e as Error).message ?? e).slice(0, 500) }).then(
      () => undefined,
      () => undefined,
    );
    return 0;
  }
}
