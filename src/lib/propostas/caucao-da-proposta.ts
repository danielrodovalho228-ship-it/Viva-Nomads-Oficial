/*
  E601: a caução de uma proposta — 50% do 1º bloco proporcional, blocos contados em dias (a mesma regra do contrato,
  resumoContratoEmDias). Uma só conta para o formulário do dono e para a proposta que a moradora recebe. A caução não
  depende da taxa de serviço.
  Roda: node --test src/lib/propostas/e601-caucao-na-proposta.test.ts
*/
import { resumoContratoEmDias } from "../contrato-blocos.ts";
import { diasDosTermos, type TermosProposta } from "./regras.ts";

export interface CaucaoDaProposta {
  /** Dias do 1º bloco (a base da caução). */
  dias: number;
  valor: number;
}

export function caucaoDaProposta(t: Pick<TermosProposta, "meses" | "dias">, valorMensal: number): CaucaoDaProposta | null {
  const diasEstadia = diasDosTermos(t);
  if (!(diasEstadia > 0) || !(Number(valorMensal) > 0)) return null;
  const bloco = resumoContratoEmDias(diasEstadia, Number(valorMensal), 0).blocos[0];
  if (!bloco) return null;
  return { dias: bloco.dias ?? bloco.meses * 30, valor: bloco.caucao };
}
