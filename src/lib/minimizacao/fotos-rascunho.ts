/*
  E705 (resíduo 2) — as fotos que existem SÓ no `draft_data` do rascunho (o autosave guarda o estado do editor e não grava
  `property_photos`) também saem do bucket quando o rascunho é excluído. PURO.
*/

/** URLs de foto guardadas no `draft_data` (campo `photos`: lista de { url }), sem repetição. */
export function urlsDeFotosDoRascunho(draft: unknown): string[] {
  if (!draft || typeof draft !== "object") return [];
  const fotos = (draft as { photos?: unknown }).photos;
  if (!Array.isArray(fotos)) return [];
  const urls = fotos.map((f) => (f && typeof f === "object" ? (f as { url?: unknown }).url : null)).filter((u): u is string => typeof u === "string" && u.length > 0);
  return [...new Set(urls)];
}
