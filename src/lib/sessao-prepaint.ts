/*
  E398: recarregar uma página pública com sessão ativa mostrava, por um instante, o cabeçalho de visitante ("Entrar") antes de
  assentar logado: o HTML do servidor é o mesmo para todos e a sessão só é lida depois da hidratação.
  Este script roda no <head>, ANTES da primeira pintura, lê a pista local de login do store persistido ("vivanomads-auth") e marca
  <html data-sessao="1">. O CSS esconde o botão "Entrar" (sem tirar o espaço, nada pula) enquanto a marca existir; o cabeçalho tira a
  marca quando a sessão é conferida e NÃO há usuário (pista velha), e o "Entrar" volta. Visitante sem pista: nada muda (o servidor
  segue entregando o "Entrar"). PURO: string de script + a chave.
*/
export const CHAVE_SESSAO_LOCAL = "vivanomads-auth";

export const SESSAO_PREPAINT_SCRIPT = `try{var s=localStorage.getItem("${CHAVE_SESSAO_LOCAL}");if(s){var o=JSON.parse(s);if(o&&o.state&&o.state.user){document.documentElement.setAttribute("data-sessao","1")}}}catch(e){}`;
