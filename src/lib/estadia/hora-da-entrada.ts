/*
  E1230 (ORDENS-DUET 1207 e 1300) — o que cada pessoa vê da hora da estadia. Puro.
   - a hora de entrada vem do leitor único (horaDeEntrada, data/janela-conferencia.ts: as instruções do contrato);
   - o MORADOR (e o convidado dele) só a vê DEPOIS das duas assinaturas — antes disso, nenhuma tela lha mostra
     ("horário a combinar"), a mesma porta das instruções (inquilinoVeInstrucoes, checkin.ts); o dono vê sempre;
   - a saída não tem hora no contrato (o campo é o E1240): mostra-se "horário a combinar com o proprietário".
*/

/** E1230: a saída sem hora. */
export const HORARIO_SAIDA_A_COMBINAR = "horário a combinar com o proprietário";

/** A hora de entrada que esta pessoa pode ver: o dono sempre; o morador só com as duas assinaturas. */
export function horaParaQuemVe(p: { hora: string | null; papel: "proprietario" | "inquilino"; assinadoProprietarioEm: string | null; assinadoInquilinoEm: string | null }): string | null {
  if (!p.hora) return null;
  if (p.papel === "proprietario") return p.hora;
  return p.assinadoProprietarioEm && p.assinadoInquilinoEm ? p.hora : null;
}
