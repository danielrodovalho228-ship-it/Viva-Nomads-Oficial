"use client";

import { useEffect, useState } from "react";

/**
 * `true` quando rodando dentro do app nativo (Capacitor). SSR-safe: começa
 * `false` (igual ao servidor e ao primeiro paint), vira `true` após montar — sem
 * hydration mismatch. O import do Capacitor é dinâmico (fora do bundle do
 * servidor); na web comum fica `false` para sempre.
 */
export function useIsNative(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    let alive = true;
    import("@capacitor/core")
      .then(({ Capacitor }) => {
        if (alive) setNative(!!Capacitor?.isNativePlatform?.());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return native;
}

// ── App Expo (wrapper WebView — repositório viva-nomads-app) ─────────────────
// O app Expo abre o site numa WebView e se anuncia de DOIS jeitos (um reforça o
// outro): injeta `window.__VN_APP__ = { platform }` e acrescenta " VivaNomadsApp"
// ao user-agent. Isto NÃO é o Capacitor — por isso vive separado do useIsNative.

export type AppPlatform = "ios" | "android";

interface VnAppGlobal {
  platform?: AppPlatform;
}

/** Leitura síncrona (client-only). Fora do app ou no servidor → não é app. */
export function detectExpoApp(): { isApp: boolean; platform: AppPlatform | null } {
  if (typeof window === "undefined") return { isApp: false, platform: null };
  const vn = (window as unknown as { __VN_APP__?: VnAppGlobal }).__VN_APP__;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isApp = !!vn || /VivaNomadsApp/i.test(ua);
  if (!isApp) return { isApp: false, platform: null };
  let platform: AppPlatform | null = vn?.platform ?? null;
  if (!platform) {
    if (/iPhone|iPad|iPod/i.test(ua)) platform = "ios";
    else if (/Android/i.test(ua)) platform = "android";
  }
  return { isApp: true, platform };
}

/**
 * Hook SSR-safe para o app Expo. Começa `{ ready:false }` (igual ao servidor e ao
 * primeiro paint) e resolve após montar — sem hydration mismatch. Use `ready`
 * para só decidir layout depois que a detecção aconteceu (ex.: esconder o botão
 * do Google no iOS sem "piscar" na web).
 */
export function useExpoApp(): { ready: boolean; isApp: boolean; platform: AppPlatform | null } {
  const [state, setState] = useState<{ ready: boolean; isApp: boolean; platform: AppPlatform | null }>({
    ready: false,
    isApp: false,
    platform: null,
  });
  useEffect(() => {
    const d = detectExpoApp();
    // Detecção client-only pós-mount (SSR-safe): o setState síncrono aqui é
    // intencional — mesma convenção do restante do app para este caso.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ ready: true, isApp: d.isApp, platform: d.platform });
  }, []);
  return state;
}
