/*
  E1079 (ORDEM-DUET-385/386), fatia 3 — o pedido do avaliador, como no mockup aprovado (avaliador-pedido): a foto do
  imóvel, o local, o porte, o valor e os botões "Aceitar pedido" e "Recusar". Regra PURA (testada em
  e1079-pedido-avaliador.test.ts); quem desenha é components/avaliadores/pedido.tsx.

  ORDEM-DUET-445 — o desenho entra SEM desfazer o E648 (o avaliador define o próprio valor e o próprio prazo, e o dono
  aceita a proposta):
   · "Aceitar pedido" abre, na mesma tela, os campos de valor e prazo de hoje;
   · o valor da tabela aparece como referência; "Você recebe R$ X" só depois de o dono aceitar a proposta;
   · bairro e cidade antes do aceite do dono; endereço completo depois;
   · sem a linha "Data pedida pelo dono" (o dono não pede data; quem agenda é o avaliador, depois do aceite).
*/
import { brl } from "../fiscal/documento.ts";
import { codigoDoImovel } from "../imovel-pagina.ts";
import { enderecoDaVisita, regiaoDaVisita } from "../visitas/endereco-visita.ts";
import { ROTULO_PORTE, type Porte } from "./regras.ts";
import { dataBRT } from "../datas-brasilia.ts";
import { prazoLaudo } from "./laudo.ts";
import { diasUteis } from "./prazos.ts";
import { precisaDoAceiteDoDono } from "./relogio-do-pedido.ts";

/** Em que ponto o pedido está para o avaliador escolhido. */
export type EtapaDoPedido = "novo" | "proposta_enviada" | "aceito";

export const ROTULO_ACEITAR_PEDIDO = "Aceitar pedido";
export const ROTULO_RECUSAR_PEDIDO = "Recusar";
export const ROTULO_ENVIAR_PROPOSTA = "Enviar proposta";
export const ETIQUETA_DO_PEDIDO: Record<EtapaDoPedido, string> = { novo: "Novo", proposta_enviada: "Proposta enviada", aceito: "Aceito pelo proprietário" };

/**
 * A etapa pelo estado gravado: sem resposta → novo; proposta enviada, à espera do dono; aceito pelo dono. Fora do
 * "designado", ou recusado/vencido, não é a tela do pedido.
 * E1101: "aceito" sem o aceite gravado só vale para a avaliação de teste do credenciamento (o admin designa; o dono não
 * escolhe). O pedido que o dono escolheu espera o aceite dele também quando a conta é de teste (o piloto) — a mesma
 * regra do bloco do dono, da lista e das ações (precisaDoAceiteDoDono).
 * E1102: `resposta` undefined = o pedido está "designado" a este avaliador mas NÃO tem a linha da designação (massa
 * antiga, dado incoerente). Vale o que o pedido diz: com proposta gravada, proposta enviada; sem ela, o pedido espera a
 * resposta do avaliador ("novo"). Antes a tela devolvia o avaliador ao painel sem dizer nada. A lista usa esta mesma
 * função para oferecer "Ver o pedido": só oferece o que a tela abre.
 */
export function etapaDoPedido(p: {
  status: string;
  resposta: string | null | undefined;
  proposta_aceita_em: string | null;
  teste: boolean;
  escolhido_em: string | null;
  proposta_em?: string | null;
}): EtapaDoPedido | null {
  if (p.status !== "designado") return null;
  if (p.resposta != null && p.resposta !== "aceita") return null;
  const propos = p.resposta === "aceita" || (p.resposta === undefined && Boolean(p.proposta_em));
  if (!propos) return "novo";
  return p.proposta_aceita_em || !precisaDoAceiteDoDono({ teste: p.teste, escolhidoEm: p.escolhido_em }) ? "aceito" : "proposta_enviada";
}

/** O título do desenho só vale enquanto o pedido é novo. */
export const tituloDoPedido = (etapa: EtapaDoPedido): string => (etapa === "novo" ? "Novo pedido de avaliação" : "Pedido de avaliação");

export const linhaDoPorte = (porte: Porte): string => `Porte: ${ROTULO_PORTE[porte]}`;

