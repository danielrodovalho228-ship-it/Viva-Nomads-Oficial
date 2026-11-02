/*
  E411 — segundo pedido de visita com um já em aberto. O banco aceita UM pedido em aberto por morador, imóvel e
  modalidade (0165). Desde o E329 o anúncio troca o botão por "Visita pedida" (leva a Visitas), mas não dizia POR QUE
  não dá para pedir outro nem COMO mudar os horários. Esta é a explicação única: a do anúncio e a do servidor.
  Roda: node --test src/lib/visitas/um-pedido-aberto.test.ts
*/
import type { ModalidadeVisita } from "../visitas-video.ts";

const TIPO: Record<ModalidadeVisita, string> = { video: "por vídeo", presencial: "presencial" };

/** Embaixo do botão do anúncio, com um pedido em aberto. */
export function explicacaoPedidoAberto(modalidade: ModalidadeVisita, estado: "pedida" | "agendada" | "ver" | string): string {
  // E411 (resíduo): visita confirmada que já passou do horário segue em aberto até o PROPRIETÁRIO marcar como feita (o
  // morador não tem ação numa visita que passou) — o banco continua recusando outro pedido igual. Antes, o botão "Ver
  // minha visita" não dizia por quê.
  if (estado === "ver")
    return `Sua visita ${TIPO[modalidade]} já passou do horário. Um novo pedido fica liberado quando o proprietário marcar esta visita como feita; combine pela conversa.`;
  return estado === "agendada"
    ? `Sua visita ${TIPO[modalidade]} já está marcada. Para mudar o horário, cancele em Visitas e peça de novo.`
    : `Você já pediu uma visita ${TIPO[modalidade]} e o proprietário ainda vai responder. Para mudar os horários, cancele o pedido em Visitas e peça de novo.`;
}

/** O servidor recusou um segundo pedido igual (índice único da 0165). */
export function erroPedidoAberto(modalidade: ModalidadeVisita): string {
  return `Você já tem um pedido de visita ${TIPO[modalidade]} em aberto para este imóvel. Para mudar os horários, cancele esse pedido em Visitas e peça de novo.`;
}
