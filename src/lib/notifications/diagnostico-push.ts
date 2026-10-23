/*
  Prompt 44 (item 6) — o cartão "Push" do admin. PURO: recebe os aparelhos (push_tokens) e os envios (push_envios, 0227)
  já lidos e devolve os números. Contas de teste (is_teste) ficam de fora dos dois lados.
  Roda: node --test src/lib/notifications/diagnostico-push.test.ts
*/

export const DIAS_DIAGNOSTICO_PUSH = 7;
/** push_envios mais velho que isto é apagado pelo cron (o cartão só olha 7 dias). */
export const DIAS_RETENCAO_PUSH_ENVIOS = 30;

export type PlataformaPush = "android" | "ios" | "web";

export interface AparelhoPush {
  user_id: string;
  platform: string;
}

export interface EnvioPush {
  user_id: string | null;
  enviados: number;
  falhas: number;
  tokens_mortos: number;
  criado_em: string;
}

export interface ResumoPush {
  aparelhos: Record<PlataformaPush, number>;
  totalAparelhos: number;
  envios: number;
  entregues: number;
  falhas: number;
  tokensMortos: number;
  /** Falhas sobre o total tentado (0–100), ou null sem envio no período. */
  taxaFalha: number | null;
}

export function resumoDoPush(p: {
  aparelhos: AparelhoPush[];
  envios: EnvioPush[];
  contasDeTeste: Iterable<string>;
  agora: Date;
  dias?: number;
}): ResumoPush {
  const teste = new Set(p.contasDeTeste);
  const aparelhos: Record<PlataformaPush, number> = { android: 0, ios: 0, web: 0 };
  for (const a of p.aparelhos) {
    if (teste.has(a.user_id)) continue;
    if (a.platform === "android" || a.platform === "ios" || a.platform === "web") aparelhos[a.platform]++;
  }
  const desde = p.agora.getTime() - (p.dias ?? DIAS_DIAGNOSTICO_PUSH) * 86_400_000;
  let envios = 0;
  let entregues = 0;
  let falhas = 0;
  let tokensMortos = 0;
  for (const e of p.envios) {
    if (e.user_id && teste.has(e.user_id)) continue;
    if (!(Date.parse(e.criado_em) >= desde)) continue;
    envios++;
    entregues += Math.max(0, e.enviados);
    falhas += Math.max(0, e.falhas);
    tokensMortos += Math.max(0, e.tokens_mortos);
  }
  const tentados = entregues + falhas;
  return {
    aparelhos,
    totalAparelhos: aparelhos.android + aparelhos.ios + aparelhos.web,
    envios,
    entregues,
    falhas,
    tokensMortos,
    taxaFalha: tentados ? Math.round((falhas / tentados) * 100) : null,
  };
}

/** Data de corte da limpeza de push_envios (ISO). */
export function corteRetencaoPushEnvios(agora: Date): string {
  return new Date(agora.getTime() - DIAS_RETENCAO_PUSH_ENVIOS * 86_400_000).toISOString();
}
