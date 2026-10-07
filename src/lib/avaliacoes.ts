/*
  Reputação — regras PURAS e testáveis (sem imports @/).
  Avaliação bidirecional: proprietário ↔ inquilino após a estadia.
*/

/** Média (0..5) de uma lista de notas 1..5. 0 se vazia. */
export function mediaAvaliacoes(notas: number[]): number {
  const validas = notas.filter((n) => n >= 1 && n <= 5);
  if (validas.length === 0) return 0;
  const soma = validas.reduce((s, n) => s + n, 0);
  return Math.round((soma / validas.length) * 10) / 10;
}

/** Rótulo curto de reputação a partir da média e da quantidade. */
export function reputacaoLabel(media: number, n: number): string {
  if (n === 0) return "Sem avaliações ainda";
  const nota = media.toFixed(1);
  const conta = `${n} ${n === 1 ? "avaliação" : "avaliações"}`;
  if (media >= 4.5) return `Excelente · ${nota} (${conta})`;
  if (media >= 4) return `Ótimo · ${nota} (${conta})`;
  if (media >= 3) return `Bom · ${nota} (${conta})`;
  return `${nota} (${conta})`;
}

/** Limite de cada comentário (público, privado para a outra parte, privado para a Viva). */
export const LIMITE_COMENTARIO = 500;

/** Valida uma avaliação antes de enviar. */
export function validarAvaliacao(rating: number, comentario?: string): string | null {
  if (!(rating >= 1 && rating <= 5)) return "Escolha de 1 a 5 estrelas.";
  if (comentario && comentario.length > LIMITE_COMENTARIO) return `Comentário muito longo (máx. ${LIMITE_COMENTARIO}).`;
  return null;
}

/**
 * Ofensa/discriminação — MESMA lista da função do banco public.contem_ofensa
 * (0089). Quem cai aqui não é bloqueado: a avaliação vai para a moderação.
 */
export const OFENSAS = [
  "porra", "caralho", "merda", "bosta", "puta", "puto", "putaria", "foda", "fodase", "fdp", "vsf", "tnc", "pqp", "cu", "buceta",
  "arrombad[oa]", "desgracad[oa]", "vagabund[oa]", "otari[oa]", "babaca", "imbecil", "retardad[oa]", "escrot[oa]", "piranha", "vadia",
  "corno", "viado", "veado", "bicha", "traveco", "sapatao", "macaco", "macaca", "crioul[oa]", "favelad[oa]",
] as const;
const RE_OFENSA = new RegExp(`(?<![\\p{L}\\d])(${OFENSAS.join("|")})(?![\\p{L}\\d])`, "u");
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function contemOfensa(texto: string | null | undefined): boolean {
  return !!texto && RE_OFENSA.test(semAcento(texto));
}

/** Papel oposto — quem o autor avalia. */
export function papelOposto(papelAutor: "proprietario" | "inquilino"): "inquilino" | "proprietario" {
  return papelAutor === "proprietario" ? "inquilino" : "proprietario";
}
