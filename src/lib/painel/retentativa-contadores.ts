/*
  E653 (família E497/E456) — a casca lê os números do menu e o selo do sino num GET (/api/painel/contadores). Quando o
  servidor atrasa o contexto inicial (null) e o GET também falha, a casca ficava em CONTADORES_VAZIOS: selo do sino em 0
  e menu "de conta nova" sem mudança nos avisos, até o próximo minuto ou foco. Agora a falha seguida tenta de novo logo,
  com esperas crescentes; passadas as tentativas, vale o relógio normal. PURO.
*/
export const ESPERAS_CONTADORES_MS = [2_000, 5_000, 12_000] as const;

/** Espera antes da próxima tentativa depois de `falhasSeguidas` falhas (0 = a primeira falha); null = sem mais tentativas. */
export function esperaRetentativaContadores(falhasSeguidas: number): number | null {
  return ESPERAS_CONTADORES_MS[falhasSeguidas] ?? null;
}
