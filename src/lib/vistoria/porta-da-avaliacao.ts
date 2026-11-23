/*
  E1104 (ORDEM-DUET-470) — a porta da avaliação do imóvel na grade de Serviços. Regras puras (sem banco, sem tela):
   • o cartão "Avaliação do imóvel" é de TODO dono (tem imóvel, ou se cadastrou como proprietário); o morador não o vê;
   • sem avaliação em curso, o cartão leva à porta (escolher o imóvel e começar o pedido); com avaliação em curso, leva
     direto ao pedido em curso, na página do nível do imóvel;
   • fora do piloto (a avaliação fechada para a conta), o destino é a porta com o estado honesto: o serviço ainda não
     chegou à cidade. Nunca a página do imóvel, onde o bloco da avaliação não aparece (seria um beco).
*/

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
}

/** Dono para a porta: tem imóvel na conta, ou se cadastrou como proprietário (dono novo, ainda sem imóvel). */
export function ehDonoParaAPorta(e: { imoveis: number; role: string | null }): boolean {
  return e.imoveis > 0 || e.role === "owner" || e.role === "tenant";
}

export type EstadoDaPorta = "a_chegar" | "sem_imovel" | "escolher";

export function estadoDaPorta(e: { chaveAberta: boolean; imoveis: number }): EstadoDaPorta {
  if (!e.chaveAberta) return "a_chegar";
  return e.imoveis > 0 ? "escolher" : "sem_imovel";
}

/** Para onde o cartão leva. `imoveis` vem do mais recente para o mais antigo. */
export function hrefDoCartaoDaAvaliacao(e: { chaveAberta: boolean; imoveis: ImovelNaPorta[] }): string {
  if (!e.chaveAberta) return HREF_PORTA_AVALIACAO;
  const emCurso = e.imoveis.find((i) => i.emCurso);
  return emCurso ? hrefDaAvaliacaoNoImovel(emCurso.id) : HREF_PORTA_AVALIACAO;
}

export const ROTULO_PEDIR_NA_PORTA = "Pedir avaliação";
export const ROTULO_VER_PEDIDO_NA_PORTA = "Ver o pedido em curso";

export function acaoDoImovelNaPorta(i: ImovelNaPorta): { rotulo: string; href: string } {
  return { rotulo: i.emCurso ? ROTULO_VER_PEDIDO_NA_PORTA : ROTULO_PEDIR_NA_PORTA, href: hrefDaAvaliacaoNoImovel(i.id) };
}

// ── Os textos da porta ─────────────────────────────────────────────────────────────────────────────────────────
export const TITULO_DA_PORTA = "Avaliação do imóvel";
export const SUBTITULO_DA_PORTA = "Um avaliador credenciado visita o imóvel e assina o laudo com o nível dele.";
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
