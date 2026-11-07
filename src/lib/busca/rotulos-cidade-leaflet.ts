/**
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

export function obstaculosDeCidades(projetar: (lat: number, lng: number) => { x: number; y: number }, quadro: { w: number; h: number }): Obstaculo[] {
  return CIDADES_ROTULADAS.flatMap((c) => {
    const o = { ...projetar(c.lat, c.lng), w: Math.max(100, c.nome.length * 12), h: 26 };
    const dentro = o.x + o.w / 2 > 0 && o.x - o.w / 2 < quadro.w && o.y + o.h / 2 > 0 && o.y - o.h / 2 < quadro.h;
    return dentro ? [o] : [];
  });
}
