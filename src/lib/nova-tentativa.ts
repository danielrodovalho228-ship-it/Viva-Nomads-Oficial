/**
 * Uma nova tentativa automática, com espera curta, para leituras públicas que
 * falham de forma transitória (ordem aad2b751: a home mostrou erro e depois
 * normalizou). `falhou` diz quando o resultado conta como falha.
 */
export async function comNovaTentativa<T>(
  fn: () => Promise<T>,
  falhou: (r: T) => boolean,
  esperaMs = 400,
): Promise<T> {
  let ultimo: T | undefined;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      ultimo = await fn();
      if (!falhou(ultimo)) return ultimo;
    } catch (e) {
      if (tentativa === 1) throw e;
    }
    if (tentativa === 0) await new Promise((r) => setTimeout(r, esperaMs));
  }
  return ultimo as T;
}

/** Tile do mapa que deu erro: tenta de novo uma vez (cache-buster), sem laço. */
export function urlDeNovaTentativaTile(src: string, tentativas: number): string | null {
  if (tentativas >= 1 || !src) return null;
  return src + (src.includes("?") ? "&" : "?") + "retry=1";
}
