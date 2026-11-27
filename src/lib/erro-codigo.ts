/*
  Código de referência de uma tela de erro. O Next 16 entrega ao error.tsx um `digest` (hash do erro do servidor, o mesmo
  que sai no log). A pessoa lê esse código ao falar com a Viva e a equipe acha a causa no log em vez de adivinhar — antes
  a tela dizia só "foi um tropeço" e escondia tudo. PURO. Só devolve texto seguro (letras, números, - e _), no máximo 24.
*/
export function codigoDoErro(error: unknown): string | null {
  const d = (error as { digest?: unknown } | null | undefined)?.digest;
  if (typeof d !== "string") return null;
  const limpo = d.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
  return limpo.length >= 4 ? limpo : null;
}
