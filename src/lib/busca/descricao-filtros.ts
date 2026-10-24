/*
  Busca por descrição (ordem c470bb63, "Próximo do FF" 2/6) — PURO.
  A pessoa descreve o lugar ideal ("2 quartos perto do HC, aceita gato, até 2.500")
  e isto vira os FILTROS que a /buscar já tem. A IA (ou o leitor local, que é o
  plano B) só PREENCHE filtros: nada aqui cria imóvel nem responde fora da busca.
  Tudo que vem da IA passa por sanearFiltros — valor fora da lista é descartado.
*/
import { COMODIDADES_FILTRAVEIS, ROTULO_COMODIDADE, type ComodidadeFiltro } from "./filtro-comodidades.ts";
import type { PortePet } from "../anuncio/pets-regras.ts";

export interface FiltrosDescricao {
  /** Teto de preço mensal em R$ (0 = não citado). */
  maxPrice: number;
  /** Mínimo de quartos (0 = não citado). */
  minBedrooms: number;
  petsOnly: boolean;
  petPorte: PortePet | "";
  homeOfficeOnly: boolean;
  readyToLiveOnly: boolean;
  furnishedOnly: boolean;
  comodidades: ComodidadeFiltro[];
  /** Cidade ou bairro citado (texto curto). A tela só usa se existir no catálogo. */
  local: string;
}

export const FILTROS_DESCRICAO_VAZIOS: FiltrosDescricao = {
  maxPrice: 0,
  minBedrooms: 0,
  petsOnly: false,
  petPorte: "",
  homeOfficeOnly: false,
  readyToLiveOnly: false,
  furnishedOnly: false,
  comodidades: [],
  local: "",
};

export const DESCRICAO_MAX_CARACTERES = 200;
export const PRECO_MIN = 300;
export const PRECO_MAX = 50000;

const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
const RE_URL = /\b(?:https?:\/\/|www\.)\S+/gi;
const RE_TEL = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g;

/**
 * Texto que pode sair do navegador: corta no limite e remove telefone, e-mail
 * e link (a descrição não precisa de dado pessoal e nada disso é guardado).
 */
export function limparDescricao(texto: string): string {
  return String(texto ?? "")
    .replace(RE_EMAIL, " ")
    .replace(RE_URL, " ")
    .replace(RE_TEL, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DESCRICAO_MAX_CARACTERES);
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const NUMERO_POR_EXTENSO: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3 };

