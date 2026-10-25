/*
  A6 — Conta › Notificações (mockup perfil-06): os textos dos dois cartões e as regras puras das preferências.
  Vocabulário da casa: "check-in, check-out e detalhes da reserva" do desenho vira conferência de entrada e saída e a
  estadia; "viagens e acomodações" vira imóveis mobiliados.
*/
import type { CategoriaComInterruptor } from "../../config/matriz-notificacoes.ts";

export interface CanaisAviso {
  email: boolean;
  push: boolean;
  whatsapp: boolean;
}

/** Sem preferência salva = ligado (o mesmo critério de notif_email desde o início). */
export const canaisPadrao = (): CanaisAviso => ({ email: true, push: true, whatsapp: true });
export function normalizarCanais(b: { email?: unknown; push?: unknown; whatsapp?: unknown }): CanaisAviso {
  return { email: b.email !== false, push: b.push !== false, whatsapp: b.whatsapp !== false };
}

export const TIPOS_AVISO: readonly { categoria: CategoriaComInterruptor; titulo: string; texto: string }[] = [
  { categoria: "mensagens", titulo: "Novas mensagens", texto: "Receba quando alguém te enviar uma mensagem" },
  { categoria: "lembretes", titulo: "Lembretes da estadia", texto: "Alertas sobre a conferência de entrada e de saída e os detalhes da estadia" },
  { categoria: "outros", titulo: "Novidades e dicas da Viva", texto: "Receba novidades, dicas e conteúdo sobre imóveis mobiliados" },
];

export const CANAIS_AVISO: readonly { canal: keyof CanaisAviso; titulo: string; texto: string }[] = [
  { canal: "email", titulo: "E-mail", texto: "Enviaremos notificações no seu e-mail cadastrado" },
  { canal: "push", titulo: "Notificação no celular (push)", texto: "Receba notificações push no seu celular" },
  { canal: "whatsapp", titulo: "WhatsApp", texto: "Receba atualizações e lembretes via WhatsApp" },
];

/** Interruptor ligado = categoria fora da lista de desligadas. */
export function categoriasDesligadasDe(ligadas: Record<CategoriaComInterruptor, boolean>): CategoriaComInterruptor[] {
  return TIPOS_AVISO.map((t) => t.categoria).filter((c) => !ligadas[c]);
}
