/**
 * Serviços para o morador (ordem 521c5af7). Regras puras; a ação do servidor e as telas só usam isto.
 * O catálogo antigo (S1) saiu com o Prompt 31b: o pedido e o acompanhamento são os de parceiro_pedidos — nenhum
 * sistema paralelo sobre servicos_adicionais.
 */
export const NOTA_PAGAMENTO_DIRETO = "Você paga direto ao prestador. A Viva indica parceiros e acompanha o pedido.";
export const NOTA_PAGAMENTO_PLATAFORMA = "Pagamento pela plataforma: o valor vai direto ao prestador e a taxa da Viva é separada na origem.";

/** A nota fixa do catálogo, escolhida pela chave PAGAMENTO_PARCEIROS_ATIVO (os dois textos no mesmo lugar). */
export function notaPagamentoServicos(pagamentoParceirosAtivo: boolean): string {
  return pagamentoParceirosAtivo ? NOTA_PAGAMENTO_PLATAFORMA : NOTA_PAGAMENTO_DIRETO;
}

/** Estado vazio de "Meus pedidos". */
export const MEUS_PEDIDOS_VAZIO = "Quando você pedir um serviço, ele aparece aqui com o andamento.";

/** Os nomes do catálogo, com o acento devido (o teste de guarda confere o banco e as telas contra esta lista). */
export const NOMES_SERVICOS = {
  assistencia_24h: "Assistência 24h",
  plano_manutencao: "Plano de manutenção",
  limpeza: "Limpeza",
  lavanderia_enxoval: "Lavanderia e enxoval",
  frete_mudanca: "Frete e mudança leve",
} as const;

export const FAIXAS_HORARIO = [
  { id: "manha", rotulo: "Manhã (8h às 12h)" },
  { id: "tarde", rotulo: "Tarde (12h às 18h)" },
  { id: "noite", rotulo: "Noite (18h às 21h)" },
] as const;
export type FaixaHorario = (typeof FAIXAS_HORARIO)[number]["id"];

export type EstadoPedidoServico = "enviado" | "confirmado" | "feito" | "cancelado";
const ESTADO_ROTULO: Record<EstadoPedidoServico, string> = {
  enviado: "Pedido enviado",
  confirmado: "Confirmado",
  feito: "Feito",
  cancelado: "Cancelado",
};

export function rotuloEstado(estado: string): string {
  return ESTADO_ROTULO[estado as EstadoPedidoServico] ?? ESTADO_ROTULO.enviado;
}

/** Admin move o pedido: enviado → confirmado ou cancelado; confirmado → feito ou cancelado. Feito e cancelado encerram. */
export function proximosEstados(estado: string): EstadoPedidoServico[] {
  if (estado === "enviado") return ["confirmado", "cancelado"];
  if (estado === "confirmado") return ["feito", "cancelado"];
  return [];
}

/** Código curto que o morador cita ao falar com a Viva sobre o pedido. */
export function codigoDoPedido(id: string): string {
  return `SV-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
