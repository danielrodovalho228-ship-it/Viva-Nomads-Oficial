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

export function semExemplosQuandoHaReal<T>(lista: T[], ehExemplo: (x: T) => boolean): T[] {
  const reais = lista.filter((x) => !ehExemplo(x));
  return reais.length > 0 ? reais : lista;
}

export function mostrarCartaoPedido(lista: { id: string }[], ehExemplo: (x: { id: string }) => boolean): boolean {
  return lista.filter((x) => !ehExemplo(x)).length < MIN_REAIS_SEM_CARTAO;
}
