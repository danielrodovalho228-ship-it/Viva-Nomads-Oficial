"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { tituloDaTelaApp, ehAbaRaizApp } from "@/lib/nav-mobile";

/**
 * Cabeçalho curto do MODO APP: título da tela e, fora das abas principais,
 * o botão Voltar. Só aparece dentro do app (classe app-only-flex); no site
 * normal não renderiza nada visível.
 */
export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const raiz = ehAbaRaizApp(pathname);
  return (
    <header
      className="app-only-flex sticky top-0 z-30 h-12 items-center gap-1 border-b border-sage-200 bg-white px-2 print:hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {!raiz && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-lg text-forest"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {/* <p>, não <h1>: o título principal (h1) é o da própria página. */}
      <p className={raiz ? "px-3 font-title text-base font-bold text-ink" : "font-title text-base font-bold text-ink"}>
        {tituloDaTelaApp(pathname)}
      </p>
    </header>
  );
}
