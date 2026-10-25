/*
  Busca × anúncios de exemplo × porta do pedido de moradia (Prompt 30, item 6). PURO (node --test).
   • com pelo menos um imóvel real no resultado, os exemplos somem; sem nenhum real, aparecem (marcados "exemplo"
     pelo próprio cartão) — nunca na frente de um real;
   • menos de 3 imóveis REAIS → o cartão "Não achou?" leva ao pedido já preenchido.
*/
export const MIN_REAIS_SEM_CARTAO = 3;
export const TEXTO_CARTAO_PEDIDO = "Não achou? Publique um pedido e os proprietários vêm até você";
export const TEXTO_PUBLICAR_PEDIDO = "Publicar pedido";
export const TEXTO_PUBLICAR_PEDIDO_MORADIA = "Publicar pedido de moradia";

/** `?exemplos=1`: mantém os exemplos na lista mesmo com imóvel real (só para o laboratório e o QA). */
export function exemplosForcadosNaUrl(search: string): boolean {
  return new URLSearchParams(search).get("exemplos") === "1";
}

export function semExemplosQuandoHaReal<T>(lista: T[], ehExemplo: (x: T) => boolean, forcarExemplos = false): T[] {
  if (forcarExemplos) return lista;
  const reais = lista.filter((x) => !ehExemplo(x));
  return reais.length > 0 ? reais : lista;
}

export function mostrarCartaoPedido(lista: { id: string }[], ehExemplo: (x: { id: string }) => boolean): boolean {
  return lista.filter((x) => !ehExemplo(x)).length < MIN_REAIS_SEM_CARTAO;
}

/**
 * E131: a base da busca, UMA para a lista e para todas as contagens (pílulas, facetas e "Mostrar N"). A regra acima
 * (com imóvel real, os exemplos saem) é decidida uma vez, sobre a busca sem os filtros da folha — e não de novo em
 * cada subconjunto. Antes, cada contagem reaplicava a regra no próprio recorte: sem nenhum real naquele recorte, os
 * exemplos voltavam, e a pílula dizia "14" com a lista mostrando "1".
 */
export function baseDaBusca<T>(base: T[], ehExemplo: (x: T) => boolean, forcarExemplos = false): T[] {
  return semExemplosQuandoHaReal(base, ehExemplo, forcarExemplos);
}

/** Quantos a lista mostraria com este filtro: sempre um recorte da base da busca (nunca maior que ela). */
export function contarNaBase<T>(baseVisivel: T[], passa: (x: T) => boolean): number {
  return baseVisivel.filter(passa).length;
}
