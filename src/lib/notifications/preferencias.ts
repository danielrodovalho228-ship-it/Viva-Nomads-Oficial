/*
  Preferência de notificação — PURO. Critério 5 do Daniel: tudo LIGADO por
  padrão. Conta sem preferência salva (null/ausente) = ligada; só um "false"
  gravado pela própria pessoa desliga.
*/
export function notificacaoLigada(valor: boolean | null | undefined): boolean {
  return valor !== false;
}
