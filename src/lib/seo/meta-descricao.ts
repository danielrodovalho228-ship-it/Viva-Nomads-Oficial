/*
  META DESCRIPTION GERADA (ordem 49c2dbef): acima de 155 caracteres o Google corta o texto.
  Os geradores de home, polos, bairros e anúncio passam por limitarMeta, então um nome longo
  de bairro ou cidade nunca estoura. Só nomes de bairro/cidade: sem endereço, sem coordenada.
*/
import type { Polo } from "../polos.ts";

export const LIMITE_META = 155;

/** Corta em palavra inteira e termina em "…" quando passa do limite. */
export function limitarMeta(texto: string): string {
  if (texto.length <= LIMITE_META) return texto;
  const corte = texto.slice(0, LIMITE_META - 1);
  const ate = corte.lastIndexOf(" ");
  return `${(ate > 0 ? corte.slice(0, ate) : corte).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

export function descricaoHome(): string {
  return limitarMeta(
    "Imóveis mobiliados e prontos para morar, para estadias de 30 a 180 dias. Contrato com validade jurídica e conversa registrada na plataforma.",
  );
}

export function descricaoPolo(polo: Pick<Polo, "referencia">, cidade: string): string {
  return limitarMeta(
    `Imóveis mobiliados para estadias de 30 a 180 dias perto de ${polo.referencia}, em ${cidade}. Valor médio por mês, perguntas frequentes e anúncios reais.`,
  );
}

export function descricaoBairro(bairro: string, cidade: string): string {
  return limitarMeta(
    `Imóveis mobiliados em ${bairro}, ${cidade}, para estadias de 30 a 180 dias. Mapa da área, distâncias e anúncios reais.`,
  );
}
