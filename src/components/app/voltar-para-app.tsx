"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

/** Celular fora do app (navegador)? Só aí o "Voltar para o app" faz sentido. */
export function useCelularNoNavegador(): boolean {
  const [sim, setSim] = useState(false);
  useEffect(() => {
    const celular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSim(celular && document.documentElement.getAttribute("data-app") !== "1");
  }, []);
  return sim;
}

/**
 * "Voltar para o app" depois de confirmar o e-mail ou trocar a senha (fluxos que
 * ficam SEMPRE no navegador). Abre vivanomads://perfil; só aparece no celular.
 */
export function VoltarParaApp({ className = "" }: { className?: string }) {
  const mostrar = useCelularNoNavegador();
  if (!mostrar) return null;
  return (
    <a
      href="vivanomads://perfil"
      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white ${className}`}
    >
      <Smartphone className="h-4 w-4" /> Voltar para o app
    </a>
  );
}
