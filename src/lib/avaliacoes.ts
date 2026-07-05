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

/** Valida uma avaliação antes de enviar. */
export function validarAvaliacao(rating: number, comentario?: string): string | null {
  if (!(rating >= 1 && rating <= 5)) return "Escolha de 1 a 5 estrelas.";
  if (comentario && comentario.length > 1000) return "Comentário muito longo (máx. 1000).";
  return null;
}

/** Papel oposto — quem o autor avalia. */
export function papelOposto(papelAutor: "proprietario" | "inquilino"): "inquilino" | "proprietario" {
  return papelAutor === "proprietario" ? "inquilino" : "proprietario";
}
