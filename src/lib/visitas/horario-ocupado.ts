/*
  E500 + E547 (QA de cliques do proprietário, 02/11) — a visita por vídeo de 03/11 10:00 aparecia DUAS vezes em
  /dashboard/visitas. Não era consulta duplicada: eram dois pedidos de moradores DIFERENTES, e o dono confirmou os dois
  no MESMO horário do MESMO imóvel (o servidor deixava). Como a lista do dono não dizia quem vem, os dois cartões saíam
  idênticos. Regra na origem: um imóvel não tem duas visitas confirmadas no mesmo horário — o segundo "Confirmar" é
  recusado e o dono propõe outro horário. PURO.
  Roda: node --test src/lib/visitas/horario-ocupado.test.ts
*/

export const MSG_HORARIO_OCUPADO = "Este horário já está confirmado com outra visita neste imóvel. Proponha outro horário.";

/** Já há OUTRA visita confirmada deste imóvel exatamente neste horário? */
export function horarioOcupado(outras: { id: string; status: string | null; horarioConfirmado: string | null }[], visitaId: string, horario: string): boolean {
  const alvo = new Date(horario).getTime();
  if (!Number.isFinite(alvo)) return false;
  return outras.some((o) => o.id !== visitaId && o.status === "confirmado" && !!o.horarioConfirmado && new Date(o.horarioConfirmado).getTime() === alvo);
}
