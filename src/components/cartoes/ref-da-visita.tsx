"use client";

import { useEffect } from "react";

/** Assinaturas já enviadas nesta aba (o componente pode remontar; a visita vai uma vez só). */
const enviadas = new Set<string>();

/**
 * Página do imóvel aberta por um cartão (QR ou link): manda ref + UTM + assinatura para o servidor conferir e
 * atribuir (POST /api/cartoes/visita). Sem login. Depois tira os parâmetros da barra de endereço.
 */
export function RefDaVisita({ imovelId }: { imovelId: string }) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sig = q.get("sig");
    if (!q.get("ref") || !sig) return;
    const chaves = ["ref", "utm_source", "utm_medium", "utm_campaign", "utm_content", "sig"];
    const parametros: Record<string, string> = {};
    for (const k of chaves) parametros[k] = q.get(k) ?? "";
    for (const k of chaves) q.delete(k);
    const resto = q.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${resto ? `?${resto}` : ""}${window.location.hash}`);
    if (enviadas.has(sig)) return;
    enviadas.add(sig);
    void fetch("/api/cartoes/visita", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: imovelId, parametros }),
      keepalive: true,
    }).catch(() => null);
  }, [imovelId]);
  return null;
}
