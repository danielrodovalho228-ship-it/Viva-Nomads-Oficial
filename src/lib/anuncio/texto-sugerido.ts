/*
  E148-A — TÍTULO E DESCRIÇÃO SUGERIDOS NO PASSO 7 (PURO). Quando a IA não responde (desligada, 503, limite do dia ou
  erro), o passo nunca abre vazio: este modelo fixo monta título e descrição só com o que o dono já informou no
  cadastro. Nada inventado, nada de endereço exato, contato ou nome de pessoa.
*/
import { PROPERTY_TYPES } from "../amenities.ts";

export interface DadosTextoSugerido {
  tipo: string;
  quartos?: number;
  banheiros?: number;
  areaM2?: number;
  bairro?: string;
  cidade?: string;
  internetMbps?: number;
  semInternet?: boolean;
  /** Rótulos das comodidades marcadas, na ordem em que aparecem no Passo 5 (as 5 primeiras entram na descrição). */
  comodidades?: string[];
}

/** Nome curto do tipo para o título ("Studio / kitnet" → "Studio"). */
const NOME_CURTO: Record<string, string> = {
  studio: "Studio",
  flat: "Flat",
  chacara: "Chácara",
  casa_condominio: "Casa em condomínio",
  quarto: "Quarto privativo",
};
const FEMININOS = new Set(["casa", "casa_condominio", "cobertura", "chacara"]);

function nomeDoTipo(tipo: string): string {
  return NOME_CURTO[tipo] ?? PROPERTY_TYPES.find((t) => t.value === tipo)?.label ?? "Imóvel";
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "{Tipo} mobiliado de {N} quarto(s) no {bairro}" — sem número de quartos em studio e quarto privativo. */
export function tituloDoModelo(d: DadosTextoSugerido): string {
  const mobiliado = FEMININOS.has(d.tipo) ? "mobiliada" : "mobiliado";
  const partes = [`${nomeDoTipo(d.tipo)} ${mobiliado}`];
  if (d.quartos && d.quartos > 0 && d.tipo !== "studio" && d.tipo !== "quarto") partes.push(`de ${plural(d.quartos, "quarto", "quartos")}`);
  const lugar = d.bairro?.trim() ? `no ${d.bairro.trim()}` : d.cidade?.trim() ? `em ${d.cidade.trim()}` : "";
  if (lugar) partes.push(lugar);
  return partes.join(" ").slice(0, 80);
}

/** Descrição curta: quartos, banheiros, área, internet e as 5 primeiras comodidades; fecha com as estadias da Viva. */
export function descricaoDoModelo(d: DadosTextoSugerido): string {
  const mobiliado = FEMININOS.has(d.tipo) ? "mobiliada" : "mobiliado";
  const espaco = [
    d.quartos && d.tipo !== "studio" ? plural(d.quartos, "quarto", "quartos") : null,
    d.banheiros ? plural(d.banheiros, "banheiro", "banheiros") : null,
    d.areaM2 ? `${d.areaM2} m²` : null,
  ].filter(Boolean) as string[];
  const frases: string[] = [];
  const base = `${nomeDoTipo(d.tipo)} ${mobiliado}`;
  frases.push(espaco.length ? `${base} com ${juntar(espaco)}.` : `${base}, ${FEMININOS.has(d.tipo) ? "pronta" : "pronto"} para morar.`);
  if (d.internetMbps && d.internetMbps > 0) frases.push(`Internet de ${d.internetMbps} Mbps.`);
  else if (d.semInternet) frases.push("Sem internet instalada.");
  const top = (d.comodidades ?? []).filter((c) => c.trim()).slice(0, 5);
  if (top.length) frases.push(`Tem ${juntar(top.map((c) => c.toLowerCase()))}.`);
  frases.push("Para estadias de 30 a 180 dias.");
  return frases.join(" ");
}

function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

export function textoDoModelo(d: DadosTextoSugerido): { titulo: string; descricao: string } {
  return { titulo: tituloDoModelo(d), descricao: descricaoDoModelo(d) };
}

/** O passo pede a sugestão sozinho só quando título E descrição estão vazios (nunca por cima do texto do dono). */
export const pedeSugestaoAoEntrar = (titulo: string, descricao: string) => !titulo.trim() && !descricao.trim();

/**
 * Onde a sugestão pode entrar: só nos campos ainda vazios, ou nos que continuam exatamente iguais à sugestão anterior
 * (o dono não mexeu). Texto escrito pelo dono nunca é sobrescrito sem a confirmação do "Gerar de novo".
 */
export function camposQueRecebem(atual: { titulo: string; descricao: string }, anterior: { titulo: string; descricao: string } | null) {
  const livre = (valor: string, sugerido?: string) => !valor.trim() || (sugerido !== undefined && valor === sugerido);
  return { titulo: livre(atual.titulo, anterior?.titulo), descricao: livre(atual.descricao, anterior?.descricao) };
}

/** O dono já escreveu algo diferente da última sugestão? Então "Gerar de novo" pede confirmação antes de trocar. */
export function donoEscreveu(atual: { titulo: string; descricao: string }, anterior: { titulo: string; descricao: string } | null): boolean {
  const q = camposQueRecebem(atual, anterior);
  return !q.titulo || !q.descricao;
}
