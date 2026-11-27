/*
  E1026, 2ª causa — o modo que o SERVIDOR manda aplicar não é uma troca da pessoa.
  O AuthProvider lê o perfil e só aplica o que leu (modo e papel ativo) se a pessoa não trocou de modo no meio da leitura.
  Para saber isso ele comparava o modo do começo com o do fim. Mas na chegada do login o store nasce sem modo, e o
  ModeInitializer aplica o do servidor (null → owner) enquanto o perfil é lido: a comparação dava "trocou", o papel lido
  era descartado, e o navegador ficava a guardar "não é parceiro" até outra leitura.
  O ModeInitializer anota aqui o modo que aplica; a regra distingue essa mudança da troca da pessoa.
*/
type Modo = "owner" | "tenant";

/** O último modo que o ModeInitializer aplicou nesta carga de página. Só é escrito em efeito, no navegador. */
let anotado: Modo | null = null;

export function anotarModoDoServidor(modo: Modo | null): void {
  anotado = modo;
}

export function modoAnotadoDoServidor(): Modo | null {
  return anotado;
}

/**
 * PURO. A pessoa trocou de modo enquanto o perfil era lido? Se sim, a escolha dela vence o que foi lido.
 * - troca recente ainda por confirmar no servidor (pendente): sim, sempre;
 * - o modo não mudou: não;
 * - mudou para o modo que o servidor mandou aplicar nesta carga: não — foi o ModeInitializer;
 * - mudou para outro modo: sim.
 */
export function trocaDaPessoaNoMeio(e: { pendente: boolean; modoAntes: Modo | null; modoAgora: Modo | null; modoDoServidor: Modo | null }): boolean {
  if (e.pendente) return true;
  if (e.modoAgora === e.modoAntes) return false;
  return e.modoAgora !== e.modoDoServidor;
}
