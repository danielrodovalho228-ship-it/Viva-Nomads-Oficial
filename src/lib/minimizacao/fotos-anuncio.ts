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

/**
 * E308 (causa raiz, 01/11): o mesmo arquivo pode estar em mais de um imóvel (rascunhos que reaproveitam as fotos). Antes,
 * quando UM deles tirava a foto (ou era excluído), o arquivo saía do bucket e a capa dos OUTROS virava imagem quebrada
 * (produção: 11 arquivos usados por 3 imóveis cada). Devolve os caminhos que ainda estão em `property_photos` de
 * algum imóvel ou no `draft_data` de algum rascunho — esses ficam no bucket.
 */
export async function caminhosAindaUsados(admin: SupabaseClient, urls: readonly string[]): Promise<Set<string>> {
  const usados = new Set<string>();
  const porCaminho = new Map<string, string[]>();
  for (const u of urls) {
    const c = caminhoDaFotoPublica(u);
    if (c) porCaminho.set(c, [...(porCaminho.get(c) ?? []), u]);
  }
  for (const [c, variantes] of porCaminho) {
    const consultas = [
      admin.from("property_photos").select("property_id").like("url", `%/object/public/${BUCKET}/${c}%`).limit(1),
      ...variantes.map((url) => admin.from("properties").select("id").contains("draft_data", { photos: [{ url }] }).limit(1)),
    ];
    const resultados = await Promise.all(consultas);
    // Sem conseguir conferir, NÃO apaga (apagar um arquivo em uso quebra a capa de outro imóvel).
    if (resultados.some((r) => r.error || (r.data ?? []).length > 0)) usados.add(c);
  }
  return usados;
}

/** Apaga do bucket as fotos que saíram do anúncio e registra no livro. Best-effort: nunca derruba quem chamou. */
export async function apagarFotosDoAnuncio(admin: SupabaseClient | null, urls: readonly string[], teste = false): Promise<number> {
  const todos = [...new Set(urls.map(caminhoDaFotoPublica).filter((c): c is string => !!c))];
  if (!admin || !todos.length) return 0;
  try {
    // E308: arquivo ainda usado por outro imóvel (ou rascunho) fica no bucket.
    const usados = await caminhosAindaUsados(admin, urls);
    const caminhos = todos.filter((c) => !usados.has(c));
    if (!caminhos.length) return 0;
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

/**
 * E308 (causa raiz, 01/11): os caminhos que existem hoje no bucket na pasta do dono (`<ownerId>/<arquivo>`). null quando
 * não dá para conferir (sem cliente de serviço ou erro) — quem chama não filtra nada nesse caso.
 */
export async function arquivosDoDono(admin: SupabaseClient | null, ownerId: string): Promise<Set<string> | null> {
  if (!admin || !/^[0-9a-f-]{36}$/i.test(ownerId)) return null;
  const nomes = new Set<string>();
  for (let pagina = 0; pagina < 10; pagina++) {
    const { data, error } = await admin.storage.from(BUCKET).list(ownerId, { limit: 1000, offset: pagina * 1000 });
    if (error) return null;
    for (const o of data ?? []) nomes.add(`${ownerId}/${o.name}`);
    if ((data ?? []).length < 1000) break;
  }
  return nomes;
}
