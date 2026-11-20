"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { guardarUltimaPublica } from "@/lib/navegacao/ultima-publica";

/** E784: a cada troca de página pública, lembra qual foi — o "Voltar ao site" do admin devolve a pessoa a ela. */
export function RastroPublico() {
  const pathname = usePathname();
  useEffect(() => {
    guardarUltimaPublica(pathname + window.location.search);
  }, [pathname]);
  return null;
}
