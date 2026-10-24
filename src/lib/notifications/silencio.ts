/*
  Prompt 44 (item 5) — o SILÊNCIO das 22h às 7h (Brasília), regra ÚNICA. PURO.
  Antes havia três cópias (lembretes do 50, pedidos automáticos do 38 e manutenção do 59); agora todas leem daqui.
  No silêncio, só saem SEGURANÇA e PRAZO QUE VENCE NO DIA; o resto espera as 7h.
  Roda: node --test src/lib/notifications/silencio.test.ts
*/

const H = 3_600_000;
const BRT = -3 * H;

export const SILENCIO = { inicio: 22, fim: 7 } as const;

const horaBRT = (d: Date) => new Date(d.getTime() + BRT).getUTCHours();

/** Está no silêncio (22h–7h em Brasília)? */
export function emSilencio(agora: Date): boolean {
  const h = horaBRT(agora);
  return h >= SILENCIO.inicio || h < SILENCIO.fim;
}

/** Quando pode sair: agora, ou as 7h (Brasília) seguintes. */
export function proximoEnvioPermitido(agora: Date): Date {
  if (!emSilencio(agora)) return agora;
  const l = new Date(agora.getTime() + BRT);
  const dia = horaBRT(agora) >= SILENCIO.inicio ? l.getUTCDate() + 1 : l.getUTCDate();
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), dia, SILENCIO.fim) - BRT);
}

/** Fura o silêncio? Só segurança e o prazo que vence no próprio dia (ex.: manutenção urgente). */
export function furaOSilencio(p: { seguranca: boolean; prazoHoje?: boolean }): boolean {
  return p.seguranca || p.prazoHoje === true;
}
