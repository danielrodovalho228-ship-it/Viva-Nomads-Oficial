/**
 * Serviços para o morador (ordem 521c5af7). Regras puras; a ação do servidor e as telas só usam isto.
 * Complemento do coordenador (reteste do #869): S1 (catálogo) agora; o pedido (S2) e o acompanhamento (S3) viram as
 * telas do inquilino do Prompt 31b — nenhum sistema paralelo sobre servicos_adicionais. Enquanto um serviço não tem
 * parceiro aprovado, aparece "Em breve" e o cartão abre o "Avise-me quando estiver disponível".
 */
export const NOTA_PAGAMENTO_DIRETO = "Você paga direto ao prestador. A Viva indica parceiros e acompanha o pedido.";
export const NOTA_PAGAMENTO_PLATAFORMA = "Pagamento pela plataforma: o valor vai direto ao prestador e a taxa da Viva é separada na origem.";

/** A nota fixa do catálogo, escolhida pela chave PAGAMENTO_PARCEIROS_ATIVO (os dois textos no mesmo lugar). */
export function notaPagamentoServicos(pagamentoParceirosAtivo: boolean): string {
  return pagamentoParceirosAtivo ? NOTA_PAGAMENTO_PLATAFORMA : NOTA_PAGAMENTO_DIRETO;
}

/** "Meus pedidos" até o Prompt 31b: só o estado vazio, sem formulário. */
export const MEUS_PEDIDOS_VAZIO = "Quando você pedir um serviço, ele aparece aqui com o andamento.";

/** Os nomes do catálogo, com o acento devido (o teste de guarda confere o banco e as telas contra esta lista). */
export const NOMES_SERVICOS = {
  assistencia_24h: "Assistência 24h",
  plano_manutencao: "Plano de manutenção",
  limpeza: "Limpeza",
  lavanderia_enxoval: "Lavanderia e enxoval",
  frete_mudanca: "Frete e mudança leve",
} as const;

/** O pedido de serviço do Prompt 31b ainda não está no ar: até lá, todo serviço do catálogo é "Em breve". */
export const PEDIDO_SERVICO_31B_NO_AR = false;

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

export interface ServicoCatalogo {
  id: string;
  status: string;
  parceiro_nome: string | null;
  preco_texto?: string | null;
}

/** Só aceita pedido o serviço ativo, com parceiro aprovado e com o pedido do 31b no ar. */
export function servicoAceitaPedido(s: Pick<ServicoCatalogo, "status" | "parceiro_nome">, pedidoNoAr: boolean = PEDIDO_SERVICO_31B_NO_AR): boolean {
  return pedidoNoAr && s.status === "ativo" && typeof s.parceiro_nome === "string" && s.parceiro_nome.trim().length > 0;
}

/** A lista do INQUILINO: só categorias pagas pelo inquilino e não inativas (o Plano de manutenção do dono fica fora). */
export function servicosDoInquilino<T extends { quem_paga?: string | null; status?: string | null }>(lista: T[]): T[] {
  return lista.filter((s) => s.quem_paga === "inquilino" && s.status !== "inativo");
}

/** Destino do cartão com parceiro aprovado: o pedido do 31b com contrato e imóvel já preenchidos. */
export function hrefPedidoServico(servicoId: string, contratoId: string | null, propertyId: string | null): string {
  const q = new URLSearchParams({ servico: servicoId });
  if (contratoId) q.set("contrato", contratoId);
  if (propertyId) q.set("imovel", propertyId);
  return `/dashboard/servicos/pedido?${q.toString()}`;
}

/** Código curto que o morador cita ao falar com a Viva sobre o pedido. */
export function codigoDoPedido(id: string): string {
  return `SV-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
