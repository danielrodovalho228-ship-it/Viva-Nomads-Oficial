"use client";

import { useEffect } from "react";

/**
 * Ponte nativa do app (Capacitor) — SÓ no app; no-op na web (imports dinâmicos).
 * Montada no layout raiz para valer no app inteiro.
 *
 *  • Botão Voltar do Android: volta uma página; na tela inicial, fecha o app.
 *  • Links externos: intercepta APENAS `target="_blank"` e `window.open` e abre
 *    no navegador do sistema (@capacitor/browser). NÃO toca em iframes nem no
 *    carregamento de recursos (mapa, vídeo, imagens do Supabase) — senão quebram
 *    dentro do app. A navegação principal já é resolvida pelo allowNavigation.
 */
function ehExterna(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    return !new URL(url).host.endsWith("vivanomads.com.br");
  } catch {
    return false;
  }
}

export function NativeBridge() {
  useEffect(() => {
    let cancelled = false;
    let cleanup: Array<() => void> = [];

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor?.isNativePlatform?.() || cancelled) return;

        const { App } = await import("@capacitor/app");
        const { Browser } = await import("@capacitor/browser");

        // Botão Voltar do Android.
        const back = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        });
        cleanup.push(() => back.remove());

        // Clicks em <a target="_blank"> → navegador do sistema.
        const onClick = (e: MouseEvent) => {
          const a = (e.target as HTMLElement | null)?.closest?.("a");
          if (!a) return;
          const href = a.getAttribute("href") || "";
          if (a.getAttribute("target") === "_blank" && ehExterna(href)) {
            e.preventDefault();
            Browser.open({ url: href }).catch(() => {});
          }
        };
        document.addEventListener("click", onClick, true);
        cleanup.push(() => document.removeEventListener("click", onClick, true));

        // window.open externo → navegador do sistema.
        const origOpen = window.open.bind(window);
        window.open = ((url?: string | URL, ...rest: unknown[]) => {
          const u = typeof url === "string" ? url : url?.toString() ?? "";
          if (u && ehExterna(u)) {
            Browser.open({ url: u }).catch(() => {});
            return null;
          }
          return (origOpen as typeof window.open)(url as string, ...(rest as []));
        }) as typeof window.open;
        cleanup.push(() => {
          window.open = origOpen;
        });
      } catch {
        /* plugin ausente / web: silencioso */
      }
    })();

    return () => {
      cancelled = true;
      cleanup.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      cleanup = [];
    };
  }, []);

  return null;
}
