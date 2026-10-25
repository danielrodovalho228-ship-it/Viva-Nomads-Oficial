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
  // TIPO-CHACARA-B (24/10): só chácara/sítio; fazenda e rancho ficam fora até o parecer jurídico.
  { value: "chacara", label: "Chácara/Sítio" },
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

/** Comodidades agrupadas (Trabalho, Conforto, Prédio, Segurança). */
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
      { key: "iluminacao_boa", label: "Boa iluminação para trabalhar" },
      { key: "tomadas_mesa", label: "Tomadas perto da mesa" },
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
      { key: "tv", label: "TV" },
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
  {
    // Prompt 43 (Anunciar em 6 passos, passo 4): as câmeras ficam na declaração de privacidade, ao lado deste grupo.
    category: "seguranca",
    label: "Segurança",
    items: [
      { key: "detector_fumaca", label: "Detector de fumaça" },
      { key: "extintor", label: "Extintor de incêndio" },
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

/*
  E111-A — comodidades conforme o tipo do imóvel (fonte única da regra; o Passo 5, a tela de editar, a página do
  anúncio, os ícones do cartão e as sugestões das fotos usam estas duas funções). O corte é por item:
   • prédio (apartamento, studio, loft, cobertura, flat) e quarto: tudo;
   • casa de condomínio: tudo menos elevador; "No prédio" vira "No condomínio" e o grupo vira "Condomínio";
   • casa e chácara: sem os itens de prédio; piscina, churrasqueira e vaga ficam em "Área externa e garagem";
   • tipo ainda não escolhido ou desconhecido: tudo.
  A regra só decide o que aparece: as chaves marcadas continuam salvas e voltam se o tipo voltar.
*/
type PerfilDoTipo = "tudo" | "casa_condominio" | "casa";

/** Itens que só fazem sentido num prédio (somem de casa e chácara). */
const SO_EM_PREDIO = new Set(["sala_reuniao", "coworking", "cabine_chamadas", "academia", "portaria_24h", "elevador", "salao_festas", "lavanderia", "bicicletario"]);
/** Casa de condomínio: tudo, menos elevador. */
const FORA_DO_CONDOMINIO = new Set(["elevador"]);

function perfilDoTipo(tipo: string | null | undefined): PerfilDoTipo {
  const t = (tipo ?? "").trim().toLowerCase();
  // Aceita a chave canônica ou o rótulo legado ("Casa de condomínio", "Chácara/Sítio").
  const chave = PROPERTY_TYPES.find((p) => p.value === t || p.label.toLowerCase() === t)?.value;
  if (chave === "casa_condominio") return "casa_condominio";
  if (chave === "casa" || chave === "chacara") return "casa";
  return "tudo";
}

/** A comodidade aparece (e conta) para este tipo de imóvel? */
export function comodidadeValeParaTipo(chave: string, tipo: string | null | undefined): boolean {
  const perfil = perfilDoTipo(tipo);
  if (perfil === "casa") return !SO_EM_PREDIO.has(chave);
  if (perfil === "casa_condominio") return !FORA_DO_CONDOMINIO.has(chave);
  return true;
}

export interface GrupoDoTipo extends AmenityCatalogGroup {
  /** Título no Passo 5 (o grupo Trabalho aparece lá só com os itens do prédio: "No prédio"/"No condomínio"). */
  titulo: string;
}

/** Os grupos de comodidades já filtrados e com o título certo para o tipo. Grupo vazio não volta. */
export function comodidadesDoTipo(tipo: string | null | undefined): GrupoDoTipo[] {
  const perfil = perfilDoTipo(tipo);
  const rotuloEdificio = perfil === "casa" ? "Área externa e garagem" : perfil === "casa_condominio" ? "Condomínio" : null;
  const tituloTrabalho = perfil === "casa" ? "Trabalho" : perfil === "casa_condominio" ? "No condomínio" : "No prédio";
  return AMENITY_GROUPS.map((g) => {
    const label = g.category === "edificio" && rotuloEdificio ? rotuloEdificio : g.label;
    return {
      ...g,
      label,
      titulo: g.category === "trabalho" ? tituloTrabalho : label,
      items: g.items.filter((it) => comodidadeValeParaTipo(it.key, tipo)),
    };
  }).filter((g) => g.items.length > 0);
}

/** Rótulos gravados (property_amenities) que o tipo mostra; texto que não é do catálogo passa como está. */
export function rotulosQueValemParaTipo(rotulos: string[], tipo: string | null | undefined): string[] {
  return rotulos.filter((r) => {
    const chave = AMENITY_KEY_BY_LABEL[r];
    return !chave || comodidadeValeParaTipo(chave, tipo);
  });
}
