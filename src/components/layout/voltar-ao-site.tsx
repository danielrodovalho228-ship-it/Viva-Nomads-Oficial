"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ChevronLeft } from "lucide-react";
import { DESTINO_PADRAO_VOLTAR_AO_SITE, destinoVoltarAoSite, lerUltimaPublica } from "@/lib/navegacao/ultima-publica";

// A rota guardada só muda nas páginas públicas (RastroPublico); dentro do admin não há o que assinar.
const semAssinatura = () => () => {};
const destinoNoNavegador = () => destinoVoltarAoSite(lerUltimaPublica());
const destinoNoServidor = () => DESTINO_PADRAO_VOLTAR_AO_SITE;

/** E784: "‹ Voltar ao site" do admin no celular — a última página pública da pessoa; entrada direta → home. */
export function VoltarAoSite() {
  // Lê o sessionStorage sem setState dentro de useEffect (lint react-hooks/set-state-in-effect); no servidor, a home.
  const href = useSyncExternalStore(semAssinatura, destinoNoNavegador, destinoNoServidor);
  return (
    <Link href={href} className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-forest" data-testid="admin-voltar-site">
      <ChevronLeft className="h-5 w-5" aria-hidden /> Voltar ao site
    </Link>
  );
}
