/**
 * Repete uma operação até `max` vezes (pausa crescente entre as tentativas).
 * Usado no login do global-setup: um login que falha uma vez (servidor ainda
 * esquentando, rede) não pode derrubar a suíte inteira com 0 testes.
 */
export async function comTentativas<T>(
  fn: (tentativa: number) => Promise<T>,
  max = 3,
  pausaMs = 2_000,
  esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  /** Falha que não adianta repetir (ex.: o limite de login recusou): para na hora, sem pausa e sem nova tentativa. */
  desistir?: (erro: unknown) => boolean,
): Promise<T> {
  let ultimo: unknown;
  for (let i = 1; i <= max; i++) {
    try {
      return await fn(i);
    } catch (e) {
      ultimo = e;
      if (desistir?.(e)) break;
      if (i < max) await esperar(pausaMs * i);
    }
  }
  throw ultimo;
}
