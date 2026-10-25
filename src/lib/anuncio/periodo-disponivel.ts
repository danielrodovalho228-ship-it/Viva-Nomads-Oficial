/** Datas ISO (AAAA-MM-DD) de "Disponível a partir de" / "Disponível até". Vazio = sem limite. */
export const MSG_DISPONIVEL_ATE_ANTES = "“Disponível até” não pode ser antes de “a partir de”.";

export function periodoDisponivelValido(de?: string | null, ate?: string | null): boolean {
  const a = (de ?? "").slice(0, 10);
  const b = (ate ?? "").slice(0, 10);
  if (!a || !b) return true;
  return b >= a;
}

/** Dias corridos de `de` a `ate` (inclusive o primeiro, exclusive o último, como uma estadia: 25/10→24/11 = 30). */
export function diasDaJanela(de: string, ate: string): number {
  const a = Date.parse(`${de.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${ate.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0;
}

const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * E137: a janela "a partir de → até" precisa caber a duração mínima do próprio anúncio — senão o imóvel fica
 * impossível de alugar. Sem data final, não há janela a conferir. Devolve a mensagem do problema ou null.
 */
export function erroJanelaDisponivel(de?: string | null, ate?: string | null, minimoDias?: number | string | null): string | null {
  const a = (de ?? "").slice(0, 10);
  const b = (ate ?? "").slice(0, 10);
  if (!a || !b) return null;
  if (b < a) return MSG_DISPONIVEL_ATE_ANTES;
  const minimo = Number(minimoDias) || 30;
  const dias = diasDaJanela(a, b);
  return dias < minimo
    ? `De ${br(a)} a ${br(b)} são ${dias} dias — menos que a duração mínima de ${minimo} dias. Mude a data final para ${br(new Date(Date.parse(`${a}T00:00:00Z`) + minimo * 86_400_000).toISOString())} ou depois, ou deixe sem data final.`
    : null;
}
