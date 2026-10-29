/*
  E217 (L-70) — chamado no admin: a resposta manual nunca depende da sugestão automática da Viva. Se a sugestão falha
  (erro, sem conexão ou não chega no prazo), aparece um aviso curto perto da caixa e nada fica bloqueado; se o
  atendente já escreveu, a sugestão que chega depois não apaga o que ele digitou.
  PURO. Roda: node --test src/lib/atendimento/sugestao-resposta.test.ts
*/

export const AVISO_SUGESTAO_INDISPONIVEL = "Sugestão indisponível no momento — você pode responder normalmente.";
export const DICA_CAIXA_VAZIA = "Escreva a resposta na caixa acima para enviar.";
/** Quanto a tela espera a sugestão antes de dar o aviso (a resposta manual nunca espera). */
export const PRAZO_SUGESTAO_MS = 25_000;

export type ResultadoSugestao<T> = { ok: true; valor: T } | { ok: false; motivo: "erro" | "conexao" | "prazo"; error?: string };

/** Pede a sugestão com prazo: erro, rejeição ou demora viram falha (nunca uma espera sem fim). */
export async function sugestaoComPrazo<T>(
  pedir: () => Promise<{ ok: true } & T | { ok: false; error?: string }>,
  prazoMs = PRAZO_SUGESTAO_MS,
): Promise<ResultadoSugestao<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<ResultadoSugestao<T>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, motivo: "prazo" }), prazoMs);
  });
  const pedido = pedir().then(
    (r): ResultadoSugestao<T> => (r.ok ? { ok: true, valor: r as T } : { ok: false, motivo: "erro", error: r.error }),
    (): ResultadoSugestao<T> => ({ ok: false, motivo: "conexao" }),
  );
  try {
    return await Promise.race([pedido, prazo]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A sugestão chegou: vai para a caixa só se o atendente ainda não escreveu nada (ou se ele pediu outra de propósito).
 * Senão fica só como nota na conversa ("Editar antes de enviar"), sem apagar o texto dele.
 */
export function sugestaoVaiParaACaixa(textoAtual: string, pedidaPeloAtendente: boolean): boolean {
  return pedidaPeloAtendente || textoAtual.trim() === "";
}

/** O envio manual só depende do texto (e de não haver outro envio em curso) — nunca da sugestão. */
export function podeEnviarResposta(texto: string, ocupado: boolean): boolean {
  return !ocupado && texto.trim() !== "";
}
