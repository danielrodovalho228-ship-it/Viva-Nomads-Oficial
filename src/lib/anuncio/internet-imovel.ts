/*
  E102-B — "tem internet?" numa função só (PURO). O padrão mínimo da Viva exige internet no imóvel (item
  "Internet informada" do Essencial, conforto-minimo.ts). Quem responde "Não tem internet" pode salvar o rascunho, mas
  não publica: o motivo é a falta de internet, não a velocidade em branco (o campo de Mbps nem é pedido).
  Hoje só a chácara/sítio pergunta o tipo de internet (detalhes_anuncio.chacara.internet); um tipo de imóvel que um dia
  ganhe a mesma pergunta entra em tipoInternetDoAnuncio e segue a mesma regra.
*/
import { ehChacara } from "./chacara.ts";

/** Valor da resposta "Não tem internet" no tipo de internet. */
export const SEM_INTERNET = "nao_tem";
export const ROTULO_SEM_INTERNET = "Não tem internet";
/** O que o Passo 5 mostra no lugar do campo de velocidade. */
export const SEM_INTERNET_NO_IMOVEL = "Sem internet no imóvel";
/** Motivo na revisão e na lista "Falta resolver". */
export const MOTIVO_SEM_INTERNET = 'Internet: o padrão mínimo da Viva exige internet no imóvel (item "Internet informada" do Essencial).';

/** O imóvel tem internet? Só a resposta "Não tem internet" diz que não; sem resposta (ou tipo sem a pergunta), tem. */
export const temInternet = (tipoInternet: string | null | undefined): boolean => tipoInternet !== SEM_INTERNET;

/** O tipo de internet gravado no anúncio, para qualquer tipo de imóvel que tenha a pergunta (hoje, só chácara/sítio). */
export function tipoInternetDoAnuncio(tipoImovel: string | null | undefined, detalhes: unknown): string | null {
  if (!ehChacara(tipoImovel) || !detalhes || typeof detalhes !== "object" || Array.isArray(detalhes)) return null;
  const chacara = (detalhes as { chacara?: { internet?: unknown } | null }).chacara;
  return typeof chacara?.internet === "string" ? chacara.internet : null;
}
