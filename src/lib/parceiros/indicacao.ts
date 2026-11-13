/**
 * E304 (QA 31/10): o link que quem indica manda ao profissional — o pedido de parceria já na categoria buscada — e a
 * cidade da busca com a UF inferida quando o nome é único no Brasil (sem UF, o "Quero ser avisado" ficava desligado).
 */
import { acharCidade } from "../cidades.ts";

/**
 * E880: o destino do link de indicação, dito na tela (antes o botão só copiava/compartilhava e o destino ficava oculto).
 */
export const TEXTO_DESTINO_INDICACAO = "O link abre o pedido de parceria da Viva, já nesta categoria: a pessoa faz o pedido com a conta dela.";

/**
 * E880: caminhos SEM conta para quem só quer um parceiro (o "Quero ser avisado" pede conta porque grava o aviso com o
 * contato do perfil). Com cidade na busca: a mesma categoria em todas as cidades; sempre: falar com a Viva.
 */
export function caminhosSemConta(p: { categoria: string; cidade: string }): { href: string; rotulo: string }[] {
  const c = p.categoria && /^[a-z]+$/.test(p.categoria) ? p.categoria : "";
  const out: { href: string; rotulo: string }[] = [];
  if (p.cidade.trim()) out.push({ href: `/parceiros/buscar${c ? `?categoria=${c}` : ""}`, rotulo: "Ver em todas as cidades" });
  out.push({ href: "/ajuda/fale-com-a-viva", rotulo: "Falar com a Viva" });
  return out;
}

export function caminhoIndicacao(categoria: string): string {
  const c = categoria && /^[a-z]+$/.test(categoria) ? categoria : "";
  return `/parceiros${c ? `?categoria=${c}` : ""}#quero-ser-parceiro`;
}

/** A UF da cidade quando ela existe em UMA UF só (ex.: "Uberlândia" → MG); ambígua ou inexistente, null. */
export function ufUnicaDaCidade(cidade: string, municipios: Record<string, readonly string[]>): { cidade: string; uf: string } | null {
  if (!cidade.trim()) return null;
  const achadas = Object.entries(municipios).flatMap(([uf, lista]) => {
    const c = acharCidade(lista, cidade);
    return c ? [{ cidade: c, uf }] : [];
  });
  return achadas.length === 1 ? achadas[0]! : null;
}

/**
 * E304 (vigia 31/10): os estados onde existe uma cidade com esse nome (ex.: "Bom Jesus" → vários). O aviso de parceiro
 * oferece só esses estados para a pessoa escolher, em vez de deixar o "Quero ser avisado" desligado.
 */
export function ufsDaCidade(cidade: string, municipios: Record<string, readonly string[]>): string[] {
  if (!cidade.trim()) return [];
  return Object.entries(municipios)
    .filter(([, lista]) => acharCidade(lista, cidade))
    .map(([uf]) => uf)
    .sort();
}
