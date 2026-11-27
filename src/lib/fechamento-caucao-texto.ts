/*
  E1082 — a regra da caução em palavras, nas superfícies do Fechamento (passo Garantia, "Sua proteção" e o quadro do
  contrato). Tudo sai da fonte única da regra (./caucao-regra.ts, decidida no E1061 e provada no E1076): um texto,
  uma fonte (lei do E777). Só texto — os valores continuam a vir da conta do contrato.
*/
import { REGRAS_CONTRATO } from "../config/planos.ts";
import { REGRA_CAUCAO, REGRA_CAUCAO_BASE } from "./caucao-regra.ts";
import { formatBRL } from "./utils.ts";

/** Título do bloco da caução no passo Garantia. */
export const TITULO_CAUCAO_GARANTIA = `Caução (${REGRA_CAUCAO_BASE})`;

/** A explicação por baixo do título: a regra inteira e como ela se reparte pelos blocos do contrato. */
export const TEXTO_BLOCOS_GARANTIA = (tamanhoBlocoMeses: number) =>
  `A caução é de ${REGRA_CAUCAO}. O período é contratado em blocos de ${tamanhoBlocoMeses} meses e cada bloco leva a sua parte da caução (a tabela mostra quanto): cabe no cartão e vai para a poupança da caução. A plataforma nunca recebe.`;

/** "Sua proteção", linha "Quanto o morador paga": o valor, a regra e o teto em reais. */
export const quantoOMoradorPaga = (e: { caucao: number; valorMensal: number }) =>
  `${formatBRL(e.caucao)} depositados na entrada (${REGRA_CAUCAO}, que são ${formatBRL(e.valorMensal * REGRAS_CONTRATO.caucaoMaxAlugueis)})`;

/** Quadro "O morador vê no 1º pagamento" (passo do contrato): o rótulo da linha da caução. O resto da frase fica na tela. */
export const ROTULO_CAUCAO_NA_ENTRADA = `Caução (${REGRA_CAUCAO_BASE}, antes da entrada)`;
