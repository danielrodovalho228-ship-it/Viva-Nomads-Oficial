/*
  E989 — soltar fotos DURANTE um envio apagava o lote anterior. Cada envio fechava sobre a galeria do momento em que
  começou: o 2º lote (solto enquanto o 1º subia) terminava com "galeria antiga + lote 2" e sobrescrevia o "galeria +
  lote 1" que tinha acabado de entrar. Regra: os lotes entram em FILA (um de cada vez) e cada um junta as suas fotos à
  galeria COMO ELA ESTÁ quando ele termina — nunca à cópia de quando começou. PURO.
*/

/** Fila serial: cada tarefa só começa quando a anterior terminou (com sucesso ou erro). */
export function criarFila(): <T>(tarefa: () => Promise<T>) => Promise<T> {
  let cauda: Promise<unknown> = Promise.resolve();
  return <T>(tarefa: () => Promise<T>): Promise<T> => {
    const p = cauda.then(tarefa, tarefa);
    cauda = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  };
}

/** O que entra na galeria no fim de um lote: a galeria ATUAL (lida agora) + as fotos novas deste lote. */
export function galeriaComLote<T>(atual: readonly T[], novas: readonly T[]): T[] {
  return [...atual, ...novas];
}
