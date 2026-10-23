/*
  Prompt 49 — degraus de confiança (só lógica): cada dado é pedido no momento em que passa a ser preciso, nunca antes.
    1. e-mail — na entrada (o código confirma o e-mail);
    2. telefone — no 1º contato real (candidatura, pedido de moradia, mensagem ao dono): campo, sem SMS;
    3. identidade (estadoIdentidade/CAF) e documento — depois do pré-aceite e antes do contrato.
  Nenhuma tela anterior ao pré-aceite exige documento (guarda em entrada-49.test.ts).
*/

export type Momento = "entrada" | "primeiro_contato" | "pre_aceite" | "contrato";
export type Degrau = "email" | "telefone" | "identidade";

const ORDEM: Momento[] = ["entrada", "primeiro_contato", "pre_aceite", "contrato"];
const PEDIDO_EM: Record<Degrau, Momento> = { email: "entrada", telefone: "primeiro_contato", identidade: "pre_aceite" };

/** O que já pode ser exigido neste momento (o que foi pedido em momentos anteriores continua valendo). */
export function degrausExigidos(momento: Momento): Degrau[] {
  const ate = ORDEM.indexOf(momento);
  return (Object.keys(PEDIDO_EM) as Degrau[]).filter((d) => ORDEM.indexOf(PEDIDO_EM[d]) <= ate);
}
