/*
  E398: quem está logado via, por um instante, o cabeçalho de visitante ("Entrar") ao carregar uma página pública, e lia
  "caí da conta". O HTML dessas páginas é o mesmo para todos (o servidor entrega o "Entrar") e a sessão só é lida depois
  de a página carregar.
  Este script roda no <head>, ANTES da primeira pintura: lê a lembrança local do login (o store persistido,
  "vivanomads-auth") e marca <html data-sessao="1">. Com a marca, o CSS esconde o "Entrar" sem tirar o espaço dele
  (nada pula). O cabeçalho tira a marca quando a sessão é conferida e NÃO há usuário (lembrança velha), e o "Entrar"
  volta. Visitante sem lembrança: nada muda.
  A lembrança só decide o que NÃO mostrar por um instante; quem dá acesso segue sendo o servidor.
  Puro: a chave e o texto do script. (Desenho do draft #2937, da Pista A, retomado sobre a main de 15/11.)
*/
export const CHAVE_SESSAO_LOCAL = "vivanomads-auth";
export const MARCA_SESSAO = "data-sessao";

export const SESSAO_PREPAINT_SCRIPT = `try{var s=localStorage.getItem("${CHAVE_SESSAO_LOCAL}");if(s){var o=JSON.parse(s);if(o&&o.state&&o.state.user){document.documentElement.setAttribute("${MARCA_SESSAO}","1")}}}catch(e){}`;
