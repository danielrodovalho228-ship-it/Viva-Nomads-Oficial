import type { AmenityCategory, AmenityGroup, Property } from "../types.ts";

/** Quantas comodidades aparecem na página; o resto fica em "Ver todas as N comodidades". */
export const LIMITE_PRINCIPAIS = 5;

const ORDEM: AmenityCategory[] = ["trabalho", "cozinha", "conforto", "edificio", "seguranca"];
const rank = (c: AmenityCategory) => {
  const i = ORDEM.indexOf(c);
  return i === -1 ? 99 : i;
};

export type ComodidadesAgrupadas = {
  grupos: AmenityGroup[];
  total: number;
  precisaVerTodas: boolean;
};

/** Agrupa por categoria (ordem fixa), sem itens em branco nem repetidos. Só dado cadastrado: nada é inventado. */
export function agruparComodidades(property: Property): ComodidadesAgrupadas {
  const origem: AmenityGroup[] =
    property.amenityGroups && property.amenityGroups.length > 0
      ? [...property.amenityGroups].sort((a, b) => rank(a.category) - rank(b.category))
      : property.amenities.length > 0
        ? [{ category: "conforto", items: property.amenities }]
        : [];
  const vistos = new Set<string>();
  const grupos: AmenityGroup[] = [];
  for (const g of origem) {
    const items: string[] = [];
    for (const bruto of g.items) {
      const item = bruto.trim();
      const chave = item.toLowerCase();
      if (!item || vistos.has(chave)) continue;
      vistos.add(chave);
      items.push(item);
    }
    if (items.length > 0) grupos.push({ category: g.category, items });
  }
  const total = vistos.size;
  return { grupos, total, precisaVerTodas: total > LIMITE_PRINCIPAIS };
}

/** As primeiras comodidades, na ordem das categorias. */
export function comodidadesPrincipais(a: ComodidadesAgrupadas): string[] {
  return a.grupos.flatMap((g) => g.items).slice(0, LIMITE_PRINCIPAIS);
}
