/*
  E79 — a distância até o destino ativo (âncora oficial ou local pessoal) SEMPRE visível: no cartão da /buscar e na
  página do imóvel. Enquanto não houver rota, é a linha reta, dita como tal ("≈ 1,4 km em linha reta até …") — nunca
  minutos sem rota real. PURO.
  • Vale o que o servidor devolve (/api/tempos: minutos de rota ou a mesma linha reta); para o imóvel que o servidor
    não traz (anúncio de exemplo, ponto público sem o exato), a mesma conta aqui, com o ponto PÚBLICO (aproximado).
  • A ordem "Mais perto do trabalho" usa o mesmo valor: posição do servidor primeiro; depois, a distância.
*/
import { comArtigo, metrosEntre, rotuloReta, type Ponto } from "../rotas/tempo.ts";
import type { DestinoBusca } from "./destino-busca.ts";

export interface AncoraComPonto {
  slug: string;
  nome: string;
  artigo?: "o" | "a" | "";
  lat?: number | null;
  lng?: number | null;
}

/** Ponto e rótulo do destino ativo: o local digitado traz os dois; a âncora, o ponto cadastrado (público). */
export function pontoDoDestino(d: DestinoBusca | null, ancoras: readonly AncoraComPonto[]): { ponto: Ponto; rotulo: string } | null {
  if (!d) return null;
  if (!("slug" in d)) return Number.isFinite(d.lat) && Number.isFinite(d.lng) ? { ponto: { lat: d.lat, lng: d.lng }, rotulo: d.rot || "o endereço informado" } : null;
  const a = ancoras.find((x) => x.slug === d.slug);
  if (!a || a.lat == null || a.lng == null) return null;
  return { ponto: { lat: Number(a.lat), lng: Number(a.lng) }, rotulo: comArtigo(a.nome, a.artigo ?? "") };
}

export interface DistanciaNaTela {
  texto: string;
  metros: number;
}

/** Linha reta do ponto público do imóvel até o destino. Sem ponto, null (o cartão fica sem a linha). */
export function distanciaAte(imovel: { lat?: number | null; lng?: number | null }, destino: { ponto: Ponto; rotulo: string } | null): DistanciaNaTela | null {
  if (!destino || imovel.lat == null || imovel.lng == null || !Number.isFinite(Number(imovel.lat)) || !Number.isFinite(Number(imovel.lng))) return null;
  const metros = metrosEntre({ lat: Number(imovel.lat), lng: Number(imovel.lng) }, destino.ponto);
  return { texto: rotuloReta(metros, destino.rotulo), metros };
}

/**
 * O texto do cartão: o do servidor quando chegou; senão a linha reta daqui; "calculando…" só enquanto o servidor ainda
 * não respondeu E não há linha reta para mostrar. Nunca some depois de calcular.
 */
export function textoDoCartao(servidor: string | undefined, local: DistanciaNaTela | null, carregando: boolean): string | null {
  if (servidor) return servidor;
  if (local) return local.texto;
  return carregando ? "calculando…" : null;
}

/** Ordem "Mais perto do trabalho": posição do servidor (rota ou faixas) primeiro; o resto pela distância em linha reta. */
export function ordenarPorDestino<T extends { id: string }>(lista: readonly T[], pos: (id: string) => number | null | undefined, metros: (p: T) => number | null): T[] {
  const chave = (p: T): [number, number] => {
    const s = pos(p.id);
    if (s != null) return [0, s];
    const m = metros(p);
    return [1, m ?? Number.MAX_SAFE_INTEGER];
  };
  return [...lista].sort((a, b) => {
    const [ga, va] = chave(a);
    const [gb, vb] = chave(b);
    return ga - gb || va - vb;
  });
}
