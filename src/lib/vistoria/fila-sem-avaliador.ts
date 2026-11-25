/*
  E1149 (ORDENS-DUET 638 e 678) — o item "sem avaliador" da fila do admin e quando ele merece aviso. Regra PURA, com as
  leituras e escritas injetadas (testada em e1149-aviso-sem-avaliador-uma-vez.test.ts); quem lê e grava é
  `abrirEscolha`, em servidor.ts.

  O e-mail "Avaliação sem avaliador elegível" saía para todos os admins cada vez que a escolha de um pedido abria sem
  ninguém para o dono escolher — e a rotina, de hora em hora, reabre a escolha de cada pedido parado. O aviso passa a
  sair só quando o item é NOVO ou o MOTIVO muda. A marca é o próprio item aberto (um por pedido, pelo índice único do
  banco): não há coluna nova nem intervalo entre avisos.
*/

/** O item aberto do pedido na fila do admin. */
export type ItemAberto = { id: string; motivo: string | null };

/** O que a regra precisa do banco. `inserir` e `mudarMotivo` devolvem se ESTA chamada gravou. */
export type FilaSemAvaliador = {
  aberto(): Promise<ItemAberto | null>;
  /** Insere o item. `false` quando outra chamada inseriu primeiro (o índice único deixa entrar um só). */
  inserir(motivo: string): Promise<boolean>;
  /** Troca o motivo do item. `false` quando o item já não tem o motivo que esta chamada leu (outra trocou primeiro). */
  mudarMotivo(item: ItemAberto, motivo: string): Promise<boolean>;
};

/** O que mudou na fila: só "novo" e "motivo_mudou" merecem aviso aos admins. */
export type MudancaNaFila = "novo" | "motivo_mudou" | "igual";

/**
 * Regista na fila que o pedido está sem avaliador, com o motivo de agora, e diz o que mudou.
 * A rotina e uma ação do dono podem chamar ao mesmo tempo e ver a mesma fila: só quem de fato gravou devolve mudança.
 */
export async function registrarSemAvaliador(fila: FilaSemAvaliador, motivo: string): Promise<MudancaNaFila> {
  const aberto = await fila.aberto();
  if (!aberto) return (await fila.inserir(motivo)) ? "novo" : "igual";
  if (aberto.motivo === motivo) return "igual";
  return (await fila.mudarMotivo(aberto, motivo)) ? "motivo_mudou" : "igual";
}
