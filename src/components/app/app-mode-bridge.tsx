"use client";

import { useEffect } from "react";
import { APP_COOKIE, isAppUserAgent, isMarketingPath } from "@/lib/app-mode";

/**
 * Confirma o MODO APP no navegador e grava o cookie `vn_app=1` (1 ano). Com o
 * cookie, o servidor (proxy) passa a reconhecer o app e redireciona o marketing
 * antes de renderizar. Na 1ª abertura (cookie ainda não existia), se o app caiu
 * numa página de marketing, recarrega "/" para o proxy mandar à aba certa.
 *
 * No site normal (navegador comum) não faz nada.
 */
export function AppModeBridge() {
  useEffect(() => {
    let vivo = true;
    const jaTinhaCookie = document.cookie.split("; ").some((c) => c === `${APP_COOKIE}=1`);
    const w = window as unknown as { VivaNomadsApp?: unknown; __VN_APP__?: unknown };

    const marcar = () => {
      if (!vivo) return;
      document.documentElement.setAttribute("data-app", "1");
      if (!jaTinhaCookie) {
        document.cookie = `${APP_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax; Secure`;
        if (isMarketingPath(window.location.pathname)) window.location.replace("/");
      }
    };

    if (isAppUserAgent(navigator.userAgent) || w.VivaNomadsApp || w.__VN_APP__) {
      marcar();
    } else {
      import("@capacitor/core")
        .then(({ Capacitor }) => {
          if (Capacitor?.isNativePlatform?.()) marcar();
        })
        .catch(() => {});
    }
    return () => {
      vivo = false;
    };
  }, []);
  return null;
}
