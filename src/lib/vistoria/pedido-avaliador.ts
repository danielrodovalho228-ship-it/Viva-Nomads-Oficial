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
import { enderecoDaVisita, regiaoDaVisita } from "../visitas/endereco-visita.ts";
import { ROTULO_PORTE, type Porte } from "./regras.ts";
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

/**
 * A caixa do valor. E648: antes de o dono aceitar, o valor da tabela é só REFERÊNCIA (o avaliador propõe o seu);
 * "Você recebe" só com a proposta aceita, e pelo valor aceito.
 */
export function linhaDoValor(
  etapa: EtapaDoPedido,
  p: { valor_tabela: number | string; valor_proposto: number | string | null; prazo_proposto_dias: number | null; teste: boolean },
): { texto: string; recebe: boolean } {
  if (p.teste) return { texto: "Avaliação de teste: sem valor a receber", recebe: false };
  if (etapa === "aceito" && p.valor_proposto != null) return { texto: `Você recebe ${brl(Number(p.valor_proposto))}`, recebe: true };
  if (etapa !== "novo" && p.valor_proposto != null) {
    const dias = Number(p.prazo_proposto_dias ?? 0);
    return { texto: `Proposta enviada: ${brl(Number(p.valor_proposto))} em ${dias} ${dias === 1 ? "dia" : "dias"}`, recebe: false };
  }
  return { texto: `Valor de referência: ${brl(Number(p.valor_tabela))}`, recebe: false };
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
