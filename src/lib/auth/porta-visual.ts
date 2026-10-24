/**
 * Porta de entrada (/auth) — acabamento visual alinhado aos mockups aprovados (23/10). Só aparência: nenhum fluxo,
 * campo ou texto muda aqui.
 */

/**
 * Estados do botão primário na porta: o padrão do <Button> apaga o desabilitado com opacity-50, e o verde da marca
 * vira um sálvia pálido e lavado. Aqui cada estado fica na família do verde da casa:
 * - habilitado: o verde profundo da marca (o mesmo da tela de intenção);
 * - esperando (desabilitado até o campo ficar pronto): o mesmo verde a 75%, texto branco — mais leve, mas a mesma marca;
 * - carregando (`aria-busy`): o verde cheio, com o indicador girando — a ação está andando, não fraca.
 */
export const PRIMARIO_PORTA =
  "disabled:opacity-100 disabled:bg-forest/75 disabled:text-white aria-busy:disabled:bg-forest aria-busy:cursor-progress";

/**
 * Véu da foto lateral: em vez de um véu escuro por cima de tudo (que apagava o interior quente e claro da foto),
 * só um degradê onde há texto — leve no topo (logo) e mais firme embaixo (título e frase), que fica branco e legível.
 */
export const VEU_TOPO_PORTA = "bg-gradient-to-b from-night/45 to-transparent";
export const VEU_BASE_PORTA = "bg-gradient-to-t from-night/80 via-night/45 to-transparent";

/** Lado do formulário: fundo areia (quente) com o formulário num cartão branco, em vez do branco vazio. */
export const FUNDO_FORMULARIO_PORTA = "bg-areia";
export const CARTAO_FORMULARIO_PORTA = "rounded-xl border border-line bg-white p-6 sm:p-8";
