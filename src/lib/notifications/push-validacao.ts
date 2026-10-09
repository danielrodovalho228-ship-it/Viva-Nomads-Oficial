/*
  Validação PURA da entrada de registrarPushToken e limite do push de teste (5/h por admin).
  Roda: node --test src/lib/notifications/push-validacao.test.ts
*/
import { isExpoToken } from "./expo-push.ts";

export const PLATAFORMAS = ["android", "ios", "web"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

/** Token de push aceito: Expo ("ExponentPushToken[...]") ou token nativo/FCM (tamanho limitado). */
export function tokenValido(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length < 10 || token.length > 4096 || /\s/.test(token)) return false;
  if (token.startsWith("Expo")) return isExpoToken(token);
  return /^[\w:\-.]+$/.test(token);
}

export function plataformaValida(p: unknown): p is Plataforma {
  return typeof p === "string" && (PLATAFORMAS as readonly string[]).includes(p);
}

export const PUSH_TESTE_LIMITE = 5;
export const PUSH_TESTE_JANELA_MS = 60 * 60 * 1000;

/** Janela deslizante em memória (melhor esforço por instância). Devolve false se estourou. */
export function podeEnviarTeste(historico: Map<string, number[]>, usuario: string, agora = Date.now()): boolean {
  const recentes = (historico.get(usuario) ?? []).filter((t) => agora - t < PUSH_TESTE_JANELA_MS);
  if (recentes.length >= PUSH_TESTE_LIMITE) {
    historico.set(usuario, recentes);
    return false;
  }
  recentes.push(agora);
  historico.set(usuario, recentes);
  return true;
}
