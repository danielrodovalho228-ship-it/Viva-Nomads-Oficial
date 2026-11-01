/*
  E328 (regra) — confirmar o horário É o aceite prático da visita. As telas já prometem o nome "depois do aceite"; o
  dono, porém, via "Quem vem: Interessado(a)" mesmo DEPOIS de confirmar. Agora, a partir da confirmação (status
  "confirmado" ou "feito"), cada lado vê o 1º nome do outro NA VISITA: o dono vê quem vem, o morador vê quem recebe.
  Antes da confirmação segue protegido (só a candidatura aceita ou o contrato liberam, como antes). PURO.
  Roda: node --test src/lib/visitas/nome-visita.test.ts
*/

/** O 1º nome da outra parte aparece nesta visita? */
export function nomeLiberadoNaVisita(status: string | null | undefined, aceiteFora = false): boolean {
  return aceiteFora || status === "confirmado" || status === "feito";
}
