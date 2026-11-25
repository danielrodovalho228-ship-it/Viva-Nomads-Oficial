/*
  E1076 — a REGRA da caução em palavras, numa fonte só.
  A regra decidida (lei do produto, Daniel, 20/11/2026; E1061): metade do aluguel da estadia toda, no máximo 3 vezes o
  valor mensal. A conta do contrato faz isso bloco a bloco (50% de cada bloco, com a soma limitada ao teto), o que dá o
  mesmo número; a frase que as pessoas leem diz a regra pela estadia, não pelo bloco.
  Quem lê daqui: o rótulo da linha da proposta, a nota da linha "Caução" do anúncio, a página Caução do painel e o
  llms.txt. Os números vêm de REGRAS_CONTRATO (config/planos): mudar lá muda a frase.
  Roda: node --test src/lib/e1076-texto-regra-da-caucao.test.ts
*/
import { REGRAS_CONTRATO } from "../config/planos.ts";

/** "50% do aluguel da estadia" — a base da caução. */
export const REGRA_CAUCAO_BASE = `${Math.round(REGRAS_CONTRATO.caucaoFracaoBloco * 100)}% do aluguel da estadia`;

/** "50% do aluguel da estadia, no máximo 3 vezes o valor mensal" — a regra inteira, sem ponto final. */
export const REGRA_CAUCAO = `${REGRA_CAUCAO_BASE}, no máximo ${REGRAS_CONTRATO.caucaoMaxAlugueis} vezes o valor mensal`;

/** A regra como frase, para a explicação "Como funciona a caução" do painel. */
export const REGRA_CAUCAO_FRASE = `${REGRA_CAUCAO}; devolvível ao fim da estadia.`;