/** O que as linhas de valor precisam do pedido. `escolhido_em` ausente lê-se como "o dono não escolheu". */
type ValoresDoPedido = { valor_tabela: number | string; valor_proposto: number | string | null; prazo_proposto_dias: number | null; prazo_laudo_dias_uteis?: number | null; teste: boolean; escolhido_em?: string | null };

/**
 * E1108: "sem valor" é só a avaliação de teste do credenciamento (de teste e sem escolha do dono: o admin designa, não
 * há proposta). O pedido do piloto também é "de teste" (a conta do dono é de teste), mas o dono escolheu e o avaliador
 * propôs: os valores aparecem, como em qualquer pedido. A distinção é a do aceite (precisaDoAceiteDoDono, E1101).
 */
const semValor = (p: ValoresDoPedido): boolean => !precisaDoAceiteDoDono({ teste: p.teste, escolhidoEm: p.escolhido_em ?? null });

/** "1 dia" · "3 dias". E1158 (5): o mesmo ajudante no lado do avaliador, no bloco do dono e na troca de avaliador. */
export const dias = (n: number): string => `${n} ${n === 1 ? "dia" : "dias"}`;

export { diasUteis };

/** O prazo como o pedido o guarda: o novo (dias úteis depois da visita, E1156) e o de antes ("laudo em N dias"). */
type PrazoDoPedido = { prazo_proposto_dias: number | null; prazo_laudo_dias_uteis?: number | null };

/**
 * E1156: o compromisso do avaliador ao lado do valor, para o dono. Com o prazo novo: "laudo em até 3 dias úteis depois
 * da visita" enquanto a visita não tem data, e "Laudo até 22/10/2026" quando tem. O pedido anterior à regra mantém a
 * promessa que recebeu, como estava escrita: "laudo em 7 dias".
 */
export function prazoCombinadoNaLinhaDoDono(p: PrazoDoPedido, visitaEm: string | null): string {
  if (p.prazo_laudo_dias_uteis == null) return `laudo em ${dias(Number(p.prazo_proposto_dias))}`;
  if (visitaEm) return `Laudo até ${dataBRT(prazoLaudo(visitaEm, p.prazo_laudo_dias_uteis))}`;
  return `laudo em até ${diasUteis(p.prazo_laudo_dias_uteis)} depois da visita`;
}

/** E1156: a proposta que o avaliador enviou, como ele a lê — sem ponto final (a lista acrescenta o dela). */
export function textoDaPropostaEnviada(p: PrazoDoPedido & { valor_proposto: number | string | null }): string {
  if (p.prazo_laudo_dias_uteis != null) return `Proposta enviada: ${brl(Number(p.valor_proposto))} · laudo em até ${diasUteis(p.prazo_laudo_dias_uteis)} depois da visita`;
  return `Proposta enviada: ${brl(Number(p.valor_proposto))} em ${dias(Number(p.prazo_proposto_dias ?? 0))}`;
}

/**
 * A caixa do valor. E648: antes de o dono aceitar, o valor da tabela é só REFERÊNCIA (o avaliador propõe o seu);
 * "Você recebe" só com a proposta aceita, e pelo valor aceito.
 */
export function linhaDoValor(etapa: EtapaDoPedido, p: ValoresDoPedido): { texto: string; recebe: boolean } {
  if (semValor(p)) return { texto: "Avaliação de teste: sem valor a receber", recebe: false };
  if (etapa === "aceito" && p.valor_proposto != null) return { texto: `Você recebe ${brl(Number(p.valor_proposto))}`, recebe: true };
  if (etapa !== "novo" && p.valor_proposto != null) {
    return { texto: textoDaPropostaEnviada(p), recebe: false };
  }
  return { texto: `Valor de referência: ${brl(Number(p.valor_tabela))}`, recebe: false };
}

/**
 * E1108: depois do aceite, o prazo combinado também fica à vista (antes do aceite ele já vai na linha "Proposta
 * enviada: R$ X em N dias"). Os dois valores que o avaliador submeteu aparecem do lado dele em todas as etapas.
 */
