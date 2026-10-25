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
 * Véu da foto lateral: em vez de um véu escuro por cima de tudo (que apagava o interior quente e claro da foto), o
 * escuro fica só atrás do texto — uma pílula no logo e um cartão no título e na frase, que ficam brancos e legíveis.
 * Sem degradê (Prompt 45): fundo liso translúcido.
 */
export const VEU_TOPO_PORTA = "inline-flex rounded-full bg-night/55 px-4 py-2";
export const VEU_BASE_PORTA = "max-w-md rounded-xl bg-night/65 p-6";

/** Lado do formulário: fundo clean (E166; antes, areia) com o formulário num cartão branco, em vez do branco vazio. */
export const FUNDO_FORMULARIO_PORTA = "bg-surface-2";
export const CARTAO_FORMULARIO_PORTA = "rounded-xl border border-line bg-white p-6 sm:p-8";
