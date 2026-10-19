/*
  Mural do proprietário (Prompt 30, item 5) — regras PURAS das abas e da oferta de imóvel.
*/
export type AbaDono = "novos" | "respondidos" | "ignorados";

export const ABAS_DONO: { chave: AbaDono; rotulo: string }[] = [
  { chave: "novos", rotulo: "Novos para você" },
  { chave: "respondidos", rotulo: "Respondidos" },
  { chave: "ignorados", rotulo: "Ignorados" },
];

/** Respondeu → "Respondidos" (vale mais que ignorar); ignorou → "Ignorados"; o resto → "Novos para você". */
export function abaDoPedido(p: { respondido: boolean; ignorado: boolean }): AbaDono {
  if (p.respondido) return "respondidos";
  return p.ignorado ? "ignorados" : "novos";
}

/** Status da conversa mostrado em "Respondidos". */
export const STATUS_CONVERSA: Record<string, string> = {
  enviada: "Oferta enviada — aguardando o inquilino",
  vista: "O inquilino viu a sua oferta",
  aceita_para_conversa: "Conversa aberta",
  recusada: "O inquilino recusou a oferta",
};

/** Mensagem padrão do "Oferecer um imóvel" (sem contato: a conversa é pela plataforma). */
export const MENSAGEM_OFERTA_PADRAO =
  "Olá! Tenho um imóvel que combina com o seu pedido. Veja o anúncio e, se fizer sentido, aceite para conversarmos pela plataforma.";
