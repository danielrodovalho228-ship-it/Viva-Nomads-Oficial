/*
  Rascunhos repetidos em "Meus imóveis" (ordem de8761b0, item 6): dois rascunhos com o mesmo título, cidade, bairro e
  número de quartos quase sempre são o mesmo anúncio começado duas vezes. Só avisa; quem decide excluir é o dono.
*/
interface Rascunho {
  id: string;
  status?: string | null;
  title?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  bedrooms?: number | null;
}

const normaliza = (s?: string | null) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Ids dos rascunhos que têm outro rascunho igual na lista. Rascunho sem título e anúncio fora de rascunho ficam de fora. */
export function idsRascunhosDuplicados(lista: Rascunho[]): Set<string> {
  const grupos = new Map<string, string[]>();
  for (const p of lista) {
    if (p.status !== "draft") continue;
    const titulo = normaliza(p.title);
    if (!titulo) continue;
    const chave = [titulo, normaliza(p.city), normaliza(p.neighborhood), p.bedrooms ?? ""].join("|");
    grupos.set(chave, [...(grupos.get(chave) ?? []), p.id]);
  }
  const ids = new Set<string>();
  for (const g of grupos.values()) if (g.length > 1) g.forEach((id) => ids.add(id));
  return ids;
}

/**
 * E383 (02/11): os rascunhos repetidos em GRUPOS, na ordem da lista (o 1º de cada grupo é o mais recente, porque a lista
 * vem do mais novo para o mais antigo). Meus imóveis mostra só o 1º de cada grupo e esconde as cópias atrás de "ver".
 */
export function gruposRascunhosDuplicados(lista: Rascunho[]): string[][] {
  const ids = idsRascunhosDuplicados(lista);
  const grupos = new Map<string, string[]>();
  for (const p of lista) {
    if (!ids.has(p.id)) continue;
    const chave = [normaliza(p.title), normaliza(p.city), normaliza(p.neighborhood), p.bedrooms ?? ""].join("|");
    grupos.set(chave, [...(grupos.get(chave) ?? []), p.id]);
  }
  return [...grupos.values()];
}
