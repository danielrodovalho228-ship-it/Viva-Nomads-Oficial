"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { registrarPushToken } from "@/lib/data/push-actions";

interface PushDetail {
  token: string | null;
  platform: "ios" | "android";
}

/**
 * Ponte de push com o app (Expo): escuta `viva:push-token` e registra o token do aparelho
 * quando há usuário logado (token null = permissão negada, ignora). No navegador comum não
 * faz nada. O app reenvia o evento a cada carregamento, então o login depois também registra.
 */
export function PushApp() {
  const userId = useAuthStore((s) => s.user?.id);
  const [token, setToken] = useState<PushDetail | null>(null);

  useEffect(() => {
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent<PushDetail>).detail;
      if (d && typeof d.token === "string") setToken(d);
    };
    window.addEventListener("viva:push-token", ouvir);
    return () => window.removeEventListener("viva:push-token", ouvir);
  }, []);

  useEffect(() => {
    if (!userId || userId.startsWith("demo") || !token?.token) return;
    void registrarPushToken(token.token, token.platform === "ios" ? "ios" : "android");
  }, [userId, token]);

  return null;
}

/** Botão "Ativar notificações": só aparece dentro do app; pede a permissão ao lado nativo. */
export function AtivarNotificacoes({ className = "" }: { className?: string }) {
  const [pedido, setPedido] = useState(false);
  // `app-only` (CSS por <html data-app>) esconde no site normal, sem estado nem hidratação divergente.
  return (
    <button
      type="button"
      className={`app-only min-h-11 rounded-xl border border-line px-4 text-sm font-semibold ${className}`}
      onClick={() => {
        (window as unknown as { ReactNativeWebView?: { postMessage(m: string): void } }).ReactNativeWebView?.postMessage(
          JSON.stringify({ tipo: "pedir-push" })
        );
        setPedido(true);
      }}
    >
      {pedido ? "Pedido enviado — confira o aviso do celular" : "Ativar notificações"}
    </button>
  );
}
