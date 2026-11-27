/**
 * E503 (reprova da rodada 8): o Início renderiza no servidor e esperava TODAS as leituras — uma só que ficasse
 * pendurada mantinha o esqueleto na tela por mais de 25 s. Toda leitura do Início e da casca passa por aqui: passou do
 * prazo, rejeita, e quem chamou cai no caminho de "não consegui ler agora" que já existia (aviso no topo, contador "—",
 * menu pela rota), em vez de a tela esperar para sempre.
 */
export const LIMITE_LEITURA_INICIO_MS = 6_000;
/** A casca (modo e contadores do menu) espera menos: se atrasar, o menu pinta pela rota de contadores, como já faz. */
export const LIMITE_CASCA_MS = 3_000;

export function comLimite<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("tempo esgotado")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
