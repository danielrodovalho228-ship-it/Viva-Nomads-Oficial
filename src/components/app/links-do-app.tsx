"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { caminhoDoLink, destinoDaRota, DOMINIO_APP } from "@/config/rotas-app";
import { isMarketingPath } from "@/lib/app-mode";

/**
 * Links do app (fonte única: src/config/rotas-app.ts).
 *  1) Android (Capacitor): link de e-mail abre o app → vai direto à tela do link.
 *  2) Dentro do app, tela "só do site" → aviso com "Abrir no navegador".
 *  3) No navegador do celular, nas telas do app → faixa "Abrir no app" (fechável, 30 dias).
 */

type Janela = Window & {
  VivaNomadsApp?: unknown;
  __VN_APP__?: unknown;
  ReactNativeWebView?: { postMessage: (m: string) => void };
};

function noApp(): boolean {
  return document.documentElement.getAttribute("data-app") === "1";
}

/** Abre a URL no navegador do sistema (nunca dentro do próprio app). */
async function abrirNoNavegador(url: string): Promise<void> {
  const w = window as Janela;
  // iPhone (Expo): o app escuta esta mensagem e chama Linking.openURL (Safari).
  if (w.ReactNativeWebView?.postMessage) {
    w.ReactNativeWebView.postMessage(JSON.stringify({ tipo: "abrir-navegador", url }));
    return;
  }
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    }
  } catch {
    /* fora do app */
  }
  window.open(url, "_blank", "noopener");
}

const CHAVE_LINK = "vn_link_tratado";
const CHAVE_FAIXA = "vn_faixa_app_fechada";
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

export function LinksDoApp() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [emApp, setEmApp] = useState(false);
  const [faixa, setFaixa] = useState(false);

  // 1) Links que abriram o app Android (frio: getLaunchUrl; quente: appUrlOpen).
  useEffect(() => {
    let remover: (() => void) | undefined;
    const ir = (link: string | undefined) => {
      const caminho = link ? caminhoDoLink(link) : null;
      if (!caminho) return;
      try {
        if (sessionStorage.getItem(CHAVE_LINK) === link) return; // o mesmo link não leva duas vezes
        sessionStorage.setItem(CHAVE_LINK, link!);
      } catch {
        /* sem storage: segue */
      }
      if (caminho !== window.location.pathname + window.location.search) window.location.assign(caminho);
    };
    import("@capacitor/core")
      .then(async ({ Capacitor }) => {
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");
        const inicial = await App.getLaunchUrl().catch(() => undefined);
        ir(inicial?.url);
        const h = await App.addListener("appUrlOpen", (e) => ir(e.url));
        remover = () => void h.remove();
      })
      .catch(() => {});
    return () => remover?.();
  }, []);

  // Estado por tela: dentro do app? mostrar a faixa?
  useEffect(() => {
    const dentro = noApp();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmApp(dentro);
    let fechada = false;
    try {
      fechada = Date.now() - Number(localStorage.getItem(CHAVE_FAIXA) ?? 0) < TRINTA_DIAS;
    } catch {
      /* sem storage */
    }
    const android = /Android/i.test(navigator.userAgent);
    setFaixa(!dentro && !fechada && android && process.env.NEXT_PUBLIC_APP_ANDROID_PUBLICADO === "on" && destinoDaRota(pathname) === "app");
  }, [pathname]);

  // 2) Dentro do app, tela só do site (marketing já é redirecionado pelo proxy).
  if (emApp && destinoDaRota(pathname) === "site" && !isMarketingPath(pathname)) {
    const url = `https://${DOMINIO_APP}${pathname}${typeof window !== "undefined" ? window.location.search : ""}`;
    return (
      <div role="dialog" aria-modal="true" aria-labelledby="so-site-titulo" className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <ExternalLink className="h-6 w-6 text-forest" />
          <h2 id="so-site-titulo" className="mt-3 font-title text-lg font-bold text-ink">
            Esta parte fica no site
          </h2>
          <p className="mt-1 text-sm text-muted">Ela abre no navegador do celular, com mais espaço. Se pedir, entre com a mesma conta: depois você volta direto para esta tela.</p>
          <Button className="mt-5 w-full" onClick={() => abrirNoNavegador(url)}>
            <ExternalLink className="h-4 w-4" /> Abrir no navegador
          </Button>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.replace("/dashboard"))}
            className="mt-3 w-full rounded-full py-2 text-sm font-medium text-muted hover:text-forest"
          >
            Voltar
          </button>
          <p className="mt-2 break-all text-center text-xs text-muted">{url.replace("https://", "")}</p>
        </div>
      </div>
    );
  }

  // 3) Faixa "Abrir no app" (Android; no iPhone vale o banner da Apple, via NEXT_PUBLIC_IOS_APP_ID).
  if (faixa) {
    const loja = `https://play.google.com/store/apps/details?id=br.com.vivanomads.app`;
    const intent = `intent://${DOMINIO_APP}${pathname}#Intent;scheme=https;package=br.com.vivanomads.app;S.browser_fallback_url=${encodeURIComponent(loja)};end`;
    return (
      <div className="web-only fixed inset-x-0 top-0 z-[80] flex items-center gap-3 border-b border-line bg-white px-4 py-2 text-sm shadow-sm">
        <Smartphone className="h-5 w-5 shrink-0 text-forest" />
        <span className="min-w-0 flex-1 text-ink">Abrir no app Viva Nomads</span>
        <a href={intent} className="rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-white">
          Abrir
        </a>
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => {
            try {
              localStorage.setItem(CHAVE_FAIXA, String(Date.now()));
            } catch {
              /* sem storage */
            }
            setFaixa(false);
          }}
          className="p-1 text-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return null;
}
