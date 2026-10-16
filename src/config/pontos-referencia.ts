/*
  Pontos de referência para a distância nas páginas de bairro (ordem 7000fbe0, tela 5).
  Só ponto PÚBLICO (hospital, campus, centro, rodoviária) — nunca endereço de anúncio.
  `verificado: false` = coordenada ainda sem conferência na fonte (OpenStreetMap): a
  página NÃO mostra distância até alguém conferir e virar a chave. Preencher lat/lng
  com o valor da fonte e registrar a fonte em `fonte`.
*/
export interface PontoReferencia {
  slug: string;
  nome: string;
  cidade: string; // slug da cidade
  lat: number;
  lng: number;
  verificado: boolean;
  fonte: string;
}

export const PONTOS_REFERENCIA: readonly PontoReferencia[] = [
  { slug: "hc-ufu", nome: "HC-UFU", cidade: "uberlandia", lat: 0, lng: 0, verificado: false, fonte: "pendente: conferir no OpenStreetMap" },
  { slug: "campus-umuarama", nome: "Campus Umuarama (UFU)", cidade: "uberlandia", lat: 0, lng: 0, verificado: false, fonte: "pendente: conferir no OpenStreetMap" },
  { slug: "campus-santa-monica", nome: "Campus Santa Mônica (UFU)", cidade: "uberlandia", lat: 0, lng: 0, verificado: false, fonte: "pendente: conferir no OpenStreetMap" },
  { slug: "centro", nome: "Centro", cidade: "uberlandia", lat: 0, lng: 0, verificado: false, fonte: "pendente: conferir no OpenStreetMap" },
  { slug: "rodoviaria", nome: "Rodoviária", cidade: "uberlandia", lat: 0, lng: 0, verificado: false, fonte: "pendente: conferir no OpenStreetMap" },
];
