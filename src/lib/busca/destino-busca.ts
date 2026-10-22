/*
  Destino da busca (prompt 37) na URL — regras PURAS.
  ?destino=hc-ufu&modo=carro&ate=20  (destino cadastrado)
  ?dlat=-18.92&dlng=-48.26&drot=Av.+Pará,+Umuarama&modo=a_pe  (endereço digitado: ponto com 2 casas, rótulo sem número)
*/
import { ATE_OPCOES, ehModo, pontoDaUrl, pontoParaUrl, rotuloLimpo, type ModoRota } from "../rotas/tempo.ts";

export type DestinoBusca = { slug: string } | { lat: number; lng: number; rot: string };
export interface EstadoDestino {
  destino: DestinoBusca | null;
  modo: ModoRota;
  /** 0 = sem limite. */
  ate: number;
}

const SLUG = /^[a-z0-9-]{2,60}$/;

export function destinoDaUrl(sp: URLSearchParams): EstadoDestino {
  const modoUrl = sp.get("modo");
  const modo: ModoRota = ehModo(modoUrl) ? modoUrl : "carro";
  const ateNum = Number(sp.get("ate"));
  const ate = (ATE_OPCOES as readonly number[]).includes(ateNum) ? ateNum : 0;
  const slug = sp.get("destino");
  if (slug && SLUG.test(slug)) return { destino: { slug }, modo, ate };
  const p = pontoDaUrl(sp.get("dlat"), sp.get("dlng"));
  if (p) return { destino: { lat: p.lat, lng: p.lng, rot: rotuloLimpo(sp.get("drot") ?? "") }, modo, ate };
  return { destino: null, modo, ate: 0 };
}

/** Escreve (ou apaga) o destino nos parâmetros da URL. */
export function destinoNaUrl(params: URLSearchParams, e: EstadoDestino): void {
  for (const k of ["destino", "dlat", "dlng", "drot", "modo", "ate"]) params.delete(k);
  if (!e.destino) return;
  if ("slug" in e.destino) params.set("destino", e.destino.slug);
  else {
    const { dlat, dlng } = pontoParaUrl(e.destino);
    params.set("dlat", dlat);
    params.set("dlng", dlng);
    const rot = rotuloLimpo(e.destino.rot);
    if (rot) params.set("drot", rot);
  }
  params.set("modo", e.modo);
  if (e.ate) params.set("ate", String(e.ate));
}

/** Corpo do pedido a /api/tempos (o mesmo formato da URL). */
export function corpoDoDestino(d: DestinoBusca): Record<string, string> {
  if ("slug" in d) return { destino: d.slug };
  const { dlat, dlng } = pontoParaUrl(d);
  return { dlat, dlng, drot: rotuloLimpo(d.rot) };
}

export const chaveDoDestino = (d: DestinoBusca | null) => (!d ? "" : "slug" in d ? d.slug : `${d.lat.toFixed(2)},${d.lng.toFixed(2)}`);
