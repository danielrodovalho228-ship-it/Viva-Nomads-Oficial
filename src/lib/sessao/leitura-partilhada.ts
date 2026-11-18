/**
 * E1025 — uma leitura por chave, repartida por todos os que a pedirem na mesma abertura de tela.
 *
 * A casca do painel tem vários componentes que precisam do mesmo dado do servidor (a parceria aprovada, a foto do
 * avatar). Cada um pedia por conta própria ao montar, e a mesma ação de servidor saía 3 a 4 vezes por tela.
 * Aqui o primeiro pedido vai ao servidor; os outros recebem a mesma resposta.
 *
 * - Enquanto a leitura está em curso, todos esperam a mesma.
 * - Depois de chegar, a resposta vale por `validadeMs` (o tempo de uma abertura de tela), e a seguinte lê de novo:
 *   nada fica guardado entre telas.
 * - Leitura que falha não fica guardada.
 * - A chave leva a conta: outra conta neste aparelho não herda a leitura.
 */
type Entrada = { promessa: Promise<unknown>; ate: number };

const leituras = new Map<string, Entrada>();

export function leituraPartilhada<T>(chave: string, ler: () => Promise<T>, validadeMs: number, agora: () => number = Date.now): Promise<T> {
  const guardada = leituras.get(chave);
  if (guardada && agora() < guardada.ate) return guardada.promessa as Promise<T>;
  let promessa: Promise<T>;
  try {
    promessa = ler();
  } catch (e) {
    promessa = Promise.reject(e);
  }
  // Em curso: vale para quem pedir, sem prazo. O prazo começa quando a resposta chega.
  const entrada: Entrada = { promessa, ate: Number.POSITIVE_INFINITY };
  leituras.set(chave, entrada);
  promessa.then(
    () => {
      entrada.ate = agora() + validadeMs;
    },
    () => {
      if (leituras.get(chave) === entrada) leituras.delete(chave);
    },
  );
  return promessa;
}

/** O dado mudou (ex.: foto nova): a leitura seguinte desta chave vai ao servidor. */
export function esquecerLeitura(chave: string): void {
  leituras.delete(chave);
}
