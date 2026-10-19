/**
 * Serviços para o morador (ordem 521c5af7, telas S1–S3). Regras puras; a ação do servidor e as telas só usam isto.
 * A plataforma NÃO recebe nem repassa dinheiro: o morador paga direto ao prestador parceiro. Enquanto um serviço
 * não tem parceiro definido, ele aparece como "Em breve" e não aceita pedido.
 */
export const NOTA_PAGAMENTO_DIRETO = "Você paga direto ao prestador. A Viva indica parceiros e acompanha o pedido.";

export const FAIXAS_HORARIO = [
  { id: "manha", rotulo: "Manhã (8h às 12h)" },
  { id: "tarde", rotulo: "Tarde (12h às 18h)" },
  { id: "noite", rotulo: "Noite (18h às 21h)" },
] as const;
export type FaixaHorario = (typeof FAIXAS_HORARIO)[number]["id"];

export const MAX_OBSERVACAO = 300;
/** Quantos dias à frente o morador pode pedir. */
export const JANELA_PEDIDO_DIAS = 90;

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

/** Só aceita pedido o serviço ativo e com parceiro definido. */
export function servicoAceitaPedido(s: Pick<ServicoCatalogo, "status" | "parceiro_nome">): boolean {
  return s.status === "ativo" && typeof s.parceiro_nome === "string" && s.parceiro_nome.trim().length > 0;
}

/** Código curto que o morador cita ao falar com a Viva sobre o pedido. */
export function codigoDoPedido(id: string): string {
  return `SV-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export interface PedidoValidado {
  data: string;
  faixa: FaixaHorario;
  observacao: string | null;
}

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "Hoje" em Brasília (UTC−3) como aaaa-mm-dd. */
function hojeBrasilia(agora: Date): string {
  return new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Entrada do formulário (não confiável) → pedido limpo, ou a mensagem do que corrigir. */
export function validarPedido(
  entrada: unknown,
  agora: Date = new Date(),
): { ok: true; pedido: PedidoValidado } | { ok: false; error: string } {
  if (!entrada || typeof entrada !== "object") return { ok: false, error: "Preencha a data e a faixa de horário." };
  const { data, faixa, observacao } = entrada as Record<string, unknown>;
  const m = typeof data === "string" ? DATA.exec(data) : null;
  if (!m) return { ok: false, error: "Escolha uma data válida." };
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.toISOString().slice(0, 10) !== data) return { ok: false, error: "Escolha uma data válida." };
  const hoje = hojeBrasilia(agora);
  if ((data as string) <= hoje) return { ok: false, error: "Escolha uma data a partir de amanhã." };
  const limite = new Date(Date.parse(`${hoje}T00:00:00Z`) + JANELA_PEDIDO_DIAS * 86400_000).toISOString().slice(0, 10);
  if ((data as string) > limite) return { ok: false, error: `Escolha uma data nos próximos ${JANELA_PEDIDO_DIAS} dias.` };
  if (!FAIXAS_HORARIO.some((f) => f.id === faixa)) return { ok: false, error: "Escolha a faixa de horário." };
  let obs: string | null = null;
  if (observacao !== undefined && observacao !== null) {
    if (typeof observacao !== "string") return { ok: false, error: "Observação inválida." };
    obs = observacao.trim() || null;
    if (obs && obs.length > MAX_OBSERVACAO) return { ok: false, error: `A observação aceita até ${MAX_OBSERVACAO} caracteres.` };
  }
  return { ok: true, pedido: { data: data as string, faixa: faixa as FaixaHorario, observacao: obs } };
}
