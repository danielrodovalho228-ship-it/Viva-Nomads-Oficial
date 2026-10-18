/*
  Prompt 24 (QA do Muse, 18/10): "Gerar contrato" virou beco sem saída. A conta de teste recebia { demo: true }, a tela
  tratava como "assinatura inativa" e saía sem registrar o contrato, e o 2º clique esbarrava na reserva já feita (409).
  Regra única, pura (rota e testes usam o mesmo código):
  - modo "teste" (qualquer parte is_teste): segue o caminho completo, com tudo simulado e rotulado;
  - modo "inativa" (conta real sem assinatura digital ligada): 503 ANTES de reservar — nada fica preso;
  - contrato já gerado para a candidatura: 200 com o existente (repetir é seguro);
  - reserva sem conclusão (a resposta nunca chegou): vence em 10 minutos e é liberada.
*/

export type ModoContrato = "teste" | "real" | "inativa";

/** Reserva sem conclusão (externo_id vazio) mais velha que isto é liberada na próxima tentativa. */
export const RESERVA_EXPIRA_MS = 10 * 60_000;

export const MSG_CONTRATO_EM_ANDAMENTO = "Estamos gerando o contrato desta candidatura. Aguarde alguns segundos e toque em Gerar de novo.";

export interface ReservaLida {
  externoId: string | null;
  criadoEm: string;
}

export type DecisaoContrato =
  | { acao: "inativa" }
  | { acao: "existente"; modo: "teste" | "real"; docId: string }
  | { acao: "em_andamento" }
  | { acao: "gerar"; modo: "teste" | "real"; liberarReservaVencida: boolean };

export function reservaVencida(r: ReservaLida, agora: number): boolean {
  const t = Date.parse(r.criadoEm);
  return !r.externoId && (!Number.isFinite(t) || agora - t >= RESERVA_EXPIRA_MS);
}

export function decidirGeracaoContrato(p: {
  teste: boolean;
  assinaturaLigada: boolean;
  reserva: ReservaLida | null;
  agora: number;
}): DecisaoContrato {
  const modo = p.teste ? "teste" : "real";
  if (p.reserva?.externoId) return { acao: "existente", modo, docId: p.reserva.externoId };
  if (p.reserva && !reservaVencida(p.reserva, p.agora)) return { acao: "em_andamento" };
  if (!p.teste && !p.assinaturaLigada) return { acao: "inativa" };
  return { acao: "gerar", modo, liberarReservaVencida: !!p.reserva };
}

/** O que a tela faz com a resposta de /api/contrato. */
export type PassoTelaContrato = "registrar" | "inativa" | "tentar_de_novo" | "erro";

export function passoDaRespostaContrato(status: number, corpo: { modo?: unknown }): PassoTelaContrato {
  if (status === 503 || corpo.modo === "inativa") return "inativa";
  if (status === 409) return "tentar_de_novo";
  if (status >= 200 && status < 300 && (corpo.modo === "teste" || corpo.modo === "real")) return "registrar";
  return "erro";
}

/**
 * Prompt 24 — exibição da Caução (aprovada pelo Daniel em 18/10): a Caução é garantia devolvível, então fica FORA do
 * "1º pagamento" e aparece AO LADO, com o total antes da entrada. Com seguro-fiança (garantia única) a linha some.
 */
export interface QuadroEntrada {
  primeiroPagamento: number;
  /** null = seguro-fiança (sem caução). */
  caucao: number | null;
  totalAntesDaEntrada: number;
}

export function quadroAntesDaEntrada(p: { primeiroPagamento: number; caucao: number; garantia: "caucao" | "seguro_fianca" }): QuadroEntrada {
  const caucao = p.garantia === "caucao" && p.caucao > 0 ? Math.round(p.caucao * 100) / 100 : null;
  return {
    primeiroPagamento: p.primeiroPagamento,
    caucao,
    totalAntesDaEntrada: Math.round((p.primeiroPagamento + (caucao ?? 0)) * 100) / 100,
  };
}

/** Status curto do contrato para os cartões (#825): "Aguardando assinatura · falta você / falta o proprietário". */
export function statusAssinaturaCurto(
  papel: "inquilino" | "proprietario",
  a: { proprietario: string | null; inquilino: string | null },
): string {
  if (a.proprietario && a.inquilino) return "Assinado pelas duas partes";
  const eu = papel === "inquilino" ? a.inquilino : a.proprietario;
  const outro = papel === "inquilino" ? "o proprietário" : "o inquilino";
  if (!a.proprietario && !a.inquilino) return "Aguardando assinatura · falta você e " + outro;
  return eu ? `Aguardando assinatura · falta ${outro}` : "Aguardando assinatura · falta você";
}
