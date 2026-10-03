"use client";

import { useEffect } from "react";
import { registrarPushToken } from "@/lib/data/push-actions";
import { detectExpoApp, type AppPlatform } from "@/lib/use-native";
import { PUSH_ATIVO } from "@/lib/flags";

/**
 * Ponte de push do app EXPO (wrapper WebView — repositório viva-nomads-app).
 *
 * Diferente do Capacitor (que registra o token de dentro da própria WebView via
 * plugin), no Expo o token nasce na camada NATIVA do app. O app injeta/entrega o
 * Expo push token para a página, e este componente só o persiste no site.
 *
 * CONTRATO com o app (Prompt 1) — qualquer um destes serve, o app usa o que for
 * mais simples no react-native-webview:
 *   1. síncrono:   window.__VN_APP__ = { platform, pushToken }
 *   2. função:     window.vnRegisterPushToken(token, platform)  // injectJavaScript
 *   3. mensagem:   window.postMessage(JSON.stringify({ type: "vn-push-token", token, platform }))
 *
 * Mesma flag do Capacitor (PUSH_ATIVO): sem ela, não registramos nada — assim
 * nenhum token entra no banco antes de o canal estar pronto. O token é guardado
 * no mesmo localStorage ("vn-push-token") usado no logout (dashboard-shell),
 * então a limpeza ao sair da conta já cobre os dois apps.
 *
 * Só na WebView do app Expo; no-op na web comum e no Capacitor.
 */
const TOKEN_KEY = "vn-push-token";

function normalizaPlatform(p: unknown, fallback: AppPlatform | null): "android" | "ios" {
  if (p === "ios" || p === "android") return p;
  return fallback === "ios" ? "ios" : "android";
}

export function ExpoPushBridge() {
  useEffect(() => {
    if (!PUSH_ATIVO) return;
    const { isApp, platform } = detectExpoApp();
    if (!isApp) return;

    let cancelled = false;

    function salvar(token: unknown, plat: unknown) {
      if (cancelled || typeof token !== "string" || !token) return;
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch {
        /* localStorage indisponível: segue sem guardar */
      }
      registrarPushToken(token, normalizaPlatform(plat, platform), "expo").catch(() => {});
    }

    // 1) Token já injetado de forma síncrona pelo app.
    const vn = (window as unknown as { __VN_APP__?: { platform?: AppPlatform; pushToken?: string } })
      .__VN_APP__;
    if (vn?.pushToken) salvar(vn.pushToken, vn.platform);

    // 2) Função chamável pelo app via injectJavaScript.
    (window as unknown as { vnRegisterPushToken?: (t: string, p?: string) => void }).vnRegisterPushToken =
      (t: string, p?: string) => salvar(t, p);

    // 3) Mensagem (postMessage) — aceita objeto ou JSON string.
    function onMessage(ev: MessageEvent) {
      let data: unknown = ev.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const d = data as { type?: string; token?: string; platform?: string } | null;
      if (d && d.type === "vn-push-token") salvar(d.token, d.platform);
    }
    window.addEventListener("message", onMessage);

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      try {
        delete (window as unknown as { vnRegisterPushToken?: unknown }).vnRegisterPushToken;
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}
