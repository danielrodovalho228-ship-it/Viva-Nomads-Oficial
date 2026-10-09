/**
 * Ninguém decide o PRÓPRIO documento (0056). Quando o admin é o dono do anúncio,
 * a mensagem tem de dizer isso — "não encontrado na fila" enganava (ordem e8a11486, item 3).
 */
export const MSG_DONO_DO_ANUNCIO =
  "Você é o dono deste anúncio: a decisão fica com a análise automática ou outro revisor.";

export function erroConflitoInteresse(donoId: string | null | undefined, revisorId: string): string | null {
  return donoId && donoId === revisorId ? MSG_DONO_DO_ANUNCIO : null;
}
