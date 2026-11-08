/**
 * E704 (2/2) — o mapa de reserva (Leaflet + CARTO, o de produção) usa tiles SEM rótulos (`voyager_nolabels`): o nome que
 * o tile desenhava não é mais um palpite — a PÁGINA desenha o nome da cidade e o mesmo retângulo é o obstáculo do
 * afastamento de pinos. Outros nomes do tile (bairros, cidades vizinhas) deixam de existir, então nada mais é coberto.
 * (Texto antigo, sobre a versão que só estimava o ponto do rótulo do tile, abaixo.)
 *
 * E704 — mapa de reserva (Leaflet + CARTO, o que roda em produção sem token do Mapbox).
 * O nome da cidade vem desenhado DENTRO da imagem do tile; não existe dado de posição para ler (no Mapbox há:
 * `queryRenderedFeatures`). O tile rotula a cidade no ponto dela; esse ponto vira um obstáculo fixo do afastamento de
 * pinos. Tamanho estimado pelo nome (o tile cresce o texto com o zoom; a caixa tem folga para isso).
 * Só cidades listadas aqui: o nome de uma cidade vizinha que apareça em zoom aberto não é protegido.
 */
import type { Obstaculo } from "./pins-sem-sobreposicao.ts";

export const CIDADES_ROTULADAS: readonly { nome: string; lat: number; lng: number }[] = [
  // Ponto da cidade (o mesmo do Google Maps, usado em /admin/destinos), onde o mapa-base escreve "Uberlândia".
  { nome: "Uberlândia", lat: -18.9186, lng: -48.2772 },
];

/** Do zoom 15 em diante (a pé, rua a rua) o nome da cidade já não ajuda: some e deixa de ser obstáculo. */
export const ZOOM_MAXIMO_DO_ROTULO = 14;

/** O retângulo do nome, o MESMO que a página desenha e que o afastamento de pinos respeita. */
export function caixaDoRotulo(nome: string): { w: number; h: number } {
  return { w: Math.max(100, nome.length * 12), h: 26 };
}

export function obstaculosDeCidades(projetar: (lat: number, lng: number) => { x: number; y: number }, quadro: { w: number; h: number }, zoom: number = 12): Obstaculo[] {
  if (zoom > ZOOM_MAXIMO_DO_ROTULO) return [];
  return CIDADES_ROTULADAS.flatMap((c) => {
    const o = { ...projetar(c.lat, c.lng), ...caixaDoRotulo(c.nome) };
    const dentro = o.x + o.w / 2 > 0 && o.x - o.w / 2 < quadro.w && o.y + o.h / 2 > 0 && o.y - o.h / 2 < quadro.h;
    return dentro ? [o] : [];
  });
}
