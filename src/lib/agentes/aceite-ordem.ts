/** Regras puras do aceite nas ordens dos agentes (ordem 3c3d8a9e, parte 2). */

export const LIMITE_ORDEM = 4000;
export const LIMITE_FALTA_ORDEM = 1000;

/** "Reabrir" exige dizer o que falta (vira o texto que o agente lê). */
export function validarReabertura(falta: unknown): { ok: true; falta: string } | { ok: false; erro: string } {
  const t = typeof falta === "string" ? falta.trim() : "";
  if (!t) return { ok: false, erro: "Diga o que falta para reabrir a ordem." };
  if (t.length > LIMITE_FALTA_ORDEM) return { ok: false, erro: `Texto muito longo (máximo ${LIMITE_FALTA_ORDEM} caracteres).` };
  return { ok: true, falta: t };
}

/**
 * Texto da ordem reaberta: o original + "REABERTA — o que falta: …", sempre dentro do limite de 4000 do banco.
 * Se não couber, corta o ORIGINAL (o que falta nunca é cortado).
 */
export function textoReaberto(original: string, falta: string): string {
  const marca = `\n\nREABERTA por quem pediu — o que falta: ${falta}`;
  const sobra = LIMITE_ORDEM - marca.length;
  const base = original.length > sobra ? `${original.slice(0, Math.max(0, sobra - 1))}…` : original;
  return base + marca;
}
