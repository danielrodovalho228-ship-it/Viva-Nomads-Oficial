"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { descartarVisitaDeTeste } from "@/lib/eventos/trafego";

/**
 * E282 + E288-B: Vercel Web Analytics com a medição padrão, descartando a página da suíte automática (cookie
 * vn_trafego=e2e, gravado pelo proxy quando vê o cabeçalho do Playwright, ou navegador automatizado). Fonte dos números
 * é o Funil interno; isto só não deixa o robô inflar o painel da Vercel.
 */
export function AnalyticsVercel() {
  return (
    <Analytics
      beforeSend={(evento: BeforeSendEvent) =>
        descartarVisitaDeTeste(typeof document === "undefined" ? "" : document.cookie, typeof navigator !== "undefined" && navigator.webdriver === true) ? null : evento
      }
    />
  );
}
