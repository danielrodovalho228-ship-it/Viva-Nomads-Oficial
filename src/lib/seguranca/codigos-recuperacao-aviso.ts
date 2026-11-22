/**
 * E1095: a regra do aviso "restam poucos códigos de recuperação", num arquivo SEM dependência do Node.
 * A tela (componente de navegador) lia esta função de codigos-recuperacao.ts, que importa node:crypto: o pacote do
 * navegador levava a biblioteca de criptografia do Node inteira (≈ 430 KB) para as telas da verificação em duas
 * etapas, e dentro dela há uma avaliação de código em texto que a política de conteúdo aplicada bloqueia.
 */
export const AVISO_RESTANTES = 2;

/** Avisa quando restam poucos códigos (2 ou menos, inclusive zero). */
export function avisarPoucosCodigos(restantes: number): boolean {
  return restantes <= AVISO_RESTANTES;
}
