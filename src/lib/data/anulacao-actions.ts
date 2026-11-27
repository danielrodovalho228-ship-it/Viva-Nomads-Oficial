"use server";
/* E1229 — a anulação de registros (ainda por construir: a trava vermelha corre contra esta casca). */
export type ResultadoAnulacao = { ok: true; pedido?: string; mensagem?: string } | { ok: false; error: string };
export async function anularRegistro(_input: { pagamentoId: string; motivo: string }): Promise<ResultadoAnulacao> {
  return { ok: false, error: "por construir" };
}
export async function anularRegistroPelaCentral(_input: { chamadoId: string; motivo: string }): Promise<ResultadoAnulacao> {
  return { ok: false, error: "por construir" };
}
