/**
 * E1048: o cartão do proprietário conta os anúncios ativos do dono. Para o dono real, a contagem é a da vitrine (E631:
 * o que a página pública dele lista, sem anúncio de teste). Para o dono CONTA DE TESTE, a vitrine tira todos os
 * anúncios dele (E131) e o cartão dizia "0 imóveis na Viva" na página do próprio anúncio — aí conta os ativos dele.
 */
export function cartaoContaAnunciosDeTeste(dono: { is_teste?: boolean | null } | null | undefined): boolean {
  return dono?.is_teste === true;
}
