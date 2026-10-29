import { SELOS } from "../config/selos.ts";

/**
 * SELOS DE ESTRUTURA (ordem 512f3ed0, parte 1: regras puras). "Perto de hospital/universidade" é CALCULADO pela
 * localização, nunca autodeclarado. Nenhum selo existente muda (decisão dd52256e).
 *
 * E225-A — SEM SELO QUE MINTA. O que o dono marca no cadastro é só "Estrutura informada pelo proprietário" (lista em
 * texto, sem selo). O selo "Acessível" / "Mobilidade reduzida" exige, além de TODOS os itens marcados, a PROVA aprovada
 * de cada item (foto tirada na hora, mesmo caminho dos Níveis — parte 2, E225-B; ou a vistoria, no futuro). Enquanto
 * nenhum imóvel tem prova, o selo simplesmente não aparece.
 */
export const CHECKLIST_ACESSIVEL = [
  "entradaSemDegrauOuRampa",
  "elevadorOuTerreo",
  "portas80cm",
  "banheiroAdaptado",
] as const;

export const CHECKLIST_MOBILIDADE_REDUZIDA = [
  "barrasApoioBanheiro",
  "pisoAntiderrapante",
  "boxSemDegrau",
  "camaAlturaConfortavel",
] as const;

export type ItemChecklist = (typeof CHECKLIST_ACESSIVEL)[number] | (typeof CHECKLIST_MOBILIDADE_REDUZIDA)[number];
export type ChecklistEstrutura = Partial<Record<ItemChecklist, boolean>>;

export type GrupoEstrutura = "acessibilidade" | "mobilidadeReduzida";

/** Os dois grupos do cadastro, na ordem da tela, com o nome do grupo. */
export const GRUPOS_ESTRUTURA: readonly { id: GrupoEstrutura; titulo: string; itens: readonly ItemChecklist[] }[] = [
  { id: "acessibilidade", titulo: "Acessibilidade", itens: CHECKLIST_ACESSIVEL },
  { id: "mobilidadeReduzida", titulo: "Mobilidade reduzida", itens: CHECKLIST_MOBILIDADE_REDUZIDA },
];

/** Nome curto de cada item e a linha de critério (o que conta como "sim"). */
export const ITENS_ESTRUTURA: Record<ItemChecklist, { rotulo: string; criterio: string }> = {
  entradaSemDegrauOuRampa: { rotulo: "Entrada sem degrau ou com rampa", criterio: "Da calçada até a porta do imóvel sem degrau, ou com rampa" },
  elevadorOuTerreo: { rotulo: "Elevador ou térreo", criterio: "O imóvel fica no térreo, ou o prédio tem elevador até o andar" },
  portas80cm: { rotulo: "Portas largas", criterio: "Portas com pelo menos 80 cm de vão livre" },
  banheiroAdaptado: { rotulo: "Banheiro adaptado", criterio: "Banheiro com espaço para girar uma cadeira de rodas e barras de apoio" },
  barrasApoioBanheiro: { rotulo: "Barras de apoio no banheiro", criterio: "Barras fixas ao lado do vaso sanitário e no box" },
  pisoAntiderrapante: { rotulo: "Piso antiderrapante", criterio: "Piso antiderrapante no banheiro e nas áreas molhadas" },
  boxSemDegrau: { rotulo: "Box sem degrau", criterio: "A entrada do box fica no mesmo nível do piso do banheiro" },
  camaAlturaConfortavel: { rotulo: "Cama em altura confortável", criterio: "Cama na altura do joelho, fácil de sentar e de levantar" },
};

/** Nota fixa da seção do anúncio: o que o dono informou não é conferido pela Viva. */
export const NOTA_ESTRUTURA_INFORMADA = "Informado pelo proprietário. Confirme na visita.";

/** Algum item marcado como "sim"? (decide se o toggle do cadastro nasce ligado e se o anúncio mostra a seção). */
export const temEstruturaInformada = (c: ChecklistEstrutura | null | undefined) => !!c && Object.values(c).some((v) => v === true);

/**
 * Anúncio público: SÓ os itens marcados como "sim", por grupo, em texto (sem selo). Grupo sem item marcado não
 * aparece; nenhum item marcado = lista vazia (a seção não aparece).
 */
export function estruturaInformada(c: ChecklistEstrutura | null | undefined): { titulo: string; itens: string[] }[] {
  if (!c) return [];
  return GRUPOS_ESTRUTURA.map((g) => ({ titulo: g.titulo, itens: g.itens.filter((i) => c[i] === true).map((i) => ITENS_ESTRUTURA[i].rotulo) })).filter((g) => g.itens.length > 0);
}

/**
 * Prova de um item (E225-A deixa o gancho; a prova por foto entra no E225-B e a vistoria depois). Só prova APROVADA
 * conta para o selo. Hoje nenhum imóvel tem prova: o selo não aparece.
 */
export type OrigemProvaEstrutura = "foto_na_hora" | "vistoria";
export interface ProvaItemEstrutura {
  item: ItemChecklist;
  origem: OrigemProvaEstrutura;
  aprovada: boolean;
}

/** Distância máxima (km) até hospital ou universidade da lista da cidade. */
export const RAIO_PERTO_KM = 2;

const tudoMarcado = (c: ChecklistEstrutura | null | undefined, itens: readonly ItemChecklist[]) =>
  !!c && itens.every((i) => c[i] === true);

