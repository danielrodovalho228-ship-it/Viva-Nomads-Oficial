"use client";

import { useEffect } from "react";

/** Assinaturas já enviadas nesta aba (o componente pode remontar; a visita vai uma vez só). */
const enviadas = new Set<string>();

/**
 * Página do imóvel aberta por um cartão (QR ou link): manda ref + UTM + assinatura para o servidor conferir e
 * atribuir (POST /api/cartoes/visita). Sem login. Depois tira os parâmetros da barra de endereço.
 * Na página do parceiro (cartão do parceiro, 31c) vai `parceiroId` no lugar de `imovelId`.
 */
export function RefDaVisita({ imovelId, parceiroId }: { imovelId?: string; parceiroId?: string }) {
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
      body: JSON.stringify(parceiroId ? { parceiroId, parametros } : { listingId: imovelId, parametros }),
      keepalive: true,
    }).catch(() => null);
  }, [imovelId, parceiroId]);
  return null;
}
