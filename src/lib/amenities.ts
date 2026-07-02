/*
  Catálogo canônico de tipos de imóvel e comodidades (chaves estáveis).
  Fonte ÚNICA usada pelo cadastro, pela página do imóvel e (em breve) pelos
  filtros de busca — um cadastro alimenta tudo. Mantém a chave no banco e o
  rótulo exibido em um só lugar.
*/
import type { AmenityCategory } from "./types";

/** Tipos de imóvel (value = grava no banco; label = exibe ao usuário). */
export const PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: "apartamento", label: "Apartamento" },
  { value: "studio", label: "Studio / kitnet" },
  { value: "loft", label: "Loft" },
  { value: "cobertura", label: "Cobertura" },
  { value: "casa", label: "Casa" },
  { value: "casa_condominio", label: "Casa de condomínio" },
  { value: "flat", label: "Flat / apart-hotel" },
  { value: "quarto", label: "Quarto privativo" },
];

const PROPERTY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROPERTY_TYPES.map((t) => [t.value, t.label])
);

/** Rótulo de um tipo de imóvel (aceita chave canônica ou texto legado). */
export function propertyTypeLabel(value: string): string {
  return PROPERTY_TYPE_LABEL[value] ?? value;
}

export interface AmenityDef {
  key: string;
  label: string;
}
export interface AmenityCatalogGroup {
  category: AmenityCategory;
  label: string;
  items: AmenityDef[];
}

/** Comodidades agrupadas (Trabalho, Conforto, Prédio). */
export const AMENITY_GROUPS: AmenityCatalogGroup[] = [
  {
    category: "trabalho",
    label: "Trabalho",
    items: [
      { key: "home_office", label: "Home office / escritório dedicado" },
      { key: "internet_fibra", label: "Internet fibra de alta velocidade" },
      { key: "mesa_trabalho", label: "Mesa de trabalho" },
      { key: "cadeira_ergonomica", label: "Cadeira ergonômica" },
      { key: "ambiente_silencioso", label: "Ambiente silencioso" },
      { key: "sala_reuniao", label: "Sala de reunião (no prédio)" },
      { key: "coworking", label: "Espaço de coworking (no prédio)" },
      { key: "cabine_chamadas", label: "Cabine para chamadas" },
    ],
  },
  {
    category: "conforto",
    label: "Conforto do imóvel",
    items: [
      { key: "mobiliado", label: "Mobiliado completo" },
      { key: "ar_condicionado", label: "Ar-condicionado" },
      { key: "maquina_lavar", label: "Máquina de lavar" },
      { key: "lava_loucas", label: "Lava-louças" },
      { key: "enxoval", label: "Roupa de cama e banho inclusas" },
      { key: "cozinha_equipada", label: "Cozinha equipada" },
      { key: "varanda", label: "Varanda" },
    ],
  },
  {
    category: "edificio",
    label: "Prédio / condomínio",
    items: [
      { key: "academia", label: "Academia" },
      { key: "piscina", label: "Piscina" },
      { key: "portaria_24h", label: "Portaria 24h" },
      { key: "elevador", label: "Elevador" },
      { key: "salao_festas", label: "Salão de festas" },
      { key: "churrasqueira", label: "Churrasqueira" },
      { key: "lavanderia", label: "Lavanderia compartilhada" },
      { key: "bicicletario", label: "Bicicletário" },
      { key: "vaga_garagem", label: "Vaga de garagem" },
    ],
  },
];

/** key → rótulo (para exibir) e key → categoria (para persistir/agrupar). */
export const AMENITY_LABEL: Record<string, string> = {};
export const AMENITY_CATEGORY: Record<string, AmenityCategory> = {};
for (const g of AMENITY_GROUPS) {
  for (const it of g.items) {
    AMENITY_LABEL[it.key] = it.label;
    AMENITY_CATEGORY[it.key] = g.category;
  }
}

/** Converte chaves selecionadas em linhas {category,label} para property_amenities. */
export function amenityRows(keys: string[]): { category: AmenityCategory; label: string }[] {
  return keys
    .filter((k) => AMENITY_LABEL[k])
    .map((k) => ({ category: AMENITY_CATEGORY[k], label: AMENITY_LABEL[k] }));
}

/** rótulo → key (inverso de AMENITY_LABEL), para reconstruir a seleção ao editar. */
export const AMENITY_KEY_BY_LABEL: Record<string, string> = {};
for (const [key, label] of Object.entries(AMENITY_LABEL)) {
  AMENITY_KEY_BY_LABEL[label] = key;
}

/** Converte rótulos gravados (property_amenities) de volta em chaves selecionadas. */
export function amenityKeysFromLabels(labels: string[]): string[] {
  return labels.map((l) => AMENITY_KEY_BY_LABEL[l]).filter(Boolean);
}
