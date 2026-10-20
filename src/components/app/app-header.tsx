"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { tituloDaTelaApp, ehAbaRaizApp, voltaParaAdmin } from "@/lib/nav-mobile";

/**
 * Cabeçalho curto do MODO APP: título da tela e, fora das abas principais,
 * o botão Voltar. Só aparece dentro do app (classe app-only-flex); no site
 * normal não renderiza nada visível.
 */
export function AppHeader({ direita }: { direita?: React.ReactNode }) {
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
          onClick={() => (voltaParaAdmin(pathname) ? router.push("/admin") : router.back())}
          aria-label="Voltar"
          className="grid h-11 w-11 place-items-center rounded-lg text-forest"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {/* <p>, não <h1>: o título principal (h1) é o da própria página. */}
      <p className={raiz ? "min-w-0 flex-1 truncate px-3 font-title text-base font-bold text-ink" : "min-w-0 flex-1 truncate font-title text-base font-bold text-ink"}>
        {tituloDaTelaApp(pathname)}
      </p>
      {direita && <div className="flex shrink-0 items-center gap-2 pr-1">{direita}</div>}
    </header>
  );
}