export function linhaDoPrazoDoLaudo(etapa: EtapaDoPedido, p: ValoresDoPedido): string | null {
  if (etapa !== "aceito" || semValor(p)) return null;
  return prazoDoLaudoPorExtenso(p);
}

/**
 * E1188: o prazo combinado do laudo, por extenso e sem ponto final — a frase da tela do avaliador depois do aceite, e a
 * que o e-mail do aceite repete. E1156: o prazo novo diz a unidade e de onde conta; o pedido anterior à regra fica como
 * foi prometido. Sem prazo proposto, null.
 */
export function prazoDoLaudoPorExtenso(p: PrazoDoPedido): string | null {
  if (!p.prazo_proposto_dias) return null;
  if (p.prazo_laudo_dias_uteis != null) return `Laudo em até ${diasUteis(p.prazo_laudo_dias_uteis)} depois da visita`;
  return `Laudo em ${dias(Number(p.prazo_proposto_dias))}`;
}

/**
 * E1108 (ORDEM-DUET-787): marcada a visita, a tela do pedido passa a ser a da visita e do laudo — e a proposta que o
 * avaliador submeteu sumia do detalhe (a linha da lista continuava a mostrá-la). A tela da visita e do laudo mostra a
 * proposta combinada pelas mesmas duas linhas da etapa "aceito", lidas das mesmas colunas da lista. Sem proposta
 * submetida (a avaliação de teste do credenciamento; pedido sem valor proposto) não há o que mostrar.
 */
export function propostaCombinada(p: ValoresDoPedido): { valor: string; prazo: string | null } | null {
  if (semValor(p) || p.valor_proposto == null) return null;
  return { valor: linhaDoValor("aceito", p).texto, prazo: linhaDoPrazoDoLaudo("aceito", p) };
}

/** E1108: o valor na linha da lista do avaliador, pela mesma regra da tela do pedido. */
export function resumoDoValorNaLista(p: ValoresDoPedido): string {
  if (semValor(p)) return "avaliação de teste";
  if (p.valor_proposto != null) return `${brl(Number(p.valor_proposto))} · ${p.prazo_laudo_dias_uteis != null ? diasUteis(p.prazo_laudo_dias_uteis) : dias(Number(p.prazo_proposto_dias ?? 0))}`;
  return `referência ${brl(Number(p.valor_tabela))}`;
}

/**
 * E1108 (decisão do Gerente, ORDEM-DUET-491): de que imóvel é o pedido — o título do anúncio e o código VN que o
 * imóvel já tem (codigoDoImovel). Sem isto, dois pedidos da mesma cidade e porte eram indistinguíveis. Nunca vazio.
 */
export function identificacaoDoImovel(titulo: string | null | undefined, propertyId: string): string {
  const t = (titulo ?? "").replace(/\s+/g, " ").trim();
  const codigo = codigoDoImovel(propertyId);
  return t ? `${t} · ${codigo}` : codigo;
}

/**
 * E1148 (ORDEM-DUET-679): onde fica o imóvel de um item ENCERRADO que já não é do avaliador (proposta expirada ou
 * descartada, pedido recusado, ausência) — o bairro e a cidade, nunca a morada: nestes itens o dono não aceitou, e a
 * regra da casa é "bairro e cidade antes do aceite". Nunca vazio (cai na cidade do pedido).
 */
export function regiaoDoItemEncerrado(bairro: string | null | undefined, cidadeDoPedido: string): string {
  return regiaoDaVisita({ address: bairro, city: cidadeDoPedido }) ?? cidadeDoPedido;
}

/** O local: bairro e cidade até o dono aceitar; o endereço completo depois. Nunca vazio (cai na cidade do pedido). */
export function localDoPedido(
  etapa: EtapaDoPedido,
  imovel: { exact_address?: string | null; address?: string | null; city?: string | null; state?: string | null; draft_data?: Record<string, unknown> | null } | null,
  cidadeDoPedido: string,
): string {
  const regiao = (imovel && regiaoDaVisita(imovel)) || cidadeDoPedido;
  if (etapa !== "aceito" || !imovel) return regiao;
  return enderecoDaVisita(imovel)?.texto ?? regiao;
}
