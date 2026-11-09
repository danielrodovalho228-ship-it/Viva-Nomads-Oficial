/*
  E764 (Phoenix/RELATORIO-005): o estado vazio de Mensagens dizia "telefone e e-mail só aparecem depois do aceite" — contradiz a regra de
  contato do E445: contato NUNCA é trocado no chat e segue mascarado no servidor em qualquer fase, inclusive depois do aceite
  (emergência = telefone da Viva). Texto único, em lib, para a tela e o teste.
*/
export const TITULO_MENSAGENS_VAZIO = "Nenhuma conversa ainda";
export const TEXTO_MENSAGENS_VAZIO =
  "A conversa começa quando você pede um imóvel ou quando alguém pede o seu. Tudo fica aqui, com o imóvel e as datas no topo. Telefone e e-mail nunca são trocados na conversa: aparecem como “contato protegido”, em qualquer fase, inclusive depois do aceite. Em caso de emergência, fale com o telefone da Viva.";
