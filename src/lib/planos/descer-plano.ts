/*
  Aviso ao descer de plano: os anúncios acima do limite do novo plano continuam no ar,
  mas não dá para publicar novos até ficar dentro do limite. Módulo puro (testável sem rede).
  Roda: node --test src/lib/planos/descer-plano.test.ts
*/
export const AVISO_DESCER_PLANO =
  "Seus anúncios acima do limite do novo plano continuam no ar, mas você não poderá publicar novos até ficar dentro do limite.";

/** Limite não finito (ilimitado) ou ausente nunca gera aviso. */
export function ficaAcimaDoLimite(anunciosAtivos: number, limite: number | null | undefined): boolean {
  if (limite == null || !Number.isFinite(limite)) return false;
  return anunciosAtivos > limite;
}
