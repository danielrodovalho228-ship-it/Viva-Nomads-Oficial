/*
  E445 (item 3) — lista VERSIONADA de termos de ódio e xingamento GRAVE no chat. Não é filtro de palavrão leve
  ("droga", "merda", "porra" seguem livres): só ofensa dirigida, discriminação e ameaça. A pessoa é avisada antes de
  enviar; se enviar mesmo assim, o registro vai para a fila de moderação do admin (quem, conversa, termo).
  Mudança na lista = nova versão (o número abaixo) e os testes de falso positivo continuam passando.
  Os termos ficam sem acento e em minúsculas (a comparação normaliza o texto do mesmo jeito).
*/
export const VERSAO_LISTA_OFENSAS = 1;

export const TERMOS_OFENSIVOS: readonly string[] = [
  // Xingamento grave dirigido
  "filho da puta",
  "filha da puta",
  "fdp",
  "arrombado",
  "arrombada",
  "vagabunda",
  "vadia",
  "desgracado",
  "desgracada",
  "corno",
  // Discriminação (deficiência, orientação, raça)
  "retardado",
  "retardada",
  "mongoloide",
  "viado",
  "traveco",
  "macaco imundo",
  "crioulo",
  "negro imundo",
  "preto imundo",
  // Ameaça
  "vou te matar",
  "vou acabar com voce",
  "vou te pegar",
];
