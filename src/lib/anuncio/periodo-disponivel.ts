/** Datas ISO (AAAA-MM-DD) de "Disponível a partir de" / "Disponível até". Vazio = sem limite. */
export const MSG_DISPONIVEL_ATE_ANTES = "“Disponível até” não pode ser antes de “a partir de”.";

export function periodoDisponivelValido(de?: string | null, ate?: string | null): boolean {
  const a = (de ?? "").slice(0, 10);
  const b = (ate ?? "").slice(0, 10);
  if (!a || !b) return true;
  return b >= a;
}
