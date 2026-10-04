"use client";

import type { TipoEvento } from "@/lib/eventos/eventos";

/**
 * Registra um evento anônimo de uso (0067) sem atrasar a navegação: usa
 * navigator.sendBeacon (o navegador entrega mesmo se a página trocar) e cai
 * para fetch keepalive. Nunca lança erro, nunca espera resposta.
 */
export function registrarEvento(
  tipo: TipoEvento,
  extra: { imovelId?: string | null; cidade?: string | null } = {}
): void {
  try {
    if (typeof window === "undefined") return;
    const app = document.documentElement.getAttribute("data-app") === "1";
    const corpo = JSON.stringify({
      tipo,
      imovel_id: extra.imovelId ?? undefined,
      cidade: extra.cidade ?? undefined,
      app,
    });
    const blob = new Blob([corpo], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/evento", blob)) return;
    void fetch("/api/evento", {
      method: "POST",
      body: corpo,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* evento é opcional: nunca atrapalha a tela */
  }
}