/** Cada item tem ao menos uma prova APROVADA (foto na hora ou vistoria). Sem provas: falso. */
const tudoProvado = (provas: readonly ProvaItemEstrutura[] | null | undefined, itens: readonly ItemChecklist[]) =>
  itens.every((i) => (provas ?? []).some((p) => p.item === i && p.aprovada === true));

/** E225-A: o selo exige todos os itens marcados E a prova aprovada de cada um. Autodeclaração sozinha não dá selo. */
export const seloAcessivel = (c: ChecklistEstrutura | null | undefined, provas?: readonly ProvaItemEstrutura[] | null) =>
  tudoMarcado(c, CHECKLIST_ACESSIVEL) && tudoProvado(provas, CHECKLIST_ACESSIVEL);
export const seloMobilidadeReduzida = (c: ChecklistEstrutura | null | undefined, provas?: readonly ProvaItemEstrutura[] | null) =>
  tudoMarcado(c, CHECKLIST_MOBILIDADE_REDUZIDA) && tudoProvado(provas, CHECKLIST_MOBILIDADE_REDUZIDA);

export interface Ponto {
  lat: number;
  lng: number;
}

/** Distância em km entre dois pontos (haversine). */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Verdadeiro se o imóvel está a no máximo RAIO_PERTO_KM de algum ponto da lista. Sem localização válida, falso. */
export function pertoDeAlgum(imovel: Ponto | null | undefined, lugares: readonly Ponto[]): boolean {
  if (!imovel || !Number.isFinite(imovel.lat) || !Number.isFinite(imovel.lng)) return false;
  return lugares.some((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng) && distanciaKm(imovel, l) <= RAIO_PERTO_KM);
}

export type SeloEstruturaId = "acessivel" | "mobilidadeReduzida" | "pertoHospital" | "pertoUniversidade";

export function selosEstrutura(d: {
  checklist?: ChecklistEstrutura | null;
  /** E225-A: provas por item (foto na hora / vistoria). Sem prova aprovada de todos os itens, sem selo. */
  provas?: readonly ProvaItemEstrutura[] | null;
  local?: Ponto | null;
  hospitais?: readonly Ponto[];
  universidades?: readonly Ponto[];
}): SeloEstruturaId[] {
  const ids: SeloEstruturaId[] = [];
  if (seloAcessivel(d.checklist, d.provas)) ids.push("acessivel");
  if (seloMobilidadeReduzida(d.checklist, d.provas)) ids.push("mobilidadeReduzida");
  if (pertoDeAlgum(d.local, d.hospitais ?? [])) ids.push("pertoHospital");
  if (pertoDeAlgum(d.local, d.universidades ?? [])) ids.push("pertoUniversidade");
  return ids;
}

/**
 * Os pontos da CIDADE para os selos "Perto de…": só os VERIFICADOS (coordenada conferida) e com tipo conhecido.
 * Sem nenhum ponto verificado, null — o selo "Perto de…" não aparece (nunca um ponto inventado).
 */
export function pontosDaCidade(
  cidadeSlug: string | null | undefined,
  pontos: readonly { slug: string; cidade: string; lat: number; lng: number; verificado: boolean }[],
  tipos: Readonly<Record<string, "hospital" | "universidade">>,
): { hospitais: Ponto[]; universidades: Ponto[] } | null {
  if (!cidadeSlug) return null;
  const validos = pontos.filter((p) => p.cidade === cidadeSlug && p.verificado === true && tipos[p.slug] && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (validos.length === 0) return null;
  const de = (t: "hospital" | "universidade") => validos.filter((p) => tipos[p.slug] === t).map((p) => ({ lat: p.lat, lng: p.lng }));
  return { hospitais: de("hospital"), universidades: de("universidade") };
}

/**
 * Os selos de estrutura do ANÚNCIO: Acessível / Mobilidade reduzida só com prova aprovada de cada item; "Perto de…"
 * só quando a cidade tem a lista de pontos cadastrada (sem lista, nada — nunca um ponto inventado).
 */
export function selosDoAnuncio(d: {
  checklist?: ChecklistEstrutura | null;
  provas?: readonly ProvaItemEstrutura[] | null;
  local?: Ponto | null;
  pontosDaCidade?: { hospitais: readonly Ponto[]; universidades: readonly Ponto[] } | null;
}): SeloEstruturaId[] {
  return selosEstrutura({
    checklist: d.checklist,
    provas: d.provas,
    local: d.local,
    hospitais: d.pontosDaCidade?.hospitais ?? [],
    universidades: d.pontosDaCidade?.universidades ?? [],
  });
}

export const rotuloSeloEstrutura = (id: SeloEstruturaId) => SELOS[id].nome;

const ITENS_CONHECIDOS: readonly string[] = [...CHECKLIST_ACESSIVEL, ...CHECKLIST_MOBILIDADE_REDUZIDA];

/** Valida o checklist vindo do cliente: só chaves conhecidas, só booleanos. O servidor nunca confia no que chega. */
export function validarChecklistEstrutura(
  entrada: unknown,
): { ok: true; checklist: ChecklistEstrutura } | { ok: false; erro: string } {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return { ok: false, erro: "Checklist inválido." };
  const checklist: ChecklistEstrutura = {};
  for (const [chave, valor] of Object.entries(entrada)) {
    if (!ITENS_CONHECIDOS.includes(chave)) return { ok: false, erro: "Item de checklist desconhecido." };
    if (typeof valor !== "boolean") return { ok: false, erro: "Marque cada item como sim ou não." };
    checklist[chave as ItemChecklist] = valor;
  }
  return { ok: true, checklist };
}
