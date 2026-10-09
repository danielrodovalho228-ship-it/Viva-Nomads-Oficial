/*
  Expo Push (app Viva Nomads) — parte PURA: validação do token, caminho interno, lotes de
  100 e leitura dos tickets. A rede fica em push.ts; aqui tudo é testável sem rede.
  Roda: node --test src/lib/notifications/expo-push.test.ts
*/
export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const EXPO_LOTE = 100;
export const EXPO_CANAL = "avisos";

export function isExpoToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(token);
}

/** Só caminho interno ("/rota"): nunca "//", "/\" nem URL externa. Senão, o fallback. */
export function caminhoInterno(u: string | null | undefined, fallback = "/dashboard"): string {
  return typeof u === "string" && u[0] === "/" && u[1] !== "/" && u[1] !== "\\" && !/[\s\u0000-\u001f]/.test(u)
    ? u
    : fallback;
}

export interface MensagemExpo {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId: string;
  data: { url: string };
}

export function montarMensagens(tokens: string[], p: { title: string; body: string; url?: string }): MensagemExpo[] {
  const url = caminhoInterno(p.url);
  return tokens.map((to) => ({ to, title: p.title, body: p.body, sound: "default", channelId: EXPO_CANAL, data: { url } }));
}

export function emLotes<T>(itens: T[], tamanho = EXPO_LOTE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}

/** Separa os tokens por tipo: Expo vai ao exp.host; o resto segue pelo FCM (tokens antigos). */
export function separarTokens(tokens: string[]): { expo: string[]; fcm: string[] } {
  const expo: string[] = [];
  const fcm: string[] = [];
  for (const t of tokens) (isExpoToken(t) ? expo : fcm).push(t);
  return { expo, fcm };
}

interface Ticket {
  status?: string;
  details?: { error?: string };
}

/** Lê a resposta do lote (tickets na mesma ordem dos tokens): entregues e tokens mortos. */
export function lerTickets(tokens: string[], resposta: unknown): { enviados: number; mortos: string[] } {
  const data = (resposta as { data?: unknown } | null)?.data;
  const tickets = Array.isArray(data) ? (data as Ticket[]) : [];
  let enviados = 0;
  const mortos: string[] = [];
  tokens.forEach((token, i) => {
    const t = tickets[i];
    if (!t) return;
    if (t.status === "ok") enviados++;
    else if (t.details?.error === "DeviceNotRegistered") mortos.push(token);
  });
  return { enviados, mortos };
}
