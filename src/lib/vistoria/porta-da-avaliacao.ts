/*
  E1104 (ORDEM-DUET-470) — a porta da avaliação do imóvel na grade de Serviços. Regras puras (sem banco, sem tela):
   • o cartão "Avaliação do imóvel" é de TODO dono (tem imóvel, ou se cadastrou como proprietário); o morador não o vê;
   • sem avaliação em curso, o cartão leva à porta (escolher o imóvel e começar o pedido); com avaliação em curso, leva
     direto ao pedido em curso, na página do nível do imóvel;
   • fora do piloto (a avaliação fechada para a conta), o destino é a porta com o estado honesto: o serviço ainda não
     chegou à cidade. Nunca a página do imóvel, onde o bloco da avaliação não aparece (seria um beco).
  E1125 (ORDEM-DUET-539) — dois resíduos:
   • o cartão só existe no papel de PROPRIETÁRIO. "Ser dono" (ter imóvel, ou o cadastro de proprietário) é da conta; o
     papel é o que a pessoa está a usar agora. A conta de dono a usar o painel como moradora, ou como parceira, não o vê;
   • com UMA avaliação em curso o cartão leva direto a ela; com mais de uma leva à porta, que as lista da pedida mais
     recentemente para a mais antiga e diz de quando é cada pedido. Nunca escolhe uma em silêncio.
*/
import { dataBRT } from "../datas-brasilia.ts";
import { DESCRICAO_DA_AVALIACAO } from "./telas-exibicao.ts";

export const HREF_PORTA_AVALIACAO = "/dashboard/servicos/avaliacao";
/** A âncora do bloco da avaliação na página do nível do imóvel. */
export const ANCORA_AVALIACAO_NO_IMOVEL = "avaliacao-do-imovel";
export const hrefDaAvaliacaoNoImovel = (propertyId: string): string => `/dashboard/imoveis/${propertyId}/nivel#${ANCORA_AVALIACAO_NO_IMOVEL}`;

/** O pedido de avaliação ainda está a andar (os mesmos estados que o bloco do dono mostra como pedido aberto). */
export const STATUS_PEDIDO_EM_CURSO = ["pedido", "designado", "agendado", "realizada"] as const;

export interface ImovelNaPorta {
  id: string;
  titulo: string;
  cidade: string | null;
  emCurso: boolean;
  /** Quando o pedido em curso foi feito (o mais recente, se o imóvel tiver mais de um); null sem pedido em curso. */
  pedidoEm: string | null;
}

export type PapelNaPorta = "morador" | "proprietario" | "parceiro";

/**
 * E1125: o papel que a conta está a usar, pela mesma ordem do painel — a parceria escolhida e aprovada vale como
 * parceiro; senão, o modo (proprietário ou morador). Conta nova, sem modo decidido, não é proprietário.
 */
export function papelEmUso(e: { modo: "owner" | "tenant" | null; parceiro: boolean }): PapelNaPorta {
  if (e.parceiro) return "parceiro";
  return e.modo === "owner" ? "proprietario" : "morador";
}

/** E1125: o cartão é do dono NO PAPEL DE DONO. Papel não lido (null) = sem cartão. */
export function podeVerOCartao(e: { dono: boolean; papel: PapelNaPorta | null }): boolean {
  return e.dono && e.papel === "proprietario";
}

/** Dono para a porta: tem imóvel na conta, ou se cadastrou como proprietário (dono novo, ainda sem imóvel). */
export function ehDonoParaAPorta(e: { imoveis: number; role: string | null }): boolean {
  return e.imoveis > 0 || e.role === "owner";
}

export type EstadoDaPorta = "a_chegar" | "sem_imovel" | "escolher";

export function estadoDaPorta(e: { chaveAberta: boolean; imoveis: number }): EstadoDaPorta {
  if (!e.chaveAberta) return "a_chegar";
  return e.imoveis > 0 ? "escolher" : "sem_imovel";
}