function lerPreco(t: string): number {
  // "até 2.500", "ate R$ 3500", "no máximo 2,5 mil", "até 3 mil", "orçamento de 2500"
  const m = t.match(/(?:ate|maximo|max|orcamento(?:\s+de)?|teto(?:\s+de)?|por)\s*(?:de\s*)?(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(\s*mil)?/);
  if (!m) return 0;
  let n: number;
  if (m[2]) n = Number(m[1].replace(",", ".")) * 1000;
  else if (/^\d{1,3}(\.\d{3})+$/.test(m[1])) n = Number(m[1].replace(/\./g, ""));
  else n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  n = Math.round(n);
  return n >= PRECO_MIN && n <= PRECO_MAX ? n : 0;
}

function lerQuartos(t: string): number {
  const m = t.match(/(\d|um|uma|dois|duas|tres)\s*(?:quartos?|dormitorios?|qtos?)\b/);
  if (!m) return 0;
  const n = /^\d$/.test(m[1]) ? Number(m[1]) : NUMERO_POR_EXTENSO[m[1]] ?? 0;
  return n >= 1 && n <= 3 ? n : n > 3 ? 3 : 0; // a busca só tem 1+, 2+ e 3+
}

/**
 * Plano B (e leitor padrão sem IA): palavras-chave da descrição → filtros.
 * Só reconhece o que a busca sabe filtrar; o resto é ignorado.
 * `locais` = cidades/bairros do catálogo, para achar o local citado.
 */
export function interpretarLocal(descricao: string, locais: readonly string[] = []): FiltrosDescricao {
  const t = semAcento(limparDescricao(descricao));
  const f: FiltrosDescricao = { ...FILTROS_DESCRICAO_VAZIOS, comodidades: [] };
  if (!t) return f;

  f.maxPrice = lerPreco(t);
  f.minBedrooms = lerQuartos(t);

  if (/\b(gato|gata|cachorro|cao|caes|pet|pets|animal|animais|bichinho)\b/.test(t) && !/\bsem (pet|pets|animal|animais)\b/.test(t)) {
    f.petsOnly = true;
    if (/\b(porte )?grande\b/.test(t)) f.petPorte = "G";
    else if (/\b(porte )?medio\b/.test(t)) f.petPorte = "M";
    else if (/\b(porte )?pequeno\b/.test(t)) f.petPorte = "P";
  }
  if (/home ?office|trabalhar de casa|trabalho remoto|escritorio/.test(t)) f.homeOfficeOnly = true;
  if (/pronto para morar/.test(t)) f.readyToLiveOnly = true;
  if (/mobiliad|mobilia/.test(t)) f.furnishedOnly = true;

  const com = new Set<ComodidadeFiltro>();
  if (/wi-?fi|internet|fibra/.test(t)) com.add("wifi");
  if (/cozinha/.test(t)) com.add("cozinha");
  if (/garagem|vaga|estacionamento/.test(t)) com.add("garagem");
  if (/maquina de lavar|lavadora|lavar roupa/.test(t)) com.add("lavar");
  // FILTROS-2: Wi-Fi e cozinha são garantia do padrão mínimo, não filtro — a descrição não as liga.
  f.comodidades = COMODIDADES_FILTRAVEIS.map((c) => c.chave).filter((k) => com.has(k));

  // Local: o nome mais longo do catálogo que aparece na descrição; "HC" = Umuarama.
  const candidatos = [...new Set(locais.map((l) => l.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  const achado = candidatos.find((l) => new RegExp(`(^|[^a-z])${semAcento(l).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(t));
  if (achado) f.local = achado;
  else if (/\b(hc|hc-ufu|ufu)\b/.test(t)) {
    const umuarama = candidatos.find((l) => semAcento(l) === "umuarama");
    if (umuarama) f.local = umuarama;
  }
  return f;
}

/**
 * Dica quando a descrição não vira filtro. Só cita o que `interpretarLocal` liga de verdade: desde o FILTROS-2,
 * Wi-Fi e cozinha são garantia do padrão mínimo e não viram filtro (L-49) — a dica não pode prometê-los.
 */
export const DICA_SEM_FILTRO = "Não achei filtros nessa descrição. Cite preço, quartos, cidade ou bairro, pets ou garagem.";

const PORTES: readonly string[] = ["P", "M", "G"];
const CHAVES_COMODIDADE: readonly string[] = COMODIDADES_FILTRAVEIS.map((c) => c.chave);

/**
 * Valida o que a IA devolveu. Qualquer campo fora do formato é descartado
 * (vira "não citado"); preço e quartos ficam dentro do que a busca aceita.
 */
export function sanearFiltros(cru: unknown): FiltrosDescricao {
  const f: FiltrosDescricao = { ...FILTROS_DESCRICAO_VAZIOS, comodidades: [] };
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) return f;
  const o = cru as Record<string, unknown>;
  const preco = typeof o.maxPrice === "number" ? Math.round(o.maxPrice) : 0;
  if (preco >= PRECO_MIN && preco <= PRECO_MAX) f.maxPrice = preco;
  const q = typeof o.minBedrooms === "number" ? Math.round(o.minBedrooms) : 0;
  if (q >= 1) f.minBedrooms = Math.min(3, q);
  f.petsOnly = o.petsOnly === true;
  if (f.petsOnly && typeof o.petPorte === "string" && PORTES.includes(o.petPorte)) f.petPorte = o.petPorte as PortePet;
  f.homeOfficeOnly = o.homeOfficeOnly === true;
  f.readyToLiveOnly = o.readyToLiveOnly === true;
  f.furnishedOnly = o.furnishedOnly === true;
  if (Array.isArray(o.comodidades)) {
    const set = new Set(o.comodidades.filter((c): c is string => typeof c === "string" && CHAVES_COMODIDADE.includes(c)));
    f.comodidades = CHAVES_COMODIDADE.filter((k) => set.has(k)) as ComodidadeFiltro[];
  }
  if (typeof o.local === "string") f.local = limparDescricao(o.local).slice(0, 60);
  return f;
}

/** Tem algum filtro preenchido? */
export function temFiltro(f: FiltrosDescricao): boolean {
  return Boolean(
    f.maxPrice || f.minBedrooms || f.petsOnly || f.homeOfficeOnly || f.readyToLiveOnly || f.furnishedOnly || f.comodidades.length || f.local
  );
}

export type ChaveChip = "local" | "maxPrice" | "minBedrooms" | "petsOnly" | "homeOfficeOnly" | "readyToLiveOnly" | "furnishedOnly" | ComodidadeFiltro;

/** Chips dos filtros aplicados, cada um com a chave para tirar só aquele filtro. */
export function chipsDe(f: FiltrosDescricao): { chave: ChaveChip; rotulo: string }[] {
  const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;
  const chips: { chave: ChaveChip; rotulo: string }[] = [];
  if (f.local) chips.push({ chave: "local", rotulo: f.local });
  if (f.maxPrice) chips.push({ chave: "maxPrice", rotulo: `Até ${brl(f.maxPrice)}` });
  if (f.minBedrooms) chips.push({ chave: "minBedrooms", rotulo: `${f.minBedrooms}+ ${f.minBedrooms === 1 ? "quarto" : "quartos"}` });
  if (f.petsOnly) {
    const porte = f.petPorte === "P" ? " (pequeno)" : f.petPorte === "M" ? " (médio)" : f.petPorte === "G" ? " (grande)" : "";
    chips.push({ chave: "petsOnly", rotulo: `Aceita pets${porte}` });
  }
  if (f.homeOfficeOnly) chips.push({ chave: "homeOfficeOnly", rotulo: "Trabalhar de casa" });
  if (f.readyToLiveOnly) chips.push({ chave: "readyToLiveOnly", rotulo: "Pronto para Morar" });
  if (f.furnishedOnly) chips.push({ chave: "furnishedOnly", rotulo: "Mobiliado" });
  for (const c of f.comodidades) chips.push({ chave: c, rotulo: ROTULO_COMODIDADE[c] });
  return chips;
}

/** Tira um filtro (o "x" do chip). */
export function semFiltro(f: FiltrosDescricao, chave: ChaveChip): FiltrosDescricao {
  const n: FiltrosDescricao = { ...f, comodidades: [...f.comodidades] };
  if (chave === "local") n.local = "";
  else if (chave === "maxPrice") n.maxPrice = 0;
  else if (chave === "minBedrooms") n.minBedrooms = 0;
  else if (chave === "petsOnly") {
    n.petsOnly = false;
    n.petPorte = "";
  } else if (chave === "homeOfficeOnly") n.homeOfficeOnly = false;
  else if (chave === "readyToLiveOnly") n.readyToLiveOnly = false;
  else if (chave === "furnishedOnly") n.furnishedOnly = false;
  else n.comodidades = n.comodidades.filter((c) => c !== chave);
  return n;
}

/** Mantém o local só se ele existir no catálogo (a IA nunca inventa lugar). */
export function localExistente(local: string, locais: readonly string[]): string {
  const q = semAcento(local.trim());
  if (!q) return "";
  const achado = locais.find((l) => semAcento(l) === q) ?? locais.find((l) => semAcento(l).includes(q));
  return achado ?? "";
}
