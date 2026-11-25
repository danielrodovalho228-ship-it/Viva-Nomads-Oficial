/*
  E1141 — a proposta (a estadia) que um fecho abre. PURO.
  Sem `p` na URL, o fecho segue a regra de sempre: a proposta acordada mais recente da candidatura ("padrao").
  Com `p`, só vale a proposta que é DESTA candidatura e está acordada (aceita, em contrato ou contrato assinado)
  ("escolhida"); qualquer outra coisa é "fora" — o servidor responde "não encontrado" e nunca cai na estadia errada.
*/
import { STATUS_PROPOSTA_ACORDADA } from "./fechos-do-dono.ts";

export type DecisaoDaProposta = "padrao" | "escolhida" | "fora";

export function propostaDoFechamento(e: {
  leadId: string;
  propostaId: string | null | undefined;
  /** A linha da proposta pedida, lida do banco (null = não existe). */
  proposta: { id: string; lead_id: string; status: string } | null;
}): DecisaoDaProposta {
  if (e.propostaId == null) return "padrao";
  const p = e.proposta;
  if (!p || p.id !== e.propostaId || p.lead_id !== e.leadId) return "fora";
  return STATUS_PROPOSTA_ACORDADA.includes(p.status) ? "escolhida" : "fora";
}
