"use client";

import { useEffect } from "react";
import { registrarVisitaComRef } from "@/lib/data/cartoes-actions";

/**
 * Página do imóvel aberta por um cartão (QR ou link): manda ref + UTM + assinatura para o servidor conferir e
 * atribuir. Sem login. Depois tira os parâmetros da barra de endereço (a página continua a mesma).
 */
export function RefDaVisita({ imovelId }: { imovelId: string }) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.get("ref") || !q.get("sig")) return;
    const parametros: Record<string, string> = {};
    for (const k of ["ref", "utm_source", "utm_medium", "utm_campaign", "utm_content", "sig"]) parametros[k] = q.get(k) ?? "";
    registrarVisitaComRef(imovelId, parametros)
      .catch(() => null)
      .finally(() => {
        for (const k of Object.keys(parametros)) q.delete(k);
        const resto = q.toString();
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${resto ? `?${resto}` : ""}${window.location.hash}`);
      });
  }, [imovelId]);
  return null;
}
