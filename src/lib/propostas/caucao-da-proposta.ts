/*
  E601: a caução de uma proposta — uma só conta para o formulário do dono e para a proposta que a moradora recebe. A
  caução não depende da taxa de serviço.
  E1061 (lei do produto, Daniel, 20/11/2026): a conta é a do CONTRATO — metade do aluguel da estadia toda (a soma dos
  blocos, contados em dias), no máximo 3 vezes o valor mensal. Antes a proposta mostrava só o 1º bloco, com um rótulo
  que não deixava ver que o número era o do contrato.
  Roda: node --test src/lib/propostas/e601-caucao-na-proposta.test.ts src/lib/e1061-caucao-fonte-unica.test.ts
*/
import { resumoContratoEmDias } from "../contrato-blocos.ts";
import { diasDosTermos, type TermosProposta } from "./regras.ts";
import { REGRA_CAUCAO_BASE } from "../caucao-regra.ts";

export interface CaucaoDaProposta {
  /** Dias da estadia (a base da caução). */
  dias: number;
  /** A caução da estadia toda: a soma das cauções dos blocos do contrato. */
  valor: number;
  /** Em quantos blocos o contrato divide a estadia. */
  blocos: number;
  /** A parte do 1º bloco (igual a `valor` quando há um bloco só). */
  primeiroBloco: number;
}

export function caucaoDaProposta(t: Pick<TermosProposta, "meses" | "dias">, valorMensal: number): CaucaoDaProposta | null {
  const dias = diasDosTermos(t);
  if (!(dias > 0) || !(Number(valorMensal) > 0)) return null;
  const r = resumoContratoEmDias(dias, Number(valorMensal), 0);
  const primeiro = r.blocos[0];
  if (!primeiro) return null;
  return { dias, valor: r.caucaoTotal, blocos: r.blocos.length, primeiroBloco: primeiro.caucao };
}

/** O rótulo da linha da caução na proposta: diz a regra e os dias da estadia. */
export function rotuloCaucaoDaProposta(c: Pick<CaucaoDaProposta, "dias">): string {
  return `Caução (${REGRA_CAUCAO_BASE}, ${c.dias} dias)`;
}
