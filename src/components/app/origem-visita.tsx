"use client";

import { useEffect } from "react";
import { ORIGEM_COOKIE, ORIGEM_DIAS, origemDaUrl, origemParaCookie } from "@/lib/eventos/eventos";

/**
 * Guarda a ORIGEM da 1ª visita (utm_source/medium/campaign) num cookie de 30
 * dias, para os eventos dizerem de onde a pessoa veio (Instagram, Google…).
 * Primeira origem vence: não sobrescreve enquanto o cookie existir.
 */
export function OrigemVisita() {
  useEffect(() => {
    try {
      const ja = document.cookie.split("; ").some((c) => c.startsWith(`${ORIGEM_COOKIE}=`));
      if (ja) return;
      const origem = origemDaUrl(window.location.search);
      if (!origem) return;
      const seguro = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${ORIGEM_COOKIE}=${origemParaCookie(origem)}; path=/; max-age=${ORIGEM_DIAS * 86400}; SameSite=Lax${seguro}`;
    } catch {
      /* sem cookie, sem origem */
    }
  }, []);
  return null;
}
