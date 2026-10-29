/**
 * E225-A — que ponto de referência (config/pontos-referencia.ts) conta como hospital e qual como universidade para os
 * selos "Perto de hospital" / "Perto de universidade" (calculados pela localização, nunca declarados). Só entram
 * pontos PÚBLICOS já listados lá; a distância só vale com `verificado: true` (coordenada conferida na fonte). Sem
 * ponto verificado na cidade, o selo não aparece — nunca um ponto inventado.
 */
export const TIPO_PONTO_SELO: Readonly<Record<string, "hospital" | "universidade">> = {
  "hc-ufu": "hospital",
  "campus-umuarama": "universidade",
  "campus-santa-monica": "universidade",
};
