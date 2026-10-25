/*
  FILTROS-1 (E42, E6/E16, E40) — facetas honestas da folha de filtros da /buscar. PURO.

  Toda opção mostra quantos imóveis a busca teria com ela ligada (a MESMA função da lista e do "Mostrar N imóveis",
  então o número do chip é o que aparece ao aplicar — a contagem nunca muda em silêncio). Opção com 0 fica desabilitada
  (não prende ninguém num "Nenhum imóvel"), exceto a já escolhida, que precisa continuar clicável para ser desligada.

  Internet medida (E40): a seção só existe quando algum anúncio da busca atual (a MESMA base do contar(), antes do filtro
  de internet) tem medição válida. Adendo 3: aí aparecem as faixas 50/100/300, cada uma com a contagem (faixa em 0
  desativada). Sem medição, a seção some e o filtro de internet que veio na URL é ignorado (filtroInternetEfetivo).
*/
import { CHIPS_INTERNET, downloadMedido, type ImovelComInternet } from "./filtro-internet.ts";
import type { FiltrosPainel } from "./painel-filtros.ts";
import type { ComodidadeFiltro } from "./filtro-comodidades.ts";
import type { PortePet } from "../anuncio/pets-regras.ts";

export interface Faceta {
  n: number;
  desabilitado: boolean;
}

/** Contagem 0 desabilita, menos a opção já ligada (senão não dá para desligar). */
export function faceta(n: number, ativo: boolean): Faceta {
  return { n, desabilitado: n === 0 && !ativo };
}

type Contar = (f: FiltrosPainel) => number;
type EscolhaUnica = "maxPrice" | "minBedrooms" | "periodo" | "tipo" | "garantia" | "internetMin";
type Interruptor = "petsOnly" | "homeOfficeOnly" | "readyToLiveOnly" | "notaOnly" | "gestorOnly" | "soInternetMedida" | "datasFlexiveis";

/** Faceta de uma opção de escolha única: a busca com ESTA opção no lugar da atual. */
export function facetaUnica<K extends EscolhaUnica>(contar: Contar, r: FiltrosPainel, k: K, v: FiltrosPainel[K]): Faceta {
  return faceta(contar({ ...r, [k]: v }), r[k] === v);
}

/** Faceta de um interruptor (liga/desliga): a busca com ele LIGADO. */
export function facetaInterruptor(contar: Contar, r: FiltrosPainel, k: Interruptor): Faceta {
  return faceta(contar({ ...r, [k]: true }), !!r[k]);
}

/** Comodidade: a busca com ela somada às já escolhidas (precisa ter todas). */
export function facetaComodidade(contar: Contar, r: FiltrosPainel, c: ComodidadeFiltro): Faceta {
  const ligado = r.comodidades.includes(c);
  return faceta(contar({ ...r, comodidades: ligado ? r.comodidades : [...r.comodidades, c] }), ligado);
}

/** Porte do pet: só existe com "Aceita pets" ligado. */
export function facetaPorte(contar: Contar, r: FiltrosPainel, v: PortePet): Faceta {
  return faceta(contar({ ...r, petsOnly: true, petPorte: v }), r.petPorte === v);
}

export const TEXTO_SEM_INTERNET_MEDIDA = "A internet medida aparece quando algum anúncio desta busca tiver a velocidade medida.";

/** Downloads válidos (Mbps) dos anúncios da busca atual — a base das faixas de internet medida. */
export function medicoesDaBusca(lista: readonly ImovelComInternet[], agora: Date = new Date()): number[] {
  return lista.map((p) => downloadMedido(p, agora)).filter((d): d is number => d !== null);
}

/** As faixas "a partir de" da seção: as três (50/100/300) quando a busca tem medição; sem medição, nenhuma. */
export function faixasInternet(medicoes: readonly number[]): readonly number[] {
  return medicoes.length > 0 ? CHIPS_INTERNET : [];
}

/** A seção de internet medida aparece? Só com pelo menos uma medição válida na busca atual. */
export function secaoInternetVisivel(medicoes: readonly number[]): boolean {
  return medicoes.length > 0;
}

/**
 * Adendo 3 (E40): sem medição na busca, `?internet=` / `?medida=1` são ignorados (o chip ativo sai e a lista não zera
 * por um filtro que nenhum anúncio pode cumprir).
 */
export function filtroInternetEfetivo<F extends Pick<FiltrosPainel, "internetMin" | "soInternetMedida">>(medicoes: readonly number[], f: F): F {
  return secaoInternetVisivel(medicoes) ? f : { ...f, internetMin: 0, soInternetMedida: false };
}
