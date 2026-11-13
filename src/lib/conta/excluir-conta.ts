/**
 * E840 — "Excluir conta": um rótulo só em todo o site e o destino pelo contexto.
 *  - deslogado → /excluir-conta (página pública, exigida pelas lojas: pede o e-mail e confirma por link);
 *  - logado → /dashboard/conta/excluir ("Sair da Viva", subtela de Privacidade da conta).
 */
export const ROTULO_EXCLUIR_CONTA = "Excluir conta";
export const DESTINO_EXCLUIR_CONTA_PUBLICO = "/excluir-conta";
export const DESTINO_EXCLUIR_CONTA_LOGADO = "/dashboard/conta/excluir";

export function destinoExcluirConta(logado: boolean): string {
  return logado ? DESTINO_EXCLUIR_CONTA_LOGADO : DESTINO_EXCLUIR_CONTA_PUBLICO;
}
