/*
  E731 (Phoenix/RELATORIO-002): o formulário "Seja parceiro" dizia "Continuar: criar conta ou entrar" para quem já estava logado
  (o cabeçalho mostrava "Meu painel"), porque só olhava a sessão do servidor. O rótulo segue a sessão que a pessoa VÊ: a do
  servidor OU a do navegador. Puro (node --test).
*/
export const ROTULO_ENVIAR_PARCERIA = "Enviar pedido de parceria";
export const ROTULO_CONTINUAR_CONTA = "Continuar: criar conta ou entrar";
export const ERRO_SESSAO_NAO_CONFIRMADA = "Não conseguimos confirmar a sua sessão agora. Entre de novo para enviar o pedido.";

export function pessoaLogada(servidor: boolean, navegador: boolean): boolean {
  return servidor || navegador;
}

export function rotuloEnvioParceria(servidor: boolean, navegador: boolean): string {
  return pessoaLogada(servidor, navegador) ? ROTULO_ENVIAR_PARCERIA : ROTULO_CONTINUAR_CONTA;
}
