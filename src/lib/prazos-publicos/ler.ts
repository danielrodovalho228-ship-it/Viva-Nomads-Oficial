import { readFileSync } from "node:fs";

/** Lê o código-fonte de uma superfície (os testes da Família 1 conferem que o prazo vem da fonte única, não de uma cópia). */
export const fonte = (caminho: string): string => readFileSync(caminho, "utf8");

/** Prazo de resposta escrito À MÃO (número literal) numa frase de resposta/retorno — o que a Família 1 proíbe. */
export const PRAZO_A_MAO = /(respond|resposta|retorn|confere)[^\n`]{0,80}?(até|em)\s+\d+\s*(dias|dia|h\b|horas)/i;