/**
 * Para onde o cartão leva. E1125: só vai direto ao pedido quando há UMA avaliação em curso; com mais de uma, a porta
 * (a lista) — escolher uma sem dizer qual deixava a pessoa na avaliação errada.
 */
export function hrefDoCartaoDaAvaliacao(e: { chaveAberta: boolean; imoveis: ImovelNaPorta[] }): string {
  if (!e.chaveAberta) return HREF_PORTA_AVALIACAO;
  const emCurso = e.imoveis.filter((i) => i.emCurso);
  return emCurso.length === 1 ? hrefDaAvaliacaoNoImovel(emCurso[0].id) : HREF_PORTA_AVALIACAO;
}

/**
 * E1125: a ordem da porta — primeiro os imóveis com avaliação em curso, da pedida mais recentemente para a mais antiga;
 * depois os outros, na ordem em que vieram (do imóvel mais recente para o mais antigo). Devolve uma lista nova.
 */
export function ordenarParaAPorta(imoveis: ImovelNaPorta[]): ImovelNaPorta[] {
  const instante = (i: ImovelNaPorta) => (i.pedidoEm ? Date.parse(i.pedidoEm) || 0 : 0);
  const emCurso = imoveis.filter((i) => i.emCurso).sort((a, b) => instante(b) - instante(a));
  return [...emCurso, ...imoveis.filter((i) => !i.emCurso)];
}

/** E1125: com mais de uma avaliação em curso, a porta diz quantas são; com uma ou nenhuma, não há o que escolher. */
export function textoVariasEmCurso(emCurso: number): string | null {
  return emCurso > 1 ? `Você tem ${emCurso} avaliações em curso. Escolha qual abrir.` : null;
}

/** E1125: de quando é o pedido em curso do imóvel (data de Brasília). */
export function linhaDoPedidoEmCurso(pedidoEm: string | null): string | null {
  if (!pedidoEm) return null;
  const dia = dataBRT(pedidoEm);
  return dia === "—" ? null : `Avaliação pedida em ${dia}`;
}

export const ROTULO_PEDIR_NA_PORTA = "Pedir avaliação";
export const ROTULO_VER_PEDIDO_NA_PORTA = "Ver o pedido em curso";

export function acaoDoImovelNaPorta(i: ImovelNaPorta): { rotulo: string; href: string } {
  return { rotulo: i.emCurso ? ROTULO_VER_PEDIDO_NA_PORTA : ROTULO_PEDIR_NA_PORTA, href: hrefDaAvaliacaoNoImovel(i.id) };
}

// ── Os textos da porta ─────────────────────────────────────────────────────────────────────────────────────────
export const TITULO_DA_PORTA = "Avaliação do imóvel";
/** E1158 (13): a descrição da avaliação vem da fonte única (telas-exibicao). */
export const SUBTITULO_DA_PORTA = DESCRICAO_DA_AVALIACAO;
export const TITULO_ESCOLHER_IMOVEL = "Escolha o imóvel";
export const TEXTO_ESCOLHER_IMOVEL = "O pedido é feito na página do nível de cada imóvel. Depois de pedir, você escolhe o avaliador na lista da cidade do imóvel.";
export const TITULO_SEM_IMOVEL = "Você ainda não tem imóvel anunciado";
export const TEXTO_SEM_IMOVEL = "A avaliação é pedida na página de cada imóvel. Anuncie o imóvel e volte aqui para pedir.";
export const ROTULO_ANUNCIAR = "Anunciar imóvel";
export const ROTULO_OUTROS_SERVICOS = "Ver os outros serviços";

/** Fora do piloto: o estado honesto. Diz a cidade quando a conta tem uma. */
export function textoAChegar(cidade: string | null): { titulo: string; texto: string } {
  return {
    titulo: `A avaliação do imóvel ainda não chegou ${cidade ? `a ${cidade}` : "à sua cidade"}`,
    texto: "Estamos credenciando avaliadores e abrindo o serviço cidade por cidade. Quando abrir para a sua conta, o pedido aparece aqui e na página do nível de cada imóvel.",
  };
}
